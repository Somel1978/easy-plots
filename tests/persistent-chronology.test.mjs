import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {DurableEventLedger,eventLocator} from '../src/runtime/event-ledger.mjs';
import {NativeChronologyIndex,chronologyBucketLocator} from '../src/storage/chronology-index.mjs';
import {PersistentNarrativeChronology} from '../src/orchestration/persistent-chronology.mjs';
import {PersistentKnowledgeLedger} from '../src/orchestration/persistent-knowledge.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const arcId='ep:arc:chronology001',observerA='ep:actor:chronology_A001',observerB='ep:actor:chronology_B001';
const eventId=n=>`ep:event:chronology_${String(n).padStart(8,'0')}`,entryId=n=>`ep:timeline:entry_${String(n).padStart(8,'0')}`;
async function setup(options={}){
 const repository=new MemoryPartitionRepository(),user={id:'gm_chronology001',isGM:true},context=createLocalGMContext({user,epoch:'chronology'},'world'),gmProvider=()=>context;
 let clock=100,worldTime=1000;const domains=new NarrativeDomainStore({repository,gmProvider}),ledger=new DurableEventLedger({repository,gmProvider,now:()=>clock});
 const index=new NativeChronologyIndex({repository,gmProvider,bucketWidth:100,...options}),chronology=new PersistentNarrativeChronology({domains,ledger,index,worldTimeProvider:()=>worldTime});
 const knowledge=new PersistentKnowledgeLedger({domains,worldTimeProvider:()=>worldTime});
 await domains.save({type:'arc',scope:'world',id:arcId,data:{status:'active'},sourceEventId:eventId(0)});
 async function accept(n,at=100){clock=at;return ledger.accept({id:eventId(n),eventType:'story.observed',source:{kind:'test-fixture'},payload:{secret:'GM TRUTH'}});}
 const record=(n,fictionAt=10,causeEntryIds=[])=>chronology.recordEvent({arcId,entryId:entryId(n),eventId:eventId(n),fictionAt,causeEntryIds});
 const query=(timeline,extra={})=>chronology.query({arcId,timeline,from:0,to:400,...extra});
 return {repository,user,gmProvider,domains,ledger,index,chronology,knowledge,accept,record,query,setClock:value=>{clock=value;},setWorldTime:value=>{worldTime=value;}};
}
test('ADR-037: fiction, execution and observer knowledge chronologies sort by their distinct grounded timestamps',async()=>{
 const s=await setup();await s.accept(1,200);await s.accept(2,100);await s.record(1,10);await s.record(2,20);
 assert.deepEqual((await s.query('fiction')).items.map(x=>x.eventId),[eventId(1),eventId(2)]);
 assert.deepEqual((await s.query('execution')).items.map(x=>x.eventId),[eventId(2),eventId(1)]);
 for(const [n,at] of [[2,30],[1,40]]){
  s.setWorldTime(at);
  const claimId=`ep:claim:chronology_${n}001`;await s.knowledge.createClaim({claimId,publicId:`ep:public:chronology_${n}001`,publicText:'A report',canonicalTruth:'GM TRUTH',sourceEventId:eventId(n)});
  const receipt=await s.knowledge.recordDisclosure({claimId,observerId:observerA,sourceEventId:eventId(n+10),sourceId:'ep:source:chronology001',availableAt:at});
  await s.chronology.indexDisclosure({arcId,receiptId:receipt.id});
 }
 const knowledge=await s.query('knowledge',{observerId:observerA});assert.deepEqual(knowledge.items.map(x=>x.eventId),[eventId(2),eventId(1)]);
 assert.deepEqual(knowledge.items.map(x=>x.timestamp),[30,40]);assert.equal(JSON.stringify(knowledge).includes('GM TRUTH'),false);
 assert.deepEqual((await s.query('knowledge',{observerId:observerB})).items,[]);
});
test('causal ordering is stable on timestamp ties and rejects reversed or cross-arc causation',async()=>{
 const s=await setup();await s.accept(9);await s.accept(1);await s.record(9,10);await s.record(1,10,[entryId(9)]);
 for(const timeline of ['fiction','execution'])assert.deepEqual((await s.query(timeline)).items.map(x=>x.eventId),[eventId(9),eventId(1)]);
 await s.accept(2,90);await assert.rejects(()=>s.record(2,10,[entryId(9)]),{code:'CHRONOLOGY_CAUSE'});
 await assert.rejects(()=>s.record(2,10,[entryId(2)]),{code:'CHRONOLOGY_CAUSE'});
 await s.accept(3,110);await assert.rejects(()=>s.record(3,5,[entryId(9)]),{code:'CHRONOLOGY_CAUSE'});
});
test('chronology acceptance time survives duplicate delivery and fiction time remains explicitly optional',async()=>{
 const s=await setup();await s.accept(1,123);await s.accept(1,999);
 assert.equal((await s.ledger.get(eventId(1))).acceptedAt,123);await s.record(1,null);
 assert.equal((await s.query('execution')).items[0].timestamp,123);assert.equal((await s.query('fiction')).items.length,0);
 await assert.rejects(()=>s.record(1,50),{code:'CHRONOLOGY_IMMUTABLE'});
});
test('legacy events without recorded execution time never acquire an invented historical date',async()=>{
 const s=await setup();await s.accept(1);const loc=await eventLocator(eventId(1)),row=await s.repository.read(loc.id,loc);
 delete row.acceptedAt;await s.repository.put(row,{expectedRevision:row.revision});
 await assert.rejects(()=>s.record(1,10),{code:'CHRONOLOGY_EXECUTION_TIME'});
 assert.equal(await s.domains.read('chronology-event','world',entryId(1)),null);
});
test('chronology restarts read exact indexed buckets and page deterministically without campaign scans',async()=>{
 const s=await setup();for(let i=1;i<=5;i++){await s.accept(i,100+i);await s.record(i,i);}
 s.repository.query=()=>{throw Error('No campaign scan permitted');};
 const restored=new PersistentNarrativeChronology({domains:s.domains,ledger:s.ledger,index:new NativeChronologyIndex({...s,bucketWidth:100}),worldTimeProvider:()=>1000});
 const one=await restored.query({arcId,timeline:'fiction',from:0,to:100,limit:2});assert.equal(one.items.length,2);assert.ok(one.nextCursor);
 const two=await restored.query({arcId,timeline:'fiction',from:0,to:100,limit:2,cursor:one.nextCursor});
 assert.deepEqual(two.items.map(x=>x.eventId),[eventId(3),eventId(4)]);
 await assert.rejects(()=>restored.query({arcId,timeline:'execution',from:0,to:100,limit:2,cursor:one.nextCursor}),{code:'CHRONOLOGY_CURSOR'});
 await s.accept(6);await s.record(6,6);
 await assert.rejects(()=>s.query('fiction',{limit:2,cursor:one.nextCursor,to:100}),{code:'CHRONOLOGY_CURSOR_STALE'});
});
test('future or changed receipts are withheld and knowledge buckets are isolated by observer',async()=>{
 const s=await setup();await s.accept(1);const claimId='ep:claim:chronology_private001';
 s.setWorldTime(200);
 await s.knowledge.createClaim({claimId,publicId:'ep:public:chronology_private001',publicText:'A report',canonicalTruth:'GM TRUTH',sourceEventId:eventId(1)});
 const receipt=await s.knowledge.recordDisclosure({claimId,observerId:observerA,sourceEventId:eventId(11),sourceId:'ep:source:chronology001',availableAt:300});
 await s.chronology.indexDisclosure({arcId,receiptId:receipt.id});s.setWorldTime(200);
 assert.equal((await s.query('knowledge',{observerId:observerA})).items.length,0);
 s.setWorldTime(300);assert.equal((await s.query('knowledge',{observerId:observerA})).items.length,1);
 await s.domains.save({type:'knowledge-receipt',scope:'world',id:receipt.id,data:{...receipt.data,observerId:observerB},expectedRevision:receipt.revision,sourceEventId:eventId(12)});
 const result=await s.query('knowledge',{observerId:observerA});assert.equal(result.items.length,0);assert.equal(result.staleCandidates,1);
 assert.deepEqual((await s.query('knowledge',{observerId:observerB})).items,[]);
});
test('knowledge chronology never backdates learning to an earlier availability default and retries preserve the original disclosure time',async()=>{
 const s=await setup(),claimId='ep:claim:chronology_clock001',spec={claimId,observerId:observerA,sourceEventId:eventId(11),sourceId:'ep:source:chronology001',availableAt:0};
 await s.knowledge.createClaim({claimId,publicId:'ep:public:chronology_clock001',publicText:'A report',canonicalTruth:'GM TRUTH',sourceEventId:eventId(1)});
 s.setWorldTime(200);const receipt=await s.knowledge.recordDisclosure(spec);assert.equal(receipt.data.knowledgeAt,200);
 assert.equal((await s.knowledge.projection({observerId:observerA,receiptIds:[receipt.id],worldTime:150})).claims.length,0);
 assert.equal((await s.knowledge.projection({observerId:observerA,receiptIds:[receipt.id],worldTime:200})).claims.length,1);
 s.setWorldTime(300);const retry=await s.knowledge.recordDisclosure(spec);assert.equal(retry.revision,receipt.revision);assert.equal(retry.data.disclosedAt,200);
 await s.chronology.indexDisclosure({arcId,receiptId:receipt.id});assert.equal((await s.query('knowledge',{observerId:observerA})).items[0].timestamp,200);
});
test('legacy availability-only receipts require explicit historical review rather than invented knowledge dates',async()=>{
 const s=await setup(),legacy=new PersistentKnowledgeLedger({domains:s.domains}),claimId='ep:claim:chronology_legacy001';
 await legacy.createClaim({claimId,publicId:'ep:public:chronology_legacy001',publicText:'A report',canonicalTruth:'GM TRUTH',sourceEventId:eventId(1)});
 const receipt=await legacy.recordDisclosure({claimId,observerId:observerA,sourceEventId:eventId(11),sourceId:'ep:source:chronology001'});
 await assert.rejects(()=>s.chronology.indexDisclosure({arcId,receiptId:receipt.id}),{code:'CHRONOLOGY_DISCLOSURE_TIME'});
});
test('interrupted chronology indexing can be repaired by exact idempotent replay without rewriting history',async()=>{
 const s=await setup();await s.accept(1);const stage=s.index.stage.bind(s.index);let fail=true;
 s.index.stage=async(...args)=>{if(fail){fail=false;throw Error('index interrupted');}return stage(...args);};
 await assert.rejects(()=>s.record(1,10),/index interrupted/);assert.equal((await s.domains.read('chronology-event','world',entryId(1))).revision,1);
 await s.record(1,10);assert.equal((await s.query('fiction')).items.length,1);assert.equal((await s.domains.read('chronology-event','world',entryId(1))).revision,1);
});
test('chronology rejects missing arcs, excessive windows, missing observer selection and revoked GM authority',async()=>{
 const s=await setup();await assert.rejects(()=>s.query('execution',{arcId:'ep:arc:missing_001'}),{code:'CHRONOLOGY_ARC'});
 await assert.rejects(()=>s.query('knowledge'),{code:'INVALID_ID'});
 await assert.rejects(()=>s.query('execution',{to:10000}),{code:'CHRONOLOGY_BUDGET'});
 s.user.isGM=false;await assert.rejects(()=>s.query('execution'),{code:'GM_AUTHORITY_REVOKED'});
});
test('dense chronology buckets split storage while corrupt directories fail closed',async()=>{
 const s=await setup({capacity:1});await s.accept(1);await s.record(1);await s.accept(2);
 await s.record(2,20);assert.deepEqual((await s.query('fiction')).items.map(x=>x.eventId),[eventId(1),eventId(2)]);
 const loc=await chronologyBucketLocator({scope:'world',arcId,timeline:'fiction',bucketWidth:100},0),row=await s.repository.read(loc.id,loc);
 await s.repository.put({...row,postingPages:{...row.postingPages,total:999}},{expectedRevision:row.revision});
 await assert.rejects(()=>s.query('fiction'),{code:'POSTING_CORRUPT'});
});
