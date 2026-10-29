/** Faction rules are pure proposals. No score, rank, agenda or relationship may
 * change without an independent authorized narrative event. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
function assertString(x){return typeof x==='string'&&x.length>0&&x.length<=120;}
export function evaluateFactionAgenda(agenda,context,{maxRules=32}={}){
  if(!assertString(agenda?.id)||!Array.isArray(agenda.rules)||agenda.rules.length>maxRules)fail('INVALID_AGENDA','Bounded faction agenda required');
  const availableFacts=new Set(context?.canonicalFactIds??[]);
  const factionKnowledge=new Set(context?.factionKnownFactIds??[]);
  const worldTime=context?.worldTime;
  const proposals=[];
  for(const rule of agenda.rules){
    if(!assertString(rule.id)||!assertString(rule.actionId))fail('INVALID_AGENDA','Rule and action IDs required');
    if(rule.enabled===false)continue;
    if(rule.notBefore!==undefined&&(!Number.isFinite(worldTime)||worldTime<rule.notBefore))continue;
    if(rule.expiresAt!==undefined&&(!Number.isFinite(worldTime)||worldTime>=rule.expiresAt))continue;
    if((rule.requiredCanonicalFactIds??[]).some(id=>!availableFacts.has(id)))continue;
    // An agenda may not react to a confidential canonical truth that its faction does not know.
    if((rule.requiredFactionKnowledgeIds??[]).some(id=>!factionKnowledge.has(id)))continue;
    if(rule.requiresKnowledgeOfCanonicalFact===true&&
      (rule.requiredCanonicalFactIds??[]).some(id=>!factionKnowledge.has(id)))continue;
    proposals.push({agendaId:agenda.id,ruleId:rule.id,actionId:rule.actionId,
      approval:rule.approvalPolicy==='published-rule'?'published-rule':'gm-review',status:'eligible-not-executed'});
  }
  return {factionId:agenda.factionId,proposals,committed:false};
}
export function proposeStandingChange({factionId,actorId,delta,sourceEventId,relationship='reputation'}={}){
  if(!assertString(factionId)||!assertString(actorId)||!assertString(sourceEventId)||!Number.isFinite(delta)||Math.abs(delta)>100)
    fail('INVALID_STANDING','Standing change must have bounded value and causal attribution');
  if(!['reputation','rank','membership','renown'].includes(relationship))fail('INVALID_STANDING','Unsupported faction dimension');
  if(relationship==='membership'||relationship==='rank')fail('FACTION_REVIEW_REQUIRED','Membership and rank require explicit transition contracts');
  return {factionId,actorId,delta,relationship,sourceEventId,status:'gm-approval-required',committed:false};
}
export function qualifyFactionPrivilege(privilege,{rank,renown=0,membership='none',knownFactIds=[]}={}){
  const facts=new Set(knownFactIds);
  return {eligible:(privilege.memberships??[]).includes(membership)&&
    (privilege.minRank===undefined||rank>=privilege.minRank)&&
    (privilege.minRenown===undefined||renown>=privilege.minRenown)&&
    (privilege.requiredKnownFacts??[]).every(id=>facts.has(id)),
    committed:false};
}
