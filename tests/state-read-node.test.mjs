import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {createNarrativeStateProvider} from '../src/runtime/native-state-provider.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {validateStateRead,evaluateStateRead} from '../src/graph/state-read.mjs';
import {graph,condition,trigger,effect} from './fixtures.mjs';
const port=(id,direction)=>({id,direction,valueType:'event',accessClass:'gm'});
function fixture(){
 const g=graph();const state=g.nodes.find(n=>n.id===condition);
 state.typeId='core.state.read';state.data={scope:'world',key:'critical-clue',expectedValue:{found:true,observer:'party'},expectedRevision:null};
 state.ports=[port('in','input'),port('match','output'),port('mismatch','output'),port('absent','output')];
 g.edges.find(e=>e.source.nodeId===condition).source.portId='match';
 return g;
}
function env(withReader=true){
 const repository=new MemoryPartitionRepository();const gmProvider=()=>createLocalGMContext({user:{id:'gm_001',isGM:true},epoch:'test'},'world');
 const state=createNarrativeStateProvider({repository,gmProvider});
 const catalog=new ActiveTriggerCatalog({repository,gmProvider});
 const registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})});
 const ledger=new DurableEventLedger({repository,gmProvider});
 const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider,
  stateReader:withReader?({scope,key})=>state.get({scope,key,value:null}):null});
 return {repository,state,registry,router};
}
async function publish(env,g){const saved=await env.registry.saveDraft(g);const p=await env.registry.publish(g.id,{expectedRevision:saved.revision});await env.registry.activate(g.id,p.publishedVersion,{expectedActivationRevision:null});}
function event(id,claimedValue=false){return {id,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true,claim:claimedValue}};}
test('state read validates strict bounded contract and labeled output ports',()=>{
 const state=fixture().nodes.find(n=>n.id===condition);assert.equal(validateStateRead(state),true);
 assert.throws(()=>validateStateRead({...state,data:{...state.data,key:'__proto__'}}),{code:'STATE_READ_KEY'});
 assert.throws(()=>validateStateRead({...state,data:{...state.data,scope:'../other'}}),{code:'STATE_READ_SCOPE'});
 assert.throws(()=>validateStateRead({...state,data:{...state.data,expectedValue:{constructor:true}}}),{code:'STATE_READ_DATA'});
 assert.throws(()=>validateStateRead({...state,data:{...state.data,expectedRevision:0}}),{code:'STATE_READ_REVISION'});
 assert.throws(()=>validateStateRead({...state,ports:[port('in','input')]}),{code:'STATE_READ_PORTS'});
 assert.deepEqual(evaluateStateRead(state,null).allowedPorts,['absent']);
});
test('published state-read node reads authoritative state, not spoofed event data',async()=>{
 const e=env();await publish(e,fixture());
 assert.equal((await e.router.ingest(event('ep:event:absent_state001',true))).status,'evaluated');
 await e.state.apply({scope:'world',key:'critical-clue',value:{observer:'party',found:true}},{operationId:'ep:operation:state_001'});
 const valid=await e.router.ingest(event('ep:event:present_state001',false));
 assert.equal(valid.status,'review-required');assert.equal(valid.proposals,1);
 const staleClaim=await e.router.ingest(event('ep:event:another_state001',true));assert.equal(staleClaim.status,'review-required');
 await e.state.apply({scope:'world',key:'critical-clue',value:{found:false,observer:'party'}},{operationId:'ep:operation:state_002'});
 assert.equal((await e.router.ingest(event('ep:event:mismatch_state001',true))).status,'evaluated');
});
test('state read fails closed when authoritative reader is absent or throws',async()=>{
 const e=env(false);await publish(e,fixture());
 const missing=await e.router.ingest(event('ep:event:no_reader001',true));
 assert.equal(missing.status,'uncertain');assert.equal(missing.reason,'STATE_READ_UNAVAILABLE');
});
test('state read rejects stale revisions and corrupted records',()=>{
 const n=fixture().nodes.find(n=>n.id===condition),row={kind:'narrative-state',scope:'world',stateKey:'critical-clue',revision:2,value:{found:true,observer:'party'}};
 assert.deepEqual(evaluateStateRead({...n,data:{...n.data,expectedRevision:1}},row).allowedPorts,['mismatch']);
 assert.deepEqual(evaluateStateRead(n,row).allowedPorts,['match']);
 assert.throws(()=>evaluateStateRead(n,{...row,scope:'other'}),{code:'STATE_READ_CORRUPT'});
});
test('state-read contract is authorable and its typed ports persist through draft publication',async()=>{
 const e=env();
 const {GraphEditorModel}=await import('../src/editor/model.mjs');
 const editor=new GraphEditorModel({registry:e.registry});
 editor.newGraph('State-dependent narrative');
 const id=editor.addNode('core.state.read');
 assert.ok(editor.availableNodeTypes().some(n=>n.id==='core.state.read'));
 assert.deepEqual(editor.selectedNode.ports.filter(p=>p.direction==='output').map(p=>p.id),['match','mismatch','absent']);
 editor.updateSelected({payloadJSON:JSON.stringify({scope:'world',key:'critical-clue',expectedValue:true,expectedRevision:null})});
 const current=editor.graph;
 assert.equal(current.nodes.find(n=>n.id===id).data.key,'critical-clue');
 const saved=await e.registry.saveDraft(current);
 const published=await e.registry.publish(current.id,{expectedRevision:saved.revision,acknowledgeWarnings:true});
 assert.equal(published.nodes.find(n=>n.id===id).typeId,'core.state.read');
});
