/** GM-only, bounded NPC agenda and schedule planning; no invented off-screen
 * outcomes and no automatic mutations on large world-time jumps.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const boundedIds=(value,cap=64)=>{
 if(!Array.isArray(value)||value.length>cap)fail('NPC_PLAN_BUDGET','Bounded identifiers required');
 value.forEach(assertNarrativeId);if(new Set(value).size!==value.length)fail('NPC_PLAN_DUPLICATE','Duplicate ID');return value;
};
export function planNPCCampaignTurn({worldTime=0,npcs=[],dueActions=[],knownFactIds=[],maxNPCs=32,maxActions=64}={}){
 if(!Number.isFinite(worldTime)||worldTime<0)fail('NPC_PLAN_TIME','Finite world time required');
 if(!Array.isArray(npcs)||npcs.length>maxNPCs||!Array.isArray(dueActions)||dueActions.length>maxActions)
   fail('NPC_PLAN_BUDGET','Only bounded scoped NPC agenda records are supported');
 const knowledge=new Set(boundedIds(knownFactIds)),byId=new Map();
 for(const npc of npcs){
   assertNarrativeId(npc.id);
   if(byId.has(npc.id))fail('NPC_PLAN_DUPLICATE','Duplicate NPC record');
   if(!['active','suspended','unavailable'].includes(npc.status))fail('NPC_PLAN_NPC','Explicit NPC status required');
   boundedIds(npc.knownFactIds??[],32);
   byId.set(npc.id,npc);
 }
 const proposals=[],notDue=[],blocked=[],seen=new Set();
 for(const action of dueActions){
   for(const key of ['id','npcId','agendaId'])assertNarrativeId(action[key]);
   if(seen.has(action.id))fail('NPC_PLAN_DUPLICATE','Duplicate scheduled action');seen.add(action.id);
   if(!Number.isFinite(action.dueWorldTime)||action.dueWorldTime<0)fail('NPC_PLAN_TIME','Invalid authored due time');
   if(!['pending','due','resolved','cancelled'].includes(action.status))fail('NPC_PLAN_ACTION','Invalid scheduled action status');
   boundedIds(action.requiredKnowledgeIds??[],32);
   if(action.dueWorldTime>worldTime){notDue.push({id:action.id,dueWorldTime:action.dueWorldTime});continue;}
   if(action.status==='resolved'||action.status==='cancelled'){blocked.push({id:action.id,reason:'already-resolved-or-cancelled'});continue;}
   const npc=byId.get(action.npcId);
   if(!npc){blocked.push({id:action.id,reason:'npc-not-in-scoped-snapshot'});continue;}
   if(npc.status!=='active'){blocked.push({id:action.id,reason:'npc-not-active'});continue;}
   const missing=action.requiredKnowledgeIds.filter(id=>!npc.knownFactIds.includes(id));
   if(missing.length){blocked.push({id:action.id,reason:'npc-does-not-know-prerequisites'});continue;}
   if(action.requiredCanonicalFactIds?.length){boundedIds(action.requiredCanonicalFactIds,32);
     if(action.requiredCanonicalFactIds.some(id=>!knowledge.has(id))){blocked.push({id:action.id,reason:'authored-world-prerequisites-unmet'});continue;}}
   proposals.push({id:action.id,npcId:npc.id,agendaId:action.agendaId,kind:action.kind??'planned-action',
     dueWorldTime:action.dueWorldTime,sourceEventId:action.sourceEventId??null,
     status:'gm-review',outcome:'undetermined',automaticallyApplied:false});
 }
 return clone({worldTime,proposals,blocked,notDue,committed:false,source:'scoped-gm-records',
   canonicalOutcomesInvented:false});
}
