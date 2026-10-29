import {EasyPlotsError} from '../contracts/errors.mjs';
/** Add an independent reviewed-intent branch; preserve the story root and all
 * existing nodes. Publication revision values come from the verified event. */
export function configureResourceActivationBranch(model,manifest){
 const d=manifest?.data;if(d?.schemaVersion!==1||model?.graph?.id!==d.spec.graphId)throw new EasyPlotsError('RESOURCE_GRAPH','Open the manifest target draft before configuring its activation branch');
 const existing=model.graph.nodes.find(n=>n.typeId==='core.resource.activate-manifest'&&n.data.payload?.manifestId===manifest.id&&n.data.payload?.scope===manifest.scope);if(existing)return existing.id;
 const trigger=model.addNode('core.trigger.resource-activation'),condition=model.addNode('core.condition');
 model.updateSelected({conditionJSON:JSON.stringify({op:'all',terms:[['scope',manifest.scope],['manifestId',manifest.id],['graphId',d.spec.graphId]].map(([key,value])=>({op:'compare',operator:'eq',left:{type:'reference',path:['event',key],requiredPermission:'gm-secret'},right:{type:'literal',value}}))})});
 const effect=model.addNode('core.resource.activate-manifest');model.updateSelected({payloadJSON:JSON.stringify({scope:manifest.scope,manifestId:manifest.id,expectedManifestRevision:1,graphId:d.spec.graphId,publishedVersion:1,expectedActivationRevision:1})});model.connect(trigger,condition);model.connect(condition,effect);
 for(const field of ['expectedManifestRevision','publishedVersion','expectedActivationRevision']){const source=model.addNode('core.data.event');model.updateSelected({payloadJSON:JSON.stringify({valueType:'number',path:['payload',field]})});model.selectNode(effect);model.bindSelectedInput({field,sourceNodeId:source});}model.selectNode(effect);return effect;
}
