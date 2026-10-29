/** One-time, evidence-linked GM-authorized milestone qualification record.
 * Qualification does not close the parent quest or disclose hidden knowledge.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('INVALID_MILESTONE','Milestone payload must be a record');
  if(typeof input.milestoneId!=='string'||!/^ep:milestone:[a-zA-Z0-9_-]{3,120}$/.test(input.milestoneId))fail('INVALID_MILESTONE','Stable milestone identity is required');
  if(input.subjectId!==undefined&&(typeof input.subjectId!=='string'||input.subjectId.length>128||(input.subjectId!=='party'&&!/^ep:[a-z][a-z0-9-]*:[a-zA-Z0-9_-]+$/.test(input.subjectId))))
    fail('INVALID_MILESTONE','Optional subject ID must be a stable narrative ID');
  return {milestoneId:input.milestoneId,subjectId:input.subjectId??'party'};
}
export async function milestoneLocator(payload){
  const data=validate(payload);const hash=await sha256Hex(`${data.milestoneId}|${data.subjectId}`);
  return {id:`ep:milestone:${hash.slice(0,24)}`,partitionId:`milestones:${hash.slice(0,2)}`};
}
export function createMilestoneProvider({repository,gmProvider}={}){
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function')fail('INVALID_PROVIDER','Milestone provider needs protected repository');
  const gm=()=>{const context=gmProvider();assertLocalGM(context);return context;};
  const get=async payload=>{
    const l=await milestoneLocator(payload),row=await repository.read(l.id,{partitionId:l.partitionId,gm:gm()});
    if(row&&(!['milestone-qualified'].includes(row.kind)||row.id!==l.id))fail('MILESTONE_CORRUPT','Milestone record mismatch');
    if(row&&typeof repository.hasReadyIndex==='function'&&!(await repository.hasReadyIndex(l.id,{partitionId:l.partitionId,gm:gm()})))fail('INDEX_UNCERTAIN','Milestone index needs recovery');
    return row;
  };
  return Object.freeze({
    id:'narrative.qualify-milestone',version:'1.0.0',validate,get,
    async apply(payload,{operationId,sourceEventId}={}){
      gm();const input=validate(payload);
      if(typeof operationId!=='string'||!operationId.startsWith('ep:operation:')||
        typeof sourceEventId!=='string'||!sourceEventId.startsWith('ep:event:'))fail('INVALID_MILESTONE','Journaled operation and verified source event required');
      const loc=await milestoneLocator(input),old=await get(input);
      if(old){
        if(old.operationId===operationId&&old.sourceEventId===sourceEventId)return {recordId:loc.id,alreadyQualified:true};
        fail('MILESTONE_ALREADY_QUALIFIED','One-time milestone is already qualified; do not repeat rewards');
      }
      await repository.put({...loc,kind:'milestone-qualified',...input,operationId,sourceEventId,status:'qualified'},
        {expectedRevision:null,gm:gm()});
      return {recordId:loc.id};
    },
    async verify(payload,{operationId,sourceEventId}={}){
      const row=await get(payload);
      return Boolean(row&&row.operationId===operationId&&row.sourceEventId===sourceEventId&&row.status==='qualified');
    }
  });
}
