import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {NativeCriticalSignalIndex} from '../src/storage/critical-signal-index.mjs';
import {NativeSignalReliability,criticalSignalLocator} from '../src/orchestration/signal-reliability.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {normalizeFoundryHook,VerifiedFoundryHookIngress} from '../src/platform/foundry-hook-ingress.mjs';
import {graph} from './fixtures.mjs';
const documentUuid='Actor.critical001',reviewEventId='ep:event:signal_review001';
const actor={uuid:documentUuid,documentName:'Actor',_stats:{modifiedTime:1000},name:'PRIVATE NPC',system:{secret:'PRIVATE CONTENT'}};
const nativeEvent=(n,hook='updateActor')=>normalizeFoundryHook(hook,[hook==='updateItem'?{uuid:'Item.noncritical001',documentName:'Item'}:actor,{system:{secret:'PRIVATE CONTENT'}},{},'GM_signal001'],{randomId:()=>`signal_${String(n).padStart(10,'0')}`});
const until=async predicate=>{const end=performance.now()+3000;while(!predicate()){if(performance.now()>end)throw Error('Observable critical signal result did not arrive');await new Promise(resolve=>setImmediate(resolve));}};
class HooksStub {handlers=new Map();on(name,fn){this.handlers.set(name,fn);}off(name){this.handlers.delete(name);}fire(name,...args){this.handlers.get(name)?.(...args);}}
async function setup({active=true,critical=true,watch=true}={}){
 const repository=new MemoryPartitionRepository(),user={id:'GM_signal001',isGM:true},ctx=createLocalGMContext({user,epoch:'signals'},'world'),gmProvider=()=>ctx;
 const domains=new NarrativeDomainStore({repository,gmProvider}),index=new NativeCriticalSignalIndex({repository,gmProvider}),ledger=new DurableEventLedger({repository,gmProvider});
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})});
 if(active){const g=graph();g.nodes[0].data.eventType='foundry.actor.updated';g.nodes[1].data.condition.left.path=['event','documentType'];g.nodes[1].data.condition.right.value='Actor';
  const saved=await registry.saveDraft(g);await registry.publish(g.id,{expectedRevision:saved.revision});await registry.activate(g.id,1,{expectedActivationRevision:null});}
 const originalRouter=new DurableReactiveRouter({registry,catalog,ledger,gmProvider}),calls=[];
 const router={subscribed:type=>originalRouter.subscribed(type),ingest:async event=>{calls.push(event.id);return originalRouter.ingest(event);}};
 const stamps=new Map([[documentUuid,{exists:true,modifiedTime:1000}]]),readSourceStamp=async uuid=>{if(!stamps.has(uuid))throw Error('Unexpected native source');return structuredClone(stamps.get(uuid));};
 const args={domains,index,ledger,router,gmProvider,readSourceStamp},service=new NativeSignalReliability(args);
 await service.configure({rules:critical?[{eventType:'foundry.actor.updated',tier:'critical'}]:[],sourceUuids:watch?[documentUuid]:[],reviewEventId});
 return {repository,user,domains,index,ledger,router,stamps,service,args,calls,gmProvider};
}
test('ADR-081: dropped best-effort signal is discarded while a dropped critical signal survives restart and requires reviewed resumption',async()=>{
 const s=await setup(),hooks=new HooksStub(),errors=[];let release,entered=false;
 const ingest=s.router.ingest;s.router.ingest=async event=>{if(!entered){entered=true;await new Promise(resolve=>{release=resolve;});}return ingest(event);};
 let sequence=0;const ingress=new VerifiedFoundryHookIngress({hooks,router:s.router,reliability:s.service,gameInstance:{user:s.user},gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},maxInflight:1,
  randomId:()=>`signal_${String(++sequence).padStart(10,'0')}`,onError:error=>errors.push(error)});
 ingress.start();hooks.fire('updateActor',actor,{}, {},s.user.id);await until(()=>entered);
 hooks.fire('updateItem',{uuid:'Item.noncritical001',documentName:'Item'}, {},{},s.user.id);
 hooks.fire('updateActor',actor,{}, {},s.user.id);await until(()=>errors.filter(e=>e.code==='HOOK_BACKPRESSURE').length===2);
 assert.equal((await s.service.inspect({eventId:nativeEvent(2).id})).status,'absent');
 assert.equal((await s.service.inspect({eventId:nativeEvent(3).id})).status,'pending-intake');
 assert.ok(errors.some(e=>e.eventId===nativeEvent(3).id));release();await until(()=>ingress.status.inflight===0);ingress.stop();
 const resumed=new NativeSignalReliability(s.args);await resumed.load();
 const before=s.calls.length,pending=await resumed.reconcile({eventId:nativeEvent(3).id});assert.equal(pending.status,'pending-intake');assert.equal(s.calls.length,before);
 await assert.rejects(()=>resumed.resume({eventId:pending.eventId,expectedRevision:pending.revision}),{code:'SIGNAL_APPROVAL'});
 const outcome=await resumed.resume({eventId:pending.eventId,expectedRevision:pending.revision,approved:true});assert.equal(outcome.status,'review-required');
 const accepted=await s.ledger.get(pending.eventId);assert.equal(accepted.proposals.length,1);assert.equal(accepted.proposals[0].state,'requires-gm-approval');
 assert.equal((await resumed.listPending()).items.length,0);assert.equal(s.calls.length,2);
 const confirmed=await resumed.inspect({eventId:pending.eventId});
 await assert.rejects(()=>resumed.resume({eventId:pending.eventId,expectedRevision:confirmed.revision,approved:true}),{code:'SIGNAL_ALREADY_ACCEPTED'});
});
test('critical intake is immutable, metadata-only and idempotent before any graph execution',async()=>{
 const s=await setup(),event=nativeEvent(1),first=await s.service.capture(event),again=await s.service.capture(event);
 assert.equal(first.revision,again.revision);assert.equal(s.calls.length,0);
 assert.equal(JSON.stringify(first).includes('PRIVATE'),false);
 await assert.rejects(()=>s.service.capture({...event,payload:{...event.payload,secret:'PRIVATE'}}),{code:'SIGNAL_EVENT'});
 const different=structuredClone(event);different.payload.changeKeys=['flags'];await assert.rejects(()=>s.service.capture(different),{code:'SIGNAL_ID_CONFLICT'});
});
test('critical embedded Item Hooks retain their original native UUID without requiring root-document watch support',async()=>{
 const s=await setup(),policy=await s.service.load();await s.service.configure({rules:[{eventType:'foundry.item.updated',tier:'critical'}],expectedRevision:policy.revision,reviewEventId});
 const event=normalizeFoundryHook('updateItem',[{uuid:'Actor.parent001.Item.child001',documentName:'Item'}, {},{},s.user.id],{randomId:()=> 'embedded_signal001'});
 await s.service.capture(event);assert.equal((await s.service.inspect({eventId:event.id})).event.source.documentUuid,'Actor.parent001.Item.child001');
 assert.equal((await s.service.deliver(event.id)).status,'no-subscribers');assert.equal((await s.service.inspect({eventId:event.id})).status,'confirmed');
});
test('existing accepted or uncertain events are inspected and never replayed through recovery',async()=>{
 const s=await setup(),event=nativeEvent(1);await s.service.capture(event);await s.ledger.accept(event);await s.ledger.transition(event.id,'prepared','uncertain');
 assert.equal((await s.service.reconcile({eventId:event.id})).status,'event-recovery-required');
 assert.equal((await s.service.deliver(event.id)).status,'uncertain');assert.equal(s.calls.length,0);
 const current=await s.service.inspect({eventId:event.id});
 await assert.rejects(()=>s.service.resume({eventId:event.id,expectedRevision:current.revision,approved:true}),{code:'SIGNAL_ALREADY_ACCEPTED'});
 await assert.rejects(()=>s.service.dismiss({eventId:event.id,expectedRevision:current.revision,reviewEventId,reason:'Reviewed',approved:true}),{code:'SIGNAL_ALREADY_ACCEPTED'});
});
test('interruption after pending index but before full intake stays discoverable without reconstructing a missing event',async()=>{
 const s=await setup(),event=nativeEvent(1),save=s.domains.save.bind(s.domains);s.domains.save=spec=>spec.type==='critical-signal'?Promise.reject(Error('intake interrupted')):save(spec);
 await assert.rejects(()=>s.service.capture(event),/intake interrupted/);s.domains.save=save;
 const pending=await s.service.reconcile({eventId:event.id});assert.equal(pending.status,'incomplete-intake');assert.equal(pending.event,null);assert.equal(s.calls.length,0);
 const result=await s.service.dismiss({eventId:event.id,expectedRevision:null,reviewEventId,approved:true,reason:'Requires authored manual follow-up'});
 assert.equal(result.status,'dismissed');assert.equal((await s.service.listPending()).items.length,0);assert.equal(await s.ledger.get(event.id),null);
});
test('a fully accepted ledger occurrence can reconcile a partial intake without resubmitting it',async()=>{
 const s=await setup(),event=nativeEvent(1),save=s.domains.save.bind(s.domains);s.domains.save=spec=>spec.type==='critical-signal'?Promise.reject(Error('intake interrupted')):save(spec);
 await assert.rejects(()=>s.service.capture(event),/intake interrupted/);s.domains.save=save;
 await s.ledger.accept(event);await s.ledger.transition(event.id,'prepared','evaluating');await s.ledger.transition(event.id,'evaluating','evaluated');
 const restored=new NativeSignalReliability(s.args);assert.equal((await restored.reconcile({eventId:event.id})).status,'confirmed');assert.equal(s.calls.length,0);
});
test('pending critical occurrence remains reviewable after router failure or storage interruption',async()=>{
 const s=await setup(),event=nativeEvent(1);await s.service.capture(event);s.router.ingest=async()=>{throw Error('evaluation interrupted');};
 await assert.rejects(()=>s.service.deliver(event.id),/evaluation interrupted/);
 assert.equal((await s.service.listPending()).items[0].status,'pending-intake');assert.equal(await s.ledger.get(event.id),null);
});
test('terminal intake index cleanup is explicitly recoverable even when no graph subscribed',async()=>{
 const s=await setup({active:false}),event=nativeEvent(1);await s.service.capture(event);
 const remove=s.index.remove.bind(s.index);s.index.remove=async()=>{throw Error('cleanup interrupted');};
 await assert.rejects(()=>s.service.deliver(event.id),/cleanup interrupted/);assert.equal(await s.ledger.get(event.id),null);
 assert.equal((await s.service.listPending()).items[0].status,'confirmed-cleanup-required');
 s.index.remove=remove;assert.equal((await s.service.reconcile({eventId:event.id})).status,'confirmed');assert.equal(s.calls.length,1);
});
test('a reviewed dismissal retains its audit record and can recover interrupted pending-index cleanup',async()=>{
 const s=await setup(),event=nativeEvent(1),row=await s.service.capture(event),remove=s.index.remove.bind(s.index);
 s.index.remove=async()=>{throw Error('dismissal cleanup interrupted');};
 await assert.rejects(()=>s.service.dismiss({eventId:event.id,expectedRevision:row.revision,approved:true,reviewEventId,reason:'No narrative change'}),/dismissal cleanup interrupted/);
 assert.equal((await s.service.listPending()).items[0].status,'dismissed-cleanup-required');
 s.index.remove=remove;assert.equal((await s.service.reconcile({eventId:event.id})).status,'dismissed');assert.equal(s.calls.length,0);
});
test('critical intake admission itself is bounded and overflow stops listeners while source reconciliation remains available',async()=>{
 const s=await setup(),hooks=new HooksStub(),errors=[];let release,started=false,sequence=0;const capture=s.service.capture.bind(s.service);
 s.service.capture=async(...args)=>{started=true;await new Promise(resolve=>{release=resolve;});return capture(...args);};
 const ingress=new VerifiedFoundryHookIngress({hooks,router:s.router,reliability:s.service,gameInstance:{user:s.user},gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},maxCriticalCaptures:1,
  randomId:()=>`overflow_${String(++sequence).padStart(10,'0')}`,onError:error=>errors.push(error)});
 ingress.start();hooks.fire('updateActor',actor,{}, {},s.user.id);await until(()=>started);assert.equal(ingress.status.criticalIntakes,1);
 s.stamps.set(documentUuid,{exists:true,modifiedTime:2000});hooks.fire('updateActor',actor,{}, {},s.user.id);
 await until(()=>errors.some(e=>e.code==='CRITICAL_INTAKE_OVERLOAD'));assert.equal(ingress.status.running,false);
 release();await until(()=>ingress.status.criticalIntakes===0);assert.equal(s.calls.length,0);
 assert.equal((await s.service.listPending()).items.length,1);assert.equal((await s.service.checkSources({reviewEventId})).items[0].requiresReview,true);
});
test('a missed native callback is detected from a scoped source checkpoint without inventing missing history',async()=>{
 const s=await setup();s.stamps.set(documentUuid,{exists:true,modifiedTime:2000});
 const detected=await s.service.checkSources({reviewEventId});assert.equal(detected.items.length,1);assert.equal(detected.items[0].requiresReview,true);
 assert.equal(detected.items[0].missingOccurrences,'not-inferred');assert.equal(s.calls.length,0);
 const row=detected.items[0];await assert.rejects(()=>s.service.acknowledgeSource({documentUuid,expectedRevision:row.revision,expectedStamp:row.current,reviewEventId,reason:'Reviewed'}),{code:'SIGNAL_APPROVAL'});
 s.stamps.set(documentUuid,{exists:true,modifiedTime:3000});await assert.rejects(()=>s.service.acknowledgeSource({documentUuid,expectedRevision:row.revision,expectedStamp:row.current,reviewEventId,reason:'Reviewed',approved:true}),{code:'SIGNAL_SOURCE_CHANGED'});
 const updated=(await s.service.checkSources({reviewEventId})).items[0];
 await s.service.capture(nativeEvent(1));
 await s.service.acknowledgeSource({documentUuid,expectedRevision:updated.revision,expectedStamp:updated.current,reviewEventId,reason:'Will author the required follow-up separately',approved:true});
 assert.equal((await s.service.checkSources({reviewEventId})).items[0].requiresReview,false);
 assert.equal((await s.service.listPending()).items.length,1,'Checkpoint review cannot erase original pending signals');assert.equal(s.calls.length,0);
});
test('confirmed matching native metadata advances only a verified current checkpoint',async()=>{
 const s=await setup(),event=nativeEvent(1),stamp={exists:true,modifiedTime:2000};s.stamps.set(documentUuid,stamp);
 await s.service.capture(event,{sourceStamp:stamp});await s.service.deliver(event.id);
 const source=(await s.service.checkSources({reviewEventId})).items[0];assert.deepEqual(source.baseline,stamp);assert.equal(source.requiresReview,false);
});
test('stale source stamps and detected gaps are never silently acknowledged by later signal delivery',async()=>{
 const s=await setup(),event=nativeEvent(1);s.stamps.set(documentUuid,{exists:true,modifiedTime:3000});
 await s.service.capture(event,{sourceStamp:{exists:true,modifiedTime:2000}});await s.service.deliver(event.id);
 const source=(await s.service.checkSources({reviewEventId})).items[0];assert.equal(source.requiresReview,true);assert.equal(source.baseline.modifiedTime,1000);
 const second=nativeEvent(2);await s.service.capture(second,{sourceStamp:{exists:true,modifiedTime:3000}});await s.service.deliver(second.id);
 assert.equal((await s.service.checkSources({reviewEventId})).items[0].requiresReview,true);
});
test('deletion of a watched source requires review and policy edits retain its checkpoint',async()=>{
 const s=await setup();s.stamps.set(documentUuid,{exists:false,modifiedTime:null});
 assert.equal((await s.service.checkSources({reviewEventId})).items[0].requiresReview,true);
 const policy=await s.service.load();await s.service.configure({rules:[],sourceUuids:[],expectedRevision:policy.revision,reviewEventId});
 assert.equal(s.service.tierForEvent(nativeEvent(1)),'best-effort');assert.equal((await s.service.checkSources({reviewEventId})).items.length,1);
});
test('GM authority, source scope, supported rules and fresh policy revisions are enforced',async()=>{
 const s=await setup(),policy=await s.service.load();
 await assert.rejects(()=>s.service.configure({rules:[],reviewEventId}),{code:'REVISION_CONFLICT'});
 await assert.rejects(()=>s.service.configure({rules:[{eventType:'custom.forged',tier:'critical'}],expectedRevision:policy.revision,reviewEventId}),{code:'SIGNAL_POLICY'});
 await assert.rejects(()=>s.service.configure({rules:[],sourceUuids:['Compendium.secret.page'],expectedRevision:policy.revision,reviewEventId}),{code:'SIGNAL_SOURCE'});
 s.user.isGM=false;assert.throws(()=>s.service.tierForEvent(nativeEvent(1)),{code:'GM_AUTHORITY_REVOKED'});
 await assert.rejects(()=>s.service.listPending(),{code:'GM_AUTHORITY_REVOKED'});
});
test('concurrent GM resume and dismissal cannot race to submit a dismissed occurrence',async()=>{
 const s=await setup(),event=nativeEvent(1),row=await s.service.capture(event);let release,entered=false;
 const ingest=s.router.ingest;s.router.ingest=async e=>{entered=true;await new Promise(resolve=>{release=resolve;});return ingest(e);};
 const resume=s.service.resume({eventId:event.id,expectedRevision:row.revision,approved:true});await until(()=>entered);
 const dismissed=assert.rejects(()=>s.service.dismiss({eventId:event.id,expectedRevision:row.revision,approved:true,reviewEventId,reason:'Concurrent decision'}));
 release();await Promise.all([resume,dismissed]);assert.equal(s.calls.length,1);assert.equal((await s.service.inspect({eventId:event.id})).status,'confirmed');
});
test('critical signal data fingerprint corruption fails closed',async()=>{
 const s=await setup(),event=nativeEvent(1);await s.service.capture(event);const loc=await criticalSignalLocator('world',event.id),row=await s.domains.read('critical-signal',loc.scope,loc.id);
 await s.domains.save({type:'critical-signal',scope:loc.scope,id:loc.id,expectedRevision:row.revision,sourceEventId:reviewEventId,data:{...row.data,event:{...event,payload:{...event.payload,changeKeys:['forged']}}}});
 await assert.rejects(()=>s.service.inspect({eventId:event.id}),{code:'SIGNAL_CORRUPT'});assert.equal(s.calls.length,0);
});
