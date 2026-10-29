import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeSourceStampReader,nativeHookStamp,validateSourceUuid} from '../src/platform/foundry-source-stamps.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
function setup(){const user={id:'gm_source001',isGM:true},context=createLocalGMContext({user,epoch:'source'},'world');
 const actor={uuid:'Actor.source001',documentName:'Actor',name:'SECRET NPC',system:{hidden:'SECRET'},_stats:{modifiedTime:12345},testUserPermission:(_user,level)=>level==='OWNER'};
 const gameInstance={user,actors:{get:id=>id==='source001'?actor:null}},writer={assertEligible:()=>{}};
 return {user,actor,writer,read:createNativeSourceStampReader({gameInstance,gmProvider:()=>context,writer})};}
test('native checkpoint reader exposes only exact existence and modification metadata',async()=>{
 const s=setup();assert.deepEqual(await s.read('Actor.source001'),{exists:true,modifiedTime:12345});
 assert.equal(JSON.stringify(await s.read('Actor.source001')).includes('SECRET'),false);
 assert.deepEqual(await s.read('Actor.absent001'),{exists:false,modifiedTime:null});
 assert.deepEqual(nativeHookStamp('deleteCombat',{uuid:'Combat.source001'}),{exists:false,modifiedTime:null});
});
test('unverified source identity, permissions, timestamp and collection fail closed',async()=>{
 const s=setup();await assert.rejects(()=>s.read('Item.source001'),{code:'SIGNAL_SOURCE_UNAVAILABLE'});
 await assert.rejects(()=>s.read('Compendium.secret.Actor.source001'),{code:'SIGNAL_SOURCE'});
 s.actor.uuid='Actor.other001';await assert.rejects(()=>s.read('Actor.source001'),{code:'SIGNAL_SOURCE_DENIED'});s.actor.uuid='Actor.source001';
 s.actor.testUserPermission=()=>false;await assert.rejects(()=>s.read('Actor.source001'),{code:'SIGNAL_SOURCE_DENIED'});s.actor.testUserPermission=()=>true;
 s.actor._stats.modifiedTime=NaN;await assert.rejects(()=>s.read('Actor.source001'),{code:'SIGNAL_SOURCE_STAMP'});
 assert.throws(()=>validateSourceUuid('Actor.source001.Item.embedded001'),{code:'SIGNAL_SOURCE'});
});
test('source checkpoint reader rechecks GM role and designated-writer authority on each call',async()=>{
 const s=setup();s.writer.assertEligible=()=>{throw Object.assign(Error('handover'),{code:'NOT_DESIGNATED_GM'});};
 await assert.rejects(()=>s.read('Actor.source001'),{code:'NOT_DESIGNATED_GM'});
 s.user.isGM=false;await assert.rejects(()=>s.read('Actor.source001'),{code:'GM_AUTHORITY_REVOKED'});
});
