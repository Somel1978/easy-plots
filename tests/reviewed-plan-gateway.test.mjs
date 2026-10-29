import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {createNarrativeStateProvider} from '../src/runtime/native-state-provider.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentGMPlans} from '../src/orchestration/persistent-plans.mjs';
import {ReviewedPlanEventGateway} from '../src/runtime/reviewed-plan-gateway.mjs';
async function setup({published=false}={}){
 const repository=new MemoryPartitionRepository(),user={id:'gm_reviewedplan001',isGM:true},ctx=createLocalGMContext({user,epoch:'reviewed-plan'},'world'),gmProvider=()=>ctx;
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})}),state=createNarrativeStateProvider({repository,gmProvider}),ledger=new DurableEventLedger({repository,gmProvider});
 const readState=({scope,key})=>state.get({scope,key,value:null}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider,stateReader:readState});
 const providers=new EffectProviderRegistry();providers.register(state);const journal=new MemoryOperationJournal(),reviews=new DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal});
 const domains=new NarrativeDomainStore({repository,gmProvider}),plans=new PersistentGMPlans({domainStore:domains,simulatePublished:spec=>router.simulatePublished(spec)}),writer={assertEligible:()=>{}};
 const compose=()=>new ReviewedPlanEventGateway({plans,router,ledger,readState,gmProvider,writer,worldId:'world'}),gateway=compose();
 const target=new GraphEditorModel({registry});target.newGraph('Reviewed emergent suggestion');target.setRootTriggerType('core.trigger.reviewed-plan');
 const value=target.addNode('core.data.event');target.updateSelected({payloadJSON:JSON.stringify({valueType:'number',path:published?['payload','suggestion','plannedEffects','0','payload','value']:['payload','suggestion','hypotheticalFacts','desired']})});
 const effect=target.addNode('core.effect.proposal');target.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"committed-suggestion","value":null}'});target.bindSelectedInput({field:'value',sourceNodeId:value});target.connect(target.graph.rootNodeId,effect);
 await target.save();const live=await target.publish();await target.activate(live.publishedVersion);
 let mode='what-if',scenario={initialFacts:{seed:true},hypotheses:[{key:'desired',value:9}],rules:[]};
 if(published){
  await state.apply({key:'plan-source',value:3},{operationId:'ep:operation:reviewed_seed001'});
  const source=new GraphEditorModel({registry});source.newGraph('Diagnostic native scenario');source.setRootTriggerType('core.trigger.document-event');
  const v=source.addNode('core.state.value');source.updateSelected({payloadJSON:'{"scope":"world","key":"plan-source","valueType":"number","expectedRevision":null}'});
  const e=source.addNode('core.effect.proposal');source.updateSelected({providerId:'native.actor.set-health',payloadJSON:'{"actorUuid":"Actor.planned001","value":null}'});source.bindSelectedInput({field:'value',sourceNodeId:v});source.connect(source.graph.rootNodeId,e);
  await source.save();const snap=await source.publish();mode='published-graph';scenario={graphId:snap.id,publishedVersion:snap.publishedVersion,event:{id:'ep:event:hypothetical_native001',eventType:'foundry.actor.updated',source:{kind:'native-hook',hook:'updateActor',documentUuid:'Actor.planned001'},payload:{}},hypotheses:[{scope:'world',key:'plan-source',value:9,expectedRevision:1}],faults:[{nodeId:e,stage:'apply-ack'}]};
 }
 const id='ep:plan:live_suggestion001',created=await plans.create({id,mode,scenario,sourceEventId:'ep:event:gm_preparation001'});
 const acknowledge=()=>plans.acknowledge({id,expectedRevision:created.revision,approvalEventId:'ep:event:gm_acknowledge001'});
 const selection=expectedRevision=>({id,expectedRevision});
 return {repository,user,gmProvider,registry,state,ledger,router,providers,journal,reviews,domains,plans,writer,gateway,compose,target,mode,scenario,id,created,acknowledge,selection};
}
test('ADR-050: saved emergent suggestion stays isolated until GM review, live submission and separately approved effects',async()=>{
 const s=await setup();assert.equal(await s.state.get({key:'committed-suggestion',value:null}),null);
 await assert.rejects(()=>s.gateway.preview(s.selection(1)),{code:'PLAN_REVIEW_REQUIRED'});
 await s.acknowledge();const preview=await s.gateway.preview(s.selection(2));assert.equal(preview.event.payload.suggestion.hypotheticalFacts.desired,9);assert.equal(await s.ledger.get(preview.event.id),null);
 await assert.rejects(()=>s.gateway.submit(s.selection(2)),{code:'PLAN_SUBMISSION_APPROVAL'});
 const result=await s.gateway.submit(s.selection(2),{approved:true});assert.equal(result.status,'review-required');assert.equal(result.planRevision,3);
 const accepted=await s.ledger.get(result.eventId);assert.equal(accepted.proposals[0].payload.value,9);assert.equal(accepted.event.source.kind,'gm-approved-intent');assert.equal(accepted.canonical.origin.kind,'gm-decision');
 assert.equal((await s.plans.read('world',s.id)).data.state,'submitted-for-gm-effects');assert.equal(await s.state.get({key:'committed-suggestion',value:null}),null);
 const p=accepted.proposals[0];await assert.rejects(()=>s.reviews.execute(result.eventId,p.operationId),{code:'APPROVAL_REQUIRED'});
 await s.reviews.decide(result.eventId,p.operationId,{approve:true});await s.reviews.execute(result.eventId,p.operationId);assert.equal((await s.state.get({key:'committed-suggestion',value:null})).value,9);
 const again=await s.compose().submit(s.selection(3),{approved:true});assert.equal(again.eventId,result.eventId);assert.equal(again.status,'duplicate-or-recovery-required');assert.equal((await s.state.get({key:'committed-suggestion',value:null})).revision,1);
});
test('published diagnostic scenarios become reviewed GM suggestions without forging native events or execution proofs',async()=>{
 const s=await setup({published:true});await s.acknowledge();const preview=await s.gateway.preview(s.selection(2));
 assert.equal(preview.event.source.kind,'gm-approved-intent');assert.equal(preview.event.source.documentUuid,undefined);assert.equal(preview.event.payload.input.event,undefined);assert.equal(preview.event.payload.input.faults,undefined);assert.equal(preview.event.payload.suggestion.plannedEffects[0].operationId,undefined);
 const result=await s.gateway.submit(s.selection(2),{approved:true}),event=await s.ledger.get(result.eventId);assert.equal(event.proposals[0].payload.value,9);
 assert.equal(await s.ledger.get(s.scenario.event.id),null);assert.equal((await s.state.get({key:'plan-source',value:null})).value,3);assert.equal(await s.state.get({key:'committed-suggestion',value:null}),null);
});
test('reviewed source revisions are checked before submission even when the canonical value stays the same',async()=>{
 const s=await setup({published:true});await s.acknowledge();const preview=await s.gateway.preview(s.selection(2));
 await s.state.apply({key:'plan-source',value:3},{operationId:'ep:operation:plan_source_changed001'});
 await assert.rejects(()=>s.gateway.submit(s.selection(2),{approved:true}),{code:'PLAN_SOURCE_STALE'});assert.equal(await s.ledger.get(preview.event.id),null);assert.equal((await s.plans.read('world',s.id)).revision,2);
});
test('changes during durable submission staging are caught before canonical admission',async()=>{
 const s=await setup({published:true});await s.acknowledge();const preview=await s.gateway.preview(s.selection(2)),stage=s.plans.stageSubmission.bind(s.plans);
 s.plans.stageSubmission=async spec=>{const row=await stage(spec);await s.state.apply({key:'plan-source',value:4},{operationId:'ep:operation:plan_stage_changed001'});return row;};
 await assert.rejects(()=>s.gateway.submit(s.selection(2),{approved:true}),{code:'PLAN_SOURCE_STALE'});assert.equal(await s.ledger.get(preview.event.id),null);assert.equal((await s.plans.read('world',s.id)).data.state,'submitted-for-gm-effects');
});
test('an interrupted staged submission resumes the same intent after service reconstruction',async()=>{
 const s=await setup();await s.acknowledge();const preview=await s.gateway.preview(s.selection(2)),ingest=s.router.ingest.bind(s.router);s.router.ingest=async()=>{throw Error('Interrupted before event intake');};
 await assert.rejects(()=>s.gateway.submit(s.selection(2),{approved:true}),/Interrupted/);assert.equal(await s.ledger.get(preview.event.id),null);assert.equal((await s.plans.read('world',s.id)).revision,3);
 await assert.rejects(()=>s.compose().submit(s.selection(2),{approved:true}),{code:'REVISION_CONFLICT'});s.router.ingest=ingest;
 const recovered=await s.compose().submit(s.selection(3),{approved:true});assert.equal(recovered.eventId,preview.event.id);assert.equal(recovered.status,'review-required');
});
test('already accepted uncertain intents require explicit event recovery and never rerun graph evaluation',async()=>{
 const s=await setup({published:true});await s.acknowledge();const result=await s.gateway.submit(s.selection(2),{approved:true});await s.ledger.transition(result.eventId,'review-required','uncertain');
 await s.state.apply({key:'plan-source',value:5},{operationId:'ep:operation:plan_after_accept001'});s.router.ingest=()=>{throw Error('Unexpected replay');};
 const retry=await s.compose().submit(s.selection(3),{approved:true});assert.equal(retry.persistedState,'uncertain');assert.equal(retry.status,'duplicate-or-recovery-required');assert.equal(await s.state.get({key:'committed-suggestion',value:null}),null);
});
test('reviewed plans are immutable and stale acknowledgements or revisions cannot replace their scenario',async()=>{
 const s=await setup();await s.acknowledge();
 await assert.rejects(()=>s.plans.create({id:s.id,mode:s.mode,scenario:s.scenario,sourceEventId:'ep:event:gm_edit_review001',expectedRevision:2}),{code:'PLAN_FINAL'});
 await assert.rejects(()=>s.gateway.submit(s.selection(1),{approved:true}),{code:'REVISION_CONFLICT'});
 const result=await s.gateway.submit(s.selection(2),{approved:true});assert.equal(result.planRevision,3);
 await assert.rejects(()=>s.plans.acknowledge({id:s.id,expectedRevision:3,approvalEventId:'ep:event:gm_reacknowledge001'}),{code:'PLAN_STATE'});
});
test('a manually claimed plan payload lacks the verified reviewed-plan producer capability',async()=>{
 const s=await setup();const result=await s.router.ingest({id:'ep:event:claimed_reviewedplan001',eventType:'narrative.reviewed-plan',source:{kind:'gm-approved-intent',requestId:'ep:request:claimed_reviewedplan001'},payload:{planId:s.id,verified:true,planRevision:2,suggestion:{hypotheticalFacts:{desired:999}}}});
 assert.equal(result.proposals,0);assert.equal(await s.state.get({key:'committed-suggestion',value:null}),null);
});
test('current GM and designated writer authority are rechecked after durable staging',async()=>{
 const s=await setup();await s.acknowledge();const stage=s.plans.stageSubmission.bind(s.plans);s.plans.stageSubmission=async spec=>{const row=await stage(spec);s.writer.assertEligible=()=>{throw Object.assign(Error('writer changed'),{code:'NOT_DESIGNATED_GM'});};return row;};
 await assert.rejects(()=>s.gateway.submit(s.selection(2),{approved:true}),{code:'NOT_DESIGNATED_GM'});s.user.isGM=false;await assert.rejects(()=>s.gateway.preview(s.selection(3)),{code:'GM_AUTHORITY_REVOKED'});
});
test('planning input is snapshotted before asynchronous reads and simulation',async()=>{
 const s=await setup(),scenario=structuredClone(s.scenario),originalRead=s.plans.read.bind(s.plans);let release;
 s.plans.read=async(...args)=>{await new Promise(resolve=>{release=resolve;});return originalRead(...args);};
 const pending=s.plans.create({id:'ep:plan:input_snapshot001',mode:'what-if',scenario,sourceEventId:'ep:event:plan_snapshot001'});scenario.hypotheses[0].value=99;release();
 const row=await pending;assert.equal(row.data.scenario.hypotheses[0].value,9);assert.equal(row.data.preview.hypotheticalFacts.desired,9);
});
