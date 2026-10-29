/** Multi-dimensional arc-closure planner. No automatic effects or disclosures.
 * Historical closure, living world references, and dormant hooks have separate lifecycles.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const allowedStatuses=new Set(['completed','failed','abandoned','suspended','active','unresolved']);
const allowedDisposition=new Set(['continue','dormant','suspend','closed','gm-review']);
const MAX=64;
function verifyFacets(worldFacets){
 if(!worldFacets||typeof worldFacets!=='object'||Array.isArray(worldFacets)||Object.keys(worldFacets).length>48)
   fail('ARC_FACETS','Bounded established outcome facets required');
 for(const [key,value] of Object.entries(worldFacets)){
  if(!/^[a-z][a-z0-9-]{0,47}$/.test(key)||!['string','boolean','number'].includes(typeof value)||
    (typeof value==='number'&&!Number.isFinite(value)))fail('ARC_FACETS','Invalid immutable facet value');
 }
}
export function planCampaignClosure({arcId,arcRevision,endingContracts=[],worldFacets={},objectives=[],
  unresolvedThreads=[],worldTime,max=MAX}={}){
 assertNarrativeId(arcId);if(!Number.isSafeInteger(arcRevision)||arcRevision<1)fail('ARC_REVISION','Valid published arc revision required');
 verifyFacets(worldFacets);
 if(!Array.isArray(endingContracts)||!Array.isArray(objectives)||!Array.isArray(unresolvedThreads)||
 endingContracts.length>max||objectives.length>max||unresolvedThreads.length>max||!Number.isFinite(worldTime)||worldTime<0)
   fail('ARC_BUDGET','Bounded arc closure scope and world time required');
 const endingIds=new Set(),eligible=[],unknown=[],rejected=[];
 for(const ending of endingContracts){
  assertNarrativeId(ending.id);if(endingIds.has(ending.id))fail('ARC_DUPLICATE','Duplicate ending');endingIds.add(ending.id);
  verifyFacets(ending.requiredFacets??{});
  if(ending.exclusiveGroup!==undefined&&typeof ending.exclusiveGroup!=='string')fail('ARC_GROUP','Invalid ending exclusivity');
  const missing=Object.keys(ending.requiredFacets??{}).filter(key=>!Object.hasOwn(worldFacets,key));
  if(missing.length){unknown.push({endingId:ending.id,missingFacets:missing});continue;}
  if(Object.entries(ending.requiredFacets??{}).some(([key,value])=>worldFacets[key]!==value)){
   rejected.push({endingId:ending.id,reason:'facets-not-satisfied'});continue;
  }
  eligible.push({endingId:ending.id,exclusiveGroup:ending.exclusiveGroup??null,
    requiresApproval:ending.approvalPolicy!=='published-rule'});
 }
 const groups=new Map();for(const ending of eligible){if(!ending.exclusiveGroup)continue;
  const list=groups.get(ending.exclusiveGroup)??[];list.push(ending.endingId);groups.set(ending.exclusiveGroup,list);
 }
 const conflicts=[...groups].filter(([,ids])=>ids.length>1).map(([group,endingIds])=>({group,endingIds}));
 const objectiveIds=new Set(),objectiveResults=[];
 for(const objective of objectives){assertNarrativeId(objective.id);
  if(objectiveIds.has(objective.id)||!allowedStatuses.has(objective.status))fail('ARC_OBJECTIVE','Unique typed objective required');
  objectiveIds.add(objective.id);
  objectiveResults.push({objectiveId:objective.id,status:objective.status,
    completed:objective.status==='completed',requiresReview:['active','unresolved','suspended'].includes(objective.status)});
 }
 const hooks=new Set(),continuing=[];
 for(const thread of unresolvedThreads){assertNarrativeId(thread.id);assertNarrativeId(thread.sourceEventId);
  if(hooks.has(thread.id)||!allowedDisposition.has(thread.disposition??'gm-review'))fail('ARC_THREAD','Duplicate/invalid unresolved thread');
  hooks.add(thread.id);
  continuing.push({threadId:thread.id,sourceEventId:thread.sourceEventId,disposition:thread.disposition??'gm-review',
    // Explicitly prevent hidden hooks from appearing as automatically active sequels.
    activated:false});
 }
 const status=conflicts.length?'conflict-review':!eligible.length?'no-established-ending':unknown.length?'incomplete-coverage':'gm-finalization-review';
 return {arcId,arcRevision,worldTime,eligible,unknown,rejected,conflicts,objectiveResults,unresolvedThreads:continuing,
   historicalSnapshot:{arcId,sourceRevision:arcRevision,facets:clone(worldFacets),worldTime},
   status,committed:false,autoClosedObjectives:false,autoActivatedHooks:false,epiloguePublished:false};
}
/** Only a GM-approved, explicitly selected eligible ending can be prepared.
 * This is a transaction input, NOT execution or publication.
 */
export function prepareClosureDecision(plan,{endingId,gmApprovalId,currentArcRevision}={}){
 assertNarrativeId(endingId);assertNarrativeId(gmApprovalId);
 if(currentArcRevision!==plan?.arcRevision)fail('REVISION_CONFLICT','Arc changed during review');
 if(plan.conflicts?.length)fail('ARC_CONFLICT','Exclusive endings require explicit reconciliation');
 if(!plan.eligible?.some(e=>e.endingId===endingId))fail('ARC_NOT_ELIGIBLE','Ending is not eligible');
 // An unresolved alternative in the same exclusive group may be eligible;
 // refuse to finalize before the GM establishes its missing prerequisites.
 if(plan.unknown?.length)fail('ARC_COVERAGE','Unverified ending prerequisites require explicit reconciliation');
 return {arcId:plan.arcId,sourceRevision:plan.arcRevision,endingId,gmApprovalId,
   resolutionSnapshot:clone(plan.historicalSnapshot),unresolvedThreadIds:plan.unresolvedThreads.map(t=>t.threadId),
   state:'approved-pending-commit',committed:false};
}
