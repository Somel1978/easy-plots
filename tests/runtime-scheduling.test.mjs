import test from 'node:test';
import assert from 'node:assert/strict';
import {BoundedPriorityScheduler} from '../src/runtime/priority-scheduler.mjs';
import {BoundedDiagnostics} from '../src/runtime/bounded-diagnostics.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const tick=()=>new Promise(resolve=>queueMicrotask(resolve));
test('ADR-085: higher priority tasks run first and an old background task gets a bounded fair turn',async()=>{
 const scheduler=new BoundedPriorityScheduler({concurrency:1,maxPriorityBurst:2}),order=[];let release;
 const blocking=scheduler.submit({run:()=>new Promise(resolve=>{release=resolve;})});await tick();
 const background=scheduler.submit({priority:'background',run:()=>order.push('background')});
 const critical=[1,2,3,4].map(n=>scheduler.submit({priority:'critical',run:()=>order.push(`critical${n}`)}));
 const interactive=scheduler.submit({priority:'interactive',run:()=>order.push('interactive')});
 release();await Promise.all([blocking,background,...critical,interactive]);await tick();
 assert.deepEqual(order,['critical1','critical2','background','critical3','critical4','interactive']);
 assert.equal(scheduler.status.queued,0);
});
test('adaptive scheduling reduces concurrency after expensive work and recovers within its configured limit',async()=>{
 let now=0;const scheduler=new BoundedPriorityScheduler({concurrency:3,capacity:12,targetTaskMs:10,now:()=>now});
 await scheduler.submit({run:()=>{now+=30;}});await tick();await tick();assert.equal(scheduler.status.concurrency,2);
 await scheduler.submit({run:()=>{now+=30;}});await tick();await tick();assert.equal(scheduler.status.concurrency,1);
 await Promise.all(Array.from({length:7},()=>scheduler.submit({run:()=>{now+=1;}})));await tick();
 assert.equal(scheduler.status.concurrency,3);
});
test('task backpressure rejects excess work and closed queues never run cancelled tasks',async()=>{
 const scheduler=new BoundedPriorityScheduler({concurrency:1,capacity:2});let release,ran=false;
 const first=scheduler.submit({run:()=>new Promise(resolve=>{release=resolve;})});await tick();
 const second=scheduler.submit({run:()=>{ran=true;}}),cancelled=assert.rejects(second,{code:'TASK_CLOSED'});
 await assert.rejects(scheduler.submit({run:()=>{}}),{code:'TASK_BACKPRESSURE'});
 scheduler.close();release();await Promise.all([first,cancelled]);assert.equal(ran,false);
 await assert.rejects(scheduler.submit({run:()=>{}}),{code:'TASK_CLOSED'});
});
test('failed tasks remain failed while diagnostics failures cannot block following tasks',async()=>{
 const scheduler=new BoundedPriorityScheduler({concurrency:1,diagnostics:{record(){throw Error('collector failed');}}});
 const failed=scheduler.submit({run:()=>{throw Error('source failed');}}),rejected=assert.rejects(failed,/source failed/);
 const passed=scheduler.submit({priority:'background',run:()=>42});await rejected;assert.equal(await passed,42);
});
function collector(){const user={id:'gm_diagnostic001',isGM:true},ctx=createLocalGMContext({user,epoch:'diagnostic'},'world');return {user,diagnostics:new BoundedDiagnostics({gmProvider:()=>ctx})};}
test('ADR-086: representative diagnostics are sampled and bounded with aggregate error counts',()=>{
 const {diagnostics}=collector(),metric={kind:'task',priority:'background',durationMs:4,queueDepth:1,outcome:'ok'};
 diagnostics.record({...metric,payload:'not accepted when enabled'});assert.equal(diagnostics.snapshot().observations,0);
 diagnostics.configure({enabled:true,sampleEvery:10,capacity:10});
 for(let i=0;i<1000;i++)diagnostics.record(metric);
 const snapshot=diagnostics.snapshot();assert.equal(snapshot.observations,1000);assert.equal(snapshot.counts.ok,1000);assert.equal(snapshot.samples.length,10);
 diagnostics.record({...metric,outcome:'error'});assert.equal(diagnostics.snapshot().samples.at(-1).outcome,'error');
 snapshot.samples[0].durationMs=999;assert.equal(diagnostics.snapshot().samples[0].durationMs,4);
 diagnostics.clear();assert.equal(diagnostics.snapshot().observations,0);
});
test('diagnostics reject private fields and excessive configurations and require live GM authority',()=>{
 const {user,diagnostics}=collector();diagnostics.configure({enabled:true});
 assert.throws(()=>diagnostics.record({kind:'task',priority:'critical',durationMs:1,queueDepth:0,outcome:'ok',eventId:'PRIVATE'}),{code:'DIAGNOSTIC_METRIC'});
 assert.throws(()=>diagnostics.configure({enabled:true,capacity:129}),{code:'DIAGNOSTIC_CONFIG'});
 assert.equal(diagnostics.snapshot().observations,0);user.isGM=false;
 assert.throws(()=>diagnostics.snapshot(),{code:'GM_AUTHORITY_REVOKED'});
});
