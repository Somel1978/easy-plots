import {EasyPlotsError} from '../contracts/errors.mjs';
/** Never treat correctness of a guessed conclusion as a milestone without an authorized qualifying event. */
export function qualifyMilestone(milestone,event,completed=new Set()) {
  if(completed.has(milestone.id)&&milestone.repeatPolicy!=='repeatable')return {status:'already-completed',qualified:false};
  if(event?.eventType==='player.theory.submitted'&&!milestone.allowUnverifiedClaim) return {status:'not-qualified',qualified:false};
  if(!milestone.qualifyingEventTypes?.includes(event?.eventType))return {status:'not-qualified',qualified:false};
  if(milestone.requiredFactIds?.length) {
    const facts=new Set(event.payload?.verifiedFactIds??[]);
    if(milestone.requiredFactIds.some(id=>!facts.has(id)))return {status:'missing-evidence',qualified:false};
  }
  if(milestone.completionPolicy==='gm-review')return {status:'gm-review',qualified:true};
  if(milestone.completionPolicy==='published-rule')return {status:'eligible',qualified:true};
  throw new EasyPlotsError('INVALID_MILESTONE','Unsupported milestone completion policy');
}
