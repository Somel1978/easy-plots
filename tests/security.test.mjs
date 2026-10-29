import test from 'node:test';import assert from 'node:assert/strict';
import {createLocalGMContext,assertLocalGM,assertAttestedPlayerOrigin} from '../src/security/authority.mjs';
import {buildPlayerProjection,genericIntentReceipt} from '../src/security/projection.mjs';
import {PlayerIntentGate} from '../src/security/request-gate.mjs';
import {createFoundrySafetyGates} from '../src/platform/foundry-gates.mjs';
import {session} from './fixtures.mjs';
test('only local GM session creates trusted authority context',()=>{
  assert.throws(()=>createLocalGMContext({user:{id:'p',isGM:false}},'w'),{code:'GM_REQUIRED'});
  assert.throws(()=>assertLocalGM({kind:'ep-gm-context-v1',userId:'GM_1'}),{code:'GM_REQUIRED'});
  const s=session(),g=createLocalGMContext(s,'w');assert.equal(assertLocalGM(g).userId,'GM_1');s.user.isGM=false;assert.throws(()=>assertLocalGM(g),{code:'GM_AUTHORITY_REVOKED'});
});
test('socket supplied identity is not native attestation',()=>{
  assert.throws(()=>assertAttestedPlayerOrigin({userId:'GM_1',senderIdentityStatus:'platform-attested'}),{code:'ORIGIN_UNVERIFIED'});
});
test('intent gate fails closed until verified native path configured',async()=>{
  const gate=new PlayerIntentGate(),gm=createLocalGMContext(session(),'w');
  await assert.rejects(gate.accept({actorId:'a',requestId:'r'},{source:'socket',userId:'player'},gm),{code:'ORIGIN_UNVERIFIED'});
  await assert.rejects(gate.accept({actorId:'a',requestId:'r'},{source:'verified-native-document-hook',verified:true,proofOfOrigin:'tested',userId:'p'},gm),{code:'NATIVE_SPIKE_UNVERIFIED'});
});
test('native gates reject unverified confidential stores/requests',()=>{
  const gates=createFoundrySafetyGates({user:{id:'g',isGM:true},world:{id:'w'}});
  assert.throws(gates.protectedStorage,{code:'SPIKE_STO_001_REQUIRED'});assert.throws(gates.playerIntentTransport,{code:'SPIKE_SEC_001_REQUIRED'});assert.throws(gates.crossGMCoordination,{code:'SPIKE_COORD_001_REQUIRED'});
});
test('allowlisted projection never copies secret fields or metadata',()=>{
  const source={publicId:'lead-1',title:'A clue',description:'Manifest found',visibility:['p'],gmOnlyAnswer:'Black Viper',privateEdgeCount:10,hiddenPredicate:'GM',secretIds:['secret'],visibleMilestones:[{id:'a',label:'Found clue',status:'complete',truth:'secret',visibility:['p']},{id:'secret',label:'Unknown spy',status:'completed',visibility:['GM_1']}],availableActions:[{id:'inspect',label:'Inspect',kind:'knowledge',secretSourceRef:'bad',inputSchema:{properties:{gmSecret:{const:'Viper'}}}}]};
  const result=buildPlayerProjection(source,{authorized:true,userId:'p'});
  assert.deepEqual(result,{publicId:'lead-1',title:'A clue',description:'Manifest found',visibleMilestones:[{id:'a',label:'Found clue',status:'complete'}],availableActions:[{id:'inspect',label:'Inspect',kind:'knowledge'}]});
  assert.equal(JSON.stringify(result).includes('Black Viper'),false);
});
test('unlisted player fails closed with no existence oracle',()=>{
  assert.throws(()=>buildPlayerProjection({title:'secret',visibility:[]},{authorized:true,userId:'p'}),{code:'DENIED'});
  assert.deepEqual(genericIntentReceipt('r-1'),{publicRequestId:'r-1',state:'pending',explanationCode:'REQUEST_RECEIVED'});
});
