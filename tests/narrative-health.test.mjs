import test from 'node:test';
import assert from 'node:assert/strict';
import {assessNarrativeHealth} from '../src/orchestration/narrative-health.mjs';
const arcId='ep:arc:waterdeep001',id=x=>`ep:objective:${x}`;
test('health only reports explicitly sourced, bounded GM attention items',()=>{
 const r=assessNarrativeHealth({arcId,worldTime:100,coverage:'complete',
  objectives:[{id:id('one001'),status:'active',confirmedBlocked:true},{id:id('two001'),status:'completed'}],
  deadlines:[{id:'ep:schedule:late001',dueAt:90,status:'pending'}],
  requests:[{id:'ep:request:uncertain001',state:'uncertain'}],
  unresolvedLinks:[{id:'ep:resource:missing001',status:'missing'}]});
 assert.equal(r.status,'requires-review');assert.equal(r.findings.length,4);assert.equal(r.effectsExecuted,0);
 assert.equal(r.findings.find(f=>f.kind==='overdue-deadline').reason.includes('outcome is not implied'),true);
});
test('partial coverage never claims complete world health',()=>{
 const r=assessNarrativeHealth({arcId,worldTime:0});
 assert.equal(r.status,'incomplete-coverage');assert.equal(r.counts.review,0);
});
test('health resists unbounded reads and malformed input',()=>{
 assert.throws(()=>assessNarrativeHealth({arcId,worldTime:1,objectives:Array(257).fill({id:id('a0001')})}),{code:'HEALTH_BUDGET'});
 assert.throws(()=>assessNarrativeHealth({arcId,worldTime:1,objectives:[{id:id('a0001'),status:'active'},{id:id('a0001'),status:'active'}]}),{code:'HEALTH_DUPLICATE'});
 assert.throws(()=>assessNarrativeHealth({arcId,worldTime:1,coverage:'pretend'}),{code:'HEALTH_COVERAGE'});
});
test('due event does not become overdue on exact boundary',()=>{
 const r=assessNarrativeHealth({arcId,worldTime:100,coverage:'complete',deadlines:[{id:'ep:schedule:on_time001',dueAt:100,status:'pending'}]});
 assert.equal(r.status,'no-known-issues');
});
