/** Indexed, bounded temporal catch-up. Classifies due work; does not simulate
 * off-screen events, assume a running GM, or commit world mutations. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export function classifyDueSchedule({from,to,dueIndex=[],knownCompletedIds=[],maxDue=64,maxCandidates=256}={}){
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<from)fail('SCHEDULER_TIME','Valid world time interval required');
  if(!Array.isArray(dueIndex)||dueIndex.length>maxCandidates)fail('SCHEDULER_BUDGET','Index selection exceeded bounded scan budget');
  const completed=new Set(knownCompletedIds),eligible=[],pending=[],skipped=[];
  for(const item of dueIndex){
    if(typeof item?.id!=='string'||!Number.isFinite(item.dueAt))fail('SCHEDULER_ENTRY','Typed due index entry required');
    if(item.dueAt<=from||item.dueAt>to||completed.has(item.id)){skipped.push(item.id);continue;}
    if(eligible.length+pending.length>=maxDue)fail('SCHEDULER_BUDGET','Too many due entries');
    const base={id:item.id,dueAt:item.dueAt,sourceRevision:item.sourceRevision??null};
    if(item.kind==='explicit-expiry'&&item.deterministic===true)eligible.push({...base,status:'rule-eligible-not-committed'});
    else pending.push({...base,status:'gm-review-outcome-unknown'});
  }
  eligible.sort((a,b)=>a.dueAt-b.dueAt||a.id.localeCompare(b.id));
  pending.sort((a,b)=>a.dueAt-b.dueAt||a.id.localeCompare(b.id));
  return {from,to,eligible,pending,skipped,committed:false,backgroundExecution:false};
}
export function scheduleNextTick({activeGM,worldTime,indexedNextDueAt}={}){
  if(activeGM!==true)return {status:'paused-no-authoritative-gm',wakeAt:null};
  if(!Number.isFinite(worldTime)||!Number.isFinite(indexedNextDueAt))return {status:'no-indexed-due',wakeAt:null};
  return {status:indexedNextDueAt<=worldTime?'due-for-gm-evaluation':'await-world-time',wakeAt:indexedNextDueAt};
}
