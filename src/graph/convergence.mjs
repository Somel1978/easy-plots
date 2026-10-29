/** Explicit, pure, event-local convergence. This contract never writes state. */
import {EasyPlotsError} from '../contracts/errors.mjs';
export const CONVERGENCE_NODE_TYPE='core.flow.converge';
export const CONVERGENCE_NODE_CONFIG=Object.freeze({label:'Bounded convergence',data:{initialValue:0,step:1,targetValue:2,maxPasses:4},outputs:['repeat','converged']});
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export function validateConvergenceNode(node){
 const d=node?.data;
 if(node?.typeId!==CONVERGENCE_NODE_TYPE||!d||Object.keys(d).sort().join(',')!=='initialValue,maxPasses,step,targetValue'||!Number.isSafeInteger(d.maxPasses)||d.maxPasses<1||d.maxPasses>16||['initialValue','step','targetValue'].some(k=>!Number.isFinite(d[k])||Math.abs(d[k])>1e9))fail('CONVERGENCE_CONTRACT','Convergence requires finite authored initial/step/target values and 1–16 passes');
 if(node.ports!==undefined)for(const id of ['repeat','converged'])if(!node.ports.some(p=>p.id===id&&p.direction==='output'&&p.valueType==='event'))fail('CONVERGENCE_PORTS','Convergence requires repeat and converged event outputs');
 return true;
}
function acyclic(graph,skip){
 const outgoing=new Map(graph.nodes.map(n=>[n.id,[]])),degrees=new Map(graph.nodes.map(n=>[n.id,0]));
 for(const e of graph.edges)if(['flow','condition','event','data'].includes(e.kind)&&!skip(e)){
  outgoing.get(e.source.nodeId).push(e.target.nodeId);degrees.set(e.target.nodeId,degrees.get(e.target.nodeId)+1);
 }
 const queue=[...degrees].filter(([,degree])=>!degree).map(([id])=>id);let head=0;
 while(head<queue.length)for(const id of outgoing.get(queue[head++])){const count=degrees.get(id)-1;degrees.set(id,count);if(!count)queue.push(id);}
 return head===graph.nodes.length;
}
export function convergenceCycleNodeIds(graph){
 const flow=graph.edges.filter(e=>['flow','condition','event'].includes(e.kind)),forward=new Map(),reverse=new Map();
 for(const e of flow){const a=forward.get(e.source.nodeId)??[];a.push(e.target.nodeId);forward.set(e.source.nodeId,a);const b=reverse.get(e.target.nodeId)??[];b.push(e.source.nodeId);reverse.set(e.target.nodeId,b);}
 const reachable=(start,map)=>{const seen=new Set(),queue=[start];while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);queue.push(...(map.get(id)??[]));}return seen;};
 const cyclic=new Set();
 for(const gate of graph.nodes.filter(n=>n.typeId===CONVERGENCE_NODE_TYPE)){
  const from=reachable(gate.id,reverse);if(!(forward.get(gate.id)??[]).some(id=>from.has(id)))continue;
  const to=reachable(gate.id,forward);for(const id of to)if(from.has(id))cyclic.add(id);
 }
 return cyclic;
}
/** Removing only declared repeat edges must leave a DAG. Data dependencies and
 * converged paths cannot acquire implicit iteration semantics. */
export function validateConvergenceCycles(graph,{localFlowTypes=[]}={}){
 const gates=new Map(graph.nodes.filter(n=>n.typeId===CONVERGENCE_NODE_TYPE).map(n=>[n.id,n]));
 for(const node of gates.values())validateConvergenceNode(node);
 if(acyclic(graph,()=>false))return {cyclic:false,gateNodeIds:[...gates.keys()]};
 if(!acyclic(graph,e=>e.kind!=='data'&&gates.has(e.source.nodeId)&&e.source.portId==='repeat'))fail('UNBOUNDED_CYCLE','Every flow cycle must cross a declared convergence repeat output; data cycles are forbidden');
 // Find nodes on paths returning to a gate. Opaque nested executions and joins
 // would need their own iteration contract, so they cannot be loop bodies.
 const cyclic=convergenceCycleNodeIds(graph);
 for(const node of graph.nodes)if(cyclic.has(node.id)&&!gates.has(node.id)&&!localFlowTypes.includes(node.typeId))fail('CONVERGENCE_BODY','Convergence loops require implemented local flow nodes, without joins, triggers, extensions or subgraph calls');
 return {cyclic:true,gateNodeIds:[...gates.keys()],cyclicNodeIds:[...cyclic]};
}
/** Instantiate once per graph invocation. Never put this in a compiled cache. */
export class BoundedConvergenceRun {
 #states=new Map();#epoch=0;#operations=new Set();#cycleNodes;
 constructor(graph=null){this.#cycleNodes=graph?convergenceCycleNodeIds(graph):new Set();}
 visitKey(nodeId,round=0){return `${nodeId}|${this.#cycleNodes.has(nodeId)?round:0}`;}
 claimOperation(operationId){if(this.#operations.has(operationId))return false;this.#operations.add(operationId);return true;}
 step(node){
  validateConvergenceNode(node);const d=node.data,prior=this.#states.get(node.id)??{value:d.initialValue,passes:0,seen:new Set([d.initialValue])};
  const passes=prior.passes+1,delta=d.targetValue-prior.value;
  let value=prior.value;
  if(delta!==0){value=prior.value+d.step;if(delta*d.step>0)value=delta>0?Math.min(d.targetValue,value):Math.max(d.targetValue,value);}
  const converged=value===d.targetValue,repeated=!converged&&prior.seen.has(value),exhausted=!converged&&!repeated&&passes>=d.maxPasses;
  const status=converged?'convergence-reached':repeated?'convergence-repeated-state':exhausted?'convergence-budget-exhausted':'convergence-repeat';
  prior.seen.add(value);this.#states.set(node.id,{value,passes,seen:prior.seen});
  return {pass:converged||!repeated&&!exhausted,allowedPorts:converged?['converged']:repeated||exhausted?[]:['repeat'],stopped:repeated||exhausted,status,round:++this.#epoch,
   diagnostic:{contract:'numeric-clamped-step-v1',passes,maxPasses:d.maxPasses,previousValue:prior.value,value,targetValue:d.targetValue}};
 }
}
