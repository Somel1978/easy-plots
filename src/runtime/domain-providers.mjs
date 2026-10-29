/** Typed Foundry-native narrative effects. Only exact provider capabilities; no
 * generic arbitrary document patch or script evaluation. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const scopePattern=/^[a-z][a-z0-9-]{0,48}$/;
const ensureOperation=(ctx)=>{
  if(typeof ctx?.operationId!=='string'||!/^ep:operation:[A-Za-z0-9_:-]{6,200}$/.test(ctx.operationId)||
    typeof ctx?.sourceEventId!=='string'||!ctx.sourceEventId.startsWith('ep:event:'))
    fail('EFFECT_PROVENANCE','Journaled operation and source event required');
};
function context(repository,gmProvider){
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function')fail('INVALID_PROVIDER','Guarded repository and GM required');
  return ()=>{const gm=gmProvider();assertLocalGM(gm);return gm;};
}
async function getVerified(repository,locator,gm){
  const row=await repository.read(locator.id,{partitionId:locator.partitionId,gm});
  if(row&&(row.id!==locator.id||row.partitionId!==locator.partitionId))fail('DOMAIN_CORRUPT','Stored record identity mismatch');
  if(row&&typeof repository.hasReadyIndex==='function'&&!await repository.hasReadyIndex(locator.id,{partitionId:locator.partitionId,gm}))fail('INDEX_UNCERTAIN','Unverified domain index');
  return row;
}
export function factionStandingInput(p){
  if(!p||typeof p!=='object'||Array.isArray(p))fail('FACTION_PAYLOAD','Typed faction standing required');
  assertNarrativeId(p.factionId);assertNarrativeId(p.actorId);
  if(!['reputation','renown'].includes(p.dimension)||!Number.isInteger(p.delta)||p.delta===0||Math.abs(p.delta)>20)
    fail('FACTION_PAYLOAD','Reputation/renown delta must be a nonzero bounded integer');
  if(p.expectedRevision!==null&&p.expectedRevision!==undefined&&(!Number.isInteger(p.expectedRevision)||p.expectedRevision<1))
    fail('FACTION_PAYLOAD','Expected revision must be positive or null');
  return {factionId:p.factionId,actorId:p.actorId,dimension:p.dimension,delta:p.delta,expectedRevision:p.expectedRevision??null};
}
async function standingLocator(p){
  const h=await sha256Hex(`${p.factionId}|${p.actorId}|${p.dimension}`);
  return {id:`ep:standing:${h.slice(0,24)}`,partitionId:`standings-${h.slice(0,2)}`};
}
export function createFactionStandingProvider({repository,gmProvider}={}){
  const gm=context(repository,gmProvider);
  const get=async payload=>{
    const p=factionStandingInput(payload),loc=await standingLocator(p),row=await getVerified(repository,loc,gm());
    if(row&&row.kind!=='faction-standing')fail('DOMAIN_CORRUPT','Unexpected faction standing record');
    return row;
  };
  return Object.freeze({id:'narrative.change-faction-standing',version:'1.0.0',validate:factionStandingInput,get,
    async apply(payload,ctx){gm();ensureOperation(ctx);const p=factionStandingInput(payload),loc=await standingLocator(p),old=await get(payload);
      if(old?.lastOperationId===ctx.operationId)return {recordId:old.id,alreadyApplied:true};
      if((old?.revision??null)!==p.expectedRevision)fail('REVISION_CONFLICT','Standing changed after GM review');
      const value=(old?.value??0)+p.delta;
      if(Math.abs(value)>100)fail('FACTION_RANGE','Standing would exceed configured absolute range');
      const row=await repository.put({...loc,kind:'faction-standing',factionId:p.factionId,actorId:p.actorId,
        dimension:p.dimension,value,lastOperationId:ctx.operationId,lastSourceEventId:ctx.sourceEventId},
      {expectedRevision:p.expectedRevision,gm:gm()});
      return {recordId:row.id,revision:row.revision};
    },
    async verify(payload,ctx){const row=await get(payload);return Boolean(row&&row.lastOperationId===ctx.operationId&&row.lastSourceEventId===ctx.sourceEventId);}
  });
}
export function obligationInput(p){
  if(!p||typeof p!=='object'||Array.isArray(p))fail('OBLIGATION_PAYLOAD','Typed obligation required');
  assertNarrativeId(p.obligationId);assertNarrativeId(p.debtorId);assertNarrativeId(p.creditorId);
  if(p.expectedRevision!==null&&p.expectedRevision!==undefined&&(!Number.isInteger(p.expectedRevision)||p.expectedRevision<1))fail('OBLIGATION_PAYLOAD','Expected revision required');
  if(!['fulfilled','waived','defaulted'].includes(p.outcome))fail('OBLIGATION_PAYLOAD','Explicit settlement outcome required');
  return {obligationId:p.obligationId,debtorId:p.debtorId,creditorId:p.creditorId,outcome:p.outcome,expectedRevision:p.expectedRevision??null};
}
async function obligationLocator(p){const h=await sha256Hex(p.obligationId);return {id:`ep:obligation:${h.slice(0,24)}`,partitionId:`obligations-${h.slice(0,2)}`};}
export function createObligationProvider({repository,gmProvider}={}){
  const gm=context(repository,gmProvider);
  const get=async payload=>{const p=obligationInput(payload),loc=await obligationLocator(p),row=await getVerified(repository,loc,gm());
    if(row&&(row.kind!=='obligation-resolution'||row.obligationId!==p.obligationId))fail('DOMAIN_CORRUPT','Obligation identity mismatch');return row;};
  return Object.freeze({id:'narrative.resolve-obligation',version:'1.0.0',validate:obligationInput,get,
    async apply(payload,ctx){gm();ensureOperation(ctx);const p=obligationInput(payload),loc=await obligationLocator(p),old=await get(payload);
      if(old){if(old.lastOperationId===ctx.operationId)return {recordId:loc.id,alreadyApplied:true};
        fail('OBLIGATION_ALREADY_RESOLVED','Obligation already settled; explicit new obligation required');}
      if(p.expectedRevision!==null)fail('REVISION_CONFLICT','No existing resolution for expected revision');
      const row=await repository.put({...loc,kind:'obligation-resolution',obligationId:p.obligationId,debtorId:p.debtorId,
        creditorId:p.creditorId,outcome:p.outcome,lastOperationId:ctx.operationId,lastSourceEventId:ctx.sourceEventId},
      {expectedRevision:null,gm:gm()});return {recordId:row.id};
    },
    async verify(payload,ctx){const p=obligationInput(payload),row=await get(payload);return Boolean(row&&row.outcome===p.outcome&&row.lastOperationId===ctx.operationId&&row.lastSourceEventId===ctx.sourceEventId);}
  });
}
export function evidenceInput(p){
  if(!p||typeof p!=='object'||Array.isArray(p))fail('EVIDENCE_PAYLOAD','Evidence payload required');
  assertNarrativeId(p.evidenceId);assertNarrativeId(p.investigationId);
  if(typeof p.factId!=='string'||p.factId.length>120||p.factId.length<1)fail('EVIDENCE_PAYLOAD','Verified evidence must identify fact');
  if(!scopePattern.test(p.scope??'world'))fail('EVIDENCE_PAYLOAD','Evidence scope invalid');
  return {evidenceId:p.evidenceId,investigationId:p.investigationId,factId:p.factId,scope:p.scope??'world'};
}
async function evidenceLocator(p){const h=await sha256Hex(`${p.scope}|${p.evidenceId}`);return {id:`ep:evidence:${h.slice(0,24)}`,partitionId:`evidence-${h.slice(0,2)}`};}
export function createEvidenceAttestationProvider({repository,gmProvider}={}){
  const gm=context(repository,gmProvider);
  const get=async payload=>{const p=evidenceInput(payload),loc=await evidenceLocator(p),row=await getVerified(repository,loc,gm());
    if(row&&(row.kind!=='verified-evidence'||row.evidenceId!==p.evidenceId))fail('DOMAIN_CORRUPT','Evidence identity mismatch');return row;};
  return Object.freeze({id:'narrative.attest-evidence',version:'1.0.0',validate:evidenceInput,get,
    async apply(payload,ctx){gm();ensureOperation(ctx);const p=evidenceInput(payload),loc=await evidenceLocator(p),old=await get(payload);
      if(old){if(old.lastOperationId===ctx.operationId)return {recordId:loc.id,alreadyApplied:true};
        fail('EVIDENCE_ALREADY_ATTESTED','Historical evidence correction requires a separate event');}
      const row=await repository.put({...loc,kind:'verified-evidence',...p,
        lastOperationId:ctx.operationId,lastSourceEventId:ctx.sourceEventId,visibility:'gm-only'},
      {expectedRevision:null,gm:gm()});return {recordId:row.id};
    },
    async verify(payload,ctx){const p=evidenceInput(payload),row=await get(payload);return Boolean(row&&row.factId===p.factId&&row.lastOperationId===ctx.operationId&&row.lastSourceEventId===ctx.sourceEventId);}
  });
}
