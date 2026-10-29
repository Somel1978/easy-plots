/** Focus-scoped GM cockpit data. Never enumerates all world graphs or journals. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export async function buildGMFocusSnapshot({graphId,registry,ledger=null,gmProvider,eventIds=[],maxEvents=12,appearanceReader=null}={}){
  assertNarrativeId(graphId);
  if(!graphId.startsWith('ep:graph:')||typeof registry?.getDraft!=='function'||typeof registry?.getActivation!=='function'||typeof gmProvider!=='function')
    fail('INVALID_FOCUS','A GM-scoped narrative graph registry and authority are required');
  const gm=gmProvider();assertLocalGM(gm);
  if(!Array.isArray(eventIds)||eventIds.length>maxEvents)fail('FOCUS_BUDGET','Only explicitly scoped recent event IDs may be loaded');
  const [draft,activation]=await Promise.all([registry.getDraft(graphId),registry.getActivation(graphId)]);
  const published=activation?.active?await registry.getActive(graphId):null;
  const appearance=published&&typeof appearanceReader==='function'?await appearanceReader(graphId):null;
  if(appearance&&appearance.publishedVersion!==published.publishedVersion)fail('APPEARANCE_STALE','Live appearance changed during focused view loading');
  const rows=[];
  if(eventIds.length&&!ledger?.get)fail('LEDGER_UNAVAILABLE','Scoped event lookup requires a ledger');
  for(const id of [...new Set(eventIds)]){
    assertNarrativeId(id);const entry=await ledger.get(id);
    if(!entry||!(entry.evaluations??[]).some(e=>e.graphId===graphId||(e.trace??[]).some(t=>t.graphId===graphId)))continue;
    rows.push({id:entry.sourceEventId,eventType:entry.event?.eventType??'',state:entry.state,
      proposalCount:entry.proposals?.filter(p=>p.graphId===graphId).length??0});
  }
  return Object.freeze({kind:'gm-focused-cockpit',graphId,title:appearance?.appearance.title??draft?.title??published?.title??graphId,
    draftRevision:draft?.revision??null,publishedVersion:published?.publishedVersion??null,
    active:Boolean(activation?.active&&published),nodeCount:published?.nodes.length??draft?.nodes.length??0,
    events:rows,requiresReview:rows.filter(e=>e.state==='review-required').length,
    // This payload is GM-only. No player transport or broadcast consumer exists.
    scope:'gm-only'});
}
