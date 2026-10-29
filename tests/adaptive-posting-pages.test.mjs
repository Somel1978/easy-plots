import test from 'node:test';import assert from 'node:assert/strict';
import {nativeStorageFixture} from './helpers/native-storage-fixture.mjs';
import {NativeCriticalSignalIndex,criticalSignalBucket,criticalSignalIndexLocator} from '../src/storage/critical-signal-index.mjs';
import {NativeChronologyIndex,chronologyBucketLocator} from '../src/storage/chronology-index.mjs';
import {NativeTemporalIndex,dueBucketLocator} from '../src/storage/native-temporal-index.mjs';
const candidate=n=>({eventId:`ep:event:paged_signal_${String(n).padStart(8,'0')}`,fingerprint:'a'.repeat(64),eventType:'test.signal',documentUuid:'Actor.test001',hook:'updateActor'});
async function sameBucket(count){const out=[];for(let n=0;out.length<count;n++)if(await criticalSignalBucket('world',candidate(n).eventId)===0)out.push(candidate(n));return out;}
const chronQuery={scope:'world',arcId:'ep:arc:adaptive_posting001',timeline:'execution'},entry=n=>({id:`ep:chronology:paged_${String(n).padStart(8,'0')}`,timestamp:n,sourceRevision:1,causalDepth:n%3});
test('adaptive critical posting shards survive native reconstruction, targeted lookup and bounded cursor traversal',async()=>{
 const s=nativeStorageFixture(),entries=await sameBucket(20),index=new NativeCriticalSignalIndex({repository:s.repo,gmProvider:s.gmProvider,capacity:2});
 for(const e of entries)await index.stage(e);
 const repo=s.reopen(),restored=new NativeCriticalSignalIndex({repository:repo,gmProvider:s.gmProvider,capacity:2}),items=[];let cursor=null;
 do{const page=await restored.page({limit:3,cursor});items.push(...page.items);cursor=page.nextCursor;assert.ok(page.scannedPages<=8);}while(cursor);
 assert.deepEqual(items.map(x=>x.eventId),entries.map(x=>x.eventId).sort());
 const before=repo.instrumentation.reads;assert.deepEqual(await restored.get(entries[5].eventId),entries[5]);assert.ok(repo.instrumentation.reads-before<30);
 await restored.remove(entries[5].eventId);assert.equal(await restored.get(entries[5].eventId),null);assert.deepEqual(await restored.get(entries[6].eventId),entries[6]);
});
test('ordered chronology posting splits preserve global timestamps and reject legacy cursor revisions after migration',async()=>{
 const s=nativeStorageFixture(),index=new NativeChronologyIndex({repository:s.repo,gmProvider:s.gmProvider,capacity:2,bucketWidth:100});
 await index.stage(chronQuery,entry(9));await index.stage(chronQuery,entry(8));const old=await index.page(chronQuery,{from:0,to:99,limit:1});assert.ok(old.nextCursor);
 for(let n=7;n>=0;n--)await index.stage(chronQuery,entry(n));
 const restored=new NativeChronologyIndex({repository:s.reopen(),gmProvider:s.gmProvider,capacity:2,bucketWidth:100});
 await assert.rejects(()=>restored.page(chronQuery,{from:0,to:99,limit:1,cursor:old.nextCursor}),{code:'CHRONOLOGY_CURSOR_STALE'});
 const items=[];let cursor=null;do{const page=await restored.page(chronQuery,{from:0,to:99,limit:3,cursor});items.push(...page.items);cursor=page.nextCursor;assert.ok(page.scannedPages<=24);}while(cursor);
 assert.deepEqual(items.map(e=>e.timestamp),Array.from({length:10},(_,n)=>n));
 await assert.rejects(()=>restored.page({...chronQuery,arcId:'ep:arc:foreign001'},{from:0,to:99,cursor:old.nextCursor}),{code:'CHRONOLOGY_CURSOR'});
});
test('prepared posting migration retains its old valid view and reconciles exact staged pages after native ACK loss',async()=>{
 const s=nativeStorageFixture(),entries=await sameBucket(3),index=new NativeCriticalSignalIndex({repository:s.repo,gmProvider:s.gmProvider,capacity:2});
 await index.stage(entries[0]);await index.stage(entries[1]);s.fault((phase,key,value)=>phase==='afterUpdate'&&value.payload.kind==='critical-signal-index'&&value.payload.postingMigration?.state==='prepared');
 await assert.rejects(()=>index.stage(entries[2]),/interruption/);
 const restored=new NativeCriticalSignalIndex({repository:s.reopen(),gmProvider:s.gmProvider,capacity:2});await assert.rejects(()=>restored.get(entries[2].eventId),{code:'INDEX_UNCERTAIN'});
 const loc=await criticalSignalIndexLocator('world',0),root=await s.repo.read(loc.id,{partitionId:loc.partitionId,gm:s.gm});assert.equal(root.postingMigration.state,'prepared');assert.equal(root.entries.length,2);
 await restored.reconcile(0);assert.deepEqual(await restored.get(entries[2].eventId),entries[2]);await restored.stage(entries[2]);
 const all=await restored.page({limit:16});assert.equal(all.items.length,3);
});
test('known missing or altered immutable posting pages fail closed during traversal and migration repair',async()=>{
 const s=nativeStorageFixture(),index=new NativeChronologyIndex({repository:s.repo,gmProvider:s.gmProvider,capacity:2,bucketWidth:100});for(let n=0;n<3;n++)await index.stage(chronQuery,entry(n));
 const loc=await chronologyBucketLocator({...chronQuery,bucketWidth:100},0),root=await s.repo.read(loc.id,{partitionId:loc.partitionId,gm:s.gm}),p=root.postingPages.pages[0];
 s.remove(`ep:record:${p.partitionId}:${p.id}`);await assert.rejects(()=>index.page(chronQuery,{from:0,to:99}),{code:'INDEX_UNCERTAIN'});
 const t=nativeStorageFixture(),entries=await sameBucket(3),critical=new NativeCriticalSignalIndex({repository:t.repo,gmProvider:t.gmProvider,capacity:2});await critical.stage(entries[0]);await critical.stage(entries[1]);
 t.fault((phase,key,value)=>phase==='afterUpdate'&&value.payload.postingMigration?.state==='prepared');await assert.rejects(()=>critical.stage(entries[2]));
 const criticalLoc=await criticalSignalIndexLocator('world',0),pending=await t.repo.read(criticalLoc.id,{partitionId:criticalLoc.partitionId,gm:t.gm}),bad=pending.postingMigration.staged[0];
 t.raw(`ep:record:${bad.partitionId}:${bad.id}`).payload.entries[0].hook='corrupt';
 await assert.rejects(()=>new NativeCriticalSignalIndex({repository:t.reopen(),gmProvider:t.gmProvider,capacity:2}).reconcile(0),{code:'POSTING_CORRUPT'});
});
test('temporal posting storage grows while bounded candidate pages revalidate sources and complete due queries retain their budget',async()=>{
 const s=nativeStorageFixture(),index=new NativeTemporalIndex({repository:s.repo,gmProvider:s.gmProvider,maxEntriesPerBucket:2}),canonical=new Map();
 for(let n=0;n<12;n++){const e={id:`ep:schedule:paged_${String(n).padStart(8,'0')}`,kind:'npc-action',dueAt:n+1,sourceRevision:1,sourceEventId:'ep:event:posting_source001'};canonical.set(e.id,{...e,status:'pending'});await index.stage(e);}
 canonical.values().next().value.sourceRevision=2;const resolveCurrent=async id=>canonical.get(id),options={from:0,to:20,resolveCurrent,maxDue:4};
 await assert.rejects(()=>index.due(options),{code:'DUE_BUDGET'});
 const restored=new NativeTemporalIndex({repository:s.reopen(),gmProvider:s.gmProvider,maxEntriesPerBucket:2}),items=[];let cursor=null;
 do{const page=await restored.page({...options,cursor});items.push(...page.candidates);cursor=page.nextCursor;assert.ok(page.candidates.length<=4);assert.ok(page.scannedPages<=24);}while(cursor);
 assert.equal(items.length,11);assert.equal(new Set(items.map(e=>e.id)).size,11);assert.ok(items.every(e=>e.sourceRevision===1));
 const first=await restored.page({...options,maxDue:2});await assert.rejects(()=>restored.page({...options,cursor:first.nextCursor,to:21}),{code:'DUE_CURSOR'});
 const update={...canonical.get(items[0].id),dueAt:19,sourceRevision:3};canonical.set(update.id,update);await restored.stage(update);
 await assert.rejects(()=>restored.page({...options,maxDue:2,cursor:first.nextCursor}),{code:'DUE_CURSOR_STALE'});
 const loc=await dueBucketLocator(0),root=await s.repo.read(loc.id,{partitionId:loc.partitionId,gm:s.gm});assert.ok(root.postingPages.total>2);
});
test('posting migration fails closed on GM authority loss and known bucket absence',async()=>{
 const s=nativeStorageFixture(),index=new NativeChronologyIndex({repository:s.repo,gmProvider:s.gmProvider,capacity:2,bucketWidth:100});await index.stage(chronQuery,entry(1));
 const loc=await chronologyBucketLocator({...chronQuery,bucketWidth:100},0);s.remove(`ep:record:${loc.partitionId}:${loc.id}`);
 await assert.rejects(()=>index.page(chronQuery,{from:0,to:99}),{code:'INDEX_UNCERTAIN'});s.user.isGM=false;await assert.rejects(()=>index.reconcile(chronQuery,0),{code:'GM_AUTHORITY_REVOKED'});
});
