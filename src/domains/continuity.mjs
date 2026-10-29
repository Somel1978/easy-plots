/** Historical arc closure is immutable; living world pointers and dormant future
 * hooks are independent. A manifest is an authored reference set, never a copy. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export function buildContinuityManifest({sourceArcId,resolutionRevision,refs=[],hooks=[],max=96}={}){
  if(typeof sourceArcId!=='string'||!Number.isInteger(resolutionRevision)||resolutionRevision<1)fail('CONTINUITY_SOURCE','Concluded arc revision required');
  if(!Array.isArray(refs)||!Array.isArray(hooks)||refs.length+hooks.length>max)fail('CONTINUITY_BUDGET','Bounded reference set required');
  const ids=new Set(),references=[];
  for(const ref of refs){
    if(typeof ref?.entityId!=='string'||!ref.entityId.startsWith('ep:'))fail('CONTINUITY_REFERENCE','Stable narrative entity reference required');
    if(ids.has(ref.entityId))fail('CONTINUITY_DUPLICATE','Duplicate reference');ids.add(ref.entityId);
    references.push({entityId:ref.entityId,originArcId:sourceArcId,ownership:ref.ownership??'borrowed',visibility:ref.visibility??'gm-only'});
  }
  const dormantHooks=hooks.map(h=>{
    if(typeof h?.hookId!=='string'||typeof h?.sourceEventId!=='string')fail('CONTINUITY_HOOK','Hook provenance required');
    return {hookId:h.hookId,sourceEventId:h.sourceEventId,status:'dormant',activationPolicy:h.activationPolicy??'gm-approval'};
  });
  return {sourceArcId,resolutionRevision,references,dormantHooks,version:1,committed:false};
}
export function assessContinuityBinding(ref,{currentEntity,expectedRevision}={}){
  if(!ref?.entityId||!currentEntity)return {status:'missing-reference',candidate:null};
  if(currentEntity.id!==ref.entityId)return {status:'identity-mismatch',candidate:null};
  if(expectedRevision!==undefined&&currentEntity.revision!==expectedRevision)return {status:'revision-review',candidate:ref.entityId};
  return {status:'bound-existing-entity',candidate:ref.entityId};
}
