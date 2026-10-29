/** Scoped investigation milestones. A player's theory is not a qualifying
 * event; authored prerequisites must be satisfied by canonical, attributable
 * evidence contributions. Completion and player disclosure are distinct.
 * This service NEVER executes XP, Item awards or other native effects.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {evaluateSharedMilestones} from './investigation-milestones.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const KINDS=new Set(['discovery','corroboration','verified-conclusion','intervention','decision','disclosure','failure']);
const SCOPE=/^[a-z][a-z0-9-]{0,47}$/;
function validScope(scope){if(typeof scope!=='string'||!SCOPE.test(scope))fail('MILESTONE_SCOPE','Bounded scope required');}
function ids(a,max){if(!Array.isArray(a)||a.length>max)fail('MILESTONE_BUDGET','Bounded reference list required');a.forEach(assertNarrativeId);
 if(new Set(a).size!==a.length)fail('MILESTONE_DUPLICATE','Duplicate prerequisite or observer');return clone(a);}
export class PersistentInvestigationMilestones {
 #domains;
 constructor({domains}={}){if(typeof domains?.read!=='function'||typeof domains?.save!=='function')fail('MILESTONE_STORE','Protected domain store required');this.#domains=domains;}
 async createContract({scope='world',milestoneId,investigationId,objectiveId,kind,
  requiredEvidenceIds=[],verificationEventId=null,publicId,publicTitle,allowedObserverIds=[],sourceEventId}={}){
  validScope(scope);for(const id of [milestoneId,investigationId,objectiveId,publicId,sourceEventId])assertNarrativeId(id);
  if(!KINDS.has(kind)||typeof publicTitle!=='string'||publicTitle.length<1||publicTitle.length>120)
   fail('MILESTONE_CONTRACT','Typed milestone and bounded public label required');
  const required=ids(requiredEvidenceIds,32),allowed=ids(allowedObserverIds,32);
  if(verificationEventId!==null)assertNarrativeId(verificationEventId);
  if(kind==='verified-conclusion'&&!verificationEventId)fail('MILESTONE_VERIFICATION','Verified conclusion requires independently authored qualifying event');
  const inv=await this.#domains.read('investigation',scope,investigationId);
  if(!inv||!Array.isArray(inv.data.evidence))fail('INVESTIGATION_MISSING','Authoritative investigation evidence required');
  const evidenceSet=new Set(inv.data.evidence.map(e=>e.id));
  if(required.some(id=>!evidenceSet.has(id)))fail('MILESTONE_EVIDENCE','Milestone references unavailable evidence');
  const contract={milestoneId,investigationId,objectiveId,kind,requiredEvidenceIds:required,
   requiredFactIds:[],verificationEventId,publicId,publicTitle,allowedObserverIds:allowed,
   repeatPolicy:'once',sourceEventId};
  return this.#domains.save({type:'milestone-contract',scope,id:milestoneId,sourceEventId,data:contract});
 }
 async recordEvidence({scope='world',milestoneId,actorId,evidenceId,sourceEventId,
  verificationAuthorized=false,expectedRevision=null}={}){
  validScope(scope);for(const id of [milestoneId,actorId,evidenceId,sourceEventId])assertNarrativeId(id);
  const contract=await this.#domains.read('milestone-contract',scope,milestoneId);
  if(!contract)fail('MILESTONE_MISSING','Published milestone contract required');
  if(!contract.data.requiredEvidenceIds.includes(evidenceId))fail('MILESTONE_EVIDENCE','Unrelated evidence cannot qualify a milestone');
  const inv=await this.#domains.read('investigation',scope,contract.data.investigationId);
  const evidence=inv?.data?.evidence?.find(e=>e.id===evidenceId);
  if(!evidence||(evidence.disclosedTo?.includes(actorId)!==true&&evidence.disclosedTo?.includes('public')!==true))
   fail('MILESTONE_EVIDENCE','Evidence must be canonically known to the contributing actor');
  if(verificationAuthorized!==false&&verificationAuthorized!==true)fail('MILESTONE_VERIFICATION','Explicit verification flag required');
  const prior=await this.#domains.read('milestone-progress',scope,milestoneId);
  const contributions=prior?.data?.contributions??[];
  const existing=contributions.find(c=>c.eventId===sourceEventId);
  const candidate={eventId:sourceEventId,objectiveId:contract.data.objectiveId,actorId,evidenceId,
   authorized:true,verificationAuthorized};
  if(existing){if(JSON.stringify(existing)!==JSON.stringify(candidate))fail('MILESTONE_EVENT_CONFLICT','Causal identity reused with different evidence');
   return clone(prior);}
  if(prior?.revision!==undefined&&expectedRevision!==prior.revision||!prior&&expectedRevision!==null)
   fail('REVISION_CONFLICT','Milestone progress changed');
  if(contributions.length>=64)fail('MILESTONE_BUDGET','Contribution record requires new partition');
  return this.#domains.save({type:'milestone-progress',scope,id:milestoneId,expectedRevision,
   sourceEventId,data:{milestoneId,contributions:[...clone(contributions),candidate]}});
 }
 async readCompletion({scope='world',milestoneId}={}){validScope(scope);assertNarrativeId(milestoneId);return this.#domains.read('milestone-completion',scope,milestoneId);}
 async assess({scope='world',milestoneId}={}){
  validScope(scope);assertNarrativeId(milestoneId);
  const contract=await this.#domains.read('milestone-contract',scope,milestoneId);
  if(!contract)fail('MILESTONE_MISSING','Milestone contract not found');
  const progress=await this.#domains.read('milestone-progress',scope,milestoneId);
  const completion=await this.#domains.read('milestone-completion',scope,milestoneId);
  const inv=await this.#domains.read('investigation',scope,contract.data.investigationId);
  if(!inv?.data?.evidence)fail('INVESTIGATION_MISSING','Canonical evidence record unavailable');
  const allowed=inv.data.evidence.map(e=>e.id);
  const assessment=evaluateSharedMilestones({milestones:[{...contract.data,id:contract.data.milestoneId}],
   contributions:progress?.data?.contributions??[],
   authorizedEvidenceIds:allowed,
   completedMilestoneIds:completion?[milestoneId]:[]});
  return clone({milestoneId,contractRevision:contract.revision,progressRevision:progress?.revision??null,
   status:assessment.proposals[0].status,participantIds:assessment.proposals[0].participatingActorIds??[],
   completed:completion!==null,completionRevision:completion?.revision??null,
   noAutomaticReward:true,privateAssessment:true});
 }
 async complete({scope='world',milestoneId,reviewEventId,expectedContractRevision,
  expectedProgressRevision,operationId=null}={}){
  validScope(scope);for(const id of [milestoneId,reviewEventId])assertNarrativeId(id);
  if(operationId!==null)assertNarrativeId(operationId);
  const assessment=await this.assess({scope,milestoneId});
  if(assessment.completed)fail('MILESTONE_COMPLETED','One-time milestone already completed');
  if(assessment.contractRevision!==expectedContractRevision||assessment.progressRevision!==expectedProgressRevision)
   fail('REVISION_CONFLICT','Milestone changed during GM approval');
  if(assessment.status!=='eligible-for-gm-review')fail('MILESTONE_NOT_ELIGIBLE','Qualifying canonical prerequisites not established');
  const record=await this.#domains.save({type:'milestone-completion',scope,id:milestoneId,sourceEventId:reviewEventId,
   data:{milestoneId,approvalEventId:reviewEventId,contractRevision:expectedContractRevision,
    progressRevision:expectedProgressRevision,participantIds:assessment.participantIds,
    effectsExecuted:0,rewardsAuthorized:false,state:'completed',operationId}});
  return clone({milestoneId,revision:record.revision,state:'completed',effectsExecuted:0});
 }
 async project({scope='world',milestoneIds=[],observerId,max=32}={}){
  validScope(scope);assertNarrativeId(observerId);ids(milestoneIds,max);
  if(!Number.isSafeInteger(max)||max<1||max>64)fail('MILESTONE_BUDGET','Invalid bounded projection');
  const rows=[];
  for(const id of milestoneIds){const contract=await this.#domains.read('milestone-contract',scope,id);
   if(!contract||(!contract.data.allowedObserverIds.includes(observerId)&&!contract.data.allowedObserverIds.includes('public')))continue;
   const completion=await this.#domains.read('milestone-completion',scope,id);
   rows.push({id:contract.data.publicId,title:contract.data.publicTitle,state:completion?'completed':'not-completed'});
  }
  return {milestones:rows};
 }
}
