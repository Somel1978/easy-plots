import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NativeReverseReferenceLedger} from '../src/storage/native-reverse-references.mjs';
import {createFoundryResourceBindingProvider,nativeBindingLookupLocator} from '../src/platform/foundry-resource-binding.mjs';
import {createNativeReferenceEffectProvider,validateNativeReferenceEffect} from '../src/runtime/reverse-reference-provider.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
const nativeId='abcdefghijklmnop',nativeUuid=`Actor.${nativeId}`;
const payload=(sourceGraphId)=>({scope:'world',resourceId:'ep:resource:relic_001',sourceGraphId,
 documentKind:'Actor',nativeId,previousNativeId:null,action:'bind',ownership:'borrowed',
 expectedRevision:null,visibility:'gm-only'});
const linkPayload={scope:'world',resourceId:'ep:resource:relic_001',dependentId:'ep:node:quest_001',
 nativeUuid,action:'link',expectedRevision:null,visibility:'gm-only'};
const gm=createLocalGMContext({user:{id:'gm-link-01',isGM:true}},'world-1');
test('binding and reverse-reference node effects require independent GM approvals and durable journals',async()=>{
 const repository=new MemoryPartitionRepository(),journal=new MemoryOperationJournal(),gmProvider=()=>gm;
 const gameInstance={actors:{get:id=>id===nativeId?{id}:null},items:{get:()=>null},journal:{get:()=>null}};
 const writer={assertEligible:g=>assert.equal(g.userId,gm.userId)};
 const binding=createFoundryResourceBindingProvider({repository,gmProvider,gameInstance,writer});
 const reverse=new NativeReverseReferenceLedger({repository,gmProvider,resolveBinding:async({scope,resourceId})=>{
   const loc=await nativeBindingLookupLocator({scope,resourceId});return repository.read(loc.id,{partitionId:loc.partitionId,gm});
 }});
 const providers=new EffectProviderRegistry();providers.register(binding);
 providers.register(createNativeReferenceEffectProvider({ledger:reverse,gmProvider}));
 const raw=new PersistentGraphRegistry({repository,gmProvider}),catalog=new ActiveTriggerCatalog({repository,gmProvider});
 const registry=new IndexedGraphRegistry({registry:raw,catalog}),ledger=new DurableEventLedger({repository,gmProvider});
 const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider}),editor=new GraphEditorModel({registry});
 const graph=editor.newGraph('Safe native references');
 const bindId=editor.addNode('core.resource.bind-native');editor.updateSelected({payloadJSON:JSON.stringify(payload(graph.id))});
 const refId=editor.addNode('core.resource.track-reference');editor.updateSelected({payloadJSON:JSON.stringify(linkPayload)});
 editor.connect(graph.rootNodeId,bindId);editor.connect(graph.rootNodeId,refId);
 await editor.save();const publication=await editor.publish();await editor.activate(publication.publishedVersion);
 const eventId='ep:event:reference_graph_001';
 assert.equal((await router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}})).status,'review-required');
 const proposals=(await ledger.get(eventId)).proposals;
 assert.equal(proposals.length,2);
 const bindingProposal=proposals.find(p=>p.providerId===binding.id);
 const linkProposal=proposals.find(p=>p.providerId==='narrative.track-native-reference');
 const reviews=new DurableProposalReview({repository,ledger,registry,providers,journal,gmProvider});
 assert.equal((await reverse.listForNative({scope:'world',nativeUuid})).items.length,0);
 await reviews.decide(eventId,linkProposal.operationId,{approve:true});
 assert.equal((await reviews.execute(eventId,linkProposal.operationId)).status,'uncertain');
 await reviews.decide(eventId,bindingProposal.operationId,{approve:true});
 assert.equal((await reviews.execute(eventId,bindingProposal.operationId)).status,'completed');
 // A distinct explicitly approved event (not blind replay of the uncertain
 // attempt) is required to make a new reverse link.
 assert.equal((await reverse.listForNative({scope:'world',nativeUuid})).items.length,0);
});
test('reverse-reference graph payload rejects unsupported scopes, actions and public records',()=>{
 assert.throws(()=>validateNativeReferenceEffect({...linkPayload,visibility:'published'}),{code:'REF_EFFECT_POLICY'});
 assert.throws(()=>validateNativeReferenceEffect({...linkPayload,action:'delete'}),{code:'REF_EFFECT_POLICY'});
 assert.throws(()=>validateNativeReferenceEffect({...linkPayload,rawDocument:{name:'hidden'}}),{code:'REF_EFFECT_FIELD'});
});
