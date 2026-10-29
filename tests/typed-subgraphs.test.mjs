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
import {validateGraph} from '../src/graph/validate.mjs';
import {dataNodePorts,assertPublishedDataInterface,publishedDataInterface} from '../src/graph/typed-data.mjs';
function suite(){
  const repository=new MemoryPartitionRepository(),ctx=createLocalGMContext({user:{id:'gm_subgraph001',isGM:true},epoch:'subgraph'},'world'),gmProvider=()=>ctx;
  const registry=new PersistentGraphRegistry({repository,gmProvider}),state=createNarrativeStateProvider({repository,gmProvider});
  const readState=({scope,key})=>state.get({scope,key,value:null}),readGraph=(id,version)=>registry.getPublished(id,version);
  return {repository,gmProvider,registry,state,readState,readGraph};
}
async function library(s,{type='number',state=false}={}){
  const model=new GraphEditorModel({registry:s.registry});model.newGraph('Data library');
  const source=model.addNode(state?'core.state.value':'core.data.parameter');
  model.updateSelected({payloadJSON:JSON.stringify(state?{scope:'world',key:'library-state',valueType:type,expectedRevision:null}:{name:'argument',valueType:type})});
  const exported=model.addNode('core.data.export');model.updateSelected({payloadJSON:JSON.stringify({name:'answer',valueType:type})});
  model.connect(source,exported,{sourcePortId:'value',targetPortId:'input'});
  await model.save();const graph=await model.publish();return {model,graph,source,exported};
}
function parent(s,child,{value=5,type='number'}={}){
  const model=new GraphEditorModel({registry:s.registry});model.newGraph('Typed parent');
  let arg=null;
  const spec=publishedDataInterface(child.graph);
  if(spec.inputs.length){arg=model.addNode('core.data.literal');model.updateSelected({payloadJSON:JSON.stringify({valueType:type,value})});}
  const call=model.addNode('core.data.call');model.updateSelected({payloadJSON:JSON.stringify({graphId:child.graph.id,publishedVersion:child.graph.publishedVersion,...spec})});
  if(arg)model.connect(arg,call,{sourcePortId:'value',targetPortId:'param-argument'});
  const effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"nested-output","value":null}'});
  model.connect(model.graph.rootNodeId,effect);model.bindSelectedInput({field:'value',sourceNodeId:call,sourcePortId:'result-answer'});
  return {model,call,effect,arg};
}
test('ADR-005: typed child inputs and outputs preserve values through a pinned published interface',async()=>{
  const s=suite(),child=await library(s),p=parent(s,child);await p.model.save();const graph=await p.model.publish();
  const frame=new GraphDataFrame(graph,s);assert.deepEqual(await frame.payload(graph.nodes.find(n=>n.id===p.effect)),{key:'nested-output',value:5});
  assert.deepEqual(frame.stateInputs,[]);
});
test('ADR-005: parent remains pinned to its original immutable child version',async()=>{
  const s=suite(),child=await library(s),p=parent(s,child);await p.model.save();const old=await p.model.publish();
  child.model.selectNode(child.source);child.model.rename('Updated library');await child.model.save();const next=await child.model.publish();
  assert.equal(next.publishedVersion,2);
  const frame=new GraphDataFrame(old,s);assert.equal((await frame.payload(old.nodes.find(n=>n.id===p.effect))).value,5);
  assert.equal(old.nodes.find(n=>n.id===p.call).data.publishedVersion,1);
});
test('typed subgraph publication rejects mismatched names and types before activation',async()=>{
  const s=suite(),child=await library(s),p=parent(s,child);const g=p.model.graph,n=g.nodes.find(n=>n.id===p.call);
  n.data.outputs[0].name='renamed';n.ports=dataNodePorts(n.typeId,undefined,n.data);
  g.edges.find(e=>e.source.nodeId===p.call).source.portId='result-renamed';
  const draft=await s.registry.saveDraft(g);await assert.rejects(s.registry.publish(g.id,{expectedRevision:draft.revision}),{code:'DATA_INTERFACE_STALE'});
});
test('typed calls cannot publish without the exact child snapshot',async()=>{
  const s=suite(),child=await library(s),p=parent(s,child),g=p.model.graph;
  g.nodes.find(n=>n.id===p.call).data.publishedVersion=2;const d=await s.registry.saveDraft(g);
  await assert.rejects(s.registry.publish(g.id,{expectedRevision:d.revision}),{code:'SUBGRAPH_UNAVAILABLE'});
});
test('duplicate exported names and parameter names are publication blockers',async()=>{
  const s=suite(),child=await library(s),g=child.model.graph;
  const original=g.nodes.find(n=>n.typeId==='core.data.export');g.nodes.push({...structuredClone(original),id:'ep:node:duplicate_export001'});
  assert.throws(()=>validateGraph(g),{code:'DATA_INTERFACE'});
});
test('typed call parameters have exact cardinality and type contracts',async()=>{
  const s=suite(),child=await library(s),p=parent(s,child),g=p.model.graph;
  g.edges=g.edges.filter(e=>e.target.nodeId!==p.call);assert.throws(()=>validateGraph(g),{code:'DATA_CARDINALITY'});
  await assert.rejects(s.registry.saveDraft(g),{code:'DATA_CARDINALITY'});
});
test('unbound parameters are never filled from event payloads or defaults',async()=>{
  const s=suite(),child=await library(s),frame=new GraphDataFrame(child.graph,s);
  await assert.rejects(frame.value(child.exported),{code:'DATA_PARAMETER_MISSING'});
});
test('multi-level typed calls share bounded dependencies without running child effects',async()=>{
  const s=suite(),child=await library(s),middle=parent(s,child,{value:8});
  // Export the child result from the middle graph. Its effect stays merely authored.
  middle.model.addNode('core.data.export');middle.model.updateSelected({payloadJSON:'{"name":"answer","valueType":"number"}'});
  middle.model.connect(middle.call,middle.model.selectedNode.id,{sourcePortId:'result-answer',targetPortId:'input'});
  await middle.model.save();const graph=await middle.model.publish();const top=parent(s,{graph});await top.model.save();const published=await top.model.publish();
  const frame=new GraphDataFrame(published,s);assert.equal((await frame.payload(published.nodes.find(n=>n.id===top.effect))).value,8);
  assert.equal(await s.state.get({key:'nested-output',value:null}),null);
});
test('typed nested state lineage is rechecked by the ordinary GM effect review',async()=>{
  const s=suite(),child=await library(s,{state:true}),catalog=new ActiveTriggerCatalog(s);
  const indexed=new IndexedGraphRegistry({catalog,registry:s.registry}),model=parent({...s,registry:indexed},child);
  await s.state.apply({key:'library-state',value:17},{operationId:'ep:operation:subgraph_seed001'});
  await model.model.save();const published=await model.model.publish();await model.model.activate(published.publishedVersion);
  const ledger=new DurableEventLedger(s),providers=new EffectProviderRegistry();providers.register(s.state);
  const router=new DurableReactiveRouter({...s,registry:indexed,catalog,ledger,stateReader:s.readState});
  const event={id:'ep:event:typed_nested001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}};
  assert.equal((await router.ingest(event)).status,'review-required');const p=(await ledger.get(event.id)).proposals[0];
  assert.equal(p.payload.value,17);assert.equal(p.stateInputs[0].graphId,child.graph.id);
  const review=new DurableProposalReview({...s,registry:indexed,ledger,providers,journal:new MemoryOperationJournal()});
  await review.decide(event.id,p.operationId,{approve:true});
  await s.state.apply({key:'library-state',value:17},{operationId:'ep:operation:subgraph_changed001'});
  await assert.rejects(review.execute(event.id,p.operationId),{code:'DATA_REVISION_STALE'});
});
test('self-calls and indirect recursive data calls fail closed',async()=>{
  const s=suite(),child=await library(s),p=parent(s,child),g=p.model.graph;
  const call=g.nodes.find(n=>n.id===p.call);call.data.graphId=g.id;
  assert.throws(()=>validateGraph(g),{code:'SUBGRAPH_RECURSION'});
  call.data.graphId=child.graph.id;
  const frame=new GraphDataFrame(g,{...s,stack:[g.id,child.graph.id]});
  await assert.rejects(frame.payload(g.nodes.find(n=>n.id===p.effect)),{code:'SUBGRAPH_RECURSION'});
});
test('protected child reader absence cannot be treated as an empty successful result',async()=>{
  const s=suite(),child=await library(s),p=parent(s,child),frame=new GraphDataFrame(p.model.graph);
  await assert.rejects(frame.payload(p.model.graph.nodes.find(n=>n.id===p.effect)),{code:'SUBGRAPH_UNAVAILABLE'});
});
test('immutable child interface comparisons are independent of declaration ordering',async()=>{
  const s=suite(),child=await library(s),p=parent(s,child),call=p.model.graph.nodes.find(n=>n.id===p.call);
  assert.doesNotThrow(()=>assertPublishedDataInterface(call,child.graph));
  const bad=structuredClone(child.graph);bad.nodes.find(n=>n.id===child.exported).disabled=true;
  assert.throws(()=>assertPublishedDataInterface(call,bad),{code:'DATA_INTERFACE_STALE'});
});
