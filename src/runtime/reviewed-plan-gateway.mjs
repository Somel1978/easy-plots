/** Reviewed preparation becomes a GM intent, never a fabricated native event. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {versionedEvent} from '../contracts/canonical-event.mjs';
import {resolveRollInput} from './roll-input.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export class ReviewedPlanEventGateway {
 #plans;#router;#ledger;#readState;#readRoll;#gm;#writer;#world;
 constructor({plans,router,ledger,readState,readRoll=null,gmProvider,writer,worldId}={}){
  if(typeof plans?.read!=='function'||typeof plans?.stageSubmission!=='function'||typeof router?.ingest!=='function'||typeof ledger?.get!=='function'||typeof readState!=='function'||typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function'||typeof worldId!=='string'||!worldId)fail('PLAN_GATEWAY','Protected reviewed plan, event and source verification services required');
  this.#plans=plans;this.#router=router;this.#ledger=ledger;this.#readState=readState;this.#gm=gmProvider;this.#writer=writer;this.#world=worldId;
  this.#readRoll=readRoll;
 }
 #authority(){const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);}
 async #event(scope,row){
  const revision=row.data.submission?.reviewRevision??row.revision,hash=await sha256Hex(JSON.stringify({worldId:this.#world,scope,id:row.id,revision}));
  // The scenario remains an authored desired input. Its hypothetical event
  // origin, ID and diagnostic fault injections cannot become native evidence.
  const input=row.data.mode==='published-graph'?{graphId:row.data.scenario.graphId,publishedVersion:row.data.scenario.publishedVersion,
    plannedEventType:row.data.scenario.event?.eventType,payload:clone(row.data.scenario.event?.payload??{}),hypotheses:clone(row.data.scenario.hypotheses??[])}:clone(row.data.scenario);
  const suggestion=row.data.mode==='published-graph'?{plannedEffects:row.data.preview.proposals.map(({nodeId,providerId,payload})=>({nodeId,providerId,payload:clone(payload)}))}:clone(row.data.preview);
  const event=versionedEvent({id:`ep:event:reviewed_plan_${hash.slice(0,32)}`,eventType:'narrative.reviewed-plan',source:{kind:'gm-approved-intent',capability:'verified-reviewed-plan-v1',planId:row.id,requestId:`ep:request:reviewed_plan_${hash.slice(0,32)}`},
   correlationId:`reviewed-plan:${hash.slice(0,32)}`,payload:{planId:row.id,planScope:scope,planRevision:revision,mode:row.data.mode,input,suggestion,verified:true}});
  if(new TextEncoder().encode(JSON.stringify(event)).length>10000)fail('PLAN_SUBMISSION_BUDGET','Reviewed intent exceeds its bounded event size');return event;
 }
 async #sources(row){
  const observations=row.data.mode==='published-graph'?row.data.preview?.sourceObservations:[];
  if(!Array.isArray(observations)||observations.length>176)fail('PLAN_SOURCE_CONTRACT','Bounded recorded source revisions required');
  for(const source of observations){
   if(source?.kind==='native-roll'){
    let resolved;try{resolved=await resolveRollInput(this.#readRoll,{rollKind:source.rollKind,attemptId:source.attemptId,expectedRevision:source.revision,field:source.field,side:source.side});}catch{fail('PLAN_SOURCE_STALE','Recorded mechanical input is no longer authoritative');}
    for(const [key,value] of Object.entries(resolved.observation))if(JSON.stringify(source[key])!==JSON.stringify(value))fail('PLAN_SOURCE_STALE','Recorded mechanical input changed after plan review');continue;
   }
   if(!source||typeof source.scope!=='string'||typeof source.key!=='string'||source.revision!==null&&(!Number.isSafeInteger(source.revision)||source.revision<1))fail('PLAN_SOURCE_CONTRACT','Invalid observed source revision');
   const current=await this.#readState({scope:source.scope,key:source.key});
   if((current?.revision??null)!==source.revision||current&&(current.kind!=='narrative-state'||current.scope!==source.scope||current.stateKey!==source.key))fail('PLAN_SOURCE_STALE','Canonical input changed since the saved plan was reviewed');
  }
 }
 async preview({scope='world',id,expectedRevision}={}){
  this.#authority();assertNarrativeId(id);const row=await this.#plans.read(scope,id);
  if(!row||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Saved plan changed before submission review');
  if(!['acknowledged-for-manual-followup','submitted-for-gm-effects'].includes(row.data.state))fail('PLAN_REVIEW_REQUIRED','Saved plan must first be acknowledged by the GM');
  const event=await this.#event(scope,row);
  if(row.data.state==='submitted-for-gm-effects'&&(row.data.submission?.eventId!==event.id||row.data.submission?.reviewRevision!==row.revision-1))fail('PLAN_SUBMISSION_CORRUPT','Staged plan submission does not match its reviewed identity');
  const existing=await this.#ledger.get(event.id);
  if(existing&&JSON.stringify(existing.event)!==JSON.stringify(event))fail('EVENT_REUSE_CONFLICT','Reviewed plan event identity belongs to different content');
  if(!existing)await this.#sources(row);
  const cascade=typeof this.#router.previewCascade==='function'?await this.#router.previewCascade(event):null;
  this.#authority();return {event,...(cascade?{cascade}:{}),planRevision:row.revision,submitted:row.data.state==='submitted-for-gm-effects',effectsExecuted:0};
 }
 async submit(spec={}, {approved=false}={}){
  if(approved!==true)fail('PLAN_SUBMISSION_APPROVAL','Explicit GM review of the live intent is required');
  const selected={scope:spec.scope??'world',id:spec.id,expectedRevision:spec.expectedRevision},preview=await this.preview(selected),existing=await this.#ledger.get(preview.event.id);
  if(existing)return {eventId:preview.event.id,status:'duplicate-or-recovery-required',persistedState:existing.state,planRevision:preview.planRevision};
  let revision=preview.planRevision;
  if(!preview.submitted){const staged=await this.#plans.stageSubmission({...selected,eventId:preview.event.id});revision=staged.revision;}
  // Staging may yield to other GM work. Re-read the exact staged revision and
  // its source observations immediately before first canonical admission.
  await this.preview({...selected,expectedRevision:revision});
  this.#authority();const result=await this.#router.ingest(preview.event);return {eventId:preview.event.id,...result,planRevision:revision};
 }
}
