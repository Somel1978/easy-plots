/** Foundry v14 native 1d20 adjudication with an explicit durable attempt ID.
 * No GM-only DC or roll result is sent to players by this subsystem.
 * A gap between native randomness and durable result persistence is *uncertain*,
 * never automatically rerolled on retry. Supports passive and partial bands.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
function validate(spec){
  if(!spec||typeof spec!=='object')fail('ROLL_INPUT','Roll contract required');
  assertNarrativeId(spec.attemptId);assertNarrativeId(spec.sourceEventId);assertNarrativeId(spec.actorId);
  if(!spec.attemptId.startsWith('ep:attempt:')||!spec.sourceEventId.startsWith('ep:event:'))fail('ROLL_INPUT','Attributed attempt and event IDs required');
  if(!['active','passive'].includes(spec.mode))fail('ROLL_INPUT','Native active or passive check mode required');
  if(!Number.isInteger(spec.modifier)||Math.abs(spec.modifier)>40)fail('ROLL_INPUT','Bounded integer modifier required');
  if(!Number.isInteger(spec.dc)||spec.dc<1||spec.dc>50)fail('ROLL_INPUT','Bounded GM-only difficulty required');
  if(spec.partialMargin!==undefined&&(!Number.isInteger(spec.partialMargin)||spec.partialMargin<0||spec.partialMargin>15))fail('ROLL_INPUT','Partial margin out of bounds');
  if(!['gm-only','authorized-observers'].includes(spec.visibility??'gm-only'))fail('ROLL_VISIBILITY','Protected resolution must be classified');
  return {attemptId:spec.attemptId,sourceEventId:spec.sourceEventId,actorId:spec.actorId,
    mode:spec.mode,modifier:spec.modifier,dc:spec.dc,partialMargin:spec.partialMargin??0,
    visibility:spec.visibility??'gm-only'};
}
const outcome=(total,dc,partialMargin)=>total>=dc?'success':(total+partialMargin>=dc?'partial':'failure');
export async function nativeRollLocator(attemptId){assertNarrativeId(attemptId);
  const h=await sha256Hex(`ep:roll:v1:${attemptId}`);
  return {id:`ep:roll:${h.slice(0,24)}`,partitionId:`rolls-${h.slice(0,2)}`};
}
export class FoundryD20RollCoordinator {
  #repository;#gm;#Roll;#authorizeActor;#resolvePolicy;
  constructor({repository,gmProvider,RollClass,authorizeActor,resolvePolicy=null}={}){
    if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function'||
      typeof RollClass!=='function'||typeof authorizeActor!=='function')fail('ROLL_DEPENDENCY','Native Roll, repository, GM authority and Actor resolution required');
    if(resolvePolicy!==null&&typeof resolvePolicy!=='function')fail('ROLL_DEPENDENCY','Policy resolver must be callable');this.#repository=repository;this.#gm=gmProvider;this.#Roll=RollClass;this.#authorizeActor=authorizeActor;this.#resolvePolicy=resolvePolicy;
  }
  #ctx(){const gm=this.#gm();assertLocalGM(gm);return gm;}
  async get(attemptId){const gm=this.#ctx(),loc=await nativeRollLocator(attemptId);
    const row=await this.#repository.read(loc.id,{partitionId:loc.partitionId,gm});
    if(row&&(row.kind!=='native-roll'||row.attemptId!==attemptId||row.id!==loc.id))fail('ROLL_CORRUPT','Roll attempt record invalid');
    if(row&&typeof this.#repository.hasReadyIndex==='function'&&!await this.#repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm}))fail('INDEX_UNCERTAIN','Roll record requires recovery');
    return row;
  }
  async resolve(spec){
    return this.#resolveRequest(validate(spec));
  }
  async observe(spec,{expectedAdapterStamp=null}={}){
    if(!spec||typeof spec!=='object'||Object.keys(spec).some(k=>!['attemptId','sourceEventId','actorId','mode','modifier','visibility'].includes(k)))fail('ROLL_INPUT','Uninterpreted roll observation requires an explicit bounded contract');
    const validated=validate({...spec,dc:1});
    const {dc,partialMargin,...request}=validated;
    return this.#resolveRequest({...request,interpretation:'uninterpreted'},{expectedAdapterStamp:expectedAdapterStamp?clone(expectedAdapterStamp):null});
  }
  async #resolveRequest(request,{expectedAdapterStamp=null}={}){
    const gm=this.#ctx(),loc=await nativeRollLocator(request.attemptId);
    if(await this.#authorizeActor(request.actorId,gm)!==true)fail('ACTOR_DENIED','GM cannot resolve unbound narrative actor');
    let previous=await this.get(request.attemptId);
    if(previous){
      if(previous.fingerprint!==await sha256Hex(JSON.stringify(previous.request)))fail('ROLL_CORRUPT','Stored roll contract fingerprint differs');const {adapterStamp,...original}=previous.request;if(JSON.stringify(original)!==JSON.stringify(request))fail('ROLL_CONFLICT','Roll attempt ID reused with different contract');
      if(expectedAdapterStamp&&JSON.stringify(adapterStamp)!==JSON.stringify(expectedAdapterStamp))fail('ROLL_ADAPTER_CHANGED','Existing side roll belongs to a different adapter policy');
      return {status:previous.state==='resolved'?'already-resolved':'reconciliation-required',record:previous};
    }
    if(this.#resolvePolicy){const adapterStamp=clone(await this.#resolvePolicy());if(!adapterStamp||typeof adapterStamp.adapterId!=='string'||!/^\d+\.\d+\.\d+$/.test(adapterStamp.adapterVersion??'')||!/^[a-f0-9]{64}$/.test(adapterStamp.adapterContract??''))fail('ROLL_POLICY_UNAVAILABLE','Verified versioned adapter declaration required');if(expectedAdapterStamp&&JSON.stringify(adapterStamp)!==JSON.stringify(expectedAdapterStamp))fail('ROLL_ADAPTER_CHANGED','Pinned adapter changed before native randomness');request={...request,adapterStamp};}else if(expectedAdapterStamp)fail('ROLL_POLICY_UNAVAILABLE','A pinned roll policy resolver is required');
    const fingerprint=await sha256Hex(JSON.stringify(request));
    try{
      await this.#repository.put({...loc,kind:'native-roll',attemptId:request.attemptId,fingerprint,
        state:'prepared',request,visibility:'gm-only'}, {expectedRevision:null,gm});
    }catch(error){previous=await this.get(request.attemptId);if(!previous)throw error;
      if(previous.fingerprint!==fingerprint)fail('ROLL_CONFLICT','Concurrent roll identity conflict');
      return {status:'reconciliation-required',record:previous};
    }
    const prepared=await this.get(request.attemptId);
    if(!prepared||prepared.state!=='prepared'||prepared.fingerprint!==fingerprint)fail('ROLL_UNCERTAIN','Attempt was not durably prepared');
    // Never re-roll if this stage is interrupted. GM must reconcile any uncertainty.
    let total;
    try {
      if(this.#resolvePolicy&&JSON.stringify(await this.#resolvePolicy())!==JSON.stringify(request.adapterStamp))fail('ROLL_ADAPTER_CHANGED','Adapter changed after preparation; do not roll again automatically');
      if(request.mode==='passive')total=10+request.modifier;
      else {
        const roll=new this.#Roll('1d20 + @modifier',{modifier:request.modifier});
        await roll.evaluate({allowInteractive:false});
        total=roll.total;
      }
      if(!Number.isFinite(total)||!Number.isInteger(total))throw new Error('Invalid native roll total');
    } catch(error){
      try{await this.#repository.put({...prepared,state:'uncertain',failureCode:['ROLL_ADAPTER_CHANGED','ROLL_SYSTEM_CHANGED','ROLL_SYSTEM_UNSUPPORTED','ROLL_POLICY_VERSION','ROLL_POLICY_UNAVAILABLE'].includes(error?.code)?error.code:'NATIVE_ROLL_FAILED'},
        {expectedRevision:prepared.revision,gm:this.#ctx()});}catch{}
      return {status:'uncertain'};
    }
    const record=request.interpretation==='uninterpreted'?{...prepared,state:'resolved',total,interpretation:'uninterpreted'}:
      {...prepared,state:'resolved',total,margin:total-request.dc,outcome:outcome(total,request.dc,request.partialMargin)};
    try{await this.#repository.put(record,{expectedRevision:prepared.revision,gm:this.#ctx()});}
    catch{return {status:'uncertain'};}
    const verified=await this.get(request.attemptId);
    if(!verified||verified.state!=='resolved'||verified.total!==total)return {status:'uncertain'};
    return {status:'resolved',record:verified};
  }
}
