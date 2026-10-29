import test from 'node:test';import assert from 'node:assert/strict';
import {qualifyMilestone} from '../src/domains/milestones.mjs';
import {buildTimeTransition} from '../src/domains/temporal.mjs';
import {visibleClaims} from '../src/domains/knowledge.mjs';
import {proposeArcEnding} from '../src/domains/arc-resolution.mjs';
test('unguarded player guess never validates a milestone',()=>{
  const m={id:'milestone-1',qualifyingEventTypes:['evidence.verified'],requiredFactIds:['clue-x'],completionPolicy:'gm-review'};
  assert.equal(qualifyMilestone(m,{eventType:'player.theory.submitted'}).qualified,false);
  assert.equal(qualifyMilestone(m,{eventType:'evidence.verified',payload:{verifiedFactIds:['clue-x']}}).status,'gm-review');
  assert.equal(qualifyMilestone(m,{eventType:'evidence.verified',payload:{verifiedFactIds:[]}}).status,'missing-evidence');
  assert.equal(qualifyMilestone(m,{eventType:'evidence.verified'},new Set(['milestone-1'])).status,'already-completed');
});
test('time jump only classifies due authored events; no invented outcomes',()=>{
  const plan=buildTimeTransition({from:0,to:180,scheduled:[{id:'a',dueTime:90,kind:'deadline'},{id:'b',dueTime:45,kind:'travel'},{id:'c',dueTime:220,kind:'faction-agenda'}]});
  assert.deepEqual(plan.due.map(x=>x.id),['b','a']);assert.equal(plan.committed,false);assert.equal(plan.inventedHistory,false);assert.ok(plan.due.every(x=>x.outcome==='not-established'));
});
test('temporal operation budget enforced',()=>{
  assert.throws(()=>buildTimeTransition({from:0,to:200,scheduled:Array.from({length:5},(_,i)=>({id:String(i),dueTime:i+1})),maxDue:2}),{code:'TEMPORAL_BUDGET'});
});
test('claims filtered by actual observer and published disclosure',()=>{
  const claims=[{observerId:'p1',disclosureId:'a',publicId:'c1',text:'Maybe Marrek',secretTruth:'Viper'},{observerId:'p2',disclosureId:'a',publicId:'c2',text:'Another theory'},{observerId:'p1',disclosureId:'b',publicId:'c3',text:'hidden'}];
  assert.deepEqual(visibleClaims(claims,{observerId:'p1',authorizedSources:['a']}),[{claimId:'c1',text:'Maybe Marrek',confidence:'unrated',status:'unverified'}]);
});
test('competing exclusive endings require GM reconciliation',()=>{
  const r=proposeArcEnding([{id:'a',exclusiveGroup:'final',requiredFacets:{leader:'gone'}},{id:'b',exclusiveGroup:'final',requiredFacets:{leader:'gone'}}],{leader:'gone'});
  assert.equal(r.status,'gm-reconciliation');assert.deepEqual(r.conflicts,[['a','b']]);assert.equal(r.committed,false);
});
