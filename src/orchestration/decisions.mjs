/** Durable-ballot compatible voting decision planner. No socket or native side
 * effects. Caller must load only GM-authorized vote records for this decision.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const tiePolicies=new Set(['gm-decides','no-consensus','runoff']);
const visibilityPolicies=new Set(['public-after-close','gm-only','participants-after-close']);
export function evaluateNarrativeVote({decision,ballots=[],worldTime,finalized=false,maxParticipants=32}={}){
 assertNarrativeId(decision?.id);
 if(!Array.isArray(decision.participantIds)||decision.participantIds.length>maxParticipants||
  !Array.isArray(decision.choiceIds)||decision.choiceIds.length<2||decision.choiceIds.length>12||
  !Array.isArray(ballots)||ballots.length>maxParticipants||
  !Number.isFinite(worldTime)||worldTime<0||!Number.isFinite(decision.deadline)||decision.deadline<0)
  fail('VOTE_CONTRACT','Bounded decision, participants, choices and time required');
 decision.participantIds.forEach(assertNarrativeId);
 if(new Set(decision.participantIds).size!==decision.participantIds.length||
    new Set(decision.choiceIds).size!==decision.choiceIds.length||
    decision.choiceIds.some(x=>typeof x!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(x)))
  fail('VOTE_CONTRACT','Unique participant and choice IDs required');
 if(!tiePolicies.has(decision.tiePolicy)||!visibilityPolicies.has(decision.visibility)||
    !Number.isInteger(decision.quorum)||decision.quorum<1||decision.quorum>decision.participantIds.length)
   fail('VOTE_POLICY','Explicit quorum, tie and secrecy policy required');
 const participantIds=new Set(decision.participantIds),counts=new Map(decision.choiceIds.map(id=>[id,0]));
 const voters=new Set();
 for(const ballot of ballots){assertNarrativeId(ballot.ballotEventId);assertNarrativeId(ballot.actorId);
  if(!participantIds.has(ballot.actorId)||voters.has(ballot.actorId)||!counts.has(ballot.choiceId))
   fail('VOTE_BALLOT','Unknown voter/choice or duplicate ballot');
  voters.add(ballot.actorId);counts.set(ballot.choiceId,counts.get(ballot.choiceId)+1);
 }
 const timedOut=worldTime>=decision.deadline;
 const quorumMet=ballots.length>=decision.quorum;
 const eligibleToFinalize=finalized||timedOut||ballots.length===decision.participantIds.length;
 const high=Math.max(...counts.values());
 const winners=[...counts].filter(([,count])=>count===high&&high>0).map(([id])=>id);
 const tied=winners.length>1;
 const state=!eligibleToFinalize?'collecting':!quorumMet?'quorum-unmet':tied?
  decision.tiePolicy==='gm-decides'?'gm-tie-review':decision.tiePolicy==='runoff'?'runoff-required':'no-consensus':
  'eligible-for-gm-finalization';
 const outcome={decisionId:decision.id,status:state,quorumMet,received:ballots.length,
  pendingCount:decision.participantIds.length-ballots.length,deadlinePassed:timedOut,
  eligibleWinner:state==='eligible-for-gm-finalization'?winners[0]:null,
  gmFinalizationRequired:true,committed:false};
 // Avoid leaking individual votes or interim totals for private votes. Caller
 // must still create a separate approved player projection after finalization.
 if(decision.visibility!=='gm-only'&&state==='eligible-for-gm-finalization')
  outcome.proposedPublishedSummary={decisionId:decision.id,eligibleWinner:winners[0],state:'awaits-gm-approval'};
 return outcome;
}
/** Minimal GM-authorized decision projection: no voter identities or raw votes. */
export function projectFinalDecision({decision,approvedResult,observerId,authorizedParticipantIds=[]}={}){
 assertNarrativeId(observerId);assertNarrativeId(decision?.id);
 if(approvedResult?.decisionId!==decision.id||approvedResult?.approved!==true||
    !decision.choiceIds?.includes(approvedResult.choiceId))fail('VOTE_UNAPPROVED','Only finalized approved results can be projected');
 const allowed=decision.visibility==='public-after-close'||
   (decision.visibility==='participants-after-close'&&authorizedParticipantIds.includes(observerId));
 if(!allowed)return null;
 return {decisionId:decision.id,choiceId:approvedResult.choiceId,state:'finalized'};
}
