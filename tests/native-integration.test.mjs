import test from 'node:test';
import assert from 'node:assert/strict';
import {createVerifiedGMStorageAndIntentSubsystem} from '../src/platform/native-integration.mjs';
const gm={id:'foundry-GM-001',active:true,isGM:true};
const game={user:gm,world:{id:'w'},users:{contents:[gm],activeGM:gm,get:()=>gm}};
const pack={collection:'world.easy-plots-secret',documentName:'JournalEntry',locked:false,metadata:{packageType:'world'},getUserLevel:()=>0};
const proof={level:'live-multiplayer',worldId:'w',packId:pack.collection,coreBuild:'14.369',
  playerIndexDenied:true,playerDocumentDenied:true,playerBootstrapDenied:true};
test('Native integration factory refuses implicit secrets and opportunity authorization',()=>{
  assert.throws(()=>createVerifiedGMStorageAndIntentSubsystem({gameInstance:game,pack,attestation:proof,coreBuild:'14.369'}),
    {code:'OPPORTUNITY_POLICY_REQUIRED'});
  assert.throws(()=>createVerifiedGMStorageAndIntentSubsystem({gameInstance:game,pack,attestation:null,coreBuild:'14.369',checkOpportunity:async()=>true}),
    {code:'PACK_UNVERIFIED'});
});
test('Explicitly composed integration exposes no automatically started socket or effects',()=>{
  const api=createVerifiedGMStorageAndIntentSubsystem({gameInstance:game,pack,attestation:proof,
    coreBuild:'14.369',checkOpportunity:async()=>false});
  assert.equal(api.transport.started,false);
  assert.equal(api.writer.state.suspended,false);
  api.stop();
  assert.equal(api.writer.state.suspended,true);
});
test('stopping native Hook startup during policy loading prevents late listener registration',async()=>{
 const api=createVerifiedGMStorageAndIntentSubsystem({gameInstance:game,pack,attestation:proof,coreBuild:'14.369',checkOpportunity:async()=>false});let release,registrations=0;
 api.signalReliability.load=()=>new Promise(resolve=>{release=resolve;});
 const startup=api.startReactiveHooks({HooksInstance:{on(){registrations++;},off(){}}});
 api.stopReactiveHooks();release();await assert.rejects(startup,{code:'HOOK_STOPPED'});assert.equal(registrations,0);assert.equal(api.runtimeStatus().running,false);api.stop();
});
