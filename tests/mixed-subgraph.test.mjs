import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {publishedDataInterface,dataNodePorts} from '../src/graph/typed-data.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {createNarrativeStateProvider} from '../src/runtime/native-state-provider.mjs';
function setup(){
 const repository=new MemoryPartitionRepository(),ctx=createLocalGMContext({user:{id:'gm_mixed001',isGM:true},epoch:'mixed'},'world'),gmProvider=()=>ctx;
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})});
 const state=createNarrativeStateProvider({repository,gmProvider}),ledger=new DurableEventLedger({repository,gmProvider}),providers=new EffectProviderRegistry();providers.register(state);
 const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider,stateReader:({scope,key})=>state.get({scope,key,value:null})});
 const review=new DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal:new MemoryOperationJournal()});
 return {repository,gmProvider,catalog,registry,state,ledger,router,review};
}
async function child(s,{branch=false,noExport=false}={}){
 const model=new GraphEditorModel(s);model.newGraph('Mixed function');const type=branch?'boolean':'number';
 const input=model.addNode('core.data.parameter');model.updateSelected({payloadJSON:JSON.stringify({name:'argument',valueType:type})});
 if(!noExport){const output=model.addNode('core.data.export');model.updateSelected({payloadJSON:JSON.stringify({name:'answer',valueType:type})});model.connect(input,output,{sourcePortId:'value',targetPortId:'input'});}
 const effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"mixed-child","value":null}'});model.bindSelectedInput({field:'value',sourceNodeId:input});
 if(branch){const gate=model.addNode('core.branch.data');model.connect(input,gate,{sourcePortId:'value',targetPortId:'predicate'});model.connect(model.graph.rootNodeId,gate);model.connect(gate,effect,{sourcePortId:'true',targetPortId:'in'});}
 else model.connect(model.graph.rootNodeId,effect);
 await model.save();return {model,graph:await model.publish(),effect,type};
}
async function parent(s,c,{value=9,stateInput=false,flow=true,parentEffect=true}={}){
 const model=new GraphEditorModel(s);model.newGraph('Mixed caller');const argument=model.addNode(stateInput?'core.state.value':'core.data.literal');
 model.updateSelected({payloadJSON:JSON.stringify(stateInput?{scope:'world',key:'mixed-argument',valueType:c.type,expectedRevision:null}:{valueType:c.type,value})});
 const call=model.addNode('core.subgraph.mixed');model.updateSelected({payloadJSON:JSON.stringify({graphId:c.graph.id,publishedVersion:c.graph.publishedVersion,...publishedDataInterface(c.graph)})});
 model.connect(argument,call,{sourcePortId:'value',targetPortId:'param-argument'});if(flow)model.connect(model.graph.rootNodeId,call);
 let effect=null;if(parentEffect){effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"mixed-parent","value":null}'});
  model.bindSelectedInput({field:'value',sourceNodeId:call,sourcePortId:'result-answer'});model.connect(flow?call:model.graph.rootNodeId,effect);}
 return {model,call,effect,argument};
}
async function run(s,p,id='ep:event:mixed_call001'){
 await p.model.save();const graph=await p.model.publish();await p.model.activate(graph.publishedVersion);
 const event={id,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}};
 const result=await s.router.ingest(event);return {result,event,row:await s.ledger.get(event.id)};
}
async function apply(s,event,p){await s.review.decide(event.id,p.operationId,{approve:true});return s.review.execute(event.id,p.operationId);}
test('mixed call carries typed arguments and exports while child and parent effects require separate durable GM approval',async()=>{
 const s=setup(),c=await child(s),p=await parent(s,c),{event,row,result}=await run(s,p);assert.equal(result.status,'review-required');assert.equal(row.proposals.length,2);
 const nested=row.proposals.find(x=>x.graphId===c.graph.id),caller=row.proposals.find(x=>x.graphId===p.model.graph.id);
 assert.equal(nested.payload.value,9);assert.equal(caller.payload.value,9);assert.deepEqual(nested.callChain[0].parameters,{argument:9});
 assert.equal(await s.state.get({key:'mixed-child',value:null}),null);assert.equal(await s.state.get({key:'mixed-parent',value:null}),null);
 await apply(s,event,nested);assert.equal((await s.state.get({key:'mixed-child',value:null})).value,9);assert.equal(await s.state.get({key:'mixed-parent',value:null}),null);
 await apply(s,event,caller);assert.equal((await s.state.get({key:'mixed-parent',value:null})).value,9);
 assert.equal((await s.router.ingest(event)).status,'duplicate-or-recovery-required');
});
test('reading mixed call exports as data never schedules the child flow or its effects',async()=>{
 const s=setup(),c=await child(s),p=await parent(s,c,{flow:false}),{event,row}=await run(s,p);
 assert.equal(row.proposals.length,1);assert.equal(row.proposals[0].graphId,p.model.graph.id);await apply(s,event,row.proposals[0]);
 assert.equal((await s.state.get({key:'mixed-parent',value:null})).value,9);assert.equal(await s.state.get({key:'mixed-child',value:null}),null);
});
test('native argument revisions are rechecked before approval even when their value is unchanged',async()=>{
 const s=setup(),c=await child(s);await s.state.apply({key:'mixed-argument',value:9},{operationId:'ep:operation:mixed_arg_seed001'});
 const p=await parent(s,c,{stateInput:true}),{event,row}=await run(s,p),nested=row.proposals.find(x=>x.graphId===c.graph.id);
 await s.state.apply({key:'mixed-argument',value:9},{operationId:'ep:operation:mixed_arg_changed001'});
 await assert.rejects(()=>s.review.decide(event.id,nested.operationId,{approve:true}),{code:'DATA_REVISION_STALE'});assert.equal(await s.state.get({key:'mixed-child',value:null}),null);
});
test('native argument changes after approval block child execution',async()=>{
 const s=setup(),c=await child(s);await s.state.apply({key:'mixed-argument',value:9},{operationId:'ep:operation:mixed_arg_seed001'});
 const p=await parent(s,c,{stateInput:true}),{event,row}=await run(s,p),nested=row.proposals.find(x=>x.graphId===c.graph.id);await s.review.decide(event.id,nested.operationId,{approve:true});
 await s.state.apply({key:'mixed-argument',value:10},{operationId:'ep:operation:mixed_arg_changed001'});
 await assert.rejects(()=>s.review.execute(event.id,nested.operationId),{code:'DATA_REVISION_STALE'});assert.equal(await s.state.get({key:'mixed-child',value:null}),null);
});
test('parameter-dependent child branches are reconstructed with the same call context during GM review',async()=>{
 for(const value of [false,true]){const s=setup(),c=await child(s,{branch:true}),p=await parent(s,c,{value}),{event,row}=await run(s,p);
  const nested=row.proposals.find(x=>x.graphId===c.graph.id);assert.equal(Boolean(nested),value);if(nested){assert.equal(nested.guardInputs[0].selectedPort,'true');await apply(s,event,nested);assert.equal((await s.state.get({key:'mixed-child',value:null})).value,true);}}
});
test('two mixed invocations of the same child preserve distinct operation identities and authored argument values',async()=>{
 const s=setup(),c=await child(s),p=await parent(s,c,{value:11,parentEffect:false}),secondArgument=p.model.addNode('core.data.literal');p.model.updateSelected({payloadJSON:'{"valueType":"number","value":22}'});
 const second=p.model.addNode('core.subgraph.mixed');p.model.updateSelected({payloadJSON:JSON.stringify({graphId:c.graph.id,publishedVersion:1,...publishedDataInterface(c.graph)})});
 p.model.connect(secondArgument,second,{sourcePortId:'value',targetPortId:'param-argument'});p.model.connect(p.call,second);
 const {event,row}=await run(s,p);assert.equal(row.proposals.length,2);assert.equal(new Set(row.proposals.map(x=>x.operationId)).size,2);assert.deepEqual(row.proposals.map(x=>x.payload.value),[11,22]);
 for(const proposal of row.proposals)await apply(s,event,proposal);assert.equal((await s.state.get({key:'mixed-child',value:null})).value,22);
});
test('mixed publication validates the exact pinned child interface and never silently adopts a newer child',async()=>{
 const s=setup(),c=await child(s),p=await parent(s,c);await run(s,p);c.model.rename('Child v2');await c.model.save();await c.model.publish();
 const row=await s.ledger.get('ep:event:mixed_call001');assert.equal(row.proposals.find(x=>x.graphId===c.graph.id).publishedVersion,1);
 const g=p.model.graph,call=g.nodes.find(n=>n.id===p.call);call.data.outputs[0].name='renamed';call.ports=dataNodePorts(call.typeId,undefined,call.data);g.edges.find(e=>e.source.nodeId===call.id&&e.kind==='data').source.portId='result-renamed';
 const draft=await s.registry.saveDraft(g,{expectedRevision:g.revision});await assert.rejects(()=>s.registry.publish(g.id,{expectedRevision:draft.revision}),{code:'DATA_INTERFACE_STALE'});
});
test('typed-argument effect subgraphs can declare no exports without weakening pure data-call requirements',async()=>{
 const s=setup(),c=await child(s,{noExport:true}),p=await parent(s,c,{parentEffect:false}),{row,event}=await run(s,p);assert.equal(row.proposals.length,1);await apply(s,event,row.proposals[0]);assert.equal((await s.state.get({key:'mixed-child',value:null})).value,9);
});
