/**
 * Durable private event inbox. No journal entry can be acknowledged as accepted
 * until the protected repository's index and stored content have been verified.
 * On interrupted processing, recovery is explicit; the event is never silently
 * replayed and effects are never automatically retried.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {assertEventType} from './active-subscriptions.mjs';
import {validateEventVersion,canonicalEventDocument,validateCanonicalEventDocument,canonicalOrigin} from '../contracts/canonical-event.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const allowed=new Set(['prepared','evaluating','review-required','evaluated','uncertain','closed']);
const next={prepared:new Set(['evaluating','uncertain']),evaluating:new Set(['review-required','evaluated','uncertain']),
  'review-required':new Set(['closed','uncertain']),evaluated:new Set([]),uncertain:new Set(['closed']),closed:new Set([])};
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const maxBytes=12000;
function safeEvent(event){
  if(!isObj(event)||!/^ep:event:[A-Za-z0-9_-]{8,120}$/.test(event.id??''))fail('INVALID_EVENT','Canonical event ID required');
  validateEventVersion(event);
  assertEventType(event.eventType);
  if(!isObj(event.source)||typeof event.source.kind!=='string'||!['native-hook','gm-approved-intent','test-fixture'].includes(event.source.kind))fail('INVALID_EVENT_SOURCE','Expected declared canonical origin type');
  if(event.source.kind==='native-hook'){
    if(typeof event.source.documentUuid!=='string'||event.source.documentUuid.length>220||typeof event.source.hook!=='string'||event.source.hook.length>80)fail('INVALID_EVENT_SOURCE','Native event must cite a bounded source document and hook');
  }
  if(!isObj(event.payload))fail('INVALID_EVENT','Event payload must be a JSON object');
  let value;try{value=JSON.stringify(event);}catch{fail('INVALID_EVENT','Event cannot be serialized');}
  if(typeof value!=='string'||new TextEncoder().encode(value).length>maxBytes)fail('EVENT_BUDGET','Canonical event exceeds bounded payload size');
  return clone(event);
}
export {safeEvent as validateRuntimeEvent};
export async function eventLocator(eventId,scope='main'){
  assertNarrativeId(eventId);
  if(!eventId.startsWith('ep:event:'))fail('INVALID_EVENT','Canonical event ID required');
  if(typeof scope!=='string'||!/^[a-z][a-z0-9-]{0,45}$/.test(scope))fail('INVALID_SCOPE','Invalid narrative scope');
  const hash=await sha256Hex(`ep:event-ledger:v1:${scope}:${eventId}`);
  return Object.freeze({id:`ep:ledger:${hash.slice(0,24)}`,partitionId:`event-inbox:${scope}:${hash.slice(0,2)}`});
}
export class DurableEventLedger {
  #repo;#gm;#scope;#now;#worldTime;
  constructor({repository,gmProvider,scope='main',now=()=>Date.now()/1000,worldTimeProvider=null}={}){
    if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function')fail('INVALID_REPOSITORY','Durable event ledger needs a revisioned repository and GM context');
    if(typeof now!=='function'||worldTimeProvider!==null&&typeof worldTimeProvider!=='function')fail('INVALID_RUNTIME','Event acceptance clock required');
    this.#repo=repository;this.#gm=gmProvider;this.#scope=scope;this.#now=now;this.#worldTime=worldTimeProvider;
  }
  #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
  async hasRecordOrIndex(id){
    const gm=this.#context(),loc=await eventLocator(id,this.#scope);
    if(typeof this.#repo.indexStatus==='function')return (await this.#repo.indexStatus(loc.id,{partitionId:loc.partitionId,gm}))!==null;
    return Boolean(await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm}));
  }
  async get(id){
    const gm=this.#context(),loc=await eventLocator(id,this.#scope);
    const row=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});
    if(!row)return null;
    if(row.kind!=='narrative-event'||row.sourceEventId!==id||row.id!==loc.id||!allowed.has(row.state))fail('EVENT_CORRUPT','Event ledger record is invalid');
    if(row.event?.id!==id||await sha256Hex(JSON.stringify(safeEvent(row.event)))!==row.fingerprint)fail('EVENT_CORRUPT','Canonical event content does not match its durable fingerprint');
    if(row.event.eventVersion!==undefined){
      const canonical=validateCanonicalEventDocument(row.canonical);
      if(await sha256Hex(JSON.stringify(canonical))!==row.canonicalFingerprint||canonical.id!==id||canonical.partitionId!==loc.partitionId||canonical.worldId!==gm.worldId||canonical.eventType!==row.event.eventType||canonical.correlationId!==row.event.correlationId||JSON.stringify(canonical.causalParentIds)!==JSON.stringify(row.event.causalParentIds)||JSON.stringify(canonical.payload)!==JSON.stringify(row.event.payload)||JSON.stringify(canonical.origin)!==JSON.stringify(canonicalOrigin(row.event.source)))fail('EVENT_CANONICAL_CORRUPT','Canonical document and runtime projection differ');
    }
    if(typeof this.#repo.hasReadyIndex==='function'&&!(await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm})))fail('INDEX_UNCERTAIN','Event ledger index is pending reconciliation');
    return row;
  }
  async accept(event){
    const gm=this.#context(),safe=safeEvent(event),loc=await eventLocator(safe.id,this.#scope);
    const fingerprint=await sha256Hex(JSON.stringify(safe));
    const previous=await this.get(safe.id);
    if(previous){if(previous.fingerprint!==fingerprint)fail('EVENT_REUSE_CONFLICT','A canonical event ID cannot be reused with different content');return {created:false,record:previous};}
    const acceptedAt=this.#now();if(!Number.isFinite(acceptedAt)||acceptedAt<0||acceptedAt>1e13)fail('INVALID_EVENT_TIME','A recorded acceptance time is required');
    let versioned={};
    if(safe.eventVersion!==undefined){
      for(const parentId of safe.causalParentIds)if(!await this.get(parentId))fail('EVENT_CAUSAL_PARENT_MISSING','Causal parent must already exist in this protected event ledger');
      const canonical=canonicalEventDocument(safe,{partitionId:loc.partitionId,worldId:gm.worldId,authorId:gm.userId,acceptedAt,worldTime:this.#worldTime?.()});
      versioned={canonical,canonicalFingerprint:await sha256Hex(JSON.stringify(canonical))};
    }
    try {
      await this.#repo.put({...loc,kind:'narrative-event',sourceEventId:safe.id,fingerprint,event:safe,acceptedAt,...versioned,state:'prepared',evaluations:[],proposals:[]},
        {expectedRevision:null,gm});
    } catch(error){const current=await this.get(safe.id);if(!current)throw error;
      if(current.fingerprint!==fingerprint)fail('EVENT_REUSE_CONFLICT','Event identity collision');
      return {created:false,record:current};
    }
    const record=await this.get(safe.id);
    if(!record||record.fingerprint!==fingerprint)fail('EVENT_NOT_DURABLE','Canonical event was not read back from durable storage');
    return {created:true,record};
  }
  async transition(eventId,expected,state,{evaluations,proposals,reason}={}){
    if(!allowed.has(expected)||!next[expected]?.has(state))fail('INVALID_EVENT_TRANSITION','Unsupported event transition');
    const gm=this.#context(),loc=await eventLocator(eventId,this.#scope);
    const old=await this.get(eventId);
    if(!old||old.state!==expected)fail('EVENT_STATE_CONFLICT','Event ledger lifecycle changed');
    if(evaluations!==undefined&&(!Array.isArray(evaluations)||evaluations.length>128))fail('EVENT_BUDGET','Evaluation list exceeds supported bound');
    if(proposals!==undefined&&(!Array.isArray(proposals)||proposals.length>128))fail('EVENT_BUDGET','Effect proposals exceed supported bound');
    const row={...old,state,...(evaluations===undefined?{}:{evaluations:clone(evaluations)}),
      ...(proposals===undefined?{}:{proposals:clone(proposals)}),...(reason===undefined?{}:{reason:String(reason).slice(0,96)})};
    await this.#repo.put({...loc,...row},{expectedRevision:old.revision,gm});
    const confirmed=await this.get(eventId);
    if(confirmed?.state!==state)fail('EVENT_WRITE_UNCERTAIN','Event transition not verified');
    return confirmed;
  }
  async listShard(prefix,{cursor='0:0',limit=16}={}){
    const gm=this.#context();
    if(typeof prefix!=='string'||!/^[0-9a-f]{2}$/.test(prefix))fail('INVALID_SCOPE','A specific event shard is required');
    if(!Number.isInteger(limit)||limit<1||limit>16)fail('QUERY_BUDGET','Bounded event shard query required');
    const result=await this.#repo.query({partitionId:`event-inbox:${this.#scope}:${prefix}`,cursor,limit,gm});
    if(Array.isArray(result))return {items:result.filter(x=>x.kind==='narrative-event'),nextCursor:null,unresolved:[]};
    if(result.unresolved?.length)fail('INDEX_UNCERTAIN','Event shard requires recovery before review');
    return {...result,items:result.items.filter(x=>x.kind==='narrative-event')};
  }
}
