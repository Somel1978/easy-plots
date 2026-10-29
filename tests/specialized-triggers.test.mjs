import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry,graphEventTypes} from '../src/runtime/active-subscriptions.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {validateEventTrigger,triggerAcceptsEvent} from '../src/graph/trigger-contract.mjs';
import {graph} from './fixtures.mjs';
function setup(){const repository=new MemoryPartitionRepository(),gmProvider=()=>createLocalGMContext({user:{id:'gm-001',isGM:true},epoch:'test'},'world');
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})}),ledger=new DurableEventLedger({repository,gmProvider});
 return {registry,catalog,ledger,router:new DurableReactiveRouter({catalog,registry,ledger,gmProvider})};}
function fixture(typeId,eventType,sourceKinds){const g=graph();g.nodes[0].typeId=typeId;g.nodes[0].data={eventType,sourceKinds};return g;}
async function activate(env,g){const saved=await env.registry.saveDraft(g);const published=await env.registry.publish(g.id,{expectedRevision:saved.revision});return env.registry.activate(g.id,published.publishedVersion,{expectedActivationRevision:null});}
test('specialized source kinds are validated at publication, not only dispatch',async()=>{
 const env=setup();const wrong=fixture('core.trigger.manual','narrative.manual',['native-hook']);
 await assert.rejects(env.registry.saveDraft(wrong),{code:'TRIGGER_CONTRACT'});
 const wrongDue=fixture('core.trigger.schedule-due','evidence.discovered',['gm-approved-intent']);
 await assert.rejects(env.registry.saveDraft(wrongDue),{code:'TRIGGER_CONTRACT'});
 assert.throws(()=>validateEventTrigger({typeId:'core.trigger.document-event',data:{eventType:'foundry.actor.updated',sourceKinds:[]}}),{code:'TRIGGER_CONTRACT'});
});
test('manual trigger subscribes and only accepts authentic manual request source',async()=>{
 const env=setup();const g=fixture('core.trigger.manual','narrative.manual',['gm-approved-intent']);await activate(env,g);
 assert.deepEqual(graphEventTypes(g),['narrative.manual']);
 const wrong={id:'ep:event:manual_wrong001',eventType:'narrative.manual',source:{kind:'native-hook',hook:'updateActor',documentUuid:'Actor.abcdefghijklmnop'},payload:{verified:true}};
 assert.equal(triggerAcceptsEvent(g.nodes[0],wrong),false);
 const r=await env.router.ingest(wrong);assert.equal(r.status,'evaluated');assert.equal(r.proposals,0);
 const good={id:'ep:event:manual_good001',eventType:'narrative.manual',source:{kind:'gm-approved-intent',requestId:'ep:request:manual001'},payload:{verified:true}};
 assert.equal(triggerAcceptsEvent(g.nodes[0],good),true);
 assert.equal((await env.router.ingest(good)).status,'review-required');
});
test('due trigger cannot be satisfied by manual forgery or a mismatched canonical schedule',async()=>{
 const env=setup();const g=fixture('core.trigger.schedule-due','narrative.schedule-due',['gm-approved-intent']);await activate(env,g);
 const bad={id:'ep:event:bad_due001',eventType:'narrative.schedule-due',source:{kind:'gm-approved-intent',requestId:'ep:request:manual_due'},payload:{scheduleId:'ep:scheduled:one001',verified:true,sourceRevision:1}};
 assert.equal(triggerAcceptsEvent(g.nodes[0],bad),false);
 assert.equal((await env.router.ingest(bad)).proposals,0);
 const valid={id:'ep:event:verified_due001',eventType:'narrative.schedule-due',source:{kind:'gm-approved-intent',scheduleId:'ep:scheduled:one001'},payload:{scheduleId:'ep:scheduled:one001',verified:true,sourceRevision:1}};
 assert.equal(triggerAcceptsEvent(g.nodes[0],valid),true);
 assert.equal((await env.router.ingest(valid)).status,'review-required');
});
test('document trigger only accepts native-hook event carrying hook provenance',async()=>{
 const env=setup();const g=fixture('core.trigger.document-event','foundry.actor.updated',['native-hook']);await activate(env,g);
 const spoof={id:'ep:event:manual_spoof001',eventType:'foundry.actor.updated',source:{kind:'gm-approved-intent',requestId:'ep:request:spoof001'},payload:{verified:true}};
 assert.equal((await env.router.ingest(spoof)).proposals,0);
 const event={id:'ep:event:document_hook001',eventType:'foundry.actor.updated',source:{kind:'native-hook',hook:'updateActor',documentUuid:'Actor.abcdefghijklmnop'},payload:{verified:true}};
 assert.equal((await env.router.ingest(event)).status,'review-required');
});
