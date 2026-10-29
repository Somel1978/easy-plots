import test from 'node:test';import assert from 'node:assert/strict';
import {evaluateSharedMilestones,projectAuthorizedMilestones} from '../src/orchestration/investigation-milestones.mjs';
const id=s=>`ep:test:${s}`;
const objectiveId=id('objective001'),evidenceId=id('evidence001');
const milestone={id:id('milestone001'),objectiveId,kind:'discovery',requiredEvidenceIds:[evidenceId],requiredFactIds:[]};
const contribution={eventId:id('event001'),objectiveId,actorId:id('actor001'),evidenceId,authorized:true};
test('discovered evidence qualifies but never automatically grants a reward',()=>{
 const r=evaluateSharedMilestones({milestones:[milestone],contributions:[contribution],authorizedEvidenceIds:[evidenceId]});
 assert.equal(r.proposals[0].status,'eligible-for-gm-review');assert.equal(r.automaticRewards,0);
});
test('two observers may contribute independently without repeating the milestone',()=>{
 const other={...contribution,eventId:id('event002'),actorId:id('actor002')};
 const r=evaluateSharedMilestones({milestones:[milestone],contributions:[contribution,other],authorizedEvidenceIds:[evidenceId]});
 assert.equal(r.proposals.length,1);assert.deepEqual(r.proposals[0].participatingActorIds,[id('actor001'),id('actor002')]);
});
test('hidden evidence and correct guesses do not qualify',()=>{
 const r=evaluateSharedMilestones({milestones:[milestone],contributions:[contribution],authorizedEvidenceIds:[]});
 assert.equal(r.proposals[0].status,'prerequisites-not-established');
});
test('verified conclusion requires separate authorized event identity',()=>{
 const verified={...milestone,id:id('milestone002'),kind:'verified-conclusion',verificationEventId:id('verify001')};
 const r=evaluateSharedMilestones({milestones:[verified],contributions:[contribution],authorizedEvidenceIds:[evidenceId]});
 assert.equal(r.proposals[0].status,'prerequisites-not-established');
});
test('existing milestone never reawarded',()=>{
 const r=evaluateSharedMilestones({milestones:[milestone],contributions:[contribution],authorizedEvidenceIds:[evidenceId],completedMilestoneIds:[milestone.id]});
 assert.equal(r.proposals[0].status,'already-completed');
});
test('duplicate evidence event is rejected',()=>{
 assert.throws(()=>evaluateSharedMilestones({milestones:[milestone],contributions:[contribution,contribution],authorizedEvidenceIds:[evidenceId]}),{code:'MILESTONE_DUPLICATE'});
});
test('player progress projection excludes GM-only milestone totals and truth',()=>{
 const r=projectAuthorizedMilestones({observerId:id('actor001'),published:[{publicId:'visible',publicTitle:'Manifest found',publicState:'completed',allowedObserverIds:[id('actor001')],secret:'true'},{publicId:'hidden',publicTitle:'True villain',allowedObserverIds:[id('actor002')]}]});
 assert.deepEqual(r,[{publicId:'visible',title:'Manifest found',state:'completed'}]);
});
test('verified conclusion requires independent, explicitly authorized verification evidence',()=>{
 const verification={...contribution,eventId:id('verify001'),verificationAuthorized:true};
 const verified={...milestone,id:id('milestone002'),kind:'verified-conclusion',verificationEventId:id('verify001')};
 const result=evaluateSharedMilestones({milestones:[verified],contributions:[contribution,verification],authorizedEvidenceIds:[evidenceId]});
 assert.equal(result.proposals[0].status,'eligible-for-gm-review');
 const noAuthority=evaluateSharedMilestones({milestones:[verified],contributions:[contribution,{...verification,verificationAuthorized:false}],authorizedEvidenceIds:[evidenceId]});
 assert.equal(noAuthority.proposals[0].status,'prerequisites-not-established');
});
