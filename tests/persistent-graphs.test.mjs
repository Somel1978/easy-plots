import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {PersistentGraphRegistry,graphStorageKeys} from '../src/graph/persistent-registry.mjs';
import {graph,session} from './fixtures.mjs';
import {GraphEditorModel,makeEditableGraph} from '../src/editor/model.mjs';

const setup=()=>{
  const repo=new MemoryPartitionRepository();
  const gm={userId:'GM_1',worldId:'world001',kind:'gm-local',epoch:'test'};
  // Use the same validated GM session source as the older tests.
  const ctx=()=>({userId:'GM_1',isGM:true,source:'local-user',worldId:'world001',epoch:'epoch',...gm});
  return {repo,ctx,registry:new PersistentGraphRegistry({repository:repo,gmProvider:()=>ctx()})};
};
// Reuse trusted authority creation so tests cannot accidentally weaken it.
import {createLocalGMContext} from '../src/security/authority.mjs';
const make=()=>{
  const repo=new MemoryPartitionRepository();
  const ctx=createLocalGMContext({user:{id:'GM_1',isGM:true},epoch:'test'},'testing-world');
  return {repo,ctx,registry:new PersistentGraphRegistry({repository:repo,gmProvider:()=>ctx})};
};

test('persistent draft save and new registry instance read same graph',async()=>{
  const {repo,ctx,registry}=make();const g=graph();
  const saved=await registry.saveDraft(g);
  assert.equal(saved.revision,1);
  const newRegistry=new PersistentGraphRegistry({repository:repo,gmProvider:()=>ctx});
  assert.deepEqual(await newRegistry.getDraft(g.id),saved);
  assert.equal(repo.instrumentation.partitionCount,1);
});

test('published immutable snapshot survives later draft edits and separate activation pointer',async()=>{
  const {repo,ctx,registry}=make();const g=graph();
  const draft=await registry.saveDraft(g);
  const published=await registry.publish(g.id,{expectedRevision:draft.revision});
  assert.equal(published.publishedVersion,1);
  assert.equal(await registry.getActive(g.id),null);
  const active=await registry.activate(g.id,1);
  assert.equal(active.active,true);
  assert.equal(active.revision,1);
  const edited={...draft,title:'Later edited plot'};
  const second=await registry.saveDraft(edited,{expectedRevision:1});
  assert.equal(second.revision,2);
  assert.equal((await registry.getActive(g.id)).title,undefined);
  assert.equal((await registry.getDraft(g.id)).title,'Later edited plot');
  const fresh=new PersistentGraphRegistry({repository:repo,gmProvider:()=>ctx});
  assert.equal((await fresh.getActive(g.id)).publishedVersion,1);
  const snapshot2=await fresh.publish(g.id,{expectedRevision:2});
  assert.equal(snapshot2.title,'Later edited plot');
  assert.equal((await fresh.getActive(g.id)).publishedVersion,1);
  await fresh.activate(g.id,2,{expectedActivationRevision:1});
  assert.equal((await fresh.getActive(g.id)).title,'Later edited plot');
  await fresh.deactivate(g.id,{expectedActivationRevision:2});
  assert.equal(await fresh.getActive(g.id),null);
});

test('stale draft and activation operations are denied',async()=>{
  const {registry}=make();const g=graph();
  await registry.saveDraft(g);
  await assert.rejects(registry.saveDraft(g,{expectedRevision:null}),{code:'REVISION_CONFLICT'});
  await assert.rejects(registry.publish(g.id,{expectedRevision:0}),{code:'REVISION_CONFLICT'});
  await registry.publish(g.id,{expectedRevision:1});
  await registry.activate(g.id,1);
  await assert.rejects(registry.activate(g.id,1,{expectedActivationRevision:null}),{code:'REVISION_CONFLICT'});
  await assert.rejects(registry.deactivate(g.id,{expectedActivationRevision:0}),{code:'REVISION_CONFLICT'});
});

test('republishing same revision is idempotent and does not overwrite it',async()=>{
  const {registry,repo}=make();const g=graph();await registry.saveDraft(g);
  const first=await registry.publish(g.id,{expectedRevision:1});
  const rowsBefore=repo.instrumentation.partitionCount;
  const again=await registry.publish(g.id,{expectedRevision:1});
  assert.deepEqual(first,again);
  assert.equal(repo.instrumentation.partitionCount,rowsBefore);
});

test('corrupted immutable snapshot detected by fingerprint before activation',async()=>{
  const {registry,repo,ctx}=make();const g=graph();
  await registry.saveDraft(g);await registry.publish(g.id,{expectedRevision:1});
  const keys=await graphStorageKeys(g.id);
  const loc=keys.snapshot(1);const saved=await repo.read(loc.id,{partitionId:loc.partitionId});
  await repo.put({...saved,snapshot:{...saved.snapshot,title:'Silently tampered'}},{expectedRevision:saved.revision});
  await assert.rejects(registry.getPublished(g.id,1),{code:'SNAPSHOT_CORRUPT'});
  await assert.rejects(registry.activate(g.id,1),{code:'SNAPSHOT_CORRUPT'});
});

test('unknown executable node providers and oversized graphs fail closed at draft save',async()=>{
  const {registry}=make();const g=graph();
  g.nodes[1].typeId='unknown.integration';
  await assert.rejects(registry.saveDraft(g),{code:'NODE_PROVIDER_UNAVAILABLE'});
  const oversized=graph();oversized.nodes[2].data.payload={content:'a'.repeat(47_000)};
  await assert.rejects(registry.saveDraft(oversized),{code:'GRAPH_RECORD_TOO_LARGE'});
});

test('bounded draft query returns only scope records',async()=>{
  const {registry}=make();const g=graph();await registry.saveDraft(g);
  const found=await registry.listDrafts({limit:16});
  assert.equal(found.items.length,1);
  assert.equal(found.items[0].id,g.id);
  await assert.rejects(registry.listDrafts({limit:100}),{code:'QUERY_BUDGET'});
});

test('graph editor model authors, connects, saves, publishes and activates a plot',async()=>{
  const {registry}=make();const editor=new GraphEditorModel({registry});
  const draft=editor.newGraph('The Missing Manifest');
  assert.equal(draft.nodes.length,1);
  const condition=editor.addNode('core.condition');
  const effect=editor.addNode('core.effect.proposal');
  editor.connect(draft.rootNodeId,condition);
  editor.connect(condition,effect);
  editor.selectNode(effect);
  editor.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"manifest","value":true}'});
  assert.equal(editor.preview().ok,true);
  const saved=await editor.save();assert.equal(saved.revision,1);
  const published=await editor.publish();assert.equal(published.publishedVersion,1);
  const pointer=await editor.activate(1);assert.equal(pointer.active,true);
  editor.rename('Updated Plot');
  await assert.rejects(editor.publish(),{code:'UNSAVED_CHANGES'});
  await editor.save();
  assert.equal((await editor.publish()).publishedVersion,2);
  assert.equal((await editor.activation()).publishedVersion,1);
});

test('graph editor rejects invalid connections and cycles, root removal and malformed JSON',async()=>{
  const {registry}=make();const editor=new GraphEditorModel({registry});
  const g=editor.newGraph('Harbor');const c=editor.addNode('core.condition');
  editor.connect(g.rootNodeId,c);
  assert.throws(()=>editor.connect(c,g.rootNodeId),{code:'INVALID_CONNECTION'});
  assert.throws(()=>editor.connect(g.rootNodeId,c),{code:'DUPLICATE_CONNECTION'});
  assert.throws(()=>editor.removeNode(g.rootNodeId),{code:'ROOT_REQUIRED'});
  editor.selectNode(c);assert.throws(()=>editor.updateSelected({conditionJSON:'not json'}),{code:'INVALID_CONDITION'});
  assert.equal(editor.selectedNode.data.condition.op,'compare');
  const second=editor.addNode('core.condition');editor.connect(c,second);
  assert.throws(()=>editor.connect(second,c),{code:'CYCLE_BLOCKED'});
});

test('graph editor refuses to lose unsaved work via direct load',async()=>{
  const {registry}=make();const editor=new GraphEditorModel({registry});
  editor.newGraph('Sandbox');await assert.rejects(editor.load('ep:graph:demo_001'),{code:'UNSAVED_CHANGES'});
  editor.discardUnsaved();await assert.rejects(editor.load('ep:graph:demo_001'),{code:'NOT_FOUND'});
});

test('graph authoring context requires real GM authority rather than user-supplied flags',async()=>{
  const repo=new MemoryPartitionRepository();
  const registry=new PersistentGraphRegistry({repository:repo,gmProvider:()=>({userId:'PLAYER',isGM:true})});
  await assert.rejects(registry.saveDraft(graph()),{code:'GM_REQUIRED'});
});

test('publication reachability warnings need an explicit GM acknowledgement',async()=>{
  const {registry}=make();const g=graph();
  // Remove a flow edge, leaving the effect disconnected from the root.
  g.edges=g.edges.slice(0,1);
  await registry.saveDraft(g);
  await assert.rejects(registry.publish(g.id,{expectedRevision:1}),{code:'PREFLIGHT_REVIEW_REQUIRED'});
  const snapshot=await registry.publish(g.id,{expectedRevision:1,acknowledgeWarnings:true});
  assert.equal(snapshot.publicationReport.warnings.length,1);
});

test('moving a node is captured in draft and rejects invalid coordinates',async()=>{
  const {registry}=make();const editor=new GraphEditorModel({registry});const graph=editor.newGraph('Drag Nodes');
  editor.moveNode(graph.rootNodeId,{x:220.4,y:110.8});
  assert.deepEqual(editor.graph.nodes[0].layout,{x:220,y:111});
  assert.throws(()=>editor.moveNode(graph.rootNodeId,{x:-1,y:10}),{code:'INVALID_POSITION'});
  const saved=await editor.save();assert.deepEqual(saved.nodes[0].layout,{x:220,y:111});
});

test('published graph does not activate merely by being published',async()=>{
  const {registry}=make();const g=graph();await registry.saveDraft(g);
  await registry.publish(g.id,{expectedRevision:1});
  assert.equal(await registry.getActivation(g.id),null);
  assert.equal(await registry.getActive(g.id),null);
});
