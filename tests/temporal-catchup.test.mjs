import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {NativeTemporalIndex} from '../src/storage/native-temporal-index.mjs';
import {GMTemporalCoordinator} from '../src/orchestration/temporal-coordinator.mjs';
import {PersistentTemporalCatchup} from '../src/orchestration/temporal-catchup.mjs';
const jobId='ep:catchup:offline_days001',eventId='ep:event:catchup_review001';
function setup({width=30,window=24}={}){
 const repository=new MemoryPartitionRepository(),user={id:'gm_catchup001',isGM:true},context=createLocalGMContext({user,epoch:'catchup'},'world'),gmProvider=()=>context;
 const domains=new NarrativeDomainStore({repository,gmProvider}),index=new NativeTemporalIndex({repository,gmProvider,bucketWidth:width,maxBucketsPerWindow:window}),time=new GMTemporalCoordinator({domains,index});
 const compose=()=>new PersistentTemporalCatchup({domains:new NarrativeDomainStore({repository,gmProvider}),timeCoordinator:new GMTemporalCoordinator({domains:new NarrativeDomainStore({repository,gmProvider}),index:new NativeTemporalIndex({repository,gmProvider,bucketWidth:width,maxBucketsPerWindow:window})})});
 const jobs=new PersistentTemporalCatchup({domains,timeCoordinator:time}),schedule=(dueAt,n,scope='world')=>time.schedule({scope,id:`ep:scheduled:catchup_${n}`,ownerId:'ep:npc:catchup_owner001',kind:'deadline',dueAt,sourceEventId:eventId});
 return {repository,user,gmProvider,domains,index,time,compose,jobs,schedule};
}
test('ADR-079: offline catch-up persists bounded bucket progress beyond the normal query window and survives restart',async()=>{
 const s=setup(),times=[0,29,30,299,300,899,900];for(const [i,t] of times.entries())await s.schedule(t,i);
 await assert.rejects(()=>s.time.due({from:-1,to:900}),{code:'DUE_BUDGET'});
 const first=await s.jobs.create({id:jobId,from:-1,to:900,sourceEventId:eventId});assert.equal(first.data.cursorBucket,0);
 s.repository.query=()=>{throw Error('Catch-up must not enumerate all records');};
 let job=first,candidates=[];
 while(job.data.state==='pending'){
  const step=await s.compose().advance({id:jobId,expectedRevision:job.revision,maxBuckets:8,sourceEventId:eventId});assert.ok(step.pages.length<=8);assert.equal(step.eventsEmitted,0);assert.equal(step.effectsExecuted,0);assert.equal(step.outcomesInvented,0);job=step.job;candidates.push(...step.pages.flatMap(p=>p.data.body.candidates));
 }
 assert.equal(job.data.state,'enumeration-complete');assert.equal(job.data.pagesWritten,31);assert.equal(job.data.candidatesObserved,times.length);assert.equal(new Set(candidates.map(c=>c.id)).size,times.length);
 assert.deepEqual(candidates.map(c=>c.dueAt),times);assert.equal((await s.time.read({id:'ep:scheduled:catchup_0'})).data.status,'pending');
 const saved=await s.compose().readPage({id:jobId,bucket:0});assert.equal(saved.coveredByCursor,true);assert.equal(saved.data.body.candidates[0].dueAt,0);
 const done=await s.jobs.advance({id:jobId,expectedRevision:job.revision,sourceEventId:eventId});assert.deepEqual(done.pages,[]);assert.equal(done.job.revision,job.revision);
});
test('a retained page survives interruption before cursor commit and is reused without rescanning or losing candidates',async()=>{
 const s=setup();await s.schedule(10,'interrupted001');const job=await s.jobs.create({id:jobId,from:0,to:90,sourceEventId:eventId}),save=s.domains.save.bind(s.domains);let failCursor=true;
 s.domains.save=async spec=>{if(spec.type==='temporal-catchup'&&failCursor){failCursor=false;throw Error('cursor write interrupted');}return save(spec);};
 await assert.rejects(()=>s.jobs.advance({id:jobId,expectedRevision:job.revision,sourceEventId:eventId}),/cursor write interrupted/);
 const retained=await s.jobs.readPage({id:jobId,bucket:0});assert.equal(retained.coveredByCursor,false);assert.equal(retained.data.body.candidates.length,1);
 s.time.due=()=>{throw Error('Retained bucket should not be rescanned');};
 const resumed=await s.jobs.advance({id:jobId,expectedRevision:job.revision,sourceEventId:'ep:event:catchup_resume001'});assert.equal(resumed.job.data.cursorBucket,1);assert.equal(resumed.job.data.candidatesObserved,1);assert.equal(resumed.pages[0].id,retained.id);assert.equal(resumed.pages[0].sourceEventId,eventId);
});
test('dense temporal buckets remain individually bounded and do not stall a long catch-up interval',async()=>{
 const s=setup({window:1});for(let i=0;i<48;i++)await s.schedule(i%29,`dense_${i}`);
 const job=await s.jobs.create({id:jobId,from:-1,to:61,sourceEventId:eventId});
 const first=await s.jobs.advance({id:jobId,expectedRevision:job.revision,maxBuckets:1,sourceEventId:eventId});assert.equal(first.pages[0].data.body.candidates.length,48);assert.equal(first.job.data.cursorBucket,1);
 const second=await s.jobs.advance({id:jobId,expectedRevision:first.job.revision,maxBuckets:2,sourceEventId:eventId});assert.equal(second.job.data.state,'enumeration-complete');assert.equal(second.job.data.candidatesObserved,48);
});
test('catch-up revalidates stale indexed schedules while preserving the retained observed page',async()=>{
 const s=setup();await s.schedule(10,'resolved001');await s.schedule(20,'pending001');await s.time.recordOutcome({id:'ep:scheduled:catchup_resolved001',expectedRevision:1,resolutionEventId:'ep:event:catchup_resolved001',outcome:'resolved'});
 const job=await s.jobs.create({id:jobId,from:0,to:29,sourceEventId:eventId}),step=await s.jobs.advance({id:jobId,expectedRevision:job.revision,sourceEventId:eventId});assert.equal(step.pages[0].data.body.staleCandidates,1);assert.equal(step.pages[0].data.body.candidates.length,1);
 await s.schedule(25,'late001');const old=await s.jobs.readPage({id:jobId,bucket:0});assert.equal(old.data.body.candidates.length,1);assert.equal(step.job.data.coverage,'per-bucket-observed-index');
 const reconciliation=await s.jobs.create({id:'ep:catchup:late_reconcile001',from:0,to:29,sourceEventId:eventId}),fresh=await s.jobs.advance({id:reconciliation.id,expectedRevision:reconciliation.revision,sourceEventId:eventId});assert.equal(fresh.pages[0].data.body.candidates.length,2);
});
test('temporal candidates with the same identity in different canonical scopes never shadow each other',async()=>{
 const s=setup();await s.schedule(10,'shared001','world');await s.schedule(20,'shared001','side-arc');
 const main=await s.time.due({scope:'world',from:0,to:29}),side=await s.time.due({scope:'side-arc',from:0,to:29});assert.equal(main.candidates[0].dueAt,10);assert.equal(side.candidates[0].dueAt,20);
 const job=await s.jobs.create({scope:'side-arc',id:jobId,from:0,to:29,sourceEventId:eventId}),step=await s.jobs.advance({scope:'side-arc',id:jobId,expectedRevision:job.revision,sourceEventId:eventId});assert.equal(step.pages[0].data.body.candidates[0].dueAt,20);
});
test('stale cursors, corrupt retained pages, invalid budgets, changed index policy and GM revocation fail closed',async()=>{
 const s=setup();await s.schedule(10,'fenced001');const job=await s.jobs.create({id:jobId,from:0,to:29,sourceEventId:eventId});
 await assert.rejects(()=>s.jobs.advance({id:jobId,expectedRevision:1,maxBuckets:9,sourceEventId:eventId}),{code:'CATCHUP_BUDGET'});
 const step=await s.jobs.advance({id:jobId,expectedRevision:1,sourceEventId:eventId});await assert.rejects(()=>s.jobs.advance({id:jobId,expectedRevision:1,sourceEventId:eventId}),{code:'REVISION_CONFLICT'});
 const page=step.pages[0];await s.domains.save({type:'temporal-catchup-page',scope:'world',id:page.id,expectedRevision:page.revision,sourceEventId:eventId,data:{...page.data,body:{...page.data.body,candidates:[]}}});
 await assert.rejects(()=>s.jobs.readPage({id:jobId,bucket:0}),{code:'CATCHUP_PAGE_CORRUPT'});
 const changed=new PersistentTemporalCatchup({domains:s.domains,timeCoordinator:new GMTemporalCoordinator({domains:s.domains,index:new NativeTemporalIndex({...s,bucketWidth:10})})});await assert.rejects(()=>changed.read({id:jobId}),{code:'CATCHUP_POLICY_CHANGED'});
 s.user.isGM=false;await assert.rejects(()=>s.jobs.read({id:jobId}),{code:'GM_AUTHORITY_REVOKED'});
});

test('ADR-062: dense temporal catch-up retains each posting page and resumes after cursor acknowledgment loss without skipping schedules',async()=>{
 const s=setup({window:1});for(let i=0;i<137;i++)await s.schedule(i%29,`posting_dense_${i}`);await assert.rejects(s.time.due({from:-1,to:29}),{code:'DUE_BUDGET'});let job=await s.jobs.create({id:jobId,from:-1,to:29,sourceEventId:eventId});const save=s.domains.save.bind(s.domains);let lose=true;s.domains.save=async spec=>{if(lose&&spec.type==='temporal-catchup'){lose=false;throw Error('dense cursor acknowledgment lost');}return save(spec);};await assert.rejects(s.jobs.advance({id:jobId,expectedRevision:job.revision,sourceEventId:eventId}),/dense cursor acknowledgment lost/);const retained=await s.jobs.readPage({id:jobId,bucket:0,page:0});assert.equal(retained.data.body.candidates.length,48);assert(retained.data.body.nextCursor);const first=await s.jobs.advance({id:jobId,expectedRevision:job.revision,sourceEventId:eventId});job=first.job;assert.equal(job.data.cursorBucket,0);assert.equal(job.data.cursorPage,1);assert.equal(first.pages[0].id,retained.id);const candidates=[...first.pages[0].data.body.candidates];while(job.data.state==='pending'){const step=await s.compose().advance({id:jobId,expectedRevision:job.revision,sourceEventId:eventId});assert.equal(step.pages.length,1);assert(step.pages[0].data.body.candidates.length<=64);candidates.push(...step.pages[0].data.body.candidates);job=step.job;}assert.equal(job.data.pagesWritten,3);assert.equal(job.data.candidatesObserved,137);assert.equal(new Set(candidates.map(c=>c.id)).size,137);assert.equal(job.data.cursorBucket,1);assert.equal((await s.jobs.readPage({id:jobId,bucket:0,page:1})).coveredByCursor,true);assert.equal((await s.time.read({id:candidates[0].id})).data.status,'pending');
});
