import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
export class MemoryPartitionRepository {
  #partitions=new Map();
  #reads=0;
  async read(id,{partitionId,budget}={}) {
    assertNarrativeId(id);
    if(typeof partitionId!=='string')throw new EasyPlotsError('SCOPE_REQUIRED','Partition required');
    if(budget&&++this.#reads>budget.maxPartitionReads)throw new EasyPlotsError('READ_BUDGET','Partition budget exceeded');
    const value=this.#partitions.get(partitionId)?.get(id);
    return value?clone(value):null;
  }
  async put(record,{expectedRevision}={}) {
    assertNarrativeId(record.id);
    if(!record.partitionId)throw new EasyPlotsError('SCOPE_REQUIRED','Partition required');
    const p=this.#partitions.get(record.partitionId)??new Map();
    const old=p.get(record.id);
    if ((old && old.revision!==expectedRevision)||(!old && expectedRevision!==null&&expectedRevision!==undefined)) throw new EasyPlotsError('REVISION_CONFLICT','Stale storage record');
    const next=clone({...record,revision:(old?.revision??0)+1});
    p.set(record.id,next);this.#partitions.set(record.partitionId,p);return clone(next);
  }
  async query({partitionId,limit=30,budget}={}) {
    if(typeof partitionId!=='string')throw new EasyPlotsError('SCOPE_REQUIRED','Partition required');
    if(!Number.isInteger(limit)||limit<1||limit>100)throw new EasyPlotsError('QUERY_BUDGET','Invalid bounded query limit');
    if(budget&&++this.#reads>budget.maxPartitionReads)throw new EasyPlotsError('READ_BUDGET','Partition budget exceeded');
    return [...(this.#partitions.get(partitionId)?.values()??[])].slice(0,limit).map(clone);
  }
  resetBudget(){this.#reads=0;}
  get instrumentation(){return {partitionCount:this.#partitions.size,readRequests:this.#reads};}
}
export class MemoryOperationJournal {
  #ops=new Map();
  async get(key){const value=this.#ops.get(key);return value?clone(value):null;}
  async createOnce(key,record){if(this.#ops.has(key))return {created:false,record:clone(this.#ops.get(key))}; const state=clone(record);this.#ops.set(key,state);return {created:true,record:clone(state)};}
  async change(key,expectedState,patch){const old=this.#ops.get(key);if(!old||old.state!==expectedState)throw new EasyPlotsError('JOURNAL_CONFLICT','Journal transition conflicts with current state');const next=clone({...old,...patch});this.#ops.set(key,next);return clone(next);}
  async list(){return [...this.#ops.values()].map(clone);}
}
