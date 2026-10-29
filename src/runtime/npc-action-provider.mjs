import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export const NPC_ACTION_PROVIDER='narrative.schedule-npc-action';
export function validateNPCActionPayload(p){
 const fields=['scope','scheduleId','commitmentId','expectedScheduleRevision','expectedAgendaRevision','knowledgeReceiptIds','correctionIds','worldTime'];
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!fields.includes(k))||typeof p.scope!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(p.scope))fail('NPC_ACTION_PAYLOAD','Explicit bounded NPC preparation payload required');
 for(const key of ['scheduleId','commitmentId'])assertNarrativeId(p[key]);
 for(const key of ['expectedScheduleRevision','expectedAgendaRevision'])if(!Number.isSafeInteger(p[key])||p[key]<1)fail('NPC_ACTION_PAYLOAD','Expected canonical NPC revisions required');
 for(const key of ['knowledgeReceiptIds','correctionIds'])if(p[key]!==undefined){if(!Array.isArray(p[key])||p[key].length>32||new Set(p[key]).size!==p[key].length)fail('NPC_ACTION_PAYLOAD','Bounded unique knowledge references required');p[key].forEach(assertNarrativeId);}
 if(!Number.isSafeInteger(p.worldTime)||p.worldTime<0||p.worldTime>1e9)fail('NPC_ACTION_PAYLOAD','Bounded authored fictional time required');
 return clone(p);
}
export function createNPCActionProvider({service,gmProvider}={}){
 if(typeof service?.prepare!=='function'||typeof service?.verifyPrepared!=='function'||typeof gmProvider!=='function')fail('NPC_ACTION_DEPENDENCY','Protected NPC scheduling and GM context required');
 return Object.freeze({id:NPC_ACTION_PROVIDER,version:'1.0.0',validate:validateNPCActionPayload,
  async apply(payload,context){assertLocalGM(gmProvider());return service.prepare({...validateNPCActionPayload(payload),sourceEventId:context.sourceEventId,operationId:context.operationId,approved:true});},
  async verify(payload,context){assertLocalGM(gmProvider());return service.verifyPrepared({...validateNPCActionPayload(payload),sourceEventId:context.sourceEventId,operationId:context.operationId});}
 });
}
