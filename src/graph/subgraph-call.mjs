/** Explicit immutable subgraph invocation contract. No cross-world graph imports. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
export function validateSubgraphCall(data,{parentGraphId=null}={}){
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!['graphId','publishedVersion'].includes(k)))
    fail('SUBGRAPH_CONTRACT','Subgraph call has an invalid set of fields');
  assertNarrativeId(data.graphId);
  if(!data.graphId.startsWith('ep:graph:')||!Number.isSafeInteger(data.publishedVersion)||data.publishedVersion<1)
    fail('SUBGRAPH_CONTRACT','Published graph ID and positive immutable version required');
  if(data.graphId===parentGraphId)fail('SUBGRAPH_RECURSION','Direct self-call is forbidden');
  return true;
}
