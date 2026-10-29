/** A canonical event can qualify many distinct plot milestones but never silently
 * executes a consequence. Bounded pre-indexed input, no all-campaign graph scan. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const KINDS=new Set(['observe','qualify','unlock','prerequisite','aggregate','react','exclusive','historical']);
export function routeCrossPlotEvent(event,subscriptions,{knownFactIds=[],approvedScopes=[],maxSubscribers=48}={}){
  if(typeof event?.id!=='string'||!event.id.startsWith('ep:')||typeof event.eventType!=='string')fail('CROSSPLOT_EVENT','Canonical event required');
  if(!Array.isArray(subscriptions)||subscriptions.length>maxSubscribers)fail('CROSSPLOT_BUDGET','Indexed fan-out exceeds budget');
  const facts=new Set(knownFactIds),scopes=new Set(approvedScopes),qualified=[],skipped=[];
  const seen=new Set();
  for(const link of subscriptions){
    if(!KINDS.has(link.kind)||typeof link.id!=='string'||typeof link.targetId!=='string')fail('CROSSPLOT_LINK','Invalid typed dependency');
    if(seen.has(link.id)){skipped.push({linkId:link.id,reason:'duplicate-link'});continue;}seen.add(link.id);
    if(link.eventType!==event.eventType){skipped.push({linkId:link.id,reason:'different-event'});continue;}
    if(link.activeRevision!==link.expectedRevision){skipped.push({linkId:link.id,reason:'stale-target-revision'});continue;}
    if(link.scope&&!scopes.has(link.scope)){skipped.push({linkId:link.id,reason:'scope-not-approved'});continue;}
    if((link.requiredKnownFactIds??[]).some(x=>!facts.has(x))){skipped.push({linkId:link.id,reason:'knowledge-prerequisite'});continue;}
    qualified.push({linkId:link.id,targetId:link.targetId,relation:link.kind,sourceEventId:event.id,
      status:'eligible-for-local-evaluation',committed:false});
  }
  return {sourceEventId:event.id,qualified,skipped,effectsExecuted:0,committed:false};
}
export function aggregateArcMilestones(objectives,{completedMilestoneIds=[],authorizedMilestoneIds=[],max=128}={}){
  if(!Array.isArray(objectives)||objectives.length>max)fail('CROSSPLOT_BUDGET','Bounded aggregation required');
  const completed=new Set(completedMilestoneIds),authorized=new Set(authorizedMilestoneIds);
  return objectives.filter(o=>authorized.has(o.id)).map(o=>({id:o.id,
    completed:completed.has(o.id),sourceMilestoneId:o.sourceMilestoneId??o.id}));
}
