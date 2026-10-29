/** Bridge approved graph writes to the same records read by domain services.
 * Legacy hashed records are never silently adopted or overwritten.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const digest=value=>sha256Hex(JSON.stringify(value));
const operation=/^ep:operation:[a-zA-Z0-9_:-]{6,200}$/,event=/^ep:event:[a-zA-Z0-9_-]{8,120}$/;
export function canonicalDomainEffect({definition,validate,legacyLocator,repository,domains,gmProvider}){
 const {type,field}=definition.canonical,gm=()=>{const c=gmProvider();assertLocalGM(c);return c;};
 const legacy=async p=>{
  const loc=await legacyLocator(p),row=await repository.read(loc.id,{partitionId:loc.partitionId,gm:gm()});
  if(row&&(row.id!==loc.id||row.partitionId!==loc.partitionId||row.kind!==(definition.legacyKind??`domain-effect-${definition.type}`)||row.scope!==p.scope||row.data?.[field]!==p[field]))fail('DOMAIN_CORRUPT','Legacy effect identity mismatch');
  if(row&&typeof repository.hasReadyIndex==='function'&&!await repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:gm()}))fail('INDEX_UNCERTAIN','Legacy effect index is not ready');
  return row;
 };
 const inspect=async p=>({canonical:await domains.read(type,p.scope,p[field]),legacy:await legacy(p)});
 const get=async payload=>{
  gm();const p=validate(payload),rows=await inspect(p);
  if(rows.legacy){
   if(!rows.canonical)fail('LEGACY_DOMAIN_MIGRATION_REQUIRED','Legacy domain effect needs explicit reviewed adoption');
   const origin=rows.canonical.importReceipt;
   if(!origin||origin.id!==rows.legacy.id||origin.partitionId!==rows.legacy.partitionId||origin.providerId!==definition.id||origin.revision!==rows.legacy.revision||origin.fingerprint!==await digest(rows.legacy))fail('CANONICAL_LEGACY_CONFLICT','Competing domain sources require explicit reconciliation');
  }
  const row=rows.canonical;
  for(const key of definition.identityFields??[])if(row&&row.data[key]!==p[key])fail('IDENTITY_CONFLICT','Canonical narrative identity cannot be retargeted');
  for(const key of definition.fixedOptionalIds??[])if(row?.data[key]!==undefined&&row.data[key]!==p[key])fail('IDENTITY_CONFLICT','Established narrative linkage cannot be retargeted');
  if(row&&type==='observer-belief'&&(row.data.observerId!==p.observerId||row.data.claimId!==p.claimId))fail('BELIEF_IDENTITY','Belief identity cannot change observer or claim');
  if(row&&type==='relationship'&&(row.data.fromId!==p.fromId||row.data.toId!==p.toId))fail('RELATIONSHIP_IDENTITY','Directional relationship identity cannot be retargeted');
  return row?{...row,lastOperationId:row.effectReceipt?.operationId,lastSourceEventId:row.effectReceipt?.sourceEventId}:null;
 };
 return Object.freeze({id:definition.id,version:'1.1.0',validate,get,
  async previewLegacyAdoption(payload){
   gm();const p=validate(payload),rows=await inspect(p);
   return {providerId:definition.id,scope:p.scope,entityId:p[field],canonicalRevision:rows.canonical?.revision??null,
    legacyRevision:rows.legacy?.revision??null,legacyFingerprint:rows.legacy?await digest(rows.legacy):null,
    state:rows.canonical?'canonical-exists':rows.legacy?'review-required':'legacy-absent'};
  },
  async adoptLegacy(payload,{approved=false,expectedLegacyRevision,expectedLegacyFingerprint,reviewEventId}={}){
   gm();const p=validate(payload);
   if(approved!==true||!event.test(reviewEventId??''))fail('LEGACY_ADOPTION_REVIEW','Explicit GM approval and review event are required');
   const rows=await inspect(p);
   if(rows.canonical)fail('CANONICAL_LEGACY_CONFLICT','Adoption cannot overwrite existing canonical data');
   const old=rows.legacy;
   if(!old||old.revision!==expectedLegacyRevision||await digest(old)!==expectedLegacyFingerprint)fail('LEGACY_ADOPTION_STALE','Legacy source changed since preview');
   const clean=validate(old.data);
   for(const key of definition.identityFields??[])if(clean[key]!==p[key])fail('IDENTITY_CONFLICT','Reviewed adoption cannot retarget narrative identity');
   if(type==='relationship'&&(clean.fromId!==p.fromId||clean.toId!==p.toId))fail('RELATIONSHIP_IDENTITY','Reviewed adoption cannot retarget a relationship');
   if(type==='observer-belief'&&(clean.observerId!==p.observerId||clean.claimId!==p.claimId))fail('BELIEF_IDENTITY','Reviewed adoption cannot retarget a belief');
   if(!operation.test(old.lastOperationId??'')||!event.test(old.lastSourceEventId??''))fail('EFFECT_PROVENANCE','Legacy effect lacks durable causal provenance');
   await domains.save({type,scope:p.scope,id:p[field],data:clean,sourceEventId:reviewEventId,
    effectReceipt:{operationId:old.lastOperationId,sourceEventId:old.lastSourceEventId,payloadDigest:await digest(clean)},
    importReceipt:{providerId:definition.id,id:old.id,partitionId:old.partitionId,revision:old.revision,fingerprint:expectedLegacyFingerprint,reviewEventId}});
   return get(p);
  },
  async apply(payload,ctx){
   gm();const p=validate(payload);
   if(!operation.test(ctx?.operationId??'')||!event.test(ctx?.sourceEventId??''))fail('EFFECT_PROVENANCE','Journal operation and source event are required');
   const old=await get(p),payloadDigest=await digest(p);
   if(old?.lastOperationId===ctx.operationId){
    if(old.effectReceipt.payloadDigest!==payloadDigest||old.lastSourceEventId!==ctx.sourceEventId)fail('OPERATION_CONFLICT','Reused operation with different payload or event');
    return {recordId:old.id,revision:old.revision,alreadyApplied:true};
   }
   if((old?.revision??null)!==(p.expectedRevision??null))fail('REVISION_CONFLICT','Effect targets a stale canonical revision');
   if(type==='objective'&&(old?.data.state??null)!==p.previousState)fail('STATE_CONFLICT','Objective from-state does not match canonical state');
   for(const [key,values] of Object.entries(definition.terminalValues??{}))if(old&&values.includes(old.data[key])&&old.data[key]!==p[key])fail('IDENTITY_RETIRED','Retired identities preserve their lineage; create a new identity for a new persona');
   const saved=await domains.save({type,scope:p.scope,id:p[field],data:{...clone(old?.data??{}),...p},expectedRevision:p.expectedRevision??null,
    sourceEventId:ctx.sourceEventId,effectReceipt:{operationId:ctx.operationId,sourceEventId:ctx.sourceEventId,payloadDigest}});
   return {recordId:saved.id,revision:saved.revision};
  },
  async verify(payload,ctx){
   const p=validate(payload),row=await get(p);
   return Boolean(row&&row.lastOperationId===ctx?.operationId&&row.lastSourceEventId===ctx?.sourceEventId&&row.effectReceipt?.payloadDigest===await digest(p)&&
    Object.entries(p).every(([key,value])=>JSON.stringify(row.data[key])===JSON.stringify(value)));
  }
 });
}
