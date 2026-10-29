import test from 'node:test';import assert from 'node:assert/strict';
import {FoundryD20RollCoordinator} from '../src/platform/foundry-rolls.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gm=createLocalGMContext({user:{id:'gm',isGM:true}},'world');
const base={attemptId:'ep:attempt:search_001',sourceEventId:'ep:event:search_001',actorId:'ep:actor:hero_001',
  mode:'active',modifier:2,dc:14,partialMargin:3};
function setup({canRoll=true,actorAllowed=true}={}){
  let rolled=0;
  class RollFake {
    constructor(formula,data){assert.equal(formula,'1d20 + @modifier');assert.equal(data.modifier,2);}
    async evaluate(options){assert.deepEqual(options,{allowInteractive:false});rolled++;if(!canRoll)throw Error('roll interrupted');this.total=13;}
  }
  const repository=new MemoryPartitionRepository();const coordinator=new FoundryD20RollCoordinator({repository,
    gmProvider:()=>gm,RollClass:RollFake,authorizeActor:async()=>actorAllowed});
  return {repository,coordinator,get rolled(){return rolled;}};
}
test('active native roll is durable, GM-only, classifies partial and does not reroll',async()=>{
  const s=setup(),result=await s.coordinator.resolve(base);
  assert.equal(result.status,'resolved');assert.equal(result.record.total,13);
  assert.equal(result.record.outcome,'partial');assert.equal(result.record.visibility,'gm-only');
  assert.equal((await s.coordinator.resolve(base)).status,'already-resolved');assert.equal(s.rolled,1);
});
test('invalid retry of attempt identity is refused',async()=>{
  const s=setup();await s.coordinator.resolve(base);
  await assert.rejects(()=>s.coordinator.resolve({...base,dc:20}),{code:'ROLL_CONFLICT'});
});
test('failed roll leaves uncertain record and never silently rolls again',async()=>{
  const s=setup({canRoll:false});
  assert.equal((await s.coordinator.resolve(base)).status,'uncertain');
  assert.equal((await s.coordinator.resolve(base)).status,'reconciliation-required');assert.equal(s.rolled,1);
});
test('passive checks use fixed formula and cannot fabricate dice rolls',async()=>{
  const s=setup();const result=await s.coordinator.resolve({...base,mode:'passive'});
  assert.equal(result.record.total,12);assert.equal(result.record.outcome,'partial');assert.equal(s.rolled,0);
});
test('unowned Actor is refused and input budgets are enforced',async()=>{
  const s=setup({actorAllowed:false});await assert.rejects(()=>s.coordinator.resolve(base),{code:'ACTOR_DENIED'});
  const x=setup();await assert.rejects(()=>x.coordinator.resolve({...base,modifier:100}),{code:'ROLL_INPUT'});
});
