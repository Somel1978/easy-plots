import test from 'node:test';
import assert from 'node:assert/strict';
import {NativePublicationKeyTransport} from '../src/platform/publication-key-transport.mjs';
import {MODULE_SOCKET} from '../src/platform/foundry-socket.mjs';
function network(provider){
 const users=new Map([['GMPrivateNative1',{id:'GMPrivateNative1',isGM:true,active:true}],['PlayerRecipient1',{id:'PlayerRecipient1',isGM:false,active:true}],['OtherRecipient01',{id:'OtherRecipient01',isGM:false,active:true}]]),listeners=new Map(),traffic=[];
 const game=id=>({user:users.get(id),users:{get:id=>users.get(id),get activeGM(){return users.get('GMPrivateNative1');}},modules:{get:()=>({socket:true})},socket:{on:(channel,fn)=>{assert.equal(channel,MODULE_SOCKET);listeners.set(id,fn);},off:()=>listeners.delete(id),emit:(channel,packet,{recipients})=>{assert.equal(channel,MODULE_SOCKET);assert.equal(recipients.length,1);traffic.push({from:id,to:recipients,packet:structuredClone(packet)});for(const target of recipients)queueMicrotask(()=>listeners.get(target)?.(structuredClone(packet),id));}}});
 const gmGame=game('GMPrivateNative1'),playerGame=game('PlayerRecipient1'),otherGame=game('OtherRecipient01'),gm=new NativePublicationKeyTransport({gameInstance:gmGame,keyProvider:provider}),player=new NativePublicationKeyTransport({gameInstance:playerGame}),other=new NativePublicationKeyTransport({gameInstance:otherGame});gm.start();player.start();other.start();return {gm,player,other,gmGame,playerGame,otherGame,traffic,users,game,stop(){gm.stop();player.stop();other.stop();}};
}
const request={nativeKind:'ChatMessage',nativeId:'PublicationTest1',actorId:'NativeActorKnown1'},key=btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
test('publication keys travel only to the authenticated requesting recipient and reference one exact native document',async()=>{
 let captured;const n=network(async input=>{captured=input;return {nativeKind:input.nativeKind,nativeId:input.nativeId,token:'public-token-001',key};});
 try{const result=await n.player.request(request,{requestId:'publication-key-001'});assert.equal(captured.verifiedUserId,'PlayerRecipient1');assert.equal(result.key,key);assert.deepEqual(n.traffic.map(t=>t.to),[['GMPrivateNative1'],['PlayerRecipient1']]);assert.equal(n.traffic.some(t=>t.to.includes('OtherRecipient01')),false);}finally{n.stop();}
});
test('forged sender fields and unauthorized requests return the same generic unavailability without keys',async()=>{
 let calls=0;const n=network(async input=>{calls++;if(input.verifiedUserId!=='PlayerRecipient1')throw Error('Denied');return {...request,token:'public-token-001',key};});
 try{
  await assert.rejects(()=>n.other.request(request,{requestId:'unauthorized-key-001'}),{code:'PUBLICATION_UNAVAILABLE'});assert.equal(n.traffic.at(-1).packet.key,undefined);
  n.otherGame.socket.emit(MODULE_SOCKET,{kind:'publication.key-request',version:1,requestId:'forged-key-request001',...request,claimedUserId:'PlayerRecipient1'},{recipients:['GMPrivateNative1']});await new Promise(r=>setTimeout(r,10));assert.equal(calls,1);assert.equal(n.traffic.at(-1).packet.state,'unavailable');assert.equal(n.traffic.at(-1).packet.key,undefined);
 }finally{n.stop();}
});
test('forged key replies cannot resolve another player request and stopped requests retain no pending key grant',async()=>{
 let release,entered=false;const n=network(async input=>{entered=true;await new Promise(r=>{release=r;});return {nativeKind:input.nativeKind,nativeId:input.nativeId,token:'public-token-001',key};});
 try{
  let resolved=false;const pending=n.player.request(request,{requestId:'pending-key-request001'});pending.then(()=>{resolved=true;},()=>{});
  while(!entered)await new Promise(r=>setImmediate(r));n.otherGame.socket.emit(MODULE_SOCKET,{kind:'publication.key-reply',version:1,requestId:'pending-key-request001',state:'ready',nativeKind:request.nativeKind,nativeId:request.nativeId,token:'forged-token-001',key},{recipients:['PlayerRecipient1']});await new Promise(r=>setTimeout(r,10));assert.equal(resolved,false);
  n.player.stop();await assert.rejects(()=>pending,{code:'PUBLICATION_UNAVAILABLE'});release();await new Promise(r=>setTimeout(r,10));
 }finally{n.stop();}
});
test('a co-GM requests a blind report through its authenticated role; a player without an Actor may request a public report',async()=>{
 let inputs=[];const n=network(async input=>{inputs.push(input);return {nativeKind:input.nativeKind,nativeId:input.nativeId,token:'role-grant-token001',key};});
 n.users.set('CoGMRecipient001',{id:'CoGMRecipient001',isGM:true,active:true});const peer=new NativePublicationKeyTransport({gameInstance:n.game('CoGMRecipient001')});peer.start();
 try{
  assert.equal((await peer.request({...request,actorId:''},{requestId:'blind-coGM-request001'})).key,key);assert.equal(inputs[0].verifiedUserId,'CoGMRecipient001');
  assert.equal((await n.player.request({...request,actorId:''},{requestId:'public-noActor-request001'})).key,key);assert.equal(inputs[1].actorId,'');assert.deepEqual(n.traffic.map(t=>t.to),[['GMPrivateNative1'],['CoGMRecipient001'],['GMPrivateNative1'],['PlayerRecipient1']]);
  await assert.rejects(n.gm.request({...request,actorId:''}),{code:'PLAYER_ONLY'});
 }finally{peer.stop();n.stop();}
});
