/** GM-authoritative, recipient-specific knowledge provenance.
 * Truth stays in protected claim records; a recipient only sees explicitly
 * approved receipt projections with a stable PUBLIC identifier and text.
 * No automatic rumor spread, implicit sharing, or downstream world effects.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {receiptKnowledgeTime} from '../domains/knowledge.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const SCOPE=/^[a-z][a-z0-9-]{0,47}$/;
const STANCE=new Set(['reported','believed','doubted','disputed','retracted']);
const CORRECTION=new Set(['retracted','superseded','contested','confirmed']);
function scopeCheck(scope){if(typeof scope!=='string'||!SCOPE.test(scope))fail('KNOWLEDGE_SCOPE','Bounded knowledge scope required');return scope;}
function textCheck(text,max){return typeof text==='string'&&text.length>0&&text.length<=max;}
function normalizeId(value){assertNarrativeId(value);return value;}
const receiptId=async({scope,claimId,observerId,sourceEventId})=>
 `ep:knowledge-receipt:${(await sha256Hex([scope,claimId,observerId,sourceEventId].join('|'))).slice(0,30)}`;
export class PersistentKnowledgeLedger {
 #domains;#worldTime;#beforeCorrection;
 constructor({domains,worldTimeProvider=null,beforeCorrectionPersist=null}={}){if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||worldTimeProvider!==null&&typeof worldTimeProvider!=='function'||beforeCorrectionPersist!==null&&typeof beforeCorrectionPersist!=='function')fail('KNOWLEDGE_STORE','GM protected domain store and optional trusted clock/correction index required');this.#domains=domains;this.#worldTime=worldTimeProvider;this.#beforeCorrection=beforeCorrectionPersist;}
 async createClaim({scope='world',claimId,publicId,publicText,canonicalTruth,sourceEventId}={}){
  scopeCheck(scope);for(const id of [claimId,publicId,sourceEventId])normalizeId(id);
  if(!textCheck(publicText,600)||!textCheck(canonicalTruth,2000))fail('KNOWLEDGE_CLAIM','Authored public and canonical wording required');
  return this.#domains.save({type:'knowledge-claim',scope,id:claimId,sourceEventId,
   data:{claimId,publicId,publicText,canonicalTruth,status:'established',sourceEventId},visibility:'gm-only'});
 }
 async recordDisclosure({scope='world',claimId,observerId,sourceEventId,sourceId,stance='reported',
  state='published',availableAt=0,authorized=true}={}){
  scopeCheck(scope);for(const id of [claimId,observerId,sourceEventId,sourceId])normalizeId(id);
  if(!STANCE.has(stance)||!['published','pending-review'].includes(state)||
     !Number.isFinite(availableAt)||availableAt<0||authorized!==true)
   fail('KNOWLEDGE_DISCLOSURE','Only explicitly GM-authorized typed disclosures allowed');
  const claim=await this.#domains.read('knowledge-claim',scope,claimId);
  if(!claim)fail('KNOWLEDGE_CLAIM_MISSING','Existing authoritative claim required');
  const id=await receiptId({scope,claimId,observerId,sourceEventId});
  const prior=await this.#domains.read('knowledge-receipt',scope,id);
  let timestamps={};
  if(prior){if(prior.data.disclosedAt!==undefined)timestamps={disclosedAt:prior.data.disclosedAt,knowledgeAt:prior.data.knowledgeAt};}
  else if(this.#worldTime){
   const disclosedAt=this.#worldTime();if(!Number.isFinite(disclosedAt)||disclosedAt<0)fail('KNOWLEDGE_TIME','Trusted disclosure time is unavailable');
   timestamps={disclosedAt,knowledgeAt:Math.max(disclosedAt,availableAt)};
  }
  const data={claimId,observerId,sourceEventId,sourceId,stance,state,availableAt,
   claimRevision:claim.revision,...timestamps};
  if(prior){if(JSON.stringify(prior.data)===JSON.stringify(data))return clone(prior);
   fail('KNOWLEDGE_RECEIPT_CONFLICT','Same disclosure identity reused with different content');}
  return this.#domains.save({type:'knowledge-receipt',scope,id,data,sourceEventId,visibility:'gm-only'});
 }
 async correctReceipt({scope='world',correctionId,receiptId:rid,sourceEventId,sourceId,kind,
   revisedStance,reason}={}){
  scopeCheck(scope);for(const id of [correctionId,rid,sourceEventId,sourceId])normalizeId(id);
  if(!CORRECTION.has(kind)||!STANCE.has(revisedStance)||!textCheck(reason,400))
   fail('KNOWLEDGE_CORRECTION','Explicit supported correction and bounded reason required');
  const receipt=await this.#domains.read('knowledge-receipt',scope,rid);
  if(!receipt)fail('KNOWLEDGE_RECEIPT_MISSING','Historical disclosure receipt required');
  const data={receiptId:rid,claimId:receipt.data.claimId,observerId:receipt.data.observerId,kind,revisedStance,reason,sourceId,sourceEventId,receiptRevision:receipt.revision},prior=await this.#domains.read('knowledge-correction',scope,correctionId);
  if(prior&&JSON.stringify(prior.data)!==JSON.stringify(data))fail('KNOWLEDGE_CORRECTION_CONFLICT','Correction identity already has another immutable statement');
  // Stage the exact receipt lookup before the correction can exist. A lost
  // acknowledgement leaves dependents blocked, never silently untracked.
  if(this.#beforeCorrection)await this.#beforeCorrection({scope,correctionId,receiptId:rid,receiptRevision:receipt.revision,payloadDigest:await sha256Hex(JSON.stringify(data))});
  if(prior)return prior;
  return this.#domains.save({type:'knowledge-correction',scope,id:correctionId,sourceEventId,data,visibility:'gm-only'});
 }
 /** Exactly the supplied, scoped receipt IDs are consulted. No global scan.
  * Correction IDs must also have been explicitly authorized for this observer.
  */
 async projection({scope='world',observerId,receiptIds=[],correctionIds=[],worldTime=0,max=32}={}){
  scopeCheck(scope);normalizeId(observerId);
  if(!Array.isArray(receiptIds)||!Array.isArray(correctionIds)||receiptIds.length>max||correctionIds.length>max||
     !Number.isInteger(max)||max<1||max>64||!Number.isFinite(worldTime)||worldTime<0)
   fail('KNOWLEDGE_BUDGET','Bounded observer projection required');
  for(const ids of [receiptIds,correctionIds]){ids.forEach(normalizeId);if(new Set(ids).size!==ids.length)fail('KNOWLEDGE_DUPLICATE','Duplicate projection identity');}
  const correctionMap=new Map();
  for(const id of correctionIds){
   const row=await this.#domains.read('knowledge-correction',scope,id);if(!row)fail('KNOWLEDGE_CORRECTION_MISSING','Approved correction unavailable');
   if(row.data.observerId!==observerId)fail('KNOWLEDGE_OBSERVER_DENIED','Correction belongs to another observer');
   if(correctionMap.has(row.data.receiptId))fail('KNOWLEDGE_CONFLICT','Multiple unresolved corrections to one receipt');
   correctionMap.set(row.data.receiptId,row.data);
  }
  const results=[],seenPublic=new Set();
  for(const id of receiptIds){
   const receipt=await this.#domains.read('knowledge-receipt',scope,id);
   // A caller must not test for hidden receipt existence across observers.
   if(!receipt||receipt.data.observerId!==observerId||receipt.data.state!=='published')continue;
   if(receiptKnowledgeTime(receipt.data)>worldTime)continue;
   const revision=receipt.data.claimRevision;
   if(!Number.isSafeInteger(revision)||revision<1)fail('KNOWLEDGE_RECEIPT_REVISION','Receipt lacks a verified historical claim revision');
   let claim=await this.#domains.read('knowledge-claim',scope,receipt.data.claimId);
   if(claim?.revision!==revision)claim=typeof this.#domains.readRevision==='function'?await this.#domains.readRevision('knowledge-claim',scope,receipt.data.claimId,revision):null;
   if(!claim||claim.revision!==revision)fail('KNOWLEDGE_CLAIM_REVISION_MISSING','The exact disclosed claim revision is unavailable; do not substitute current wording');
   if(seenPublic.has(claim.data.publicId))fail('KNOWLEDGE_DUPLICATE','Ambiguous public claim identity');
   seenPublic.add(claim.data.publicId);
   const correction=correctionMap.get(id);
   if(correction&&(correction.receiptRevision!==receipt.revision||correction.claimId!==receipt.data.claimId))fail('KNOWLEDGE_CORRECTION_STALE','Correction does not match the exact historical receipt');
   results.push({id:claim.data.publicId,text:claim.data.publicText,
    stance:correction?.revisedStance??receipt.data.stance,
    correctionPublished:Boolean(correction),state:'known'});
  }
  return clone({observerId,claims:results});
 }
}
