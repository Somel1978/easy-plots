import test from 'node:test';import assert from 'node:assert/strict';
import {NativeFoundryBoardTransport,makeNativeBoardLoader} from '../src/platform/foundry-board-transport.mjs';
import {MODULE_SOCKET} from '../src/platform/foundry-socket.mjs';
const investigationId='ep:investigation:shipment_001';
const actorId='world-actor-001',observer='ep:actor:player_001';
function network(){
  const users=new Map([['foundry-GM-001',{id:'foundry-GM-001',isGM:true,active:true}],
    ['foundry-PLAYER-001',{id:'foundry-PLAYER-001',isGM:false,active:true}],
    ['foundry-PLAYER-002',{id:'foundry-PLAYER-002',isGM:false,active:true}]]);
  const listeners=new Map(),traffic=[];
  function makeGame(id){
    const hooks=new Set();listeners.set(id,hooks);
    return {user:users.get(id),world:{id:'world'},modules:{get:()=>({socket:true})},
      users:{get:key=>users.get(key),get activeGM(){return users.get('foundry-GM-001');}},
      socket:{on:(name,fn)=>{assert.equal(name,MODULE_SOCKET);hooks.add(fn);},off:(name,fn)=>hooks.delete(fn),
        emit:(name,payload,{recipients}={})=>{
          assert.equal(name,MODULE_SOCKET);assert.ok(Array.isArray(recipients),'No broadcast');
          traffic.push({from:id,to:recipients,packet:structuredClone(payload)});
          for(const receiver of recipients)for(const handler of listeners.get(receiver)??[])queueMicrotask(()=>handler(structuredClone(payload),id));
        }}
    };
  }
  const gm=makeGame('foundry-GM-001'),player=makeGame('foundry-PLAYER-001'),stranger=makeGame('foundry-PLAYER-002');
  return {gm,player,stranger,traffic};
}
const source={id:investigationId,kind:'investigation',scope:'world',data:{title:'Shipping manifest',
  evidence:[{id:'ep:evidence:manifest_001',title:'Manifest',summary:'A route list',disclosedTo:[observer],canonicalSecret:'Marrek'},
    {id:'ep:evidence:gm_001',title:'Secret',summary:'GM truth',disclosedTo:[]}],
  theories:[],opportunities:[{id:'ep:opportunity:read_001',label:'Read ledger',currentlyAvailable:true,disclosedTo:[observer]}]}};
function setup({actorAccess=true,loader=null}={}){
  const n=network();const domains={read:async(type,scope,id)=>type==='investigation'&&scope==='world'&&id===investigationId?source:null};
  let reads=0;
  const loadBoard=loader??makeNativeBoardLoader({domains:{read:async(...args)=>{reads++;return domains.read(...args);}},
    resolveObserver:async({verifiedUserId,actorId:aid})=>verifiedUserId==='foundry-PLAYER-001'&&aid===actorId?observer:'ep:actor:unknown_001'});
  const gm=new NativeFoundryBoardTransport({gameInstance:n.gm,loadBoard,
    actorAuthorization:async(user,aid)=>actorAccess&&user==='foundry-PLAYER-001'&&aid===actorId});
  const player=new NativeFoundryBoardTransport({gameInstance:n.player,randomId:()=>'request-board-001'});
  gm.start();player.start();return {...n,gmTransport:gm,playerTransport:player,get reads(){return reads;}};
}
test('targeted authenticated request returns only disclosed evidence and offered actions',async()=>{
  const s=setup();const board=await s.playerTransport.request({investigationId,actorId});
  assert.equal(board.evidence.length,1);assert.equal(board.actions.length,1);
  assert.equal(s.reads,1);
  assert.deepEqual(s.traffic.map(t=>t.to),[['foundry-GM-001'],['foundry-PLAYER-001']]);
  assert.equal(JSON.stringify(s.traffic).includes('canonicalSecret'),false);
  assert.equal(JSON.stringify(s.traffic).includes('GM truth'),false);
  s.gmTransport.stop();s.playerTransport.stop();
});
test('invalid ownership returns generic unavailable without reading protected store',async()=>{
  const s=setup({actorAccess:false});
  await assert.rejects(s.playerTransport.request({investigationId,actorId}),{code:'BOARD_UNAVAILABLE'});
  assert.equal(s.reads,0);
  assert.equal(JSON.stringify(s.traffic).includes('Shipping manifest'),false);
  s.gmTransport.stop();s.playerTransport.stop();
});
test('forged sender in payload cannot retrieve another actor board',async()=>{
  const s=setup();s.stranger.socket.emit(MODULE_SOCKET,{kind:'board.request',version:1,
    requestId:'forged-req-001',investigationId,actorId,claimedUserId:'foundry-PLAYER-001'},{recipients:['foundry-GM-001']});
  await new Promise(r=>setTimeout(r,20));
  assert.equal(s.reads,0);
  const response=s.traffic.at(-1);assert.deepEqual(response.to,['foundry-PLAYER-002']);assert.equal(response.packet.state,'unavailable');
  s.gmTransport.stop();s.playerTransport.stop();
});
test('bad GM projection is rejected rather than sent, with no partial leak',async()=>{
  const s=setup({loader:async()=>({kind:'easy-plots-player-board',version:1,investigationId,title:'Secret',evidence:[],theories:[],actions:[],privateTruth:'Marrek'})});
  await assert.rejects(s.playerTransport.request({investigationId,actorId}),{code:'BOARD_UNAVAILABLE'});
  assert.equal(JSON.stringify(s.traffic).includes('privateTruth'),false);
  s.gmTransport.stop();s.playerTransport.stop();
});
test('player cannot request a board without active GM',async()=>{
  const s=setup();s.gm.user.active=false;
  await assert.rejects(s.playerTransport.request({investigationId,actorId}),{code:'GM_UNAVAILABLE'});
  s.gmTransport.stop();s.playerTransport.stop();
});
