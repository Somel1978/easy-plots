/** Evidence-linked shared investigation milestones. A submitted correct theory
 * is not proof, and a GM-only fact cannot be used as disclosed player evidence. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const validKinds=new Set(['discovery','corroboration','verified-conclusion','intervention','decision','disclosure','failure']);
const max=96;
export function evaluateSharedMilestones({milestones=[],contributions=[],completedMilestoneIds=[],
  authorizedEvidenceIds=[],worldFacts=[],maxMilestones=64,maxContributions=max}={}){
 if(!Array.isArray(milestones)||milestones.length>maxMilestones||!Array.isArray(contributions)||contributions.length>maxContributions||
 !Array.isArray(completedMilestoneIds)||!Array.isArray(authorizedEvidenceIds)||!Array.isArray(worldFacts)||worldFacts.length>max)
  fail('MILESTONE_BUDGET','Bounded scoped investigation required');
 const completed=new Set(completedMilestoneIds),allowed=new Set(authorizedEvidenceIds),facts=new Set(worldFacts);
 completedMilestoneIds.forEach(assertNarrativeId);authorizedEvidenceIds.forEach(assertNarrativeId);worldFacts.forEach(assertNarrativeId);
 const byEvent=new Set(),evidenceByObjective=new Map(),participantCredit=new Map();
 for(const c of contributions){
  for(const k of ['eventId','objectiveId','actorId','evidenceId'])assertNarrativeId(c[k]);
  if(byEvent.has(c.eventId))fail('MILESTONE_DUPLICATE','Duplicate contributing event');byEvent.add(c.eventId);
  if(c.authorized===true&&allowed.has(c.evidenceId)){
   const evidence=evidenceByObjective.get(c.objectiveId)??new Set();evidence.add(c.evidenceId);evidenceByObjective.set(c.objectiveId,evidence);
   const credited=participantCredit.get(c.objectiveId)??new Set();credited.add(c.actorId);participantCredit.set(c.objectiveId,credited);
  }
 }
 const seen=new Set(),proposals=[];
 for(const m of milestones){
  assertNarrativeId(m.id);assertNarrativeId(m.objectiveId);
  if(seen.has(m.id)||!validKinds.has(m.kind)||!Array.isArray(m.requiredEvidenceIds)||!Array.isArray(m.requiredFactIds))
   fail('MILESTONE_CONTRACT','Unique typed milestone and evidence prerequisites required');
  seen.add(m.id);m.requiredEvidenceIds.forEach(assertNarrativeId);m.requiredFactIds.forEach(assertNarrativeId);
  if(m.requiredEvidenceIds.length>32||m.requiredFactIds.length>32)fail('MILESTONE_BUDGET','Excessive milestone prerequisites');
  if(completed.has(m.id)){proposals.push({milestoneId:m.id,status:'already-completed',committed:false});continue;}
  const evidence=evidenceByObjective.get(m.objectiveId)??new Set();
  const qualified=m.requiredEvidenceIds.every(id=>evidence.has(id))&&m.requiredFactIds.every(id=>facts.has(id));
  // GM truth cannot create a verified conclusion by itself. The GM must supply
  // an independently authorized resolution event.
  const verified=m.kind!=='verified-conclusion'||Boolean(m.verificationEventId&&contributions.some(c=>
    c.eventId===m.verificationEventId&&c.authorized===true&&c.verificationAuthorized===true&&c.objectiveId===m.objectiveId));
  proposals.push({milestoneId:m.id,objectiveId:m.objectiveId,kind:m.kind,
   status:qualified&&verified?'eligible-for-gm-review':'prerequisites-not-established',
   qualifyingEvidenceIds:qualified?[...m.requiredEvidenceIds]:[],
   participatingActorIds:qualified?[...(participantCredit.get(m.objectiveId)??new Set())]:[],
   rewardAuthorized:false,committed:false});
 }
 return {proposals,completedCount:proposals.filter(x=>x.status==='already-completed').length,
   committed:false,automaticRewards:0,playerVisibleSecretCounts:false};
}
/** Create an intentionally reduced player-safe progress projection from a GM
 * approved publication list, not from the confidential evaluation output. */
export function projectAuthorizedMilestones({observerId,published=[],max=64}={}){
 assertNarrativeId(observerId);
 if(!Array.isArray(published)||published.length>max)fail('MILESTONE_BUDGET','Bounded milestone projection required');
 return published.filter(x=>x.allowedObserverIds?.includes(observerId)||x.allowedObserverIds?.includes('public'))
   .map(x=>({publicId:x.publicId,title:x.publicTitle,state:x.publicState}));
}
