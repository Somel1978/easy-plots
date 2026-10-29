/** Revision-checked, scope-bound narrative domain records. All writes use an
 * authenticated GM context. No implicit all-world lookup, no client disclosure.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const TYPES=new Set(['faction','npc-agenda','relationship','observer-belief','evidence','investigation','objective','obligation','location','world-fact','timeline','story-hook','arc','review-plan','faction-agenda','npc-schedule','knowledge-disclosure','pressure-clock','vote-decision','continuity-manifest','resource-manifest','scheduled-commitment','arc-resolution','blueprint-revision','blueprint-instance','knowledge-claim','knowledge-receipt','knowledge-correction','milestone-contract','milestone-progress','milestone-completion','vote-ballot','vote-resolution','knowledge-propagation-plan','knowledge-propagation-step','faction-agenda-decision','session-handoff','notification','quest-publication','narrative-forecast']);
TYPES.add('gm-focus');
TYPES.add('chronology-event');TYPES.add('chronology-knowledge');
for(const type of ['arc-archive','arc-archive-page','arc-archive-summary'])TYPES.add(type);
for(const type of ['ingress-policy','critical-signal','signal-source-watch'])TYPES.add(type);
TYPES.add('npc-action-binding');
TYPES.add('temporal-catchup');TYPES.add('temporal-catchup-page');
TYPES.add('board-edit-request');
TYPES.add('knowledge-publication');TYPES.add('native-publication-envelope');
TYPES.add('native-publication-locator');
TYPES.add('notification-group');
for(const type of ['knowledge-dependency','knowledge-review-job','knowledge-review-page'])TYPES.add(type);
TYPES.add('plot-authority');
TYPES.add('gm-authoring-request');
TYPES.add('encounter-closure');
TYPES.add('narrative-entity');TYPES.add('persona');
TYPES.add('graph-appearance');
TYPES.add('roll-adapter-policy');
TYPES.add('native-batch-plan');TYPES.add('native-batch-run');
TYPES.add('resource-requirements');
for(const type of ['location-discovery','location-route','spatial-region','spatial-view'])TYPES.add(type);
const PART=/^[a-z][a-z0-9-]{0,48}$/;
const digest=value=>sha256Hex(JSON.stringify(value));
const OP=/^ep:operation:[a-zA-Z0-9_:-]{6,200}$/;
const EVENT=/^ep:event:[a-zA-Z0-9_-]{8,120}$/;
function receipt(value){
  assertPlainObject(value,'DOMAIN_RECEIPT');
  if(Object.keys(value).some(k=>!['operationId','sourceEventId','payloadDigest'].includes(k))||!OP.test(value.operationId)||!EVENT.test(value.sourceEventId)||!/^[a-f0-9]{64}$/.test(value.payloadDigest??''))fail('DOMAIN_RECEIPT','Invalid effect provenance receipt');
  return clone(value);
}
export async function domainRevisionLocator(type,scope,id,revision){
  assertNarrativeId(id);
  if(!TYPES.has(type)||!PART.test(scope??'')||!Number.isSafeInteger(revision)||revision<1)fail('DOMAIN_HISTORY','A typed scope and positive source revision are required');
  const hash=await sha256Hex(`${type}\0${scope}\0${id}\0${revision}`);
  return {id:`ep:domain-revision:${hash.slice(0,24)}`,partitionId:`domain-history-${hash.slice(0,4)}`};
}
export class NarrativeDomainStore {
  #repository;#gm;#onCommitted=null;
  constructor({repository,gmProvider}={}){
    if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function')fail('DOMAIN_DEPENDENCY','Protected repository and GM provider required');
    this.#repository=repository;this.#gm=gmProvider;
  }
  /** Optional bounded post-commit index hook. Search failure must NEVER roll back
   * an already durable narrative write. Callers can repair by exact record ID. */
  setCommittedIndexer(fn){
    if(fn!==null&&typeof fn!=='function')fail('DOMAIN_DEPENDENCY','Index callback must be a function');
    this.#onCommitted=fn;
  }
  #context(){const ctx=this.#gm();assertLocalGM(ctx);return ctx;}
  #partition(type,scope){
    if(!TYPES.has(type)||typeof scope!=='string'||!PART.test(scope))fail('DOMAIN_SCOPE','Explicit valid domain type and scope required');
    return `domain-${type}-${scope}`;
  }
  async read(type,scope,id){
    assertNarrativeId(id);const gm=this.#context(),partitionId=this.#partition(type,scope);
    const row=await this.#repository.read(id,{partitionId,gm});
    if(row&&(row.kind!==type||row.scope!==scope||row.id!==id||row.partitionId!==partitionId))fail('DOMAIN_CORRUPT','Domain record identity does not match partition');
    if(row&&typeof this.#repository.hasReadyIndex==='function'&&!await this.#repository.hasReadyIndex(id,{partitionId,gm}))fail('INDEX_UNCERTAIN','Record lacks verified index');
    return row?clone(row):null;
  }
  async hasRecordOrIndex(type,scope,id){
    assertNarrativeId(id);const partitionId=this.#partition(type,scope),gm=this.#context();
    if(typeof this.#repository.indexStatus==='function')return (await this.#repository.indexStatus(id,{partitionId,gm}))!==null;
    return Boolean(await this.#repository.read(id,{partitionId,gm}));
  }
  async queryScoped({type,scope='world',cursor='0:0',limit=16}={}){
    const gm=this.#context(),partitionId=this.#partition(type,scope);
    if(!Number.isSafeInteger(limit)||limit<1||limit>24)fail('DOMAIN_BUDGET','Bounded query limit required');
    if(typeof this.#repository.query!=='function')fail('DOMAIN_QUERY_UNAVAILABLE','Bounded repository query required');
    const result=await this.#repository.query({partitionId,cursor,limit,gm});
    const rows=Array.isArray(result)?result:result?.items;
    if(!Array.isArray(rows)||rows.length>limit||(result?.unresolved?.length??0)>0)fail('INDEX_UNCERTAIN','Incomplete or excessive domain index');
    for(const row of rows)if(row.kind!==type||row.scope!==scope||row.partitionId!==partitionId)fail('DOMAIN_CORRUPT','Scoped query returned wrong record');
    return {items:clone(rows),nextCursor:Array.isArray(result)?null:result.nextCursor??null};
  }
  async readRevision(type,scope,id,revision){
    this.#partition(type,scope);const loc=await domainRevisionLocator(type,scope,id,revision),gm=this.#context();
    const current=await this.read(type,scope,id);if(current?.revision===revision)return current;
    const row=await this.#repository.read(loc.id,{partitionId:loc.partitionId,gm});
    if(!row)return null;
    if(row.kind!=='domain-revision'||row.id!==loc.id||row.partitionId!==loc.partitionId||row.snapshot?.id!==id||row.snapshot?.kind!==type||row.snapshot?.scope!==scope||row.snapshot?.revision!==revision||await digest(row.snapshot)!==row.fingerprint)fail('DOMAIN_HISTORY_CORRUPT','Historical record failed identity or integrity verification');
    if(typeof this.#repository.hasReadyIndex==='function'&&!await this.#repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:this.#context()}))fail('INDEX_UNCERTAIN','History index is not verified');
    return clone(row.snapshot);
  }
  async #retain(prior){
    const loc=await domainRevisionLocator(prior.kind,prior.scope,prior.id,prior.revision),fingerprint=await digest(prior);
    const old=await this.#repository.read(loc.id,{partitionId:loc.partitionId,gm:this.#context()});
    if(old){
      if(old.kind!=='domain-revision'||old.id!==loc.id||old.partitionId!==loc.partitionId||old.fingerprint!==fingerprint||await digest(old.snapshot)!==fingerprint)fail('DOMAIN_HISTORY_CONFLICT','Historical revision cannot be overwritten');
    }else await this.#repository.put({...loc,kind:'domain-revision',snapshot:clone(prior),fingerprint},{expectedRevision:null,gm:this.#context()});
    const verified=await this.#repository.read(loc.id,{partitionId:loc.partitionId,gm:this.#context()});
    if(!verified||verified.kind!=='domain-revision'||verified.id!==loc.id||verified.partitionId!==loc.partitionId||verified.fingerprint!==fingerprint||await digest(verified.snapshot)!==fingerprint)fail('DOMAIN_HISTORY_UNCERTAIN','History was not durably verified');
    if(typeof this.#repository.hasReadyIndex==='function'&&!await this.#repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:this.#context()}))fail('INDEX_UNCERTAIN','History index needs reconciliation');
  }
  async retainRevision(type,scope,id,revision){
    const snapshot=await this.readRevision(type,scope,id,revision);
    if(!snapshot)fail('DOMAIN_HISTORY_MISSING','Cannot retain an unavailable canonical revision');
    await this.#retain(snapshot);return {id,revision,retained:true};
  }
  async previewCorrection({type,scope,id,targetRevision,expectedRevision,reason}={}){
    if(!['world-fact','objective','relationship','observer-belief'].includes(type))fail('CORRECTION_TYPE','Only narrative state supports this correction operation');
    if(!Number.isSafeInteger(expectedRevision)||expectedRevision<2||!Number.isSafeInteger(targetRevision)||targetRevision<1||targetRevision>=expectedRevision||typeof reason!=='string'||!reason.trim()||reason.length>500)fail('CORRECTION_CONTRACT','Correction requires current/older revisions and a bounded reason');
    const current=await this.read(type,scope,id);if(current?.revision!==expectedRevision)fail('REVISION_CONFLICT','Canonical record changed since correction review');
    const target=await this.readRevision(type,scope,id,targetRevision);if(!target)fail('CORRECTION_HISTORY_MISSING','Required immutable history is unavailable');
    const immutable=type==='relationship'?['fromId','toId']:type==='observer-belief'?['observerId','claimId']:[];
    for(const field of immutable)if(current.data[field]!==target.data[field])fail('CORRECTION_IDENTITY','A correction cannot retarget identity or observer scope');
    return {type,scope,id,expectedRevision,targetRevision,reason,current:clone(current.data),candidate:clone(target.data),currentSourceEventId:current.sourceEventId,targetSourceEventId:target.sourceEventId,committed:false};
  }
  async restoreRevision(payload,{operationId,sourceEventId}={}){
    if(!OP.test(operationId??'')||!EVENT.test(sourceEventId??''))fail('CORRECTION_PROVENANCE','A journaled corrective operation and distinct source event are required');
    const plan=await this.previewCorrection(payload);
    if([plan.targetSourceEventId,plan.currentSourceEventId].includes(sourceEventId))fail('CORRECTION_PROVENANCE','Correction must append a new event, not reuse the original');
    return this.save({type:plan.type,scope:plan.scope,id:plan.id,data:plan.candidate,expectedRevision:plan.expectedRevision,sourceEventId,
      effectReceipt:{operationId,sourceEventId,payloadDigest:await digest(payload)},
      correctionReceipt:{fromRevision:plan.expectedRevision,targetRevision:plan.targetRevision,targetSourceEventId:plan.targetSourceEventId,reason:plan.reason}});
  }
  async save({type,scope,id,data,expectedRevision=null,sourceEventId,visibility='gm-only',effectReceipt=null,importReceipt=null,correctionReceipt=null}={}){
    const gm=this.#context();assertNarrativeId(id);assertPlainObject(data);
    const partitionId=this.#partition(type,scope);
    if(!['gm-only','authorized-observers'].includes(visibility))fail('DOMAIN_VISIBILITY','Protected domain records require explicit visibility');
    if(typeof sourceEventId!=='string'||!/^ep:/.test(sourceEventId))fail('DOMAIN_PROVENANCE','Authoritative source event reference required');
    if(expectedRevision!==null&&(!Number.isInteger(expectedRevision)||expectedRevision<1))fail('REVISION_CONFLICT','Expected revision must be positive');
    if(new TextEncoder().encode(JSON.stringify(data)).length>24_000)fail('DOMAIN_BUDGET','Domain data exceeds record limit');
    const prior=await this.read(type,scope,id);
    if((prior?.revision??null)!==expectedRevision)fail('REVISION_CONFLICT','Domain record revision changed');
    const record={id,partitionId,kind:type,scope,data:clone(data),sourceEventId,visibility};
    if(effectReceipt!==null)record.effectReceipt=receipt(effectReceipt);
    if(correctionReceipt!==null){
      assertPlainObject(correctionReceipt,'CORRECTION_CONTRACT');
      if(!prior||correctionReceipt.fromRevision!==prior.revision||!Number.isSafeInteger(correctionReceipt.targetRevision)||correctionReceipt.targetRevision<1||correctionReceipt.targetRevision>=prior.revision||!EVENT.test(correctionReceipt.targetSourceEventId??'')||typeof correctionReceipt.reason!=='string'||!correctionReceipt.reason.trim()||correctionReceipt.reason.length>500)fail('CORRECTION_CONTRACT','Invalid corrective provenance');
      record.correctionReceipt=clone(correctionReceipt);
    }
    if(importReceipt!==null){
      assertPlainObject(importReceipt,'DOMAIN_IMPORT');
      if(prior||typeof importReceipt.providerId!=='string'||typeof importReceipt.partitionId!=='string'||importReceipt.partitionId.length>120||!Number.isSafeInteger(importReceipt.revision)||importReceipt.revision<1||!/^[a-f0-9]{64}$/.test(importReceipt.fingerprint??'')||!EVENT.test(importReceipt.reviewEventId??''))fail('DOMAIN_IMPORT','Reviewed import requires a new canonical identity and exact legacy revision');
      assertNarrativeId(importReceipt.id);record.importReceipt=clone(importReceipt);
    }else if(prior?.importReceipt)record.importReceipt=clone(prior.importReceipt);
    // Retain the authoritative preimage before replacement. Interrupted writes
    // may leave a harmless old snapshot; they never erase the source revision.
    if(prior)await this.#retain(prior);
    const saved=await this.#repository.put(record,{expectedRevision,gm});
    const verified=await this.read(type,scope,id);
    if(!verified||verified.revision!==saved.revision||verified.sourceEventId!==sourceEventId)fail('DOMAIN_WRITE_UNCERTAIN','Domain record not durably verified');
    if(this.#onCommitted){
      try{await this.#onCommitted({type,scope,id,revision:verified.revision});}
      catch(error){
        // GM-only diagnostic; no secret content or source payload is logged.
        console.warn('[Easy Plots] Search index requires targeted repair:',error?.code??'INDEX_REPAIR_REQUIRED');
      }
    }
    return verified;
  }
}
