import test from 'node:test';
import assert from 'node:assert/strict';
import {FoundryOpposedRollCoordinator,opposedRollLocator,validateOpposedCheck} from '../src/platform/foundry-opposed-rolls.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {normalizeFoundryHook} from '../src/platform/foundry-hook-ingress.mjs';
import {nativeRollLocator} from '../src/platform/foundry-rolls.mjs';
function fixture({totals=[15,12],allow=true,throwAt=null}={}){
  const repository=new MemoryPartitionRepository(),user={id:'gm_opposed001',isGM:true},ctx=createLocalGMContext({user,epoch:'roll'},'world');
  let calls=0,authorized=allow;
  class Roll{
    constructor(formula,data){this.formula=formula;this.modifier=data.modifier;}
    async evaluate(options){assert.equal(options.allowInteractive,false);calls++;if(calls===throwAt)throw Error('native interruption');this.total=totals[calls-1]+this.modifier;return this;}
    async toMessage(){throw Error('Private opposed rolls must not create chat messages');}
  }
  const gmProvider=()=>ctx,authorizeActor=async()=>authorized,config={repository,gmProvider,authorizeActor,RollClass:Roll};
  const service=new FoundryOpposedRollCoordinator(config),spec={attemptId:'ep:attempt:opposed_test001',sourceEventId:'ep:event:opposed_test001',
    initiator:{actorId:'ep:actor:initiator001',mode:'active',modifier:0},opponent:{actorId:'ep:actor:opponent001',mode:'active',modifier:0},tiePolicy:'tie',partialMargin:0};
  return {repository,user,config,service,spec,get calls(){return calls;},deny(){authorized=false;}};
}
test('ADR-109: opposed native check records both rolls, causal identities and authored winner',async()=>{
  const s=fixture(),r=await s.service.resolve(s.spec);assert.equal(r.status,'resolved');assert.equal(r.record.winner,'initiator');
  assert.deepEqual(r.record.totals,{initiator:15,opponent:12});assert.equal(r.record.margin,3);assert.equal(r.record.band,'decisive');
  assert.equal(r.record.visibility,'gm-only');assert.equal(s.calls,2);assert.equal(Object.keys(r.record.sideAttemptIds).length,2);
  const loc=await nativeRollLocator(r.record.sideAttemptIds.initiator),side=await s.repository.read(loc.id,{partitionId:loc.partitionId});
  assert.equal(side.request.dc,undefined);assert.equal(side.outcome,undefined);assert.equal(side.interpretation,'uninterpreted');
});
test('resolved opposed attempts return stored outcomes without rerolling after recreation',async()=>{
  const s=fixture();await s.service.resolve(s.spec);const restored=new FoundryOpposedRollCoordinator(s.config);
  assert.equal((await restored.resolve(s.spec)).status,'already-resolved');assert.equal(s.calls,2);
});
test('ADR-084: interruption on the second side leaves the whole attempt uncertain and unreplayed',async()=>{
  const s=fixture({throwAt:2});assert.equal((await s.service.resolve(s.spec)).status,'uncertain');
  assert.equal((await s.service.get(s.spec.attemptId)).state,'uncertain');
  assert.equal((await s.service.resolve(s.spec)).status,'reconciliation-required');assert.equal(s.calls,2);
});
test('passive opposed check consumes no native randomness',async()=>{
  const s=fixture();s.spec.initiator.mode=s.spec.opponent.mode='passive';s.spec.opponent.modifier=2;
  const result=await s.service.resolve(s.spec);assert.equal(result.record.winner,'opponent');assert.equal(s.calls,0);
});
test('opposed tie policies are authored explicitly and never selected arbitrarily',async()=>{
  for(const policy of ['tie','initiator','opponent']){
    const s=fixture({totals:[12,12]});s.spec.tiePolicy=policy;const r=await s.service.resolve(s.spec);
    assert.equal(r.record.winner,policy);assert.equal(r.record.band,'tie');
  }
});
test('opposed partial bands preserve separate winner and degree of outcome',async()=>{
  const s=fixture();s.spec.partialMargin=4;const r=await s.service.resolve(s.spec);
  assert.equal(r.record.band,'partial');assert.equal(r.record.winner,'initiator');
});
test('both opposed Actors must be authorized before randomness or preparation',async()=>{
  const s=fixture({allow:false});await assert.rejects(s.service.resolve(s.spec),{code:'ACTOR_DENIED'});assert.equal(s.calls,0);
  assert.equal(await s.service.get(s.spec.attemptId),null);
});
test('GM authority and Actor ownership are rechecked on stored-result access',async()=>{
  const s=fixture();await s.service.resolve(s.spec);s.deny();await assert.rejects(s.service.resolve(s.spec),{code:'ACTOR_DENIED'});
  s.user.isGM=false;await assert.rejects(s.service.get(s.spec.attemptId),{code:'GM_AUTHORITY_REVOKED'});
});
test('opposed attempt identities cannot be reused with modified participants or policies',async()=>{
  const s=fixture();await s.service.resolve(s.spec);s.spec.tiePolicy='opponent';
  await assert.rejects(s.service.resolve(s.spec),{code:'ROLL_CONFLICT'});assert.equal(s.calls,2);
});
test('opposed contracts reject unsupported formulas, unbounded margins and self-opposition',()=>{
  const s=fixture();
  for(const patch of [{partialMargin:99},{tiePolicy:'random'},{formula:'eval(...)'},{opponent:{...s.spec.initiator}}])
    assert.throws(()=>validateOpposedCheck({...s.spec,...patch}),{code:'CONTESTED_INPUT'});
});
test('opposed records with incomplete indices require manual reconciliation',async()=>{
  const s=fixture();await s.service.resolve(s.spec);s.repository.hasReadyIndex=async()=>false;
  await assert.rejects(s.service.get(s.spec.attemptId),{code:'INDEX_UNCERTAIN'});
});
test('lost final-result acknowledgment never rerolls a completed opposed attempt',async()=>{
  const s=fixture(),put=s.repository.put.bind(s.repository);let lost=false;
  s.repository.put=async(row,options)=>{const saved=await put(row,options);if(row.kind==='native-opposed-roll'&&row.state==='resolved'&&!lost){lost=true;throw Error('lost acknowledgment');}return saved;};
  assert.equal((await s.service.resolve(s.spec)).status,'uncertain');
  assert.equal((await s.service.resolve(s.spec)).status,'already-resolved');assert.equal(s.calls,2);
});
test('Combat hooks carry bounded field names without implying an encounter outcome',()=>{
  const doc={documentName:'Combat',uuid:'Combat.native001',combatants:['SECRET'],round:4};
  const event=normalizeFoundryHook('updateCombat',[doc,{round:5,turn:2,secret:'HIDDEN'},{untrusted:true},'gm_001'],{randomId:()=> 'combat_event001'});
  assert.equal(event.eventType,'foundry.combat.updated');assert.deepEqual(event.payload.changeKeys,['round','turn','secret']);
  assert.equal(JSON.stringify(event).includes('HIDDEN'),false);assert.equal(event.payload.outcome,undefined);
});
test('private chat Hook observations never copy content, recipients or roll values',()=>{
  const doc={documentName:'ChatMessage',uuid:'ChatMessage.native001',content:'PRIVATE',whisper:['gm_001'],rolls:[{total:18}]};
  const event=normalizeFoundryHook('createChatMessage',[doc,{},'gm_001'],{randomId:()=> 'chat_event001'});
  assert.equal(event.eventType,'foundry.chat.created');assert.deepEqual(Object.keys(event.payload).sort(),['changeKeys','documentType','documentUuid']);
  for(const field of ['content','whisper','rolls'])assert.equal(Object.hasOwn(event.payload,field),false);
});
