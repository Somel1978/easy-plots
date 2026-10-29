import test from 'node:test';import assert from 'node:assert/strict';
import {planBeliefReconciliation} from '../src/orchestration/knowledge-revisions.mjs';
const id=s=>`ep:test:${s}`;
const correction={eventId:id('correction01'),claimId:id('claim0001'),sourceId:id('informant01'),kind:'retracted'};
const row={observerId:id('actor0001'),claimId:correction.claimId,disclosureEventId:id('disclosed01'),disclosureAuthorized:true,stance:'believed'};
test('retraction preserves historical disclosure and requires GM review',()=>{
 const r=planBeliefReconciliation({correction,observerClaims:[row]});
 assert.equal(r.observerUpdates.length,1);assert.equal(r.observerUpdates[0].historicalDisclosureEventId,row.disclosureEventId);
 assert.equal(r.observerUpdates[0].status,'requires-gm-review');assert.equal(r.automaticPropagation,false);
});
test('only authorized observer-specific records are proposed',()=>{
 const r=planBeliefReconciliation({correction,observerClaims:[row,{...row,observerId:id('actor0002'),disclosureAuthorized:false}]});
 assert.equal(r.observerUpdates.length,1);assert.equal(r.pending.length,1);
});
test('dependent nodes are invalidated once and never automatically executed',()=>{
 const link={id:id('link0001'),claimId:correction.claimId,dependentId:id('objective01')};
 const r=planBeliefReconciliation({correction,dependencyLinks:[link,{...link,id:id('link0002')}]});
 assert.equal(r.dependencyInvalidations.length,1);assert.equal(r.dependencyInvalidations[0].automaticEffect,false);
});
test('unrelated claim untouched; duplicate observer contexts rejected',()=>{
 const r=planBeliefReconciliation({correction,observerClaims:[{...row,claimId:id('other001')}]});assert.equal(r.observerUpdates.length,0);
 assert.throws(()=>planBeliefReconciliation({correction,observerClaims:[row,row]}),{code:'BELIEF_DUPLICATE'});
});
test('invalid correction does not silently assert truth',()=>{
 assert.throws(()=>planBeliefReconciliation({correction:{...correction,kind:'automatically-true'}}),{code:'BELIEF_CORRECTION'});
});
