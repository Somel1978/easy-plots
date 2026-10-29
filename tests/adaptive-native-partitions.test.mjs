import test from 'node:test';import assert from 'node:assert/strict';
import {nativeStorageFixture} from './helpers/native-storage-fixture.mjs';
import {sha256Hex} from '../src/contracts/digest.mjs';
import {storageTierForRecord} from '../src/storage/partition-policy.mjs';
const partitionId='domain-world-fact-adaptive',row=n=>({id:`ep:fact:adaptive_${String(n).padStart(8,'0')}`,partitionId,kind:'world-fact',value:{ref:'ep:fact:stable_target001'}});
async function fill(s,count=256){for(let n=0;n<count;n++)await s.repo.put(row(n),{gm:s.gm});}
async function collect(s,repo=s.repo){const items=[],unresolved=[];let cursor='0:0',calls=0;do{const page=await repo.query({partitionId,cursor,limit:17,gm:s.gm});items.push(...page.items);unresolved.push(...page.unresolved);cursor=page.nextCursor;assert.ok(++calls<300);}while(cursor);return {items,unresolved,calls};}
test('ADR-062 native overflow splits multiple index leaves and preserves stable IDs, locators and bounded traversal',async()=>{
 const s=nativeStorageFixture(),ids=[];
 for(let n=0;ids.length<260;n++){const r=row(n);if((await sha256Hex(r.id)).startsWith('0'))ids.push(r);}
 for(const r of ids)await s.repo.put(r,{gm:s.gm});
 const reopened=s.reopen(),top=await reopened.inspectPartition({partitionId,gm:s.gm});assert.equal(top.state,'ready');
 assert.ok([...s.records.values()].filter(r=>r.flags['easy-plots'].storage.payload.kind==='adaptive-partition'&&r.flags['easy-plots'].storage.payload.state==='ready').length>=4);
 const all=await collect(s,reopened);assert.equal(all.items.length,260);assert.equal(new Set(all.items.map(x=>x.id)).size,260);assert.deepEqual(all.unresolved,[]);
 for(const r of ids)assert.ok(s.raw(`ep:record:${partitionId}:${r.id}`),'Legacy exact native payload key is preserved');
 const before=reopened.instrumentation.reads,found=await reopened.read(ids[259].id,{partitionId,gm:s.gm});assert.equal(reopened.instrumentation.reads-before,1);assert.equal(found.value.ref,'ep:fact:stable_target001');
 assert.equal(await reopened.indexStatus(found.id,{partitionId,gm:s.gm}),'ready');
 await assert.rejects(()=>reopened.query({partitionId,cursor:'1:0',gm:s.gm}),{code:'CURSOR_STALE'});
 const first=await reopened.query({partitionId,gm:s.gm});await assert.rejects(()=>reopened.query({partitionId:'foreign-partition',cursor:first.nextCursor,gm:s.gm}),{code:'INVALID_CURSOR'});
});
test('interrupted native split retains the complete source index and repairs one manifest page per restart step',async()=>{
 const s=nativeStorageFixture();await fill(s);s.fault((phase,key)=>phase==='afterCreate'&&key.startsWith('ep:shard-index:'));
 await assert.rejects(()=>s.repo.put(row(256),{gm:s.gm}),/interruption/);
 const repo=s.reopen();assert.equal((await repo.inspectPartition({partitionId,gm:s.gm})).state,'copying');assert.equal((await collect(s,repo)).items.length,256);
 let repaired=0,step;do{step=await repo.reconcilePartition({partitionId,maxPages:1,gm:s.gm});repaired+=step.migratedPages;assert.ok(step.migratedPages<=1);}while(!step.complete);
 assert.equal(repaired,8);assert.equal(step.state,'ready');await repo.put(row(256),{gm:s.gm});assert.equal((await collect(s,repo)).items.length,257);
});
test('native restart after the final copied page publishes children without reading nonexistent migration page eight',async()=>{
 const s=nativeStorageFixture();await fill(s);s.fault((phase,key,value)=>phase==='afterUpdate'&&key===`ep:partition:${partitionId}:root`&&value.payload.nextPage===8);
 await assert.rejects(()=>s.repo.put(row(256),{gm:s.gm}),/interruption/);
 const repo=s.reopen(),result=await repo.reconcilePartition({partitionId,gm:s.gm});assert.equal(result.complete,true);assert.equal(result.migratedPages,0);assert.equal((await collect(s,repo)).items.length,256);
});
test('known split index pages and changed migration sources never become false absence',async()=>{
 const s=nativeStorageFixture();await fill(s);await s.repo.put(row(256),{gm:s.gm});
 const first=await s.repo.queryIndex({partitionId,gm:s.gm}),hit=first.items[0];s.remove(`ep:shard-index:${partitionId}:${hit.path}:0`);
 await assert.rejects(()=>s.reopen().indexStatus(hit.id,{partitionId,gm:s.gm}),{code:'INDEX_UNCERTAIN'});
 await assert.rejects(()=>s.reopen().query({partitionId,gm:s.gm}),{code:'INDEX_UNCERTAIN'});
 const t=nativeStorageFixture();await fill(t);t.fault((phase,key)=>phase==='beforeCreate'&&key.startsWith('ep:shard-index:'));await assert.rejects(()=>t.repo.put(row(256),{gm:t.gm}));
 t.raw(`ep:index:${partitionId}:0`).payload.entries.reverse();await assert.rejects(()=>t.reopen().reconcilePartition({partitionId,gm:t.gm}),{code:'PARTITION_CORRUPT'});
});
test('prepared native entries survive adaptive migration and stay distinguishable from absent records',async()=>{
 const s=nativeStorageFixture();await fill(s,255);s.fault((phase,key)=>phase==='beforeCreate'&&key===`ep:record:${partitionId}:${row(255).id}`);
 await assert.rejects(()=>s.repo.put(row(255),{gm:s.gm}));assert.equal(await s.repo.indexStatus(row(255).id,{partitionId,gm:s.gm}),'prepared');
 await s.repo.put(row(256),{gm:s.gm});assert.equal(await s.reopen().indexStatus(row(255).id,{partitionId,gm:s.gm}),'prepared');assert.equal(await s.repo.indexStatus(row(9999).id,{partitionId,gm:s.gm}),null);
 const all=await collect(s);assert.deepEqual(all.unresolved,[row(255).id]);await s.repo.put(row(255),{gm:s.gm});assert.equal((await collect(s)).items.length,257);
});
test('ADR-063 top-level and historical metadata reads hydrate only an explicitly selected exact payload',async()=>{
 const s=nativeStorageFixture();await s.repo.put({...row(1),kind:'domain-revision',snapshot:{secret:'historical'}},{gm:s.gm});await s.repo.put(row(2),{gm:s.gm});
 s.reads.length=0;const top=await s.repo.inspectPartition({partitionId,gm:s.gm});assert.equal(top.tier,'top-level');assert.equal(s.reads.length,1);
 const historical=await s.repo.queryIndex({partitionId,tier:'historical',gm:s.gm});assert.deepEqual(historical.items.map(x=>x.id),[row(1).id]);assert.ok(s.reads.every(k=>!k.startsWith('ep:record:')));
 assert.equal(historical.items[0].tier,'historical');const saved=await s.repo.read(historical.items[0].id,{partitionId,gm:s.gm});assert.equal(saved.snapshot.secret,'historical');
 assert.equal(storageTierForRecord({kind:'future-domain-kind'}),'shard');assert.equal(storageTierForRecord({kind:'arc-archive-summary'}),'historical');
 s.user.isGM=false;await assert.rejects(()=>s.repo.queryIndex({partitionId,gm:s.gm}),{code:'GM_AUTHORITY_REVOKED'});
});
