import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore,domainRevisionLocator} from '../src/domains/domain-store.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
function suite(){
 const repository=new MemoryPartitionRepository(),user={id:'gm_history001',isGM:true},context=createLocalGMContext({user,epoch:'history'},'world'),gmProvider=()=>context;
 const store=new NarrativeDomainStore({repository,gmProvider});return {repository,user,gmProvider,store};
}
const id='ep:relationship:history001',a='ep:actor:history_A001',b='ep:actor:history_B001';
const write=(store,data,revision,eventId)=>store.save({type:'relationship',scope:'world',id,data,expectedRevision:revision,sourceEventId:eventId});
test('ADR-032: revisioned canonical relationships retain directional historical values after service recreation',async()=>{
 const s=suite();await write(s.store,{fromId:a,toId:b,relation:'ally',at:10},null,'ep:event:history_first001');
 await write(s.store,{fromId:a,toId:b,relation:'rival',at:20},1,'ep:event:history_second001');
 const restored=new NarrativeDomainStore(s),first=await restored.readRevision('relationship','world',id,1),second=await restored.readRevision('relationship','world',id,2);
 assert.equal(first.data.relation,'ally');assert.equal(first.sourceEventId,'ep:event:history_first001');assert.equal(second.data.relation,'rival');
 assert.equal(await restored.read('relationship','world','ep:relationship:reverse001'),null);
});
test('ADR-007: corrective state preserves the prior event and immutable preimage',async()=>{
 const s=suite();await write(s.store,{fromId:a,toId:b,relation:'ally'},null,'ep:event:history_original001');
 await write(s.store,{fromId:a,toId:b,relation:'rival'},1,'ep:event:history_wrong001');
 await write(s.store,{fromId:a,toId:b,relation:'ally',correctsRevision:2},2,'ep:event:history_correction001');
 assert.equal((await s.store.readRevision('relationship','world',id,2)).sourceEventId,'ep:event:history_wrong001');
 assert.equal((await s.store.read('relationship','world',id)).data.correctsRevision,2);
 assert.equal((await s.store.readRevision('relationship','world',id,1)).data.relation,'ally');
});
test('historical snapshots are private, integrity checked and read by exact locator',async()=>{
 const s=suite();await write(s.store,{fromId:a,toId:b,relation:'ally'},null,'ep:event:history_first001');
 await write(s.store,{fromId:a,toId:b,relation:'rival'},1,'ep:event:history_second001');
 const loc=await domainRevisionLocator('relationship','world',id,1),row=await s.repository.read(loc.id,{partitionId:loc.partitionId});
 row.snapshot.data.relation='corrupted';await s.repository.put(row,{expectedRevision:row.revision});
 await assert.rejects(s.store.readRevision('relationship','world',id,1),{code:'DOMAIN_HISTORY_CORRUPT'});
 s.user.isGM=false;await assert.rejects(s.store.readRevision('relationship','world',id,2),{code:'GM_AUTHORITY_REVOKED'});
});
test('history failure prevents replacement of the authoritative source',async()=>{
 const s=suite();await write(s.store,{fromId:a,toId:b,relation:'ally'},null,'ep:event:history_first001');
 const put=s.repository.put.bind(s.repository);s.repository.put=async(r,o)=>{if(r.kind==='domain-revision')throw Error('history unavailable');return put(r,o);};
 await assert.rejects(write(s.store,{fromId:a,toId:b,relation:'rival'},1,'ep:event:history_second001'));
 assert.equal((await s.store.read('relationship','world',id)).data.relation,'ally');
});
test('an interrupted canonical replacement can retain its preimage without inventing the new revision',async()=>{
 const s=suite();await write(s.store,{fromId:a,toId:b,relation:'ally'},null,'ep:event:history_first001');
 const put=s.repository.put.bind(s.repository);s.repository.put=async(r,o)=>{if(r.kind==='relationship')throw Error('source unavailable');return put(r,o);};
 await assert.rejects(write(s.store,{fromId:a,toId:b,relation:'rival'},1,'ep:event:history_second001'));
 assert.equal((await s.store.readRevision('relationship','world',id,1)).data.relation,'ally');assert.equal(await s.store.readRevision('relationship','world',id,2),null);
});
test('history indices and scopes are independently verified',async()=>{
 const s=suite();await write(s.store,{fromId:a,toId:b,relation:'ally'},null,'ep:event:history_first001');
 await write(s.store,{fromId:a,toId:b,relation:'rival'},1,'ep:event:history_second001');
 s.repository.hasReadyIndex=async(_id,{partitionId})=>!partitionId.startsWith('domain-history-');
 await assert.rejects(s.store.readRevision('relationship','world',id,1),{code:'INDEX_UNCERTAIN'});
 assert.equal(await s.store.readRevision('relationship','other',id,1),null);
});
