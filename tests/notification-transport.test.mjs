import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeFoundryNotificationTransport,validateNotificationPacket} from '../src/platform/foundry-notification-transport.mjs';
import {PersistentNarrativeNotifications} from '../src/orchestration/persistent-notifications.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {MODULE_SOCKET} from '../src/platform/foundry-socket.mjs';
const ids={noticeId:'ep:notice:harbor001',recipientId:'ep:actor:hero001',sourceEventId:'ep:event:clue001',approvalEventId:'ep:event:approve001'};
function setup({binding='player-user-001',access=true,clientDisplay=true,autoStart=true,bindingDelay=0}={}){
 const users=new Map([['foundry-GM-001',{id:'foundry-GM-001',active:true,isGM:true}],
 ['player-user-001',{id:'player-user-001',active:true,isGM:false}],
 ['player-user-002',{id:'player-user-002',active:true,isGM:false}]]);
 const listeners=new Map(),traffic=[];
 function game(id){const set=new Set();listeners.set(id,set);return {user:users.get(id),world:{id:'world'},
  users:{get:key=>users.get(key),get activeGM(){return users.get('foundry-GM-001');}},
  modules:{get:()=>({socket:true})},socket:{on:(channel,fn)=>{assert.equal(channel,MODULE_SOCKET);set.add(fn);},
   off:(_channel,fn)=>set.delete(fn),emit:(channel,packet,{recipients}={})=>{
    assert.equal(channel,MODULE_SOCKET);assert.ok(Array.isArray(recipients));
    traffic.push({from:id,to:recipients,packet:structuredClone(packet)});
    for(const to of recipients)for(const cb of listeners.get(to)??[])queueMicrotask(()=>cb(structuredClone(packet),id));
   }}};}
 const repository=new MemoryPartitionRepository();const service=new PersistentNarrativeNotifications({domains:new NarrativeDomainStore({repository,
  gmProvider:()=>createLocalGMContext({user:users.get('foundry-GM-001'),epoch:'test'},'world')})});
 let receives=0;const gmGame=game('foundry-GM-001'),playerGame=game('player-user-001'),strangerGame=game('player-user-002');
 const gm=new NativeFoundryNotificationTransport({gameInstance:gmGame,service,
   resolveRecipientUser:async()=>{if(bindingDelay)await new Promise(r=>setTimeout(r,bindingDelay));return binding;},authorizeRecipient:async(user,recipient)=>access&&user==='player-user-001'&&recipient===ids.recipientId,
   checkGM:()=>true,randomId:()=>'ep:delivery:0001'});
 const player=new NativeFoundryNotificationTransport({gameInstance:playerGame,onReceive:async item=>{
  receives++;assert.equal(item.text,'Your map has a new route.');return clientDisplay;}});
 if(autoStart){gm.start();player.start();}
 return {gm,player,gmGame,playerGame,strangerGame,service,traffic,get receives(){return receives;}};
}
async function publish(s){const row=await s.service.queue({...ids,groupKey:'route-notice',gmDetail:'Secret villain',safeText:'Your map has a new route.'});
 return s.service.approve({noticeId:ids.noticeId,approvalEventId:ids.approvalEventId,expectedRevision:row.revision});}
test('authenticated recipient gets only allowlisted safe text and durable receipt',async()=>{
 const s=setup();await publish(s);
 const delivered=await s.gm.deliver({noticeId:ids.noticeId});
 assert.deepEqual(delivered,{status:'acknowledged',noticeId:ids.noticeId});
 assert.deepEqual(s.traffic.map(t=>t.to),[['player-user-001'],['foundry-GM-001']]);
 assert.equal(JSON.stringify(s.traffic).includes('Secret villain'),false);
 const row=await s.service.read({noticeId:ids.noticeId});
 assert.equal(row.data.deliveryReceipt.userId,'player-user-001');
 assert.equal(s.receives,1);
 assert.equal((await s.gm.deliver({noticeId:ids.noticeId})).status,'acknowledged');
 assert.equal(s.traffic.length,2);
 s.gm.stop();s.player.stop();
});
test('rejects foreign recipient mapping before any socket emission',async()=>{
 const s=setup({binding:'player-user-002'});await publish(s);
 await assert.rejects(s.gm.deliver({noticeId:ids.noticeId}),{code:'NOTIFICATION_RECIPIENT'});
 assert.equal(s.traffic.length,0);s.gm.stop();s.player.stop();
});
test('pending notifications and expired notices cannot be sent',async()=>{
 const s=setup();const row=await s.service.queue({...ids,groupKey:'route-notice',safeText:'Your map has a new route.',expiresAt:100});
 await assert.rejects(s.gm.deliver({noticeId:ids.noticeId}),{code:'NOTICE_NOT_APPROVED'});
 await s.service.approve({noticeId:ids.noticeId,approvalEventId:ids.approvalEventId,expectedRevision:row.revision});
 await assert.rejects(s.gm.deliver({noticeId:ids.noticeId,worldTime:100}),{code:'NOTICE_UNAVAILABLE'});
 assert.equal(s.traffic.length,0);s.gm.stop();s.player.stop();
});
test('forged client receipt cannot satisfy authentic recipient identity',async()=>{
 const s=setup({autoStart:false});s.gm.start();await publish(s);
 const pending=s.gm.deliver({noticeId:ids.noticeId},{timeoutMs:35});
 s.strangerGame.socket.emit(MODULE_SOCKET,{kind:'notice.receipt',version:1,
  deliveryId:'ep:delivery:0001',noticeId:ids.noticeId,status:'received'},{recipients:['foundry-GM-001']});
 await assert.rejects(pending,{code:'DELIVERY_UNCERTAIN'});
 assert.equal((await s.service.read({noticeId:ids.noticeId})).data.deliveryReceipt,undefined);
 s.gm.stop();
});
test('client callback failure leaves uncertain status, not a durable received mark',async()=>{
 const s=setup({clientDisplay:false});await publish(s);
 await assert.rejects(s.gm.deliver({noticeId:ids.noticeId},{timeoutMs:35}),{code:'DELIVERY_UNCERTAIN'});
 assert.equal((await s.service.read({noticeId:ids.noticeId})).data.deliveryReceipt,undefined);
 s.gm.stop();s.player.stop();
});
test('client rejects forged GM sender and overlong payloads',async()=>{
 const s=setup();await publish(s);
 s.strangerGame.socket.emit(MODULE_SOCKET,{kind:'notice.deliver',version:1,deliveryId:'ep:delivery:forged',
  noticeId:ids.noticeId,text:'Spoofed event',level:'urgent'},{recipients:['player-user-001']});
 await new Promise(r=>setTimeout(r,5));assert.equal(s.receives,0);
 assert.throws(()=>validateNotificationPacket({kind:'notice.deliver',version:1,deliveryId:'ep:delivery:bad',noticeId:ids.noticeId,
  text:'A'.repeat(281),level:'info'}),{code:'INVALID_NOTIFICATION'});
 s.gm.stop();s.player.stop();
});

test('concurrent sends for the same notice are rejected before asynchronous recipient lookup',async()=>{
 const s=setup({bindingDelay:20});await publish(s);
 const first=s.gm.deliver({noticeId:ids.noticeId});
 await assert.rejects(s.gm.deliver({noticeId:ids.noticeId}),{code:'BACKPRESSURE'});
 assert.equal((await first).status,'acknowledged');
 assert.equal(s.traffic.filter(t=>t.packet.kind==='notice.deliver').length,1);
 s.gm.stop();s.player.stop();
});
test('an authenticated client duplicate packet is acknowledged but not redisplayed',async()=>{
 const s=setup();await publish(s);await s.gm.deliver({noticeId:ids.noticeId});
 const original=s.traffic.find(t=>t.packet.kind==='notice.deliver').packet;
 s.gmGame.socket.emit(MODULE_SOCKET,original,{recipients:['player-user-001']});
 await new Promise(r=>setTimeout(r,5));
 assert.equal(s.receives,1);
 assert.equal(s.traffic.filter(t=>t.packet.kind==='notice.receipt').length,2);
 s.gm.stop();s.player.stop();
});
