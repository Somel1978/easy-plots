/** Independent fiction, execution and observer-learning time axes. GM only. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const validTime=value=>Number.isFinite(value)&&value>=0&&value<=1e13;
export class PersistentNarrativeChronology {
 #domains;#ledger;#index;#worldTime;
 constructor({domains,ledger,index,worldTimeProvider}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||typeof ledger?.get!=='function'||typeof index?.stage!=='function'||typeof index?.page!=='function'||typeof worldTimeProvider!=='function')fail('CHRONOLOGY_DEPENDENCY','Protected domain/event stores, scoped index and trusted clock required');
  this.#domains=domains;this.#ledger=ledger;this.#index=index;this.#worldTime=worldTimeProvider;
 }
 async #arc(scope,arcId){assertNarrativeId(arcId);if(!await this.#domains.read('arc',scope,arcId))fail('CHRONOLOGY_ARC','Existing scoped arc required');}
 async #immutable(type,scope,id,data,sourceEventId){
  const old=await this.#domains.read(type,scope,id);
  if(old){if(JSON.stringify(old.data)!==JSON.stringify(data))fail('CHRONOLOGY_IMMUTABLE','Chronology identity cannot be reinterpreted; append a correction');return old;}
  return this.#domains.save({type,scope,id,data,sourceEventId});
 }
 async recordEvent({scope='world',entryId,arcId,eventId,fictionAt=null,causeEntryIds=[]}={}){
  for(const id of [entryId,arcId,eventId])assertNarrativeId(id);
  if(fictionAt!==null&&!validTime(fictionAt)||!Array.isArray(causeEntryIds)||causeEntryIds.length>8||new Set(causeEntryIds).size!==causeEntryIds.length)fail('CHRONOLOGY_CONTRACT','Bounded fiction time and unique causal references required');
  await this.#arc(scope,arcId);const event=await this.#ledger.get(eventId);
  if(!event||!validTime(event.acceptedAt))fail('CHRONOLOGY_EXECUTION_TIME','Event requires its recorded acceptance time; legacy dates are not inferred');
  const causes=[];let causalDepth=0;
  for(const id of causeEntryIds){
   assertNarrativeId(id);if(id===entryId)fail('CHRONOLOGY_CAUSE','An event cannot cause itself');
   const cause=await this.#domains.read('chronology-event',scope,id);
   if(!cause||cause.data.arcId!==arcId||cause.data.executionAt>event.acceptedAt||fictionAt!==null&&cause.data.fictionAt!==null&&cause.data.fictionAt>fictionAt)fail('CHRONOLOGY_CAUSE','Causal references must precede this event in the same arc');
   causes.push({entryId:id,eventId:cause.data.eventId});causalDepth=Math.max(causalDepth,cause.data.causalDepth+1);
  }
  if(causalDepth>32)fail('CHRONOLOGY_BUDGET','Causal chain exceeds supported depth');
  const data={arcId,eventId,eventFingerprint:event.fingerprint,fictionAt,executionAt:event.acceptedAt,causes,causalDepth};
  const row=await this.#immutable('chronology-event',scope,entryId,data,eventId);
  for(const [timeline,timestamp] of [['execution',data.executionAt],['fiction',fictionAt]])if(timestamp!==null)
   await this.#index.stage({scope,arcId,timeline},{id:entryId,timestamp,causalDepth,sourceRevision:row.revision});
  return {entryId,fictionAt,executionAt:data.executionAt,causalDepth,effectsExecuted:0};
 }
 async indexDisclosure({scope='world',arcId,receiptId}={}){
  assertNarrativeId(receiptId);await this.#arc(scope,arcId);
  const receipt=await this.#domains.read('knowledge-receipt',scope,receiptId),d=receipt?.data;
  if(!d||d.state!=='published'||!validTime(d.availableAt))fail('CHRONOLOGY_DISCLOSURE','Published canonical knowledge receipt required');
  if(!validTime(d.disclosedAt)||!validTime(d.knowledgeAt)||d.knowledgeAt!==Math.max(d.disclosedAt,d.availableAt))fail('CHRONOLOGY_DISCLOSURE_TIME','A recorded disclosure time is required; availability alone does not establish historical learning');
  const claim=await this.#domains.read('knowledge-claim',scope,d.claimId);
  if(!claim)fail('CHRONOLOGY_DISCLOSURE','Canonical claim required for knowledge provenance');
  const entryId=`ep:chronology:${(await sha256Hex(JSON.stringify({scope,arcId,receiptId}))).slice(0,24)}`;
  const data={arcId,receiptId,receiptRevision:receipt.revision,observerId:d.observerId,eventId:claim.sourceEventId,claimId:d.claimId,
   disclosureEventId:receipt.sourceEventId,knowledgeAt:d.knowledgeAt,causalDepth:0};
  const row=await this.#immutable('chronology-knowledge',scope,entryId,data,receipt.sourceEventId);
  await this.#index.stage({scope,arcId,timeline:'knowledge',observerId:d.observerId},{id:entryId,timestamp:d.knowledgeAt,causalDepth:0,sourceRevision:row.revision});
  return {entryId,receiptId,knowledgeAt:d.knowledgeAt,effectsExecuted:0};
 }
 async query({scope='world',arcId,timeline,observerId=null,from,to,limit=16,cursor=null}={}){
  await this.#arc(scope,arcId);
  const page=await this.#index.page({scope,arcId,timeline,observerId},{from,to,limit,cursor}),items=[];
  let staleCandidates=0;const worldTime=this.#worldTime();if(!validTime(worldTime))fail('CHRONOLOGY_TIME','Trusted current world time is unavailable');
  for(const candidate of page.items){
   const knowledge=timeline==='knowledge',row=await this.#domains.read(knowledge?'chronology-knowledge':'chronology-event',scope,candidate.id);
   if(!row||row.revision!==candidate.sourceRevision||row.data.arcId!==arcId){staleCandidates++;continue;}
   const d=row.data;
   if(knowledge){
    const receipt=await this.#domains.read('knowledge-receipt',scope,d.receiptId);
    if(d.observerId!==observerId||receipt?.data.observerId!==observerId||receipt.revision!==d.receiptRevision||receipt.data.claimId!==d.claimId||receipt.data.state!=='published'||receipt.data.knowledgeAt!==candidate.timestamp||d.knowledgeAt!==candidate.timestamp){staleCandidates++;continue;}
    if(d.knowledgeAt>worldTime)continue;
    items.push({entryId:row.id,eventId:d.eventId,timestamp:d.knowledgeAt,disclosureEventId:d.disclosureEventId,receiptId:d.receiptId,observerId,causes:[]});
   }else{
    const event=await this.#ledger.get(d.eventId),timestamp=timeline==='fiction'?d.fictionAt:d.executionAt;
    if(!event||event.fingerprint!==d.eventFingerprint||event.acceptedAt!==d.executionAt||timestamp!==candidate.timestamp||d.causalDepth!==candidate.causalDepth){staleCandidates++;continue;}
    items.push({entryId:row.id,eventId:d.eventId,timestamp,fictionAt:d.fictionAt,executionAt:d.executionAt,causes:clone(d.causes),executionState:event.state});
   }
  }
  return {timeline,arcId,...(observerId===null?{}:{observerId}),items,nextCursor:page.nextCursor,scannedBuckets:page.scannedBuckets,staleCandidates,scope:'gm-only',effectsExecuted:0};
 }
}
