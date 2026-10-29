import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeFoundryContinuityTransport,validateContinuityProjection} from '../src/platform/foundry-continuity-transport.mjs';
import {MODULE_SOCKET} from '../src/platform/foundry-socket.mjs';
function setup({authorized=true,observerId='ep:actor:hero001'}={}){
 const users=new Map([['gm-user-001',{id:'gm-user-001',active:true,isGM:true}],['player-user-001',{id:'player-user-001',active:true,isGM:false}],['stranger-001',{id:'stranger-001',active:true,isGM:false}]]);
 const handlers=new Map(),traffic=[];
 function game(id){const subscribed=new Set();handlers.set(id,subscribed);return {user:users.get(id),users:{get:key=>users.get(key),get activeGM(){return users.get('gm-user-001');}},modules:{get:()=>({socket:true})},socket:{on:(channel,cb)=>{assert.equal(channel,MODULE_SOCKET);subscribed.add(cb);},off:(_c,cb)=>subscribed.delete(cb),emit:(channel,packet,{recipients})=>{
  assert.equal(channel,MODULE_SOCKET);traffic.push({from:id,to:recipients,packet:structuredClone(packet)});
  for(const target of recipients)for(const cb of handlers.get(target)??[])queueMicrotask(()=>cb(structuredClone(packet),id));
 }}};}
 const gmGame=game('gm-user-001'),playerGame=game('player-user-001'),strangerGame=game('stranger-001');
 let observerCalls=0;
 const gm=new NativeFoundryContinuityTransport({gameInstance:gmGame,actorAuthorization:async(user,actor)=>authorized&&user==='player-user-001'&&actor==='actor-native-001',resolveObserver:async()=>{observerCalls++;return observerId;},handoffs:{project:async({observerId})=>({recap:[{id:'ep:recap:public001',text:`Known to ${observerId}`} ]})},votes:{project:async()=>({id:'ep:vote-public:safe001',choiceId:'west-route',state:'finalized'})},quests:{project:async()=>null}}).start();
 const player=new NativeFoundryContinuityTransport({gameInstance:playerGame,randomId:()=>'request-player-001'}).start();
 return {gm,player,gmGame,playerGame,strangerGame,traffic,get observerCalls(){return observerCalls;},stop(){gm.stop();player.stop();}};
}
test('a player receives only a projected approved session recap through a targeted native reply',async()=>{
 const s=setup();const result=await s.player.request({kind:'session-recap',recordId:'ep:session:recap001',actorId:'actor-native-001'});
 assert.deepEqual(result,{recap:[{id:'ep:recap:public001',text:'Known to ep:actor:hero001'}]});
 assert.deepEqual(s.traffic.map(x=>x.to),[['gm-user-001'],['player-user-001']]);
 assert.equal(s.observerCalls,1);s.stop();
});
test('a finalized vote result exposes no ballots, GM identity or hidden state',async()=>{
 const s=setup();const result=await s.player.request({kind:'vote-result',recordId:'ep:vote:decision001',actorId:'actor-native-001'});
 assert.deepEqual(result,{id:'ep:vote-public:safe001',choiceId:'west-route',state:'finalized'});
 assert.equal(JSON.stringify(s.traffic).includes('ballot'),false);s.stop();
});
test('an unauthorized Actor receives indistinguishable unavailable response and no record data',async()=>{
 const s=setup({authorized:false});await assert.rejects(s.player.request({kind:'session-recap',recordId:'ep:session:recap001',actorId:'actor-native-001'}),{code:'CONTINUITY_UNAVAILABLE'});
 assert.equal(s.observerCalls,0);assert.equal(s.traffic.at(-1).packet.state,'unavailable');s.stop();
});
test('player rejects a forged GM reply, times out, and never trusts actorId in socket payload as proof',async()=>{
 const s=setup({authorized:false});const promise=s.player.request({kind:'vote-result',recordId:'ep:vote:decision001',actorId:'actor-native-001'},{timeoutMs:45});
 s.strangerGame.socket.emit(MODULE_SOCKET,{kind:'continuity.reply',version:1,requestId:'request-player-001',state:'ready',projectionKind:'vote-result',recordId:'ep:vote:decision001',value:{id:'ep:vote-public:forged',choiceId:'accept',state:'finalized'}},{recipients:['player-user-001']});
 await assert.rejects(promise,{code:'CONTINUITY_UNAVAILABLE'});s.stop();
});
test('strict projections reject private fields, hidden counts and oversized values',()=>{
 assert.throws(()=>validateContinuityProjection('session-recap',{recap:[],hiddenCount:3}),{code:'INVALID_PROJECTION'});
 assert.throws(()=>validateContinuityProjection('vote-result',{id:'ep:vote-public:one',choiceId:'accepted',state:'finalized',ballots:[]}),{code:'INVALID_PROJECTION'});
 assert.throws(()=>validateContinuityProjection('session-recap',{recap:[{id:'ep:public:one',text:'hello',gmNote:'hidden'}]}),{code:'INVALID_PROJECTION'});
});
test('player can request a knowledge-safe quest view with no hidden objective IDs',async()=>{
 const users=new Map([['gm-user-001',{id:'gm-user-001',active:true,isGM:true}],['player-user-001',{id:'player-user-001',active:true,isGM:false}]]);
 const events=new Map();function game(id){const set=new Set();events.set(id,set);return {user:users.get(id),users:{get:x=>users.get(x),get activeGM(){return users.get('gm-user-001');}},modules:{get:()=>({socket:true})},socket:{on:(_k,cb)=>set.add(cb),off:(_k,cb)=>set.delete(cb),emit:(_k,p,{recipients})=>{for(const who of recipients)for(const fn of events.get(who)??[])queueMicrotask(()=>fn(structuredClone(p),id));}}};}
 const gm=new NativeFoundryContinuityTransport({gameInstance:game('gm-user-001'),actorAuthorization:async()=>true,
  resolveObserver:async()=> 'ep:actor:hero001',handoffs:{project:async()=>({recap:[]})},votes:{project:async()=>null},quests:{project:async()=>({id:'ep:quest-public:harbor001',title:'Harbor',objectives:[{id:'ep:objective-public:harbor001',text:'Find entry',status:'active'}]})}}).start();
 const player=new NativeFoundryContinuityTransport({gameInstance:game('player-user-001'),randomId:()=>'request-quest-001'}).start();
 const projection=await player.request({kind:'quest-board',recordId:'ep:quest-publication:harbor001',actorId:'actor-native-001'});
 assert.equal(projection.objectives[0].id,'ep:objective-public:harbor001');
 assert.equal(JSON.stringify(projection).includes('ep:objective:harbor001'),false);
 gm.stop();player.stop();
});
test('quest projection rejects GM metadata and extra private objective fields',()=>{
 assert.throws(()=>validateContinuityProjection('quest-board',{id:'ep:quest-public:harbor001',title:'Harbor',objectives:[{id:'ep:objective-public:harbor001',text:'Find entry',status:'active',hidden:true}]}),{code:'INVALID_PROJECTION'});
});
