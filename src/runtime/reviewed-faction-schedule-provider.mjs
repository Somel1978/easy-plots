/** GM-reviewed effect that stages one faction action as pending world-time.
 * The effect is a schedule record, NOT the underlying faction action.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
export const REVIEWED_FACTION_SCHEDULE_PROVIDER='narrative.schedule-reviewed-faction-action';
export function validateReviewedFactionSchedulePayload(p){
 if(!p||typeof p!=='object'||Array.isArray(p))fail('FACTION_SCHEDULE_PAYLOAD','Typed schedule payload required');
 if(Object.keys(p).some(k=>!['scope','decisionId','commitmentId','dueAt'].includes(k)))
  fail('FACTION_SCHEDULE_PAYLOAD','Unsupported schedule field');
 if(typeof p.scope!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(p.scope))fail('FACTION_SCHEDULE_SCOPE','Explicit scope required');
 for(const key of ['decisionId','commitmentId'])assertNarrativeId(p[key]);
 if(!Number.isSafeInteger(p.dueAt)||p.dueAt<0||p.dueAt>1e9)fail('FACTION_SCHEDULE_TIME','Finite authored due-time required');
 return structuredClone(p);
}
export function createReviewedFactionScheduleProvider({service,gmProvider}={}){
 if(typeof service?.prepare!=='function'||typeof service?.verify!=='function'||typeof gmProvider!=='function')
  fail('FACTION_SCHEDULE_PROVIDER','Protected scheduler and GM authority required');
 const gm=()=>{const g=gmProvider();assertLocalGM(g);return g;};
 return Object.freeze({id:REVIEWED_FACTION_SCHEDULE_PROVIDER,version:'1.0.0',validate:validateReviewedFactionSchedulePayload,
  async apply(payload,context){gm();const p=validateReviewedFactionSchedulePayload(payload);
   assertNarrativeId(context?.sourceEventId);assertNarrativeId(context?.operationId);
   return service.prepare({...p,sourceEventId:context.sourceEventId,gmApproved:true});
  },
  async verify(payload,context){gm();const p=validateReviewedFactionSchedulePayload(payload);
   return service.verify({...p,sourceEventId:context?.sourceEventId});
  }
 });
}
