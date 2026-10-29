import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentArcResolutions} from '../src/orchestration/persistent-arc-resolution.mjs';
import {PersistentArcArchives} from '../src/orchestration/persistent-arc-archives.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {domainRevisionLocator} from '../src/domains/domain-store.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {NativeChronologyIndex} from '../src/storage/chronology-index.mjs';
import {PersistentNarrativeChronology} from '../src/orchestration/persistent-chronology.mjs';
const arcId='ep:arc:archive001',archiveId='ep:archive:archive001',resolutionId='ep:resolution:archive001',factId='ep:fact:archive001',eventId='ep:event:archive_review001';
async function setup(){
 const repository=new MemoryPartitionRepository(),user={id:'gm_archive001',isGM:true},context=createLocalGMContext({user,epoch:'archive'},'world'),gmProvider=()=>context;
 const domains=new NarrativeDomainStore({repository,gmProvider}),archives=new PersistentArcArchives({domains}),resolutions=new PersistentArcResolutions({domains});
 await domains.save({type:'arc',scope:'world',id:arcId,data:{title:'Harbor',status:'active',worldTime:100,worldFacets:{leader:'captured'},objectives:[],unresolvedThreads:[],endingContracts:[{id:'ep:ending:archive001',requiredFacets:{leader:'captured'}}]},sourceEventId:eventId});
 await resolutions.finalize({arcId,resolutionId,endingId:'ep:ending:archive001',approvalEventId:eventId,expectedArcRevision:1});
 await domains.save({type:'world-fact',scope:'world',id:factId,data:{value:'original',status:'asserted'},sourceEventId:eventId});
 const prepare=()=>archives.prepare({arcId,archiveId,expectedArcRevision:2,sourceEventId:eventId,title:'Harbor conclusion',text:'GM-only ending summary'});
 const seal=row=>archives.seal({archiveId,expectedRevision:row.revision,reviewEventId:eventId,approved:true});
 const advance=row=>archives.advance({archiveId,expectedRevision:row.revision,sourceEventId:eventId});
 const finish=row=>archives.finalize({archiveId,expectedRevision:row.revision,reviewEventId:eventId});
 async function ready(){return advance(await seal(await prepare()));}
 return {repository,user,domains,archives,prepare,seal,advance,finish,ready,gmProvider};
}
test('ADR-059: concluded arc archive resolves its summary lazily while retaining exact event history without preload',async()=>{
 const s=await setup();await s.finish(await s.ready());
 const calls=[],read=s.domains.read.bind(s.domains);s.domains.read=async(type,...args)=>{calls.push(type);return read(type,...args);};
 const summary=await s.archives.readSummary({arcId});assert.equal(summary.title,'Harbor conclusion');assert.equal(summary.state,'archived');assert.equal(summary.coverage,'explicit-members-only');
 assert.deepEqual(calls,['arc-archive-summary']);
 const page=await s.archives.loadPage({archiveId});assert.equal(page.items.length,2);assert.equal(page.items[0].data.status,'concluded');assert.equal(page.items[0].revision,2);
 const arc=await read('arc','world',arcId);assert.equal(arc.data.status,'concluded');assert.equal(arc.data.archive.archiveId,archiveId);
 const resolution=await read('arc-resolution','world',resolutionId),loc=await domainRevisionLocator('arc-resolution','world',resolutionId,resolution.revision);
 assert.equal((await s.repository.read(loc.id,loc)).snapshot.id,resolutionId,'Retention durably freezes a source that has not subsequently changed');
});
test('archived chronology retains its original durable event fingerprint and accepted event content',async()=>{
 const s=await setup(),ledger=new DurableEventLedger({...s,now:()=>200}),index=new NativeChronologyIndex(s),chronology=new PersistentNarrativeChronology({domains:s.domains,ledger,index,worldTimeProvider:()=>1000});
 const observed='ep:event:archived_occurrence001',entry='ep:chronology:archived_occurrence001';
 await ledger.accept({id:observed,eventType:'archive.observed',source:{kind:'test-fixture'},payload:{private:'original evidence'}});
 const before=await ledger.get(observed);await chronology.recordEvent({arcId,entryId:entry,eventId:observed,fictionAt:10});
 let row=await s.prepare();row=await s.archives.appendBatch({archiveId,expectedRevision:row.revision,sourceEventId:eventId,references:[{type:'chronology-event',id:entry,revision:1}]});
 row=await s.seal(row);row=await s.advance(row);row=await s.advance(row);await s.finish(row);
 const historical=(await s.archives.loadPage({archiveId,page:1})).items[0];assert.equal(historical.data.eventFingerprint,before.fingerprint);
 assert.equal((await ledger.get(observed)).fingerprint,before.fingerprint);assert.deepEqual((await ledger.get(observed)).event,before.event);
 assert.equal((await chronology.query({arcId,timeline:'fiction',from:0,to:100})).items[0].eventId,observed);
});
test('incremental archive resumes at the next retained page after service restart',async()=>{
 const s=await setup();let row=await s.prepare();
 row=await s.archives.appendBatch({archiveId,expectedRevision:row.revision,sourceEventId:eventId,references:[{type:'world-fact',id:factId,revision:1}]});
 row=await s.seal(row);row=await s.advance(row);assert.equal(row.data.completedPages,1);
 const resumed=new PersistentArcArchives({domains:s.domains}),retained=[],retain=s.domains.retainRevision.bind(s.domains);
 s.domains.retainRevision=async(...args)=>{retained.push(args[2]);return retain(...args);};
 row=await resumed.advance({archiveId,expectedRevision:row.revision,sourceEventId:eventId});assert.deepEqual(retained,[factId]);
 await resumed.finalize({archiveId,expectedRevision:row.revision,reviewEventId:eventId});
 assert.equal((await resumed.loadPage({archiveId,page:1})).items[0].data.value,'original');
 assert.equal((await resumed.readSummary({arcId})).memberCount,3);
});
test('archive keeps shared source identities and historical revisions when live facts later change',async()=>{
 const s=await setup();let row=await s.prepare();row=await s.archives.appendBatch({archiveId,expectedRevision:row.revision,sourceEventId:eventId,references:[{type:'world-fact',id:factId,revision:1}]});
 await s.domains.save({type:'world-fact',scope:'world',id:factId,data:{value:'new current truth',status:'asserted'},expectedRevision:1,sourceEventId:eventId});
 row=await s.seal(row);row=await s.advance(row);row=await s.advance(row);await s.finish(row);
 assert.equal((await s.archives.loadPage({archiveId,page:1})).items[0].data.value,'original');
 assert.equal((await s.domains.read('world-fact','world',factId)).data.value,'new current truth');
});
test('archive requires verified closure, fresh revisions and explicit GM manifest approval',async()=>{
 const s=await setup();let row=await s.prepare();
 await assert.rejects(()=>s.archives.seal({archiveId,expectedRevision:row.revision,reviewEventId:eventId}),{code:'ARCHIVE_APPROVAL'});
 await assert.rejects(()=>s.archives.seal({archiveId,expectedRevision:999,reviewEventId:eventId,approved:true}),{code:'REVISION_CONFLICT'});
 const arc=await s.domains.read('arc','world',arcId);await s.domains.save({type:'arc',scope:'world',id:arcId,data:{...arc.data,status:'active'},expectedRevision:arc.revision,sourceEventId:eventId});
 await assert.rejects(()=>s.seal(row),{code:'ARCHIVE_STALE'});assert.equal(await s.archives.readSummary({arcId}),null);
});
test('invalid or duplicate archive selections fail before changing the manifest',async()=>{
 const s=await setup(),row=await s.prepare(),args={archiveId,expectedRevision:row.revision,sourceEventId:eventId};
 await assert.rejects(()=>s.archives.appendBatch({...args,references:[{type:'arc',id:arcId,revision:2}]}),{code:'ARCHIVE_DUPLICATE'});
 await assert.rejects(()=>s.archives.appendBatch({...args,references:new Array(13).fill({type:'world-fact',id:factId,revision:1})}),{code:'ARCHIVE_BUDGET'});
 await assert.rejects(()=>s.archives.appendBatch({...args,references:[{type:'world-fact',id:factId,revision:99}]}),{code:'ARCHIVE_SOURCE_MISSING'});
 assert.equal((await s.archives.inspect({archiveId})).revision,row.revision);
 await assert.rejects(()=>s.finish(row),{code:'ARCHIVE_NOT_READY'});
});
test('interrupted retention does not advance its cursor or erase retained historical sources',async()=>{
 const s=await setup();let row=await s.seal(await s.prepare()),retain=s.domains.retainRevision.bind(s.domains),calls=0;
 s.domains.retainRevision=async(...args)=>{if(++calls===2)throw Error('retention interrupted');return retain(...args);};
 await assert.rejects(()=>s.advance(row),/retention interrupted/);assert.equal((await s.archives.inspect({archiveId})).data.completedPages,0);
 s.domains.retainRevision=retain;row=await s.advance(row);await s.finish(row);assert.equal((await s.archives.readSummary({arcId})).state,'archived');
});
test('interrupted archive commit suppresses pending summary and resumes without duplicating arc mutations',async()=>{
 const s=await setup(),row=await s.ready(),save=s.domains.save.bind(s.domains);let interrupted=false;
 s.domains.save=async spec=>{if(spec.type==='arc-archive'&&spec.data.state==='archived'&&!interrupted){interrupted=true;throw Error('manifest interrupted');}return save(spec);};
 await assert.rejects(()=>s.finish(row),/manifest interrupted/);assert.equal(await s.archives.readSummary({arcId}),null);
 assert.equal((await s.domains.read('arc','world',arcId)).revision,3);
 s.domains.save=save;await s.finish(row);assert.equal((await s.domains.read('arc','world',arcId)).revision,3);
 assert.equal((await s.archives.readSummary({arcId})).state,'archived');
});
test('summary publication interrupted after manifest completion is explicitly recoverable after restart',async()=>{
 const s=await setup(),row=await s.ready(),save=s.domains.save.bind(s.domains);
 s.domains.save=async spec=>{if(spec.type==='arc-archive-summary'&&spec.data.state==='archived')throw Error('summary interrupted');return save(spec);};
 await assert.rejects(()=>s.finish(row),/summary interrupted/);assert.equal(await s.archives.readSummary({arcId}),null);
 const job=await s.archives.inspect({archiveId});assert.equal(job.data.state,'archived');
 s.domains.save=save;const resumed=new PersistentArcArchives({domains:s.domains});
 await resumed.finalize({archiveId,expectedRevision:job.revision,reviewEventId:eventId});assert.equal((await resumed.readSummary({arcId})).state,'archived');
});
test('changed canonical arc or closure blocks archive publication rather than overwriting newer state',async()=>{
 for(const type of ['arc','arc-resolution']){
  const s=await setup(),row=await s.ready(),id=type==='arc'?arcId:resolutionId,current=await s.domains.read(type,'world',id);
  await s.domains.save({type,scope:'world',id,data:{...current.data,reviewNote:'new GM decision'},expectedRevision:current.revision,sourceEventId:eventId});
  await assert.rejects(()=>s.finish(row),{code:'ARCHIVE_STALE'});assert.equal(await s.archives.readSummary({arcId}),null);
 }
});
test('sealed archive pages reject content changes and archived history remains GM-private',async()=>{
 const s=await setup(),row=await s.seal(await s.prepare()),pageId=row.data.pageIds[0],page=await s.domains.read('arc-archive-page','world',pageId);
 await s.domains.save({type:'arc-archive-page',scope:'world',id:pageId,data:{...page.data,references:page.data.references.slice(0,1)},expectedRevision:page.revision,sourceEventId:eventId});
 await assert.rejects(()=>s.advance(row),{code:'ARCHIVE_CORRUPT'});s.user.isGM=false;
 await assert.rejects(()=>s.archives.readSummary({arcId}),{code:'GM_AUTHORITY_REVOKED'});
});
test('archive summaries list with bounded metadata reads and finalization retries are idempotent',async()=>{
 const s=await setup(),done=await s.finish(await s.ready());
 const again=await s.archives.finalize({archiveId,expectedRevision:done.revision,reviewEventId:eventId});assert.equal(again.revision,done.revision);
 const list=await s.archives.listSummaries({limit:1});assert.equal(list.items.length,1);assert.equal(list.items[0].arcId,arcId);
 await assert.rejects(()=>s.archives.listSummaries({limit:25}),{code:'DOMAIN_BUDGET'});
 await assert.rejects(()=>s.archives.prepare({arcId,archiveId:'ep:archive:another001',expectedArcRevision:3,sourceEventId:eventId,title:'New',text:'New'}),{code:'ARCHIVE_ARC_STATE'});
});
