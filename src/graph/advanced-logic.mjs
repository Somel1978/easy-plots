/** Versioned, side-effect-free GM logic providers for cross-domain campaign decisions.
 * These only examine the normalized GM event envelope. They never fetch world
 * documents, disclose hidden fields, or decide an effect is authorized.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
const deny=(code,message)=>{throw new EasyPlotsError(code,message);};
const id=s=>`ep:${s}:example_001`;
const defs={
 'core.gate.event-origin':{label:'Canonical event origin',data:{originId:id('actor')},fields:{originId:'id'},outputs:['out']},
 'core.gate.causal-depth':{label:'Causal depth budget',data:{maxDepth:3},fields:{maxDepth:'smallCount'},outputs:['out']},
 'core.gate.after-time':{label:'World time at or after',data:{notBefore:100},fields:{notBefore:'worldTime'},outputs:['out']},
 'core.gate.before-time':{label:'World time before',data:{before:100},fields:{before:'worldTime'},outputs:['out']},
 'core.gate.faction-pressure':{label:'Faction pressure threshold',data:{factionId:id('faction'),minPressure:3},fields:{factionId:'id',minPressure:'smallCount'},outputs:['out']},
 'core.gate.investigation-progress':{label:'Investigation verified progress',data:{investigationId:id('investigation'),minMilestones:2},fields:{investigationId:'id',minMilestones:'smallCount'},outputs:['out']},
 'core.gate.evidence-corroborated':{label:'Corroborated evidence gate',data:{evidenceId:id('evidence')},fields:{evidenceId:'id'},outputs:['out']},
 'core.gate.obligation-status':{label:'Outstanding obligation status',data:{obligationId:id('obligation'),status:'outstanding'},fields:{obligationId:'id',status:['outstanding','fulfilled','waived','disputed','expired']},outputs:['out']},
 'core.gate.npc-disposition':{label:'NPC disposition to observer',data:{npcId:id('npc'),observerId:id('actor'),stance:'friendly'},fields:{npcId:'id',observerId:'id',stance:['friendly','neutral','hostile','unknown']},outputs:['out']},
 'core.gate.milestone-credit':{label:'Authorized milestone participant credit',data:{milestoneId:id('milestone'),actorId:id('actor')},fields:{milestoneId:'id',actorId:'id'},outputs:['out']},
 'core.gate.identity-persona':{label:'Verified persona relationship',data:{entityId:id('entity'),personaId:id('persona')},fields:{entityId:'id',personaId:'id'},outputs:['out']},
 'core.gate.route-status':{label:'World route operational status',data:{routeId:id('route'),status:'open'},fields:{routeId:'id',status:['open','restricted','closed']},outputs:['out']},
 'core.branch.investigation-outcome':{label:'Investigation outcome branch',data:{investigationId:id('investigation')},fields:{investigationId:'id'},outputs:['solved','partial','failed','unresolved']},
 'core.branch.arc-ending':{label:'Arc ending eligibility branch',data:{arcId:id('arc'),endingId:'partial-victory'},fields:{arcId:'id',endingId:'token'},outputs:['eligible','pending']},
 'core.branch.threat-clock':{label:'Threat clock breach branch',data:{clockId:id('clock'),threshold:4},fields:{clockId:'id',threshold:'smallCount'},outputs:['breached','below']},
 'core.gate.social-debt':{label:'Owed social obligation gate',data:{debtorId:id('faction'),creditorId:id('actor')},fields:{debtorId:'id',creditorId:'id'},outputs:['out']},
 'core.gate.faction-operation':{label:'Faction operation state gate',data:{agendaId:id('agenda'),status:'active'},fields:{agendaId:'id',status:['draft','active','paused','completed','failed']},outputs:['out']},
 'core.gate.resource-integrity':{label:'Native reference integrity gate',data:{resourceId:id('resource'),status:'tracked'},fields:{resourceId:'id',status:['tracked','stale','missing','archived']},outputs:['out']},
 'core.gate.blueprint-version':{label:'Blueprint published revision gate',data:{blueprintId:id('blueprint'),minVersion:1},fields:{blueprintId:'id',minVersion:'smallCount'},outputs:['out']},
 'core.gate.player-contribution':{label:'Qualified player contribution gate',data:{objectiveId:id('objective'),actorId:id('actor')},fields:{objectiveId:'id',actorId:'id'},outputs:['out']},
 'core.gate.campaign-readiness':{label:'Campaign continuation readiness gate',data:{arcId:id('arc'),state:'reviewed'},fields:{arcId:'id',state:['draft','reviewed','approved']},outputs:['out']},
 'core.gate.identity-disclosure':{label:'Verified identity disclosure gate',data:{entityId:id('entity'),observerId:id('actor')},fields:{entityId:'id',observerId:'id'},outputs:['out']},
 'core.branch.request-result':{label:'Narrative request result branch',data:{requestId:id('request')},fields:{requestId:'id'},outputs:['approved','rejected','pending']},
 'core.branch.reputation':{label:'Faction standing band branch',data:{factionId:id('faction'),actorId:id('actor'),positiveAt:5,negativeBelow:-5},fields:{factionId:'id',actorId:'id',positiveAt:'signedCount',negativeBelow:'signedCount'},outputs:['positive','neutral','negative']}
};
export const ADVANCED_LOGIC_CONFIG=Object.freeze(Object.fromEntries(Object.entries(defs).map(([key,value])=>[key,Object.freeze(value)])));
export const ADVANCED_LOGIC_TYPES=Object.freeze(Object.keys(defs));
const owns=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
function boundedIds(value){return Array.isArray(value)&&value.length<=64&&new Set(value).size===value.length&&value.every(v=>typeof v==='string'&&/^ep:[a-z][a-z0-9-]*:[a-zA-Z0-9_-]{3,120}$/.test(v));}
export function validateAdvancedLogicNode(node){
 const def=ADVANCED_LOGIC_CONFIG[node?.typeId];if(!def)deny('LOGIC_NODE_UNKNOWN','Unknown specialized logic node');
 const data=node.data;
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==Object.keys(def.fields).length)deny('LOGIC_NODE_DATA','Typed specialized gate contract required');
 for(const [field,kind] of Object.entries(def.fields)){
   if(!owns(data,field))deny('LOGIC_NODE_DATA','Missing required specialized gate field');
   const value=data[field];
   if(kind==='id')assertNarrativeId(value);
   else if(kind==='smallCount'&&(!Number.isSafeInteger(value)||value<0||value>100))deny('LOGIC_NODE_THRESHOLD','Invalid bounded threshold');
   else if(kind==='signedCount'&&(!Number.isSafeInteger(value)||Math.abs(value)>100))deny('LOGIC_NODE_THRESHOLD','Invalid signed threshold');
   else if(kind==='worldTime'&&(!Number.isFinite(value)||value<0||value>1e12))deny('LOGIC_NODE_TIME','Invalid finite world time');
   else if(kind==='token'&&(typeof value!=='string'||! /^[a-z][a-z0-9-]{1,64}$/.test(value)))deny('LOGIC_NODE_TOKEN','Invalid ending token');
   else if(Array.isArray(kind)&&!kind.includes(value))deny('LOGIC_NODE_ENUM','Invalid authored status');
 }
 if(node.typeId==='core.branch.reputation'&&data.negativeBelow>=data.positiveAt)deny('LOGIC_NODE_THRESHOLD','Reputation bands must be disjoint and ordered');
 if(new TextEncoder().encode(JSON.stringify(data)).length>1024)deny('LOGIC_NODE_BUDGET','Specialized logic contract too large');
 return true;
}
export function evaluateAdvancedLogicNode(node,event){
 validateAdvancedLogicNode(node);
 const data=node.data,p=event?.payload??{};
 const time=event?.worldTime??p.worldTime;
 let pass=false,ports=null;
 switch(node.typeId){
 case 'core.gate.event-origin':pass=p.sourceId===data.originId&&p.originVerified===true;break;
 case 'core.gate.causal-depth':pass=Number.isSafeInteger(p.causalDepth)&&p.causalDepth>=0&&p.causalDepth<=data.maxDepth;break;
 case 'core.gate.after-time':pass=Number.isFinite(time)&&time>=data.notBefore;break;
 case 'core.gate.before-time':pass=Number.isFinite(time)&&time<data.before;break;
 case 'core.gate.faction-pressure':pass=p.factionId===data.factionId&&Number.isSafeInteger(p.pressure)&&p.pressure>=data.minPressure;break;
 case 'core.gate.investigation-progress':pass=p.investigationId===data.investigationId&&Number.isSafeInteger(p.verifiedMilestones)&&p.verifiedMilestones>=data.minMilestones;break;
 case 'core.gate.evidence-corroborated':pass=p.corrobEventVerified===true&&boundedIds(p.corroboratedEvidenceIds)&&p.corroboratedEvidenceIds.includes(data.evidenceId);break;
 case 'core.gate.obligation-status':pass=p.obligationId===data.obligationId&&p.obligationStatus===data.status;break;
 case 'core.gate.npc-disposition':pass=p.npcId===data.npcId&&p.observerId===data.observerId&&p.disposition===data.stance;break;
 case 'core.gate.milestone-credit':pass=p.milestoneId===data.milestoneId&&boundedIds(p.creditedActorIds)&&p.creditedActorIds.includes(data.actorId);break;
 case 'core.gate.identity-persona':pass=p.entityId===data.entityId&&p.personaId===data.personaId&&p.identityVerified===true;break;
 case 'core.gate.route-status':pass=p.routeId===data.routeId&&p.routeStatus===data.status;break;
 case 'core.branch.investigation-outcome':{
   const valid=p.investigationId===data.investigationId&&p.outcomeVerified===true&&defs[node.typeId].outputs.includes(p.investigationOutcome);
   pass=valid;ports=valid?[p.investigationOutcome]:[];break;
 }
 case 'core.branch.arc-ending':{
   const eligible=p.arcId===data.arcId&&p.endingId===data.endingId&&p.endingEligibility==='eligible';
   pass=true;ports=[eligible?'eligible':'pending'];break;
 }
 case 'core.gate.social-debt':pass=p.debtorId===data.debtorId&&p.creditorId===data.creditorId&&p.obligationStatus==='outstanding';break;
 case 'core.gate.faction-operation':pass=p.agendaId===data.agendaId&&p.agendaStatus===data.status;break;
 case 'core.gate.resource-integrity':pass=p.resourceId===data.resourceId&&p.integrityStatus===data.status;break;
 case 'core.gate.blueprint-version':pass=p.blueprintId===data.blueprintId&&Number.isSafeInteger(p.blueprintVersion)&&p.blueprintVersion>=data.minVersion;break;
 case 'core.gate.player-contribution':pass=p.objectiveId===data.objectiveId&&p.contributionVerified===true&&boundedIds(p.contributorIds)&&p.contributorIds.includes(data.actorId);break;
 case 'core.gate.campaign-readiness':pass=p.arcId===data.arcId&&p.continuityState===data.state;break;
 case 'core.gate.identity-disclosure':pass=p.entityId===data.entityId&&p.disclosureVerified===true&&boundedIds(p.identityObserverIds)&&p.identityObserverIds.includes(data.observerId);break;
 case 'core.branch.request-result':{const valid=p.requestId===data.requestId&&p.requestOutcomeVerified===true&&defs[node.typeId].outputs.includes(p.requestState);pass=valid;ports=valid?[p.requestState]:[];break;}
 case 'core.branch.reputation':{const v=p.standing;pass=p.factionId===data.factionId&&p.actorId===data.actorId&&Number.isSafeInteger(v)&&Math.abs(v)<=1000;ports=pass?[v>=data.positiveAt?'positive':v<data.negativeBelow?'negative':'neutral']:[];break;}
 case 'core.branch.threat-clock':{
   const known=p.clockId===data.clockId&&Number.isSafeInteger(p.ticks)&&p.ticks>=0;
   pass=known;ports=known?[p.ticks>=data.threshold?'breached':'below']:[];break;
 }
 }
 return {pass,allowedPorts:ports};
}
