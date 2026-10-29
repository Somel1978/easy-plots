import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateNarrativeVote,projectFinalDecision} from '../src/orchestration/decisions.mjs';
const id=s=>`ep:test:${s}`;
const decision={id:id('vote001'),participantIds:[id('actor001'),id('actor002'),id('actor003')],choiceIds:['yes','no'],quorum:2,deadline:120,tiePolicy:'gm-decides',visibility:'participants-after-close'};
const a={ballotEventId:id('ballot001'),actorId:id('actor001'),choiceId:'yes'};
const b={ballotEventId:id('ballot002'),actorId:id('actor002'),choiceId:'no'};
test('votes remain collecting until deadline or all participant ballots',()=>{
 const r=evaluateNarrativeVote({decision,ballots:[a,b],worldTime:110});assert.equal(r.status,'collecting');
 assert.equal(r.committed,false);assert.equal(r.eligibleWinner,null);
});
test('deadline tie requires GM or run-off, never arbitrary choice',()=>{
 const r=evaluateNarrativeVote({decision,ballots:[a,b],worldTime:121});assert.equal(r.status,'gm-tie-review');
 assert.equal(r.eligibleWinner,null);
 const runoff=evaluateNarrativeVote({decision:{...decision,tiePolicy:'runoff'},ballots:[a,b],worldTime:121});
 assert.equal(runoff.status,'runoff-required');
});
test('quorum below threshold does not finalize a winner',()=>{
 const r=evaluateNarrativeVote({decision,ballots:[a],worldTime:121});assert.equal(r.status,'quorum-unmet');
});
test('eligible winner awaits GM finalization not immediate effect',()=>{
 const c={ballotEventId:id('ballot003'),actorId:id('actor003'),choiceId:'yes'};
 const r=evaluateNarrativeVote({decision,ballots:[a,b,c],worldTime:100});
 assert.equal(r.status,'eligible-for-gm-finalization');assert.equal(r.eligibleWinner,'yes');
 assert.equal(r.gmFinalizationRequired,true);
});
test('duplicate, unknown ballots and forged actor are rejected',()=>{
 assert.throws(()=>evaluateNarrativeVote({decision,ballots:[a,a],worldTime:110}),{code:'VOTE_BALLOT'});
 assert.throws(()=>evaluateNarrativeVote({decision,ballots:[{...a,actorId:id('intruder001')}],worldTime:110}),{code:'VOTE_BALLOT'});
});
test('private vote never publishes interim tally or ballots',()=>{
 const r=evaluateNarrativeVote({decision:{...decision,visibility:'gm-only'},ballots:[a,b],worldTime:125});
 assert.equal('ballots'in r,false);assert.equal('counts'in r,false);
 assert.equal('proposedPublishedSummary'in r,false);
});
test('approved final result projected only to authorized recipient',()=>{
 const approvedResult={decisionId:decision.id,choiceId:'yes',approved:true};
 assert.deepEqual(projectFinalDecision({decision,approvedResult,observerId:id('actor001'),authorizedParticipantIds:[id('actor001')]}),{decisionId:decision.id,choiceId:'yes',state:'finalized'});
 assert.equal(projectFinalDecision({decision,approvedResult,observerId:id('intruder001')}),null);
 assert.throws(()=>projectFinalDecision({decision,approvedResult:{...approvedResult,approved:false},observerId:id('actor001')}),{code:'VOTE_UNAPPROVED'});
});
