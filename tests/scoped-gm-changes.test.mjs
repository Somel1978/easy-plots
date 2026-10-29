import test from 'node:test';
import assert from 'node:assert/strict';
import {ScopedGMChanges} from '../src/runtime/scoped-gm-changes.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {graph,event as makeEvent} from './fixtures.mjs';
const other='ep:graph:unrelated001';
function gm(){const user={id:'gm_change001',isGM:true},context=createLocalGMContext({user,epoch:'change'},'world');return {user,gmProvider:()=>context};}
test('post-commit notifications reach only selected graph subscribers and carry no event values',()=>{
 const authority=gm(),bus=new ScopedGMChanges(authority),seen=[],foreign=[];
 const stop=bus.subscribe({graphId:graph().id,onChange:e=>seen.push(e)});bus.subscribe({graphId:other,onChange:e=>foreign.push(e)});
 bus.publish({graphIds:[graph().id],eventId:'ep:event:change001',state:'review-required',payload:{private:'SECRET'}});
 assert.equal(seen.length,1);assert.equal(foreign.length,0);assert.deepEqual(Object.keys(seen[0]).sort(),['eventId','graphId','state']);
 stop();stop();bus.publish({graphIds:[graph().id],eventId:'ep:event:change002',state:'evaluated'});assert.equal(seen.length,1);
});
test('GM subscriptions are bounded and cannot survive authority revocation or identity changes',()=>{
 const a=gm(),bus=new ScopedGMChanges({...a,maxSubscribers:1});let calls=0;bus.subscribe({graphId:graph().id,onChange:()=>calls++});
 assert.throws(()=>bus.subscribe({graphId:other,onChange:()=>{}}),{code:'VIEW_SUBSCRIPTION'});
 a.user.isGM=false;assert.throws(()=>bus.publish({graphIds:[graph().id],eventId:'ep:event:change001',state:'evaluated'}),{code:'GM_AUTHORITY_REVOKED'});
 assert.equal(calls,0);
 let current=createLocalGMContext({user:{id:'gm_old001',isGM:true},epoch:'old'},'world');
 const switched=new ScopedGMChanges({gmProvider:()=>current});switched.subscribe({graphId:graph().id,onChange:()=>calls++});
 current=createLocalGMContext({user:{id:'gm_new001',isGM:true},epoch:'new'},'world');
 switched.publish({graphIds:[graph().id],eventId:'ep:event:change001',state:'evaluated'});assert.equal(calls,0);
});
test('view callback failures report only bounded codes and cannot leak private callback messages',()=>{
 const errors=[],bus=new ScopedGMChanges({...gm(),onError:e=>errors.push(e)});
 bus.subscribe({graphId:graph().id,onChange:()=>{throw Error('PRIVATE callback details');}});
 assert.doesNotThrow(()=>bus.publish({graphIds:[graph().id],eventId:'ep:event:change001',state:'evaluated'}));
 assert.deepEqual(errors,[{code:'VIEW_REFRESH_FAILED'}]);
});
async function fixture(changes){
 const repository=new MemoryPartitionRepository(),a=gm(),catalog=new ActiveTriggerCatalog({repository,...a});
 const registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,...a})});
 const ledger=new DurableEventLedger({repository,...a});
 const g=graph(),saved=await registry.saveDraft(g);await registry.publish(g.id,{expectedRevision:saved.revision});await registry.activate(g.id,1,{expectedActivationRevision:null});
 return {repository,registry,catalog,ledger,...a,router:new DurableReactiveRouter({registry,catalog,ledger,...a,changes})};
}
test('ADR-009: focused views are invalidated only after a qualifying graph event is durably reviewable',async()=>{
 const a=gm(),bus=new ScopedGMChanges(a),s=await fixture(bus);let observed;
 const done=new Promise((resolve,reject)=>bus.subscribe({graphId:graph().id,onChange:async e=>{try{observed=await s.ledger.get(e.eventId);resolve();}catch(error){reject(error);}}}));
 const e=makeEvent('ep:event:scoped_change001');e.source={kind:'test-fixture'};
 assert.equal((await s.router.ingest(e)).status,'review-required');await done;
 assert.equal(observed.state,'review-required');assert.equal(observed.proposals.length,1);
});
test('a failed view notifier cannot rewrite the state of a successfully committed event',async()=>{
 const s=await fixture({publish(){throw Error('view not available');}}),e=makeEvent('ep:event:scoped_failure001');e.source={kind:'test-fixture'};
 assert.equal((await s.router.ingest(e)).status,'review-required');assert.equal((await s.ledger.get(e.id)).state,'review-required');
});
