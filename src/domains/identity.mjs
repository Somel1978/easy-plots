/** Canonical entities, public personas, and observer-specific alias knowledge. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export function proposeIdentityLink({entityId,personaId,sourceEventId,confidence,relationship='persona-of'}={}){
  if(![entityId,personaId,sourceEventId].every(v=>typeof v==='string'&&v.length>0)||!['persona-of','alias-of','successor-of'].includes(relationship))
    fail('IDENTITY_LINK','Typed provenance-linked identity relation required');
  if(entityId===personaId)fail('IDENTITY_CYCLE','Cannot link identity to itself');
  if(confidence!==undefined&&(!Number.isFinite(confidence)||confidence<0||confidence>1))fail('IDENTITY_CONFIDENCE','Confidence must be bounded');
  return {entityId,personaId,relationship,sourceEventId,confidence:confidence??null,status:'gm-review',committed:false,
    // No automatic reputation, debt, or observer-knowledge merge.
    transferStanding:false,transferObligations:false,discloseToPlayers:false};
}
export function projectObserverAliases(aliases,{observerId,authorizedDisclosureIds=[],max=64}={}){
  if(typeof observerId!=='string'||!observerId||!Array.isArray(aliases)||aliases.length>max)fail('IDENTITY_BUDGET','Bounded authorized observer projection required');
  const allowed=new Set(authorizedDisclosureIds);
  return aliases.filter(a=>a.observerId===observerId&&allowed.has(a.disclosureId))
    .map(a=>({personaPublicId:a.personaPublicId,publicName:a.publicName,status:a.status??'reported'}));
}
export function assessIdentityMerge({primary,duplicate,linkedObligationIds=[],maxLinked=64}={}){
  if(!primary?.id||!duplicate?.id||primary.id===duplicate.id||linkedObligationIds.length>maxLinked)fail('IDENTITY_MERGE','Distinct identities and bounded reference list required');
  return {survivorId:primary.id,duplicateId:duplicate.id,obligationsRequiringReview:linkedObligationIds.slice(),
    status:'gm-approval-required',automaticDeletion:false,committed:false};
}
