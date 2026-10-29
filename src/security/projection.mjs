import {EasyPlotsError} from '../contracts/errors.mjs';
const publicKeys=new Set(['publicId','title','description','status','publishedAt','visibleMilestones','availableActions']);
const actionKeys=new Set(['id','label','kind']);
const milestoneKeys=new Set(['id','label','status']);
const forbidden=/secret|hidden|truth|predicate|sourceRef|private|internal|gmOnly|provenance|unseen|canonical/i;
function plain(value) {return value && typeof value==='object' && !Array.isArray(value);}
function allowlisted(value, keys) {
  const result={};
  for(const [key,val] of Object.entries(value ?? {})) {
    if (forbidden.test(key) || !keys.has(key)) continue;
    result[key]=structuredClone(val);
  }
  return result;
}
export function buildPlayerProjection(input, audience) {
  if (audience?.authorized !== true || typeof audience.userId !== 'string') throw new EasyPlotsError('DENIED','Projection authorization required');
  if (!plain(input)) throw new EasyPlotsError('INVALID_PROJECTION','Invalid projection source');
  // The caller must already establish visibility for this record. This function only allowlists; no implicit predicate evaluation.
  if (input.visibility?.includes(audience.userId) !== true && input.visibility?.includes('public') !== true) throw new EasyPlotsError('DENIED','Projection not authorized');
  const result=allowlisted(input,publicKeys);
  if (Array.isArray(result.visibleMilestones)) result.visibleMilestones=result.visibleMilestones
    .filter(m=>m.visibility?.includes(audience.userId) === true || m.visibility?.includes('public') === true)
    .map(m=>allowlisted(m,milestoneKeys));
  if (Array.isArray(result.availableActions)) result.availableActions=result.availableActions.map(a=>allowlisted(a,actionKeys));
  return result;
}
export function genericIntentReceipt(requestId) {
  if(typeof requestId !=='string'||requestId.length>128) throw new EasyPlotsError('INVALID_RECEIPT','Invalid receipt');
  return Object.freeze({publicRequestId:requestId,state:'pending',explanationCode:'REQUEST_RECEIVED'});
}
