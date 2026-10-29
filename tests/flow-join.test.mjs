import test from 'node:test';import assert from 'node:assert/strict';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
const id=(t,s)=>`ep:${t}:${s}`;
async function setup({mode='all',verified=true}={}){
 const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
 const repository=new MemoryPartitionRepository();const reg=new IndexedGraphRegistry({registry:new PersistentGraphRegistry({repository,gmProvider}),catalog:new ActiveTriggerCatalog({repository,gmProvider})});
 const ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry:reg,catalog:new ActiveTriggerCatalog({repository,gmProvider}),ledger,gmProvider});
 // Router needs the same persisted catalog instance to work across indexes.
 const editor=new GraphEditorModel({registry:reg});const graph=editor.newGraph('Join experiment');
 const a=editor.addNode('core.condition'),b=editor.addNode('core.condition'),join=editor.addNode('core.flow.join'),effect=editor.addNode('core.effect.proposal');
 editor.selectNode(join);editor.updateSelected({payloadJSON:JSON.stringify({mode})});
 editor.connect(graph.rootNodeId,a);editor.connect(graph.rootNodeId,b);
 editor.connect(a,join);editor.connect(b,join);editor.connect(join,effect);
 await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
 const evt=id('event',verified?'true0001':'false0001');
 await router.ingest({id:evt,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified}});
 return {ledger,evt,graph,editor,join};
}
test('all-mode join passes only when all incoming branches execute',async()=>{
 const {ledger,evt}=await setup();
 const record=await ledger.get(evt);
 assert.equal(record.proposals.length,1);
 assert.equal(record.evaluations[0].trace.filter(t=>t.status==='join-awaiting-inputs').length,1);
});
test('all-mode join blocks when one authored predecessor does not qualify',async()=>{
 // one condition uses verified and the other is replaced with a false comparator
 const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
 const repository=new MemoryPartitionRepository(),cat=new ActiveTriggerCatalog({repository,gmProvider});
 const reg=new IndexedGraphRegistry({registry:new PersistentGraphRegistry({repository,gmProvider}),catalog:cat});
 const editor=new GraphEditorModel({registry:reg});const g=editor.newGraph('Join blocked');
 const a=editor.addNode('core.condition'),b=editor.addNode('core.condition'),j=editor.addNode('core.flow.join'),e=editor.addNode('core.effect.proposal');
 editor.selectNode(b);const alt=editor.selectedNode.data.condition;
 editor.updateSelected({conditionJSON:JSON.stringify({...alt,right:{type:'literal',value:false}})});
 editor.connect(g.rootNodeId,a);editor.connect(g.rootNodeId,b);
 editor.connect(a,j);editor.connect(b,j);editor.connect(j,e);
 await editor.save();const pub=await editor.publish();await editor.activate(pub.publishedVersion);
 const ledger=new DurableEventLedger({repository,gmProvider});const router=new DurableReactiveRouter({registry:reg,catalog:cat,ledger,gmProvider});
 const evt=id('event','blocked001');await router.ingest({id:evt,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true}});
 assert.equal((await ledger.get(evt)).proposals.length,0);
});
test('any-mode join produces one effect even with two incoming arrivals',async()=>{
 const {ledger,evt}=await setup({mode:'any'});assert.equal((await ledger.get(evt)).proposals.length,1);
});
test('all-mode publication rejects fewer than two incoming links and invalid configuration',async()=>{
 const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true}},'world');const repository=new MemoryPartitionRepository();
 const editor=new GraphEditorModel({registry:new PersistentGraphRegistry({repository,gmProvider})});const graph=editor.newGraph('Invalid join');
 const j=editor.addNode('core.flow.join');editor.connect(graph.rootNodeId,j);
 await assert.rejects(editor.save(),{code:'FLOW_JOIN_INPUTS'});
 editor.selectNode(j);assert.throws(()=>editor.updateSelected({payloadJSON:'{"mode":"sometimes"}'}),{code:'FLOW_JOIN_CONTRACT'});
});
