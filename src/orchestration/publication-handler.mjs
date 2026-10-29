import {GraphEditorModel} from '../editor/model.mjs';
/** Creates a draft only. Publication and activation remain explicit GM actions. */
export async function preparePublicationHandlerDraft({registry,mode='native',extensions}={}){
 const model=new GraphEditorModel({registry,mode,extensions});model.newGraph('Publish protected knowledge');model.setRootTriggerType('core.trigger.manual');model.updateSelected({eventType:'narrative.publication-reviewed'});
 const bindings={};
 for(const [field,valueType] of [['scope','string'],['publicationId','entity'],['expectedPublicationRevision','number']]){
  bindings[field]=model.addNode('core.data.event');model.updateSelected({payloadJSON:JSON.stringify({valueType,path:['payload',field]})});
 }
 const effect=model.addNode('core.knowledge.publish-native');
 for(const [field,sourceNodeId] of Object.entries(bindings))model.bindSelectedInput({field,sourceNodeId});
 model.connect(model.graph.rootNodeId,effect);await model.save();return {graphId:model.graph.id};
}
