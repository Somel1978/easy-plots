import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {validateGraph} from '../src/graph/validate.mjs';
const env=()=>{const repository=new MemoryPartitionRepository();const gm=createLocalGMContext({user:{id:'gm-pub',isGM:true}},'w');const registry=new PersistentGraphRegistry({repository,gmProvider:()=>gm});return {repository,registry,editor:new GraphEditorModel({registry})};};
for(const [type,change] of [
 ['core.faction.standing',{delta:999}],
 ['core.obligation.resolve',{outcome:'erase-everything'}],
 ['core.investigation.attest-evidence',{factId:''}],
 ['core.pressure.clock',{ticks:99,maxTicks:6}]
])test(`malformed ${type} payload blocks publication before execution`,async()=>{
 const {editor}=env();const graph=editor.newGraph('Publication guard');const nodeId=editor.addNode(type);
 editor.updateSelected({payloadJSON:JSON.stringify({...editor.selectedNode.data.payload,...change})});
 editor.connect(graph.rootNodeId,nodeId);
 await assert.rejects(()=>editor.save());
});
test('forged graph with a cycle fails publication rather than relying on visited-node suppression',()=>{
 const {editor}=env();const graph=editor.newGraph('Cycle test');const a=editor.addNode('core.branch.parallel'),b=editor.addNode('core.branch.parallel');
 editor.connect(graph.rootNodeId,a);editor.connect(a,b);
 const fake=editor.graph;
 fake.edges.push({id:'ep:edge:cycle_fake',kind:'flow',source:{nodeId:b,portId:'out'},target:{nodeId:a,portId:'in'}});
 assert.throws(()=>validateGraph(fake),{code:'UNBOUNDED_CYCLE'});
});
test('acyclic diamond graph is valid despite shared downstream node',()=>{
 const {editor}=env(),graph=editor.newGraph('Diamond graph');
 const first=editor.addNode('core.branch.condition'),a=editor.addNode('core.branch.parallel'),b=editor.addNode('core.branch.parallel'),last=editor.addNode('core.pressure.clock');
 editor.connect(graph.rootNodeId,first);editor.connect(first,a,{sourcePortId:'true'});editor.connect(first,b,{sourcePortId:'false'});
 editor.connect(a,last);editor.connect(b,last);assert.equal(validateGraph(editor.graph).ok,true);
});
