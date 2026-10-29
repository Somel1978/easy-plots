/** Versioned GM-reviewed faction agenda decision provider.
 * Evaluates verified faction knowledge and canonical facts, but ONLY records
 * a planned action. It doesn't simulate/execute the faction action itself.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
export const REVIEWED_FACTION_AGENDA_PROVIDER='narrative.review-faction-agenda';
export function validateReviewedFactionAgendaPayload(p){
 if(!p||typeof p!=='object'||Array.isArray(p))fail('AGENDA_EFFECT','Typed agenda review required');
 const fields=new Set(['scope','agendaId','ruleId','knowledgeReceiptIds','worldTime','expectedAgendaRevision']);
 if(Object.keys(p).some(x=>!fields.has(x)))fail('AGENDA_EFFECT','Unexpected field in agenda review');
 if(typeof p.scope!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(p.scope)||
    typeof p.ruleId!=='string'||! /^[a-z][a-z0-9_-]{1,63}$/.test(p.ruleId))fail('AGENDA_EFFECT','Scope and authored rule required');
 assertNarrativeId(p.agendaId);
 if(!Array.isArray(p.knowledgeReceiptIds)||p.knowledgeReceiptIds.length>48||
  new Set(p.knowledgeReceiptIds).size!==p.knowledgeReceiptIds.length)fail('AGENDA_EFFECT','Unique bounded faction knowledge receipts required');
 p.knowledgeReceiptIds.forEach(assertNarrativeId);
 if(!Number.isSafeInteger(p.expectedAgendaRevision)||p.expectedAgendaRevision<1||
    !Number.isFinite(p.worldTime)||p.worldTime<0||p.worldTime>1e12)fail('AGENDA_EFFECT','Valid agenda revision and world time required');
 if(new TextEncoder().encode(JSON.stringify(p)).length>2048)fail('AGENDA_BUDGET','Agenda effect record too large');
 return structuredClone(p);
}
export function createReviewedFactionAgendaProvider({service,gmProvider}={}){
 if(typeof service?.review!=='function'||typeof service?.verifyDecision!=='function'||typeof gmProvider!=='function')
  fail('AGENDA_PROVIDER','GM agenda coordinator and authority required');
 const gm=()=>{const g=gmProvider();assertLocalGM(g);return g;};
 return Object.freeze({id:REVIEWED_FACTION_AGENDA_PROVIDER,version:'1.0.0',validate:validateReviewedFactionAgendaPayload,
  async apply(payload,context){gm();const p=validateReviewedFactionAgendaPayload(payload);
   assertNarrativeId(context?.sourceEventId);assertNarrativeId(context?.operationId);
   const row=await service.review({...p,sourceEventId:context.sourceEventId,gmApproved:true});
   return {recordId:row.id,revision:row.revision};
  },
  async verify(payload,context){gm();const p=validateReviewedFactionAgendaPayload(payload);
   return service.verifyDecision({scope:p.scope,agendaId:p.agendaId,
    ruleId:p.ruleId,sourceEventId:context?.sourceEventId});
  }
 });
}
