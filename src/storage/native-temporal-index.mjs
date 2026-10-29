/** Bounded, GM-only world-time due index for campaign arcs, NPC/faction
 * schedules and obligations. An entry is a CANDIDATE, never authoritative.
 * Reads revalidate against a scoped canonical schedule record; stale index
 * pages cannot execute actions or assert that off-screen outcomes happened.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {BoundedPostingPages} from './posting-pages.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const TIME_MAX=1_000_000_000;
const SCOPE=/^[a-z][a-z0-9-]{0,45}$/;
const KINDS=new Set(['npc-action','faction-action','deadline','obligation-review','explicit-expiry','arc-event']);
export async function dueBucketLocator(bucket,scope='main',sourceScope='world'){
 if(!Number.isSafeInteger(bucket)||bucket<0||!SCOPE.test(scope)||typeof sourceScope!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(sourceScope))fail('DUE_SCOPE','Invalid world-time bucket or scope');
 // Preserve existing world buckets; separate other canonical domains exactly.
 const hash=await sha256Hex(sourceScope==='world'?`ep:due-index:v1:${scope}:${bucket}`:`ep:due-index:v2:${scope}:${sourceScope}:${bucket}`);
 return {id:`ep:dueindex:${hash.slice(0,24)}`,partitionId:`due-index:${scope}:${hash.slice(0,2)}`};
}
export class NativeTemporalIndex {
 #repository;#gm;#scope;#width;#maxWindow;#maxEntries;#pages;
 constructor({repository,gmProvider,scope='main',bucketWidth=30,maxBucketsPerWindow=24,maxEntriesPerBucket=48}={}){
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function'||
    !SCOPE.test(scope)||!Number.isInteger(bucketWidth)||bucketWidth<1||bucketWidth>365||
    !Number.isInteger(maxBucketsPerWindow)||maxBucketsPerWindow<1||maxBucketsPerWindow>120||
    !Number.isInteger(maxEntriesPerBucket)||maxEntriesPerBucket<1||maxEntriesPerBucket>64)
    fail('DUE_DEPENDENCY','Valid bounded native due index repository and policy required');
  this.#repository=repository;this.#gm=gmProvider;this.#scope=scope;this.#width=bucketWidth;
  this.#maxWindow=maxBucketsPerWindow;this.#maxEntries=maxEntriesPerBucket;
  this.#pages=new BoundedPostingPages({repository,gmProvider,capacity:maxEntriesPerBucket,key:e=>[e.id],validate:e=>this.#validate(e)});
 }
 #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
 get policy(){return Object.freeze({bucketWidth:this.#width,maxBucketsPerWindow:this.#maxWindow,maxEntriesPerBucket:this.#maxEntries});}
 #bucket(dueAt){return Math.floor(dueAt/this.#width);}
 #validate(entry){
  assertNarrativeId(entry?.id);assertNarrativeId(entry.sourceEventId);
  if(!KINDS.has(entry.kind)||!Number.isSafeInteger(entry.dueAt)||entry.dueAt<0||entry.dueAt>TIME_MAX||
    !Number.isSafeInteger(entry.sourceRevision)||entry.sourceRevision<1)
    fail('DUE_ENTRY','Typed authored due event and version required');
 }
 async #read(bucket,gm,sourceScope='world'){
  const loc=await dueBucketLocator(bucket,this.#scope,sourceScope);
  const record=await this.#repository.read(loc.id,{partitionId:loc.partitionId,gm});
  if(record){
   if(record.id!==loc.id||record.partitionId!==loc.partitionId||record.kind!=='narrative-due-index'||
      record.bucket!==bucket||(record.sourceScope??'world')!==sourceScope||!Array.isArray(record.entries)||record.entries.length>this.#maxEntries)
    fail('DUE_CORRUPT','Invalid indexed temporal bucket');
   if(typeof this.#repository.hasReadyIndex==='function'&&
     !await this.#repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm}))
    fail('DUE_INDEX_UNCERTAIN','Incomplete temporal index write');
   this.#pages.validateRoot(record);
   for(const entry of record.entries)this.#validate(entry);
   if(new Set(record.entries.map(x=>x.id)).size!==record.entries.length)
    fail('DUE_CORRUPT','Duplicate schedule candidate in temporal bucket');
  }
  if(!record&&typeof this.#repository.indexStatus==='function'&&await this.#repository.indexStatus(loc.id,{partitionId:loc.partitionId,gm:this.#context()})!==null)fail('DUE_INDEX_UNCERTAIN','Known due bucket payload is missing');
  return {loc,record};
 }
 /** A changed due date may leave a stale candidate in the old bucket; bounded
  * query revalidation drops it. No distributed transaction is assumed. */
 async stage(entry){
  this.#validate(entry);const gm=this.#context(),bucket=this.#bucket(entry.dueAt),sourceScope=entry.sourceScope??'world';
  const {loc,record}=await this.#read(bucket,gm,sourceScope),candidate={id:entry.id,dueAt:entry.dueAt,kind:entry.kind,sourceRevision:entry.sourceRevision,sourceEventId:entry.sourceEventId};
  const saved=await this.#pages.change(record??{...loc,kind:'narrative-due-index',bucket,sourceScope,entries:[]},{entry:candidate});
  return {staged:true,id:entry.id,bucket,revision:saved.revision};
 }
 async reconcile(bucket,sourceScope='world'){const {record}=await this.#read(bucket,this.#context(),sourceScope);return record?this.#pages.reconcile(record):null;}
 /** Existing complete-window contract: work/result exhaustion is explicit. */
 async due(options={}){
  const result=await this.page(options);if(result.nextCursor)fail('DUE_BUDGET','Due window requires bounded paged inspection');return result;
 }
 /** Dense storage grows independently of per-call candidate/lookup budgets.
  * Every page revalidates canonical records; cursors never authorize actions. */
 async page({from,to,resolveCurrent,maxDue=64,sourceScope='world',cursor=null}={}){
  const gm=this.#context();
  if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from< -1||to<0||to<from||to>TIME_MAX||
     typeof resolveCurrent!=='function'||!Number.isInteger(maxDue)||maxDue<1||maxDue>64||typeof sourceScope!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(sourceScope))fail('DUE_QUERY','Finite bounded interval and authoritative resolver required');
  const start=this.#bucket(Math.max(0,from+1)),end=this.#bucket(to);
  if(end-start+1>this.#maxWindow)fail('DUE_BUDGET','World-time window crosses too many indexed buckets');
  const queryHash=await sha256Hex(JSON.stringify({scope:this.#scope,sourceScope,from,to,width:this.#width}));
  if(cursor&&(cursor.version!==1||cursor.queryHash!==queryHash||!Number.isInteger(cursor.bucket)||cursor.bucket<start||cursor.bucket>end||!Number.isInteger(cursor.page)||cursor.page<0||cursor.page>=128||!Number.isInteger(cursor.offset)||cursor.offset<0||cursor.offset>this.#maxEntries||!(cursor.revision===null||Number.isSafeInteger(cursor.revision)&&cursor.revision>0)||cursor.unopened&&(cursor.offset!==0||cursor.page!==0)))fail('DUE_CURSOR','Due cursor belongs to another query');
  const selected=new Map();let inspected=0,stale=0,scannedBuckets=0,scannedPages=0;
  const finish=nextCursor=>({from,to,candidates:[...selected.values()].sort((a,b)=>a.dueAt-b.dueAt||a.id.localeCompare(b.id)),scannedBuckets,scannedPages,staleCandidates:stale,outcomesInvented:0,effectsExecuted:0,gmReviewRequired:true,nextCursor});
  for(let bucket=cursor?.bucket??start;bucket<=end;bucket++){
   const {record}=await this.#read(bucket,gm,sourceScope);scannedBuckets++;
   if(cursor?.bucket===bucket&&!cursor.unopened&&cursor.revision!==(record?.revision??null))fail('DUE_CURSOR_STALE','Due bucket changed; restart bounded inspection');
   if(!record)continue;
   let position={page:cursor?.bucket===bucket?cursor.page:0,offset:cursor?.bucket===bucket?cursor.offset:0};
   while(true){
    if(selected.size===maxDue||scannedPages===24||inspected===this.#maxWindow*this.#maxEntries)return finish({version:1,queryHash,bucket,...position,revision:record.revision});
    const page=await this.#pages.page(record,{...position,limit:Math.min(32,maxDue-selected.size,this.#maxWindow*this.#maxEntries-inspected)});scannedPages++;
    for(const entry of page.items){
     if(this.#bucket(entry.dueAt)!==bucket)fail('DUE_CORRUPT','Due posting belongs to another bucket');
     if(entry.dueAt<=from||entry.dueAt>to)continue;
     if(++inspected>this.#maxWindow*this.#maxEntries)fail('DUE_BUDGET','Due candidate work budget exceeded');
     const current=await resolveCurrent(entry.id,entry.kind,{gm});this.#context();
     if(!current||current.sourceRevision!==entry.sourceRevision||current.dueAt!==entry.dueAt||!['pending','due'].includes(current.status)){stale++;continue;}
     const old=selected.get(entry.id);if(old&&old.sourceRevision!==entry.sourceRevision)fail('DUE_CONFLICT','Competing canonical schedule versions');
     selected.set(entry.id,{id:entry.id,dueAt:entry.dueAt,kind:entry.kind,sourceRevision:entry.sourceRevision,status:'requires-gm-evaluation'});
    }
    if(!page.nextCursor)break;position=page.nextCursor;
   }
   if((selected.size===maxDue||scannedPages===24)&&bucket<end)return finish({version:1,queryHash,bucket:bucket+1,page:0,offset:0,revision:null,unopened:true});
  }
  return finish(null);
 }
}
