import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeTemporalIndex} from '../src/storage/native-temporal-index.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const id=x=>`ep:schedule:${x}`;
const eid=x=>`ep:event:${x}`;
function setup({maxBucketsPerWindow=10}={}){
 const gmProvider=()=>createLocalGMContext({user:{id:'GM_001',isGM:true}},'world');
 const repo=new MemoryPartitionRepository();const index=new NativeTemporalIndex({repository:repo,gmProvider,maxBucketsPerWindow});
 const canonical=new Map();
 const stage=async({id:key,dueAt,sourceRevision=1,kind='npc-action',status='pending'})=>{
  const row={id:key,dueAt,sourceRevision,kind,sourceEventId:eid(`source_${sourceRevision}_${key.split(':').at(-1)}`),status};
  canonical.set(key,row);await index.stage(row);return row;
 };
 const due=(from,to)=>index.due({from,to,resolveCurrent:async key=>canonical.get(key)});
 return {index,stage,due,canonical,gmProvider,repo};
}
test('due index loads only selected bucket windows and returns sorted GM-review candidates',async()=>{
 const {stage,due}=setup();
 await stage({id:id('npc_1'),dueAt:15});await stage({id:id('faction_2'),dueAt:40,kind:'faction-action'});
 await stage({id:id('deadline_3'),dueAt:74,kind:'deadline'});
 const r=await due(10,55);
 assert.deepEqual(r.candidates.map(x=>x.id),[id('npc_1'),id('faction_2')]);
 assert.equal(r.scannedBuckets,2);assert.equal(r.effectsExecuted,0);assert.equal(r.outcomesInvented,0);
});
test('stale entries from rescheduling or completion never become due actions',async()=>{
 const {stage,due,canonical}=setup();
 await stage({id:id('npc_1'),dueAt:18,sourceRevision:1});
 await stage({id:id('npc_1'),dueAt:62,sourceRevision:2});
 let r=await due(0,30);assert.equal(r.candidates.length,0);assert.equal(r.staleCandidates,1);
 r=await due(40,80);assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].sourceRevision,2);
 canonical.get(id('npc_1')).status='completed';
 r=await due(40,80);assert.equal(r.candidates.length,0);
});
test('untrusted index data without matching canonical schedule is ignored',async()=>{
 const {stage,index}=setup();
 await stage({id:id('npc_1'),dueAt:29});
 const r=await index.due({from:0,to:29,resolveCurrent:async()=>null});
 assert.equal(r.candidates.length,0);assert.equal(r.staleCandidates,1);
});
test('bounded index enforces bucket span, valid entries and GM authority',async()=>{
 const {index,stage,due}=setup({maxBucketsPerWindow:2});
 await assert.rejects(due(0,90),{code:'DUE_BUDGET'});
 await assert.rejects(stage({id:id('bad_001'),dueAt:-5}),{code:'DUE_ENTRY'});
 await assert.rejects(index.due({from:1,to:5}),{code:'DUE_QUERY'});
 const untrusted=new NativeTemporalIndex({repository:new MemoryPartitionRepository(),gmProvider:()=>({userId:'P',isGM:true})});
 await assert.rejects(untrusted.stage({id:id('a_001'),dueAt:9,kind:'deadline',sourceRevision:1,sourceEventId:eid('a_001')}),{code:'GM_REQUIRED'});
});
test('read back rejects malformed indexed record',async()=>{
 const {index,stage,repo,gmProvider}=setup();
 const row=await stage({id:id('npc_1'),dueAt:15});
 const locator=(await import('../src/storage/native-temporal-index.mjs')).dueBucketLocator;
 const loc=await locator(0);
 const record=await repo.read(loc.id,{partitionId:loc.partitionId,gm:gmProvider()});
 await repo.put({...record,kind:'something-else'},{expectedRevision:record.revision,gm:gmProvider()});
 await assert.rejects(index.due({from:0,to:20,resolveCurrent:async()=>row}),{code:'DUE_CORRUPT'});
});
