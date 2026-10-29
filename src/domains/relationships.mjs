/** Directional, temporal relationships are kept distinct from observer beliefs. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export function proposeRelationshipTransition(edge,event,{worldTime,maxHistory=64}={}){
  if(typeof edge?.fromId!=='string'||typeof edge?.toId!=='string'||edge.fromId===edge.toId)fail('INVALID_RELATIONSHIP','Distinct directional endpoints required');
  if(typeof event?.id!=='string'||typeof worldTime!=='number'||!Number.isFinite(worldTime))fail('RELATIONSHIP_EVENT','Attributed world-time event required');
  const history=edge.history??[];
  if(!Array.isArray(history)||history.length>=maxHistory)fail('RELATIONSHIP_BUDGET','History requires archived partition');
  if(history.some(h=>h.eventId===event.id))return {status:'duplicate',committed:false};
  const next={...edge,history:[...history,{eventId:event.id,at:worldTime,action:event.action??'update'}]};
  if('trustDelta' in event){if(!Number.isInteger(event.trustDelta)||Math.abs(event.trustDelta)>20)fail('RELATIONSHIP_CHANGE','Invalid trust delta');
    next.trust=(edge.trust??0)+event.trustDelta;}
  // Changes to directional or persona-specific edges do not imply reverse-edge changes.
  return {status:'gm-review',next,fromId:edge.fromId,toId:edge.toId,committed:false};
}
export function observerRelationshipView(edges,{observerId,authorizedDisclosureIds=[],max=64}={}){
  if(typeof observerId!=='string'||!observerId)fail('OBSERVER_REQUIRED','Observer context required');
  if(!Array.isArray(edges)||edges.length>max)fail('RELATIONSHIP_BUDGET','Bounded view required');
  const allowed=new Set(authorizedDisclosureIds);
  return edges.filter(e=>e.observerId===observerId&&allowed.has(e.disclosureId))
    .map(e=>({fromId:e.publicFromId,toId:e.publicToId,stance:e.believedStance??'unknown',status:e.beliefStatus??'unverified'}));
}
export function proposeObligationSettlement(obligation,{eventId,debtorId,creditorId}={}){
  if(!obligation||typeof eventId!=='string'||!eventId||obligation.debtorId!==debtorId||obligation.creditorId!==creditorId)
    fail('OBLIGATION_CONTEXT','Explicit directional obligation and resolving event required');
  if(obligation.state!=='outstanding')return {status:'not-outstanding',committed:false};
  return {status:'gm-review',proposedState:'fulfilled',obligationId:obligation.id,sourceEventId:eventId,committed:false};
}
