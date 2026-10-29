import test from 'node:test';
import assert from 'node:assert/strict';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {createNarrativeStateProvider} from '../src/runtime/native-state-provider.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {validateGraph} from '../src/graph/validate.mjs';
import {mergeDataGuards} from '../src/runtime/data-guards.mjs';
function suite(){
  const repository=new MemoryPartitionRepository(),ctx=createLocalGMContext({user:{id:'gm_guards001',isGM:true},epoch:'guards'},'world'),gmProvider=()=>ctx;
  const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})});
  const ledger=new DurableEventLedger({repository,gmProvider}),journal=new MemoryOperationJournal(),state=createNarrativeStateProvider({repository,gmProvider});
  const providers=new EffectProviderRegistry();providers.register(state);
  const readState=({scope,key})=>state.get({scope,key,value:null});
  const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider,stateReader:readState});
  const review=new DurableProposalReview({repository,registry,ledger,journal,providers,gmProvider}),model=new GraphEditorModel({registry});model.newGraph('Protected typed branches');
  let n=0;
  const write=(key,value)=>state.apply({key,value},{operationId:`ep:operation:guard_write_${++n}_001`});
  const publish=async()=>{await model.save();const p=await model.publish();await model.activate(p.publishedVersion);return p;};
  const event={id:'ep:event:guard_flow001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{value:999}};
  const propose=async()=>{const result=await router.ingest(event);assert.equal(result.status,'review-required');return (await ledger.get(event.id)).proposals[0];};
  return {repository,registry,catalog,ledger,journal,state,router,review,model,write,publish,event,propose};
}
function effect(s){const id=s.model.addNode('core.effect.proposal');s.model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"consequence","value":true}'});return id;}
function comparison(s,{value=10,operator='gte',type='number'}={}){
  const left=s.model.addNode('core.state.value');s.model.updateSelected({payloadJSON:JSON.stringify({scope:'world',key:'guard',valueType:type,expectedRevision:null})});
  const right=s.model.addNode('core.data.literal');s.model.updateSelected({payloadJSON:JSON.stringify({valueType:type,value})});
  const cmp=s.model.addNode('core.data.compare');s.model.updateSelected({payloadJSON:JSON.stringify({valueType:'boolean',operandType:type,operator})});
  s.model.connect(left,cmp,{sourcePortId:'value',targetPortId:'left'});s.model.connect(right,cmp,{sourcePortId:'value',targetPortId:'right'});
  const branch=s.model.addNode('core.branch.data');s.model.connect(cmp,branch,{sourcePortId:'value',targetPortId:'predicate'});
  s.model.connect(s.model.graph.rootNodeId,branch);return {left,right,cmp,branch};
}
test('ADR-006: an authoritative typed boolean selects exactly one authored branch',async()=>{
  for(const [value,selected] of [[15,'true'],[5,'false']]){
    const s=suite(),{branch}=comparison(s),yes=effect(s),no=effect(s);
    s.model.connect(branch,yes,{sourcePortId:'true'});s.model.connect(branch,no,{sourcePortId:'false'});
    await s.write('guard',value);await s.publish();const p=await s.propose();
    assert.equal(p.nodeId,selected==='true'?yes:no);assert.equal(p.guardInputs[0].selectedPort,selected);
    assert.equal(p.guardInputs[0].stateInputs.length,1);assert.equal((await s.ledger.get(s.event.id)).proposals.length,1);
  }
});
test('ADR-082: a changed guard revision blocks an otherwise static approved effect',async()=>{
  const s=suite(),{branch}=comparison(s),id=effect(s);s.model.connect(branch,id,{sourcePortId:'true'});
  await s.write('guard',15);await s.publish();const p=await s.propose();await s.review.decide(s.event.id,p.operationId,{approve:true});
  await s.write('guard',16);
  await assert.rejects(s.review.execute(s.event.id,p.operationId),{code:'DATA_REVISION_STALE'});
  assert.equal(await s.state.get({key:'consequence',value:null}),null);assert.equal(await s.journal.get(p.idempotencyKey),null);
});
test('a guard value cannot be replaced by a matching untrusted event claim',async()=>{
  const s=suite(),{branch}=comparison(s),id=effect(s);s.model.connect(branch,id,{sourcePortId:'true'});await s.publish();
  assert.equal((await s.router.ingest(s.event)).reason,'DATA_STATE_ABSENT');
});
test('valid unchanged typed-guard evidence passes durable GM approval and execution',async()=>{
  const s=suite(),{branch}=comparison(s),id=effect(s);s.model.connect(branch,id,{sourcePortId:'true'});
  await s.write('guard',20);await s.publish();const p=await s.propose();await s.review.decide(s.event.id,p.operationId,{approve:true});
  assert.equal((await s.review.execute(s.event.id,p.operationId)).status,'completed');
});
test('canonical JSON equality compares normalized content without object coercion',async()=>{
  const s=suite(),{branch}=comparison(s,{value:{a:1,b:[true]},operator:'eq',type:'json'}),id=effect(s);
  s.model.connect(branch,id,{sourcePortId:'true'});await s.write('guard',{b:[true],a:1});await s.publish();
  assert.equal((await s.propose()).guardInputs[0].selectedPort,'true');
});
test('typed string containment is explicit and never coerces numeric operands',async()=>{
  const s=suite(),{branch}=comparison(s,{value:'harbor',operator:'contains',type:'string'}),id=effect(s);
  s.model.connect(branch,id,{sourcePortId:'true'});await s.write('guard','Meet at the harbor');await s.publish();await s.propose();
  s.model.selectNode(s.model.graph.nodes.find(n=>n.typeId==='core.data.compare').id);
  assert.throws(()=>s.model.updateSelected({payloadJSON:'{"valueType":"boolean","operandType":"number","operator":"contains"}'}),{code:'DATA_COMPARISON'});
});
test('typed boolean branches reject incomplete or incompatible inputs at publication',()=>{
  const s=suite(),branch=s.model.addNode('core.branch.data');s.model.connect(s.model.graph.rootNodeId,branch);
  assert.throws(()=>validateGraph(s.model.graph),{code:'DATA_CARDINALITY'});
  const source=s.model.addNode('core.data.literal');s.model.updateSelected({payloadJSON:'{"valueType":"number","value":4}'});
  assert.throws(()=>s.model.connect(source,branch,{sourcePortId:'value',targetPortId:'predicate'}),{code:'INVALID_CONNECTION'});
});
test('legacy comparison-branch dependencies are now also revalidated after approval',async()=>{
  const s=suite(),gate=s.model.addNode('core.state.read');s.model.updateSelected({payloadJSON:'{"scope":"world","key":"guard","expectedValue":true,"expectedRevision":null}'});
  const id=effect(s);s.model.connect(s.model.graph.rootNodeId,gate);s.model.connect(gate,id,{sourcePortId:'match'});
  await s.write('guard',true);await s.publish();const p=await s.propose();await s.review.decide(s.event.id,p.operationId,{approve:true});
  await s.write('guard',true);await assert.rejects(s.review.execute(s.event.id,p.operationId),{code:'DATA_REVISION_STALE'});
});
test('absence is an authoritative branch observation invalidated when state is created',async()=>{
  const s=suite(),gate=s.model.addNode('core.state.read');s.model.updateSelected({payloadJSON:'{"scope":"world","key":"guard","expectedValue":true,"expectedRevision":null}'});
  const id=effect(s);s.model.connect(s.model.graph.rootNodeId,gate);s.model.connect(gate,id,{sourcePortId:'absent'});
  await s.publish();const p=await s.propose();assert.equal(p.guardInputs[0].stateInputs[0].revision,null);
  await s.write('guard',true);await assert.rejects(s.review.decide(s.event.id,p.operationId,{approve:true}),{code:'DATA_REVISION_STALE'});
});
test('AND joins carry the private-state evidence from every required branch',async()=>{
  const s=suite(),gates=[];
  for(const key of ['first','second']){
    const gate=s.model.addNode('core.state.read');s.model.updateSelected({payloadJSON:JSON.stringify({scope:'world',key,expectedValue:true,expectedRevision:null})});
    s.model.connect(s.model.graph.rootNodeId,gate);gates.push(gate);await s.write(key,true);
  }
  const join=s.model.addNode('core.flow.join');for(const id of gates)s.model.connect(id,join,{sourcePortId:'match'});
  const id=effect(s);s.model.connect(join,id);await s.publish();const p=await s.propose();assert.equal(p.guardInputs.length,2);
  await s.write('first',false);await assert.rejects(s.review.decide(s.event.id,p.operationId,{approve:true}),{code:'DATA_REVISION_STALE'});
});
test('conflicting convergent guard evidence fails closed rather than selecting a revision',()=>{
  const a={graphId:'ep:graph:test001',nodeId:'ep:node:guard001',selectedPort:'true',stateInputs:[]};
  assert.equal(mergeDataGuards([a],[structuredClone(a)]).length,1);
  assert.throws(()=>mergeDataGuards([a],[{...a,selectedPort:'false'}]),{code:'GUARD_INPUT_CONFLICT'});
});
test('generic static effect payloads are checked against the published template at review',async()=>{
  const s=suite(),id=effect(s);s.model.connect(s.model.graph.rootNodeId,id);await s.publish();const p=await s.propose();
  const row=await s.ledger.get(s.event.id);row.proposals[0].payload.value=false;await s.repository.put(row,{expectedRevision:row.revision});
  await assert.rejects(s.review.decide(s.event.id,p.operationId,{approve:true}),{code:'PUBLISHED_REVISION_STALE'});
});
