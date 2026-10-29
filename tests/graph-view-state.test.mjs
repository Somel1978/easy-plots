import test from 'node:test';
import assert from 'node:assert/strict';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
async function suite(){
 const repository=new MemoryPartitionRepository(),ctx=createLocalGMContext({user:{id:'gm_view001',isGM:true},epoch:'view'},'world'),gmProvider=()=>ctx;
 const registry=new PersistentGraphRegistry({repository,gmProvider}),model=new GraphEditorModel({registry});model.newGraph('Layered graph');
 const fact=model.addNode('core.world.fact'),knowledge=model.addNode('core.knowledge.belief');
 model.connect(model.graph.rootNodeId,fact);model.connect(model.graph.rootNodeId,knowledge);
 await model.save();return {model,registry,fact,knowledge};
}
test('ADR-022: switching narrative/execution/knowledge layers preserves the complete canonical graph',async()=>{
 const s=await suite(),original=s.model.graph;
 for(const [layer,visible] of [['narrative',[s.fact]],['knowledge',[s.knowledge]],['execution',[original.rootNodeId]]]){
  s.model.setViewLayer(layer);assert.deepEqual(s.model.viewGraph.nodes.map(n=>n.id),visible);
  assert.deepEqual(s.model.graph,original);assert.equal(s.model.state.dirty,false);
 }
 s.model.setViewLayer('all');assert.equal(s.model.viewGraph.nodes.length,3);assert.equal(s.model.viewGraph.edges.length,2);
 assert.deepEqual(await s.registry.getDraft(original.id),original);
});
test('cross-layer connections remain in the graph and are counted in the filtered view',async()=>{
 const s=await suite();s.model.setViewLayer('knowledge');
 assert.equal(s.model.viewGraph.boundaryEdgeCount,1);assert.equal(s.model.viewGraph.edges.length,0);assert.equal(s.model.graph.edges.length,2);
});
test('ADR-023: compact/expanded density never changes canonical execution or draft revision',async()=>{
 const s=await suite(),original=s.model.graph;
 for(const density of ['compact','expanded','comfortable']){
  s.model.setViewDensity(density);s.model.toggleNodeExpansion(s.fact);
  assert.deepEqual(s.model.graph,original);assert.equal(s.model.state.dirty,false);
 }
 assert.equal((await s.registry.getDraft(original.id)).revision,1);
});
test('individual layer assignment is a view preference, not a node data mutation',async()=>{
 const s=await suite(),original=s.model.graph;
 s.model.setNodeViewLayer(s.fact,'knowledge');s.model.setViewLayer('knowledge');
 assert.equal(s.model.viewGraph.nodes.length,2);assert.deepEqual(s.model.graph,original);assert.equal(s.model.state.dirty,false);
});
test('invalid view operations fail without touching saved or unsaved graph state',async()=>{
 const s=await suite(),before=s.model.state;
 assert.throws(()=>s.model.setViewLayer('secret'),{code:'VIEW_LAYER'});
 assert.throws(()=>s.model.setViewDensity('arbitrary'),{code:'VIEW_DENSITY'});
 assert.throws(()=>s.model.toggleNodeExpansion('ep:node:missing001'),{code:'UNKNOWN_NODE'});
 assert.deepEqual(s.model.state,before);
});
test('view snapshots cannot be used to mutate internal presentation preferences',async()=>{
 const s=await suite(),state=s.model.state;state.view.expandedNodeIds.push(s.fact);state.view.nodeLayers[s.fact]='knowledge';
 assert.equal(s.model.state.view.expandedNodeIds.length,0);assert.equal(s.model.nodeLayer(s.model.graph.nodes.find(n=>n.id===s.fact)),'narrative');
});
test('new or reloaded plots do not retain stale node overrides from another graph',async()=>{
 const s=await suite(),id=s.model.graph.id;s.model.setNodeViewLayer(s.fact,'knowledge');s.model.toggleNodeExpansion(s.fact);
 await s.model.load(id);assert.deepEqual(s.model.state.view.expandedNodeIds,[]);assert.deepEqual(s.model.state.view.nodeLayers,{});
 s.model.newGraph('Another graph');assert.equal(s.model.state.view.layer,'all');assert.deepEqual(s.model.state.view.nodeLayers,{});
});
test('individual nodes can collapse while the global density is expanded',async()=>{
 const s=await suite(),original=s.model.graph;s.model.setViewDensity('expanded');assert.equal(s.model.isNodeExpanded(s.fact),true);
 s.model.toggleNodeExpansion(s.fact);assert.equal(s.model.isNodeExpanded(s.fact),false);
 s.model.toggleNodeExpansion(s.fact);assert.equal(s.model.isNodeExpanded(s.fact),true);
 assert.deepEqual(s.model.graph,original);assert.equal(s.model.state.dirty,false);
});
