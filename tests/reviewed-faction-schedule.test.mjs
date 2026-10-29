import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {NativeTemporalIndex} from '../src/storage/native-temporal-index.mjs';
import {GMTemporalCoordinator} from '../src/orchestration/temporal-coordinator.mjs';
import {ReviewedFactionActionScheduler} from '../src/orchestration/reviewed-faction-scheduling.mjs';
import {createReviewedFactionScheduleProvider} from '../src/runtime/reviewed-faction-schedule-provider.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
const id=s=>`ep:${s}`,agendaId=id('agenda:harpers001'),decisionId=id('agenda-decision:review001'),commitmentId=id('scheduled:review001'),factionId=id('faction:harpers001');
async function setup(){
 const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
 const repository=new MemoryPartitionRepository(),domains=new NarrativeDomainStore({repository,gmProvider});
 const index=new NativeTemporalIndex({repository,gmProvider});const time=new GMTemporalCoordinator({domains,index});
 const service=new ReviewedFactionActionScheduler({domains,timeCoordinator:time});
 await domains.save({type:'faction-agenda',scope:'world',id:agendaId,sourceEventId:id('event:agenda_pub001'),data:{agendaId,factionId,state:'published',rules:[]}});
 await domains.save({type:'faction-agenda-decision',scope:'world',id:decisionId,sourceEventId:id('event:reviewed001'),
  data:{agendaId,agendaRevision:1,worldTime:40,status:'gm-reviewed-action-proposal',effectsExecuted:0,actionId:'survey-pier'}});
 return {repository,gmProvider,domains,index,time,service};
}
test('reviewed faction decision can stage one durable, bounded due-time commitment',async()=>{
 const {service,time}=await setup();const sourceEventId=id('event:scheduled001');
 const args={decisionId,commitmentId,dueAt:70,sourceEventId,gmApproved:true};
 await assert.rejects(service.prepare({...args,gmApproved:false}),{code:'FACTION_SCHEDULE_APPROVAL'});
 await assert.rejects(service.prepare({...args,dueAt:39}),{code:'FACTION_SCHEDULE_TIME'});
 const first=await service.prepare(args);
 assert.equal(first.effectsExecuted,0);assert.equal(first.alreadyPrepared,false);
 assert.equal((await time.due({from:60,to:80})).candidates[0].id,commitmentId);
 const second=await service.prepare(args);assert.equal(second.alreadyPrepared,true);
 assert.equal(await service.verify(args),true);
 await assert.rejects(service.prepare({...args,dueAt:71}),{code:'FACTION_SCHEDULE_CONFLICT'});
});
test('graph event and approved journal create faction due commitment without executing action',async()=>{
 const {repository,gmProvider,time,service}=await setup(),catalog=new ActiveTriggerCatalog({repository,gmProvider});
 const registry=new IndexedGraphRegistry({registry:new PersistentGraphRegistry({repository,gmProvider}),catalog});
 const ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 const providers=new EffectProviderRegistry();providers.register(createReviewedFactionScheduleProvider({service,gmProvider}));
 const editor=new GraphEditorModel({registry});const graph=editor.newGraph('Schedule Harper response');
 const node=editor.addNode('core.faction.schedule-reviewed-action');editor.connect(graph.rootNodeId,node);
 editor.updateSelected({payloadJSON:JSON.stringify({scope:'world',decisionId,commitmentId,dueAt:80})});
 await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
 const eventId=id('event:scheduled_evt001');
 await router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}});
 const proposal=(await ledger.get(eventId)).proposals[0];
 const reviews=new DurableProposalReview({repository,ledger,registry,providers,journal:new MemoryOperationJournal(),gmProvider});
 await reviews.decide(eventId,proposal.operationId,{approve:true});
 assert.equal((await time.due({from:70,to:90})).candidates.length,0);
 assert.equal((await reviews.execute(eventId,proposal.operationId)).status,'completed');
 assert.equal((await time.due({from:70,to:90})).candidates.length,1);
 assert.equal((await time.read({id:commitmentId})).data.status,'pending');
});
test('publication rejects native mutation instructions in faction schedule payload',async()=>{
 const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true}},'world');const repository=new MemoryPartitionRepository();
 const editor=new GraphEditorModel({registry:new PersistentGraphRegistry({repository,gmProvider})});const graph=editor.newGraph('Invalid faction schedule');
 editor.addNode('core.faction.schedule-reviewed-action');editor.connect(graph.rootNodeId,editor.selectedNode.id);
 editor.updateSelected({payloadJSON:JSON.stringify({...editor.selectedNode.data.payload,secretActorPatch:'system.hp=0'})});
 await assert.rejects(editor.save(),{code:'FACTION_SCHEDULE_PAYLOAD'});
});
