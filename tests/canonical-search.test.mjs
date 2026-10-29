import test from 'node:test';import assert from 'node:assert/strict';
import {ScopedNarrativeSearch} from '../src/orchestration/scoped-search.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gm=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
function setup(){const repository=new MemoryPartitionRepository(),domains=new NarrativeDomainStore({repository,gmProvider:gm});
 return {domains,search:new ScopedNarrativeSearch({repository,gmProvider:gm,domains})};}
const id='ep:location:harbor_001';
test('verified search derives title and exact keywords from canonical GM domain source',async()=>{
 const {domains,search}=setup();await domains.save({type:'location',scope:'world',id,
 sourceEventId:'ep:event:loc_001',data:{title:'Harbor Vault',gmSecret:'Cursed jewel'}});
 const ready=await search.indexVerifiedDomain({type:'location',entityId:id});
 assert.equal(ready.data.canonicalRevision,1);
 const result=await search.search({term:'harbor'});
 assert.equal(result.results.length,1);assert.equal(result.results[0].title,'Harbor Vault');
 assert.equal(JSON.stringify(result).includes('Cursed jewel'),false);
 assert.equal((await search.indexVerifiedDomain({type:'location',entityId:id})).revision,ready.revision);
});
test('canonical record update invalidates old verified search even before reindex',async()=>{
 const {domains,search}=setup();const first=await domains.save({type:'location',scope:'world',id,
 sourceEventId:'ep:event:loc_001',data:{title:'Harbor Vault'}});
 await search.indexVerifiedDomain({type:'location',entityId:id});
 await domains.save({type:'location',scope:'world',id,expectedRevision:first.revision,
 sourceEventId:'ep:event:loc_002',data:{title:'Hidden Warehouse'}});
 const stale=await search.search({term:'harbor'});
 assert.equal(stale.results.length,0);assert.equal(stale.incomplete,true);
 await search.indexVerifiedDomain({type:'location',entityId:id});
 assert.equal((await search.search({term:'warehouse'})).results[0].title,'Hidden Warehouse');
 assert.equal((await search.search({term:'harbor'})).results.length,0);
});
test('unsupported domain and phantom source fail closed',async()=>{
 const {domains,search}=setup();
 await assert.rejects(search.indexVerifiedDomain({type:'notification',entityId:id}),{code:'SEARCH_CANONICAL'});
 await assert.rejects(search.indexVerifiedDomain({type:'location',entityId:id}),{code:'SEARCH_CANONICAL_MISSING'});
 await domains.save({type:'location',scope:'world',id,sourceEventId:'ep:event:loc_001',data:{title:'X'}});
 await assert.rejects(search.indexVerifiedDomain({type:'location',entityId:id}),{code:'SEARCH_CANONICAL'});
});
test('search source cannot claim a trusted revision without trusted domain adapter',async()=>{
 const {search}=setup();await assert.rejects(search.index({entityId:id,title:'Harbor Vault',domain:'location',
 sourceEventId:'ep:event:loc_001',keywords:['harbor'],canonicalRevision:1}),{code:'SEARCH_SOURCE_CHANGED'});
});
