import test from 'node:test';import assert from 'node:assert/strict';
import {GraphRegistry} from '../src/graph/registry.mjs';
import {NarrativeRuntime} from '../src/runtime/engine.mjs';
import {EffectCoordinator} from '../src/runtime/effects.mjs';
import {MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {graph,gid,event,session} from './fixtures.mjs';
function harness({apply,verify}={}) {
  const gm=createLocalGMContext(session(),'w'),reg=new GraphRegistry(),save=reg.saveDraft(graph()),pub=reg.publish(gid,{expectedRevision:save.revision,gm});reg.activate(gid,pub.publishedVersion,{gm});
  let calls=0;const provider={apply:async (...args)=>{calls++;return apply?apply(...args):{ok:true}},verify:verify??(async()=>true)};
  const journal=new MemoryOperationJournal(),coordinator=new EffectCoordinator({journal,providers:new Map([['narrative.set-state',provider]])});
  const runtime=new NarrativeRuntime({registry:reg,coordinator});runtime.rebuildActiveIndex(gm);
  return {gm,reg,journal,runtime,calls:()=>calls};
}
test('end-to-end published graph proposes effect only when condition qualifies',async()=>{
  const h=harness();let r=await h.runtime.handle(event('ep:event:trial_001',false),h.gm);assert.equal(r[0].proposedEffects.length,0);
  r=await h.runtime.handle(event(),h.gm);assert.equal(r[0].proposedEffects.length,1);assert.equal(h.calls(),0);
});
test('approved event writes journal before native effect and verifies',async()=>{
  const h=harness();let result=await h.runtime.handle(event(),h.gm,{approveEffects:true});
  assert.equal(result[0].executed[0].status,'completed');assert.equal(h.calls(),1);
  result=await h.runtime.handle(event(),h.gm,{approveEffects:true});assert.equal(result[0].executed[0].status,'already-completed');assert.equal(h.calls(),1);
});
test('lost acknowledgement after native apply is uncertain and never blindly retried',async()=>{
  const h=harness({apply:async()=>{throw new Error('ack lost')}});
  const res=await h.runtime.handle(event(),h.gm,{approveEffects:true});assert.equal(res[0].executed[0].status,'uncertain');
  const retry=await h.runtime.handle(event(),h.gm,{approveEffects:true});assert.equal(retry[0].executed[0].status,'reconciliation-required');assert.equal(h.calls(),1);
});
test('unconfirmed verification remains uncertain',async()=>{
  const h=harness({verify:async()=>false});const r=await h.runtime.handle(event(),h.gm,{approveEffects:true});assert.equal(r[0].executed[0].status,'uncertain');
});
test('unauthenticated execution never invokes provider',async()=>{
  const h=harness();await assert.rejects(h.runtime.handle(event(),{userId:'GM_1'},{approveEffects:true}),{code:'GM_REQUIRED'});assert.equal(h.calls(),0);
});
test('event routing ignores unrelated event types',async()=>{
  const h=harness();assert.deepEqual(await h.runtime.handle({...event(),eventType:'unrelated'},h.gm),[]);
});
test('bounded active graph routing fails on too many subscribers',async()=>{
  const h=harness();const runtime=new NarrativeRuntime({registry:h.reg,coordinator:{execute:()=>{}},maxSubscribers:0});runtime.rebuildActiveIndex(h.gm);
  await assert.rejects(runtime.handle(event(),h.gm),{code:'FANOUT_BUDGET'});
});
