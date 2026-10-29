/** Durable GM-private planning artefacts. A stored preview is NOT a narrative
 * effect. Decisions and consequences still follow the authorized effect journal.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {evaluatePlanningFixture} from '../ui/planning-lab.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const ALLOWED=new Set(['what-if','time-jump','arc-ending','blueprint','knowledge','faction','closure','resources','vote','milestones','correction','npc-turn','viability','continuity','health','published-graph']);
export class PersistentGMPlans {
 #domains;#simulate;
 constructor({domainStore,simulatePublished=null}={}){
  if(typeof domainStore?.read!=='function'||typeof domainStore?.save!=='function')fail('PLAN_STORE','A GM-scoped domain store required');
  if(simulatePublished!==null&&typeof simulatePublished!=='function')fail('PLAN_STORE','Published graph simulator must be a callable read-only adapter');
  this.#domains=domainStore;this.#simulate=simulatePublished;
 }
 async read(scope,id){assertNarrativeId(id);return this.#domains.read('review-plan',scope,id);}
 async create({id,scope='world',mode,scenario,sourceEventId,expectedRevision=null}={}){
  assertNarrativeId(id);assertNarrativeId(sourceEventId);
  if(!ALLOWED.has(mode))fail('PLAN_MODE','Unknown typed plan type');
  const input=clone(scenario);
  const old=await this.read(scope,id);
  if(old&&old.revision!==expectedRevision)fail('REVISION_CONFLICT','Planning record changed before editing');
  if(old&&old.data.state!=='draft-preview')fail('PLAN_FINAL','Reviewed plans require a new planning identity for edits');
  if(mode==='published-graph'&&!this.#simulate)fail('PLAN_SIMULATION_UNAVAILABLE','Verified published graph simulator required');
  const plan=mode==='published-graph'?await this.#simulate(clone(input)):evaluatePlanningFixture(mode,input);
  // Never store a live Actor, raw socket, provider function, or a world mutation.
  const data={mode,scenario:input,preview:clone(plan),state:'draft-preview',
    sourceEventId,permission:'gm-only',effectsExecuted:0};
  return this.#domains.save({type:'review-plan',scope,id,data,sourceEventId,expectedRevision});
 }
 async acknowledge({scope='world',id,expectedRevision,approvalEventId}={}){
  assertNarrativeId(id);assertNarrativeId(approvalEventId);
  const current=await this.read(scope,id);
  if(!current)fail('PLAN_MISSING','Planning record not found');
  if(current.revision!==expectedRevision)fail('REVISION_CONFLICT','Plan changed before approval');
  if(current.data.state!=='draft-preview')fail('PLAN_STATE','Only unreviewed plans may be acknowledged');
  return this.#domains.save({type:'review-plan',scope,id,expectedRevision,sourceEventId:approvalEventId,
    data:{...current.data,state:'acknowledged-for-manual-followup',approvalEventId}});
 }
 async stageSubmission({scope='world',id,expectedRevision,eventId}={}){
  assertNarrativeId(eventId);const current=await this.read(scope,id);
  if(!current||current.revision!==expectedRevision)fail('REVISION_CONFLICT','Reviewed plan changed before submission');
  if(current.data.state!=='acknowledged-for-manual-followup')fail('PLAN_REVIEW_REQUIRED','The saved plan must be reviewed before live submission');
  return this.#domains.save({type:'review-plan',scope,id,expectedRevision,sourceEventId:eventId,data:{...current.data,state:'submitted-for-gm-effects',submission:{eventId,reviewRevision:expectedRevision}}});
 }
}
