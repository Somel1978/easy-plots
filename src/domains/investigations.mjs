/** Evidence reasoning, player hypotheses and GM truth are separate inputs.
 * A player-facing analysis is constructed exclusively from authorized evidence. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export function analyzePlayerTheory(theory,evidence,{authorizedEvidenceIds=[],maxEvidence=80}={}){
  if(typeof theory?.id!=='string'||typeof theory.observerId!=='string'||!Array.isArray(evidence)||evidence.length>maxEvidence)
    fail('INVESTIGATION_BUDGET','Valid theory and bounded evidence required');
  const allowed=new Set(authorizedEvidenceIds);let supports=0,contradicts=0;
  const cited=[];
  for(const item of evidence){
    if(!allowed.has(item.id)||!item.disclosedTo?.includes(theory.observerId))continue;
    if(item.theoryId!==theory.id)continue;
    const direction=item.direction;
    if(direction==='support')supports++;
    else if(direction==='contradict')contradicts++;
    else continue;
    cited.push({publicEvidenceId:item.publicEvidenceId??item.id,direction});
  }
  return {theoryId:theory.id,supportCount:supports,contradictionCount:contradicts,evidence:cited,
    label:supports&&contradicts?'contested':supports?'supported-argument':contradicts?'challenged':'no-authorized-evidence',
    // Never return truth status, hidden clue counts or canonical investigator assessments.
    truthStatus:undefined};
}
export function evaluateInvestigationViability(objectives,opportunities,{knownIds=[],max=64}={}){
  if(!Array.isArray(objectives)||!Array.isArray(opportunities)||objectives.length>max||opportunities.length>max)
    fail('INVESTIGATION_BUDGET','Bounded scoped investigation required');
  const known=new Set(knownIds);
  return objectives.map(objective=>{
    const routes=opportunities.filter(o=>o.objectiveId===objective.id);
    const active=routes.filter(o=>o.status!=='closed'&&(o.requiredKnownIds??[]).every(id=>known.has(id)));
    return {objectiveId:objective.id,routeCount:routes.length,currentlyEligible:active.length,
      status:active.length?'possible':routes.length?'blocked-or-conditional':'no-authored-route',
      // This GM-facing analysis does not force a solvable mystery or auto-complete it.
      completed:false};
  });
}
export function registerInvestigationAttempt(attempt,history,{max=32}={}){
  if(typeof attempt?.opportunityId!=='string'||typeof attempt?.actorId!=='string'||typeof attempt?.eventId!=='string'||!Array.isArray(history)||history.length>max)
    fail('INVALID_ATTEMPT','Attributed attempt and bounded history required');
  if(history.some(h=>h.eventId===attempt.eventId))return {status:'duplicate-delivery',record:null};
  const same=history.filter(h=>h.opportunityId===attempt.opportunityId&&h.actorId===attempt.actorId&&h.state==='resolved');
  const materiallyNew=Boolean(attempt.changedEvidenceId||attempt.newApproachId||attempt.gmOverrideEventId);
  if(same.length&&!materiallyNew)return {status:'repeat-needs-policy',record:null};
  return {status:'eligible-for-authorized-resolution',record:{eventId:attempt.eventId,actorId:attempt.actorId,
    opportunityId:attempt.opportunityId,approachId:attempt.newApproachId??null,state:'pending-review'},committed:false};
}
