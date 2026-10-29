import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentNarrativeVotes} from '../src/orchestration/persistent-voting.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const id=x=>`ep:${x}`,decisionId=id('decision:harbor001');const alice=id('actor:alice001'),bob=id('actor:bob001'),charlie=id('actor:charlie001');
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'local'},'world');
async function setup({tiePolicy='gm-decides',visibility='participants-after-close'}={}){
 const domain=new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider}),votes=new PersistentNarrativeVotes({domains:domain});
 await votes.create({decision:{id:decisionId,participantIds:[alice,bob],choiceIds:['investigate','negotiate'],publicId:id('public:vote001'),quorum:2,deadline:100,tiePolicy,visibility},sourceEventId:id('event:publish001')});
 return {domain,votes};
}
const ballot=(actorId,choiceId,sourceEventId)=>({decisionId,actorId,choiceId,sourceEventId,worldTime:10,verifiedParticipant:true});
test('durable quorum, late ballot rules and final disclosure without ballots',async()=>{
 const {votes}=await setup();
 const first=await votes.recordBallot(ballot(alice,'investigate',id('event:alice001')));
 assert.equal((await votes.recordBallot(ballot(alice,'investigate',id('event:alice001')))).revision,first.revision);
 await assert.rejects(votes.recordBallot(ballot(alice,'negotiate',id('event:alice002'))),{code:'VOTE_ALREADY_CAST'});
 await votes.recordBallot(ballot(bob,'investigate',id('event:bob001')));
 const result=await votes.evaluate({decisionId,worldTime:20});assert.equal(result.status,'eligible-for-gm-finalization');
 assert.equal(await votes.project({decisionId,observerId:alice}),null);
 const done=await votes.finalize({decisionId,worldTime:20,reviewEventId:id('event:review001'),expectedDecisionRevision:1});
 assert.equal(done.state,'finalized');assert.equal(done.effectsExecuted,0);
 assert.deepEqual(await votes.project({decisionId,observerId:alice}),{id:id('public:vote001'),choiceId:'investigate',state:'finalized'});
 assert.equal(await votes.project({decisionId,observerId:charlie}),null);
 await assert.rejects(votes.recordBallot(ballot(alice,'investigate',id('event:late001'))),{code:'VOTE_NOT_OPEN'});
});
test('unverified ballots, unauthorized participants and late votes fail closed',async()=>{
 const {votes}=await setup();
 await assert.rejects(votes.recordBallot({...ballot(alice,'investigate',id('event:alice001')),verifiedParticipant:false}),{code:'VOTE_AUTHORIZATION'});
 await assert.rejects(votes.recordBallot(ballot(charlie,'investigate',id('event:charlie001'))),{code:'VOTE_BALLOT'});
 await assert.rejects(votes.recordBallot({...ballot(alice,'investigate',id('event:alice001')),worldTime:100}),{code:'VOTE_EXPIRED'});
 await assert.rejects(votes.finalize({decisionId,worldTime:20,reviewEventId:id('event:review001'),expectedDecisionRevision:1}),{code:'VOTE_NOT_ELIGIBLE'});
});
test('GM must explicitly adjudicate a tie; private ballots remain undisclosed',async()=>{
 const {votes}=await setup();await votes.recordBallot(ballot(alice,'investigate',id('event:alice001')));
 await votes.recordBallot(ballot(bob,'negotiate',id('event:bob001')));
 const current=await votes.evaluate({decisionId,worldTime:100});assert.equal(current.status,'gm-tie-review');
 await assert.rejects(votes.finalize({decisionId,worldTime:100,reviewEventId:id('event:review001'),expectedDecisionRevision:1}),{code:'VOTE_CHOICE'});
 const resolved=await votes.finalize({decisionId,worldTime:100,reviewEventId:id('event:review001'),expectedDecisionRevision:1,selectedChoiceId:'negotiate'});
 assert.equal(resolved.choiceId,'negotiate');assert.equal(JSON.stringify(await votes.project({decisionId,observerId:bob})).includes('alice'),false);
});
test('tie policy no-consensus cannot be overridden by an arbitrary GM choice',async()=>{
 const {votes}=await setup({tiePolicy:'no-consensus'});
 await votes.recordBallot(ballot(alice,'investigate',id('event:alice001')));await votes.recordBallot(ballot(bob,'negotiate',id('event:bob001')));
 await assert.rejects(votes.finalize({decisionId,worldTime:100,reviewEventId:id('event:review001'),expectedDecisionRevision:1,selectedChoiceId:'investigate'}),{code:'VOTE_NOT_ELIGIBLE'});
});
