import test from 'node:test';import assert from 'node:assert/strict';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gm=createLocalGMContext({user:{id:'gm-preflight',isGM:true}},'world');
function fixture(){const repo=new MemoryPartitionRepository();
 const registry=new PersistentGraphRegistry({repository:repo,gmProvider:()=>gm});
 return {editor:new GraphEditorModel({registry}),registry};}
for(const type of ['core.resource.materialize-journal','core.resource.materialize-actor',
 'core.resource.materialize-item','core.resource.bind-native']){
 test(`${type}: editor binds native provenance to the actual graph`,async()=>{
  const {editor}=fixture(),graph=editor.newGraph('Proper provenance');
  const id=editor.addNode(type);
  assert.equal(editor.graph.nodes.find(n=>n.id===id).data.payload.sourceGraphId,graph.id);
  editor.connect(graph.rootNodeId,id);
  await editor.save();
 });
 test(`${type}: preflight rejects a forged resource origin`,async()=>{
  const {editor}=fixture(),graph=editor.newGraph('Wrong provenance');
  const id=editor.addNode(type);
  const payload=editor.graph.nodes.find(n=>n.id===id).data.payload;
  editor.updateSelected({payloadJSON:JSON.stringify({...payload,sourceGraphId:'ep:graph:fake_001'})});
  editor.connect(graph.rootNodeId,id);
  await assert.rejects(()=>editor.save(),{code:'RESOURCE_PROVENANCE_MISMATCH'});
 });
}
