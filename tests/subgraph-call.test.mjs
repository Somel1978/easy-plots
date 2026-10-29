import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {createNarrativeCapabilityProviders} from '../src/runtime/narrative-capabilities.mjs';
const env=()=>{
 const repository=new MemoryPartitionRepository(),gm=createLocalGMContext({user:{id:'gm1',isGM:true}},'w1'),gmProvider=()=>gm;
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({registry:new PersistentGraphRegistry({repository,gmProvider}),catalog});
 const ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 const providers=new EffectProviderRegistry();for(const p of createNarrativeCapabilityProviders({repository,gmProvider}))providers.register(p);
 const journal=new MemoryOperationJournal(),reviews=new DurableProposalReview({repository,ledger,registry,providers,journal,gmProvider});
 return {repository,gmProvider,registry,ledger,router,providers,journal,reviews};
};
async function childGraph(s){
 const model=new GraphEditorModel({registry:s.registry}),g=model.newGraph('Child plot');
 const effect=model.addNode('core.pressure.clock');model.connect(g.rootNodeId,effect);
 await model.save();await model.publish();return g.id;
}
async function parentGraph(s,childId,version=1){
 const model=new GraphEditorModel({registry:s.registry}),g=model.newGraph('Parent plot');
 const call=model.addNode('core.subgraph.call');model.updateSelected({payloadJSON:JSON.stringify({graphId:childId,publishedVersion:version})});
 model.connect(g.rootNodeId,call);await model.save();const published=await model.publish();await model.activate(published.publishedVersion);
 return {graphId:g.id,call};
}
const fire=(s,id)=>s.router.ingest({id,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}});
test('parent invokes published inactive subgraph with inherited causal event and verified GM effect',async()=>{
 const s=env(),childId=await childGraph(s),parent=await parentGraph(s,childId);
 const eventId='ep:event:subgraph_valid_001';const result=await fire(s,eventId);
 assert.equal(result.status,'review-required');assert.equal(result.proposals,1);
 const p=(await s.ledger.get(eventId)).proposals[0];
 assert.equal(p.providerId,'narrative.pressure-clock');assert.equal(p.graphId,childId);
 assert.equal(p.rootGraphId,parent.graphId);assert.equal(p.callChain.length,1);
 assert.equal(p.callChain[0].callNodeId,parent.call);
 assert.equal(await s.providers.get(p.providerId).get(p.payload),null);
 await s.reviews.decide(eventId,p.operationId,{approve:true});
 assert.equal((await s.reviews.execute(eventId,p.operationId)).status,'completed');
 assert.equal((await s.providers.get(p.providerId).get(p.payload)).lastOperationId,p.operationId);
});
test('nested proposal cannot be approved after root is deactivated',async()=>{
 const s=env(),childId=await childGraph(s),parent=await parentGraph(s,childId);
 const eventId='ep:event:subgraph_stale_001';await fire(s,eventId);
 const p=(await s.ledger.get(eventId)).proposals[0];
 const activation=await s.registry.getActivation(parent.graphId);
 await s.registry.deactivate(parent.graphId,{expectedActivationRevision:activation.revision});
 await assert.rejects(()=>s.reviews.decide(eventId,p.operationId,{approve:true}),{code:'PUBLISHED_REVISION_STALE'});
});
test('missing published subgraph leaves event in uncertain state without effects',async()=>{
 const s=env();await parentGraph(s,'ep:graph:not_published_001');
 const result=await fire(s,'ep:event:subgraph_missing_001');
 assert.equal(result.status,'uncertain');assert.equal(result.reason,'SUBGRAPH_UNAVAILABLE');
});
test('direct self calls blocked on publication, indirect recursion blocked at runtime',async()=>{
 const s=env(),model=new GraphEditorModel({registry:s.registry}),graph=model.newGraph('Self recursion');
 model.addNode('core.subgraph.call');model.updateSelected({payloadJSON:JSON.stringify({graphId:graph.id,publishedVersion:1})});model.connect(graph.rootNodeId,model.selectedNode.id);
 await assert.rejects(()=>model.save(),{code:'SUBGRAPH_RECURSION'});
 // A -> B -> A is possible with independently immutable revisions; runtime must detect it.
 const child=await childGraph(s),parent=await parentGraph(s,child);
 const childDraft=await s.registry.getDraft(child);
 const editor=new GraphEditorModel({registry:s.registry});await editor.load(child);editor.addNode('core.subgraph.call');
 editor.updateSelected({payloadJSON:JSON.stringify({graphId:parent.graphId,publishedVersion:1})});
 editor.connect(childDraft.rootNodeId,editor.selectedNode.id);
 await editor.save();await editor.publish();
 // Parent must call the NEW child revision to create the cycle.
 const pm=new GraphEditorModel({registry:s.registry});await pm.load(parent.graphId);
 const c=pm.graph.nodes.find(n=>n.typeId==='core.subgraph.call');pm.selectNode(c.id);
 pm.updateSelected({payloadJSON:JSON.stringify({graphId:child,publishedVersion:2})});await pm.save();await pm.publish();
 const a=await s.registry.getActivation(parent.graphId);await s.registry.activate(parent.graphId,2,{expectedActivationRevision:a.revision});
 // Immutable revisions do not make recursive graph relationships safe.
 const result=await fire(s,'ep:event:subgraph_bounded_001');assert.equal(result.status,'uncertain');assert.equal(result.reason,'SUBGRAPH_RECURSION');
});
test('subgraph authoring rejects unknown payload keys and non-integer versions',()=>{
 const s=env(),model=new GraphEditorModel({registry:s.registry});model.newGraph('Child links');model.addNode('core.subgraph.call');
 assert.throws(()=>model.updateSelected({payloadJSON:JSON.stringify({graphId:'ep:graph:other_001',publishedVersion:0})}),{code:'SUBGRAPH_CONTRACT'});
 assert.throws(()=>model.updateSelected({payloadJSON:JSON.stringify({graphId:'ep:graph:other_001',publishedVersion:1,elevated:true})}),{code:'SUBGRAPH_CONTRACT'});
});
