import test from 'node:test';import assert from 'node:assert/strict';
import {ImmutableGraphPageStore} from '../src/storage/graph-chunks.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
const gm=createLocalGMContext({user:{id:'gm',isGM:true}},'world');
function environment(repo=new MemoryPartitionRepository()){
  const gmProvider=()=>gm,pageStore=new ImmutableGraphPageStore({repository:repo,gmProvider});
  const registry=new IndexedGraphRegistry({registry:new PersistentGraphRegistry({repository:repo,gmProvider,pageStore}),
    catalog:new ActiveTriggerCatalog({repository:repo,gmProvider})});
  return {repo,registry,editor:new GraphEditorModel({registry}),pageStore};
}
test('paged registry saves, publishes and activates a large graph across reinitialization',async()=>{
  const s=environment();const g=s.editor.newGraph('Large narrative graph');
  let last=g.rootNodeId;
  for(let i=0;i<110;i++){
    const id=s.editor.addNode('core.condition');
    s.editor.connect(last,id);last=id;
  }
  assert.ok(JSON.stringify(s.editor.graph).length>44000);
  const saved=await s.editor.save();assert.equal(saved.nodes.length,111);
  const published=await s.editor.publish();assert.equal(published.nodes.length,111);
  await s.editor.activate(published.publishedVersion);
  const next=environment(s.repo);const draft=await next.registry.getDraft(g.id),active=await next.registry.getActive(g.id);
  assert.equal(draft.nodes.length,111);assert.equal(active.publishedVersion,published.publishedVersion);
  assert.deepEqual(active.nodes,draft.nodes);
  assert.equal((await next.pageStore.manifest(g.id,1)).kind,'immutable-graph-manifest');
});
test('paged snapshots remain immutable while a subsequent draft revision changes',async()=>{
  const s=environment(),g=s.editor.newGraph('Immutable graph');
  await s.editor.save();const published=await s.editor.publish();
  s.editor.addNode('core.condition');await s.editor.save();
  const frozen=await s.registry.getPublished(g.id,published.publishedVersion);
  assert.equal(frozen.nodes.length,1);
  await assert.rejects(()=>s.pageStore.publish({...frozen,revision:2},{revision:1}),{code:'IMMUTABLE_SNAPSHOT_CONFLICT'});
});
