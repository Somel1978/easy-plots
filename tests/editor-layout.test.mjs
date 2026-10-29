import test from 'node:test';
import assert from 'node:assert/strict';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ImmutableGraphPageStore} from '../src/storage/graph-chunks.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
function env(){const repository=new MemoryPartitionRepository(),gm=createLocalGMContext({user:{id:'gm-edit',isGM:true}},'w');
const gmProvider=()=>gm, pageStore=new ImmutableGraphPageStore({repository,gmProvider});
const registry=new PersistentGraphRegistry({repository,gmProvider,pageStore});
return {repository,registry,editor:new GraphEditorModel({registry})};}
test('new nodes wrap into a bounded grid instead of disappearing beyond the canvas',()=>{
 const {editor}=env();editor.newGraph('Large graph');
 for(let i=0;i<27;i++)editor.addNode('core.branch.parallel');
 const nodes=editor.graph.nodes;
 assert.equal(nodes.length,28);
 assert.ok(nodes.every(n=>n.layout.x>=0&&n.layout.x<=15000&&n.layout.y>=0&&n.layout.y<=30000));
 assert.equal(new Set(nodes.map(n=>`${n.layout.x}:${n.layout.y}`)).size,nodes.length);
 assert.ok(nodes[27].layout.y>nodes[0].layout.y);
 editor.moveNode(nodes[27].id,{x:1300,y:2400});
 assert.deepEqual(editor.graph.nodes[27].layout,{x:1300,y:2400});
});
test('paged graph draft lists authoritative title without reading graph body',async()=>{
 const {repository,registry,editor}=env();const graph=editor.newGraph('A long conspiratorial campaign arc');
 for(let i=0;i<12;i++)editor.addNode('core.branch.parallel');
 await editor.save();repository.resetBudget();
 const result=await registry.listDrafts({limit:12});
 assert.equal(result.items.length,1);
 assert.equal(result.items[0].id,graph.id);
 assert.equal(result.items[0].title,'A long conspiratorial campaign arc');
 assert.equal(result.items[0].revision,1);
 assert.ok(repository.instrumentation.readRequests<=1);
});
