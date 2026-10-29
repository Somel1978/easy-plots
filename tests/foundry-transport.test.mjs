import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeFoundryIntentTransport,normalizePlayerIntent,MODULE_SOCKET} from '../src/platform/foundry-socket.mjs';

// Stand-in for Foundry v14 server handleCustomSocket. Authentication and recipient
// routing are modeled from the supplied source, NOT claimed as a real running server.
function simulation({gmActive=true,gmSocket=true}={}){
  const users=new Map([
    ['foundry-GM-001',{id:'foundry-GM-001',active:gmActive,isGM:true}],
    ['foundry-PLAYER-001',{id:'foundry-PLAYER-001',active:true,isGM:false}],
    ['foundry-PLAYER-002',{id:'foundry-PLAYER-002',active:true,isGM:false}]
  ]);
  const sinks=new Map();
  const events=[];
  const gameFor=(id)=>{
    const listeners=new Map();sinks.set(id,listeners);
    return {user:users.get(id), world:{id:'test-world'},modules:{get:()=>({socket:gmSocket})},
      users:{get:x=>users.get(x),get activeGM(){return users.get('foundry-GM-001').active?users.get('foundry-GM-001'):null;}},
      socket:{on:(e,fn)=>listeners.set(e,fn),off:(e,fn)=>{if(listeners.get(e)===fn)listeners.delete(e);},
        emit:(e,payload,opts)=>{
          assert.equal(e,MODULE_SOCKET);
          assert.ok(Array.isArray(opts?.recipients),'No broadcast fallback');
          events.push({from:id,to:opts.recipients,packet:payload});
          for(const dest of opts.recipients){const cb=sinks.get(dest)?.get(e);if(cb)queueMicrotask(()=>cb(structuredClone(payload),id));}
        }
      }};
  };
  return {users,gameFor,events,sinks};
}
function setup({actorAccess=true,gmActive=true,queue=true,gmSocket=true}={}) {
  const sim=simulation({gmActive,gmSocket});
  const gm=sim.gameFor('foundry-GM-001');
  const player=sim.gameFor('foundry-PLAYER-001');
  const observer=sim.gameFor('foundry-PLAYER-002');
  let writes=0;
  const durableIds=new Set();
  const gmTransport=new NativeFoundryIntentTransport({gameInstance:gm,
    actorAuthorization:async(u,a)=>actorAccess&&u==='foundry-PLAYER-001'&&a==='actor-12345',
    onAcceptedIntent:queue ? async (record)=>{
      const key=record.verifiedUserId+':'+record.requestId;
      if(!durableIds.has(key)){durableIds.add(key);writes++;}
      return {durable:true,secret:'must-not-be-returned'};
    } : null
  });
  const playerTransport=new NativeFoundryIntentTransport({gameInstance:player,
    randomId:()=>'request-12345'});
  gmTransport.start();playerTransport.start();
  return {...sim,gm,player,observer,gmTransport,playerTransport, get writes(){return writes;}};
}

const input={actorId:'actor-12345',opportunityId:'opportunity-12345',approach:'Check the ledger'};

test('v14 simulated transport: verified sender and targeted GM-to-player reply',async()=>{
  const s=setup();
  const receipt=await s.playerTransport.submit(input);
  assert.deepEqual(receipt,{requestId:'request-12345',state:'pending'});
  assert.equal(s.writes,1);
  assert.deepEqual(s.events.map(e=>e.to),[['foundry-GM-001'],['foundry-PLAYER-001']]);
  assert.ok(!JSON.stringify(s.events).includes('must-not-be-returned'));
  s.gmTransport.stop();s.playerTransport.stop();
});

test('payload claiming to be GM cannot impersonate server-attested sender', async()=>{
  const s=setup();
  const playerSocket=s.player.socket;
  playerSocket.emit(MODULE_SOCKET,{kind:'intent.request',version:1,
    claimedUserId:'foundry-GM-001',intent:{...input,requestId:'request-99999',claimedUserId:'foundry-GM-001'}},
    {recipients:['foundry-GM-001']});
  await new Promise(r=>setTimeout(r,15));
  assert.equal(s.writes,1);
  const reply=s.events.at(-1);
  assert.deepEqual(reply.to,['foundry-PLAYER-001']);
  assert.equal(reply.packet.state,'pending');
  s.gmTransport.stop();s.playerTransport.stop();
});

test('Actor ownership denial returns generic rejection',async()=>{
  const s=setup({actorAccess:false});
  assert.deepEqual(await s.playerTransport.submit(input),{requestId:'request-12345',state:'rejected'});
  assert.equal(s.writes,0);
  s.gmTransport.stop();s.playerTransport.stop();
});

test('no durable queue means never claim an accepted request',async()=>{
  const s=setup({queue:false});
  await assert.rejects(s.playerTransport.submit(input,{timeoutMs:30}),/No durable receipt/);
  assert.equal(s.writes,0);
  s.gmTransport.stop();s.playerTransport.stop();
});

test('transport refuses to register if module manifest socket is disabled',()=>{
  const s=simulation({gmSocket:false});
  const t=new NativeFoundryIntentTransport({gameInstance:s.gameFor('foundry-GM-001')});
  assert.throws(()=>t.start(),/socket: true/);
});

test('a player cannot forge a queued receipt for another player',async()=>{
  const s=setup();
  // GM intentionally not observing the request in this subcase.
  s.gmTransport.stop();
  const pending=s.playerTransport.submit(input,{timeoutMs:40});
  s.observer.socket.emit(MODULE_SOCKET,{kind:'intent.receipt',requestId:'request-12345',state:'pending'},
    {recipients:['foundry-PLAYER-001']});
  await assert.rejects(pending,/No durable receipt/);
  s.playerTransport.stop();
});

test('duplicate request IDs are idempotent only with durable queue contract',async()=>{
  const s=setup();
  const request={kind:'intent.request',version:1,intent:{requestId:'request-12345',...input}};
  s.player.socket.emit(MODULE_SOCKET,request,{recipients:['foundry-GM-001']});
  s.player.socket.emit(MODULE_SOCKET,request,{recipients:['foundry-GM-001']});
  await new Promise(r=>setTimeout(r,20));
  assert.equal(s.writes,1);
  s.gmTransport.stop();s.playerTransport.stop();
});

test('payload allowlist drops claimed identity, hidden metadata and actions',()=>{
  const result=normalizePlayerIntent({requestId:'request-12345',...input,
    claimedUserId:'foundry-GM-001',hiddenTruth:{actor:'Marrek'},privilegedEffect:'DELETE_ALL'});
  assert.equal(result.claimedUserId,undefined);
  assert.equal(result.hiddenTruth,undefined);
  assert.equal(result.privilegedEffect,undefined);
  assert.equal(result.approach,input.approach);
});

test('rejects oversized or malformed player intents',()=>{
  assert.throws(()=>normalizePlayerIntent({...input,requestId:'x'}),/Invalid request/);
  assert.throws(()=>normalizePlayerIntent({...input,requestId:'request-12345',approach:'x'.repeat(1025)}),/too long/);
  assert.throws(()=>normalizePlayerIntent({...input,requestId:'request-12345',approach:{secret:'x'}}),/must be text/);
});

test('no designated active GM: fail closed before sending',async()=>{
  const s=setup({gmActive:false});
  await assert.rejects(s.playerTransport.submit(input),/No eligible GM/);
  assert.equal(s.events.length,0);
  s.gmTransport.stop();s.playerTransport.stop();
});

test('stopped transport rejects pending requests and removes listener',async()=>{
  const s=setup();s.gmTransport.stop();
  const pending=s.playerTransport.submit(input,{timeoutMs:100});
  s.playerTransport.stop();
  await assert.rejects(pending,/Transport has stopped/);
});

import {createWorldActorAuthorizer,requireNativeStorageAdapter} from '../src/platform/foundry-actors.mjs';
test('native world Actor authorizer checks real permission, never player-claimed ownership',async()=>{
  const s=simulation();
  const gm=s.gameFor('foundry-GM-001');
  const user=s.users.get('foundry-PLAYER-001');
  gm.actors={get:id=>id==='actor-12345'?{testUserPermission:(x,level)=>x===user&&level==='OWNER'}:null};
  const check=createWorldActorAuthorizer(gm);
  assert.equal(await check(user.id,'actor-12345'),true);
  assert.equal(await check('foundry-PLAYER-002','actor-12345'),false);
  assert.equal(await check(user.id,'actor-unowned'),false);
  assert.equal(await check('foundry-GM-001','actor-12345'),false);
});
test('native durable queue adapter remains unavailable until verified',async()=>{
  assert.throws(()=>requireNativeStorageAdapter({enqueueOnce:async()=>({durable:true})}),/verified durable/);
  const calls=[];
  const persist=requireNativeStorageAdapter({nativeVerified:true,enqueueOnce:async(k,v)=>{
    calls.push([k,v]);return {durable:true};
  }});
  assert.deepEqual(await persist({verifiedUserId:'foundry-PLAYER-001',intent:{requestId:'request-12345'}}),{durable:true});
  assert.equal(calls[0][0],'foundry-PLAYER-001:request-12345');
});
