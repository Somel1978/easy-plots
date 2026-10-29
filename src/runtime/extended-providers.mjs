/** Exact typed narrative record operations, never arbitrary storage patches.
 * The caller cannot select a repository partition, storage id or record kind.
 * Canonical world truth and observer beliefs are deliberately distinct records.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {NarrativeDomainStore} from '../domains/domain-store.mjs';
import {canonicalDomainEffect} from './canonical-domain-effects.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const MAX_DATA=4096;
const visibility=new Set(['gm-only','authorized-observers','published']);
const STATES=new Set(['pending','available','active','completed','failed','abandoned','suspended','concluded']);
const SLUG=/^[a-z][a-z0-9-]{0,47}$/;
const mustId=(p,k)=>assertNarrativeId(p[k]);
const required=(p,k)=>{if(typeof p[k]!=='string'||!p[k].trim()||p[k].length>160)fail('DOMAIN_PAYLOAD',`${k} must be a bounded string`);};
const arrayOfIds=(p,k,max=32)=>{if(!Array.isArray(p[k])||p[k].length>max)fail('DOMAIN_PAYLOAD',`${k} must be a bounded array`);p[k].forEach(assertNarrativeId);};
const expected=(p)=>{if(p.expectedRevision!==null&&p.expectedRevision!==undefined&&(!Number.isInteger(p.expectedRevision)||p.expectedRevision<1))fail('REVISION_CONFLICT','Expected revision must be positive or null');};
const dataSize=p=>{if(new TextEncoder().encode(JSON.stringify(p)).length>MAX_DATA)fail('DOMAIN_BUDGET','Effect record exceeds payload budget');};
function check(type,p){
  assertPlainObject(p,'DOMAIN_PAYLOAD');
  if(typeof p.scope!=='string'||!SLUG.test(p.scope))fail('DOMAIN_SCOPE','A bounded explicit narrative scope is required');
  expected(p);
  if(p.visibility!==undefined&&!visibility.has(p.visibility))fail('DOMAIN_VISIBILITY','Invalid disclosure classification');
  switch(type){
    case 'world-fact':
      mustId(p,'factId');required(p,'value');
      if(!['asserted','retracted','contested'].includes(p.status))fail('DOMAIN_PAYLOAD','World fact needs explicit epistemic status');
      break;
    case 'relationship':
      mustId(p,'relationshipId');mustId(p,'fromId');mustId(p,'toId');
      if(p.fromId===p.toId)fail('DOMAIN_PAYLOAD','Relationships require distinct directional endpoints');
      required(p,'relation');if(!['formed','active','ended','disputed'].includes(p.status))fail('DOMAIN_PAYLOAD','Relationship status invalid');
      break;
    case 'belief':
      mustId(p,'beliefId');mustId(p,'observerId');mustId(p,'claimId');
      if(!['believed','disbelieved','uncertain','retracted'].includes(p.stance))fail('DOMAIN_PAYLOAD','Observer stance invalid');
      arrayOfIds(p,'knownEvidenceIds');
      if(p.visibility==='published')fail('DOMAIN_VISIBILITY','Observer beliefs cannot become public merely by storage flag');
      break;
    case 'objective':
      mustId(p,'objectiveId');if(!STATES.has(p.state))fail('DOMAIN_PAYLOAD','Objective state invalid');
      if(p.previousState!==null&&!STATES.has(p.previousState))fail('DOMAIN_PAYLOAD','Explicit previous state required');
      if(p.state===p.previousState)fail('DOMAIN_PAYLOAD','Objective transition must change state');
      break;
    case 'disclosure':
      mustId(p,'disclosureId');mustId(p,'claimId');mustId(p,'sourceId');
      arrayOfIds(p,'recipientIds');
      if(!p.recipientIds.length)fail('DOMAIN_PAYLOAD','Explicit recipients required');
      if(p.visibility==='published')fail('DOMAIN_VISIBILITY','Disclosure event recipient list is protected');
      break;
    case 'arc-resolution':
      mustId(p,'arcId');mustId(p,'resolutionId');required(p,'endingId');
      if(!['concluded','failed','abandoned'].includes(p.outcome))fail('DOMAIN_PAYLOAD','Arc resolution status invalid');
      arrayOfIds(p,'openThreadIds');
      if(p.visibility==='published')fail('DOMAIN_VISIBILITY','Arc resolution contract is GM-only');
      break;
    case 'story-hook':
      mustId(p,'hookId');mustId(p,'sourceArcId');
      if(!['dormant','proposed','activated','retired'].includes(p.status))fail('DOMAIN_PAYLOAD','Story hook state invalid');
      if(p.status==='activated'&&!p.activationEventId)fail('DOMAIN_PAYLOAD','Story hook activation requires attributed event');
      if(p.activationEventId)assertNarrativeId(p.activationEventId);
      break;
    case 'scheduled-action':
      mustId(p,'scheduleId');mustId(p,'ownerId');required(p,'actionId');
      if(!Number.isFinite(p.dueWorldTime)||p.dueWorldTime<0)fail('DOMAIN_PAYLOAD','Finite due world-time required');
      if(!['pending','due','review','resolved','cancelled'].includes(p.status))fail('DOMAIN_PAYLOAD','Schedule status invalid');
      break;
    default:fail('DOMAIN_TYPE','Unknown typed effect category');
  }
  dataSize(p);
  return clone(p);
}
const definitions=Object.freeze([
  {type:'world-fact',id:'narrative.record-world-fact',fields:['factId'],immutable:false,canonical:{type:'world-fact',field:'factId'}},
  {type:'relationship',id:'narrative.set-relationship',fields:['relationshipId'],immutable:false,canonical:{type:'relationship',field:'relationshipId'}},
  {type:'belief',id:'narrative.record-observer-belief',fields:['observerId','beliefId'],immutable:false,canonical:{type:'observer-belief',field:'beliefId'}},
  {type:'objective',id:'narrative.transition-objective',fields:['objectiveId'],immutable:false,canonical:{type:'objective',field:'objectiveId'}},
  {type:'disclosure',id:'narrative.record-disclosure',fields:['disclosureId'],immutable:true},
  {type:'arc-resolution',id:'narrative.finalize-arc',fields:['arcId','resolutionId'],immutable:true},
  {type:'story-hook',id:'narrative.transition-story-hook',fields:['hookId'],immutable:false},
  {type:'scheduled-action',id:'narrative.transition-scheduled-action',fields:['scheduleId'],immutable:false}
]);
const sourceId=/^ep:event:[a-zA-Z0-9_-]{8,120}$/;
const operationId=/^ep:operation:[a-zA-Z0-9_:-]{6,200}$/;
export function createExtendedDomainProviders({repository,gmProvider,domains=new NarrativeDomainStore({repository,gmProvider})}={}){
  if(!repository?.read||!repository?.put||typeof gmProvider!=='function')fail('INVALID_PROVIDER','GM-scoped revisioned repository required');
  const gm=()=>{const actor=gmProvider();assertLocalGM(actor);return actor;};
  return definitions.map(def=>{
    const validate=payload=>check(def.type,payload);
    const locator=async p=>{
      const identity=def.fields.map(k=>p[k]).join('|');
      const digest=await sha256Hex(`${def.type}|${p.scope}|${identity}`);
      return {id:`ep:${def.type}:${digest.slice(0,24)}`,partitionId:`effect-${def.type}-${p.scope}-${digest.slice(0,2)}`};
    };
    if(def.canonical)return canonicalDomainEffect({definition:def,validate,legacyLocator:locator,repository,domains,gmProvider});
    const get=async payload=>{
      const p=validate(payload),loc=await locator(p),row=await repository.read(loc.id,{partitionId:loc.partitionId,gm:gm()});
      if(row&&(row.id!==loc.id||row.partitionId!==loc.partitionId||row.kind!==`domain-effect-${def.type}`||row.scope!==p.scope))fail('DOMAIN_CORRUPT','Stored narrative identity is inconsistent');
      if(row&&typeof repository.hasReadyIndex==='function'&&!await repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:gm()}))fail('INDEX_UNCERTAIN','Domain index not verified');
      return row;
    };
    return Object.freeze({id:def.id,version:'1.0.0',validate,get,
      async apply(payload,ctx){
        const p=validate(payload);gm();
        if(!operationId.test(ctx?.operationId)||!sourceId.test(ctx?.sourceEventId))fail('EFFECT_PROVENANCE','Attributable journal operation and source event required');
        const old=await get(p),loc=await locator(p);
        if(old?.lastOperationId===ctx.operationId){
          if(JSON.stringify(old.data)!==JSON.stringify(p))fail('OPERATION_CONFLICT','Operation identity reused with a different payload');
          return {recordId:old.id,alreadyApplied:true};
        }
        if(def.immutable&&old)fail('IMMUTABLE_RECORD','Historical event cannot be silently overwritten');
        if((old?.revision??null)!==(p.expectedRevision??null))fail('REVISION_CONFLICT','Effect targets a stale revision');
        if(def.type==='objective'&&((old?.data.state??null)!==p.previousState))fail('STATE_CONFLICT','Objective from-state does not match the authoritative record');
        if(def.type==='story-hook'&&old?.data.status==='retired'&&p.status==='activated')fail('STORY_HOOK_REVIEW','Retired hook needs explicit reauthoring');
        if(def.type==='scheduled-action'&&old?.data.status==='resolved'&&p.status==='pending')fail('TEMPORAL_REVIEW','Resolved schedule cannot silently reset');
        if(def.type==='belief'&&old&&(old.data.observerId!==p.observerId||old.data.claimId!==p.claimId))fail('BELIEF_IDENTITY','Belief reference cannot change observer or claim');
        const saved=await repository.put({...loc,scope:p.scope,kind:`domain-effect-${def.type}`,data:p,visibility:p.visibility??'gm-only',
          lastOperationId:ctx.operationId,lastSourceEventId:ctx.sourceEventId}, {expectedRevision:p.expectedRevision??null,gm:gm()});
        return {recordId:saved.id,revision:saved.revision};
      },
      async verify(payload,ctx){const p=validate(payload),old=await get(p);
        return Boolean(old&&old.lastOperationId===ctx?.operationId&&old.lastSourceEventId===ctx?.sourceEventId&&JSON.stringify(old.data)===JSON.stringify(p));}
    });
  });
}
export const EXTENDED_DOMAIN_PROVIDER_IDS=Object.freeze(definitions.map(d=>d.id));

/** Pure typed preflight, independent of persistence or native providers. */
export function validateExtendedDomainPayload(providerId,payload){
  const def=definitions.find(d=>d.id===providerId);
  if(!def)fail('MISSING_CAPABILITY','Unknown extended narrative provider');
  return check(def.type,payload);
}
