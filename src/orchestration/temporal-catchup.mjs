/** Resumable enumeration of indexed due candidates. Each retained page covers
 * one bounded bucket as observed then; late/backdated writes require a new job.
 * Enumerating never emits events, resolves schedules or executes effects.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const digest=data=>sha256Hex(JSON.stringify(data));
const pageId=async(scope,jobId,bucket,page=0)=>`ep:catchup-page:${(await sha256Hex(`${scope}|${jobId}|${bucket}${page?`|page:${page}`:''}`)).slice(0,28)}`;
export class PersistentTemporalCatchup {
 #domains;#time;
 constructor({domains,timeCoordinator}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||typeof timeCoordinator?.due!=='function'||!Number.isInteger(timeCoordinator.indexPolicy?.bucketWidth))fail('CATCHUP_DEPENDENCY','Protected job storage and bounded temporal index policy required');
  this.#domains=domains;this.#time=timeCoordinator;
 }
 async read({scope='world',id}={}){
  assertNarrativeId(id);const row=await this.#domains.read('temporal-catchup',scope,id);if(!row)return null;
  const d=row.data;
  if(!d||!Number.isSafeInteger(d.from)||!Number.isSafeInteger(d.to)||d.from< -1||d.to<0||d.to<d.from||d.to>1e9||!Number.isInteger(d.bucketWidth)||d.bucketWidth<1||d.bucketWidth>365||!Number.isSafeInteger(d.cursorBucket)||!Number.isSafeInteger(d.finalBucket)||d.finalBucket!==Math.floor(d.to/d.bucketWidth)||d.cursorBucket<Math.floor(Math.max(0,d.from)/d.bucketWidth)||d.cursorBucket>d.finalBucket+1||!['pending','enumeration-complete'].includes(d.state)||!Number.isSafeInteger(d.pagesWritten)||!Number.isSafeInteger(d.candidatesObserved)||(d.cursorPage===undefined?d.pagesWritten!==d.cursorBucket-Math.floor(Math.max(0,d.from)/d.bucketWidth):!Number.isSafeInteger(d.cursorPage)||d.cursorPage<0||d.cursorPage>4096||d.pagesWritten<d.cursorBucket-Math.floor(Math.max(0,d.from)/d.bucketWidth)+d.cursorPage||d.cursorPage===0&&d.postingCursor!==null||d.cursorPage>0&&!d.postingCursor)||d.candidatesObserved<0||(d.state==='enumeration-complete')!==(d.cursorBucket>d.finalBucket))fail('CATCHUP_CORRUPT','Catch-up cursor and range do not match');
  if(d.coverage!=='per-bucket-observed-index'||d.effectsExecuted!==0||d.outcomesInvented!==0)fail('CATCHUP_CORRUPT','Catch-up enumeration cannot establish narrative outcomes');
  if(d.bucketWidth!==this.#time.indexPolicy.bucketWidth)fail('CATCHUP_POLICY_CHANGED','Index bucket policy changed; review before creating a new catch-up job');return row;
 }
 async create({scope='world',id,from,to,sourceEventId}={}){
  assertNarrativeId(id);assertNarrativeId(sourceEventId);
  if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from< -1||to<0||to<from||to>1e9)fail('CATCHUP_RANGE','Finite authored catch-up interval required');
  const width=this.#time.indexPolicy.bucketWidth;
  return this.#domains.save({type:'temporal-catchup',scope,id,sourceEventId,data:{from,to,bucketWidth:width,cursorBucket:Math.floor(Math.max(0,from)/width),finalBucket:Math.floor(to/width),pagesWritten:0,candidatesObserved:0,cursorPage:0,postingCursor:null,state:'pending',coverage:'per-bucket-observed-index',effectsExecuted:0,outcomesInvented:0}});
 }
 async #page(job,bucket,page=0){
  const id=await pageId(job.scope,job.id,bucket,page),row=await this.#domains.read('temporal-catchup-page',job.scope,id);if(!row){if(await this.#domains.hasRecordOrIndex?.('temporal-catchup-page',job.scope,id))fail('CATCHUP_PAGE_UNCERTAIN','Known retained page has no confirmed payload');return null;}
  const d=row.data,body=d?.body;
  if(!body||body.jobId!==job.id||body.bucket!==bucket||(body.page??0)!==page||body.bucketWidth!==job.data.bucketWidth||body.rangeFrom!==job.data.from||body.rangeTo!==job.data.to||body.windowFrom!==Math.max(job.data.from,bucket*job.data.bucketWidth-1)||body.windowTo!==Math.min(job.data.to,(bucket+1)*job.data.bucketWidth-1)||!Number.isSafeInteger(body.staleCandidates)||body.staleCandidates<0||!Array.isArray(body.candidates)||body.candidates.length>64||new Set(body.candidates.map(x=>x.id)).size!==body.candidates.length||d.fingerprint!==await digest(body))fail('CATCHUP_PAGE_CORRUPT','Retained catch-up page identity or fingerprint differs');
  for(const item of body.candidates){assertNarrativeId(item.id);if(!Number.isSafeInteger(item.sourceRevision)||item.sourceRevision<1||!Number.isSafeInteger(item.dueAt)||item.dueAt<=body.windowFrom||item.dueAt>body.windowTo||item.status!=='requires-gm-evaluation')fail('CATCHUP_PAGE_CORRUPT','Invalid retained schedule candidate');}
  return row;
 }
 async readPage({scope='world',id,bucket,page=0}={}){
  const job=await this.read({scope,id});if(!job)fail('CATCHUP_MISSING','Catch-up job is unavailable');
  if(!Number.isSafeInteger(page)||page<0||page>4096||!Number.isSafeInteger(bucket)||bucket<Math.floor(Math.max(0,job.data.from)/job.data.bucketWidth)||bucket>job.data.finalBucket)fail('CATCHUP_PAGE','Select one exact bucket within this job');
  const row=await this.#page(job,bucket,page);return row?{...row,coveredByCursor:bucket<job.data.cursorBucket||bucket===job.data.cursorBucket&&page<(job.data.cursorPage??0)}:null;
 }
 async advance({scope='world',id,expectedRevision,maxBuckets=1,sourceEventId}={}){
  assertNarrativeId(sourceEventId);
  if(!Number.isInteger(maxBuckets)||maxBuckets<1||maxBuckets>8)fail('CATCHUP_BUDGET','Advance at most eight indexed buckets per request');
  let job=await this.read({scope,id});if(!job)fail('CATCHUP_MISSING','Catch-up job is unavailable');
  if(job.revision!==expectedRevision)fail('REVISION_CONFLICT','Catch-up progress changed before this step');
  const pages=[];
  while(pages.length<maxBuckets&&job.data.state==='pending'){
   const bucket=job.data.cursorBucket,ordinal=job.data.cursorPage??0,cursor=job.data.postingCursor??null;let page=await this.#page(job,bucket,ordinal);
   if(!page){
    const from=Math.max(job.data.from,bucket*job.data.bucketWidth-1),to=Math.min(job.data.to,(bucket+1)*job.data.bucketWidth-1);
    const result=await (this.#time.page?this.#time.page({scope,from,to,maxDue:64,cursor}):this.#time.due({scope,from,to,maxDue:64}));
    const body={jobId:id,bucket,page:ordinal,cursor,nextCursor:result.nextCursor??null,bucketWidth:job.data.bucketWidth,rangeFrom:job.data.from,rangeTo:job.data.to,windowFrom:from,windowTo:to,candidates:clone(result.candidates),staleCandidates:result.staleCandidates};
    await this.#domains.save({type:'temporal-catchup-page',scope,id:await pageId(scope,id,bucket,ordinal),sourceEventId,data:{body,fingerprint:await digest(body)}});
    page=await this.#page(job,bucket,ordinal);if(!page)fail('CATCHUP_PAGE_UNCERTAIN','Retained page could not be read back');
   }
   if(JSON.stringify(page.data.body.cursor??null)!==JSON.stringify(cursor))fail('CATCHUP_PAGE_CORRUPT','Retained posting page does not match this exact progress cursor');
   const postingCursor=page.data.body.nextCursor??null,cursorBucket=postingCursor?bucket:bucket+1,cursorPage=postingCursor?ordinal+1:0;if(cursorPage>4096)fail('CATCHUP_BUDGET','Dense bucket page budget exhausted');
   // Commit the cursor only after the exact immutable page was verified.
   await this.#domains.save({type:'temporal-catchup',scope,id,expectedRevision:job.revision,sourceEventId,data:{...job.data,cursorBucket,cursorPage,postingCursor,pagesWritten:job.data.pagesWritten+1,candidatesObserved:job.data.candidatesObserved+page.data.body.candidates.length,state:cursorBucket>job.data.finalBucket?'enumeration-complete':'pending'}});
   job=await this.read({scope,id});pages.push(page);
  }
  return clone({job,pages,effectsExecuted:0,outcomesInvented:0,eventsEmitted:0,gmReviewRequired:true});
 }
}
