/** Durable GM-only request queue using the guarded native record repository. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {clone} from '../contracts/record.mjs';
import {opaqueFoundryId} from './native-pack.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const transitions={
  pending:['approved','rejected'],
  approved:['processing','rejected'],
  processing:['resolved','uncertain'],
  uncertain:['resolved','rejected'],
  rejected:[],resolved:[]
};
export class NativeIntentQueue {
  #repo;#gm;#authorize;#checkOpportunity;
  constructor({repository,gmContext,actorAuthorizer,checkOpportunity}){
    this.#repo=repository;this.#gm=gmContext;
    this.#authorize=actorAuthorizer;this.#checkOpportunity=checkOpportunity;
  }
  async #location(key){
    if(typeof key!=='string'||key.length<8||key.length>260)fail('INVALID_INTENT_KEY','User and request key required');
    const hash=await opaqueFoundryId(`intent:${key}`);
    return {id:`ep:intent:${hash}`,partitionId:`intents:${hash.slice(0,2)}`};
  }
  async get(key){const loc=await this.#location(key);const row=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm:this.#gm});
    if(row && row.intentKey!==key)fail('INTENT_HASH_COLLISION','Intent key mismatch');return row;
  }
  /** Persist and read back before the transport sends its pending receipt. */
  async enqueueOnce(key,{intent,verifiedUserId}) {
    if(key!==`${verifiedUserId}:${intent?.requestId}`)fail('INTENT_KEY_MISMATCH','Server-attested identity required');
    if(typeof this.#authorize!=='function'||await this.#authorize(verifiedUserId,intent.actorId)!==true)
      fail('DENIED','Actor permission no longer valid');
    if(typeof this.#checkOpportunity!=='function'||await this.#checkOpportunity(verifiedUserId,intent.opportunityId)!==true)
      fail('DENIED','Opportunity is not currently available to requester');
    const loc=await this.#location(key);
    const old=await this.get(key);
    if(old){
      if(JSON.stringify(old.intent)!==JSON.stringify(intent))fail('INTENT_REUSE_CONFLICT','Request ID reused with different payload');
      return {durable:true,created:false,state:old.state};
    }
    const row={...loc,kind:'intent',intentKey:key,verifiedUserId,intent:clone(intent),state:'pending',
      approvedBy:null,executionId:null};
    try{await this.#repo.put(row,{expectedRevision:null,gm:this.#gm});}
    catch(error){
      // Same-client concurrent submissions can race, never assume a failed
      // create implies absence; inspect and reconcile the durable record.
      const present=await this.get(key);
      if(!present||JSON.stringify(present.intent)!==JSON.stringify(intent))throw error;
    }
    const confirmed=await this.get(key);
    if(!confirmed || !(await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:this.#gm})) || confirmed.intentKey!==key)fail('INTENT_NOT_DURABLE','Request persistence could not be verified');
    return {durable:true,created:!old,state:confirmed.state};
  }
  async transition(key,expected,next,{gmUserId,approval=false,executionId=null}={}){
    if(!(transitions[expected]??[]).includes(next))fail('INTENT_TRANSITION','Invalid lifecycle transition');
    const row=await this.get(key);
    if(!row || row.state!==expected)fail('INTENT_CONFLICT','Current intent state differs');
    if(next==='approved' && (approval!==true||gmUserId!==this.#gm.userId))
      fail('APPROVAL_REQUIRED','Explicit GM approval required');
    if(next==='processing'){
      if(typeof this.#authorize!=='function'||await this.#authorize(row.verifiedUserId,row.intent.actorId)!==true)
        fail('DENIED','Actor authorization revoked');
      if(typeof this.#checkOpportunity!=='function'||await this.#checkOpportunity(row.verifiedUserId,row.intent.opportunityId)!==true)
        fail('DENIED','Narrative opportunity is no longer valid');
      if(!executionId)fail('EXECUTION_ID_REQUIRED','Causal execution identity required');
    }
    const updated={...row,state:next,
      approvedBy:next==='approved'?gmUserId:row.approvedBy,
      executionId:next==='processing'?executionId:row.executionId};
    return this.#repo.put(updated,{expectedRevision:row.revision,gm:this.#gm});
  }
}

/** Same operation journal semantics as the memory test provider. */
export class NativeEffectJournal {
  #repo;#gm;
  constructor({repository,gmContext}){this.#repo=repository;this.#gm=gmContext;}
  async #loc(key){
    const hash=await opaqueFoundryId(`operation:${key}`);
    return {id:`ep:operation:${hash}`,partitionId:`operations:${hash.slice(0,2)}`};
  }
  async get(key){const loc=await this.#loc(key);const row=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm:this.#gm});
    if(row?.operationKey!==key) {if(row)fail('OPERATION_KEY_COLLISION','Operation journal key mismatch');}
    if(row&&typeof this.#repo.hasReadyIndex==='function'&&!await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:this.#gm}))fail('JOURNAL_NOT_DURABLE','Operation journal index is not verified');
    return row;
  }
  /** A prepared native index also proves that journal creation began, even
   * when its payload is not available. Used only for explicit approval transfer. */
  async hasRecordOrIndex(key){if(await this.get(key))return true;if(typeof this.#repo.indexStatus!=='function')return false;const loc=await this.#loc(key);return await this.#repo.indexStatus(loc.id,{partitionId:loc.partitionId,gm:this.#gm})!==null;}
  async createOnce(key,record){
    const old=await this.get(key);
    if(old){const loc=await this.#loc(key);if(!await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:this.#gm}))fail('JOURNAL_NOT_DURABLE','Operation has an incomplete index');return {created:false,record:old};}
    const loc=await this.#loc(key);
    try{await this.#repo.put({...loc,kind:'operation',operationKey:key,...clone(record)},
      {expectedRevision:null,gm:this.#gm});}
    catch(error){
      const found=await this.get(key);
      if(!found)throw error;
      return {created:false,record:found};
    }
    const saved=await this.get(key);
    if(!saved || !await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:this.#gm}))fail('JOURNAL_NOT_DURABLE','Operation journal was not durably recorded');
    return {created:true,record:saved};
  }
  async change(key,expectedState,patch){
    const old=await this.get(key);
    if(!old || old.state!==expectedState)fail('JOURNAL_CONFLICT','Journal state transition conflict');
    const next=await this.#repo.put({...old,...clone(patch),operationKey:key},
      {expectedRevision:old.revision,gm:this.#gm});
    return next;
  }
  /** No unbounded global list. Requires a known index partition. */
  async listPartition({partitionId,cursor,limit=16}={}){
    if(typeof partitionId!=='string'||!partitionId.startsWith('operations:'))fail('SCOPE_REQUIRED','Known operation shard required');
    return this.#repo.query({partitionId,cursor,limit,gm:this.#gm});
  }
}
