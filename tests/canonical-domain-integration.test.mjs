import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {createExtendedDomainProviders} from '../src/runtime/extended-providers.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {PersistentQuestProjections} from '../src/orchestration/persistent-quest-projections.mjs';
import {PersistentFactionAgenda} from '../src/orchestration/persistent-faction-agenda.mjs';
const eventId='ep:event:canonical_integration001';
function suite(){
 const repository=new MemoryPartitionRepository(),context=createLocalGMContext({user:{id:'gm_canonical001',isGM:true},epoch:'canonical'},'world'),gmProvider=()=>context;
 const domains=new NarrativeDomainStore({repository,gmProvider}),providers=new EffectProviderRegistry();
 for(const p of createExtendedDomainProviders({repository,gmProvider,domains}))providers.register(p);
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})});
 const ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 const review=new DurableProposalReview({repository,registry,ledger,providers,journal:new MemoryOperationJournal(),gmProvider});
 const author=async(type,payload,sourceEventId=eventId)=>{
  const model=new GraphEditorModel({registry});model.newGraph('Canonical domain integration');const node=model.addNode(type);
  model.updateSelected({payloadJSON:JSON.stringify(payload)});model.connect(model.graph.rootNodeId,node);
  await model.save();const graph=await model.publish();await model.activate(graph.publishedVersion);
  const event={id:sourceEventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true}};
  assert.equal((await router.ingest(event)).status,'review-required');const p=(await ledger.get(sourceEventId)).proposals.find(p=>p.nodeId===node);
  return {proposal:p,execute:async()=>{await review.decide(sourceEventId,p.operationId,{approve:true});assert.equal((await review.execute(sourceEventId,p.operationId)).status,'completed');},
    deactivate:async()=>{const a=await registry.getActivation(graph.id);return registry.deactivate(graph.id,{expectedActivationRevision:a.revision});}};
 };
 return {repository,domains,providers,author};
}
test('ADR-031: approved objective graph effect feeds the canonical quest publication service',async()=>{
 const s=suite(),objectiveId='ep:objective:canonical001',actor='ep:actor:party_member001';
 const flow=await s.author('core.quest.objective',{scope:'world',objectiveId,state:'active',previousState:null,expectedRevision:null});
 assert.equal(await s.domains.read('objective','world',objectiveId),null);
 await flow.execute();const canonical=await s.domains.read('objective','world',objectiveId);
 assert.equal(canonical?.data.state,'active','An approved graph effect must reach the source that quests actually read');
 const quests=new PersistentQuestProjections({domains:s.domains}),publicationId='ep:quest-publication:canonical001';
 await quests.prepare({manifest:{id:publicationId,questId:'ep:quest:canonical001',publicId:'ep:quest-public:canonical001',title:'Find the harbor pilot',observerIds:[actor],objectives:[{
  objectiveId,expectedRevision:canonical.revision,status:'active',publicId:'ep:objective-public:canonical001',text:'Meet the pilot',recipientIds:[actor]}]},sourceEventId:eventId});
 await quests.approve({publicationId,expectedRevision:1,reviewEventId:'ep:event:quest_review001'});
 assert.equal((await quests.project({publicationId,observerId:actor})).objectives[0].status,'active');
});
test('ADR-012: approved fact graph effect supplies truth to the faction agenda without granting faction knowledge',async()=>{
 const s=suite(),factId='ep:fact:harbor_open001',claimId='ep:claim:harbor_open001',factionId='ep:faction:pilots001';
 const flow=await s.author('core.world.fact',{scope:'world',factId,value:'The harbor is open',status:'asserted',expectedRevision:null});
 const service=new PersistentFactionAgenda({domains:s.domains}),agendaId='ep:agenda:harbor001';
 await service.publish({agendaId,factionId,sourceEventId:eventId,rules:[{id:'depart',actionId:'depart',notBefore:0,expiresAt:100,requiredCanonicalFactIds:[factId],requiredFactionKnowledgeIds:[claimId]}]});
 await flow.execute();assert.equal((await s.domains.read('world-fact','world',factId))?.data.status,'asserted');
 assert.equal((await service.assess({agendaId,worldTime:1})).proposals.length,0,'Truth is not faction knowledge');
 const receiptId='ep:knowledge-receipt:harbor001';
 await s.domains.save({type:'knowledge-receipt',scope:'world',id:receiptId,sourceEventId:eventId,data:{observerId:factionId,claimId,state:'published',availableAt:0}});
 assert.equal((await service.assess({agendaId,worldTime:1,knowledgeReceiptIds:[receiptId]})).proposals.length,1);
});
test('ADR-031: objective updates retain authored metadata and invalidate approved quest projections',async()=>{
 const s=suite(),objectiveId='ep:objective:existing001';
 await s.domains.save({type:'objective',scope:'world',id:objectiveId,sourceEventId:eventId,data:{title:'Existing objective',state:'active',gmNotes:'Keep private'}});
 const quests=new PersistentQuestProjections({domains:s.domains}),publicationId='ep:quest-publication:existing001',actor='ep:actor:existing001';
 await quests.prepare({manifest:{id:publicationId,questId:'ep:quest:existing001',publicId:'ep:quest-public:existing001',title:'Existing quest',observerIds:[actor],objectives:[{objectiveId,expectedRevision:1,status:'active',publicId:'ep:objective-public:existing001',text:'Continue the investigation',recipientIds:[actor]}]},sourceEventId:eventId});
 await quests.approve({publicationId,expectedRevision:1,reviewEventId:'ep:event:quest_existing001'});
 assert.ok(await quests.project({publicationId,observerId:actor}));
 const provider=s.providers.get('narrative.transition-objective'),payload={scope:'world',objectiveId,state:'completed',previousState:'active',expectedRevision:1};
 await provider.apply(payload,{operationId:'ep:operation:objective_update001',sourceEventId:'ep:event:objective_update001'});
 const current=await s.domains.read('objective','world',objectiveId);
 assert.equal(current.data.state,'completed');assert.equal(current.data.title,'Existing objective');assert.equal(current.data.gmNotes,'Keep private');assert.equal(current.revision,2);
 assert.equal(await quests.project({publicationId,observerId:actor}),null,'Canonical updates must suppress stale approved projections');
 assert.equal(await provider.verify(payload,{operationId:'ep:operation:objective_update001',sourceEventId:'ep:event:objective_update001'}),true);
 await assert.rejects(provider.apply(payload,{operationId:'ep:operation:objective_stale001',sourceEventId:'ep:event:objective_stale001'}),{code:'REVISION_CONFLICT'});
});
test('ADR-032: approved relationship graph transitions feed immutable directional domain history',async()=>{
 const s=suite(),relationshipId='ep:relationship:canonical001',fromId='ep:actor:from001',toId='ep:actor:to001';
 const first={scope:'world',relationshipId,fromId,toId,relation:'ally',status:'active',expectedRevision:null};
 const flow=await s.author('core.relationship.transition',first,'ep:event:relationship_first001');await flow.execute();await flow.deactivate();
 const next={...first,relation:'rival',expectedRevision:1};
 const changed=await s.author('core.relationship.transition',next,'ep:event:relationship_second001');await changed.execute();
 const current=await s.domains.read('relationship','world',relationshipId),past=await s.domains.readRevision('relationship','world',relationshipId,1);
 assert.equal(current.data.relation,'rival');assert.equal(past.data.relation,'ally');assert.equal(past.sourceEventId,'ep:event:relationship_first001');
 assert.equal(current.data.fromId,fromId);assert.equal(current.data.toId,toId);
 await assert.rejects(s.providers.get('narrative.set-relationship').apply({...next,fromId:toId,toId:fromId,expectedRevision:2},
  {operationId:'ep:operation:relationship_retarget001',sourceEventId:'ep:event:relationship_retarget001'}),{code:'RELATIONSHIP_IDENTITY'});
});
test('ADR-015: graph belief changes retain observer-specific history without rewriting canonical truth',async()=>{
 const s=suite(),beliefId='ep:belief:canonical001',observerId='ep:actor:observer001',claimId='ep:claim:canonical001';
 await s.domains.save({type:'world-fact',scope:'world',id:'ep:fact:separate001',data:{status:'asserted',value:'Actual world truth'},sourceEventId:eventId});
 const payload={scope:'world',beliefId,observerId,claimId,stance:'believed',knownEvidenceIds:[],expectedRevision:null};
 const flow=await s.author('core.knowledge.belief',payload);await flow.execute();
 const provider=s.providers.get('narrative.record-observer-belief');
 await provider.apply({...payload,stance:'retracted',expectedRevision:1},{operationId:'ep:operation:belief_retract001',sourceEventId:'ep:event:belief_retract001'});
 assert.equal((await s.domains.read('observer-belief','world',beliefId)).data.stance,'retracted');
 assert.equal((await s.domains.readRevision('observer-belief','world',beliefId,1)).data.stance,'believed');
 assert.equal((await s.domains.read('world-fact','world','ep:fact:separate001')).data.value,'Actual world truth');
 await assert.rejects(provider.apply({...payload,observerId:'ep:actor:other001',expectedRevision:2},
  {operationId:'ep:operation:belief_other001',sourceEventId:'ep:event:belief_other001'}),{code:'BELIEF_IDENTITY'});
});
