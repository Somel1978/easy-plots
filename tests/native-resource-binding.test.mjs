import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {createFoundryResourceBindingProvider,validateNativeBinding} from '../src/platform/foundry-resource-binding.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
const gm=createLocalGMContext({user:{id:'gm-native-bind',isGM:true}},'world-1');
const ids={old:'abcdefghijklmnop',next:'ponmlkjihgfedcba'};
const payload=(action='bind',changes={})=>({scope:'world',resourceId:'ep:resource:binding_001',sourceGraphId:'ep:graph:owner_001',
 documentKind:'Actor',nativeId:action==='detach'?null:action==='rebind'?ids.next:ids.old,
 previousNativeId:action==='bind'?null:ids.old,action,ownership:'borrowed',visibility:'gm-only',
 expectedRevision:action==='bind'?null:1,...changes});
const c=(operationId='ep:operation:native_bind_001')=>({operationId,sourceEventId:'ep:event:native_bind_0001'});
function fixture(){
  const actors=new Map([[ids.old,{id:ids.old}], [ids.next,{id:ids.next}]]),repository=new MemoryPartitionRepository();
  const gameInstance={actors:{get:id=>actors.get(id)},items:{get:()=>null},journal:{get:()=>null}};
  const writer={assertEligible:g=>assert.equal(g.userId,gm.userId)};
  const provider=createFoundryResourceBindingProvider({repository,gmProvider:()=>gm,gameInstance,writer});
  return {repository,provider,actors,gameInstance,writer};
}
test('Existing Actor bind preserves native document untouched and protected provenance',async()=>{
  const f=fixture(),before=structuredClone(f.actors.get(ids.old));
  const result=await f.provider.apply(payload(),c());
  assert.equal(result.revision,1);
  assert.deepEqual(f.actors.get(ids.old),before);
  const row=(await f.provider.inspect(payload())).row;
  assert.equal(row.status,'bound');assert.equal(row.nativeId,ids.old);assert.equal(row.visibility,'gm-only');
  assert.equal(await f.provider.verify(payload(),c()),true);
  assert.equal((await f.provider.apply(payload(),c())).alreadyApplied,true);
});
test('Rebind requires the expected old native ID and explicit record revision',async()=>{
  const f=fixture();await f.provider.apply(payload(),c());
  await assert.rejects(()=>f.provider.apply(payload('rebind',{previousNativeId:'aaaaaaaaaaaaaaaa'}),c('ep:operation:rebind_0002')),{code:'NATIVE_BINDING_STALE'});
  const rebound=await f.provider.apply(payload('rebind'),c('ep:operation:rebind_0002'));
  assert.equal(rebound.revision,2);
  assert.equal((await f.provider.inspect(payload('rebind'))).row.nativeId,ids.next);
});
test('Detach is revision-controlled and does not delete a native Actor',async()=>{
  const f=fixture();await f.provider.apply(payload(),c());
  await f.provider.apply(payload('detach'),c('ep:operation:detach_0002'));
  const row=(await f.provider.inspect(payload('detach'))).row;
  assert.equal(row.status,'detached');assert.equal(row.nativeId,null);
  assert.equal(f.actors.size,2);
});
test('Missing native target and compendium-pack bound document fail closed',async()=>{
  const f=fixture();f.actors.delete(ids.old);
  await assert.rejects(()=>f.provider.apply(payload(),c()),{code:'NATIVE_BINDING_TARGET_MISSING'});
  f.actors.set(ids.old,{id:ids.old,pack:'some-pack'});
  await assert.rejects(()=>f.provider.apply(payload(),c()),{code:'NATIVE_BINDING_TARGET_MISSING'});
});
test('Binding cannot change the identity, scope, authorization or ownership fields arbitrarily',()=>{
  assert.throws(()=>validateNativeBinding({...payload(),content:'the hidden answer'}),{code:'NATIVE_BINDING_FIELD'});
  assert.throws(()=>validateNativeBinding({...payload(),ownership:'exclusive'}),{code:'NATIVE_BINDING_POLICY'});
  assert.throws(()=>validateNativeBinding({...payload(),visibility:'published'}),{code:'NATIVE_BINDING_POLICY'});
  assert.throws(()=>validateNativeBinding({...payload(),previousNativeId:ids.next}),{code:'NATIVE_BINDING_POLICY'});
});
test('Published binding node emits an approved, journaled, protected native reference operation',async()=>{
  const f=fixture(),providers=new EffectProviderRegistry(),journal=new MemoryOperationJournal(),repository=f.repository,gmProvider=()=>gm;
  providers.register(f.provider);
  const raw=new PersistentGraphRegistry({repository,gmProvider});const catalog=new ActiveTriggerCatalog({repository,gmProvider});
  const registry=new IndexedGraphRegistry({registry:raw,catalog}),ledger=new DurableEventLedger({repository,gmProvider});
  const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});const editor=new GraphEditorModel({registry});
  const graph=editor.newGraph('Protected Actor reference'),id=editor.addNode('core.resource.bind-native');
  editor.updateSelected({payloadJSON:JSON.stringify({...payload(),sourceGraphId:graph.id})});editor.connect(graph.rootNodeId,id);
  await editor.save();const snapshot=await editor.publish();await editor.activate(snapshot.publishedVersion);
  const eventId='ep:event:native_binding_graph001';
  assert.equal((await router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}})).status,'review-required');
  const proposal=(await ledger.get(eventId)).proposals[0];
  assert.equal(proposal.providerId,'narrative.bind-native-reference');
  const review=new DurableProposalReview({repository,ledger,registry,providers,journal,gmProvider});
  await review.decide(eventId,proposal.operationId,{approve:true});
  const outcome=await review.execute(eventId,proposal.operationId);
  assert.equal(outcome.status,'completed');
  assert.equal((await f.provider.inspect({...payload(),sourceGraphId:graph.id})).row.nativeId,ids.old);
});
