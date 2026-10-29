/** Exact arc/time/observer buckets. Postings are candidates, never authority. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {BoundedPostingPages} from './posting-pages.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const scopePattern=/^[a-z][a-z0-9-]{0,45}$/;
const validTime=value=>Number.isFinite(value)&&value>=0&&value<=1e13;
function selection({scope,arcId,timeline,observerId=null}){
 if(!scopePattern.test(scope??'')||!['fiction','execution','knowledge'].includes(timeline))fail('CHRONOLOGY_SCOPE','An explicit arc and timeline are required');
 assertNarrativeId(arcId);
 if(timeline==='knowledge')assertNarrativeId(observerId);else if(observerId!==null)fail('CHRONOLOGY_SCOPE','Observer selection belongs only to knowledge chronology');
 return {scope,arcId,timeline,observerId};
}
export async function chronologyBucketLocator(query,bucket){
 const key=selection(query),bucketWidth=query.bucketWidth??3600;if(!Number.isSafeInteger(bucket)||bucket<0||!Number.isSafeInteger(bucketWidth)||bucketWidth<1)fail('CHRONOLOGY_TIME','Valid bucket and width required');
 const hash=await sha256Hex(JSON.stringify({...key,bucket,bucketWidth}));
 return {id:`ep:chronology-index:${hash.slice(0,24)}`,partitionId:`chronology-index-${hash.slice(0,4)}`};
}
const compare=(a,b)=>a.timestamp-b.timestamp||a.causalDepth-b.causalDepth||a.id.localeCompare(b.id);
export class NativeChronologyIndex {
 #repository;#gm;#width;#maximum;#capacity;#pages;
 constructor({repository,gmProvider,bucketWidth=3600,maxBuckets=24,capacity=64}={}){
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function'||!Number.isSafeInteger(bucketWidth)||bucketWidth<1||!Number.isSafeInteger(maxBuckets)||maxBuckets<1||maxBuckets>24||!Number.isSafeInteger(capacity)||capacity<1||capacity>128)fail('CHRONOLOGY_DEPENDENCY','Bounded index and protected repository required');
  this.#repository=repository;this.#gm=gmProvider;this.#width=bucketWidth;this.#maximum=maxBuckets;this.#capacity=capacity;
  this.#pages=new BoundedPostingPages({repository,gmProvider,capacity,key:e=>[e.timestamp,e.causalDepth,e.id],validate:e=>this.#entry(e)});
 }
 #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
 #entry(entry){
  assertNarrativeId(entry?.id);
  if(!validTime(entry.timestamp)||!Number.isSafeInteger(entry.sourceRevision)||entry.sourceRevision<1||!Number.isSafeInteger(entry.causalDepth)||entry.causalDepth<0||entry.causalDepth>32)fail('CHRONOLOGY_ENTRY','A bounded timestamp and canonical revision are required');
 }
 async #read(query,bucket){
  const loc=await chronologyBucketLocator({...query,bucketWidth:this.#width},bucket),gm=this.#context(),row=await this.#repository.read(loc.id,{partitionId:loc.partitionId,gm});
  if(row){
   if(row.id!==loc.id||row.partitionId!==loc.partitionId||row.kind!=='chronology-index'||row.bucket!==bucket||JSON.stringify(row.selection)!==JSON.stringify(selection(query))||!Array.isArray(row.entries)||row.entries.length>this.#capacity)fail('CHRONOLOGY_CORRUPT','Chronology bucket identity or capacity mismatch');
   row.entries.forEach(e=>{this.#entry(e);if(Math.floor(e.timestamp/this.#width)!==bucket)fail('CHRONOLOGY_CORRUPT','Chronology posting belongs to another bucket');});
   if(new Set(row.entries.map(e=>e.id)).size!==row.entries.length)fail('CHRONOLOGY_CORRUPT','Duplicate chronology identity');
   this.#pages.validateRoot(row);
   if(typeof this.#repository.hasReadyIndex==='function'&&!await this.#repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:this.#context()}))fail('INDEX_UNCERTAIN','Chronology index requires reconciliation');
  }
  if(!row&&typeof this.#repository.indexStatus==='function'&&await this.#repository.indexStatus(loc.id,{partitionId:loc.partitionId,gm:this.#context()})!==null)fail('INDEX_UNCERTAIN','Known chronology bucket payload is missing');
  return {loc,row};
 }
 async stage(query,entry){
  this.#context();this.#entry(entry);const key=selection(query),bucket=Math.floor(entry.timestamp/this.#width),{loc,row}=await this.#read(key,bucket);
  const candidate={id:entry.id,timestamp:entry.timestamp,sourceRevision:entry.sourceRevision,causalDepth:entry.causalDepth};
  const root=row??{...loc,kind:'chronology-index',selection:key,bucket,entries:[]};
  const saved=await this.#pages.change(root,{entry:candidate});return {staged:true,revision:saved.revision};
 }
 async reconcile(query,bucket){const {row}=await this.#read(selection(query),bucket);return row?this.#pages.reconcile(row):null;}
 async page(query,{from,to,limit=16,cursor=null}={}){
  this.#context();const key=selection(query);
  if(!validTime(from)||!validTime(to)||to<from||!Number.isSafeInteger(limit)||limit<1||limit>32)fail('CHRONOLOGY_QUERY','Bounded forward chronology interval required');
  const first=Math.floor(from/this.#width),last=Math.floor(to/this.#width);
  if(last-first+1>this.#maximum)fail('CHRONOLOGY_BUDGET','Chronology interval crosses too many indexed buckets');
  const queryHash=await sha256Hex(JSON.stringify({key,from,to,width:this.#width}));
  if(cursor&&(!Number.isSafeInteger(cursor.bucket)||cursor.bucket<first||cursor.bucket>last||!Number.isSafeInteger(cursor.offset)||cursor.offset<0||cursor.offset>this.#capacity||cursor.queryHash!==queryHash||!(cursor.revision===null||Number.isSafeInteger(cursor.revision)&&cursor.revision>0)||cursor.page!==undefined&&(!Number.isInteger(cursor.page)||cursor.page<0||cursor.page>=128)||cursor.unopened&&(cursor.offset!==0||(cursor.page??0)!==0)))fail('CHRONOLOGY_CURSOR','Cursor belongs to another query or policy');
  const items=[];let scannedBuckets=0,scannedPages=0;
  for(let bucket=cursor?.bucket??first;bucket<=last;bucket++){
   const {row}=await this.#read(key,bucket);scannedBuckets++;
   if(cursor?.bucket===bucket&&!cursor.unopened&&cursor.revision!==(row?.revision??null))fail('CHRONOLOGY_CURSOR_STALE','Bucket changed; restart this bounded query');
   let position={page:cursor?.bucket===bucket?cursor.page??0:0,offset:cursor?.bucket===bucket?cursor.offset:0};
   if(!row)continue;
   while(true){
    if(items.length===limit||scannedPages===24)return {items:clone(items),nextCursor:{queryHash,bucket,...position,revision:row.revision,version:2},scannedBuckets,scannedPages};
    const result=await this.#pages.page(row,{...position,limit:limit-items.length});scannedPages++;
    for(const e of result.items){if(Math.floor(e.timestamp/this.#width)!==bucket)fail('CHRONOLOGY_CORRUPT','Chronology posting belongs to another bucket');if(e.timestamp>=from&&e.timestamp<=to)items.push(e);}
    if(!result.nextCursor)break;position=result.nextCursor;
   }
   if((items.length===limit||scannedPages===24)&&bucket<last)return {items:clone(items),nextCursor:{queryHash,bucket:bucket+1,page:0,offset:0,revision:null,unopened:true,version:2},scannedBuckets,scannedPages};
  }
  return {items,nextCursor:null,scannedBuckets,scannedPages};
 }
}
