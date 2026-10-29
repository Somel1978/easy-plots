/**
 * Bounded, private reverse-reference ledger. Native documents remain authoritative
 * and are never deleted, rebound or modified by these index operations.
 * A GM-controlled binding resolver is required: reverse edges cannot be created
 * against an unrelated or stale native UUID.
 *
 * Every entry is independently journalable, not a claim that Foundry offers
 * atomic cross-document multi-write transactions.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const SCOPE=/^[a-z][a-z0-9-]{0,45}$/;
const UUID=/^(Actor|Item|JournalEntry)\.[A-Za-z0-9]{16}$/;
const OP=/^ep:operation:[a-zA-Z0-9_:-]{6,200}$/;
const EV=/^ep:event:[a-zA-Z0-9_-]{8,120}$/;
const KEY_FIELDS=['scope','resourceId','dependentId','nativeUuid'];
function validate({scope,resourceId,dependentId,nativeUuid}={}){
  if(!SCOPE.test(scope??''))fail('REF_SCOPE','Stable bounded reference scope required');
  assertNarrativeId(resourceId);assertNarrativeId(dependentId);
  if(!UUID.test(nativeUuid??''))fail('REF_UUID','World Actor, Item or JournalEntry UUID required');
  return {scope,resourceId,dependentId,nativeUuid};
}
export async function reverseRefLocator(spec){
  const p=validate(spec),nativeHash=await sha256Hex(p.nativeUuid),entryHash=await sha256Hex(`${p.scope}\0${p.resourceId}\0${p.dependentId}\0${p.nativeUuid}`);
  return {id:`ep:reverse-ref:${entryHash.slice(0,24)}`,
    partitionId:`native-refs-${p.scope}-${nativeHash.slice(0,16)}`};
}
export class NativeReverseReferenceLedger{
  #repo;#gmProvider;#resolveBinding;
  constructor({repository,gmProvider,resolveBinding}={}){
    if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||
       typeof repository?.query!=='function'||typeof gmProvider!=='function'||typeof resolveBinding!=='function')
      fail('REF_DEPENDENCY','Bounded repository, GM provider and verified binding resolver required');
    this.#repo=repository;this.#gmProvider=gmProvider;this.#resolveBinding=resolveBinding;
  }
  #gm(){const gm=this.#gmProvider();assertLocalGM(gm);return gm;}
  async #location(spec){return reverseRefLocator(spec);}
  async get(spec){
    const p=validate(spec),loc=await this.#location(p),gm=this.#gm();
    const row=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});
    if(row){
      if(row.kind!=='reverse-native-ref'||row.id!==loc.id||row.partitionId!==loc.partitionId||
         KEY_FIELDS.some(k=>row[k]!==p[k]))fail('REF_CORRUPT','Protected reverse-reference identity mismatch');
      if(typeof this.#repo.hasReadyIndex==='function'&&
         !await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm}))
        fail('INDEX_UNCERTAIN','Reverse-reference index is incomplete');
    }
    return row;
  }
  async #checkBinding(p){
    const row=await this.#resolveBinding({scope:p.scope,resourceId:p.resourceId});
    if(row?.status!=='bound'||`${row.documentKind}.${row.nativeId}`!==p.nativeUuid)
      fail('REF_BINDING_STALE','Native UUID does not match the current protected binding');
    return row;
  }
  async link(spec,{operationId,sourceEventId}={}){
    const p=validate(spec),gm=this.#gm();
    if(!OP.test(operationId??'')||!EV.test(sourceEventId??''))fail('REF_PROVENANCE','Authorized operation and source event required');
    await this.#checkBinding(p);
    const old=await this.get(p);
    if(old){
      if(old.status==='active'&&old.lastOperationId===operationId&&old.lastSourceEventId===sourceEventId)
        return {recordId:old.id,alreadyApplied:true};
      fail('REF_EXISTS','Reference identity already has a historical record; explicit revision required');
    }
    const loc=await this.#location(p);
    const row=await this.#repo.put({...loc,kind:'reverse-native-ref',...p,
      status:'active',lastOperationId:operationId,lastSourceEventId:sourceEventId,visibility:'gm-only'},
      {expectedRevision:null,gm});
    const observed=await this.get(p);
    if(observed?.revision!==row.revision||observed.status!=='active')fail('REF_WRITE_UNCERTAIN','Reverse-reference write lacks read-back verification');
    return {recordId:loc.id,revision:row.revision};
  }
  async retire(spec,{expectedRevision,operationId,sourceEventId}={}){
    const p=validate(spec),gm=this.#gm();
    if(!OP.test(operationId??'')||!EV.test(sourceEventId??''))fail('REF_PROVENANCE','Authorized operation and source event required');
    const old=await this.get(p);
    if(old?.status==='retired'&&old.lastOperationId===operationId&&old.lastSourceEventId===sourceEventId)
      return {...old,alreadyApplied:true};
    if(!old||old.status!=='active'||old.revision!==expectedRevision)
      fail('REF_REVISION_CONFLICT','Active reference and current revision required');
    const row=await this.#repo.put({...old,status:'retired',lastOperationId:operationId,lastSourceEventId:sourceEventId},
      {expectedRevision:old.revision,gm});
    const confirmed=await this.get(p);
    if(confirmed?.status!=='retired'||confirmed.revision!==row.revision)fail('REF_WRITE_UNCERTAIN','Retired reference lacks verification');
    return confirmed;
  }
  /** One native UUID's index partition only; never enumerates the campaign. */
  async listForNative({scope,nativeUuid,cursor='0:0',limit=16}={}){
    if(!SCOPE.test(scope??'')||!UUID.test(nativeUuid??''))fail('REF_UUID','Valid scoped native UUID required');
    if(!Number.isInteger(limit)||limit<1||limit>32)fail('REF_BUDGET','Bounded reference page required');
    const nativeHash=await sha256Hex(nativeUuid);
    const partitionId=`native-refs-${scope}-${nativeHash.slice(0,16)}`;
    const response=await this.#repo.query({partitionId,cursor,limit,gm:this.#gm()});
    // The in-memory test repository uses a simple bounded array; the native
    // adapter returns cursor metadata and unresolved index entries.
    const result=Array.isArray(response)?{items:response,unresolved:[],nextCursor:null}:response;
    const items=[];
    for(const row of result.items){
      if(row.kind!=='reverse-native-ref'||row.nativeUuid!==nativeUuid||row.scope!==scope)
        fail('REF_CORRUPT','Reverse-reference partition contains incompatible record');
      items.push({resourceId:row.resourceId,dependentId:row.dependentId,
        nativeUuid:row.nativeUuid,status:row.status,revision:row.revision});
    }
    return {...result,items};
  }
  /** Classification only; repair/rebind are separate GM-authorized operations. */
  async auditNative({scope,nativeUuid,cursor='0:0',limit=16}={}){
    const page=await this.listForNative({scope,nativeUuid,cursor,limit}),items=[];
    for(const row of page.items){
      let current=null;
      try{current=await this.#resolveBinding({scope,resourceId:row.resourceId});}catch{}
      const assessment=row.status==='retired'?'historical':!current||current.status==='detached'?'orphaned':
        `${current.documentKind}.${current.nativeId}`!==nativeUuid?'drift':'current';
      items.push({...row,assessment});
    }
    return {...page,items};
  }
}
