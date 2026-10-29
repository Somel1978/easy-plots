/** Durable, GM-reviewed session continuity. A handoff is an attention snapshot;
 * it does not execute plans, resurrect dormant hooks, or author missing history.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const KINDS=new Set(['objective','event','faction','npc','obligation','story-hook','schedule','approval','arc']);
const STATUSES=new Set(['unresolved','pending','active','completed','dormant','requires-review']);
function validateReferences(refs){
 if(!Array.isArray(refs)||refs.length>48)fail('HANDOFF_BUDGET','At most 48 explicit references');
 const seen=new Set();
 for(const r of refs){
  if(!r||typeof r!=='object'||Array.isArray(r))fail('HANDOFF_REFERENCE','Reference must be a record');
  assertNarrativeId(r.id);
  if(seen.has(r.id))fail('HANDOFF_DUPLICATE','Duplicate handoff reference');seen.add(r.id);
  if(!KINDS.has(r.kind)||!STATUSES.has(r.status))fail('HANDOFF_REFERENCE','Invalid kind or status');
  if(r.note!==undefined&&(typeof r.note!=='string'||r.note.length>800))fail('HANDOFF_NOTE','Invalid GM note');
 }
}
function validateRecap(entries){
 if(!Array.isArray(entries)||entries.length>16)fail('HANDOFF_RECAP','Public recap must be bounded');
 const seen=new Set();
 for(const e of entries){
  if(!e||typeof e!=='object'||Array.isArray(e))fail('HANDOFF_RECAP','Invalid recap');
  assertNarrativeId(e.id);assertNarrativeId(e.sourceEventId);
  if(seen.has(e.id))fail('HANDOFF_RECAP','Duplicate public recap entry');seen.add(e.id);
  if(typeof e.text!=='string'||e.text.length<1||e.text.length>320)fail('HANDOFF_RECAP','Invalid public recap text');
  if(!Array.isArray(e.recipientIds)||e.recipientIds.length>20||new Set(e.recipientIds).size!==e.recipientIds.length)fail('HANDOFF_RECIPIENT','Explicit recipient allowlist required');
  for(const id of e.recipientIds)assertNarrativeId(id);
 }
}
export class PersistentSessionHandoff {
 #domains;
 constructor({domains}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function')fail('HANDOFF_DEPENDENCY','GM-only durable domain store required');
  this.#domains=domains;
 }
 async read({scope='world',sessionId}={}){assertNarrativeId(sessionId);return this.#domains.read('session-handoff',scope,sessionId);}
 async prepare({scope='world',sessionId,sourceArcId,sourceArcRevision,worldTime,sourceEventId,references=[],recap=[],expectedRevision=null}={}){
  for(const id of [sessionId,sourceArcId,sourceEventId])assertNarrativeId(id);
  if(!Number.isSafeInteger(sourceArcRevision)||sourceArcRevision<1||!Number.isFinite(worldTime)||worldTime<0)fail('HANDOFF_VERSION','Arc revision and world time required');
  validateReferences(references);validateRecap(recap);
  const old=await this.read({scope,sessionId});
  if(old?.data.state==='approved')fail('HANDOFF_FINAL','Approved handoff is immutable; prepare a new session record');
  return this.#domains.save({type:'session-handoff',scope,id:sessionId,sourceEventId,expectedRevision,
   data:{state:'draft',sourceArcId,sourceArcRevision,worldTime,sourceEventId,references:clone(references),recap:clone(recap),effectsExecuted:0,gameEventsCreated:0}});
 }
 async approve({scope='world',sessionId,expectedRevision,reviewEventId,sourceArcRevision}={}){
  for(const id of [sessionId,reviewEventId])assertNarrativeId(id);
  const old=await this.read({scope,sessionId});if(!old)fail('HANDOFF_MISSING','Session handoff not found');
  if(old.revision!==expectedRevision)fail('REVISION_CONFLICT','Session handoff changed since review');
  if(old.data.state!=='draft')fail('HANDOFF_FINAL','Handoff already approved');
  if(old.data.sourceArcRevision!==sourceArcRevision)fail('HANDOFF_STALE','Source arc revision changed');
  return this.#domains.save({type:'session-handoff',scope,id:sessionId,sourceEventId:reviewEventId,expectedRevision,
   data:{...old.data,state:'approved',reviewEventId}});
 }
 async project({scope='world',sessionId,observerId}={}){
  assertNarrativeId(observerId);const row=await this.read({scope,sessionId});
  if(!row||row.data.state!=='approved')return {recap:[]};
  // Never include internal IDs, hidden counts, status, or GM notes in a player projection.
  return {recap:row.data.recap.filter(r=>r.recipientIds.includes(observerId)).map(r=>({id:r.id,text:r.text}))};
 }
}
