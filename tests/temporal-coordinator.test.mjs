import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {NativeTemporalIndex} from '../src/storage/native-temporal-index.mjs';
import {GMTemporalCoordinator} from '../src/orchestration/temporal-coordinator.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const S='ep:schedule:captain_001',owner='ep:npc:captain_001';
const ev=id=>`ep:event:${id}`;
function harness({badIndex=false}={}){
 const repository=new MemoryPartitionRepository(),gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true}},'world');
 const domains=new NarrativeDomainStore({repository,gmProvider});
 const index=new NativeTemporalIndex({repository,gmProvider});
 const coordinator=new GMTemporalCoordinator({domains,index:badIndex?{stage:async()=>{throw Error('disk');},due:index.due.bind(index)}:index});
 return {coordinator,domains,index};
}
const spec={id:S,sourceEventId:ev('schedule_001'),ownerId:owner,kind:'npc-action',dueAt:58};
test('authoritative due scheduling supports bounded indexing and GM review',async()=>{
 const {coordinator}=harness();
 const result=await coordinator.schedule(spec);assert.equal(result.commitment.revision,1);
 const r=await coordinator.due({from:30,to:70});assert.equal(r.candidates.length,1);
 assert.equal(r.candidates[0].status,'requires-gm-evaluation');assert.equal(r.effectsExecuted,0);
});
test('resolved time commitment disappears from due window without mutating history',async()=>{
 const {coordinator}=harness();await coordinator.schedule(spec);
 const done=await coordinator.recordOutcome({id:S,expectedRevision:1,resolutionEventId:ev('review_001'),outcome:'resolved'});
 assert.equal(done.data.status,'resolved');assert.equal(done.sourceEventId,ev('review_001'));
 const r=await coordinator.due({from:30,to:70});assert.equal(r.candidates.length,0);assert.equal(r.staleCandidates,1);
 await assert.rejects(coordinator.recordOutcome({id:S,expectedRevision:2,resolutionEventId:ev('review_002'),outcome:'resolved'}),{code:'SCHEDULE_STATE'});
});
test('moving commitment leaves an inert old index candidate and creates a new due entry',async()=>{
 const {coordinator}=harness();await coordinator.schedule(spec);
 await coordinator.schedule({...spec,dueAt:96,expectedRevision:1,sourceEventId:ev('reschedule_001')});
 assert.equal((await coordinator.due({from:30,to:60})).candidates.length,0);
 const result=await coordinator.due({from:60,to:110});assert.equal(result.candidates[0].dueAt,96);
});
test('index write interruption reports uncertainty, keeps canonical record for repair',async()=>{
 const {coordinator,domains}=harness({badIndex:true});
 await assert.rejects(coordinator.schedule(spec),{code:'SCHEDULE_INDEX_UNCERTAIN'});
 const row=await domains.read('scheduled-commitment','world',S);assert.equal(row.data.status,'pending');
});
test('recover after interruption by staging only an existing canonical commitment',async()=>{
 const base=harness();const stored=await base.domains.save({type:'scheduled-commitment',scope:'world',id:S,
  sourceEventId:ev('schedule_001'),data:{ownerId:owner,kind:'npc-action',dueAt:58,status:'pending'}});
 assert.equal(stored.revision,1);
 const recovered=await base.coordinator.repairIndex({id:S});assert.equal(recovered.staged,true);
 assert.equal((await base.coordinator.due({from:30,to:60})).candidates.length,1);
});
