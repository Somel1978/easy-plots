/** Journaled narrative hypothesis review provider. No truth oracle and no
 * client-supplied causal identity; sourceEventId comes from effect context.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
export const REVIEWED_HYPOTHESIS_PROVIDER='narrative.review-investigation-hypothesis';
export function validateReviewedHypothesisPayload(p){
 if(!p||typeof p!=='object'||Array.isArray(p))fail('HYPOTHESIS_PAYLOAD','Typed hypothesis required');
 const fields=new Set(['scope','investigationId','hypothesisId','observerId','expectedRevision','title','reasoning','arguments','shareWith']);
 if(Object.keys(p).some(x=>!fields.has(x)))fail('HYPOTHESIS_PAYLOAD','Unrecognized or protected field');
 for(const key of ['investigationId','hypothesisId','observerId'])assertNarrativeId(p[key]);
 if(typeof p.scope!=='string'||!/^[a-z][a-z0-9-]{0,45}$/.test(p.scope)||
    !Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<1||
    typeof p.title!=='string'||p.title.length<1||p.title.length>140||
    typeof p.reasoning!=='string'||p.reasoning.length>900||
    !Array.isArray(p.arguments)||p.arguments.length>24||!Array.isArray(p.shareWith)||p.shareWith.length>16)
  fail('HYPOTHESIS_PAYLOAD','Bounded author, revision and reasoning required');
 const seen=new Set();for(const item of p.arguments){assertNarrativeId(item?.evidenceId);
  if(!['support','contradict'].includes(item.direction)||seen.has(item.evidenceId)||Object.keys(item).some(k=>!['evidenceId','direction'].includes(k)))
   fail('HYPOTHESIS_PAYLOAD','Unique allowed argument fields required');seen.add(item.evidenceId);
 }
 p.shareWith.forEach(assertNarrativeId);
 if(new Set(p.shareWith).size!==p.shareWith.length)fail('HYPOTHESIS_PAYLOAD','Duplicate audience');
 if(new TextEncoder().encode(JSON.stringify(p)).length>2048)fail('HYPOTHESIS_BUDGET','Hypothesis payload too large');
 return p;
}
export function createReviewedHypothesisProvider({workbench,gmProvider}={}){
 if(typeof workbench?.recordReviewedHypothesis!=='function'||typeof workbench?.read!=='function'||typeof gmProvider!=='function')
  fail('HYPOTHESIS_DEPENDENCY','GM-only investigation workbench and authority required');
 const gm=()=>{const ctx=gmProvider();assertLocalGM(ctx);return ctx;};
 const get=async p=>{const row=await workbench.read({scope:p.scope,investigationId:p.investigationId});
  return row?.data?.theories?.find(t=>t.id===p.hypothesisId)??null;};
 return Object.freeze({id:REVIEWED_HYPOTHESIS_PROVIDER,version:'1.0.0',validate:validateReviewedHypothesisPayload,get,
  async apply(payload,ctx){gm();const p=validateReviewedHypothesisPayload(payload);
   assertNarrativeId(ctx?.sourceEventId);assertNarrativeId(ctx?.operationId);
   const row=await workbench.recordReviewedHypothesis({...p,sourceEventId:ctx.sourceEventId,operationId:ctx.operationId});
   return {recordId:row.id,revision:row.revision};
  },
  async verify(payload,ctx){gm();const p=validateReviewedHypothesisPayload(payload);const theory=await get(p);
   return Boolean(theory&&theory.sourceEventId===ctx?.sourceEventId&&theory.operationId===ctx?.operationId&&
    theory.id===p.hypothesisId&&theory.ownerId===p.observerId);
  }
 });
}
