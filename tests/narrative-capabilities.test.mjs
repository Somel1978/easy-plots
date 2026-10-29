import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NARRATIVE_CAPABILITY_DEFS,NARRATIVE_NODE_DEFAULTS,validateNarrativeCapability,createNarrativeCapabilityProviders} from '../src/runtime/narrative-capabilities.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {EffectCoordinator} from '../src/runtime/effects.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';

const create=()=>{
  const repository=new MemoryPartitionRepository();
  const context=createLocalGMContext({user:{id:'gm-narrative',isGM:true}},'test-world');
  const gmProvider=()=>context,providers=new EffectProviderRegistry();
  for(const provider of createNarrativeCapabilityProviders({repository,gmProvider}))providers.register(provider);
  return {repository,gmProvider,context,providers,journal:new MemoryOperationJournal()};
};
const operation=(type,n,payload)=>({idempotencyKey:`narrative-${n}`,operationId:`ep:operation:narrative_${n}`,sourceEventId:`ep:event:narrative_${n}`,providerId:type,payload,graphId:'ep:graph:narrative_1',nodeId:'ep:node:narrative_1'});
for(const [index,def] of NARRATIVE_CAPABILITY_DEFS.entries()){
  test(`${def.type} typed native-backed provider applies, verifies, and resists duplicate effects`,async()=>{
    const s=create(),payload=structuredClone(NARRATIVE_NODE_DEFAULTS[def.nodeType]);
    const provider=s.providers.get(def.providerId);
    assert.deepEqual(provider.validate(payload),{...payload,visibility:'gm-only'});
    const effect=new EffectCoordinator({journal:s.journal,providers:s.providers});
    const first=operation(def.providerId,`cap_${index}_one`,payload);
    assert.equal((await effect.execute(first,s.context)).status,'completed');
    assert.equal((await effect.execute(first,s.context)).status,'already-completed');
    const stored=await provider.get(payload);
    assert.equal(stored.kind,def.canonical?.type??`cap-${def.type}`);
    assert.equal(stored.visibility,'gm-only');
    assert.equal(stored.lastOperationId,first.operationId);
    await assert.rejects(()=>provider.apply({...payload,visibility:'published'},
      {operationId:`ep:operation:cap_${index}_two`,sourceEventId:`ep:event:cap_${index}_two`}),{code:'CAPABILITY_DISCLOSURE'});
  });
  test(`${def.nodeType} publishes, routes, approves and persists an effect`,async()=>{
    const s=create(),base=new PersistentGraphRegistry({repository:s.repository,gmProvider:s.gmProvider}),catalog=new ActiveTriggerCatalog({repository:s.repository,gmProvider:s.gmProvider}),registry=new IndexedGraphRegistry({registry:base,catalog}),ledger=new DurableEventLedger({repository:s.repository,gmProvider:s.gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider:s.gmProvider});
    const editor=new GraphEditorModel({registry}),g=editor.newGraph('Narrative capabilities'),node=editor.addNode(def.nodeType);
    editor.connect(g.rootNodeId,node);
    await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
    const eventId=`ep:event:cap_route_${index}_0000`;
    assert.equal((await router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}})).status,'review-required');
    const p=(await ledger.get(eventId)).proposals[0];assert.equal(p.providerId,def.providerId);
    const review=new DurableProposalReview({repository:s.repository,ledger,registry,providers:s.providers,journal:s.journal,gmProvider:s.gmProvider});
    await review.decide(eventId,p.operationId,{approve:true});
    assert.equal((await review.execute(eventId,p.operationId)).status,'completed');
    assert.equal((await s.providers.get(def.providerId).get(p.payload)).lastOperationId,p.operationId);
  });
}
test('capability contracts reject unknown fields, unknown visibility, invalid world times and dangling ids',()=>{
  const base=structuredClone(NARRATIVE_NODE_DEFAULTS['core.faction.membership']);
  assert.throws(()=>validateNarrativeCapability('narrative.faction-membership',{...base,gmOnlyMetadata:'secret'}),{code:'CAPABILITY_FIELD'});
  assert.throws(()=>validateNarrativeCapability('narrative.faction-membership',{...base,memberId:'unscoped'}),{code:'INVALID_ID'});
  const time=structuredClone(NARRATIVE_NODE_DEFAULTS['core.npc.schedule']);
  assert.throws(()=>validateNarrativeCapability('narrative.npc-schedule',{...time,dueWorldTime:-1}),{code:'CAPABILITY_TIME'});
  const clock=structuredClone(NARRATIVE_NODE_DEFAULTS['core.pressure.clock']);
  assert.throws(()=>validateNarrativeCapability('narrative.pressure-clock',{...clock,ticks:7,maxTicks:6}),{code:'CLOCK_RANGE'});
});
test('updated clock respects revisions, forbids decreases and preserves provenance',async()=>{
  const s=create(),p=s.providers.get('narrative.pressure-clock'),first=structuredClone(NARRATIVE_NODE_DEFAULTS['core.pressure.clock']);
  await p.apply(first,{operationId:'ep:operation:clock_first',sourceEventId:'ep:event:clock_first'});
  await assert.rejects(()=>p.apply({...first,ticks:2},{operationId:'ep:operation:clock_stale',sourceEventId:'ep:event:clock_stale'}),{code:'REVISION_CONFLICT'});
  const next={...first,ticks:2,expectedRevision:1};
  await p.apply(next,{operationId:'ep:operation:clock_next',sourceEventId:'ep:event:clock_next'});
  await assert.rejects(()=>p.apply({...next,ticks:1,expectedRevision:2},{operationId:'ep:operation:clock_back',sourceEventId:'ep:event:clock_back'}),{code:'CLOCK_REVIEW'});
});
test('historical contributions cannot be overwritten with new operations',async()=>{
  const s=create(),p=s.providers.get('narrative.investigation-contribution'),payload=structuredClone(NARRATIVE_NODE_DEFAULTS['core.investigation.contribution']);
  await p.apply(payload,{operationId:'ep:operation:contrib_once',sourceEventId:'ep:event:contrib_once'});
  await assert.rejects(()=>p.apply({...payload,expectedRevision:1},{operationId:'ep:operation:contrib_twice',sourceEventId:'ep:event:contrib_twice'}),{code:'IMMUTABLE_RECORD'});
});
