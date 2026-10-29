import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {GraphRegistry} from '../src/graph/registry.mjs';
import {graph,gid,session} from './fixtures.mjs';import {createLocalGMContext} from '../src/security/authority.mjs';
test('scoped repository forbids unbounded query',async()=>{
 const r=new MemoryPartitionRepository(),a={id:'ep:fact:record_001',partitionId:'plot-a',kind:'fact'};
 const saved=await r.put(a);assert.equal(saved.revision,1);
 assert.equal((await r.read(a.id,{partitionId:'plot-a',budget:{maxPartitionReads:2}})).kind,'fact');
 assert.equal(await r.read(a.id,{partitionId:'plot-b'}),null);
 await assert.rejects(r.query({partitionId:'plot-a',limit:1000}),{code:'QUERY_BUDGET'});
 await assert.rejects(r.put(a,{expectedRevision:0}),{code:'REVISION_CONFLICT'});
 assert.equal(r.instrumentation.partitionCount,1);
});
test('registry does not mutate active published revision when draft changes',()=>{
 const registry=new GraphRegistry(),gm=createLocalGMContext(session(),'w');
 const original=registry.saveDraft(graph()),snap=registry.publish(gid,{expectedRevision:original.revision,gm});
 registry.activate(gid,snap.publishedVersion,{gm});
 let edited=registry.getDraft(gid);edited.name='Changed later';registry.saveDraft(edited,edited.revision);
 assert.equal(registry.getActive(gid).name,undefined);
 assert.equal(registry.getActive(gid).publishedVersion,1);
 assert.throws(()=>registry.publish(gid,{expectedRevision:original.revision,gm}),{code:'REVISION_CONFLICT'});
 assert.throws(()=>registry.activate(gid,1,{gm:{userId:'GM_1'}}),{code:'GM_REQUIRED'});
});
test('operation journal uses create-once and state guards',async()=>{
 const j=new MemoryOperationJournal();const first=await j.createOnce('key',{state:'prepared'});assert.equal(first.created,true);
 assert.equal((await j.createOnce('key',{state:'prepared'})).created,false);
 await assert.rejects(j.change('key','completed',{state:'applying'}),{code:'JOURNAL_CONFLICT'});
 assert.equal((await j.change('key','prepared',{state:'applying'})).state,'applying');
});
