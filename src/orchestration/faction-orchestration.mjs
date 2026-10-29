/** Multi-faction GM planning from explicit agenda and observer snapshots.
 * Never simulates unknown off-screen events or commits faction actions. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {evaluateFactionAgenda} from '../domains/factions.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const statuses=new Set(['active','suspended','completed','failed']);
export function planFactionTurn({worldTime,agendas=[],factionContexts=[],dueIndex=[],
 maxAgendas=32,maxDue=64,maxActions=64}={}){
 if(!Number.isFinite(worldTime)||worldTime<0||!Array.isArray(agendas)||agendas.length>maxAgendas||
 !Array.isArray(factionContexts)||factionContexts.length>maxAgendas||!Array.isArray(dueIndex)||dueIndex.length>maxDue)
   fail('FACTION_BUDGET','Bounded world-time faction scope required');
 const contextById=new Map();const agendaIds=new Set();const dueIds=new Set();
 for(const context of factionContexts){assertNarrativeId(context.factionId);if(contextById.has(context.factionId))fail('FACTION_DUPLICATE','One context per faction required');contextById.set(context.factionId,context);}
 for(const due of dueIndex){assertNarrativeId(due.id);assertNarrativeId(due.factionId);if(dueIds.has(due.id)||!Number.isFinite(due.dueAt))fail('FACTION_DUE','Typed unique due index required');dueIds.add(due.id);}
 const actions=[],unknown=[],skipped=[];
 for(const agenda of agendas){
  assertNarrativeId(agenda.id);assertNarrativeId(agenda.factionId);
  if(agendaIds.has(agenda.id))fail('FACTION_DUPLICATE','Duplicate agenda');agendaIds.add(agenda.id);
  if(!statuses.has(agenda.status))fail('FACTION_STATUS','Explicit agenda state required');
  if(agenda.status!=='active'){skipped.push({agendaId:agenda.id,reason:'inactive'});continue;}
  const ctx=contextById.get(agenda.factionId);
  if(!ctx){unknown.push({agendaId:agenda.id,reason:'missing-scoped-faction-context'});continue;}
  const due=dueIndex.filter(d=>d.factionId===agenda.factionId&&d.dueAt<=worldTime&&d.agendaId===agenda.id);
  if(!due.length){skipped.push({agendaId:agenda.id,reason:'no-indexed-due-action'});continue;}
  const result=evaluateFactionAgenda(agenda,{...ctx,worldTime});
  const rules=new Map(result.proposals.map(p=>[p.ruleId,p]));
  for(const item of due){
   const proposal=rules.get(item.ruleId);
   if(!proposal){skipped.push({agendaId:agenda.id,dueId:item.id,reason:'condition-not-met-or-unknown'});continue;}
   if(actions.length>=maxActions)fail('FACTION_BUDGET','Too many actions proposed');
   actions.push({dueId:item.id,agendaId:agenda.id,factionId:agenda.factionId,ruleId:proposal.ruleId,
    actionId:proposal.actionId,worldTime:item.dueAt,approval:proposal.approval,
    sourceRevision:item.revision??null,status:'eligible-not-executed',committed:false});
  }
 }
 actions.sort((a,b)=>a.worldTime-b.worldTime||a.dueId.localeCompare(b.dueId));
 return {worldTime,proposals:clone(actions),unknown:clone(unknown),skipped:clone(skipped),
   requiresGMReview:true,committed:false,offscreenEventsInvented:0};
}
/** Classify a faction pressure clock transition; only an event-associated proposal. */
export function proposePressureClockAdvance({clock,sourceEventId,delta=1,expectedRevision}={}){
 assertNarrativeId(sourceEventId);assertNarrativeId(clock?.id);
 if(clock.revision!==expectedRevision)fail('REVISION_CONFLICT','Pressure clock revision is stale');
 if(clock.status!=='active'||!Number.isSafeInteger(clock.ticks)||!Number.isSafeInteger(clock.maxTicks)||
 clock.maxTicks<1||clock.maxTicks>100||clock.ticks<0||clock.ticks>clock.maxTicks||
 !Number.isSafeInteger(delta)||delta<1||delta>20)fail('CLOCK_CONTRACT','Valid bounded active clock and delta required');
 const after=Math.min(clock.maxTicks,clock.ticks+delta);
 return {clockId:clock.id,sourceEventId,expectedRevision,from:clock.ticks,to:after,
  overflow:Math.max(0,clock.ticks+delta-clock.maxTicks),thresholdReached:after===clock.maxTicks,
  status:'gm-review',committed:false};
}
