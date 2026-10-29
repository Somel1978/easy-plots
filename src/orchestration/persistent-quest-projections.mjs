/** Authored, versioned player quest views. The GM defines exactly which
 * objective descriptions each observer may see. Canonical revisions are
 * rechecked during projection; stale snapshots fail closed rather than
 * presenting old state or exposing the existence of undisclosed objectives.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const STATES=new Set(['available','active','completed']);
const SCOPE=/^[a-z][a-z0-9-]{0,48}$/;
const owned=v=>v&&typeof v==='object'&&!Array.isArray(v);
function verifyManifest(manifest){
 if(!owned(manifest))fail('QUEST_PROJECTION_CONTRACT','Plain publication contract required');
 for(const id of [manifest.id,manifest.questId,manifest.publicId])assertNarrativeId(id);
 if(manifest.publicId===manifest.questId||manifest.publicId===manifest.id)fail('QUEST_PROJECTION_PUBLIC_ID','Use an independent audience-safe quest ID');
 if(typeof manifest.title!=='string'||!manifest.title.trim()||manifest.title.length>100)fail('QUEST_PROJECTION_TITLE','Bounded audience-safe quest title required');
 if(!Array.isArray(manifest.observerIds)||manifest.observerIds.length<1||manifest.observerIds.length>24||new Set(manifest.observerIds).size!==manifest.observerIds.length)
  fail('QUEST_PROJECTION_OBSERVERS','Explicit unique recipient list required');
 for(const id of manifest.observerIds)assertNarrativeId(id);
 if(!Array.isArray(manifest.objectives)||manifest.objectives.length>24)fail('QUEST_PROJECTION_OBJECTIVES','At most 24 explicitly disclosed objectives');
 const ids=new Set(),publicIds=new Set();
 for(const obj of manifest.objectives){
  if(!owned(obj))fail('QUEST_PROJECTION_CONTRACT','Objective disclosure must be a record');
  assertNarrativeId(obj.objectiveId);assertNarrativeId(obj.publicId);
  if(ids.has(obj.objectiveId)||publicIds.has(obj.publicId)||obj.publicId===obj.objectiveId)fail('QUEST_PROJECTION_IDENTITY','Nonunique or private objective identifier');
  ids.add(obj.objectiveId);publicIds.add(obj.publicId);
  if(!Number.isSafeInteger(obj.expectedRevision)||obj.expectedRevision<1)fail('QUEST_PROJECTION_REVISION','Canonical objective version required');
  if(!STATES.has(obj.status))fail('QUEST_PROJECTION_STATE','Public objective status must be authored');
  if(typeof obj.text!=='string'||!obj.text.trim()||obj.text.length>240)fail('QUEST_PROJECTION_TEXT','Bounded audience-safe objective wording required');
  if(!Array.isArray(obj.recipientIds)||obj.recipientIds.length<1||obj.recipientIds.length>24||new Set(obj.recipientIds).size!==obj.recipientIds.length)
   fail('QUEST_PROJECTION_RECIPIENT','Each objective needs explicit recipient allowlist');
  for(const id of obj.recipientIds){assertNarrativeId(id);if(!manifest.observerIds.includes(id))fail('QUEST_PROJECTION_RECIPIENT','Objective recipient not in quest allowlist');}
 }
}
export class PersistentQuestProjections {
 #domains;
 constructor({domains}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function')fail('QUEST_PROJECTION_DEPENDENCY','GM-only canonical domain store required');
  this.#domains=domains;
 }
 async read({scope='world',publicationId}={}){assertNarrativeId(publicationId);return this.#domains.read('quest-publication',scope,publicationId);}
 async prepare({scope='world',manifest,sourceEventId,expectedRevision=null}={}){
  if(typeof scope!=='string'||!SCOPE.test(scope))fail('QUEST_PROJECTION_SCOPE','Valid scoped publication required');
  verifyManifest(manifest);assertNarrativeId(sourceEventId);
  const prior=await this.read({scope,publicationId:manifest.id});
  if(prior?.data.state==='approved')fail('QUEST_PROJECTION_FINAL','Approved publication is immutable; prepare another revision identifier');
  for(const obj of manifest.objectives){
   const canonical=await this.#domains.read('objective',scope,obj.objectiveId);
   if(!canonical||canonical.revision!==obj.expectedRevision||canonical.data?.state!==obj.status)
    fail('QUEST_PROJECTION_STALE','Canonical objective state changed; GM must re-review the disclosure');
  }
  return this.#domains.save({type:'quest-publication',scope,id:manifest.id,sourceEventId,expectedRevision,
   data:{...clone(manifest),state:'draft',sourceEventId}});
 }
 async approve({scope='world',publicationId,expectedRevision,reviewEventId}={}){
  assertNarrativeId(publicationId);assertNarrativeId(reviewEventId);
  const prior=await this.read({scope,publicationId});
  if(!prior||prior.data.state!=='draft')fail('QUEST_PROJECTION_MISSING','Reviewed draft publication required');
  if(prior.revision!==expectedRevision)fail('REVISION_CONFLICT','Publication changed since review');
  for(const obj of prior.data.objectives){
   const canonical=await this.#domains.read('objective',scope,obj.objectiveId);
   if(!canonical||canonical.revision!==obj.expectedRevision||canonical.data?.state!==obj.status)fail('QUEST_PROJECTION_STALE','Canonical objective changed before approval');
  }
  return this.#domains.save({type:'quest-publication',scope,id:publicationId,expectedRevision,sourceEventId:reviewEventId,
   data:{...clone(prior.data),state:'approved',reviewEventId}});
 }
 async project({scope='world',publicationId,observerId}={}){
  assertNarrativeId(publicationId);assertNarrativeId(observerId);
  const row=await this.read({scope,publicationId});
  if(!row||row.data.state!=='approved'||!row.data.observerIds.includes(observerId))return null;
  const selected=[];
  for(const objective of row.data.objectives){
   if(!objective.recipientIds.includes(observerId))continue;
   const canonical=await this.#domains.read('objective',scope,objective.objectiveId);
   if(!canonical||canonical.revision!==objective.expectedRevision||canonical.data?.state!==objective.status)return null;
   selected.push({id:objective.publicId,text:objective.text,status:objective.status});
  }
  if(!selected.length)return null;
  // Return no canonical IDs, observer IDs, undisclosed counts or GM notes.
  return {id:row.data.publicId,title:row.data.title,objectives:selected};
 }
}
