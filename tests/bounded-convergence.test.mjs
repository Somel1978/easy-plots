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
import {BoundedConvergenceRun,CONVERGENCE_NODE_TYPE,validateConvergenceNode} from '../src/graph/convergence.mjs';
import {validateGraph} from '../src/graph/validate.mjs';
import {NarrativeNodeExtensions} from '../src/graph/node-extensions.mjs';
import {dataNodePorts} from '../src/graph/typed-data.mjs';
const event=n=>({id:`ep:event:bounded_cycle_${String(n).padStart(8,'0')}`,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}});
async function setup(data={initialValue:0,step:1,targetValue:3,maxPasses:4},extensions=null){
 const repository=new MemoryPartitionRepository(),user={id:'gm_converge001',isGM:true},gmProvider=()=>createLocalGMContext({user,epoch:'converge'},'world');
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider,extensions})}),ledger=new DurableEventLedger({repository,gmProvider});
 const state=createNarrativeStateProvider({repository,gmProvider}),providers=new EffectProviderRegistry();providers.register(state);const journal=new MemoryOperationJournal();
 const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider,extensions}),reviews=new DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal});
 const editor=new GraphEditorModel({registry,extensions});editor.newGraph('Authored bounded convergence');const gate=editor.addNode(CONVERGENCE_NODE_TYPE);editor.updateSelected({payloadJSON:JSON.stringify(data)});
 const body=editor.addNode('core.branch.parallel'),effect=editor.addNode('core.effect.proposal');editor.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"converged-operation","value":true}'});
 editor.connect(editor.graph.rootNodeId,gate);editor.connect(gate,body,{sourcePortId:'repeat'});editor.connect(body,gate);editor.connect(body,effect);editor.connect(gate,effect,{sourcePortId:'converged'});
 await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
 return {repository,user,gmProvider,catalog,registry,ledger,router,reviews,state,journal,editor,gate,body,effect,published};
}
test('ADR-087 published authored cycle converges with a single reviewed operation and no admission or preview world effects',async()=>{
 const s=await setup(),input=event(1),preview=await s.router.simulatePublished({graphId:s.published.id,publishedVersion:1,event:input});
 assert.equal(preview.effectsExecuted,0);assert.equal(preview.proposals.length,1);assert.equal(await s.ledger.get(input.id),null);assert.equal(await s.state.get({key:'converged-operation',value:null}),null);
 assert.deepEqual(preview.trace.filter(t=>t.nodeId===s.gate).map(t=>t.status),['convergence-repeat','convergence-repeat','convergence-reached']);
 const result=await s.router.ingest(input);assert.equal(result.status,'review-required');const row=await s.ledger.get(input.id);assert.equal(row.proposals.length,1);
 assert.equal(await s.state.get({key:'converged-operation',value:null}),null);await assert.rejects(()=>s.reviews.execute(input.id,row.proposals[0].operationId),{code:'APPROVAL_REQUIRED'});
 await s.reviews.decide(input.id,row.proposals[0].operationId,{approve:true});await s.reviews.execute(input.id,row.proposals[0].operationId);assert.equal((await s.state.get({key:'converged-operation',value:null})).revision,1);
 const restarted=new DurableReactiveRouter({registry:s.registry,catalog:s.catalog,ledger:s.ledger,gmProvider:s.gmProvider});assert.equal((await restarted.ingest(input)).status,'duplicate-or-recovery-required');assert.equal((await s.state.get({key:'converged-operation',value:null})).revision,1);assert.equal((await s.journal.list()).length,1);
});
test('ADR-087 exhausted cyclic execution discards pending loop proposals and records an explainable terminal diagnostic',async()=>{
 const s=await setup({initialValue:0,step:1,targetValue:20,maxPasses:3}),input=event(2),result=await s.router.ingest(input);
 assert.equal(result.status,'evaluated');const row=await s.ledger.get(input.id);assert.deepEqual(row.proposals,[]);const diagnostic=row.evaluations[0].trace.find(t=>t.status==='convergence-budget-exhausted');
 assert.ok(diagnostic);assert.deepEqual(diagnostic.diagnostic,{contract:'numeric-clamped-step-v1',passes:3,maxPasses:3,previousValue:2,value:3,targetValue:20});assert.equal(await s.state.get({key:'converged-operation',value:null}),null);assert.deepEqual(await s.journal.list(),[]);
 assert.equal((await s.router.ingest(input)).status,'duplicate-or-recovery-required');assert.equal((await s.router.simulatePublished({graphId:s.published.id,publishedVersion:1,event:event(3)})).proposals.length,0);
});
test('ADR-087 repeated exact state stops before a budget exit and reverse numeric convergence is deterministic',async()=>{
 const s=await setup({initialValue:0,step:0,targetValue:3,maxPasses:4});await s.router.ingest(event(4));const row=await s.ledger.get(event(4).id);assert.equal(row.proposals.length,0);assert.equal(row.evaluations[0].trace.filter(t=>t.status==='convergence-repeated-state').length,1);
 const run=new BoundedConvergenceRun(),node={typeId:CONVERGENCE_NODE_TYPE,data:{initialValue:5,step:-2,targetValue:0,maxPasses:3}};assert.equal(run.step(node).status,'convergence-repeat');assert.equal(run.step(node).diagnostic.value,1);assert.equal(run.step(node).status,'convergence-reached');
});
test('ADR-087 publication keeps alternate, converged-port, data and opaque loop cycles closed',async()=>{
 const s=await setup(),graph=structuredClone(s.published);
 const bad=structuredClone(graph);bad.edges.push({...graph.edges.find(e=>e.source.nodeId===s.gate&&e.target.nodeId===s.body),id:'ep:edge:bad_converged_001',source:{nodeId:s.gate,portId:'converged'}});assert.throws(()=>validateGraph(bad),{code:'UNBOUNDED_CYCLE'});
 const opaque=structuredClone(graph);opaque.nodes.find(n=>n.id===s.body).typeId='core.extension.opaque';assert.throws(()=>validateGraph(opaque),{code:'CONVERGENCE_BODY'});
 const unbounded=structuredClone(graph);unbounded.nodes.find(n=>n.id===s.gate).typeId='core.branch.parallel';unbounded.nodes.find(n=>n.id===s.gate).data={};assert.throws(()=>validateGraph(unbounded),{code:'UNBOUNDED_CYCLE'});
 const dataCycle=structuredClone(graph);for(const name of ['a','b'])dataCycle.nodes.push({id:`ep:node:cyclic_export_${name}001`,graphId:graph.id,typeId:'core.data.export',data:{name,valueType:'boolean'},ports:dataNodePorts('core.data.export','boolean'),accessClass:'gm-secret'});
 for(const [from,to] of [['a','b'],['b','a']])dataCycle.edges.push({id:`ep:edge:cyclic_data_${from}001`,kind:'data',source:{nodeId:`ep:node:cyclic_export_${from}001`,portId:'value'},target:{nodeId:`ep:node:cyclic_export_${to}001`,portId:'input'}});assert.throws(()=>validateGraph(dataCycle),{code:'UNBOUNDED_CYCLE'});
 assert.throws(()=>validateConvergenceNode({typeId:CONVERGENCE_NODE_TYPE,data:{initialValue:0,step:1,targetValue:3,maxPasses:17}}),{code:'CONVERGENCE_CONTRACT'});
 assert.throws(()=>validateConvergenceNode({typeId:CONVERGENCE_NODE_TYPE,data:{initialValue:0,step:1,targetValue:Infinity,maxPasses:4}}),{code:'CONVERGENCE_CONTRACT'});
});
test('ADR-087 cycle side exits evaluate opaque callbacks once per event and retain fresh state for the next event',async()=>{
 let calls=0;const extensions=new NarrativeNodeExtensions();extensions.register({typeId:'cycle.observe',label:'Side exit observer',ports:[{id:'in',direction:'input',valueType:'event',accessClass:'gm'}],defaultData:{},validate(){},evaluate(){calls++;return true;}});
 const s=await setup(undefined,extensions),side=s.editor.addNode('cycle.observe');s.editor.connect(s.body,side);await s.editor.save();const published=await s.editor.publish();await s.editor.activate(published.publishedVersion);
 assert.equal((await s.router.ingest(event(60))).status,'review-required');assert.equal(calls,1);assert.equal((await s.router.ingest(event(61))).status,'review-required');assert.equal(calls,2);
});
