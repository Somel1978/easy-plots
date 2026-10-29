import test from 'node:test';import assert from 'node:assert/strict';
import {buildGMFocusSnapshot} from '../src/runtime/gm-cockpit.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gm=createLocalGMContext({user:{id:'gm',isGM:true}},'world');
const graphId='ep:graph:focus_001';
test('GM cockpit reads only explicitly requested focused graph and matching events',async()=>{
  const calls=[],registry={async getDraft(id){calls.push(['draft',id]);return {title:'Waterdeep',revision:4};},
    async getActivation(id){calls.push(['activation',id]);return {active:true,publishedVersion:3};},
    async getActive(id){calls.push(['active',id]);return {publishedVersion:3,nodes:[{},{}]};}},
    ledger={async get(id){calls.push(['event',id]);return {sourceEventId:id,state:'review-required',event:{eventType:'foundry.actor.updated'},
      evaluations:[{graphId}],proposals:[{graphId}]};}};
  const s=await buildGMFocusSnapshot({graphId,registry,ledger,gmProvider:()=>gm,eventIds:['ep:event:known_001']});
  assert.equal(s.active,true);assert.equal(s.nodeCount,2);assert.equal(s.requiresReview,1);
  assert.deepEqual(calls.map(c=>c[0]).sort(),['activation','active','draft','event']);
  assert.equal(s.scope,'gm-only');
});
test('GM cockpit rejects unbounded or unauthorized focus',async()=>{
  const registry={getDraft:async()=>null,getActivation:async()=>null};
  await assert.rejects(()=>buildGMFocusSnapshot({graphId,registry,gmProvider:()=>({isGM:false}),eventIds:[]}),{code:'GM_REQUIRED'});
  await assert.rejects(()=>buildGMFocusSnapshot({graphId,registry,gmProvider:()=>gm,eventIds:new Array(13).fill('ep:event:known_001')}),{code:'FOCUS_BUDGET'});
});
test('nested graph focus includes its causal events without unrelated graph proposals',async()=>{
 const other='ep:graph:parent_001',registry={getDraft:async()=>null,getActivation:async()=>null};
 const ledger={get:async()=>({sourceEventId:'ep:event:nested_focus001',state:'review-required',event:{eventType:'test.changed'},
  evaluations:[{graphId:other,trace:[{graphId,nodeId:'ep:node:nested_001'}]}],proposals:[{graphId},{graphId:other}]})};
 const snapshot=await buildGMFocusSnapshot({graphId,registry,ledger,gmProvider:()=>gm,eventIds:['ep:event:nested_focus001']});
 assert.equal(snapshot.events.length,1);assert.equal(snapshot.events[0].proposalCount,1);
 assert.equal(JSON.stringify(snapshot).includes(other),false);
});
