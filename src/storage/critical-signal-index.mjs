/** Bounded private pending-intake index; postings never authorize replay. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {BoundedPostingPages} from './posting-pages.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export async function criticalSignalBucket(scope,eventId){
 assertNarrativeId(eventId);if(!/^ep:event:/.test(eventId)||!/^[a-z][a-z0-9-]{0,40}$/.test(scope??''))fail('SIGNAL_SCOPE','Exact scope and event identity required');
 return parseInt((await sha256Hex(`${scope}\0${eventId}`)).slice(0,2),16)%8;
}
export async function criticalSignalIndexLocator(scope,bucket){
 if(!/^[a-z][a-z0-9-]{0,40}$/.test(scope??'')||!Number.isSafeInteger(bucket)||bucket<0||bucket>=8)fail('SIGNAL_SCOPE','A specific pending signal bucket is required');
 const hash=await sha256Hex(`${scope}\0${bucket}`);return {id:`ep:signal-index:${hash.slice(0,24)}`,partitionId:`signal-index-${hash.slice(0,4)}`};
}
export class NativeCriticalSignalIndex {
 #repository;#gm;#scope;#capacity;#pages;#locks=new Map();
 constructor({repository,gmProvider,scope='world',capacity=64}={}){
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function'||!/^[a-z][a-z0-9-]{0,40}$/.test(scope)||!Number.isSafeInteger(capacity)||capacity<1||capacity>64)fail('SIGNAL_DEPENDENCY','Protected repository and bounded index required');
  this.#repository=repository;this.#gm=gmProvider;this.#scope=scope;this.#capacity=capacity;
  this.#pages=new BoundedPostingPages({repository,gmProvider,capacity,key:e=>[e.eventId],validate:e=>this.#candidate(e)});
 }
 #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
 #candidate(entry){
  assertNarrativeId(entry?.eventId);
  if(!entry.eventId.startsWith('ep:event:')||!/^[a-f0-9]{64}$/.test(entry.fingerprint??'')||typeof entry.eventType!=='string'||entry.eventType.length>80||typeof entry.documentUuid!=='string'||entry.documentUuid.length>220||typeof entry.hook!=='string'||entry.hook.length>80||Object.keys(entry).some(k=>!['eventId','fingerprint','eventType','documentUuid','hook'].includes(k)))fail('SIGNAL_INDEX_ENTRY','Only bounded signal metadata may enter the pending index');
 }
 async #read(bucket){
  const loc=await criticalSignalIndexLocator(this.#scope,bucket),gm=this.#context(),row=await this.#repository.read(loc.id,{partitionId:loc.partitionId,gm});
  if(row){
   if(row.id!==loc.id||row.partitionId!==loc.partitionId||row.kind!=='critical-signal-index'||row.scope!==this.#scope||row.bucket!==bucket||!Array.isArray(row.entries)||row.entries.length>this.#capacity)fail('SIGNAL_INDEX_CORRUPT','Pending signal index identity or capacity mismatch');
   for(const entry of row.entries){this.#candidate(entry);if(await criticalSignalBucket(this.#scope,entry.eventId)!==bucket)fail('SIGNAL_INDEX_CORRUPT','Pending signal belongs to another bucket');}
   if(new Set(row.entries.map(e=>e.eventId)).size!==row.entries.length)fail('SIGNAL_INDEX_CORRUPT','Duplicate pending signal');
   this.#pages.validateRoot(row);
   if(typeof this.#repository.hasReadyIndex==='function'&&!await this.#repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:this.#context()}))fail('INDEX_UNCERTAIN','Pending signal index requires reconciliation');
  }else if(typeof this.#repository.indexStatus==='function'&&await this.#repository.indexStatus(loc.id,{partitionId:loc.partitionId,gm:this.#context()})!==null)fail('INDEX_UNCERTAIN','Known pending bucket payload is missing');return {loc,row};
 }
 async #change(eventId,entry){
  this.#context();const bucket=await criticalSignalBucket(this.#scope,eventId),previous=this.#locks.get(bucket)??Promise.resolve();
  const work=previous.catch(()=>{}).then(async()=>{
   const {loc,row}=await this.#read(bucket),root=row?await this.#pages.reconcile(row):{...loc,kind:'critical-signal-index',scope:this.#scope,bucket,entries:[]};
   const old=await this.#pages.find(root,[eventId]);
   if(entry&&old&&JSON.stringify(old)!==JSON.stringify(entry))fail('SIGNAL_ID_CONFLICT','Signal identity has different immutable content');
   await this.#pages.change(root,entry?{entry}:{removeKey:[eventId]});
  });
  const tail=work.catch(()=>{});this.#locks.set(bucket,tail);
  try{return await work;}finally{if(this.#locks.get(bucket)===tail)this.#locks.delete(bucket);}
 }
 async stage(entry){this.#candidate(entry);await this.#change(entry.eventId,clone(entry));}
 async remove(eventId){await this.#change(eventId,null);}
 async get(eventId){const bucket=await criticalSignalBucket(this.#scope,eventId),{row}=await this.#read(bucket);return row?this.#pages.find(row,[eventId]):null;}
 async reconcile(bucket){const {row}=await this.#read(bucket);return row?this.#pages.reconcile(row):null;}
 async page({limit=16,cursor=null}={}){
  this.#context();if(!Number.isSafeInteger(limit)||limit<1||limit>32)fail('SIGNAL_QUERY','Bounded pending signal page required');
  if(cursor&&(!Number.isSafeInteger(cursor.bucket)||cursor.bucket<0||cursor.bucket>=8||!Number.isSafeInteger(cursor.offset)||cursor.offset<0||cursor.offset>this.#capacity||!(cursor.revision===null||Number.isSafeInteger(cursor.revision)&&cursor.revision>0)||cursor.scope!==this.#scope||cursor.page!==undefined&&(!Number.isInteger(cursor.page)||cursor.page<0||cursor.page>=128)||cursor.unopened&&(cursor.offset!==0||(cursor.page??0)!==0)))fail('SIGNAL_CURSOR','Pending cursor belongs to another query');
  const items=[];let scannedBuckets=0,scannedPages=0;
  for(let bucket=cursor?.bucket??0;bucket<8;bucket++){
   const {row}=await this.#read(bucket);scannedBuckets++;
   if(cursor?.bucket===bucket&&!cursor.unopened&&cursor.revision!==(row?.revision??null))fail('SIGNAL_CURSOR_STALE','Pending intake changed; restart this bounded query');
   let position={page:cursor?.bucket===bucket?cursor.page??0:0,offset:cursor?.bucket===bucket?cursor.offset:0};
   if(!row)continue;
   while(true){
    if(items.length===limit||scannedPages===8)return {items,nextCursor:{scope:this.#scope,bucket,...position,revision:row.revision,version:2},scannedBuckets,scannedPages};
    const result=await this.#pages.page(row,{...position,limit:limit-items.length});scannedPages++;
    for(const e of result.items){if(await criticalSignalBucket(this.#scope,e.eventId)!==bucket)fail('SIGNAL_INDEX_CORRUPT','Posting belongs to another pending bucket');items.push(e);}
    if(!result.nextCursor)break;position=result.nextCursor;
   }
   if((items.length===limit||scannedPages===8)&&bucket<7)return {items,nextCursor:{scope:this.#scope,bucket:bucket+1,page:0,offset:0,revision:null,unopened:true,version:2},scannedBuckets,scannedPages};
  }return {items,nextCursor:null,scannedBuckets,scannedPages};
 }
}
