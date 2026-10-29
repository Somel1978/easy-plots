/** Explicit GM manual narrative event ingress. Requests are keyed by a
 * stable GM-authored intent ID; duplicate submission returns the ledger's
 * original event status and cannot duplicate effect proposals.
 * This is never called from a player socket or a background service.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {assertEventType} from './active-subscriptions.mjs';
import {versionedEvent} from '../contracts/canonical-event.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
function safePayload(payload){
 assertPlainObject(payload,'MANUAL_EVENT_PAYLOAD');
 const forbidden=new Set(['__proto__','constructor','prototype']);
 if(Object.keys(payload).length>24||Object.keys(payload).some(k=>forbidden.has(k)||!/^[a-z][a-zA-Z0-9_]{0,63}$/.test(k)))
  fail('MANUAL_EVENT_PAYLOAD','Invalid or unbounded payload field');
 const safe=clone(payload);const encoded=JSON.stringify(safe);
 if(encoded===undefined||new TextEncoder().encode(encoded).length>2048)fail('MANUAL_EVENT_BUDGET','GM event payload exceeds budget');
 // No DOM object, executable functions, NaN, circular or inherited values.
 for(const value of Object.values(safe))if(value!==null&&typeof value==='object'&&
  (!Array.isArray(value)||value.length>16||value.some(v=>typeof v!=='string'||v.length>120)))
  fail('MANUAL_EVENT_PAYLOAD','Only bounded string lists and scalar values are accepted');
 return JSON.parse(encoded);
}
export class GMManualEventGateway{
 #router;#gm;#writer;#world;#time;#verifyDue;#ledger;
 constructor({router,gmProvider,writer,worldId,timeCoordinator=null,verifyDueSource=null,ledger=null}={}){
  if(typeof router?.ingest!=='function'||typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function'||
     typeof worldId!=='string'||worldId.length<1||worldId.length>120)
   fail('MANUAL_EVENT_GATEWAY','GM router, designated writer and world identity required');
  if(verifyDueSource!==null&&typeof verifyDueSource!=='function')fail('MANUAL_EVENT_GATEWAY','Due-source verifier must be callable');
  if(ledger!==null&&typeof ledger?.get!=='function')fail('MANUAL_EVENT_GATEWAY','Protected due-event ledger reader required');
  this.#router=router;this.#gm=gmProvider;this.#writer=writer;this.#world=worldId;this.#time=timeCoordinator;this.#verifyDue=verifyDueSource;this.#ledger=ledger;
 }
 async emitDue({scope='world',scheduleId,worldTime}={}){
  assertNarrativeId(scheduleId);
  if(!this.#time?.read||!this.#time?.due)fail('SCHEDULE_UNAVAILABLE','Protected due-event coordinator required');
  if(!Number.isSafeInteger(worldTime)||worldTime<0||worldTime>1e9)
   fail('SCHEDULE_TIME','Finite current fictional time required');
  const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);
  const row=await this.#time.read({scope,id:scheduleId});
  if(!row||!['pending','due'].includes(row.data.status)||row.data.dueAt>worldTime)
   fail('SCHEDULE_NOT_DUE','Only established due commitments may enter the event pipeline');
  const digest=await sha256Hex(`${this.#world}|${scope}|${scheduleId}|${row.revision}|due`),eventId=`ep:event:due_${digest.slice(0,32)}`;
  const existing=await this.#ledger?.get(eventId);
  if(existing){
   if(existing.event.eventType!=='narrative.schedule-due'||existing.event.source?.scheduleId!==scheduleId||existing.event.payload?.sourceRevision!==row.revision||existing.event.payload?.ownerId!==row.data.ownerId||existing.event.payload?.kind!==row.data.kind||existing.event.payload?.dueAt!==row.data.dueAt)fail('EVENT_REUSE_CONFLICT','Due-event identity belongs to different canonical content');
   return {eventId,status:'duplicate-or-recovery-required',persistedState:existing.state};
  }
  const observed=await this.#time.due({scope,from:row.data.dueAt-1,to:row.data.dueAt,maxDue:64});
  if(!observed.candidates.some(item=>item.id===scheduleId&&item.sourceRevision===row.revision))
   fail('SCHEDULE_INDEX_UNCERTAIN','Due-event index did not verify the canonical commitment');
  if(row.data.kind==='npc-action'&&!this.#verifyDue)fail('SCHEDULE_SOURCE_UNVERIFIED','NPC due events require canonical agenda and knowledge verification');
  if(this.#verifyDue&&await this.#verifyDue({scope,commitment:row,worldTime})!==true)fail('SCHEDULE_SOURCE_UNVERIFIED','Due source prerequisites could not be verified');
  const current=await this.#time.read({scope,id:scheduleId});
  if(!current||current.revision!==row.revision)fail('SCHEDULE_SOURCE_STALE','Commitment changed during due-source verification');
  assertLocalGM(this.#gm());this.#writer.assertEligible(this.#gm());
  // Stable across different GMs: designated-authority changes must not
  // generate a second identity for the same authoritative schedule revision.
  const event=versionedEvent({id:eventId,eventType:'narrative.schedule-due',
   source:{kind:'gm-approved-intent',scheduleId},
   payload:{scheduleId,ownerId:row.data.ownerId,kind:row.data.kind,
    dueAt:row.data.dueAt,sourceRevision:row.revision,verified:true}});
  return {eventId:event.id,...await this.#router.ingest(event)};
 }
 async emit({requestId,eventType,payload={},causalParentIds=[],correlationId=requestId}={}){
  assertNarrativeId(requestId);if(!requestId.startsWith('ep:request:'))fail('MANUAL_EVENT_REQUEST','Stable GM request ID required');
  assertEventType(eventType);const safe=safePayload(payload),gm=this.#gm();assertLocalGM(gm);
  this.#writer.assertEligible(gm);
  const digest=await sha256Hex(`${this.#world}|${gm.userId}|${requestId}`);
  const event=versionedEvent({id:`ep:event:manual_${digest.slice(0,32)}`,eventType,
    source:{kind:'gm-approved-intent',gmUserId:gm.userId,requestId},payload:safe,causalParentIds,correlationId});
  const result=await this.#router.ingest(event);
  return {eventId:event.id,...result};
 }
}
