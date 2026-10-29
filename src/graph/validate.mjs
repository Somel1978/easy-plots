import {EasyPlotsError,requireInvariant} from '../contracts/errors.mjs';
import {assertNarrativeId,assertUnique} from '../contracts/record.mjs';
import {FLOW_JOIN_TYPE,validateFlowJoin} from './flow-join.mjs';
import {validateConvergenceCycles} from './convergence.mjs';
import {LOGIC_NODE_TYPES} from './logic-nodes.mjs';
import {DATA_NODE_TYPES,validateDataNode,validateInputBindings,publishedDataInterface,validateDataBranch} from './typed-data.mjs';
const edgeKinds=new Set(['flow','condition','event','data','relationship']);
const accessClasses=new Set(['published','party','observer-private','gm','gm-secret']);
export function validateGraph(graph,{requiredCapabilities=[],maxNodes=2500,allowIncompleteData=false}={}) {
  requireInvariant(graph?.kind==='graph'&&graph?.schemaVersion==='1.0.0','INVALID_GRAPH','Unsupported graph contract');
  assertNarrativeId(graph.id);
  requireInvariant(Array.isArray(graph.nodes)&&Array.isArray(graph.edges),'INVALID_GRAPH','Graph requires nodes and edges');
  requireInvariant(graph.nodes.length>0&&graph.nodes.length<=maxNodes,'GRAPH_BUDGET','Node count outside budget');
  assertUnique(graph.nodes.map(n=>n.id));assertUnique(graph.edges.map(e=>e.id));
  const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
  publishedDataInterface(graph);
  requireInvariant(nodes.has(graph.rootNodeId),'INVALID_ROOT','Missing root node');
  for(const node of graph.nodes) {
    assertNarrativeId(node.id);
    requireInvariant(node.graphId===graph.id,'INVALID_GRAPH','Node belongs to another graph');
    requireInvariant(typeof node.typeId==='string'&&node.typeId.includes('.'),'INVALID_NODE','Node provider type must be namespaced');
    requireInvariant(accessClasses.has(node.accessClass),'INVALID_ACCESS','Unknown node access class');
    requireInvariant(Array.isArray(node.ports),'INVALID_PORT','Missing node port contract');
    assertUnique(node.ports.map(p=>p.id));
    for(const p of node.ports) requireInvariant(['input','output'].includes(p.direction)&&accessClasses.has(p.accessClass),'INVALID_PORT','Invalid port contract');
    if(DATA_NODE_TYPES.includes(node.typeId))validateDataNode(node);
    if(node.typeId==='core.branch.data')validateDataBranch(node);
    validateInputBindings(node);
  }
  for(const edge of graph.edges){
    assertNarrativeId(edge.id);
    requireInvariant(edgeKinds.has(edge.kind),'INVALID_EDGE','Unsupported edge type');
    const from=nodes.get(edge.source?.nodeId),to=nodes.get(edge.target?.nodeId);
    requireInvariant(from&&to,'DANGLING_EDGE','Edge references missing node');
    const output=from.ports.find(p=>p.id===edge.source.portId&&p.direction==='output');
    const input=to.ports.find(p=>p.id===edge.target.portId&&p.direction==='input');
    requireInvariant(output&&input,'INVALID_PORT','Edge must connect declared output to input');
    requireInvariant(output.valueType===input.valueType,'INVALID_PORT_TYPE','Connected ports must have compatible value types');
    if(edge.kind==='data'){
      requireInvariant(output.valueType!=='event','DATA_PORTS','Event ports cannot be consumed as typed values');
      requireInvariant(DATA_NODE_TYPES.includes(from.typeId),'DATA_PROVIDER_UNAVAILABLE','Data source must have an implemented pure value provider');
      requireInvariant(output.accessClass==='gm-secret'&&input.accessClass==='gm-secret'&&to.accessClass==='gm-secret','DATA_DISCLOSURE','Private state cannot flow to a less protected input');
      requireInvariant(DATA_NODE_TYPES.includes(to.typeId)||to.typeId==='core.branch.data'&&input.id==='predicate'||Object.values(to.data?.inputBindings??{}).includes(input.id),'DATA_BINDING','Data target must explicitly consume the input');
    }else if(['flow','condition','event'].includes(edge.kind)){
      requireInvariant(output.valueType==='event','INVALID_PORT_TYPE','Flow links require event ports');
    }
  }
  for(const node of graph.nodes)for(const inputId of Object.values(node.data?.inputBindings??{})){
    requireInvariant(graph.edges.filter(e=>e.kind==='data'&&e.target.nodeId===node.id&&e.target.portId===inputId).length===1,'DATA_CARDINALITY','Bound data inputs require exactly one source');
  }
  const dataTargets=new Set();for(const edge of graph.edges)if(edge.kind==='data'){
    const key=`${edge.target.nodeId}|${edge.target.portId}`;
    requireInvariant(!dataTargets.has(key),'DATA_CARDINALITY','Data inputs cannot have multiple producers');dataTargets.add(key);
  }
  if(!allowIncompleteData)for(const node of graph.nodes)if(DATA_NODE_TYPES.includes(node.typeId)&&node.typeId!=='core.state.value')for(const p of node.ports.filter(p=>p.direction==='input'&&p.valueType!=='event'))
    requireInvariant(dataTargets.has(`${node.id}|${p.id}`),'DATA_CARDINALITY','Data operation requires all authored interface inputs');
  if(!allowIncompleteData)for(const node of graph.nodes)if(node.typeId==='core.branch.data')requireInvariant(dataTargets.has(`${node.id}|predicate`),'DATA_CARDINALITY','Typed branch requires a boolean producer');
  for(const node of graph.nodes)if(node.typeId===FLOW_JOIN_TYPE){
    const incoming=graph.edges.filter(e=>['flow','condition','event'].includes(e.kind)&&e.target.nodeId===node.id).length;
    validateFlowJoin(node,{incoming});
  }
  const required=new Set(graph.requiredCapabilityIds??[]);
  const missing=[...required].filter(c=>!requiredCapabilities.includes(c));
  if(missing.length) throw new EasyPlotsError('MISSING_CAPABILITY','Graph requires unavailable capabilities',{missing});
  validateConvergenceCycles(graph,{localFlowTypes:[...LOGIC_NODE_TYPES,'core.condition','core.branch.condition','core.branch.data','core.state.read','core.effect.proposal']});
  const unreachable=[];const seen=new Set();const next=[graph.rootNodeId];
  const outgoing=new Map();for(const e of graph.edges) if(['flow','condition','event'].includes(e.kind)) {const arr=outgoing.get(e.source.nodeId)??[];arr.push(e.target.nodeId);outgoing.set(e.source.nodeId,arr);}
  while(next.length){const n=next.pop();if(seen.has(n))continue;seen.add(n);next.push(...(outgoing.get(n)??[]));}
  for(const node of graph.nodes)if(node.typeId==='core.data.export')seen.add(node.id);
  // Lazy producers are reachable only through a reachable consumer. Data links
  // never activate effects or make an unselected narrative branch reachable.
  let expanded=true;while(expanded){expanded=false;for(const e of graph.edges)if(e.kind==='data'&&seen.has(e.target.nodeId)&&!seen.has(e.source.nodeId)){seen.add(e.source.nodeId);expanded=true;}}
  for(const id of nodes.keys())if(!seen.has(id))unreachable.push(id);
  return {ok:true,warnings:unreachable.map(nodeId=>({code:'UNREACHABLE_NODE',nodeId})),nodeCount:nodes.size,edgeCount:graph.edges.length};
}
