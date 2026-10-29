import test from 'node:test';import assert from 'node:assert/strict';
import {validateGraph} from '../src/graph/validate.mjs';
const port=(name,direction)=>({id:name,direction,valueType:'event',accessClass:'gm'});
function graphWith(n){const id='ep:graph:large_001';const nodes=Array.from({length:n},(_,i)=>({id:`ep:node:long_${i.toString().padStart(5,'0')}`,graphId:id,typeId:i===0?'core.trigger.event':'core.condition',accessClass:'gm',ports:[port('in','input'),port('out','output')],data:{}}));
 const edges=nodes.slice(1).map((node,i)=>({id:`ep:edge:long_${i.toString().padStart(5,'0')}`,kind:'flow',source:{nodeId:nodes[i].id,portId:'out'},target:{nodeId:node.id,portId:'in'}}));
 return {id,kind:'graph',schemaVersion:'1.0.0',rootNodeId:nodes[0].id,nodes,edges,requiredCapabilityIds:[]};}
test('2,500-node flow validation uses bounded iterative traversal rather than recursive JS stack',()=>{
 const graph=graphWith(2500),report=validateGraph(graph);
 assert.equal(report.nodeCount,2500);assert.equal(report.warnings.length,0);
});
test('large graph still detects a hidden back-edge cycle',()=>{
 const graph=graphWith(2200);graph.edges.push({id:'ep:edge:back_001',kind:'flow',source:{nodeId:graph.nodes.at(-1).id,portId:'out'},target:{nodeId:graph.nodes[17].id,portId:'in'}});
 assert.throws(()=>validateGraph(graph),{code:'UNBOUNDED_CYCLE'});
});
