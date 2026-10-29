import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {normalizeFoundryHook,VerifiedFoundryHookIngress,SUPPORTED_FOUNDRY_HOOKS} from '../src/platform/foundry-hook-ingress.mjs';
import {graph} from './fixtures.mjs';

const wait=async()=>{for(let i=0;i<15;i++)await new Promise(resolve=>setTimeout(resolve,2));};
async function waitFor(predicate){
  const deadline=performance.now()+3000;
  while(!predicate()){
    if(performance.now()>deadline)throw Error('Timed out waiting for the observable Hook result');
    await new Promise(resolve=>setImmediate(resolve));
  }
}
class FakeHooks{
  registry=new Map();
  on(name,handler){let set=this.registry.get(name);if(!set){set=new Set();this.registry.set(name,set);}set.add(handler);}
  off(name,handler){this.registry.get(name)?.delete(handler);}
  fire(name,...args){for(const handler of this.registry.get(name)??[])handler(...args);}
  count(){return [...this.registry.values()].reduce((sum,set)=>sum+set.size,0);}
}
const actor={documentName:'Actor',uuid:'Actor.123456',id:'123456'};
function setup(){
  const repo=new MemoryPartitionRepository(),gmUser={id:'GM_1',isGM:true},game={user:gmUser,users:{activeGM:{id:'GM_1',isGM:true,active:true}}};
  const context=createLocalGMContext({user:gmUser,epoch:'test'},'world001'),gmProvider=()=>context;
  const base=new PersistentGraphRegistry({repository:repo,gmProvider}),catalog=new ActiveTriggerCatalog({repository:repo,gmProvider});
  const registry=new IndexedGraphRegistry({registry:base,catalog});
  const ledger=new DurableEventLedger({repository:repo,gmProvider});
  const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
  const hooks=new FakeHooks(),errors=[],writer={assertEligible:()=>{
    if(game.users.activeGM.id!=='GM_1'||!game.user.isGM)throw Object.assign(new Error('handover'),{code:'NOT_DESIGNATED_GM'});
  }};
  let i=0;
  const ingress=new VerifiedFoundryHookIngress({hooks,router,gameInstance:game,gmProvider,writer,randomId:()=>`hook_event_${++i}_000`,onError:e=>errors.push(e)});
  return {repo,game,registry,ledger,router,ingress,hookInstance:hooks,errors};
}
async function activeActorPlot(env){
  const g=graph();g.nodes[0].data.eventType='foundry.actor.updated';
  g.nodes[1].data.condition.right.value='Actor';g.nodes[1].data.condition.left.path=['event','documentType'];
  await env.registry.saveDraft(g);await env.registry.publish(g.id,{expectedRevision:1});
  await env.registry.activate(g.id,1,{expectedActivationRevision:null});
}

test('native Hook adapter emits only allowlisted provenance and top-level keys',()=>{
  const doc={...actor,system:{secret:'private'},name:'Unknown Assassin'};
  const changed={system:{secret:'GM-only text'},flags:{private:'do not copy'},'unsafe/field':'bad'};
  const result=normalizeFoundryHook('updateActor',[doc,changed,{foo:'bar'},'PLAYER_1'],{randomId:()=> 'source_test_001'});
  assert.equal(result.id,'ep:event:source_test_001');
  assert.equal(result.eventType,'foundry.actor.updated');
  assert.deepEqual(result.payload.changeKeys,['system','flags']);
  assert.equal(result.source.requestingUserId,'PLAYER_1');
  assert.doesNotMatch(JSON.stringify(result),/Unknown Assassin|GM-only text|do not copy|bar/);
});

test('hook normalization rejects unauthorized hook names and forged sources',()=>{
  assert.throws(()=>normalizeFoundryHook('createUser',[actor,{},'A'],{randomId:()=> 'test_id_001'}),{code:'HOOK_UNSUPPORTED'});
  assert.throws(()=>normalizeFoundryHook('updateActor',[{...actor,documentName:'Item'}, {},{},'X'],{randomId:()=> 'test_id_002'}),{code:'HOOK_SOURCE_INVALID'});
  assert.throws(()=>normalizeFoundryHook('updateActor',[actor,{}, {},undefined],{randomId:()=> 'test_id_003'}),{code:'HOOK_SOURCE_INVALID'});
  assert.throws(()=>normalizeFoundryHook('createJournalEntry',[{documentName:'JournalEntry',uuid:'JournalEntry.A'}, {},'PLAYER'],{randomId:()=> 'bad id'}),{code:'INVALID_EVENT'});
});

test('the supported v14 hooks have bounded, explicit contracts',()=>{
  assert.deepEqual([...SUPPORTED_FOUNDRY_HOOKS],['updateActor','updateItem','createJournalEntry','updateJournalEntry','createCombat','updateCombat','deleteCombat','createChatMessage']);
});

test('Hooks remain unregistered until explicit start, are idempotent, and detach on stop',()=>{
  const env=setup();assert.equal(env.hookInstance.count(),0);
  env.ingress.start();env.ingress.start();assert.equal(env.hookInstance.count(),SUPPORTED_FOUNDRY_HOOKS.length);
  env.ingress.stop();assert.equal(env.hookInstance.count(),0);
  assert.equal(env.ingress.status.running,false);
});

test('starting hooks requires a currently authorized designated GM',()=>{
  const env=setup();env.game.users.activeGM.id='OTHER_GM';
  assert.throws(()=>env.ingress.start(),{code:'NOT_DESIGNATED_GM'});
  assert.equal(env.hookInstance.count(),0);
});

test('a hooked native update creates durable review proposals, not effects',async t=>{
  const env=setup();await activeActorPlot(env);env.ingress.start();
  t.after(()=>env.ingress.stop());
  env.hookInstance.fire('updateActor',actor,{system:{secret:'NEVER PERSIST THIS'}},{diff:true},'PLAYER_1');
  await waitFor(()=>env.ingress.status.recentEventIds.length===1||env.errors.length>0);
  assert.deepEqual(env.errors,[]);
  const {recentEventIds}=env.ingress.status;
  assert.equal(recentEventIds.length,1);
  const row=await env.ledger.get(recentEventIds[0]);
  assert.equal(row.state,'review-required');assert.equal(row.proposals.length,1);
  assert.equal(row.proposals[0].state,'requires-gm-approval');
  assert.doesNotMatch(JSON.stringify(row),/NEVER PERSIST THIS/);
  assert.equal(row.event.source.requestingUserId,'PLAYER_1');
  env.ingress.stop();
});

test('unsubscribed document events do not create durable entries',async()=>{
  const env=setup();await activeActorPlot(env);env.ingress.start();
  env.hookInstance.fire('createJournalEntry',{documentName:'JournalEntry',uuid:'JournalEntry.123'}, {},'PLAYER_1');
  await wait();
  assert.equal(env.ingress.status.recentEventIds.length,0);
  env.ingress.stop();
});

test('losing GM designation stops listeners and prevents further recording',async()=>{
  const env=setup();await activeActorPlot(env);env.ingress.start();
  env.game.users.activeGM.id='SECOND_GM';
  env.hookInstance.fire('updateActor',actor,{name:'new'}, {},'PLAYER_1');
  await wait();
  assert.equal(env.hookInstance.count(),0);
  assert.equal(env.ingress.status.running,false);
  assert.equal(env.ingress.status.recentEventIds.length,0);
  assert.ok(env.errors.some(x=>x.code==='NOT_DESIGNATED_GM'));
});

test('Hook errors are GM-local codes without untrusted document values',async()=>{
  const env=setup();await activeActorPlot(env);env.ingress.start();
  env.hookInstance.fire('updateActor',actor,{name:'PRIVATE SECRET'}, {},null);
  await wait();
  assert.equal(env.errors.length,1);
  assert.equal(env.errors[0].code,'HOOK_SOURCE_INVALID');
  assert.doesNotMatch(JSON.stringify(env.errors),/PRIVATE SECRET/);
});

test('hook source IDs are unique per observed native occurrence',async()=>{
  const env=setup();await activeActorPlot(env);env.ingress.start();
  env.hookInstance.fire('updateActor',actor,{system:{hp:1}},{},'GM_1');
  env.hookInstance.fire('updateActor',actor,{system:{hp:2}},{},'GM_1');
  await waitFor(()=>env.ingress.status.recentEventIds.length===2);
  const ids=env.ingress.status.recentEventIds;
  assert.equal(ids.length,2);
  assert.notEqual(ids[0],ids[1]);
  assert.equal((await env.ledger.get(ids[0])).state,'review-required');
  assert.equal((await env.ledger.get(ids[1])).state,'review-required');
});
test('ADR-085: Hook admission budget includes pending subscription lookups',async()=>{
  const hooks=new FakeHooks(),errors=[],user={id:'GM_1',isGM:true},ctx=createLocalGMContext({user,epoch:'pending'},'world');
  let release,queries=0,ingested=0;
  const waiting=new Promise(resolve=>{release=resolve;});
  const ingress=new VerifiedFoundryHookIngress({hooks,router:{subscribed:async()=>{queries++;await waiting;return [{}];},ingest:async()=>{ingested++;return {status:'evaluated'};}},
    gameInstance:{user},gmProvider:()=>ctx,writer:{assertEligible:()=>{}},maxInflight:1,randomId:()=> 'pending_event001',onError:e=>errors.push(e)});
  ingress.start();hooks.fire('updateActor',actor,{}, {},'GM_1');hooks.fire('updateActor',actor,{}, {},'GM_1');
  assert.equal(queries,1);assert.equal(ingress.status.inflight,1);assert.ok(errors.some(e=>e.code==='HOOK_BACKPRESSURE'));
  release();await wait();assert.equal(ingested,1);assert.equal(ingress.status.inflight,0);ingress.stop();
});
test('explicit stop during a subscription lookup prevents subsequent event admission',async()=>{
  const hooks=new FakeHooks(),user={id:'GM_1',isGM:true},ctx=createLocalGMContext({user,epoch:'stop'},'world');
  let release,ingested=0;const waiting=new Promise(resolve=>{release=resolve;});
  const ingress=new VerifiedFoundryHookIngress({hooks,router:{subscribed:async()=>{await waiting;return [{}];},ingest:async()=>{ingested++;}},
    gameInstance:{user},gmProvider:()=>ctx,writer:{assertEligible:()=>{}},randomId:()=> 'stopped_event001'});
  ingress.start();hooks.fire('updateActor',actor,{}, {},'GM_1');ingress.stop();release();await wait();
  assert.equal(ingested,0);assert.equal(ingress.status.inflight,0);
});
test('queued native Hook work rechecks authority and stop state before entering the durable router',async()=>{
 const hooks=new FakeHooks(),user={id:'GM_1',isGM:true},ctx=createLocalGMContext({user,epoch:'queued'},'world'),errors=[];
 let queued,ingested=0;
 const ingress=new VerifiedFoundryHookIngress({hooks,router:{subscribed:async()=>[{}],ingest:async()=>{ingested++;}},
  scheduler:{submit:({priority,run})=>{assert.equal(priority,'interactive');return new Promise((resolve,reject)=>{queued=async()=>{try{const result=await run();resolve(result);return result;}catch(error){reject(error);throw error;}};});}},
  gameInstance:{user},gmProvider:()=>ctx,writer:{assertEligible:()=>{}},randomId:()=> 'queued_event001',onError:e=>errors.push(e)});
 ingress.start();hooks.fire('updateActor',actor,{}, {},'GM_1');await waitFor(()=>typeof queued==='function');
 user.isGM=false;await assert.rejects(()=>queued(),{code:'GM_AUTHORITY_REVOKED'});assert.equal(ingested,0);
 await waitFor(()=>ingress.status.inflight===0);assert.equal(errors[0].code,'GM_AUTHORITY_REVOKED');
 user.isGM=true;ingress.stop();await assert.rejects(()=>queued(),{code:'HOOK_STOPPED'});assert.equal(ingested,0);
});
test('protected storage Journal Hooks never feed their own critical narrative inbox',async()=>{
 const hooks=new FakeHooks(),user={id:'GM_1',isGM:true},ctx=createLocalGMContext({user,epoch:'internal-pack'},'world'),captured=[],errors=[];
 const reliability={ready:true,tierForEvent:()=> 'critical',capture:async event=>captured.push(event),deliver:async id=>({status:'no-subscribers',eventId:id})};
 const ingress=new VerifiedFoundryHookIngress({hooks,reliability,protectedPackId:'world.easy-plots-secret',router:{ingest:async()=>{}},gameInstance:{user},gmProvider:()=>ctx,writer:{assertEligible:()=>{}},randomId:()=> 'external_journal001',onError:e=>errors.push(e)});
 ingress.start();
 hooks.fire('createJournalEntry',{documentName:'JournalEntry',uuid:'Compendium.world.easy-plots-secret.JournalEntry.internal001',pack:'world.easy-plots-secret'}, {},user.id);
 hooks.fire('updateJournalEntry',{documentName:'JournalEntry',uuid:'Compendium.world.easy-plots-secret.JournalEntry.internal001',compendium:{collection:'world.easy-plots-secret'}}, {},{},user.id);
 assert.equal(captured.length,0);
 hooks.fire('createJournalEntry',{documentName:'JournalEntry',uuid:'JournalEntry.external001'}, {},user.id);await waitFor(()=>captured.length===1&&ingress.status.inflight===0);
 assert.equal(captured[0].source.documentUuid,'JournalEntry.external001');assert.deepEqual(errors,[]);ingress.stop();
});
