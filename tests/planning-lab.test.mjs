import test from 'node:test';import assert from 'node:assert/strict';
import {evaluatePlanningFixture} from '../src/ui/planning-lab.mjs';
test('GM what-if preview executes only bounded declarative rules',()=>{
  const output=evaluatePlanningFixture('what-if',{initialFacts:{fact:true},hypotheses:[{key:'alternate',value:true}],
    rules:[{id:'rule1',key:'alternate',equals:true,outputKey:'result',value:'yes'}]});
  assert.equal(output.hypotheticalFacts.result,'yes');assert.equal(output.committed,false);assert.equal(output.effectsExecuted,0);
});
test('time jump preview classifies authored commitments without inventing history',()=>{
  const output=evaluatePlanningFixture('time-jump',{from:10,to:30,scheduled:[{id:'a',dueTime:20,kind:'faction'}]});
  assert.equal(output.due.length,1);assert.equal(output.inventedHistory,false);
});
test('arc endings and blueprint merge are explicitly reviewable',()=>{
  const endings=evaluatePlanningFixture('arc-ending',{endings:[{id:'a',exclusiveGroup:'primary',requiredFacets:{}},
    {id:'b',exclusiveGroup:'primary',requiredFacets:{}}],worldFacets:{}});
  assert.equal(endings.conflicts.length,1);
  const merged=evaluatePlanningFixture('blueprint',{base:{name:'Old'},updated:{name:'New'},instance:{name:'Custom'},allowedKeys:['name']});
  assert.equal(merged.conflicts.length,1);
});
test('planning lab refuses unknown modes and oversized input',()=>{
  assert.throws(()=>evaluatePlanningFixture('native-effect',{}),/Unknown planning mode/);
  assert.throws(()=>evaluatePlanningFixture('what-if',{initialFacts:{secret:'x'.repeat(24001)}}),/bounded JSON scenario/);
});
