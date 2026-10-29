import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentKnowledgeLedger} from '../src/orchestration/persistent-knowledge.mjs';
import {PersistentNPCActions} from '../src/orchestration/persistent-npc-actions.mjs';
import {GMTemporalCoordinator} from '../src/orchestration/temporal-coordinator.mjs';
import {NativeTemporalIndex} from '../src/storage/native-temporal-index.mjs';
import {createNarrativeCapabilityProviders} from '../src/runtime/narrative-capabilities.mjs';
import {createNPCActionProvider} from '../src/runtime/npc-action-provider.mjs';
import {createNarrativeStateProvider} from '../src/runtime/native-state-provider.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {GMManualEventGateway} from '../src/runtime/manual-event-gateway.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {sha256Hex} from '../src/contracts/digest.mjs';
const npcId='ep:npc:agenda_captain001',agendaId='ep:agenda:npc_captain001',scheduleId='ep:schedule:npc_captain001',commitmentId='ep:scheduled:npc_captain001',claimId='ep:claim:harbor_open001',factId='ep:fact:harbor_open001';
async function setup(){
 const repository=new MemoryPartitionRepository(),user={id:'gm_npcaction001',isGM:true},context=createLocalGMContext({user,epoch:'npc-actions'},'world'),gmProvider=()=>context;
 const domains=new NarrativeDomainStore({repository,gmProvider}),index=new NativeTemporalIndex({repository,gmProvider}),timeCoordinator=new GMTemporalCoordinator({domains,index});
 const compose=()=>new PersistentNPCActions({domains:new NarrativeDomainStore({repository,gmProvider}),timeCoordinator:new GMTemporalCoordinator({domains,index:new NativeTemporalIndex({repository,gmProvider})})}),service=compose();
 const providers=new EffectProviderRegistry();for(const p of createNarrativeCapabilityProviders({repository,gmProvider,domains}))providers.register(p);providers.register(createNPCActionProvider({service,gmProvider}));
 const state=createNarrativeStateProvider({repository,gmProvider});providers.register(state);
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})}),ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider}),journal=new MemoryOperationJournal(),reviews=new DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal});
 const knowledge=new PersistentKnowledgeLedger({domains,worldTimeProvider:()=>20});
 await knowledge.createClaim({claimId,publicId:'ep:claim-public:harbor_open001',publicText:'The harbor is open',canonicalTruth:'The harbor really is open',sourceEventId:'ep:event:npc_truth001'});
 await domains.save({type:'world-fact',scope:'world',id:factId,sourceEventId:'ep:event:npc_truth001',data:{status:'asserted',value:true}});
 const receipt=await knowledge.recordDisclosure({claimId,observerId:npcId,sourceId:'ep:npc:informant001',sourceEventId:'ep:event:npc_disclosure001',availableAt:50,stance:'believed'});
 const source=new GraphEditorModel({registry});source.newGraph('Canonical NPC authoring');source.updateSelected({eventType:'npc.plan-authored'});
 for(const [type,payload] of [
  ['core.npc.agenda',{scope:'world',agendaId,npcId,status:'active',requiredKnowledgeIds:[claimId],requiredCanonicalFactIds:[factId],expectedRevision:null}],
  ['core.npc.schedule',{scope:'world',scheduleId,npcId,agendaId,locationId:'ep:location:harbor001',dueWorldTime:100,status:'planned',expectedRevision:null}]
 ]){const node=source.addNode(type);source.updateSelected({payloadJSON:JSON.stringify(payload)});source.connect(source.graph.rootNodeId,node);}
 await source.save();const published=await source.publish();await source.activate(published.publishedVersion);
 const authoredEvent='ep:event:npc_authored001';await router.ingest({id:authoredEvent,eventType:'npc.plan-authored',source:{kind:'test-fixture'},payload:{}});
 assert.equal(await domains.read('npc-agenda','world',agendaId),null);
 for(const p of (await ledger.get(authoredEvent)).proposals){await reviews.decide(authoredEvent,p.operationId,{approve:true});await reviews.execute(authoredEvent,p.operationId);}
 const target=new GraphEditorModel({registry});target.newGraph('NPC due review');target.setRootTriggerType('core.trigger.schedule-due');const effect=target.addNode('core.effect.proposal');target.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"npc-reviewed-action","value":"explicit-GM-choice"}'});target.connect(target.graph.rootNodeId,effect);await target.save();const targetGraph=await target.publish();await target.activate(targetGraph.publishedVersion);
 const selection={scope:'world',scheduleId,knowledgeReceiptIds:[receipt.id],correctionIds:[],worldTime:60},prepare={...selection,commitmentId,expectedScheduleRevision:1,expectedAgendaRevision:1};
 const gateway=()=>new GMManualEventGateway({router,ledger,gmProvider,writer:{assertEligible:()=>{}},worldId:'world',timeCoordinator:new GMTemporalCoordinator({domains,index:new NativeTemporalIndex({repository,gmProvider})}),verifyDueSource:spec=>compose().verifyDue(spec)});
 const prepareDirect=overrides=>service.prepare({...prepare,sourceEventId:'ep:event:npc_prepared001',operationId:'ep:operation:npc_prepared001',approved:true,...overrides});
 return {repository,user,gmProvider,domains,index,timeCoordinator,compose,service,providers,state,catalog,registry,ledger,router,journal,reviews,knowledge,receipt,source,target,selection,prepare,gateway,prepareDirect};
}
test('ADR-035: canonical NPC graph records read only the NPC own durable knowledge, with disclosure timing',async()=>{
 const s=await setup();assert.equal((await s.domains.read('npc-agenda','world',agendaId)).data.npcId,npcId);assert.equal((await s.domains.read('npc-schedule','world',scheduleId)).data.agendaId,agendaId);
 const unknown=await s.service.assess({...s.selection,knowledgeReceiptIds:[]});assert.equal(unknown.eligible,false);assert.deepEqual(unknown.blockers,['npc-does-not-know-prerequisites']);
 assert.equal((await s.service.assess({...s.selection,worldTime:49})).eligible,false);
 const known=await s.service.assess(s.selection);assert.equal(known.eligible,true);assert.equal(known.due,false);assert.equal(known.outcome,'undetermined');assert.equal(await s.state.get({key:'npc-reviewed-action',value:null}),null);
 const other=await s.knowledge.recordDisclosure({claimId,observerId:'ep:npc:other_captain001',sourceId:'ep:npc:informant001',sourceEventId:'ep:event:npc_other_receipt001'});
 await assert.rejects(()=>s.service.assess({...s.selection,knowledgeReceiptIds:[other.id]}),{code:'NPC_ACTION_KNOWLEDGE'});
});
test('ADR-034 and ADR-048: approved NPC schedule survives restart, enters indexed due event and executes only separately approved target effects',async()=>{
 const s=await setup(),author=new GraphEditorModel({registry:s.registry});author.newGraph('Prepare NPC action');author.updateSelected({eventType:'npc.prepare-action'});const node=author.addNode('core.npc.schedule-reviewed-action');author.updateSelected({payloadJSON:JSON.stringify(s.prepare)});author.connect(author.graph.rootNodeId,node);await author.save();const p=await author.publish();await author.activate(p.publishedVersion);
 const sourceEventId='ep:event:npc_prepare_pipeline001';await s.router.ingest({id:sourceEventId,eventType:'npc.prepare-action',source:{kind:'test-fixture'},payload:{}});const proposal=(await s.ledger.get(sourceEventId)).proposals[0];
 assert.equal(await s.timeCoordinator.read({id:commitmentId}),null);await s.reviews.decide(sourceEventId,proposal.operationId,{approve:true});await s.reviews.execute(sourceEventId,proposal.operationId);
 const restartedTime=new GMTemporalCoordinator({domains:new NarrativeDomainStore(s),index:new NativeTemporalIndex(s)}),due=await restartedTime.due({from:80,to:110});assert.equal(due.candidates[0].id,commitmentId);assert.equal(due.effectsExecuted,0);
 await assert.rejects(()=>s.gateway().emitDue({scheduleId:commitmentId,worldTime:99}),{code:'SCHEDULE_NOT_DUE'});
 const event=await s.gateway().emitDue({scheduleId:commitmentId,worldTime:110});assert.equal(event.status,'review-required');const target=(await s.ledger.get(event.eventId)).proposals[0];assert.equal(await s.state.get({key:'npc-reviewed-action',value:null}),null);
 assert.equal((await s.domains.read('npc-schedule','world',scheduleId)).data.status,'planned');assert.equal((await s.timeCoordinator.read({id:commitmentId})).data.status,'pending');
 await s.reviews.decide(event.eventId,target.operationId,{approve:true});await s.reviews.execute(event.eventId,target.operationId);assert.equal((await s.state.get({key:'npc-reviewed-action',value:null})).value,'explicit-GM-choice');
 assert.equal((await s.gateway().emitDue({scheduleId:commitmentId,worldTime:120})).status,'duplicate-or-recovery-required');assert.equal((await s.state.get({key:'npc-reviewed-action',value:null})).revision,1);
});
test('NPC action due checks reject stale agendas, schedules and canonical prerequisites after preparation',async()=>{
 for(const type of ['npc-agenda','npc-schedule','world-fact']){
  const s=await setup();await s.prepareDirect();const id=type==='npc-agenda'?agendaId:type==='npc-schedule'?scheduleId:factId,row=await s.domains.read(type,'world',id);
  await s.domains.save({type,scope:'world',id,expectedRevision:row.revision,data:row.data,sourceEventId:'ep:event:npc_source_changed001'});
  await assert.rejects(()=>s.gateway().emitDue({scheduleId:commitmentId,worldTime:110}),{code:'NPC_ACTION_STALE'});assert.equal(await s.state.get({key:'npc-reviewed-action',value:null}),null);
 }
});
test('retracted knowledge and stale claims never qualify an NPC agenda as informed',async()=>{
 const s=await setup(),correction=await s.knowledge.correctReceipt({correctionId:'ep:correction:npc_retracted001',receiptId:s.receipt.id,sourceId:'ep:npc:informant001',sourceEventId:'ep:event:npc_retracted001',kind:'retracted',revisedStance:'retracted',reason:'The report was withdrawn'});
 const review=await s.service.assess({...s.selection,correctionIds:[correction.id]});assert.equal(review.eligible,false);assert.ok(review.blockers.includes('npc-does-not-know-prerequisites'));
 await assert.rejects(()=>s.prepareDirect({correctionIds:[correction.id]}),{code:'NPC_ACTION_BLOCKED'});
 const claim=await s.domains.read('knowledge-claim','world',claimId);await s.domains.save({type:'knowledge-claim',scope:'world',id:claimId,expectedRevision:claim.revision,data:claim.data,sourceEventId:'ep:event:npc_claim_changed001'});
 await assert.rejects(()=>s.service.assess(s.selection),{code:'NPC_ACTION_KNOWLEDGE_STALE'});
});
test('interrupted NPC due-index staging retains exact provenance and repairs without duplicate commitments',async()=>{
 const s=await setup(),stage=s.index.stage.bind(s.index);s.index.stage=async()=>{throw Error('index interrupted');};
 // Use the same authoritative domain store and the failing index instance.
 const interrupted=new PersistentNPCActions({domains:s.domains,timeCoordinator:s.timeCoordinator});
 await assert.rejects(()=>interrupted.prepare({...s.prepare,sourceEventId:'ep:event:npc_repair001',operationId:'ep:operation:npc_repair001',approved:true}),{code:'SCHEDULE_INDEX_UNCERTAIN'});
 assert.equal((await s.timeCoordinator.read({id:commitmentId})).data.status,'pending');s.index.stage=stage;
 const recovered=await s.compose().prepare({...s.prepare,sourceEventId:'ep:event:npc_repair001',operationId:'ep:operation:npc_repair001',approved:true});assert.equal(recovered.alreadyPrepared,true);assert.equal((await s.timeCoordinator.read({id:commitmentId})).revision,1);
 assert.equal((await s.timeCoordinator.due({from:80,to:110})).candidates.length,1);
 assert.equal(await s.service.verifyPrepared({...s.prepare,sourceEventId:'ep:event:npc_repair001',operationId:'ep:operation:npc_repair001'}),true);
 assert.equal(await s.service.verifyPrepared({...s.prepare,expectedAgendaRevision:2,sourceEventId:'ep:event:npc_repair001',operationId:'ep:operation:npc_repair001'}),false);
});
test('NPC scheduling requires explicit approval, fresh revisions, current GM and a canonical agenda binding',async()=>{
 const s=await setup();await assert.rejects(()=>s.prepareDirect({approved:false}),{code:'NPC_ACTION_APPROVAL'});await assert.rejects(()=>s.prepareDirect({expectedAgendaRevision:2}),{code:'REVISION_CONFLICT'});
 await s.timeCoordinator.schedule({id:commitmentId,ownerId:npcId,kind:'npc-action',dueAt:100,sourceEventId:'ep:event:unreviewed_npc001'});
 await assert.rejects(()=>s.gateway().emitDue({scheduleId:commitmentId,worldTime:110}),{code:'NPC_ACTION_UNREVIEWED'});
 const bare=new GMManualEventGateway({router:s.router,gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},worldId:'world',timeCoordinator:s.timeCoordinator});await assert.rejects(()=>bare.emitDue({scheduleId:commitmentId,worldTime:110}),{code:'SCHEDULE_SOURCE_UNVERIFIED'});
 s.user.isGM=false;await assert.rejects(()=>s.service.assess(s.selection),{code:'GM_AUTHORITY_REVOKED'});
});
test('legacy hashed NPC capability records require reviewed canonical adoption and preserve the original',async()=>{
 const s=await setup(),provider=s.providers.get('narrative.npc-agenda'),oldAgendaId='ep:agenda:npc_legacy001',payload={scope:'world',agendaId:oldAgendaId,npcId,status:'active',expectedRevision:null,visibility:'gm-only'},hash=await sha256Hex(`npc-agenda|world|${oldAgendaId}`),loc={id:`ep:npc-agenda:${hash.slice(0,24)}`,partitionId:`cap-npc-agenda-world-${hash.slice(0,2)}`};
 await s.repository.put({...loc,kind:'cap-npc-agenda',scope:'world',data:payload,lastOperationId:'ep:operation:npc_legacy001',lastSourceEventId:'ep:event:npc_legacy001'},{expectedRevision:null,gm:s.gmProvider()});
 await assert.rejects(()=>provider.get(payload),{code:'LEGACY_DOMAIN_MIGRATION_REQUIRED'});const preview=await provider.previewLegacyAdoption(payload);
 await provider.adoptLegacy(payload,{approved:true,expectedLegacyRevision:preview.legacyRevision,expectedLegacyFingerprint:preview.legacyFingerprint,reviewEventId:'ep:event:npc_legacy_adopt001'});
 assert.equal((await s.domains.read('npc-agenda','world',oldAgendaId)).data.npcId,npcId);assert.ok(await s.repository.read(loc.id,{partitionId:loc.partitionId,gm:s.gmProvider()}));
 await assert.rejects(()=>provider.get({...payload,npcId:'ep:npc:retarget001'}),{code:'IDENTITY_CONFLICT'});
});
test('accepted legacy due events stay historical across GM handover and changed NPC sources without replay',async()=>{
 const s=await setup();await s.prepareDirect();const hash=await sha256Hex(`world|world|${commitmentId}|1|due`),eventId=`ep:event:due_${hash.slice(0,32)}`;
 await s.ledger.accept({id:eventId,eventType:'narrative.schedule-due',source:{kind:'gm-approved-intent',gmUserId:'old-GM',scheduleId:commitmentId},payload:{scheduleId:commitmentId,ownerId:npcId,kind:'npc-action',dueAt:100,sourceRevision:1,verified:true}});await s.ledger.transition(eventId,'prepared','uncertain');
 const agenda=await s.domains.read('npc-agenda','world',agendaId);await s.domains.save({type:'npc-agenda',scope:'world',id:agendaId,expectedRevision:agenda.revision,data:{...agenda.data,status:'paused'},sourceEventId:'ep:event:npc_paused001'});
 s.router.ingest=()=>{throw Error('Accepted due event must never replay');};
 const newGM=createLocalGMContext({user:{id:'new-GM',isGM:true}},'world'),gateway=new GMManualEventGateway({router:s.router,ledger:s.ledger,gmProvider:()=>newGM,writer:{assertEligible:()=>{}},worldId:'world',timeCoordinator:s.timeCoordinator,verifyDueSource:()=>{throw Error('Historical due event is already accepted');}});
 const result=await gateway.emitDue({scheduleId:commitmentId,worldTime:120});assert.equal(result.eventId,eventId);assert.equal(result.persistedState,'uncertain');assert.equal(result.status,'duplicate-or-recovery-required');assert.equal(await s.state.get({key:'npc-reviewed-action',value:null}),null);
});
test('publication rejects NPC preparation fields outside the implemented provider contract',async()=>{
 const s=await setup(),model=new GraphEditorModel({registry:s.registry});model.newGraph('Invalid NPC contract');const node=model.addNode('core.npc.schedule-reviewed-action');model.updateSelected({payloadJSON:JSON.stringify({...s.prepare,forceOutcome:'victory'})});model.connect(model.graph.rootNodeId,node);
 await assert.rejects(()=>model.save(),{code:'NPC_ACTION_PAYLOAD'});assert.equal(await s.registry.getDraft(model.graph.id),null);
});
