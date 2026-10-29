import test from 'node:test';import assert from 'node:assert/strict';
import {ScopedNarrativeSearch} from '../src/orchestration/scoped-search.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gm=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
const build=repo=>new ScopedNarrativeSearch({repository:repo,gmProvider:gm});
const spec={entityId:'ep:npc:captain001',title:'Captain Marrek',domain:'npc',keywords:['Captain','Harbor'],sourceEventId:'ep:event:source001'};
test('exact-term GM search is bounded and stable across service reconstruction',async()=>{
 const repo=new MemoryPartitionRepository();const svc=build(repo);
 const row=await svc.index(spec);assert.equal(row.data.state,'ready');
 const r=await build(repo).search({term:'CAPTAIN'});
 assert.equal(r.scannedTokenShards,8);assert.equal(r.results[0].title,'Captain Marrek');assert.equal(r.visibility,'gm-only');
 assert.deepEqual((await svc.search({term:'unrelated'})).results,[]);
});
test('updated keywords invalidate old postings without global scans',async()=>{
 const svc=build(new MemoryPartitionRepository());const old=await svc.index(spec);
 await svc.index({...spec,title:'Marrek in Exile',keywords:['Exile'],sourceEventId:'ep:event:revised001',expectedRevision:old.revision});
 const outdated=await svc.search({term:'captain'});
 assert.equal(outdated.results.length,0);assert.equal(outdated.incomplete,true);
 assert.equal((await svc.search({term:'exile'})).results[0].title,'Marrek in Exile');
});
test('failed token indexing remains pending and does not appear as ready',async()=>{
 const repo=new MemoryPartitionRepository();let sabotage=true;
 const broken={read:(...a)=>repo.read(...a),put:async(record,options)=>{
  if(record.kind==='gm-search-token'&&sabotage)throw Error('simulated native failure');return repo.put(record,options);
 }};
 const svc=build(broken);
 await assert.rejects(svc.index(spec),/simulated native failure/);
 assert.equal((await svc.search({term:'captain'})).results.length,0);
 sabotage=false;await svc.resume({entityId:spec.entityId});
 assert.equal((await svc.search({term:'captain'})).results.length,1);
});
test('untrusted keywords and client authority are rejected',async()=>{
 const svc=build(new MemoryPartitionRepository());
 await assert.rejects(svc.index({...spec,keywords:['<script>']}),{code:'SEARCH_TERMS'});
 await assert.rejects(svc.search({term:'a'}),{code:'SEARCH_TERMS'});
 await assert.rejects(svc.search({term:'captain',limit:500}),{code:'SEARCH_BUDGET'});
 const player=new ScopedNarrativeSearch({repository:new MemoryPartitionRepository(),gmProvider:()=>createLocalGMContext({user:{id:'P',isGM:false},epoch:'test'},'world')});
 await assert.rejects(player.search({term:'captain'}),{code:'GM_REQUIRED'});
});
