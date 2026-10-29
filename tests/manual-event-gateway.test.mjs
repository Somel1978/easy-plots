import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {GMManualEventGateway} from '../src/runtime/manual-event-gateway.mjs';
async function setup(){
 const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
 const repository=new MemoryPartitionRepository(),catalog=new ActiveTriggerCatalog({repository,gmProvider});
 const registry=new IndexedGraphRegistry({registry:new PersistentGraphRegistry({repository,gmProvider}),catalog});
 const ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 const editor=new GraphEditorModel({registry});const g=editor.newGraph('GM manual investigation');
 editor.selectNode(g.rootNodeId);editor.updateSelected({eventType:'manual.clue',sourceKindsJSON:'["gm-approved-intent"]'});
 const effect=editor.addNode('core.effect.proposal');editor.connect(g.rootNodeId,effect);
 await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
 const writer={assertEligible(gm){assert.equal(gm.userId,'GM');}};
 const gateway=new GMManualEventGateway({router,gmProvider,writer,worldId:'test-world'});
 return {gateway,router,ledger,editor,g};
}
test('GM manual event publishes review proposal and duplicate request reuses same ledger identity',async()=>{
 const {gateway,ledger}=await setup(),spec={requestId:'ep:request:manual001',eventType:'manual.clue',payload:{verified:true}};
 const first=await gateway.emit(spec);assert.equal(first.status,'review-required');
 assert.equal((await ledger.get(first.eventId)).proposals.length,1);
 const second=await gateway.emit(spec);assert.equal(second.eventId,first.eventId);
 assert.equal(second.status,'duplicate-or-recovery-required');
 await assert.rejects(gateway.emit({...spec,payload:{verified:false}}),{code:'EVENT_REUSE_CONFLICT'});
});
test('manual-only trigger ignores native hook event with the same event type',async()=>{
 const {router,ledger}=await setup();const id='ep:event:nativehook001';
 const result=await router.ingest({id,eventType:'manual.clue',source:{kind:'native-hook',documentUuid:'Actor.abcdef012345',hook:'updateActor'},payload:{verified:true}});
 assert.equal(result.status,'evaluated');assert.equal((await ledger.get(id)).proposals.length,0);
});
test('manual event rejects player credentials, arbitrary fields and invalid request IDs',async()=>{
 const {gateway}=await setup();const base={requestId:'ep:request:manual002',eventType:'manual.clue',payload:{verified:true}};
 await assert.rejects(gateway.emit({...base,requestId:'ep:event:not_request001'}),{code:'MANUAL_EVENT_REQUEST'});
 await assert.rejects(gateway.emit({...base,payload:{nested:{gmSecret:'exfiltrate'}}}),{code:'MANUAL_EVENT_PAYLOAD'});
 const player=new GMManualEventGateway({router:{ingest:async()=>({})},gmProvider:()=>createLocalGMContext({user:{id:'Player',isGM:false},epoch:'test'},'world'),writer:{assertEligible:()=>{}},worldId:'test-world'});
 await assert.rejects(player.emit(base),{code:'GM_REQUIRED'});
});
test('invalid or unknown event source kind is rejected at publication',async()=>{
 const {editor,g}=await setup();editor.discardUnsaved();const fresh=editor.newGraph('Unsafe source');
 editor.selectNode(fresh.rootNodeId);
 assert.throws(()=>editor.updateSelected({eventType:'manual.clue',sourceKindsJSON:'["client-supplied"]'}),{code:'TRIGGER_CONTRACT'});
});
