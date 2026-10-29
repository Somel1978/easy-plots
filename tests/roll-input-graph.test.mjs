import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {FoundryD20RollCoordinator} from '../src/platform/foundry-rolls.mjs';
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
async function setup({threshold=12,nested=false}={}){
 const repository=new MemoryPartitionRepository(),user={id:'GM_RollInputs001',isGM:true},context=createLocalGMContext({user,epoch:'roll-inputs'},'world'),gmProvider=()=>context;let diceCalls=0;
 class RollFixture{constructor(formula,data){this.total=11+data.modifier;}async evaluate(){diceCalls++;return this;}}
 const rolls=new FoundryD20RollCoordinator({repository,gmProvider,RollClass:RollFixture,authorizeActor:async()=>true}),attemptId='ep:attempt:authoritative_graph001',sourceEventId='ep:event:original_mechanical001';
 const {record:roll}=await rolls.resolve({attemptId,sourceEventId,actorId:'ep:actor:checked_character001',mode:'active',modifier:3,dc:15,partialMargin:2});
 const readRoll=(kind,id)=>rolls.get(id),catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})}),ledger=new DurableEventLedger({repository,gmProvider}),state=createNarrativeStateProvider({repository,gmProvider}),readState=({scope,key})=>state.get({scope,key,value:null}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider,stateReader:readState,rollReader:readRoll});
 const providers=new EffectProviderRegistry();providers.register(state);const journal=new MemoryOperationJournal(),reviews=new DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal,readRoll});
 const rollData={rollKind:'d20',attemptId,expectedRevision:roll.revision,side:'self',field:'total',valueType:'number'},model=new GraphEditorModel({registry});model.newGraph('Verified roll condition');let source,sourcePortId='value';
 if(nested){const child=new GraphEditorModel({registry});child.newGraph('Verified mechanical library');const value=child.addNode('core.roll.value');child.updateSelected({payloadJSON:JSON.stringify(rollData)});const output=child.addNode('core.data.export');child.updateSelected({payloadJSON:'{"name":"total","valueType":"number"}'});child.connect(value,output,{sourcePortId:'value',targetPortId:'input'});await child.save();const snapshot=await child.publish();source=model.addNode('core.data.call');model.updateSelected({payloadJSON:JSON.stringify({graphId:snapshot.id,publishedVersion:snapshot.publishedVersion,inputs:[],outputs:[{name:'total',valueType:'number'}]})});sourcePortId='result-total';}
 else{source=model.addNode('core.roll.value');model.updateSelected({payloadJSON:JSON.stringify(rollData)});}
 const constant=model.addNode('core.data.literal');model.updateSelected({payloadJSON:JSON.stringify({valueType:'number',value:threshold})});const compare=model.addNode('core.data.compare');model.connect(source,compare,{sourcePortId,targetPortId:'left'});model.connect(constant,compare,{sourcePortId:'value',targetPortId:'right'});
 const branch=model.addNode('core.branch.data');model.connect(compare,branch,{sourcePortId:'value',targetPortId:'predicate'});model.connect(model.graph.rootNodeId,branch);
 const effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"verified-mechanical-result","value":null}'});model.bindSelectedInput({field:'value',sourceNodeId:source,sourcePortId});model.connect(branch,effect,{sourcePortId:'true',targetPortId:'in'});await model.save();const graph=await model.publish();await model.activate(graph.publishedVersion);
 const event={id:'ep:event:condition_from_roll001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{total:999,outcome:'success',verified:true}},propose=async()=>{assert.equal((await router.ingest(event)).status,'review-required');return (await ledger.get(event.id)).proposals[0];};
 return {repository,user,gmProvider,rolls,roll,attemptId,sourceEventId,readRoll,catalog,registry,ledger,state,readState,router,providers,journal,reviews,model,graph,event,propose,get diceCalls(){return diceCalls;}};
}
for(const nested of [false,true])test(`ADR-088: ${nested?'published data subgraph':'direct condition'} records native roll inputs, revision and provenance through approved one-time effects`,async()=>{
 const s=await setup({nested}),p=await s.propose(),entry=await s.ledger.get(s.event.id),observation=entry.evaluations[0].inputObservations[0];
 assert.equal(p.payload.value,14);assert.equal(observation.attemptId,s.attemptId);assert.equal(observation.revision,s.roll.revision);assert.equal(observation.sourceEventId,s.sourceEventId);assert.deepEqual(observation.inputs,s.roll.request);assert.equal(observation.value,14);assert.equal(p.guardInputs[0].stateInputs[0].recordDigest,observation.recordDigest);
 assert.equal((await s.state.get({key:'verified-mechanical-result',value:null})),null);await s.reviews.decide(s.event.id,p.operationId,{approve:true});assert.equal((await s.reviews.execute(s.event.id,p.operationId)).status,'completed');assert.equal((await s.state.get({key:'verified-mechanical-result',value:null})).value,14);assert.equal(s.diceCalls,1);assert.equal((await s.journal.get(p.idempotencyKey)).guardInputs[0].stateInputs[0].attemptId,s.attemptId);
});
for(const approved of [false,true])test(`roll source revision changes ${approved?'after':'before'} GM approval block effects without rerolling`,async()=>{
 const s=await setup(),p=await s.propose();if(approved)await s.reviews.decide(s.event.id,p.operationId,{approve:true});await s.repository.put({...s.roll,total:14},{expectedRevision:s.roll.revision});
 await assert.rejects(approved?s.reviews.execute(s.event.id,p.operationId):s.reviews.decide(s.event.id,p.operationId,{approve:true}),{code:'ROLL_INPUT_STALE'});assert.equal(await s.journal.get(p.idempotencyKey),null);assert.equal(s.diceCalls,1);
});
test('a blocked mechanical branch retains its input evidence even when it proposes no effect',async()=>{
 const s=await setup({threshold:30});assert.equal((await s.router.ingest(s.event)).status,'evaluated');const entry=await s.ledger.get(s.event.id);assert.equal(entry.proposals.length,0);assert.equal(entry.evaluations[0].inputObservations[0].value,14);assert.equal(s.diceCalls,1);
});
test('missing roll readers and forged event-payload results cannot supply authoritative mechanics',async()=>{
 const s=await setup(),router=new DurableReactiveRouter({registry:s.registry,catalog:s.catalog,ledger:s.ledger,gmProvider:s.gmProvider});assert.equal((await router.ingest(s.event)).reason,'ROLL_READ_UNAVAILABLE');assert.equal((await s.ledger.get(s.event.id)).proposals?.length??0,0);assert.equal(s.diceCalls,1);
});
test('simulation and saved-plan submission revalidate roll observations without native evaluation or effects',async()=>{
 const s=await setup(),domains=new NarrativeDomainStore({repository:s.repository,gmProvider:s.gmProvider}),plans=new PersistentGMPlans({domainStore:domains,simulatePublished:spec=>s.router.simulatePublished(spec)}),id='ep:plan:verified_roll_plan001';
 const created=await plans.create({id,mode:'published-graph',scenario:{graphId:s.graph.id,publishedVersion:s.graph.publishedVersion,event:s.event},sourceEventId:'ep:event:mechanical_plan001'});assert.equal(created.data.preview.sourceObservations[0].kind,'native-roll');assert.equal(created.data.preview.sourceObservations[0].value,14);assert.equal(s.diceCalls,1);assert.equal(await s.ledger.get(s.event.id),null);
 await plans.acknowledge({id,expectedRevision:created.revision,approvalEventId:'ep:event:mechanical_plan_review001'});const gateway=new ReviewedPlanEventGateway({plans,router:s.router,ledger:s.ledger,readState:s.readState,readRoll:s.readRoll,gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},worldId:'world'});assert.equal((await gateway.preview({id,expectedRevision:2})).effectsExecuted,0);
 await s.repository.put({...s.roll,total:14},{expectedRevision:s.roll.revision});await assert.rejects(gateway.preview({id,expectedRevision:2}),{code:'PLAN_SOURCE_STALE'});assert.equal(s.diceCalls,1);assert.equal(await s.state.get({key:'verified-mechanical-result',value:null}),null);
});
