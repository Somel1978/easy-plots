import test from 'node:test';import assert from 'node:assert/strict';
import {routeCrossPlotEvent,aggregateArcMilestones} from '../src/domains/crossplot.mjs';
import {buildContinuityManifest,assessContinuityBinding} from '../src/domains/continuity.mjs';
import {mergeBlueprintInstance,validateBlueprintPublication} from '../src/domains/blueprints.mjs';
import {runIsolatedWhatIf} from '../src/domains/simulation.mjs';
test('one canonical event fans out to independent bounded subscribers without executing effects',()=>{
  const result=routeCrossPlotEvent({id:'ep:event:abc',eventType:'discovery.verified'},[
    {id:'l1',targetId:'p1',kind:'qualify',eventType:'discovery.verified',activeRevision:3,expectedRevision:3},
    {id:'l2',targetId:'p2',kind:'react',eventType:'discovery.verified',activeRevision:1,expectedRevision:1,requiredKnownFactIds:['clue']},
    {id:'l3',targetId:'p3',kind:'unlock',eventType:'discovery.verified',activeRevision:1,expectedRevision:2}
  ]);
  assert.deepEqual(result.qualified.map(v=>v.targetId),['p1']);assert.equal(result.effectsExecuted,0);assert.equal(result.skipped.length,2);
});
test('dependency fanout rejects unbounded inputs and unknown link types',()=>{
  assert.throws(()=>routeCrossPlotEvent({id:'ep:event:x',eventType:'e'},Array.from({length:3},(_,i)=>({id:String(i)})),{maxSubscribers:2}),{code:'CROSSPLOT_BUDGET'});
  assert.throws(()=>routeCrossPlotEvent({id:'ep:event:x',eventType:'e'},[{id:'x',targetId:'t',kind:'overwrite'}]),{code:'CROSSPLOT_LINK'});
});
test('aggregation does not leak secret milestones or automatically award effects',()=>{
  assert.deepEqual(aggregateArcMilestones([{id:'public'},{id:'secret'}],{completedMilestoneIds:['public','secret'],authorizedMilestoneIds:['public']}),[{id:'public',completed:true,sourceMilestoneId:'public'}]);
});
test('continuity links stable references and keeps future hooks dormant',()=>{
  const manifest=buildContinuityManifest({sourceArcId:'ep:arc:waterdeep',resolutionRevision:3,refs:[{entityId:'ep:npc:marrek'}],hooks:[{hookId:'black-viper',sourceEventId:'ep:event:x'}]});
  assert.equal(manifest.dormantHooks[0].status,'dormant');assert.equal(manifest.references[0].ownership,'borrowed');assert.equal(manifest.committed,false);
  assert.equal(assessContinuityBinding(manifest.references[0],{currentEntity:{id:'ep:npc:marrek',revision:2},expectedRevision:1}).status,'revision-review');
});
test('blueprints adopt nonconflicting upstream changes while preserving instance overrides',()=>{
  const result=mergeBlueprintInstance({base:{title:'A',text:'A',style:'base'},updated:{title:'B',text:'A',style:'blue'},instance:{title:'A',text:'custom',style:'red'}});
  assert.equal(result.merged.title,'B');assert.equal(result.merged.text,'custom');assert.deepEqual(result.conflicts,[{field:'style',status:'review-required'}]);
  assert.equal(result.committed,false);
});
test('published blueprint revisions cannot be silently overwritten',()=>{
  assert.throws(()=>validateBlueprintPublication({id:'blue',revision:2},{seenRevisions:['blue@2']}),{code:'BLUEPRINT_IMMUTABLE'});
});
test('simulation leaves original world facts unchanged and executes no effect',()=>{
  const initialFacts={port:'open'};const r=runIsolatedWhatIf({initialFacts,hypotheses:[{key:'port',value:'closed'}],rules:[{id:'r1',key:'port',equals:'closed',outputKey:'warehouse',value:'safe'}]});
  assert.equal(initialFacts.port,'open');assert.equal(r.hypotheticalFacts.warehouse,'safe');assert.equal(r.effectsExecuted,0);assert.equal(r.converged,true);
});
test('nonconvergent simulation reports budget exhaustion',()=>{
  const r=runIsolatedWhatIf({initialFacts:{a:0},rules:[{id:'r1',key:'a',equals:0,outputKey:'a',value:1},{id:'r2',key:'a',equals:1,outputKey:'a',value:0}],maxPasses:2});
  assert.equal(r.status,'budget-exhausted');assert.equal(r.committed,false);
});
