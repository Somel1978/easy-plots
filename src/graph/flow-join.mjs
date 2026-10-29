/** Explicit AND/OR fan-in for acyclic narrative flow. The all-mode has no
 * hidden timeout: if any authored incoming path does not execute, its output
 * remains blocked. Neither mode repeats a converged node or executes effects.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
export const FLOW_JOIN_TYPE='core.flow.join';
export function validateFlowJoin(node,{incoming=null}={}){
 const data=node?.data;
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==1||
   !['all','any'].includes(data.mode))throw new EasyPlotsError('FLOW_JOIN_CONTRACT','Join requires an explicit all/any mode');
 if(incoming!==null&&(!Number.isSafeInteger(incoming)||incoming<1||
   (data.mode==='all'&&incoming<2)))
  throw new EasyPlotsError('FLOW_JOIN_INPUTS','Join requires one or more input paths; all requires at least two');
 return true;
}
