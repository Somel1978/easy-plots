/** GM-only, bounded session preparation from explicitly supplied current
 * narrative indexes. Never fetches the campaign or invents future events. */
import {EasyPlotsError} from '../contracts/errors.mjs';
export function createSessionBrief({activePlots=[],dueEvents=[],gmPins=[],unresolved=[],maxItems=40}={}){
  const sections={activePlots,dueEvents,gmPins,unresolved};
  for(const [key,list] of Object.entries(sections))if(!Array.isArray(list)||list.length>maxItems)throw new EasyPlotsError('SESSION_BUDGET',`Oversized ${key} index`);
  return {kind:'gm-session-brief',sections:Object.fromEntries(Object.entries(sections).map(([k,v])=>[k,v.map(item=>({referenceId:item.id,
    label:item.gmLabel??item.label??'(untitled)',status:item.status??'unreviewed'}))])),
    reviewed:false,published:false,recap:null};
}
export function authorizeSessionRecap(brief,{gmApproved=false,disclosureIds=[]}={}){
  if(brief?.kind!=='gm-session-brief'||gmApproved!==true)throw new EasyPlotsError('RECAP_APPROVAL','Explicit GM approval required');
  const allowed=new Set(disclosureIds);
  return {kind:'player-recap',items:Object.values(brief.sections).flat().filter(i=>allowed.has(i.referenceId))
    .map(i=>({referenceId:i.referenceId,label:i.label,status:i.status})),gmNotesIncluded:false};
}
