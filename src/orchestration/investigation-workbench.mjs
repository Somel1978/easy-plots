/** GM-reviewed, revision-checked investigation contributions. Never compare
 * player theories with protected canonical truth or infer completion from a
 * guess. The owned domain document is the only record written here.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {createInvestigationBoardProjection} from '../domains/investigation-board.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const isText=(s,max)=>typeof s==='string'&&s.length>0&&s.length<=max;
const allowedKinds=new Set(['support','contradict']);
export class GMInvestigationWorkbench {
 #domains;
 constructor({domains}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function')fail('INVESTIGATION_STORE','A protected GM domain repository is required');
  this.#domains=domains;
 }
 async read({scope='world',investigationId}={}){
  assertNarrativeId(investigationId);
  return this.#domains.read('investigation',scope,investigationId);
 }
 async recordReviewedHypothesis({scope='world',investigationId,hypothesisId,observerId,sourceEventId,
   expectedRevision,title,reasoning='',arguments:args=[],shareWith=[],operationId=null,publicId=null,supersedesHypothesisId=null}={}){
  for(const value of [investigationId,hypothesisId,observerId,sourceEventId])assertNarrativeId(value);
  if(publicId!==null)assertNarrativeId(publicId);if(supersedesHypothesisId!==null)assertNarrativeId(supersedesHypothesisId);
  if(!isText(title,140)||typeof reasoning!=='string'||reasoning.length>900||
     !Array.isArray(args)||args.length>24||!Array.isArray(shareWith)||shareWith.length>16)
    fail('HYPOTHESIS_CONTRACT','Bounded text, evidence and audience required');
  shareWith.forEach(assertNarrativeId);
  if(new Set(shareWith).size!==shareWith.length)fail('HYPOTHESIS_AUDIENCE','Duplicate participant');
  const row=await this.read({scope,investigationId});
  if(!row||!row.data||!Array.isArray(row.data.evidence)||!Array.isArray(row.data.theories))
    fail('INVESTIGATION_MISSING','A reviewed investigation record is required');
  const existing=row.data.theories.find(t=>t.id===hypothesisId);
  if(existing){
    const matches=existing.sourceEventId===sourceEventId&&existing.ownerId===observerId&&
      existing.title===title&&existing.reasoning===reasoning&&
      JSON.stringify(existing.arguments)===JSON.stringify(args)&&
      JSON.stringify(existing.disclosedTo.slice(1))===JSON.stringify(shareWith.filter(x=>x!==observerId))&&
      (existing.operationId??null)===(operationId??null)&&(existing.publicId??null)===publicId&&(existing.supersedesHypothesisId??null)===supersedesHypothesisId;
    if(matches)return clone(row);
    fail('HYPOTHESIS_CONFLICT','Hypothesis identity already used for different content or operation');
  }
  if(row.revision!==expectedRevision)fail('REVISION_CONFLICT','Investigation changed during GM review');
  if(publicId&&row.data.theories.some(t=>(t.publicId??t.id)===publicId))fail('HYPOTHESIS_CONFLICT','Public theory identity is already in use');
  if(supersedesHypothesisId){const prior=row.data.theories.find(t=>t.id===supersedesHypothesisId);
    if(!prior||prior.ownerId!==observerId||prior.reviewStatus==='superseded')fail('HYPOTHESIS_OWNER','Only the author current reviewed theory may be revised');}
  const known=new Map(row.data.evidence.filter(e=>e.disclosedTo?.includes(observerId)||e.disclosedTo?.includes('public')).map(e=>[e.id,e]));
  const seen=new Set();
  const safeArguments=[];
  for(const argument of args){
    assertNarrativeId(argument?.evidenceId);
    if(!allowedKinds.has(argument.direction)||!known.has(argument.evidenceId)||seen.has(argument.evidenceId))
      fail('HYPOTHESIS_EVIDENCE','Evidence must be uniquely known to the author and typed');
    seen.add(argument.evidenceId);
    safeArguments.push({evidenceId:argument.evidenceId,direction:argument.direction});
  }
  // Sharing an argument is a disclosure action, not an implicit consequence of
  // submitting a theory. Every shared observer must already have each clue.
  for(const recipient of shareWith){
    if(recipient===observerId)continue;
    for(const id of seen){const item=known.get(id);
      if(!item.disclosedTo?.includes(recipient)&&!item.disclosedTo?.includes('public'))
        fail('HYPOTHESIS_DISCLOSURE','Cannot publish an argument revealing undisclosed evidence');
    }
  }
  if(row.data.theories.length>=24)fail('HYPOTHESIS_BUDGET','Maximum theories reached');
  const theory={id:hypothesisId,ownerId:observerId,sourceEventId,title,reasoning,
    ...(publicId?{publicId}:{}),...(supersedesHypothesisId?{supersedesHypothesisId}:{}),
    arguments:safeArguments,disclosedTo:[observerId,...shareWith.filter(x=>x!==observerId)],
    reviewedFor:[observerId,...shareWith.filter(x=>x!==observerId)],reviewStatus:'gm-reviewed',
    ...(operationId?{operationId}:{}),
    // Never include hidden verdicts, success predicates or scores.
    canonicalComparison:null};
  const updated=await this.#domains.save({type:'investigation',scope,id:investigationId,
    expectedRevision:row.revision,sourceEventId,visibility:'gm-only',
    data:{...row.data,theories:[...row.data.theories.map(t=>t.id===supersedesHypothesisId?{...t,reviewStatus:'superseded',supersededBy:hypothesisId}:t),theory]}});
  return clone(updated);
 }
 async boardForObserver({investigationId,scope='world',observerId}={}){
  return (await this.boardSnapshotForObserver({investigationId,scope,observerId})).board;
 }
 /** GM-only source plus its projection from the exact same revision. Only the
  * projection may be returned through a player transport. */
 async boardSnapshotForObserver({investigationId,scope='world',observerId}={}){
  assertNarrativeId(observerId);
  const row=await this.read({scope,investigationId});
  if(!row)fail('INVESTIGATION_MISSING','Unknown scoped investigation');
  const evidence=row.data.evidence??[];
  const opportunities=row.data.opportunities??[];
  const board=createInvestigationBoardProjection({investigationId,title:row.data.title??'',evidence,
    theories:row.data.theories??[],opportunities},{observerId,
    authorizedEvidenceIds:evidence.filter(e=>e.disclosedTo?.includes(observerId)||e.disclosedTo?.includes('public')).map(e=>e.id),
    authorizedOpportunityIds:opportunities.filter(e=>e.disclosedTo?.includes(observerId)||e.disclosedTo?.includes('public')).map(e=>e.id)});
  return {record:row,board};
 }
}
