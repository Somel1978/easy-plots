/** Proposed continuity manifest from existing historical/live references;
 * preserves source identity and never activates future plots automatically.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
export function prepareContinuityHandoff({sourceArcId,targetArcId,sourceResolutionId,refs=[],maxRefs=48}={}){
 for(const id of [sourceArcId,targetArcId,sourceResolutionId])assertNarrativeId(id);
 if(sourceArcId===targetArcId)fail('CONTINUITY_SELF','A new arc must be distinct from its historical source');
 if(!Array.isArray(refs)||refs.length>maxRefs)fail('CONTINUITY_BUDGET','Reference manifest exceeds bounded scope');
 const seen=new Set(),included=[],dormant=[],unresolved=[];
 for(const ref of refs){
   for(const id of [ref.narrativeId,ref.sourceEventId])assertNarrativeId(id);
   if(seen.has(ref.narrativeId))fail('CONTINUITY_DUPLICATE','Duplicate world reference');seen.add(ref.narrativeId);
   if(!['living-entity','obligation','historical-record','story-hook'].includes(ref.kind))fail('CONTINUITY_KIND','Typed historical reference required');
   if(!['available','missing','stale'].includes(ref.bindingState))fail('CONTINUITY_BINDING','Binding verification required');
   if(!['reference','dormant','skip'].includes(ref.intention))fail('CONTINUITY_INTENTION','Explicit GM planning intention required');
   if(ref.bindingState!=='available'){unresolved.push({narrativeId:ref.narrativeId,reason:ref.bindingState});continue;}
   const record={narrativeId:ref.narrativeId,sourceEventId:ref.sourceEventId,kind:ref.kind,
     status:ref.intention==='reference'?'proposed-reference':'dormant'};
   if(ref.intention==='reference')included.push(record);
   else if(ref.intention==='dormant')dormant.push(record);
 }
 return clone({sourceArcId,targetArcId,sourceResolutionId,proposedReferences:included,dormantHooks:dormant,
   unresolved,requiresGMReview:unresolved.length>0,sourceGraphCopied:false,eventsReplayed:false,
   nextArcActivated:false,committed:false});
}
