/** Authenticated player edits remain private immutable requests until a
 * journaled GM-approved effect appends the reviewed theory to its board.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const token=board=>sha256Hex(JSON.stringify(board));
const nativeId=/^[A-Za-z0-9_.:-]{8,160}$/;
export function validatePlayerBoardEdit(edit){
 if(!edit||typeof edit!=='object'||Array.isArray(edit)||Object.keys(edit).some(k=>!['editToken','title','reasoning','arguments','replacesPublicTheoryId'].includes(k))||!/^[a-f0-9]{64}$/.test(edit.editToken??'')||typeof edit.title!=='string'||!edit.title.trim()||edit.title.length>140||typeof edit.reasoning!=='string'||edit.reasoning.length>900||!Array.isArray(edit.arguments)||edit.arguments.length>24)fail('BOARD_EDIT_CONTRACT','Bounded public theory edit required');
 if(edit.replacesPublicTheoryId!==undefined)assertNarrativeId(edit.replacesPublicTheoryId);
 const seen=new Set();for(const a of edit.arguments){assertNarrativeId(a?.evidenceId);if(Object.keys(a).some(k=>!['evidenceId','direction'].includes(k))||!['support','contradict'].includes(a.direction)||seen.has(a.evidenceId))fail('BOARD_EDIT_CONTRACT','Unique typed public evidence arguments required');seen.add(a.evidenceId);}
 if(new TextEncoder().encode(JSON.stringify(edit)).length>4096)fail('BOARD_EDIT_BUDGET','Board edit exceeds its bounded request size');return clone(edit);
}
export class PlayerBoardEdits {
 #domains;#workbench;#authorize;#observer;#gm;#writer;#events;
 constructor({domains,workbench,actorAuthorization,resolveObserver,gmProvider,writer,manualEvents=null}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||typeof domains?.queryScoped!=='function'||typeof workbench?.boardSnapshotForObserver!=='function'||typeof workbench?.recordReviewedHypothesis!=='function'||typeof actorAuthorization!=='function'||typeof resolveObserver!=='function'||typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function')fail('BOARD_EDIT_DEPENDENCY','Protected board/request storage and authenticated native Actor mapping required');
  this.#domains=domains;this.#workbench=workbench;this.#authorize=actorAuthorization;this.#observer=resolveObserver;this.#gm=gmProvider;this.#writer=writer;this.#events=manualEvents;
 }
 #authority(){const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);}
 async #identity({verifiedUserId,actorId}){
  this.#authority();if(!nativeId.test(verifiedUserId??'')||!nativeId.test(actorId??'')||await this.#authorize(verifiedUserId,actorId)!==true)fail('BOARD_EDIT_DENIED','Board is unavailable');
  const observerId=await this.#observer({verifiedUserId,actorId});assertNarrativeId(observerId);this.#authority();return observerId;
 }
 async projectionForPlayer({scope='world',verifiedUserId,actorId,investigationId}={}){
  const observerId=await this.#identity({verifiedUserId,actorId}),snapshot=await this.#workbench.boardSnapshotForObserver({scope,investigationId,observerId});
  const board=this.#publicBoard(snapshot,observerId),editToken=await token(board);
  if(await this.#identity({verifiedUserId,actorId})!==observerId)fail('BOARD_EDIT_DENIED','Observer binding changed before board delivery');
  return {...board,editToken};
 }
 #publicBoard({record,board},observerId){
  if(!record.data.disclosedTo?.includes(observerId)&&!record.data.disclosedTo?.includes('public')&&!board.evidence.length&&!board.theories.length&&!board.actions.length)fail('BOARD_EDIT_DENIED','Board is unavailable');
  return {...board,version:2,theories:board.theories.map(t=>({...t,canEdit:record.data.theories.some(original=>(original.publicId??original.id)===t.id&&original.ownerId===observerId)}))};
 }
 async read({scope='world',id}={}){
  this.#authority();assertNarrativeId(id);const row=await this.#domains.read('board-edit-request',scope,id);if(!row)return null;
  const {state,completion,review,bodyDigest,...body}=row.data??{};
  if(!['pending','completed','dismissed'].includes(state)||bodyDigest!==await sha256Hex(JSON.stringify(body)))fail('BOARD_EDIT_CORRUPT','Captured player request content differs from its durable fingerprint');
  this.#authority();
  return row;
 }
 async list({scope='world',cursor='0:0',limit=16}={}){
  this.#authority();const page=await this.#domains.queryScoped({type:'board-edit-request',scope,cursor,limit});
  const items=[];for(const item of page.items){const current=await this.read({scope,id:item.id});if(!current)fail('BOARD_EDIT_CORRUPT','Indexed player request is missing');items.push(current);}this.#authority();return {...page,items};
 }
 async capture({scope='world',verifiedUserId,actorId,investigationId,requestId,edit}={}){
  edit=validatePlayerBoardEdit(edit);assertNarrativeId(investigationId);if(!nativeId.test(requestId??''))fail('BOARD_EDIT_CONTRACT','Stable client request ID required');
  const observerId=await this.#identity({verifiedUserId,actorId}),hash=await sha256Hex(JSON.stringify({scope,verifiedUserId,actorId,requestId})),id=`ep:board-edit:${hash.slice(0,28)}`;
  const payloadDigest=await sha256Hex(JSON.stringify({investigationId,observerId,edit})),prior=await this.read({scope,id});
  if(prior){if(prior.data.payloadDigest!==payloadDigest)fail('BOARD_EDIT_REUSE','Request identity has different content');return {state:'pending',requestId};}
  const snapshot=await this.#workbench.boardSnapshotForObserver({scope,investigationId,observerId}),{record}=snapshot,board=this.#publicBoard(snapshot,observerId);
  if(edit.editToken!==await token(board))fail('BOARD_EDIT_STALE','Visible board changed before this request');
  const visible=new Map(board.evidence.map(e=>[e.id,e]));
  const canonicalArguments=edit.arguments.map(a=>{
   if(!visible.has(a.evidenceId))fail('BOARD_EDIT_EVIDENCE','Only disclosed public evidence may be cited');
   const matches=record.data.evidence.filter(e=>(e.publicId??e.id)===a.evidenceId&&(e.disclosedTo?.includes(observerId)||e.disclosedTo?.includes('public')));
   if(matches.length!==1)fail('BOARD_EDIT_EVIDENCE','Public evidence mapping is ambiguous');return {evidenceId:matches[0].id,direction:a.direction};
  });
  let supersedesHypothesisId=null;
  if(edit.replacesPublicTheoryId){
   const priorTheory=record.data.theories.find(t=>(t.publicId??t.id)===edit.replacesPublicTheoryId&&t.ownerId===observerId&&t.reviewStatus!=='superseded'&&board.theories.some(p=>p.id===edit.replacesPublicTheoryId));
   if(!priorTheory)fail('BOARD_EDIT_OWNER','Only the author current disclosed theory may be revised');supersedesHypothesisId=priorTheory.id;
  }
  if(await this.#identity({verifiedUserId,actorId})!==observerId)fail('BOARD_EDIT_DENIED','Observer binding changed during submission');
  const body={verifiedUserId,actorId,observerId,investigationId,investigationRevision:record.revision,clientRequestId:requestId,payloadDigest,edit,canonicalArguments,supersedesHypothesisId,hypothesisId:`ep:hypothesis:board_edit_${hash.slice(0,28)}`,publicId:`ep:theory-public:${hash.slice(0,28)}`};
  await this.#domains.save({type:'board-edit-request',scope,id,sourceEventId:`ep:event:board_edit_capture_${hash.slice(0,28)}`,data:{state:'pending',...body,bodyDigest:await sha256Hex(JSON.stringify(body))}});
  return {state:'pending',requestId};
 }
 async queueForGMReview({scope='world',id,expectedRevision}={}){
  this.#authority();if(typeof this.#events?.emit!=='function')fail('BOARD_EDIT_DEPENDENCY','Protected GM event gateway required');
  const row=await this.read({scope,id});if(!row||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Board request changed before GM review');
  if(row.data.state!=='pending')fail('BOARD_EDIT_FINAL','Only pending player edits can be proposed');
  if(await this.#identity(row.data)!==row.data.observerId)fail('BOARD_EDIT_DENIED','Observer identity changed before review');
  const current=await this.#workbench.read({scope,investigationId:row.data.investigationId});
  if(current?.revision!==row.data.investigationRevision)fail('BOARD_EDIT_STALE','Investigation changed after this player submission');
  const requestId=`ep:request:board_edit_${(await sha256Hex(`${scope}|${id}|${expectedRevision}`)).slice(0,28)}`;
  return this.#events.emit({requestId,eventType:'narrative.board-edit-reviewed',payload:{editRequestId:id,expectedRequestRevision:row.revision}});
 }
 async dismiss({scope='world',id,expectedRevision,reason,reviewEventId}={}){
  this.#authority();assertNarrativeId(reviewEventId);if(typeof reason!=='string'||!reason.trim()||reason.length>300)fail('BOARD_EDIT_REVIEW','Bounded GM review reason required');
  const row=await this.read({scope,id});if(!row||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Player request changed during review');
  if(row.data.state!=='pending')fail('BOARD_EDIT_FINAL','Only pending requests can be dismissed');
  const investigation=await this.#workbench.read({scope,investigationId:row.data.investigationId});
  if(investigation?.data.theories.some(t=>t.id===row.data.hypothesisId))fail('BOARD_EDIT_RECONCILIATION_REQUIRED','A canonical theory already exists; reconcile the original effect before retiring this request');
  return this.#domains.save({type:'board-edit-request',scope,id,expectedRevision,sourceEventId:reviewEventId,data:{...row.data,state:'dismissed',review:{reason:reason.trim(),reviewEventId}}});
 }
 async apply({scope='world',requestId,expectedRequestRevision,shareWith=[]},{sourceEventId,operationId}={}){
  this.#authority();for(const id of [sourceEventId,operationId])assertNarrativeId(id);shareWith=clone(shareWith);
  const row=await this.read({scope,id:requestId});if(!row)fail('BOARD_EDIT_MISSING','Private board request unavailable');
  if(row.data.state==='completed'){
   if(row.data.completion?.operationId!==operationId||row.data.completion?.sourceEventId!==sourceEventId||JSON.stringify(row.data.completion.shareWith)!==JSON.stringify(shareWith))fail('BOARD_EDIT_FINAL','Board request is already completed under another operation');return {alreadyApplied:true};
  }
  if(row.data.state!=='pending'||row.revision!==expectedRequestRevision)fail('REVISION_CONFLICT','Player request changed since GM review');
  const observerId=await this.#identity(row.data);if(observerId!==row.data.observerId)fail('BOARD_EDIT_DENIED','Observer binding changed before GM execution');
  const result=await this.#workbench.recordReviewedHypothesis({scope,investigationId:row.data.investigationId,hypothesisId:row.data.hypothesisId,publicId:row.data.publicId,observerId,
   sourceEventId,operationId,expectedRevision:row.data.investigationRevision,title:row.data.edit.title,reasoning:row.data.edit.reasoning,arguments:row.data.canonicalArguments,shareWith,supersedesHypothesisId:row.data.supersedesHypothesisId});
  this.#authority();await this.#domains.save({type:'board-edit-request',scope,id:row.id,expectedRevision:row.revision,sourceEventId,data:{...row.data,state:'completed',completion:{operationId,sourceEventId,shareWith,investigationRevision:result.revision}}});
  return {investigationId:result.id,revision:result.revision,alreadyApplied:false};
 }
 async verify({scope='world',requestId,expectedRequestRevision,shareWith=[]},{sourceEventId,operationId}={}){
  this.#authority();const row=await this.read({scope,id:requestId});if(!row||row.data.state!=='completed'||row.revision!==expectedRequestRevision+1||row.data.completion?.operationId!==operationId||row.data.completion?.sourceEventId!==sourceEventId||JSON.stringify(row.data.completion.shareWith)!==JSON.stringify(shareWith))return false;
  const board=await this.#workbench.read({scope,investigationId:row.data.investigationId}),theory=board?.data.theories.find(t=>t.id===row.data.hypothesisId);
  const audience=[row.data.observerId,...shareWith.filter(id=>id!==row.data.observerId)];
  return Boolean(theory&&theory.operationId===operationId&&theory.sourceEventId===sourceEventId&&theory.ownerId===row.data.observerId&&theory.publicId===row.data.publicId&&theory.title===row.data.edit.title&&theory.reasoning===row.data.edit.reasoning&&JSON.stringify(theory.arguments)===JSON.stringify(row.data.canonicalArguments)&&JSON.stringify(theory.disclosedTo)===JSON.stringify(audience)&&JSON.stringify(theory.reviewedFor)===JSON.stringify(audience)&&(theory.supersedesHypothesisId??null)===row.data.supersedesHypothesisId);
 }
}
