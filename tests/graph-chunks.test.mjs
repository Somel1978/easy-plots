import test from 'node:test';import assert from 'node:assert/strict';
import {ImmutableGraphPageStore,splitGraphPages} from '../src/storage/graph-chunks.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {makeEditableGraph,GraphEditorModel} from '../src/editor/model.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
const gm=createLocalGMContext({user:{id:'gm',isGM:true}},'world');
function env(repository=new MemoryPartitionRepository()){return {repository,store:new ImmutableGraphPageStore({repository,gmProvider:()=>gm})};}
function graph(){const id='ep:graph:published_chunk_001';const nodes=[{id:'ep:node:root_001',graphId:id,typeId:'core.trigger.event',accessClass:'gm',ports:[{id:'out',direction:'output',valueType:'event',accessClass:'gm'}],data:{eventType:'test.event'}}];
  const edges=[];let last=nodes[0];for(let i=1;i<=80;i++){
    const n={id:`ep:node:chunk_${i}`,graphId:id,typeId:'core.condition',accessClass:'gm',ports:[{id:'in',direction:'input',valueType:'event',accessClass:'gm'},{id:'out',direction:'output',valueType:'event',accessClass:'gm'}],data:{condition:{op:'literal',value:true},note:'a'.repeat(100)}};
    nodes.push(n);edges.push({id:`ep:edge:chunk_${i}`,kind:'flow',source:{nodeId:last.id,portId:'out'},target:{nodeId:n.id,portId:'in'}});last=n;}
  return {id,kind:'graph',schemaVersion:'1.0.0',revision:1,rootNodeId:nodes[0].id,nodes,edges,requiredCapabilityIds:[]};}
test('large published graph is stored as immutable bounded pages and reconstructed on demand',async()=>{
  const s=env(),g=graph();assert.ok(splitGraphPages(g).length>2);
  const manifest=await s.store.publish(g,{revision:1});assert.ok(manifest.pages.length>2);
  assert.deepEqual(await s.store.getGraph(g.id,1),g);
  assert.equal((await s.store.publish(g,{revision:1})).fingerprint,manifest.fingerprint);
  await assert.rejects(()=>s.store.publish({...g,revision:2},{revision:1}),{code:'IMMUTABLE_SNAPSHOT_CONFLICT'});
});
test('single page lookup does not load entire graph partitions',async()=>{
  const s=env(),g=graph();await s.store.publish(g,{revision:1});s.repository.resetBudget();
  const page=await s.store.readPage(g.id,1,0);
  assert.equal(page.kind,'nodes');assert.ok(page.records.length<g.nodes.length);
  assert.ok(s.repository.instrumentation.readRequests<=3);
});
test('interrupted chunk write never publishes a manifest',async()=>{
  const real=new MemoryPartitionRepository();let writes=0;
  const failRepo={read:(...args)=>real.read(...args),put:(record,opts)=>{
    if(record.kind==='immutable-graph-page'&&++writes===2)throw Error('disk interrupted');
    return real.put(record,opts);}};
  const store=new ImmutableGraphPageStore({repository:failRepo,gmProvider:()=>gm}),g=graph();
  await assert.rejects(()=>store.publish(g,{revision:1}),/disk interrupted/);
  assert.equal(await store.manifest(g.id,1),null);
});
test('missing or modified pages fail immutability checks',async()=>{
  const s=env(),g=graph();const manifest=await s.store.publish(g,{revision:1});
  const d=manifest.pages[0],page=await s.repository.read(d.id,{partitionId:d.partitionId});
  await s.repository.put({...page,content:{kind:'nodes',records:[]}},{expectedRevision:page.revision});
  await assert.rejects(()=>s.store.readPage(g.id,1,0),{code:'GRAPH_CORRUPT'});
});
