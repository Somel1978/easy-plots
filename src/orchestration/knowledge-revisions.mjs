/** GM-only belief correction plan with historical provenance and dependency
 * invalidation. This does not broadcast corrections or rewrite beliefs.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
export function planBeliefReconciliation({correction,observerClaims=[],dependencyLinks=[],
  maxObservers=64,maxLinks=128}={}){
 for(const field of ['eventId','claimId','sourceId'])assertNarrativeId(correction?.[field]);
 if(!['retracted','superseded','contested','confirmed'].includes(correction.kind))fail('BELIEF_CORRECTION','Supported correction kind required');
 if(!Array.isArray(observerClaims)||observerClaims.length>maxObservers||
   !Array.isArray(dependencyLinks)||dependencyLinks.length>maxLinks)
  fail('BELIEF_BUDGET','Bounded scoped observer/dependency records required');
 const seen=new Set(),affected=[],pending=[];
 for(const row of observerClaims){
  assertNarrativeId(row.observerId);assertNarrativeId(row.claimId);assertNarrativeId(row.disclosureEventId);
  if(row.claimId!==correction.claimId)continue;
  if(seen.has(row.observerId))fail('BELIEF_DUPLICATE','Duplicate observer claim view');
  seen.add(row.observerId);
  if(row.disclosureAuthorized!==true){pending.push({observerId:row.observerId,reason:'unauthorized-source-record'});continue;}
  const proposal={observerId:row.observerId,claimId:correction.claimId,
   historicalDisclosureEventId:row.disclosureEventId,sourceCorrectionEventId:correction.eventId,
   priorStance:row.stance??'unverified',proposedStatus:correction.kind,
   status:'requires-gm-review',committed:false};
  affected.push(proposal);
 }
 const invalidations=[];const visited=new Set();
 for(const link of dependencyLinks){
  assertNarrativeId(link.id);assertNarrativeId(link.claimId);assertNarrativeId(link.dependentId);
  if(link.claimId!==correction.claimId)continue;
  if(visited.has(link.dependentId))continue;visited.add(link.dependentId);
  invalidations.push({dependentId:link.dependentId,reason:'revalidate-after-correction',
    sourceCorrectionEventId:correction.eventId,automaticEffect:false});
 }
 return {claimId:correction.claimId,correctionEventId:correction.eventId,
   observerUpdates:clone(affected),pending:clone(pending),dependencyInvalidations:clone(invalidations),
   historicalClaimsPreserved:true,automaticPropagation:false,automaticEffects:false,committed:false};
}
