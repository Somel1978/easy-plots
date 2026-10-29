/** Link approved NPC schedules to bounded, authoritative knowledge and due work.
 * A due action is still an intent for GM review, never an invented outcome.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {receiptKnowledgeTime} from '../domains/knowledge.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const ids=(values,max=32)=>{
 if(!Array.isArray(values)||values.length>max||new Set(values).size!==values.length)fail('NPC_ACTION_BUDGET','Bounded unique canonical references required');
 values.forEach(assertNarrativeId);return [...values];
};
const bindingId=async(scope,id)=>`ep:npc-action-binding:${(await sha256Hex(`${scope}|${id}`)).slice(0,28)}`;
export class PersistentNPCActions {
 #domains;#time;
 constructor({domains,timeCoordinator}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||typeof timeCoordinator?.schedule!=='function'||typeof timeCoordinator?.read!=='function'||typeof timeCoordinator?.repairIndex!=='function')fail('NPC_ACTION_DEPENDENCY','Protected canonical NPC records and indexed time coordination required');
  this.#domains=domains;this.#time=timeCoordinator;
 }
 async assess({scope='world',scheduleId,knowledgeReceiptIds=[],correctionIds=[],worldTime}={}){
  assertNarrativeId(scheduleId);knowledgeReceiptIds=ids(knowledgeReceiptIds);correctionIds=ids(correctionIds);
  if(!Number.isSafeInteger(worldTime)||worldTime<0||worldTime>1e9)fail('NPC_ACTION_TIME','Bounded explicit fictional time required');
  const observations=[],read=async(type,id)=>{const row=await this.#domains.read(type,scope,id);observations.push({type,id,revision:row?.revision??null});return row;};
  const schedule=await read('npc-schedule',scheduleId);
  if(!schedule?.data.agendaId)fail('NPC_ACTION_SCHEDULE','Canonical NPC schedule must name its agenda');
  const agenda=await read('npc-agenda',schedule.data.agendaId);
  if(!agenda||agenda.data.npcId!==schedule.data.npcId)fail('NPC_ACTION_IDENTITY','Schedule and agenda must belong to the same narrative NPC');
  const blockers=[];
  if(!['planned','due'].includes(schedule.data.status))blockers.push('schedule-not-pending');
  if(agenda.data.status!=='active')blockers.push('agenda-not-active');
  if(!Number.isSafeInteger(schedule.data.dueWorldTime)||schedule.data.dueWorldTime<0||schedule.data.dueWorldTime>1e9)fail('NPC_ACTION_TIME','Canonical schedule has an invalid due time');
  const requiredKnowledge=ids(agenda.data.requiredKnowledgeIds??[]),requiredFacts=ids(agenda.data.requiredCanonicalFactIds??[]);
  const corrections=new Map();
  for(const id of correctionIds){
   const row=await read('knowledge-correction',id);
   if(!row||row.data.observerId!==schedule.data.npcId||!knowledgeReceiptIds.includes(row.data.receiptId)||corrections.has(row.data.receiptId))fail('NPC_ACTION_KNOWLEDGE','Selected correction does not uniquely belong to this NPC and receipt set');
   corrections.set(row.data.receiptId,row);
  }
  const known=new Set();
  for(const id of knowledgeReceiptIds){
   const row=await read('knowledge-receipt',id);
   if(!row||row.data.observerId!==schedule.data.npcId)fail('NPC_ACTION_KNOWLEDGE','Selected receipt does not belong to this NPC');
   const claim=await read('knowledge-claim',row.data.claimId),correction=corrections.get(id);
   if(!claim||claim.revision!==row.data.claimRevision||claim.data.status!=='established')fail('NPC_ACTION_KNOWLEDGE_STALE','Claim changed since this NPC disclosure');
   if(correction&&(correction.data.claimId!==row.data.claimId||correction.data.receiptRevision!==row.revision))fail('NPC_ACTION_KNOWLEDGE_STALE','Selected correction no longer matches the receipt');
   if(row.data.state==='published'&&receiptKnowledgeTime(row.data)<=worldTime&&['reported','believed'].includes(correction?.data.revisedStance??row.data.stance))known.add(row.data.claimId);
  }
  if(requiredKnowledge.some(id=>!known.has(id)))blockers.push('npc-does-not-know-prerequisites');
  for(const id of requiredFacts){const row=await read('world-fact',id);if(row?.data.status!=='asserted')blockers.push('canonical-prerequisite-unmet');}
  return clone({scope,scheduleId,scheduleRevision:schedule.revision,agendaId:agenda.id,agendaRevision:agenda.revision,npcId:schedule.data.npcId,dueAt:schedule.data.dueWorldTime,worldTime,
   eligible:blockers.length===0,due:schedule.data.dueWorldTime<=worldTime,blockers:[...new Set(blockers)],observations,knowledgeReceiptIds,correctionIds,outcome:'undetermined',effectsExecuted:0});
 }
 async prepare({scope='world',scheduleId,commitmentId,expectedScheduleRevision,expectedAgendaRevision,knowledgeReceiptIds=[],correctionIds=[],worldTime,sourceEventId,operationId,approved=false}={}){
  for(const id of [commitmentId,sourceEventId,operationId])assertNarrativeId(id);
  if(!/^ep:operation:[A-Za-z0-9_:-]{6,200}$/.test(operationId)||!/^ep:event:[A-Za-z0-9_-]{8,120}$/.test(sourceEventId))fail('EFFECT_PROVENANCE','NPC preparation requires an attributable operation and source event');
  if(approved!==true)fail('NPC_ACTION_APPROVAL','Explicit GM approval required before indexing an NPC action');
  const spec=clone({scope,scheduleId,knowledgeReceiptIds,correctionIds,worldTime}),plan=await this.assess(spec);
  if(plan.scheduleRevision!==expectedScheduleRevision||plan.agendaRevision!==expectedAgendaRevision)fail('REVISION_CONFLICT','NPC schedule or agenda changed since GM review');
  if(!plan.eligible)fail('NPC_ACTION_BLOCKED',`NPC action blocked: ${plan.blockers.join(', ')}`);
  const id=await bindingId(scope,commitmentId),data={commitmentId,scheduleId,agendaId:plan.agendaId,npcId:plan.npcId,scheduleRevision:plan.scheduleRevision,agendaRevision:plan.agendaRevision,
   dueAt:plan.dueAt,knowledgeReceiptIds:spec.knowledgeReceiptIds,correctionIds:spec.correctionIds,reviewedAt:worldTime,observations:plan.observations,sourceEventId,operationId,state:'reviewed-pending-intent'};
  const prior=await this.#domains.read('npc-action-binding',scope,id);
  if(prior){if(JSON.stringify(prior.data)!==JSON.stringify(data))fail('NPC_ACTION_CONFLICT','Commitment identity already belongs to another NPC review');}
  else await this.#domains.save({type:'npc-action-binding',scope,id,sourceEventId,data});
  const previous=await this.#time.read({scope,id:commitmentId});
  if(previous){
   if(!this.#matches(previous,data,id))fail('NPC_ACTION_CONFLICT','Existing due commitment has different provenance');
   if(['pending','due'].includes(previous.data.status))await this.#time.repairIndex({scope,id:commitmentId});
   return {commitmentId,alreadyPrepared:true,effectsExecuted:0,outcome:'undetermined'};
  }
  // Revalidate after the durable binding write and before staging due work.
  const fresh=await this.assess(spec);
  if(!fresh.eligible||JSON.stringify(fresh.observations)!==JSON.stringify(plan.observations))fail('NPC_ACTION_STALE','NPC prerequisites changed while preparing the commitment');
  await this.#time.schedule({scope,id:commitmentId,sourceEventId,ownerId:plan.npcId,kind:'npc-action',dueAt:plan.dueAt,originRevision:plan.scheduleRevision,prerequisiteIds:[scheduleId,plan.agendaId,id]});
  return {commitmentId,alreadyPrepared:false,effectsExecuted:0,outcome:'undetermined'};
 }
 #matches(row,data,id){return row.sourceEventId===data.sourceEventId&&row.data.kind==='npc-action'&&row.data.ownerId===data.npcId&&row.data.dueAt===data.dueAt&&row.data.originRevision===data.scheduleRevision&&JSON.stringify(row.data.prerequisiteIds)===JSON.stringify([data.scheduleId,data.agendaId,id]);}
 async verifyPrepared({scope='world',commitmentId,scheduleId,expectedScheduleRevision,expectedAgendaRevision,knowledgeReceiptIds=[],correctionIds=[],worldTime,sourceEventId,operationId}={}){
  assertNarrativeId(commitmentId);const id=await bindingId(scope,commitmentId),binding=await this.#domains.read('npc-action-binding',scope,id),row=await this.#time.read({scope,id:commitmentId});
  return Boolean(binding&&row&&binding.data.sourceEventId===sourceEventId&&binding.data.operationId===operationId&&binding.data.scheduleId===scheduleId&&binding.data.scheduleRevision===expectedScheduleRevision&&binding.data.agendaRevision===expectedAgendaRevision&&binding.data.reviewedAt===worldTime&&JSON.stringify(binding.data.knowledgeReceiptIds)===JSON.stringify(knowledgeReceiptIds)&&JSON.stringify(binding.data.correctionIds)===JSON.stringify(correctionIds)&&this.#matches(row,binding.data,id));
 }
 async verifyDue({scope='world',commitment,worldTime}={}){
  if(commitment?.data.kind!=='npc-action')return true;
  const id=await bindingId(scope,commitment.id),binding=await this.#domains.read('npc-action-binding',scope,id);
  if(!binding||!this.#matches(commitment,binding.data,id))fail('NPC_ACTION_UNREVIEWED','Due NPC action lacks a verified canonical review');
  const plan=await this.assess({scope,scheduleId:binding.data.scheduleId,knowledgeReceiptIds:binding.data.knowledgeReceiptIds,correctionIds:binding.data.correctionIds,worldTime});
  if(!plan.eligible||!plan.due||JSON.stringify(plan.observations)!==JSON.stringify(binding.data.observations))fail('NPC_ACTION_STALE','NPC agenda, schedule or knowledge changed since approved preparation');
  return true;
 }
}
