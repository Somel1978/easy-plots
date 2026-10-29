import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {EffectCoordinator} from '../src/runtime/effects.mjs';
import {createExtendedDomainProviders} from '../src/runtime/extended-providers.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {DOMAIN_EFFECT_NODE_PROVIDER,DOMAIN_NODE_DEFAULTS} from '../src/graph/node-catalog.mjs';
function env(){
  const repository=new MemoryPartitionRepository(),gm=createLocalGMContext({user:{id:'gm1',isGM:true}},'world');
  const gmProvider=()=>gm,providers=new EffectProviderRegistry();
  for(const p of createExtendedDomainProviders({repository,gmProvider}))providers.register(p);
  return {repository,gm,gmProvider,providers,journal:new MemoryOperationJournal()};
}
const spec=(providerId,payload,n)=>({operationId:`ep:operation:ext_${n}abc123`,idempotencyKey:`extended:${n}`,
  sourceEventId:`ep:event:extended_${n}abc123`,providerId,payload,graphId:'ep:graph:ext',nodeId:'ep:node:ext'});
const scenarios=[
  ['narrative.record-world-fact','core.world.fact'],
  ['narrative.set-relationship','core.relationship.transition'],
  ['narrative.record-observer-belief','core.knowledge.belief'],
  ['narrative.transition-objective','core.quest.objective'],
  ['narrative.record-disclosure','core.knowledge.disclose'],
  ['narrative.finalize-arc','core.arc.conclude'],
  ['narrative.transition-story-hook','core.story.hook'],
  ['narrative.transition-scheduled-action','core.time.scheduled-action']
];
for(const [providerId,nodeType] of scenarios){
  test(`${providerId}: exact approved effect, verified read and duplicate protection`,async()=>{
    const s=env(),payload=structuredClone(DOMAIN_NODE_DEFAULTS[nodeType]);
    const coordinator=new EffectCoordinator({journal:s.journal,providers:s.providers});
    const operation=spec(providerId,payload,nodeType.replaceAll('.','_'));
    assert.equal((await coordinator.execute(operation,s.gm)).status,'completed');
    assert.equal((await coordinator.execute(operation,s.gm)).status,'already-completed');
    const row=await s.providers.get(providerId).get(payload);
    assert.equal(row.lastOperationId,operation.operationId);
    assert.equal(row.visibility,'gm-only');
    await assert.rejects(()=>s.providers.get(providerId).apply(payload,{operationId:'ep:operation:other123',sourceEventId:'ep:event:another123'}));
  });
  test(`${nodeType}: graph publication → event → persistent review → effect`,async()=>{
    const s=env();const base=new PersistentGraphRegistry({repository:s.repository,gmProvider:s.gmProvider});
    const catalog=new ActiveTriggerCatalog({repository:s.repository,gmProvider:s.gmProvider});
    const registry=new IndexedGraphRegistry({registry:base,catalog});const ledger=new DurableEventLedger({repository:s.repository,gmProvider:s.gmProvider});
    const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider:s.gmProvider});
    const editor=new GraphEditorModel({registry});const graph=editor.newGraph('Extended domain integration');
    const nodeId=editor.addNode(nodeType);editor.connect(graph.rootNodeId,nodeId);
    await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
    const eventId=`ep:event:integration_${nodeType.replaceAll('.','_')}`;
    assert.equal((await router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true}})).status,'review-required');
    const entry=await ledger.get(eventId);assert.equal(entry.proposals.length,1);
    assert.equal(entry.proposals[0].providerId,providerId);
    const review=new DurableProposalReview({repository:s.repository,ledger,registry,providers:s.providers,journal:s.journal,gmProvider:s.gmProvider});
    const p=entry.proposals[0];assert.equal(await s.providers.get(providerId).get(p.payload),null);
    await review.decide(eventId,p.operationId,{approve:true});
    assert.equal((await review.execute(eventId,p.operationId)).status,'completed');
    assert.equal((await review.get(eventId,p.operationId)).state,'completed');
  });
}
test('world fact revisions update under compare-and-swap, never under stale proposals',async()=>{
  const s=env(),provider=s.providers.get('narrative.record-world-fact');
  const p=structuredClone(DOMAIN_NODE_DEFAULTS['core.world.fact']);
  const first=spec(provider.id,p,'fact-one');assert.equal((await new EffectCoordinator({journal:s.journal,providers:s.providers}).execute(first,s.gm)).status,'completed');
  const revision=(await provider.get(p)).revision;
  const next={...p,value:'The manifest was falsified',expectedRevision:revision};
  const second=spec(provider.id,next,'fact-two');assert.equal((await new EffectCoordinator({journal:s.journal,providers:s.providers}).execute(second,s.gm)).status,'completed');
  assert.equal((await provider.get(next)).data.value,'The manifest was falsified');
  await assert.rejects(()=>provider.apply({...p,value:'different'},{operationId:'ep:operation:stale123',sourceEventId:'ep:event:stale123'}),{code:'REVISION_CONFLICT'});
});
test('objective transitions check from-state, protected beliefs keep observer identity',async()=>{
  const s=env(),objective=s.providers.get('narrative.transition-objective');
  const p=structuredClone(DOMAIN_NODE_DEFAULTS['core.quest.objective']);
  await objective.apply(p,{operationId:'ep:operation:obj_first',sourceEventId:'ep:event:obj_first'});
  await assert.rejects(()=>objective.apply({...p,state:'completed',expectedRevision:1,previousState:'pending'},
    {operationId:'ep:operation:obj_second',sourceEventId:'ep:event:obj_second'}),{code:'STATE_CONFLICT'});
  const belief=s.providers.get('narrative.record-observer-belief');const b=structuredClone(DOMAIN_NODE_DEFAULTS['core.knowledge.belief']);
  await belief.apply(b,{operationId:'ep:operation:bel_first',sourceEventId:'ep:event:bel_first'});
  await assert.rejects(()=>belief.apply({...b,observerId:'ep:actor:other_001',expectedRevision:1},
    {operationId:'ep:operation:bel_second',sourceEventId:'ep:event:bel_second'}),{code:'BELIEF_IDENTITY'});
});
test('invalid protected payloads fail before any effect',()=>{
  const s=env();const belief=s.providers.get('narrative.record-observer-belief');
  assert.throws(()=>belief.validate({...DOMAIN_NODE_DEFAULTS['core.knowledge.belief'],visibility:'published'}),{code:'DOMAIN_VISIBILITY'});
  assert.throws(()=>s.providers.get('narrative.record-disclosure').validate({...DOMAIN_NODE_DEFAULTS['core.knowledge.disclose'],recipientIds:[]}),{code:'DOMAIN_PAYLOAD'});
  assert.throws(()=>s.providers.get('narrative.finalize-arc').validate({...DOMAIN_NODE_DEFAULTS['core.arc.conclude'],openThreadIds:['unscoped']}),{code:'INVALID_ID'});
});
