/** Construct a complete player-safe investigation board from GM-authorized
 * evidence and disclosed hypothesis records. This is an allowlist projection:
 * no hidden counts, canonical truth or GM provenance cross the boundary.
 * The projection MUST be built before transmission, on the eligible GM client.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const TITLE_MAX=140, DESC_MAX=900;
const validText=(v,max)=>typeof v==='string'&&v.length<=max;
const visible=(row,observer)=>Array.isArray(row?.disclosedTo)&&
  (row.disclosedTo.includes(observer)||row.disclosedTo.includes('public'));
const safeText=(v,max)=>validText(v,max)?v:'';
const toView=(item,fields)=>Object.fromEntries(fields.filter(k=>Object.hasOwn(item,k)).map(k=>[k,item[k]]));
export function createInvestigationBoardProjection({investigationId,title,evidence=[],theories=[],opportunities=[]},
  {observerId,authorizedEvidenceIds=[],authorizedOpportunityIds=[],maxEvidence=48,maxTheories=24,maxOpportunities=12}={}){
  assertNarrativeId(investigationId);assertNarrativeId(observerId);
  if(!validText(title,TITLE_MAX))fail('INVALID_BOARD','Bounded investigation title required');
  if(!Array.isArray(evidence)||!Array.isArray(theories)||!Array.isArray(opportunities)||
    evidence.length>maxEvidence||theories.length>maxTheories||opportunities.length>maxOpportunities)
    fail('BOARD_BUDGET','A bounded, scoped knowledge set is required');
  const allowedEvidence=new Set(authorizedEvidenceIds);
  const visibleEvidence=evidence.filter(e=>allowedEvidence.has(e.id)&&visible(e,observerId))
    .map(e=>{
      assertNarrativeId(e.id);
      const evidenceId=e.publicId??e.id;
      assertNarrativeId(evidenceId);
      return {id:evidenceId,title:safeText(e.publicTitle??e.title,TITLE_MAX),
        description:safeText(e.publicSummary??e.summary,DESC_MAX),
        ...(typeof e.discoveredAt==='number'&&Number.isFinite(e.discoveredAt)?{discoveredAt:e.discoveredAt}:{})};
    });
  const evidenceMap=new Map(evidence.filter(e=>allowedEvidence.has(e.id)&&visible(e,observerId))
    .map(e=>[e.id,e.publicId??e.id]));
  const visibleEvidenceIds=new Set(visibleEvidence.map(e=>e.id));
  if(visibleEvidenceIds.size!==visibleEvidence.length)fail('BOARD_PUBLIC_ID_CONFLICT','Visible evidence references must be unique');
  const visibleTheories=theories.filter(t=>t.reviewStatus!=='superseded'&&visible(t,observerId)&&
    (t.ownerId===observerId||t.reviewedFor?.includes(observerId)||t.reviewedFor?.includes('public')))
    .map(t=>{
      assertNarrativeId(t.id);
      const cited=(t.arguments??[]).filter(a=>evidenceMap.has(a.evidenceId)&&['support','contradict'].includes(a.direction));
      if(cited.length>maxEvidence)fail('BOARD_BUDGET','Theory argument list exceeds bound');
      return {id:t.publicId??t.id,title:safeText(t.publicTitle??t.title,TITLE_MAX),
        reasoning:safeText(t.publicReasoning??t.reasoning,DESC_MAX),
        supportEvidenceIds:cited.filter(a=>a.direction==='support').map(a=>evidenceMap.get(a.evidenceId)),
        contradictionEvidenceIds:cited.filter(a=>a.direction==='contradict').map(a=>evidenceMap.get(a.evidenceId)),
        assessment:cited.some(a=>a.direction==='contradict')?'contested':cited.length?'argued':'unresolved'};
    });
  const allowedOpportunities=new Set(authorizedOpportunityIds);
  const actions=opportunities.filter(a=>allowedOpportunities.has(a.id)&&visible(a,observerId)&&a.currentlyAvailable===true)
    .map(a=>{
      assertNarrativeId(a.id);
      return {opportunityId:a.publicId??a.id,label:safeText(a.publicLabel??a.label,TITLE_MAX),kind:a.kind==='structured'?'structured':'open-ended'};
    });
  const board={kind:'easy-plots-player-board',version:1,investigationId,title,
    evidence:visibleEvidence,theories:visibleTheories,actions};
  if(new TextEncoder().encode(JSON.stringify(board)).length>24_000)fail('BOARD_BUDGET','Board exceeds recipient-safe response size');
  return Object.freeze(board);
}
export function validatePlayerBoardProjection(board){
  if(board?.kind!=='easy-plots-player-board'||![1,2].includes(board.version)||!Array.isArray(board.evidence)||
    !Array.isArray(board.theories)||!Array.isArray(board.actions))fail('INVALID_BOARD','Expected a pre-authorized player projection');
  if(board.evidence.length>48||board.theories.length>24||board.actions.length>12)fail('BOARD_BUDGET','Projection exceeded bounds');
  const allowed=new Set(['kind','version','investigationId','title','evidence','theories','actions',...(board.version===2?['editToken']:[])]);
  if(board.version===2&&!/^[a-f0-9]{64}$/.test(board.editToken??''))fail('INVALID_BOARD','Editable board requires an opaque visible-content revision token');
  if(Object.keys(board).some(k=>!allowed.has(k)))fail('INVALID_BOARD','Unexpected projection metadata');
  const fields=[['evidence',['id','title','description','discoveredAt']],
    ['theories',['id','title','reasoning','supportEvidenceIds','contradictionEvidenceIds','assessment',...(board.version===2?['canEdit']:[])]],
    ['actions',['opportunityId','label','kind']]];
  for(const [array,keys] of fields){for(const entry of board[array]){
    if(!entry||typeof entry!=='object'||Object.keys(entry).some(k=>!keys.includes(k)))fail('INVALID_BOARD','Unknown projected record field');
    if(Object.hasOwn(entry,'canEdit')&&typeof entry.canEdit!=='boolean')fail('INVALID_BOARD','Projected edit permission must be an explicit boolean');
  }}
  return true;
}
