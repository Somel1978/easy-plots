/** Exact immutable setup sources; live resource existence is checked separately
 * when an operation is approved/executed. Publishing never creates resources. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {contractHash} from '../graph/dependency-contracts.mjs';
import {effectProviderId} from '../graph/graph-dependencies.mjs';
import {NATIVE_BATCH_PROVIDER} from '../runtime/native-batch-provider.mjs';
import {RESOURCE_ACTIVATION_PROVIDER} from '../runtime/resource-manifest-provider.mjs';
const native=new Set([NATIVE_BATCH_PROVIDER,RESOURCE_ACTIVATION_PROVIDER]);
export function createNativeSourcePreflight({batches,manifests,providers}={}){
 const get=value=>typeof value==='function'?value():value;
 const inspect=async({node,graph,providerId})=>{
  if(!native.has(providerId))return null;const p=node.data?.payload;let source,id,version,steps=[];
  if(providerId===NATIVE_BATCH_PROVIDER){const plan=await get(batches).read({scope:p.scope,id:p.batchId});if(!plan||plan.revision!==p.expectedBatchRevision||plan.data.fingerprint!==p.batchFingerprint||plan.data.graphId!==graph.id)throw new EasyPlotsError('NATIVE_BATCH_STALE','The immutable batch must belong to this exact graph');source={scope:plan.scope,id:plan.id,revision:plan.revision,fingerprint:plan.data.fingerprint};id=`batch:${p.scope}:${plan.id}`;version=String(plan.revision);steps=plan.data.steps;}
  else{const row=await get(manifests).read({scope:p.scope,id:p.manifestId});if(!row||row.data.schemaVersion!==1||row.data.spec.graphId!==graph.id||p.graphId!==graph.id)throw new EasyPlotsError('RESOURCE_PLAN_STALE','A reviewed lifecycle manifest for this exact graph is required');source={scope:row.scope,id:row.id,specFingerprint:row.data.specFingerprint};id=`manifest:${p.scope}:${row.id}`;version='1';const plan=await get(batches).read({scope:p.scope,id:row.data.spec.batch.id});if(!plan||plan.revision!==row.data.spec.batch.revision||plan.data.fingerprint!==row.data.spec.batch.fingerprint)throw new EasyPlotsError('RESOURCE_BATCH_STALE','Exact original materialization plan is unavailable');steps=plan.data.steps;source={...source,batch:{id:plan.id,revision:plan.revision,fingerprint:plan.data.fingerprint}};}
  const dependencies=[{kind:'external',id,version,fingerprint:contractHash(source)}];for(const step of steps){const provider=get(providers).get(step.providerId),contract=get(providers).contract(step.providerId);if(!provider||provider.version!==step.providerVersion)throw new EasyPlotsError('NATIVE_BATCH_CAPABILITY','Batch child contract changed');provider.validate(step.payload);dependencies.push({kind:'provider',...contract});}return {dependencies,issues:[]};
 };
 return {externalDependencies:inspect,externalChecks:async({graph})=>{const nodes=graph.nodes.filter(n=>native.has(effectProviderId(n))),issues=[];let checked=0;for(const node of nodes)try{await inspect({node,graph,providerId:effectProviderId(node)});checked++;}catch(e){issues.push({severity:'blocker',code:e.code??'NATIVE_SOURCE_UNAVAILABLE',nodeId:node.id,message:e.message,remediation:'Restore the reviewed immutable native setup source and validate again.'});}return {issues,coverage:[{id:'native-source-contracts',status:checked===nodes.length?'passed':'blocked',checked,total:nodes.length}]};}};
}
