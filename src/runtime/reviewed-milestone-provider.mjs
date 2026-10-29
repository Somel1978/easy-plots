/** A GM-approved graph effect can finalize a verified, evidence-linked
 * investigation milestone only after its dedicated immutable contract has
 * qualified. This provider never awards XP or exposes secret milestone counts.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export const REVIEWED_MILESTONE_PROVIDER='narrative.complete-investigation-milestone';
export function validateReviewedMilestonePayload(p){
 if(!p||typeof p!=='object'||Array.isArray(p))fail('MILESTONE_PAYLOAD','Typed milestone contract required');
 if(Object.keys(p).some(k=>!['scope','milestoneId','expectedContractRevision','expectedProgressRevision'].includes(k)))
  fail('MILESTONE_PAYLOAD','Hidden or unsupported milestone fields must not be persisted');
 assertNarrativeId(p.milestoneId);
 if(typeof p.scope!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(p.scope)||
  !Number.isSafeInteger(p.expectedContractRevision)||p.expectedContractRevision<1||
  !Number.isSafeInteger(p.expectedProgressRevision)||p.expectedProgressRevision<1)
  fail('MILESTONE_PAYLOAD','Explicit scope and current expected revisions required');
 return p;
}
export function createReviewedMilestoneProvider({service,gmProvider}={}){
 if(typeof service?.complete!=='function'||typeof service?.assess!=='function'||typeof gmProvider!=='function')
  fail('MILESTONE_DEPENDENCY','Protected milestone service and GM authority required');
 const gm=()=>{const ctx=gmProvider();assertLocalGM(ctx);return ctx;};
 const get=async p=>{gm();validateReviewedMilestonePayload(p);return service.assess({scope:p.scope,milestoneId:p.milestoneId});};
 return Object.freeze({id:REVIEWED_MILESTONE_PROVIDER,version:'1.0.0',validate:validateReviewedMilestonePayload,get,
  async apply(payload,ctx){gm();const p=validateReviewedMilestonePayload(payload);
   for(const id of [ctx?.sourceEventId,ctx?.operationId])assertNarrativeId(id);
   const status=await service.assess({scope:p.scope,milestoneId:p.milestoneId});
   if(status.completed){
    const row=await service.readCompletion({scope:p.scope,milestoneId:p.milestoneId});
    if(row?.data?.operationId===ctx.operationId&&row.data.approvalEventId===ctx.sourceEventId)
     return {recordId:p.milestoneId,alreadyApplied:true};
    fail('MILESTONE_COMPLETED','One-time milestone already completed by another operation');
   }
   const row=await service.complete({scope:p.scope,milestoneId:p.milestoneId,
    expectedContractRevision:p.expectedContractRevision,expectedProgressRevision:p.expectedProgressRevision,
    reviewEventId:ctx.sourceEventId,operationId:ctx.operationId});
   return {recordId:p.milestoneId,revision:row.revision};
  },
  async verify(payload,ctx){gm();const p=validateReviewedMilestonePayload(payload);
   const row=await service.readCompletion({scope:p.scope,milestoneId:p.milestoneId});
   return Boolean(row?.data?.operationId===ctx?.operationId&&row.data.approvalEventId===ctx?.sourceEventId&&
    row.data.contractRevision===p.expectedContractRevision&&row.data.progressRevision===p.expectedProgressRevision);
  }
 });
}
