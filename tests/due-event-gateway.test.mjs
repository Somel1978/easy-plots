import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NativeTemporalIndex} from '../src/storage/native-temporal-index.mjs';
import {GMTemporalCoordinator} from '../src/orchestration/temporal-coordinator.mjs';
import {GMManualEventGateway} from '../src/runtime/manual-event-gateway.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
const id=x=>`ep:${x}`,scheduleId=id('scheduled:harper001'), ownerId=id('faction:harper001');
async function setup(){
 const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
 const repository=new MemoryPartitionRepository(),domains=new NarrativeDomainStore({repository,gmProvider});
 const index=new NativeTemporalIndex({repository,gmProvider}),timeCoordinator=new GMTemporalCoordinator({domains,index});
 await timeCoordinator.schedule({id:scheduleId,ownerId,kind:'faction-action',dueAt:200,sourceEventId:id('event:scheduled001')});
 const catalog=new ActiveTriggerCatalog({repository,gmProvider});const registry=new IndexedGraphRegistry({registry:new PersistentGraphRegistry({repository,gmProvider}),catalog});
 const ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 const editor=new GraphEditorModel({registry});const graph=editor.newGraph('Faction due event');
 editor.selectNode(graph.rootNodeId);editor.updateSelected({eventType:'narrative.schedule-due',sourceKindsJSON:'["gm-approved-intent"]'});
 const effect=editor.addNode('core.effect.proposal');editor.connect(graph.rootNodeId,effect);
 await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
 const gateway=new GMManualEventGateway({router,gmProvider,writer:{assertEligible:()=>{}},worldId:'test-world',timeCoordinator});
 return {timeCoordinator,gateway,ledger};
}
test('due event is indexed, time checked and deduplicated without committing faction action',async()=>{
 const {gateway,ledger,timeCoordinator}=await setup();
 await assert.rejects(gateway.emitDue({scheduleId,worldTime:199}),{code:'SCHEDULE_NOT_DUE'});
 const result=await gateway.emitDue({scheduleId,worldTime:201});assert.equal(result.status,'review-required');
 const persisted=await ledger.get(result.eventId);
 assert.equal(persisted.proposals.length,1);
 assert.equal(persisted.event.payload.scheduleId,scheduleId);
 assert.equal((await timeCoordinator.read({id:scheduleId})).data.status,'pending');
 assert.equal((await gateway.emitDue({scheduleId,worldTime:220})).status,'duplicate-or-recovery-required');
});
test('stale index entries or changed canonical state fail without creating an event',async()=>{
 const {gateway,timeCoordinator}=await setup();
 const row=await timeCoordinator.read({id:scheduleId});
 await timeCoordinator.recordOutcome({id:scheduleId,expectedRevision:row.revision,
   resolutionEventId:id('event:resolved001'),outcome:'resolved'});
 await assert.rejects(gateway.emitDue({scheduleId,worldTime:300}),{code:'SCHEDULE_NOT_DUE'});
});
test('a commitment at fictional time zero remains discoverable and can produce one reviewed due event',async()=>{
 const {gateway,timeCoordinator,ledger}=await setup(),zeroId=id('scheduled:time_zero001');
 await timeCoordinator.schedule({id:zeroId,ownerId,kind:'deadline',dueAt:0,sourceEventId:id('event:time_zero001')});
 const result=await gateway.emitDue({scheduleId:zeroId,worldTime:0});assert.equal(result.status,'review-required');assert.equal((await ledger.get(result.eventId)).event.payload.dueAt,0);
 assert.equal((await gateway.emitDue({scheduleId:zeroId,worldTime:0})).status,'duplicate-or-recovery-required');
});
