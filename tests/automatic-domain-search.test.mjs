import test from 'node:test';import assert from 'node:assert/strict';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {ScopedNarrativeSearch} from '../src/orchestration/scoped-search.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {sha256Hex} from '../src/contracts/digest.mjs';
const gm=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
function setup(repository=new MemoryPartitionRepository()){
 const domains=new NarrativeDomainStore({repository,gmProvider:gm});
 const search=new ScopedNarrativeSearch({repository,gmProvider:gm,domains});
 domains.setCommittedIndexer(async ({type,scope,id})=>{
  if(!search.supportsCanonicalType(type))return;
  const row=await domains.read(type,scope,id);
  if(![row.data.title,row.data.name,row.data.label].some(v=>typeof v==='string'&&v.trim()))return;
  await search.indexVerifiedDomain({type,scope,entityId:id});
 });
 return {domains,search};
}
test('GM search automatically follows revisioned canonical domain writes',async()=>{
 const {domains,search}=setup(),id='ep:location:harbor_001';
 const old=await domains.save({type:'location',scope:'world',id,sourceEventId:'ep:event:loc001',data:{title:'Harbor Passage'}});
 assert.equal((await search.search({term:'passage'})).results.length,1);
 await domains.save({type:'location',scope:'world',id,sourceEventId:'ep:event:loc002',expectedRevision:old.revision,data:{title:'Mountain Tunnel'}});
 assert.deepEqual((await search.search({term:'passage'})).results,[]);
 assert.equal((await search.search({term:'tunnel'})).results.length,1);
});
test('incomplete search index does not roll back verified domain write; targeted repair works',async()=>{
 let failToken=true;const raw=new MemoryPartitionRepository();
 const repo={read:(...a)=>raw.read(...a),query:(...a)=>raw.query(...a),put:async(record,opt)=>{
  if(failToken&&record.kind==='gm-search-token')throw Object.assign(new Error('index failure'),{code:'SEARCH_SIMULATED_FAILURE'});
  return raw.put(record,opt);
 }};
 const {domains,search}=setup(repo),id='ep:location:tunnel_001';
 const saved=await domains.save({type:'location',scope:'world',id,sourceEventId:'ep:event:loc001',data:{title:'Mountain Tunnel'}});
 assert.equal(saved.revision,1);
 assert.equal((await domains.read('location','world',id)).revision,1);
 assert.equal((await search.search({term:'mountain'})).results.length,0);
 failToken=false;await search.resume({entityId:id});
 assert.equal((await search.search({term:'mountain'})).results[0].title,'Mountain Tunnel');
});
test('unsupported or untitled records do not create search postings',async()=>{
 const {domains,search}=setup();
 await domains.save({type:'notification',scope:'world',id:'ep:notice:message001',sourceEventId:'ep:event:notice001',data:{title:'Private Message'}});
 await domains.save({type:'location',scope:'world',id:'ep:location:untitled001',sourceEventId:'ep:event:loc001',data:{gmOnly:'secret'}});
 assert.deepEqual((await search.search({term:'private'})).results,[]);
 assert.deepEqual((await search.search({term:'untitled'})).results,[]);
});
test('bounded shard compaction removes only verified stale postings when bucket fills',async()=>{
 const {domains,search}=setup();
 const ids=[];let index=0;
 while(ids.length<17){const id=`ep:location:collision_${String(index++).padStart(4,'0')}`;
  if(Number.parseInt((await sha256Hex(id)).slice(0,3),16)%8===0)ids.push(id);}
 for(const id of ids.slice(0,16))await domains.save({type:'location',scope:'world',id,sourceEventId:'ep:event:loc001',data:{title:'Harbor Passage'}});
 const former=await domains.read('location','world',ids[0]);
 // Mark one of the full bucket's postings stale with a direct canonical write.
 // The full-index callback is intentionally bypassed to model an interrupted update.
 domains.setCommittedIndexer(null);
 await domains.save({type:'location',scope:'world',id:ids[0],expectedRevision:former.revision,sourceEventId:'ep:event:loc002',data:{title:'Mountain Tunnel'}});
 domains.setCommittedIndexer(async({type,scope,id})=>search.indexVerifiedDomain({type,scope,entityId:id}));
 await domains.save({type:'location',scope:'world',id:ids[16],sourceEventId:'ep:event:loc003',data:{title:'Harbor Passage'}});
 const result=await search.search({term:'passage',limit:32});
 assert.equal(result.results.length,16);assert.equal(result.hasMore,false);
 assert.ok(!result.results.some(r=>r.id===ids[0]));
});
