/** GM-only cross-plot evaluation against an explicitly verified source plot
 * and the CURRENT authoritative target revision. Indexed links are candidates,
 * never proof that an unrelated plot or hidden faction learned an event.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {routeCrossPlotEvent} from '../domains/crossplot.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
export class GMCrossPlotCoordinator {
 #catalog;#gm;#resolve;
 constructor({catalog,gmProvider,resolveCurrentTarget}={}){
  if(typeof catalog?.lookup!=='function'||typeof gmProvider!=='function'||typeof resolveCurrentTarget!=='function')
    fail('CROSSPLOT_DEPENDENCY','Protected event index, GM authority and canonical target resolver required');
  this.#catalog=catalog;this.#gm=gmProvider;this.#resolve=resolveCurrentTarget;
 }
 async preview({event,verifiedSourcePlotId,knownFactIds=[],approvedScopes=[],maxLinks=48}={}){
  assertLocalGM(this.#gm());assertNarrativeId(event?.id);assertNarrativeId(verifiedSourcePlotId);
  if(!Array.isArray(knownFactIds)||knownFactIds.length>64||!Array.isArray(approvedScopes)||approvedScopes.length>16||
     !Number.isInteger(maxLinks)||maxLinks<1||maxLinks>48)
    fail('CROSSPLOT_BUDGET','Bounded GM source and disclosure scope required');
  knownFactIds.forEach(assertNarrativeId);
  const links=await this.#catalog.lookup(event.eventType);
  if(links.length>maxLinks)fail('CROSSPLOT_BUDGET','Too many indexed dependencies');
  const relevant=[],skipped=[];
  for(const row of links){
    const link=row.link;
    if(link.sourcePlotId!==verifiedSourcePlotId){
      skipped.push({linkId:link.id,reason:'source-plot-mismatch'});continue;
    }
    const current=await this.#resolve(link.targetId,link.scope);
    if(!current||!Number.isSafeInteger(current.revision)||current.revision<1){
      skipped.push({linkId:link.id,reason:'target-unverified'});continue;
    }
    relevant.push({...link,activeRevision:current.revision});
  }
  const routed=routeCrossPlotEvent(event,relevant,{knownFactIds,approvedScopes,maxSubscribers:maxLinks});
  return clone({...routed,verifiedSourcePlotId,skipped:[...skipped,...routed.skipped],
    candidatesChecked:links.length,currentTargetRevisionsChecked:relevant.length,
    canonicalTruthPublished:false,effectsExecuted:0,gmReviewRequired:true});
 }
}
