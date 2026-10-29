/** Durable graph-reviewed disclosure of ONE planned knowledge recipient.
 * The client cannot provide claims, text or recipient lists via this effect.
 * Its only input is a GM-authored stable plan & explicit observer identity.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
export const REVIEWED_KNOWLEDGE_PROVIDER='narrative.approve-knowledge-recipient';
export function validateReviewedKnowledgePayload(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('KNOWLEDGE_EFFECT','Typed planned disclosure required');
 const fields=new Set(['scope','planId','recipientId','expectedPlanRevision','worldTime']);
 if(Object.keys(value).some(k=>!fields.has(k)))fail('KNOWLEDGE_EFFECT','Unrecognized or protected disclosure field');
 if(typeof value.scope!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(value.scope))fail('KNOWLEDGE_EFFECT','Bounded scope required');
 for(const field of ['planId','recipientId'])assertNarrativeId(value[field]);
 if(!Number.isSafeInteger(value.expectedPlanRevision)||value.expectedPlanRevision<1||
    !Number.isFinite(value.worldTime)||value.worldTime<0||value.worldTime>1e12)
   fail('KNOWLEDGE_EFFECT','Plan revision and bounded world time required');
 return structuredClone(value);
}
export function createReviewedKnowledgeProvider({service,gmProvider}={}){
 if(typeof service?.approveRecipient!=='function'||typeof service?.verifyRecipient!=='function'||typeof gmProvider!=='function')
  fail('KNOWLEDGE_PROVIDER','Protected knowledge propagation service and GM required');
 const gm=()=>{const g=gmProvider();assertLocalGM(g);return g;};
 return Object.freeze({id:REVIEWED_KNOWLEDGE_PROVIDER,version:'1.0.0',validate:validateReviewedKnowledgePayload,
  async apply(payload,context){gm();const p=validateReviewedKnowledgePayload(payload);
   assertNarrativeId(context?.sourceEventId);assertNarrativeId(context?.operationId);
   const record=await service.approveRecipient({scope:p.scope,planId:p.planId,recipientId:p.recipientId,
    expectedPlanRevision:p.expectedPlanRevision,worldTime:p.worldTime,
    approvalEventId:context.sourceEventId,approved:true});
   return {recordId:record.id,revision:record.revision};
  },
  async verify(payload,context){gm();const p=validateReviewedKnowledgePayload(payload);
   return service.verifyRecipient({scope:p.scope,planId:p.planId,recipientId:p.recipientId,
     approvalEventId:context?.sourceEventId});
  }
 });
}
