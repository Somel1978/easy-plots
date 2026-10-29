/** Protected narrative voting. Ballot records are private and scoped by voter;
 * stable deterministic locators allow bounded queries without listing a world
 * collection. Voting and GM-approved resolution never invoke plot effects.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {evaluateNarrativeVote,projectFinalDecision} from './decisions.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const SCOPE=/^[a-z][a-z0-9-]{0,47}$/;
const validScope=scope=>{if(typeof scope!=='string'||!SCOPE.test(scope))fail('VOTE_SCOPE','Explicit bounded scope required');};
const ballotId=async (decisionId,actorId)=>`ep:vote-ballot:${(await sha256Hex(decisionId+'|'+actorId)).slice(0,32)}`;
export class PersistentNarrativeVotes {
 #domains;
 constructor({domains}={}){if(typeof domains?.read!=='function'||typeof domains?.save!=='function')fail('VOTE_STORE','Protected GM domain store required');this.#domains=domains;}
 async create({scope='world',decision,sourceEventId}={}){
  validScope(scope);assertNarrativeId(sourceEventId);
  // Validate the published contract before it can accept any ballots.
  evaluateNarrativeVote({decision,ballots:[],worldTime:0,maxParticipants:32});
  assertNarrativeId(decision.publicId);
  if(decision.publicId===decision.id)fail('VOTE_DISCLOSURE','Use a separate player-safe decision ID');
  return this.#domains.save({type:'vote-decision',scope,id:decision.id,sourceEventId,
   data:{...clone(decision),state:'collecting',sourceEventId}});
 }
 async recordBallot({scope='world',decisionId,actorId,choiceId,sourceEventId,worldTime,
  verifiedParticipant=false}={}){
  validScope(scope);for(const id of [decisionId,actorId,sourceEventId])assertNarrativeId(id);
  if(verifiedParticipant!==true)fail('VOTE_AUTHORIZATION','GM must attest verified Actor authorization');
  if(!Number.isFinite(worldTime)||worldTime<0)fail('VOTE_TIME','Finite world time required');
  const decision=await this.#domains.read('vote-decision',scope,decisionId);
  if(!decision||decision.data.state!=='collecting')fail('VOTE_NOT_OPEN','Active decision required');
  if(worldTime>=decision.data.deadline)fail('VOTE_EXPIRED','New ballots after the authored deadline require separate policy');
  if(!decision.data.participantIds.includes(actorId)||!decision.data.choiceIds.includes(choiceId))
   fail('VOTE_BALLOT','Only eligible participants and authored choices allowed');
  const id=await ballotId(decisionId,actorId);
  const prior=await this.#domains.read('vote-ballot',scope,id);
  const data={decisionId,actorId,choiceId,sourceEventId};
  if(prior){if(JSON.stringify(prior.data)===JSON.stringify(data))return prior;
   fail('VOTE_ALREADY_CAST','Changing a recorded ballot requires an explicit replacement contract');}
  return this.#domains.save({type:'vote-ballot',scope,id,sourceEventId,data,visibility:'gm-only'});
 }
 async evaluate({scope='world',decisionId,worldTime}={}){
  validScope(scope);assertNarrativeId(decisionId);
  const decision=await this.#domains.read('vote-decision',scope,decisionId);
  if(!decision)fail('VOTE_MISSING','Published narrative decision required');
  // One deterministic point read per declared participant; no world scan.
  const ballots=[];
  for(const actorId of decision.data.participantIds){const id=await ballotId(decisionId,actorId);
   const row=await this.#domains.read('vote-ballot',scope,id);
   if(row){if(row.data.decisionId!==decisionId||row.data.actorId!==actorId)fail('VOTE_CORRUPT','Ballot identity mismatch');
    ballots.push({ballotEventId:row.data.sourceEventId,actorId,choiceId:row.data.choiceId});}
  }
  const plan=evaluateNarrativeVote({decision:decision.data,ballots,worldTime,maxParticipants:32});
  return clone({...plan,decisionRevision:decision.revision,ballotEventIds:ballots.map(b=>b.ballotEventId),
   alreadyFinalized:decision.data.state==='finalized',ballotsNotPublished:true});
 }
 async finalize({scope='world',decisionId,worldTime,reviewEventId,
  expectedDecisionRevision,selectedChoiceId=null}={}){
  validScope(scope);for(const id of [decisionId,reviewEventId])assertNarrativeId(id);
  const decision=await this.#domains.read('vote-decision',scope,decisionId);
  if(!decision||decision.data.state!=='collecting')fail('VOTE_NOT_OPEN','Only collecting decisions may be finalized');
  if(decision.revision!==expectedDecisionRevision)fail('REVISION_CONFLICT','Vote changed before GM approval');
  const plan=await this.evaluate({scope,decisionId,worldTime});
  const auto=plan.status==='eligible-for-gm-finalization'&&plan.eligibleWinner;
  const tie=plan.status==='gm-tie-review'&&decision.data.tiePolicy==='gm-decides';
  if(!auto&&!tie)fail('VOTE_NOT_ELIGIBLE','Quorum, deadline or authored tie policy not satisfied');
  const choiceId=tie?selectedChoiceId:plan.eligibleWinner;
  if(!decision.data.choiceIds.includes(choiceId))fail('VOTE_CHOICE','GM must select an authored choice');
  if(!tie&&selectedChoiceId!==null&&selectedChoiceId!==choiceId)fail('VOTE_CHOICE','Cannot override the eligible result without a separate decision');
  // A single authoritative record is committed; there is no extra document
  // write or hidden interim tally published to players.
  const row=await this.#domains.save({type:'vote-decision',scope,id:decisionId,
   expectedRevision:decision.revision,sourceEventId:reviewEventId,
   data:{...clone(decision.data),state:'finalized',approvedChoiceId:choiceId,
    approvalEventId:reviewEventId,finalizedWorldTime:worldTime,ballotEventIds:plan.ballotEventIds}});
  return {decisionId,revision:row.revision,state:'finalized',choiceId,
   effectsExecuted:0,rawBallotsPublished:false};
 }
 async project({scope='world',decisionId,observerId}={}){
  validScope(scope);assertNarrativeId(observerId);assertNarrativeId(decisionId);
  const row=await this.#domains.read('vote-decision',scope,decisionId);
  if(!row||row.data.state!=='finalized')return null;
  const visible=projectFinalDecision({decision:row.data,
   approvedResult:{decisionId,choiceId:row.data.approvedChoiceId,approved:true},
   observerId,authorizedParticipantIds:row.data.participantIds});
  return visible?{id:row.data.publicId,choiceId:visible.choiceId,state:visible.state}:null;
 }
}
