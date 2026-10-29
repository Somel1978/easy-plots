import {EasyPlotsError} from '../contracts/errors.mjs';
/** Legacy availability remains a gate; new recorded disclosure times prevent
 * retroactively treating a claim as known before it was actually disclosed. */
export function receiptKnowledgeTime(data){
 const finite=value=>Number.isFinite(value)&&value>=0;
 if(!finite(data?.availableAt))throw new EasyPlotsError('KNOWLEDGE_TIME','Verified receipt availability required');
 if(data.disclosedAt===undefined&&data.knowledgeAt===undefined)return data.availableAt;
 if(!finite(data.disclosedAt)||!finite(data.knowledgeAt)||data.knowledgeAt!==Math.max(data.disclosedAt,data.availableAt))throw new EasyPlotsError('KNOWLEDGE_TIME','Receipt disclosure time is inconsistent');
 return data.knowledgeAt;
}
/** Truth, observer beliefs and disclosure events are separate stores with no implied propagation. */
export function visibleClaims(claims,{observerId,authorizedSources=[],max=50}) {
  if(typeof observerId!=='string')throw new EasyPlotsError('DENIED','Observer context required');
  if(claims.length>max)throw new EasyPlotsError('KNOWLEDGE_BUDGET','Knowledge query exceeds limit');
  const allowed=new Set(authorizedSources);
  return claims.filter(c=>c.observerId===observerId&&allowed.has(c.disclosureId))
    .map(c=>({claimId:c.publicId,text:c.text,confidence:c.confidence??'unrated',status:c.status??'unverified'}));
}
