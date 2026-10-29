import test from 'node:test';
import assert from 'node:assert/strict';
import {PersistentGMFocus,GMFocusController} from '../src/orchestration/persistent-gm-focus.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const a='ep:graph:focus_A001',b='ep:graph:focus_B001',sourceEventId='ep:event:focus_config001',eventId='ep:event:focus_signal001';
function setup(){
 const repository=new MemoryPartitionRepository(),user={id:'gm_focus001',isGM:true},ctx=createLocalGMContext({user,epoch:'focus'},'world'),gmProvider=()=>ctx;
 const domains=new NarrativeDomainStore({repository,gmProvider}),service=new PersistentGMFocus({domains,gmProvider});
 const controller=new GMFocusController({service,gmProvider,now:()=>100});return {repository,user,domains,service,controller,gmProvider};
}
test('ADR-094: persistent pins survive scene changes and restart while unpinned focus follows configured scenes',async()=>{
 const s=setup();let row=await s.service.bindScene({sceneId:'sceneA',graphId:a,sourceEventId});
 row=await s.service.bindScene({sceneId:'sceneB',graphId:b,sourceEventId,expectedRevision:row.revision});
 assert.equal((await s.controller.sceneChanged('sceneA')).graphId,a);
 row=await s.service.pin({graphId:a,sourceEventId,expectedRevision:row.revision});
 assert.equal((await s.controller.sceneChanged('sceneB')).graphId,a);
 const restarted=new GMFocusController({service:new PersistentGMFocus(s),gmProvider:s.gmProvider,now:()=>100});
 assert.equal((await restarted.sceneChanged('sceneB')).focusSource,'pinned');
 await s.service.pin({graphId:null,sourceEventId,expectedRevision:row.revision});
 assert.equal((await restarted.refresh()).graphId,b);assert.equal((await restarted.sceneChanged('unbound')).graphId,null);
});
test('ADR-095: transient attention ages out while manually pinned narrative significance survives restart',async()=>{
 const s=setup();let row=await s.service.observe({eventId,graphId:a,observedAt:10,ttl:20,sourceEventId});
 row=await s.service.pinAttention({eventId,pinned:true,sourceEventId,expectedRevision:row.revision});
 const transient='ep:event:focus_temporary001';await s.service.observe({eventId:transient,graphId:b,observedAt:10,ttl:20,sourceEventId,expectedRevision:row.revision});
 const restarted=new PersistentGMFocus(s),snapshot=await restarted.snapshot({now:100});
 assert.deepEqual(snapshot.attention.map(a=>a.eventId),[eventId]);assert.equal(snapshot.effectsExecuted,0);
 const stored=await s.service.read();assert.equal(stored.data.attention.length,2,'Reading a decayed view is not an implicit canonical write');
 await restarted.pinAttention({eventId,pinned:false,sourceEventId,expectedRevision:stored.revision});
 assert.equal((await restarted.snapshot({now:100})).attention.length,0);
});
test('ADR-093: dock, inspector and full canvas share one focus without writing canonical graphs',async()=>{
 const s=setup(),seen=[[],[],[]],stops=seen.map(list=>s.controller.subscribe(state=>list.push(state.graphId)));
 await s.controller.select(a);await s.controller.select(b);for(const list of seen)assert.deepEqual(list,[a,b]);
 stops[1]();await s.controller.select(a);assert.deepEqual(seen[1],[a,b]);assert.equal(seen[0].length,3);
 assert.equal((await s.service.read()).revision,null);assert.equal(s.repository.instrumentation.partitionCount,0);
});
test('GM focus rejects stale preferences, guessed event pins and event retargeting',async()=>{
 const s=setup(),row=await s.service.observe({eventId,graphId:a,observedAt:10,sourceEventId});
 await assert.rejects(()=>s.service.pin({graphId:b,sourceEventId}),{code:'REVISION_CONFLICT'});
 await assert.rejects(()=>s.service.observe({eventId,graphId:b,observedAt:20,sourceEventId,expectedRevision:row.revision}),{code:'FOCUS_EVENT'});
 await assert.rejects(()=>s.service.pinAttention({eventId:'ep:event:unknown_focus001',pinned:true,sourceEventId,expectedRevision:row.revision}),{code:'FOCUS_EVENT'});
});
test('explicit focus respects a persistent pin and subscriber failures cannot corrupt other views',async()=>{
 const s=setup();await s.service.pin({graphId:a,sourceEventId});
 await assert.rejects(()=>s.controller.select(b),{code:'FOCUS_PINNED'});
 let seen=0;s.controller.subscribe(()=>{throw Error('closed view');});s.controller.subscribe(()=>seen++);
 assert.equal((await s.controller.refresh()).graphId,a);assert.equal(seen,1);
});
test('focus scene IDs use own properties and cannot inherit object prototype values',async()=>{
 const s=setup();assert.equal((await s.service.snapshot({now:1,sceneId:'toString'})).graphId,null);
 await s.service.bindScene({sceneId:'__proto__',graphId:a,sourceEventId});
 assert.equal((await s.service.snapshot({now:1,sceneId:'__proto__'})).graphId,a);
 assert.equal(({}).graphId,undefined);
});
test('focus and attention stay GM-private with bounded local subscriptions',async()=>{
 const s=setup();for(let i=0;i<16;i++)s.controller.subscribe(()=>{});
 assert.throws(()=>s.controller.subscribe(()=>{}),{code:'FOCUS_BUDGET'});
 s.user.isGM=false;await assert.rejects(()=>s.service.read(),{code:'GM_AUTHORITY_REVOKED'});
 await assert.rejects(()=>s.controller.select(a),{code:'GM_AUTHORITY_REVOKED'});
});
test('focus capacity preserves manually pinned signals rather than silently evicting significance',async()=>{
 const s=setup();let revision=null;
 for(let i=0;i<32;i++){const row=await s.service.observe({eventId:`ep:event:capacity_${String(i).padStart(8,'0')}`,graphId:a,observedAt:10,sourceEventId,expectedRevision:revision});revision=row.revision;}
 await assert.rejects(()=>s.service.observe({eventId:'ep:event:capacity_overflow001',graphId:a,observedAt:10,sourceEventId,expectedRevision:revision}),{code:'FOCUS_BUDGET'});
 assert.equal((await s.service.read()).data.attention.length,32);
});
