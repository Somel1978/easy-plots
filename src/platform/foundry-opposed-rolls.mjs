/** GM-authored, system-neutral opposed d20 checks. No ChatMessage disclosure.
 * Each side uses the existing durable native roll contract. An interrupted
 * attempt is inspected, never automatically resumed or rerolled.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {FoundryD20RollCoordinator} from './foundry-rolls.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
function participant(p){
  if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['actorId','mode','modifier'].includes(k)))fail('CONTESTED_INPUT','A typed participant is required');
  assertNarrativeId(p.actorId);
  if(!['active','passive'].includes(p.mode)||!Number.isInteger(p.modifier)||Math.abs(p.modifier)>40)fail('CONTESTED_INPUT','Explicit check mode and bounded modifier required');
  return {actorId:p.actorId,mode:p.mode,modifier:p.modifier};
}
export function validateOpposedCheck(spec){
  if(!spec||typeof spec!=='object'||Array.isArray(spec)||Object.keys(spec).some(k=>!['attemptId','sourceEventId','initiator','opponent','tiePolicy','partialMargin'].includes(k)))fail('CONTESTED_INPUT','A bounded opposed-check contract is required');
  assertNarrativeId(spec.attemptId);assertNarrativeId(spec.sourceEventId);
  if(!spec.attemptId.startsWith('ep:attempt:')||!spec.sourceEventId.startsWith('ep:event:'))fail('CONTESTED_INPUT','Causal attempt and source event identities required');
  if(!['tie','initiator','opponent'].includes(spec.tiePolicy))fail('CONTESTED_INPUT','An explicit tie policy is required');
  const partialMargin=spec.partialMargin??0;
  if(!Number.isInteger(partialMargin)||partialMargin<0||partialMargin>15)fail('CONTESTED_INPUT','Partial outcome margin must be bounded');
  const initiator=participant(spec.initiator),opponent=participant(spec.opponent);
  if(initiator.actorId===opponent.actorId)fail('CONTESTED_INPUT','Opposed checks require two distinct participants');
  return {attemptId:spec.attemptId,sourceEventId:spec.sourceEventId,initiator,opponent,tiePolicy:spec.tiePolicy,partialMargin};
}
export async function opposedRollLocator(attemptId){
  assertNarrativeId(attemptId);const hash=await sha256Hex(`ep:opposed-roll:v1:${attemptId}`);
  return {id:`ep:opposed-roll:${hash.slice(0,24)}`,partitionId:`opposed-rolls-${hash.slice(0,2)}`};
}
export class FoundryOpposedRollCoordinator {
  #repository;#gm;#authorize;#rolls;#resolvePolicy;
  constructor({repository,gmProvider,authorizeActor,RollClass,resolvePolicy=null}={}){
    this.#resolvePolicy=resolvePolicy;this.#rolls=new FoundryD20RollCoordinator({repository,gmProvider,authorizeActor,RollClass,resolvePolicy});
    this.#repository=repository;this.#gm=gmProvider;this.#authorize=authorizeActor;
  }
  #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
  async get(attemptId){
    const gm=this.#context(),loc=await opposedRollLocator(attemptId),row=await this.#repository.read(loc.id,{partitionId:loc.partitionId,gm});
    if(row&&(row.id!==loc.id||row.kind!=='native-opposed-roll'||row.attemptId!==attemptId))fail('ROLL_CORRUPT','Opposed check record identity mismatch');
    if(row&&typeof this.#repository.hasReadyIndex==='function'&&!await this.#repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm}))fail('INDEX_UNCERTAIN','Opposed check index requires reconciliation');
    return row;
  }
  async resolve(spec){
    let request=validateOpposedCheck(spec);const gm=this.#context();
    for(const side of [request.initiator,request.opponent])if(await this.#authorize(side.actorId,gm)!==true)fail('ACTOR_DENIED','Both opposed-check Actors require current authorization');
    const loc=await opposedRollLocator(request.attemptId),old=await this.get(request.attemptId);
    if(old){
      if(old.fingerprint!==await sha256Hex(JSON.stringify(old.request)))fail('ROLL_CORRUPT','Stored opposed contract fingerprint differs');const {adapterStamp,...original}=old.request;if(JSON.stringify(original)!==JSON.stringify(request))fail('ROLL_CONFLICT','Attempt identity already belongs to another opposed check');
      return {status:old.state==='resolved'?'already-resolved':'reconciliation-required',record:old};
    }
    if(this.#resolvePolicy)request={...request,adapterStamp:clone(await this.#resolvePolicy())};const fingerprint=await sha256Hex(JSON.stringify(request));
    try{await this.#repository.put({...loc,kind:'native-opposed-roll',attemptId:request.attemptId,request,fingerprint,state:'prepared',visibility:'gm-only'},
      {expectedRevision:null,gm:this.#context()});}
    catch(error){const raced=await this.get(request.attemptId);if(!raced)throw error;
      if(raced.fingerprint!==fingerprint)fail('ROLL_CONFLICT','Concurrent opposed check identity conflict');
      return {status:'reconciliation-required',record:raced};}
    const prepared=await this.get(request.attemptId);
    if(!prepared||prepared.state!=='prepared'||prepared.fingerprint!==fingerprint)fail('ROLL_UNCERTAIN','Opposed check preparation could not be verified');
    const sideIds={},totals={};
    try{
      for(const side of ['initiator','opponent']){
        this.#context();sideIds[side]=`ep:attempt:opposed_${fingerprint.slice(0,24)}_${side}`;
        const outcome=await this.#rolls.observe({...request[side],attemptId:sideIds[side],sourceEventId:request.sourceEventId,visibility:'gm-only'},{expectedAdapterStamp:request.adapterStamp??null});
        if(!['resolved','already-resolved'].includes(outcome.status))fail('ROLL_UNCERTAIN','One side of the opposed check has an uncertain result');
        totals[side]=outcome.record.total;
      }
      const margin=totals.initiator-totals.opponent;
      const winner=margin===0?request.tiePolicy:margin>0?'initiator':'opponent';
      const band=margin===0?'tie':Math.abs(margin)<=request.partialMargin?'partial':'decisive';
      const saved=await this.#repository.put({...prepared,state:'resolved',sideAttemptIds:sideIds,totals,margin,winner,band},
        {expectedRevision:prepared.revision,gm:this.#context()});
      const verified=await this.get(request.attemptId);
      if(!verified||verified.state!=='resolved'||verified.revision!==saved.revision||verified.margin!==margin)fail('ROLL_UNCERTAIN','Opposed result did not pass read-back verification');
      return {status:'resolved',record:verified};
    }catch(error){
      const current=await this.get(request.attemptId).catch(()=>null);
      if(current?.state==='prepared')try{await this.#repository.put({...current,state:'uncertain',sideAttemptIds:sideIds,failureCode:error.code??'NATIVE_ROLL_FAILED'},
        {expectedRevision:current.revision,gm:this.#context()});}catch{}
      return {status:'uncertain'};
    }
  }
}
