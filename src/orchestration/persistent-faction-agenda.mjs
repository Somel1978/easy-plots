/** GM-only faction agenda decisions, grounded in immutable published rules,
 * persistent faction knowledge receipts, and authoritative world-fact records.
 * A due/eligible agenda is a proposal, never proof the off-screen operation
 * succeeded. All reads are bounded by explicit claim/fact IDs in one scope.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {receiptKnowledgeTime} from '../domains/knowledge.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {evaluateFactionAgenda} from '../domains/factions.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const SCOPE=/^[a-z][a-z0-9-]{0,47}$/;
const RID=/^[a-z][a-z0-9_-]{1,63}$/;
const limits=(a,max=32)=>{if(!Array.isArray(a)||a.length>max)fail('AGENDA_BUDGET','Explicit bounded array required');
 a.forEach(assertNarrativeId);if(new Set(a).size!==a.length)fail('AGENDA_DUPLICATE','Duplicate canonical reference');return a;};
const validateScope=s=>{if(!SCOPE.test(s??''))fail('AGENDA_SCOPE','Explicit bounded scope required');};
const decisionId=async(agendaId,ruleId,sourceEventId)=>`ep:agenda-decision:${(await sha256Hex([agendaId,ruleId,sourceEventId].join('|'))).slice(0,28)}`;
export class PersistentFactionAgenda {
 #domains;
 constructor({domains}={}){if(typeof domains?.read!=='function'||typeof domains?.save!=='function')fail('AGENDA_STORE','Protected domain store required');this.#domains=domains;}
 async read({scope='world',agendaId}={}){validateScope(scope);assertNarrativeId(agendaId);return this.#domains.read('faction-agenda',scope,agendaId);}
 async publish({scope='world',agendaId,factionId,sourceEventId,rules=[]}={}){
  validateScope(scope);for(const id of [agendaId,factionId,sourceEventId])assertNarrativeId(id);
  if(!Array.isArray(rules)||rules.length<1||rules.length>24)fail('AGENDA_RULES','Bounded nonempty authored agenda required');
  const ids=new Set(),clean=[];
  for(const rule of rules){
   if(!rule||typeof rule!=='object'||Array.isArray(rule)||!RID.test(rule.id??'')||!RID.test(rule.actionId??'')||ids.has(rule.id))fail('AGENDA_RULES','Unique bounded rule and action IDs required');
   ids.add(rule.id);
   if(Object.keys(rule).some(k=>!['id','actionId','enabled','notBefore','expiresAt','requiredCanonicalFactIds','requiredFactionKnowledgeIds','approvalPolicy'].includes(k)))
    fail('AGENDA_RULES','Unknown or executable field in authored rule');
   const facts=limits(rule.requiredCanonicalFactIds??[]),known=limits(rule.requiredFactionKnowledgeIds??[]);
   if(!Number.isFinite(rule.notBefore??0)||rule.notBefore<0||!Number.isFinite(rule.expiresAt??1e12)||rule.expiresAt<= (rule.notBefore??0))fail('AGENDA_TIME','Invalid authored agenda window');
   if(rule.approvalPolicy!==undefined&&!['gm-review','published-rule'].includes(rule.approvalPolicy))fail('AGENDA_POLICY','Unsupported policy');
   if(rule.enabled!==undefined&&typeof rule.enabled!=='boolean')fail('AGENDA_RULES','Invalid rule activation flag');
   clean.push({...clone(rule),requiredCanonicalFactIds:[...facts],requiredFactionKnowledgeIds:[...known]});
  }
  if(new TextEncoder().encode(JSON.stringify(clean)).length>12_000)fail('AGENDA_BUDGET','Agenda contract exceeds budget');
  if(await this.read({scope,agendaId}))fail('AGENDA_IMMUTABLE','Published agenda cannot be modified; publish a new identity');
  return this.#domains.save({type:'faction-agenda',scope,id:agendaId,sourceEventId,
    data:{agendaId,factionId,sourceEventId,rules:clean,state:'published'}});
 }
 async assess({scope='world',agendaId,knowledgeReceiptIds=[],worldTime=0,ruleIds=null}={}){
  validateScope(scope);limits(knowledgeReceiptIds,48);
  if(!Number.isFinite(worldTime)||worldTime<0||worldTime>1e12)fail('AGENDA_TIME','Valid world time required');
  const agenda=await this.read({scope,agendaId});if(!agenda||agenda.data.state!=='published')fail('AGENDA_UNAVAILABLE','Published agenda required');
  if(ruleIds!==null&&(!Array.isArray(ruleIds)||ruleIds.length<1||ruleIds.length>24||new Set(ruleIds).size!==ruleIds.length||ruleIds.some(id=>!RID.test(id??'')||!agenda.data.rules.some(r=>r.id===id))))fail('AGENDA_RULES','A bounded selected set of published rules is required');
  const rules=ruleIds===null?agenda.data.rules:agenda.data.rules.filter(r=>ruleIds.includes(r.id));
  const factIds=new Set(rules.flatMap(r=>r.requiredCanonicalFactIds??[]));
  if(factIds.size>128)fail('AGENDA_BUDGET','Too many canonical fact requirements');
  const trueFacts=[];
  for(const factId of factIds){const row=await this.#domains.read('world-fact',scope,factId);
   if(row?.data?.status==='asserted')trueFacts.push(factId);
  }
  const known=[];
  for(const receiptId of knowledgeReceiptIds){const row=await this.#domains.read('knowledge-receipt',scope,receiptId);
   if(!row||row.data.observerId!==agenda.data.factionId||row.data.state!=='published'||receiptKnowledgeTime(row.data)>worldTime)
    fail('AGENDA_KNOWLEDGE','Only authorized, due faction knowledge receipts can be evaluated');
   known.push(row.data.claimId);
  }
  const proposal=evaluateFactionAgenda({id:agendaId,factionId:agenda.data.factionId,rules},
    {worldTime,canonicalFactIds:trueFacts,factionKnownFactIds:known}, {maxRules:24});
  return clone({agendaId,factionId:agenda.data.factionId,agendaRevision:agenda.revision,worldTime,
    proposals:proposal.proposals,committed:false,knowledgeReceiptsConsulted:knowledgeReceiptIds.length,hiddenToPlayers:true});
 }
 async verifyDecision({scope='world',agendaId,ruleId,sourceEventId}={}){
  validateScope(scope);assertNarrativeId(agendaId);assertNarrativeId(sourceEventId);
  if(!RID.test(ruleId??''))fail('AGENDA_RULES','Named rule required');
  const id=await decisionId(agendaId,ruleId,sourceEventId);
  const row=await this.#domains.read('faction-agenda-decision',scope,id);
  return Boolean(row&&row.data.agendaId===agendaId&&row.data.ruleId===ruleId&&
    row.data.sourceEventId===sourceEventId&&row.data.status==='gm-reviewed-action-proposal'&&
    row.data.effectsExecuted===0);
 }
 async review({scope='world',agendaId,ruleId,knowledgeReceiptIds=[],worldTime,
   sourceEventId,expectedAgendaRevision,gmApproved=false}={}){
  validateScope(scope);assertNarrativeId(sourceEventId);
  if(!RID.test(ruleId??'')||gmApproved!==true)fail('AGENDA_APPROVAL','Named rule and explicit GM approval required');
  const plan=await this.assess({scope,agendaId,knowledgeReceiptIds,worldTime});
  if(plan.agendaRevision!==expectedAgendaRevision)fail('REVISION_CONFLICT','Agenda revision changed during review');
  const choice=plan.proposals.find(r=>r.ruleId===ruleId);
  if(!choice)fail('AGENDA_NOT_ELIGIBLE','World truth and faction knowledge do not authorize proposed action');
  const id=await decisionId(agendaId,ruleId,sourceEventId);
  const data={agendaId,ruleId,actionId:choice.actionId,sourceEventId,
   agendaRevision:plan.agendaRevision,worldTime,status:'gm-reviewed-action-proposal',effectsExecuted:0};
  const prior=await this.#domains.read('faction-agenda-decision',scope,id);
  if(prior){if(JSON.stringify(prior.data)===JSON.stringify(data))return clone(prior);
    fail('AGENDA_DECISION_CONFLICT','Decision identity reused with different world state');}
  return this.#domains.save({type:'faction-agenda-decision',scope,id,sourceEventId,data});
 }
}
