import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeCriticalSignalIndex,criticalSignalBucket,criticalSignalIndexLocator} from '../src/storage/critical-signal-index.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const candidate=n=>({eventId:`ep:event:pending_index_${String(n).padStart(8,'0')}`,fingerprint:'a'.repeat(64),eventType:'foundry.actor.updated',documentUuid:'Actor.index001',hook:'updateActor'});
function setup(options={}){const repository=new MemoryPartitionRepository(),user={id:'gm_index001',isGM:true},ctx=createLocalGMContext({user,epoch:'index'},'world'),gmProvider=()=>ctx;return {repository,user,index:new NativeCriticalSignalIndex({repository,gmProvider,...options})};}
test('concurrent pending-index writes serialize within each bounded bucket without losing signals',async()=>{
 const s=setup();await Promise.all(Array.from({length:24},(_,n)=>s.index.stage(candidate(n))));
 const first=await s.index.page({limit:16}),second=await s.index.page({limit:16,cursor:first.nextCursor});assert.equal(first.items.length+second.items.length,24);
 assert.equal(new Set([...first.items,...second.items].map(x=>x.eventId)).size,24);assert.ok(first.scannedBuckets<=8);
});
test('pending-index overflow splits storage pages while extra private fields remain rejected',async()=>{
 const s=setup({capacity:1}),first=candidate(0),bucket=await criticalSignalBucket('world',first.eventId);let second;
 for(let n=1;n<100;n++)if(await criticalSignalBucket('world',candidate(n).eventId)===bucket){second=candidate(n);break;}
 assert.ok(second);await s.index.stage(first);await s.index.stage(second);
 assert.equal((await s.index.get(second.eventId)).eventId,second.eventId);assert.equal((await s.index.get(first.eventId)).eventId,first.eventId);
 await assert.rejects(()=>s.index.stage({...candidate(999),payload:'PRIVATE'}),{code:'SIGNAL_INDEX_ENTRY'});
});
test('pending cursors reject changed buckets and cannot be reused across protected scopes',async()=>{
 const s=setup();await Promise.all(Array.from({length:24},(_,n)=>s.index.stage(candidate(n))));
 const first=await s.index.page({limit:1});assert.ok(first.nextCursor);
 let next;for(let n=100;n<200;n++)if(await criticalSignalBucket('world',candidate(n).eventId)===first.nextCursor.bucket){next=candidate(n);break;}
 await s.index.stage(next);await assert.rejects(()=>s.index.page({limit:1,cursor:first.nextCursor}),{code:'SIGNAL_CURSOR_STALE'});
 await assert.rejects(()=>s.index.page({cursor:{...first.nextCursor,scope:'foreign'}}),{code:'SIGNAL_CURSOR'});
});
test('pending candidates require a verified native index and the current GM',async()=>{
 const s=setup();await s.index.stage(candidate(1));s.repository.hasReadyIndex=async()=>false;
 await assert.rejects(()=>s.index.get(candidate(1).eventId),{code:'INDEX_UNCERTAIN'});
 s.user.isGM=false;await assert.rejects(()=>s.index.page(),{code:'GM_AUTHORITY_REVOKED'});
});
test('corrupt bucket identities are rejected before reporting a pending signal as available',async()=>{
 const s=setup(),entry=candidate(1);await s.index.stage(entry);const bucket=await criticalSignalBucket('world',entry.eventId),loc=await criticalSignalIndexLocator('world',bucket),row=await s.repository.read(loc.id,loc);
 await s.repository.put({...row,entries:[entry,entry]},{expectedRevision:row.revision});
 await assert.rejects(()=>s.index.get(entry.eventId),{code:'SIGNAL_INDEX_CORRUPT'});
});
