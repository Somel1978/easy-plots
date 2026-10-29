/** Convert a durable, GM-reviewed faction agenda decision into one pending
 * indexed world-time commitment. This NEVER executes the faction's action.
 * A canonical schedule written before an interrupted index update can be
 * repaired without inserting a duplicate commitment.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
export class ReviewedFactionActionScheduler {
 #domains;#time;
 constructor({domains,timeCoordinator}={}){
  if(typeof domains?.read!=='function'||typeof timeCoordinator?.schedule!=='function'||
    typeof timeCoordinator?.read!=='function'||typeof timeCoordinator?.repairIndex!=='function')
   fail('FACTION_SCHEDULE_DEPENDENCY','Protected decision store and due-time coordinator required');
  this.#domains=domains;this.#time=timeCoordinator;
 }
 async prepare({scope='world',decisionId,commitmentId,dueAt,sourceEventId,gmApproved=false}={}){
  for(const id of [decisionId,commitmentId,sourceEventId])assertNarrativeId(id);
  if(gmApproved!==true)fail('FACTION_SCHEDULE_APPROVAL','Explicit GM authorization required');
  if(typeof scope!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(scope)||
     !Number.isSafeInteger(dueAt)||dueAt<0||dueAt>1e9)
   fail('FACTION_SCHEDULE_TIME','Bounded scope and due-time required');
  const decision=await this.#domains.read('faction-agenda-decision',scope,decisionId);
  if(!decision||decision.data.status!=='gm-reviewed-action-proposal'||decision.data.effectsExecuted!==0)
   fail('FACTION_SCHEDULE_DECISION','Durably approved agenda decision required');
  if(dueAt<decision.data.worldTime)fail('FACTION_SCHEDULE_TIME','Cannot backdate schedule before reviewed faction decision');
  const agenda=await this.#domains.read('faction-agenda',scope,decision.data.agendaId);
  if(!agenda||agenda.revision!==decision.data.agendaRevision||agenda.data.state!=='published')
   fail('FACTION_SCHEDULE_STALE','Source faction agenda revision changed');
  const previous=await this.#time.read({scope,id:commitmentId});
  if(previous){
   if(previous.sourceEventId!==sourceEventId||previous.data.ownerId!==agenda.data.factionId||
     previous.data.kind!=='faction-action'||previous.data.dueAt!==dueAt||
     previous.data.prerequisiteIds?.length!==1||previous.data.prerequisiteIds[0]!==decisionId)
    fail('FACTION_SCHEDULE_CONFLICT','Existing commitment has different provenance');
   // Reconcile interrupted index staging instead of re-executing an action.
   if(previous.data.status==='pending'||previous.data.status==='due')await this.#time.repairIndex({scope,id:commitmentId});
   return {commitmentId,revision:previous.revision,alreadyPrepared:true,effectsExecuted:0};
  }
  const saved=await this.#time.schedule({scope,id:commitmentId,sourceEventId,
   ownerId:agenda.data.factionId,kind:'faction-action',dueAt,
   originRevision:decision.data.agendaRevision,prerequisiteIds:[decisionId]});
  return {commitmentId,revision:saved.commitment.revision,alreadyPrepared:false,effectsExecuted:0};
 }
 async verify({scope='world',commitmentId,decisionId,dueAt,sourceEventId}={}){
  for(const id of [commitmentId,decisionId,sourceEventId])assertNarrativeId(id);
  const row=await this.#time.read({scope,id:commitmentId});
  return Boolean(row&&row.sourceEventId===sourceEventId&&row.data.kind==='faction-action'&&
   row.data.dueAt===dueAt&&row.data.prerequisiteIds?.length===1&&row.data.prerequisiteIds[0]===decisionId&&
   ['pending','due','resolved','cancelled'].includes(row.data.status));
 }
}
