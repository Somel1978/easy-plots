/** Pure GM-side, bounded narrative flow controls. No world reads or side effects. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {evaluateCondition} from './conditions.mjs';
import {ADVANCED_LOGIC_CONFIG,ADVANCED_LOGIC_TYPES,validateAdvancedLogicNode,evaluateAdvancedLogicNode} from './advanced-logic.mjs';
import {CONVERGENCE_NODE_TYPE,CONVERGENCE_NODE_CONFIG,validateConvergenceNode} from './convergence.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const config=Object.freeze({
  ...ADVANCED_LOGIC_CONFIG,
  [CONVERGENCE_NODE_TYPE]:CONVERGENCE_NODE_CONFIG,
  'core.branch.parallel':{label:'Parallel narrative paths',data:{},outputs:['out']},
  'core.event.filter':{label:'Event predicate filter',data:{condition:{op:'compare',operator:'eq',left:{type:'reference',path:['event','verified'],requiredPermission:'gm'},right:{type:'literal',value:true}}},outputs:['out']},
  'core.gate.world-time':{label:'World-time window',data:{startWorldTime:0,endWorldTime:100},outputs:['out']},
  'core.gate.actor':{label:'Actor relevance gate',data:{actorId:'ep:actor:example_001'},outputs:['out']},
  'core.gate.evidence':{label:'Evidence relevance gate',data:{evidenceId:'ep:evidence:example_001'},outputs:['out']},
  'core.branch.roll-band':{label:'Recorded roll outcome branch',data:{lowMax:9,highMin:16},outputs:['low','middle','high']},
  'core.gate.faction-membership':{label:'Faction membership gate',data:{factionId:'ep:faction:example_001',memberId:'ep:actor:example_001',status:'member'},outputs:['out']},
  'core.gate.faction-rank':{label:'Faction rank gate',data:{factionId:'ep:faction:example_001',actorId:'ep:actor:example_001',allowedRanks:['member','officer','leader']},outputs:['out']},
  'core.gate.npc-location':{label:'NPC location gate',data:{npcId:'ep:npc:example_001',locationId:'ep:location:example_001'},outputs:['out']},
  'core.gate.quest-state':{label:'Quest objective state gate',data:{objectiveId:'ep:objective:example_001',state:'active'},outputs:['out']},
  'core.gate.arc-state':{label:'Arc outcome state gate',data:{arcId:'ep:arc:example_001',state:'concluded'},outputs:['out']},
  'core.gate.pressure-threshold':{label:'Pressure clock threshold',data:{clockId:'ep:clock:example_001',minTicks:3},outputs:['out']},
  'core.gate.knowledge-claim':{label:'Observer authorized claim gate',data:{observerId:'ep:actor:example_001',claimId:'ep:claim:example_001'},outputs:['out']},
  'core.gate.relationship':{label:'Relationship state gate',data:{relationshipId:'ep:relationship:example_001',status:'active'},outputs:['out']},
  'core.gate.disclosure-recipient':{label:'Disclosure recipient gate',data:{observerId:'ep:actor:example_001'},outputs:['out']},
  'core.branch.authorized-choice':{label:'Declared player choice branch',data:{allowedChoices:['investigate','negotiate','withdraw']},outputs:['investigate','negotiate','withdraw']},
  'core.gate.faction-knowledge':{label:'Faction-known claim gate',data:{factionId:'ep:faction:example_001',claimId:'ep:claim:example_001'},outputs:['out']},
  'core.gate.npc-agenda':{label:'NPC agenda state gate',data:{npcId:'ep:npc:example_001',agendaId:'ep:agenda:example_001',status:'active'},outputs:['out']},
  'core.gate.deadline':{label:'Authored deadline gate',data:{deadlineId:'ep:deadline:example_001',status:'due'},outputs:['out']},
  'core.gate.known-route':{label:'Discovered route gate',data:{routeId:'ep:route:example_001',observerId:'ep:actor:example_001'},outputs:['out']},
  'core.gate.continuity':{label:'Continuity reference gate',data:{sourceArcId:'ep:arc:example_001',entityId:'ep:npc:example_001'},outputs:['out']},
  'core.gate.hypothesis':{label:'Player hypothesis gate',data:{hypothesisId:'ep:hypothesis:example_001',status:'reviewed'},outputs:['out']},
  'core.gate.provenance':{label:'Causal provenance gate',data:{sourceEventId:'ep:event:example_001'},outputs:['out']},
  'core.gate.faction-standing':{label:'Faction standing threshold gate',data:{factionId:'ep:faction:example_001',actorId:'ep:actor:example_001',minStanding:5},outputs:['out']},
  'core.branch.milestone':{label:'Milestone eligibility branch',data:{milestoneId:'ep:milestone:example_001'},outputs:['qualified','pending']},
  'core.branch.disclosure':{label:'Disclosure status branch',data:{disclosureId:'ep:disclosure:example_001'},outputs:['approved','withheld']}
});
export const LOGIC_NODE_CONFIG=config;
export const LOGIC_NODE_TYPES=Object.freeze(Object.keys(config));
function validatePredicate(ast,depth=0){
  if(!ast||typeof ast!=='object'||Array.isArray(ast)||depth>12)fail('LOGIC_NODE_PREDICATE','Invalid bounded predicate');
  if(['all','any'].includes(ast.op)){
    if(!Array.isArray(ast.terms)||!ast.terms.length||ast.terms.length>16)fail('LOGIC_NODE_PREDICATE','A bounded nonempty term list is required');
    for(const term of ast.terms)validatePredicate(term,depth+1);return;
  }
  if(ast.op==='not'){validatePredicate(ast.term,depth+1);return;}
  if(ast.op!=='compare'||!['eq','neq','gt','gte','lt','lte','contains'].includes(ast.operator))fail('LOGIC_NODE_PREDICATE','Unsupported compare operator');
  for(const part of [ast.left,ast.right]){
    if(!part||typeof part!=='object'||!['literal','reference'].includes(part.type))fail('LOGIC_NODE_PREDICATE','Invalid comparison value');
    if(part.type==='reference'&&(!Array.isArray(part.path)||!part.path.length||part.path.length>12||part.path.some(k=>typeof k!=='string'||['__proto__','prototype','constructor'].includes(k))||!['published','party','observer-private','gm','gm-secret'].includes(part.requiredPermission)))fail('LOGIC_NODE_PREDICATE','Invalid reference path');
  }
}
export function validateLogicNode(node){
  if(node?.typeId===CONVERGENCE_NODE_TYPE)return validateConvergenceNode(node);
  if(ADVANCED_LOGIC_TYPES.includes(node?.typeId))return validateAdvancedLogicNode(node);
  const def=config[node?.typeId];if(!def)fail('LOGIC_NODE_UNKNOWN','Unknown built-in logic node');
  const data=node.data;
  if(!data||typeof data!=='object'||Array.isArray(data))fail('LOGIC_NODE_DATA','Logic node requires typed data');
  if(node.typeId==='core.event.filter'){
    if(!data.condition||typeof data.condition!=='object'||Array.isArray(data.condition))fail('LOGIC_NODE_DATA','Structured filter required');
    validatePredicate(data.condition);
  }
  if(node.typeId==='core.gate.world-time'&&(!Number.isFinite(data.startWorldTime)||!Number.isFinite(data.endWorldTime)||data.startWorldTime<0||data.endWorldTime<data.startWorldTime))fail('LOGIC_NODE_TIME','Invalid authored world-time interval');
  if(node.typeId==='core.gate.actor')assertNarrativeId(data.actorId);
  if(node.typeId==='core.gate.evidence')assertNarrativeId(data.evidenceId);
  if(node.typeId==='core.branch.roll-band'&&(!Number.isSafeInteger(data.lowMax)||!Number.isSafeInteger(data.highMin)||data.lowMax<1||data.highMin>100||data.lowMax>=data.highMin))fail('LOGIC_NODE_BANDS','Recorded roll bands must be ordered integers');
  const idFields={
    'core.gate.faction-membership':['factionId','memberId'],
    'core.gate.faction-rank':['factionId','actorId'],
    'core.gate.npc-location':['npcId','locationId'],
    'core.gate.quest-state':['objectiveId'],
    'core.gate.arc-state':['arcId'],
    'core.gate.pressure-threshold':['clockId'],
    'core.gate.knowledge-claim':['observerId','claimId'],
    'core.gate.relationship':['relationshipId'],
    'core.gate.disclosure-recipient':['observerId'],
    'core.gate.faction-knowledge':['factionId','claimId'],
    'core.gate.npc-agenda':['npcId','agendaId'],
    'core.gate.deadline':['deadlineId'],
    'core.gate.known-route':['routeId','observerId'],
    'core.gate.continuity':['sourceArcId','entityId'],
    'core.gate.hypothesis':['hypothesisId'],
    'core.gate.provenance':['sourceEventId'],
    'core.gate.faction-standing':['factionId','actorId'],
    'core.branch.milestone':['milestoneId'],
    'core.branch.disclosure':['disclosureId']};
  for(const field of idFields[node.typeId]??[])assertNarrativeId(data[field]);
  const enumFields={
    'core.gate.faction-membership':['status',['member','suspended','former']],
    'core.gate.quest-state':['state',['pending','active','completed','failed','abandoned','suspended','concluded']],
    'core.gate.arc-state':['state',['active','eligible','pending-finalization','concluded','reopened']],
    'core.gate.relationship':['status',['formed','active','ended','disputed']],
    'core.gate.npc-agenda':['status',['draft','active','paused','completed','failed']],
    'core.gate.deadline':['status',['pending','due','waived','resolved']],
    'core.gate.hypothesis':['status',['proposed','contested','retracted','reviewed']]};
  const en=enumFields[node.typeId];if(en&&!en[1].includes(data[en[0]]))fail('LOGIC_NODE_ENUM','Invalid authored gate status');
  if(node.typeId==='core.gate.pressure-threshold'&&(!Number.isSafeInteger(data.minTicks)||data.minTicks<0||data.minTicks>100))fail('LOGIC_NODE_THRESHOLD','Invalid clock threshold');
  if(node.typeId==='core.gate.faction-rank'&&(!Array.isArray(data.allowedRanks)||!data.allowedRanks.length||data.allowedRanks.length>4||data.allowedRanks.some(x=>!['initiate','member','officer','leader'].includes(x))||new Set(data.allowedRanks).size!==data.allowedRanks.length))fail('LOGIC_NODE_RANKS','Invalid approved rank set');
  if(node.typeId==='core.gate.faction-standing'&&(!Number.isSafeInteger(data.minStanding)||Math.abs(data.minStanding)>1000))fail('LOGIC_NODE_STANDING','Invalid standing threshold');
  if(node.typeId==='core.branch.authorized-choice'&&(!Array.isArray(data.allowedChoices)||!data.allowedChoices.length||data.allowedChoices.length>3||data.allowedChoices.some(c=>!config[node.typeId].outputs.includes(c))||new Set(data.allowedChoices).size!==data.allowedChoices.length))fail('LOGIC_NODE_CHOICES','Invalid authored choice set');
  const allowed=node.typeId==='core.event.filter'?['condition']:node.typeId==='core.gate.world-time'?['startWorldTime','endWorldTime']:node.typeId==='core.gate.actor'?['actorId']:node.typeId==='core.gate.evidence'?['evidenceId']:node.typeId==='core.branch.roll-band'?['lowMax','highMin']:[];
  const extraAllowed={
    'core.gate.faction-membership':['factionId','memberId','status'],
    'core.gate.faction-rank':['factionId','actorId','allowedRanks'],
    'core.gate.npc-location':['npcId','locationId'],
    'core.gate.quest-state':['objectiveId','state'],
    'core.gate.arc-state':['arcId','state'],
    'core.gate.pressure-threshold':['clockId','minTicks'],
    'core.gate.knowledge-claim':['observerId','claimId'],
    'core.gate.relationship':['relationshipId','status'],
    'core.gate.disclosure-recipient':['observerId'],
    'core.branch.authorized-choice':['allowedChoices'],
    'core.gate.faction-knowledge':['factionId','claimId'],
    'core.gate.npc-agenda':['npcId','agendaId','status'],
    'core.gate.deadline':['deadlineId','status'],
    'core.gate.known-route':['routeId','observerId'],
    'core.gate.continuity':['sourceArcId','entityId'],
    'core.gate.hypothesis':['hypothesisId','status'],
    'core.gate.provenance':['sourceEventId'],
    'core.gate.faction-standing':['factionId','actorId','minStanding'],
    'core.branch.milestone':['milestoneId'],
    'core.branch.disclosure':['disclosureId']};
  if(Object.keys(data).some(k=>![...allowed,...(extraAllowed[node.typeId]??[])].includes(k)))fail('LOGIC_NODE_FIELD','Unrecognized logic node input');
  if(new TextEncoder().encode(JSON.stringify(data)).length>3000)fail('LOGIC_NODE_BUDGET','Logic node data exceeds bounded size');
  return true;
}
export function evaluateLogicNode(node,event){
  validateLogicNode(node);
  if(node.typeId===CONVERGENCE_NODE_TYPE)fail('CONVERGENCE_CONTEXT','Convergence requires its event-local bounded execution context');
  if(ADVANCED_LOGIC_TYPES.includes(node.typeId))return evaluateAdvancedLogicNode(node,event);
  const p=event?.payload??{};
  switch(node.typeId){
    case 'core.branch.parallel':return {pass:true,allowedPorts:null};
    case 'core.event.filter':return {pass:evaluateCondition(node.data.condition,{values:{event:p},clearance:'gm-secret'}),allowedPorts:null};
    case 'core.gate.world-time':{const time=event?.worldTime??p.worldTime;return {pass:Number.isFinite(time)&&time>=node.data.startWorldTime&&time<=node.data.endWorldTime,allowedPorts:null};}
    case 'core.gate.actor':return {pass:p.actorId===node.data.actorId,allowedPorts:null};
    case 'core.gate.evidence':return {pass:p.evidenceId===node.data.evidenceId,allowedPorts:null};
    case 'core.branch.roll-band':{
      // No fresh roll is generated: route only through a recorded, bounded result.
      const value=p.rollTotal;
      if(!Number.isInteger(value)||value<1||value>100)return {pass:false,allowedPorts:[]};
      const port=value<=node.data.lowMax?'low':value>=node.data.highMin?'high':'middle';
      return {pass:true,allowedPorts:[port]};
    }
    case 'core.gate.faction-membership':return {pass:p.factionId===node.data.factionId&&p.memberId===node.data.memberId&&p.membershipStatus===node.data.status,allowedPorts:null};
    case 'core.gate.faction-rank':return {pass:p.factionId===node.data.factionId&&p.actorId===node.data.actorId&&node.data.allowedRanks.includes(p.factionRank),allowedPorts:null};
    case 'core.gate.npc-location':return {pass:p.npcId===node.data.npcId&&p.locationId===node.data.locationId,allowedPorts:null};
    case 'core.gate.quest-state':return {pass:p.objectiveId===node.data.objectiveId&&p.objectiveState===node.data.state,allowedPorts:null};
    case 'core.gate.arc-state':return {pass:p.arcId===node.data.arcId&&p.arcState===node.data.state,allowedPorts:null};
    case 'core.gate.pressure-threshold':return {pass:p.clockId===node.data.clockId&&Number.isSafeInteger(p.ticks)&&p.ticks>=node.data.minTicks,allowedPorts:null};
    case 'core.gate.knowledge-claim':return {pass:p.observerId===node.data.observerId&&Array.isArray(p.authorizedClaimIds)&&p.authorizedClaimIds.length<=64&&p.authorizedClaimIds.includes(node.data.claimId),allowedPorts:null};
    case 'core.gate.relationship':return {pass:p.relationshipId===node.data.relationshipId&&p.relationshipStatus===node.data.status,allowedPorts:null};
    case 'core.gate.disclosure-recipient':return {pass:Array.isArray(p.disclosureRecipientIds)&&p.disclosureRecipientIds.length<=64&&p.disclosureRecipientIds.includes(node.data.observerId),allowedPorts:null};
    case 'core.branch.authorized-choice':{const c=p.choiceId;return {pass:node.data.allowedChoices.includes(c),allowedPorts:node.data.allowedChoices.includes(c)?[c]:[]};}
    case 'core.gate.faction-knowledge':return {pass:p.factionId===node.data.factionId&&Array.isArray(p.factionKnownClaimIds)&&p.factionKnownClaimIds.length<=64&&p.factionKnownClaimIds.includes(node.data.claimId),allowedPorts:null};
    case 'core.gate.npc-agenda':return {pass:p.npcId===node.data.npcId&&p.agendaId===node.data.agendaId&&p.agendaStatus===node.data.status,allowedPorts:null};
    case 'core.gate.deadline':return {pass:p.deadlineId===node.data.deadlineId&&p.deadlineStatus===node.data.status,allowedPorts:null};
    case 'core.gate.known-route':return {pass:p.observerId===node.data.observerId&&Array.isArray(p.authorizedRouteIds)&&p.authorizedRouteIds.length<=64&&p.authorizedRouteIds.includes(node.data.routeId),allowedPorts:null};
    case 'core.gate.continuity':return {pass:p.sourceArcId===node.data.sourceArcId&&Array.isArray(p.continuityEntityIds)&&p.continuityEntityIds.length<=64&&p.continuityEntityIds.includes(node.data.entityId),allowedPorts:null};
    case 'core.gate.hypothesis':return {pass:p.hypothesisId===node.data.hypothesisId&&p.hypothesisStatus===node.data.status,allowedPorts:null};
    case 'core.gate.provenance':return {pass:Array.isArray(p.provenanceEventIds)&&p.provenanceEventIds.length<=64&&p.provenanceEventIds.includes(node.data.sourceEventId),allowedPorts:null};
    case 'core.gate.faction-standing':return {pass:p.factionId===node.data.factionId&&p.actorId===node.data.actorId&&Number.isFinite(p.standing)&&p.standing>=node.data.minStanding,allowedPorts:null};
    case 'core.branch.milestone':{const yes=p.milestoneId===node.data.milestoneId&&p.milestoneEligibility==='eligible';return {pass:true,allowedPorts:[yes?'qualified':'pending']};}
    case 'core.branch.disclosure':{const yes=p.disclosureId===node.data.disclosureId&&p.disclosureStatus==='approved';return {pass:true,allowedPorts:[yes?'approved':'withheld']};}
    default:fail('LOGIC_NODE_UNKNOWN','Logic node has no evaluator');
  }
}
