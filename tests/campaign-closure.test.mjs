import test from 'node:test';import assert from 'node:assert/strict';
import {planCampaignClosure,prepareClosureDecision} from '../src/orchestration/campaign-closure.mjs';
const id=s=>`ep:arc:${s}`;
const common={arcId:id('waterdeep01'),arcRevision:4,worldTime:180,worldFacets:{leader:'captured',network:'active'},
 endingContracts:[{id:id('ending001'),requiredFacets:{leader:'captured',network:'active'},exclusiveGroup:'primary'}],
 objectives:[{id:id('objective01'),status:'completed'},{id:id('objective02'),status:'active'}],
 unresolvedThreads:[{id:id('thread0001'),sourceEventId:id('event0001'),disposition:'dormant'}]};
test('partial arc ending keeps incomplete objectives and hooks dormant',()=>{
 const r=planCampaignClosure(common);
 assert.equal(r.status,'gm-finalization-review');assert.equal(r.eligible.length,1);
 assert.equal(r.objectiveResults[1].completed,false);assert.equal(r.unresolvedThreads[0].activated,false);
 assert.equal(r.autoClosedObjectives,false);assert.equal(r.epiloguePublished,false);
});
test('eligible ending requires explicit review and revision',()=>{
 const p=planCampaignClosure(common),decision=prepareClosureDecision(p,{endingId:id('ending001'),gmApprovalId:id('approval001'),currentArcRevision:4});
 assert.equal(decision.state,'approved-pending-commit');assert.equal(decision.committed,false);
 assert.throws(()=>prepareClosureDecision(p,{endingId:id('ending001'),gmApprovalId:id('approval001'),currentArcRevision:5}),{code:'REVISION_CONFLICT'});
});
test('mutually exclusive eligible endings block finalize pending reconciliation',()=>{
 const p=planCampaignClosure({...common,endingContracts:[...common.endingContracts,{id:id('ending002'),requiredFacets:{leader:'captured'},exclusiveGroup:'primary'}]});
 assert.equal(p.status,'conflict-review');assert.equal(p.conflicts.length,1);
 assert.throws(()=>prepareClosureDecision(p,{endingId:id('ending001'),gmApprovalId:id('approval001'),currentArcRevision:4}),{code:'ARC_CONFLICT'});
});
test('unknown facet not interpreted as true or false',()=>{
 const p=planCampaignClosure({...common,endingContracts:[{id:id('ending003'),requiredFacets:{hidden:'revealed'}}]});
 assert.equal(p.status,'no-established-ending');assert.deepEqual(p.unknown[0].missingFacets,['hidden']);
});
test('historical closure does not mutate living world state',()=>{
 const before=structuredClone(common.worldFacets);const p=planCampaignClosure(common);
 p.historicalSnapshot.facets.leader='escaped';assert.deepEqual(common.worldFacets,before);
});
test('duplicate objective, hook and invalid ending rejected',()=>{
 assert.throws(()=>planCampaignClosure({...common,objectives:[...common.objectives,...common.objectives]}),{code:'ARC_OBJECTIVE'});
 assert.throws(()=>planCampaignClosure({...common,unresolvedThreads:[...common.unresolvedThreads,...common.unresolvedThreads]}),{code:'ARC_THREAD'});
 assert.throws(()=>prepareClosureDecision(planCampaignClosure(common),{endingId:id('not-there'),gmApprovalId:id('approval001'),currentArcRevision:4}),{code:'ARC_NOT_ELIGIBLE'});
});
test('finalization cannot ignore an unverified competing ending',()=>{
 const p=planCampaignClosure({...common,endingContracts:[...common.endingContracts,{id:id('ending003'),exclusiveGroup:'primary',requiredFacets:{unresolved:'possible'}}]});
 assert.equal(p.unknown.length,1);
 assert.throws(()=>prepareClosureDecision(p,{endingId:id('ending001'),gmApprovalId:id('approval001'),currentArcRevision:4}),{code:'ARC_COVERAGE'});
});
