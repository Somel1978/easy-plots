/** Reconstructable branch evidence; no private values enter traces. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {evaluateStateRead} from '../graph/state-read.mjs';
import {validateDataBranch} from '../graph/typed-data.mjs';
import {GraphDataFrame} from './graph-data-frame.mjs';
export async function resolveDataGuard(graph,node,{readState,readGraph,readRoll,event,consume,parameters={},stack=[graph.id]}={}){
  let selectedPort,stateInputs;
  if(node.typeId==='core.state.read'){
    consume?.();
    if(typeof readState!=='function')throw new EasyPlotsError('STATE_READ_UNAVAILABLE','Protected state reader unavailable');
    const row=await readState({scope:node.data.scope,key:node.data.key});
    selectedPort=evaluateStateRead(node,row).allowedPorts[0];
    stateInputs=[{graphId:graph.id,publishedVersion:graph.publishedVersion,nodeId:node.id,scope:node.data.scope,key:node.data.key,revision:row?.revision??null}];
  }else if(node.typeId==='core.branch.data'){
    validateDataBranch(node);const frame=new GraphDataFrame(graph,{readState,readGraph,readRoll,event,consume,parameters,stack});
    selectedPort=await frame.input(node.id,'predicate')?'true':'false';stateInputs=frame.stateInputs;
  }else throw new EasyPlotsError('GUARD_EVIDENCE_INVALID','Unsupported private guard contract');
  return {graphId:graph.id,publishedVersion:graph.publishedVersion,nodeId:node.id,selectedPort,stateInputs};
}
export function mergeDataGuards(...groups){
  const entries=new Map();
  for(const group of groups)for(const guard of group){
    const key=`${guard.graphId}|${guard.nodeId}`,old=entries.get(key);
    if(old&&JSON.stringify(old)!==JSON.stringify(guard))throw new EasyPlotsError('GUARD_INPUT_CONFLICT','Converged paths observed different guard revisions');
    entries.set(key,guard);
  }
  if(entries.size>32)throw new EasyPlotsError('DATA_BUDGET','Guard evidence exceeds bounded path budget');
  return [...entries.values()];
}
