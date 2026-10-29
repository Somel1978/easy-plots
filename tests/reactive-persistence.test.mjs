import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry,subscriptionLocator,graphEventTypes} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger,eventLocator} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {graph} from './fixtures.mjs';

function setup({repository=new MemoryPartitionRepository(),user={id:'gm-1',isGM:true}}={}){
  const ctx=createLocalGMContext({user,epoch:'test'},'sandbox');
  const gmProvider=()=>ctx;
  const published=new PersistentGraphRegistry({repository,gmProvider});
  const index=new ActiveTriggerCatalog({repository,gmProvider});
  const registry=new IndexedGraphRegistry({registry:published,catalog:index});
  const ledger=new DurableEventLedger({repository,gmProvider});
  const router=new DurableReactiveRouter({registry,catalog:index,ledger,gmProvider});
  return {repository,registry,published,index,ledger,router,ctx,gmProvider};
}
function sourceEvent(id='ep:event:some_event_001',verified=true){
  return {id,eventType:'evidence.discovered',source:{kind:'test-fixture',testId:'contract'},payload:{verified}};
}
async function activate(env,g=graph()){
  const draft=await env.registry.saveDraft(g);
  const pub=await env.registry.publish(g.id,{expectedRevision:draft.revision});
  const active=await env.registry.activate(g.id,pub.publishedVersion,{expectedActivationRevision:null});
  return {draft,pub,active};
}

test('staging subscriptions and activation uses the same bounded repository',async()=>{
  const env=setup();const {active}=await activate(env);
  assert.equal(active.publishedVersion,1);
  assert.deepEqual(await env.index.lookup('evidence.discovered'),[{graphId:graph().id,publishedVersion:1}]);
  assert.equal(env.repository.instrumentation.partitionCount,4);
});

test('published-only graphs do not subscribe before activation',async()=>{
  const env=setup();const g=graph();await env.registry.saveDraft(g);await env.registry.publish(g.id,{expectedRevision:1});
  assert.deepEqual(await env.index.lookup('evidence.discovered'),[]);
  assert.equal(await env.registry.getActive(g.id),null);
});

test('subscription catalog prohibits invalid event types and scope',async()=>{
  const env=setup();
  await assert.rejects(env.index.lookup('Secret data; alert(1)'),{code:'INVALID_EVENT_TYPE'});
  await assert.rejects(subscriptionLocator('evidence.discovered','../'),{code:'INVALID_SCOPE'});
  assert.throws(()=>graphEventTypes({...graph(),nodes:[{typeId:'core.trigger.event',data:{eventType:'bad type'}}]}),{code:'INVALID_EVENT_TYPE'});
});

test('stage is idempotent by graph identifier with version replacement',async()=>{
  const env=setup();const g=graph();
  await env.index.stage({...g,publishedVersion:1});
  await env.index.stage({...g,publishedVersion:1});
  await env.index.stage({...g,publishedVersion:2});
  assert.deepEqual(await env.index.lookup('evidence.discovered'),[{graphId:g.id,publishedVersion:2}]);
});

test('stale revision subscription never evaluates the old graph',async()=>{
  const env=setup();const {pub}=await activate(env);
  // Edit and activate version 2 with eventType changed. The old event type
  // must never dispatch version 1, even if its index is stale.
  const newer=graph();newer.nodes[0].data.eventType='foundry.actor.updated';
  await env.registry.saveDraft(newer,{expectedRevision:1});
  await env.registry.publish(newer.id,{expectedRevision:2});
  await env.registry.activate(newer.id,2,{expectedActivationRevision:1});
  const old=await env.router.ingest(sourceEvent('ep:event:stale_version_001'));
  assert.equal(old.status,'no-subscribers');
  assert.equal((await env.registry.getActive(newer.id)).publishedVersion,2);
  assert.equal(pub.publishedVersion,1);
});

test('stale index entries cannot dispatch if graph is deactivated',async()=>{
  const env=setup();await activate(env);
  const loc=await subscriptionLocator('evidence.discovered');
  const record=await env.repository.read(loc.id,{partitionId:loc.partitionId});
  await env.registry.deactivate(graph().id,{expectedActivationRevision:1});
  // Restore stale entry to simulate interrupted subscription cleanup.
  await env.repository.put(record,{expectedRevision:2});
  const result=await env.router.ingest(sourceEvent('ep:event:stale_inactive_001'));
  assert.equal(result.status,'evaluated');
  assert.equal(result.graphCount,0);
  assert.equal((await env.ledger.get(result.eventId)).proposals.length,0);
});

test('activation never occurs when subscription staging fails',async()=>{
  const memory=new MemoryPartitionRepository();
  const repo={
    read:(...args)=>memory.read(...args),query:(...args)=>memory.query(...args),
    put:(record,options)=>{
      if(record.kind==='event-subscriptions')throw Object.assign(new Error('simulated outage'),{code:'INDEX_OUTAGE'});
      return memory.put(record,options);
    }
  };
  const env=setup({repository:repo});
  await env.registry.saveDraft(graph());await env.registry.publish(graph().id,{expectedRevision:1});
  await assert.rejects(env.registry.activate(graph().id,1,{expectedActivationRevision:null}),{code:'INDEX_OUTAGE'});
  assert.equal(await env.registry.getActive(graph().id),null);
});

test('tampered index metadata fails closed before loading subscribers',async()=>{
  const env=setup();await activate(env);
  const loc=await subscriptionLocator('evidence.discovered');
  const record=await env.repository.read(loc.id,{partitionId:loc.partitionId});
  await env.repository.put({...record,eventType:'fabricated.other'},{expectedRevision:record.revision});
  await assert.rejects(env.router.subscribed('evidence.discovered'),{code:'SUBSCRIPTION_CORRUPT'});
});

test('durable ledger acknowledges once, stores source and verifies transitions',async()=>{
  const env=setup();const e=sourceEvent();
  const initial=await env.ledger.accept(e);assert.equal(initial.created,true);
  assert.equal(initial.record.state,'prepared');
  const duplicate=await env.ledger.accept(e);assert.equal(duplicate.created,false);
  const processing=await env.ledger.transition(e.id,'prepared','evaluating');
  assert.equal(processing.state,'evaluating');
  const done=await env.ledger.transition(e.id,'evaluating','review-required',{evaluations:[],proposals:[]});
  assert.equal(done.state,'review-required');
  await assert.rejects(env.ledger.transition(e.id,'prepared','evaluating'),{code:'EVENT_STATE_CONFLICT'});
});

test('durable ledger rejects event ID reuse with different payload',async()=>{
  const env=setup();await env.ledger.accept(sourceEvent());
  await assert.rejects(env.ledger.accept(sourceEvent(undefined,false)),{code:'EVENT_REUSE_CONFLICT'});
});

test('ledger never acknowledges a write without a read-back match',async()=>{
  const memory=new MemoryPartitionRepository();
  const repo={read:async()=>null,put:(...args)=>memory.put(...args)};
  const env=setup({repository:repo});
  await assert.rejects(env.ledger.accept(sourceEvent()),{code:'EVENT_NOT_DURABLE'});
});

test('accepted but incomplete event requires explicit recovery, never silent replay',async()=>{
  const env=setup();await activate(env);
  const event=sourceEvent('ep:event:interrupted_001');
  await env.ledger.accept(event);
  const result=await env.router.ingest(event);
  assert.equal(result.status,'duplicate-or-recovery-required');
  assert.equal(result.persistedState,'prepared');
  assert.equal((await env.ledger.get(event.id)).state,'prepared');
});

test('true condition creates a persisted GM-review proposal and never calls providers',async()=>{
  const env=setup();await activate(env);
  const result=await env.router.ingest(sourceEvent('ep:event:verified_001',true));
  assert.equal(result.status,'review-required');assert.equal(result.proposals,1);
  const stored=await env.ledger.get(result.eventId);
  assert.equal(stored.proposals[0].providerId,'narrative.set-state');
  assert.equal(stored.proposals[0].state,'requires-gm-approval');
  assert.equal(stored.evaluations.length,1);
  assert.equal((await env.router.ingest(sourceEvent('ep:event:verified_001',true))).status,'duplicate-or-recovery-required');
});

test('false condition evaluates without proposing any consequence',async()=>{
  const env=setup();await activate(env);
  const result=await env.router.ingest(sourceEvent('ep:event:unverified_001',false));
  assert.equal(result.status,'evaluated');assert.equal(result.proposals,0);
  assert.equal((await env.ledger.get(result.eventId)).proposals.length,0);
});

test('unsubscribed events do not hydrate graphs or create durable history',async()=>{
  const env=setup();await activate(env);
  const before=env.repository.instrumentation.readRequests;
  const e={...sourceEvent('ep:event:unrelated_001'),eventType:'irrelevant.nothing'};
  const result=await env.router.ingest(e);
  assert.equal(result.status,'no-subscribers');
  assert.ok(env.repository.instrumentation.readRequests-before<=1);
  assert.equal(await env.ledger.get(e.id),null);
});

test('event ledger uses targeted hashed shard, not all-event scans',async()=>{
  const env=setup();const e=sourceEvent();await env.ledger.accept(e);
  const loc=await eventLocator(e.id);
  const prefix=loc.partitionId.split(':').at(-1);
  const result=await env.ledger.listShard(prefix,{limit:16});
  assert.ok(result.items.some(row=>row.sourceEventId===e.id));
  await assert.rejects(env.ledger.listShard('whole-campaign'),{code:'INVALID_SCOPE'});
  await assert.rejects(env.ledger.listShard(prefix,{limit:200}),{code:'QUERY_BUDGET'});
});

test('GM authority is enforced by catalog, ledger, and router',async()=>{
  const repo=new MemoryPartitionRepository();const gmUser={id:'GM_1',isGM:true};
  const env=setup({repository:repo,user:gmUser});await activate(env);
  gmUser.isGM=false;
  await assert.rejects(env.index.lookup('evidence.discovered'),{code:'GM_AUTHORITY_REVOKED'});
  await assert.rejects(env.ledger.accept(sourceEvent()),{code:'GM_AUTHORITY_REVOKED'});
  await assert.rejects(env.router.ingest(sourceEvent()),{code:'GM_AUTHORITY_REVOKED'});
});

test('excess per-event subscriber count is rejected before write',async()=>{
  const env=setup();const g=graph();
  const limited=new ActiveTriggerCatalog({repository:env.repository,gmProvider:env.gmProvider,maxSubscriptions:1});
  await limited.stage({...g,publishedVersion:1});
  const g2={...g,id:'ep:graph:second_001',nodes:g.nodes.map(n=>({...n,graphId:'ep:graph:second_001'}))};
  await assert.rejects(limited.stage({...g2,publishedVersion:1}),{code:'SUBSCRIPTION_BUDGET'});
});

test('a failing condition remains an uncertain durable event without any effects',async()=>{
  const env=setup();const g=graph();g.nodes[1].data.condition={op:'provider-predicate',providerId:'unsupported'};
  await activate(env,g);
  const result=await env.router.ingest(sourceEvent('ep:event:predicate_001'));
  assert.equal(result.status,'uncertain');
  assert.equal((await env.ledger.get(result.eventId)).reason,'UNVERIFIED_PROVIDER');
});
