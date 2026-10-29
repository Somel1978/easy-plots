import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {createNarrativeStateProvider} from '../src/runtime/native-state-provider.mjs';
import {PersistentGMPlans} from '../src/orchestration/persistent-plans.mjs';
async function setup(){
 const repository=new MemoryPartitionRepository(),user={id:'gm_simulation001',isGM:true},ctx=createLocalGMContext({user,epoch:'simulation'},'world'),gmProvider=()=>ctx;
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})}),ledger=new DurableEventLedger({repository,gmProvider}),state=createNarrativeStateProvider({repository,gmProvider});
 await state.apply({key:'actor-health',value:3},{operationId:'ep:operation:simulation_seed001'});
 const model=new GraphEditorModel({registry});model.newGraph('Published actor plan');const value=model.addNode('core.state.value');model.updateSelected({payloadJSON:'{"scope":"world","key":"actor-health","valueType":"number","expectedRevision":null}'});
 const effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'native.actor.set-health',payloadJSON:'{"actorUuid":"Actor.real_bound001","value":null}'});model.bindSelectedInput({field:'value',sourceNodeId:value});model.connect(model.graph.rootNodeId,effect);
 await model.save();const graph=await model.publish();
 const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider,stateReader:({scope,key})=>state.get({scope,key,value:null})});
 const event={id:'ep:event:published_simulation001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}};
 const spec={graphId:graph.id,publishedVersion:graph.publishedVersion,event};
 return {repository,user,gmProvider,catalog,registry,ledger,state,model,graph,effect,router,spec};
}
test('ADR-025: an actual published graph with native Actor effects simulates without event, journal or document writes',async()=>{
 const s=await setup();let writes=0;s.repository.put=async()=>{writes++;throw Error('Native write attempted during simulation');};s.ledger.accept=async()=>{throw Error('Real event intake attempted');};s.catalog.lookup=async()=>{throw Error('Simulation scanned active plots');};
 const preview=await s.router.simulatePublished(s.spec);assert.equal(preview.proposals[0].payload.actorUuid,'Actor.real_bound001');assert.equal(preview.proposals[0].payload.value,3);
 assert.equal(preview.outcomes[0].status,'simulated-completed');assert.equal(preview.effectsExecuted,0);assert.equal(preview.canonicalEventsCreated,0);assert.equal(preview.nativeProviders,'not-invoked-or-qualified');assert.equal(writes,0);
 assert.equal((await s.state.get({key:'actor-health',value:null})).value,3);assert.equal(await s.ledger.get(s.spec.event.id),null);assert.match(preview.proposals[0].operationId,/^ep:simulation-operation:/);assert.equal(preview.proposals[0].state,'simulation-only');
});
test('published graph hypotheses change only isolated value inputs while preserving their observed canonical revisions',async()=>{
 const s=await setup(),preview=await s.router.simulatePublished({...s.spec,hypotheses:[{scope:'world',key:'actor-health',value:9,expectedRevision:1}]});
 assert.equal(preview.proposals[0].payload.value,9);assert.deepEqual(preview.sourceObservations,[{scope:'world',key:'actor-health',revision:1}]);
 assert.equal((await s.state.get({key:'actor-health',value:null})).value,3);
 await s.state.apply({key:'actor-health',value:3},{operationId:'ep:operation:simulation_changed001'});
 await assert.rejects(()=>s.router.simulatePublished({...s.spec,hypotheses:[{scope:'world',key:'actor-health',value:9,expectedRevision:1}]}),{code:'SIMULATION_SOURCE_STALE'});
});
test('ADR-075: injectable apply acknowledgement and verification faults exercise the real effect coordinator using isolated providers',async()=>{
 const s=await setup();for(const [stage,code] of [['apply-ack','APPLY_OR_ACK_FAILED'],['verification','VERIFICATION_FAILED']]){
  const result=await s.router.simulatePublished({...s.spec,faults:[{nodeId:s.effect,stage}]});assert.equal(result.outcomes[0].status,'simulated-uncertain');assert.equal(result.outcomes[0].failureCode,code);assert.equal(result.outcomes[0].attempts,1);assert.equal(result.effectsExecuted,0);
 }
 assert.equal(await s.ledger.get(s.spec.event.id),null);assert.equal((await s.state.get({key:'actor-health',value:null})).value,3);
});
test('published simulation remains pinned to the selected immutable revision and needs no activation',async()=>{
 const s=await setup();s.model.rename('Changed draft');await s.model.save();await s.model.publish();
 const result=await s.router.simulatePublished(s.spec);assert.equal(result.publishedVersion,1);assert.equal(await s.registry.getActive(s.graph.id),null);
 await assert.rejects(()=>s.router.simulatePublished({...s.spec,publishedVersion:99}),{code:'SUBGRAPH_UNAVAILABLE'});
});
test('simulation validates event-source filters and rejects unsupported faults or excessive hypotheses',async()=>{
 const s=await setup();const noMatch=await s.router.simulatePublished({...s.spec,event:{...s.spec.event,eventType:'unrelated.event'}});assert.equal(noMatch.status,'no-matching-entry');assert.equal(noMatch.proposals.length,0);
 await assert.rejects(()=>s.router.simulatePublished({...s.spec,faults:[{nodeId:'ep:node:unknown_simulation001',stage:'verification'}]}),{code:'SIMULATION_FAULT'});
 await assert.rejects(()=>s.router.simulatePublished({...s.spec,hypotheses:new Array(17).fill({})}),{code:'SIMULATION_BUDGET'});
});
test('extension callbacks are rejected before execution in published simulation',async()=>{
 const s=await setup(),graph=structuredClone(s.graph);graph.nodes.find(n=>n.id===s.effect).typeId='thirdparty.unsafe-action';let calls=0;
 const router=new DurableReactiveRouter({registry:{getActive:async()=>null,getPublished:async()=>graph},catalog:s.catalog,ledger:s.ledger,gmProvider:s.gmProvider,stateReader:({scope,key})=>s.state.get({scope,key,value:null}),extensions:{get(){calls++;},route(){calls++;}}});
 await assert.rejects(()=>router.simulatePublished(s.spec),{code:'SIMULATION_EXTENSION_UNAVAILABLE'});assert.equal(calls,0);assert.equal(await s.ledger.get(s.spec.event.id),null);
});
test('published simulation is available to durable GM planning without executing its proposed effects',async()=>{
 const s=await setup(),domains=new NarrativeDomainStore(s),plans=new PersistentGMPlans({domainStore:domains,simulatePublished:spec=>s.router.simulatePublished(spec)});
 const row=await plans.create({id:'ep:plan:published_sim001',mode:'published-graph',scenario:s.spec,sourceEventId:'ep:event:planning_simulation001'});
 assert.equal(row.data.preview.kind,'published-graph-simulation');assert.equal(row.data.preview.effectsExecuted,0);assert.equal(await s.ledger.get(s.spec.event.id),null);
 assert.equal((await s.state.get({key:'actor-health',value:null})).value,3);
 const unconfigured=new PersistentGMPlans({domainStore:domains});await assert.rejects(()=>unconfigured.create({id:'ep:plan:unconfigured_sim001',mode:'published-graph',scenario:s.spec,sourceEventId:'ep:event:planning_simulation001'}),{code:'PLAN_SIMULATION_UNAVAILABLE'});
});
test('GM revocation blocks published simulation before accessing protected graph data',async()=>{
 const s=await setup();s.user.isGM=false;await assert.rejects(()=>s.router.simulatePublished(s.spec),{code:'GM_AUTHORITY_REVOKED'});
});
