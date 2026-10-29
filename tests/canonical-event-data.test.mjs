import test from 'node:test';
import assert from 'node:assert/strict';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {GraphDataFrame} from '../src/runtime/graph-data-frame.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {createNarrativeStateProvider} from '../src/runtime/native-state-provider.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
function suite(){
  const repository=new MemoryPartitionRepository(),ctx=createLocalGMContext({user:{id:'gm_eventdata001',isGM:true},epoch:'event'},'world'),gmProvider=()=>ctx;
  const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})});
  const ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
  const state=createNarrativeStateProvider({repository,gmProvider}),providers=new EffectProviderRegistry();providers.register(state);
  const review=new DurableProposalReview({repository,registry,ledger,providers,journal:new MemoryOperationJournal(),gmProvider});
  const model=new GraphEditorModel({registry});model.newGraph('Canonical event data');
  const source=model.addNode('core.data.event');model.updateSelected({payloadJSON:'{"path":["payload","amount"],"valueType":"number"}'});
  const effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"event-value","value":null}'});
  model.connect(model.graph.rootNodeId,effect);model.bindSelectedInput({field:'value',sourceNodeId:source});
  const event={id:'ep:event:typed_event001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{amount:7}};
  const ready=async()=>{await model.save();const p=await model.publish();await model.activate(p.publishedVersion);};
  return {repository,catalog,ledger,router,state,review,model,source,effect,event,ready};
}
test('ADR-070: typed event values use the persisted canonical occurrence throughout approval',async()=>{
  const s=suite();await s.ready();assert.equal((await s.router.ingest(s.event)).status,'review-required');
  const p=(await s.ledger.get(s.event.id)).proposals[0];assert.equal(p.payload.value,7);
  s.event.payload.amount=99;
  await s.review.decide(s.event.id,p.operationId,{approve:true});assert.equal((await s.review.execute(s.event.id,p.operationId)).status,'completed');
  assert.equal((await s.state.get({key:'event-value',value:null})).value,7);
});
test('ADR-004: event comparison produces a typed boolean consumed by an exclusive flow branch',async()=>{
  const s=suite();s.model.unbindSelectedInput('value');s.model.disconnect(s.model.graph.edges.find(e=>e.kind==='flow').id);
  const literal=s.model.addNode('core.data.literal');s.model.updateSelected({payloadJSON:'{"valueType":"number","value":6}'});
  const compare=s.model.addNode('core.data.compare');s.model.updateSelected({payloadJSON:'{"valueType":"boolean","operandType":"number","operator":"gt"}'});
  s.model.connect(s.source,compare,{sourcePortId:'value',targetPortId:'left'});s.model.connect(literal,compare,{sourcePortId:'value',targetPortId:'right'});
  const branch=s.model.addNode('core.branch.data');s.model.connect(compare,branch,{sourcePortId:'value',targetPortId:'predicate'});
  s.model.connect(s.model.graph.rootNodeId,branch);s.model.connect(branch,s.effect,{sourcePortId:'true'});
  await s.ready();assert.equal((await s.router.ingest(s.event)).status,'review-required');
  const p=(await s.ledger.get(s.event.id)).proposals[0];assert.equal(p.guardInputs[0].selectedPort,'true');
  await s.review.decide(s.event.id,p.operationId,{approve:true});assert.equal((await s.review.execute(s.event.id,p.operationId)).status,'completed');
});
test('canonical event data cannot resolve without an explicit runtime event context',async()=>{
  const s=suite(),frame=new GraphDataFrame(s.model.graph);
  await assert.rejects(frame.value(s.source),{code:'DATA_EVENT_UNAVAILABLE'});
});
test('missing or differently typed event fields fail closed without default coercion',async()=>{
  for(const payload of [{},{amount:'7'}]){
    const s=suite();s.event.payload=payload;await s.ready();
    assert.equal((await s.router.ingest(s.event)).reason,Object.hasOwn(payload,'amount')?'DATA_TYPE':'DATA_EVENT_PATH');
  }
});
test('canonical event extraction rejects inherited properties and unsafe paths',async()=>{
  const s=suite();s.model.selectNode(s.source);
  for(const path of [['payload','__proto__'],['constructor'],['payload','prototype'],['payload','a.b']])
    assert.throws(()=>s.model.updateSelected({payloadJSON:JSON.stringify({path,valueType:'json'})}),{code:'DATA_EVENT_PATH'});
  const frame=new GraphDataFrame(s.model.graph,{event:{payload:Object.create({amount:9})}});
  await assert.rejects(frame.value(s.source),{code:'DATA_EVENT_PATH'});
});
test('ADR-088: protected canonical event corruption is detected before effect approval',async()=>{
  const s=suite();await s.ready();await s.router.ingest(s.event);const row=await s.ledger.get(s.event.id),p=row.proposals[0];
  row.event.payload.amount=123;await s.repository.put(row,{expectedRevision:row.revision});
  await assert.rejects(s.ledger.get(s.event.id),{code:'EVENT_CORRUPT'});
  await assert.rejects(s.review.decide(s.event.id,p.operationId,{approve:true}),{code:'EVENT_CORRUPT'});
});
test('canonical event inputs cannot change while subscription lookup is pending',async()=>{
  const s=suite();await s.ready();const lookup=s.catalog.lookup.bind(s.catalog);
  let release,entered;const gate=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
  s.catalog.lookup=async type=>{entered();await gate;return lookup(type);};
  const running=s.router.ingest(s.event);await started;s.event.payload.amount=99;release();
  assert.equal((await running).status,'review-required');const saved=await s.ledger.get(s.event.id);
  assert.equal(saved.event.payload.amount,7);assert.equal(saved.proposals[0].payload.value,7);
});
