/** GM review-only resource integrity and rebinding. The authored world is never
 * modified by a diagnostic or suggested candidate; foreign assets are untouched.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const owned=new Set(['borrowed','shared','exclusive','detached']);
const MAX=128;
export function auditResourceReferences({resources=[],bindings=[],knownNarrativeIds=[],max=MAX}={}){
 if(!Array.isArray(resources)||!Array.isArray(bindings)||!Array.isArray(knownNarrativeIds)||
 resources.length>max||bindings.length>max*2||knownNarrativeIds.length>max*2)
   fail('RESOURCE_BUDGET','Bounded scoped resources and references required');
 const known=new Set(knownNarrativeIds);knownNarrativeIds.forEach(assertNarrativeId);
 const documents=new Map();const byNative=new Map(),findings=[];
 for(const resource of resources){
  assertNarrativeId(resource.narrativeId);
  if(documents.has(resource.narrativeId)||!owned.has(resource.ownership))fail('RESOURCE_CONTRACT','Duplicate entity or invalid ownership');
  if(resource.nativeUuid!==null&&resource.nativeUuid!==undefined&&typeof resource.nativeUuid!=='string')fail('RESOURCE_UUID','Malformed native UUID');
  documents.set(resource.narrativeId,resource);
  if(resource.nativeUuid){const refs=byNative.get(resource.nativeUuid)??[];refs.push(resource.narrativeId);byNative.set(resource.nativeUuid,refs);}
 }
 for(const binding of bindings){assertNarrativeId(binding.sourceId);assertNarrativeId(binding.targetId);
  if(!known.has(binding.sourceId))findings.push({kind:'unverified-source',sourceId:binding.sourceId,targetId:binding.targetId});
  if(!documents.has(binding.targetId)&&!known.has(binding.targetId))findings.push({kind:'unresolved-reference',sourceId:binding.sourceId,targetId:binding.targetId});
 }
 for(const resource of resources){
  if(resource.exists===false)findings.push({kind:'missing-native-document',narrativeId:resource.narrativeId});
  if(resource.provenanceRevision!==undefined&&resource.nativeRevision!==undefined&&resource.provenanceRevision!==resource.nativeRevision)
    findings.push({kind:'revision-drift',narrativeId:resource.narrativeId});
 }
 for(const [uuid,ids] of byNative)if(ids.length>1)findings.push({kind:'shared-native-binding',nativeUuid:uuid,narrativeIds:ids.slice()});
 return {findings:clone(findings),inspectedResources:resources.length,inspectedBindings:bindings.length,
   status:'gm-review',deletionsProposed:0,committed:false};
}
/** A rebind proposal requires an actual native candidate from an independently
 * verified indexed lookup; it never chooses a similar name automatically. */
export function proposeGuidedRebind({reference,candidates=[],selectedNativeUuid,
 currentRevision,reviewEventId,maxCandidates=12}={}){
 assertNarrativeId(reference?.narrativeId);assertNarrativeId(reviewEventId);
 if(!Number.isSafeInteger(currentRevision)||currentRevision<1||reference.revision!==currentRevision)
   fail('REVISION_CONFLICT','Narrative reference revision changed');
 if(!Array.isArray(candidates)||candidates.length>maxCandidates)fail('RESOURCE_BUDGET','Bounded verified candidate list required');
 const matching=candidates.filter(c=>c.nativeUuid===selectedNativeUuid&&c.verified===true);
 if(matching.length!==1||typeof selectedNativeUuid!=='string'||!selectedNativeUuid)
   fail('RESOURCE_REVIEW','GM must choose a verified, unique candidate');
 if(reference.ownership==='detached')fail('RESOURCE_DETACHED','Detached resources need a separate ownership decision');
 return {narrativeId:reference.narrativeId,oldNativeUuid:reference.nativeUuid??null,
   proposedNativeUuid:selectedNativeUuid,sourceRevision:reference.revision,reviewEventId,
   historicalIdPreserved:true,deleteOldDocument:false,status:'gm-approved-rebind-proposal',committed:false};
}
/** Protect nonexclusive and historically referenced native resources from
 * automatic cleanup even when no local graph currently references them. */
export function proposeResourceRetirement({resource,reverseReferences=[],sourceEventId,maxRefs=64}={}){
 assertNarrativeId(resource?.narrativeId);assertNarrativeId(sourceEventId);
 if(!owned.has(resource.ownership)||!Array.isArray(reverseReferences)||reverseReferences.length>maxRefs)
   fail('RESOURCE_CONTRACT','Owned resource and bounded reverse references required');
 reverseReferences.forEach(assertNarrativeId);
 const deletable=false; // GM review can propose native cleanup separately; not here.
 const requiresReview=resource.ownership!=='exclusive'||reverseReferences.length>0||resource.protectedEdits===true;
 return {narrativeId:resource.narrativeId,status:'gm-review',requiresReview,
   potentialOrphan:reverseReferences.length===0,deleteNativeDocument:deletable,committed:false};
}
