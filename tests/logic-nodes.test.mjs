import test from 'node:test';
import assert from 'node:assert/strict';
import {LOGIC_NODE_CONFIG,evaluateLogicNode,validateLogicNode} from '../src/graph/logic-nodes.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
const setup=()=>{
 const repository=new MemoryPartitionRepository(),gm=createLocalGMContext({user:{id:'gm-logic',isGM:true}},'test'),gmProvider=()=>gm;
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({registry:new PersistentGraphRegistry({repository,gmProvider}),catalog});
 const ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 return {repository,gmProvider,catalog,registry,ledger,router,editor:new GraphEditorModel({registry})};
};
for(const [type,definition] of Object.entries(LOGIC_NODE_CONFIG)){
 test(`${type} is authorable, versioned, validated and published`,async()=>{
  const s=setup(),g=s.editor.newGraph('Logic test'),id=s.editor.addNode(type);s.editor.connect(g.rootNodeId,id);
  assert.ok(validateLogicNode({typeId:type,data:definition.data}));await s.editor.save();const p=await s.editor.publish();assert.equal(p.publishedVersion,1);
 });
}
test('world-time bounds gate proposals, including missing world time',async()=>{
 const s=setup(),g=s.editor.newGraph('Bounded time'),gate=s.editor.addNode('core.gate.world-time');
 s.editor.updateSelected({payloadJSON:JSON.stringify({startWorldTime:10,endWorldTime:20})});
 const effect=s.editor.addNode('core.effect.proposal');s.editor.connect(g.rootNodeId,gate);s.editor.connect(gate,effect);
 await s.editor.save();await s.editor.publish();await s.editor.activate(1);
 for(const [n,worldTime,expected] of [[0,5,'evaluated'],[1,15,'review-required'],[2,30,'evaluated'],[3,undefined,'evaluated']]){
   const event={id:`ep:event:worldtime_gate_0${n}`,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{worldTime}};
   assert.equal((await s.router.ingest(event)).status,expected);
 }
});
test('recorded d100 roll branches cannot roll or infer missing results',async()=>{
 const s=setup(),g=s.editor.newGraph('Roll-band flow'),gate=s.editor.addNode('core.branch.roll-band');
 const low=s.editor.addNode('core.effect.proposal'),high=s.editor.addNode('core.effect.proposal');
 s.editor.connect(g.rootNodeId,gate);s.editor.connect(gate,low,{sourcePortId:'low'});s.editor.connect(gate,high,{sourcePortId:'high'});
 await s.editor.save();await s.editor.publish();await s.editor.activate(1);
 for(const [n,rollTotal,count] of [[0,5,1],[1,12,0],[2,20,1],[3,undefined,0]]){
   const event={id:`ep:event:roll_band_000${n}`,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{rollTotal}};
   const r=await s.router.ingest(event);assert.equal(r.proposals,count);
 }
});
test('gate limits cannot be bypassed with malformed published configurations',()=>{
 assert.throws(()=>validateLogicNode({typeId:'core.gate.world-time',data:{startWorldTime:30,endWorldTime:10}}),{code:'LOGIC_NODE_TIME'});
 assert.throws(()=>validateLogicNode({typeId:'core.gate.actor',data:{actorId:'gm-secret'}}),{code:'INVALID_ID'});
 assert.throws(()=>evaluateLogicNode({typeId:'core.branch.roll-band',data:{lowMax:90,highMin:10}},{payload:{rollTotal:50}}),{code:'LOGIC_NODE_BANDS'});
});
