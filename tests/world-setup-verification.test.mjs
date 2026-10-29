import test from 'node:test';import assert from 'node:assert/strict';
import {WorldSetupVerification,probePlayerPack} from '../src/platform/world-setup-verification.mjs';
const session=(overrides={})=>({id:'setup_session_nonce001',worldId:'setup-world',coreBuild:'14.369',packId:'world.easy-plots-private',canaryDocumentId:'CanaryDocument01',canaryMarker:'SYNTHETIC_CANARY_MARKER_001',startedAt:1000,gmUserId:'GM_setup_001',...overrides});
function environment({players=2,broadcastTargets=false,dropKinds=[]}={}){
 const gm={id:'GM_setup_001',isGM:true,active:true},all=[gm,...Array.from({length:players},(_,i)=>({id:`PLAYER_setup_00${i+1}`,isGM:false,active:true}))],people=new Map(all.map(u=>[u.id,u])),listeners=new Map(),packReads=[],sent=[],instances=[];let stored=null,time=900;
 const games=all.map(person=>({user:person,world:{id:'setup-world'},version:'14.369',ready:true,users:{contents:all,get:id=>people.get(id),activeGM:gm},modules:new Map([['easy-plots',{socket:true}]]),packs:new Map(),data:{packs:[]},
  documentClasses:{JournalEntry:{database:{get:async(cls,options,actor)=>{packReads.push({userId:actor.id,options:structuredClone(options)});throw Error('Native permission denied');}}}},
  socket:{on(_channel,fn){const set=listeners.get(person.id)??new Set();set.add(fn);listeners.set(person.id,set);},off(_channel,fn){listeners.get(person.id)?.delete(fn);},emit(channel,packet,options){assert.equal(channel,'module.easy-plots');assert(Array.isArray(options.recipients));sent.push({senderId:person.id,packet:structuredClone(packet),recipients:[...options.recipients]});if(dropKinds.includes(packet.kind))return;const recipients=broadcastTargets&&packet.kind==='setup.target'?all.filter(u=>u.active).map(u=>u.id):options.recipients;for(const id of recipients)for(const fn of listeners.get(id)??[])queueMicrotask(()=>fn(structuredClone(packet),person.id));}}
 }));
 const reports=[],make=(index,readyAt=time)=>{const verifier=new WorldSetupVerification({gameInstance:games[index],settingsReader:()=>stored,probePrivatePack:async input=>input.canaryMarker===session().canaryMarker,onReport:r=>reports.push(r),now:()=>readyAt===null?time:readyAt});instances.push(verifier);verifier.start();return verifier;};
 return {gm,all,games,people,listeners,sent,packReads,reports,make,get stored(){return stored;},set stored(value){stored=value;},get time(){return time;},set time(value){time=value;},stop(){instances.forEach(v=>v.stop());}};
}
async function flush(){for(let n=0;n<12;n++)await new Promise(resolve=>setImmediate(resolve));}
test('player independently probes exact native canary index/document and never treats a missing API as denied',async()=>{
 const e=environment({players:1});try{const g=e.games[1],s=session();let result=await probePlayerPack({gameInstance:g,session:s,clientReadyAt:1100});assert.equal(result.status,'passed');assert.equal(e.packReads.length,2);for(const row of e.packReads){assert.equal(row.userId,g.user.id);assert.deepEqual(row.options.query,{_id:s.canaryDocumentId});assert.equal(row.options.pack,s.packId);}assert.equal(e.packReads[0].options.index,true);
  g.documentClasses.JournalEntry={};result=await probePlayerPack({gameInstance:g,session:s,clientReadyAt:1100});assert.equal(result.apiAvailable,false);assert.equal(result.playerIndexDenied,false);assert.equal(result.playerDocumentDenied,false);assert.equal(result.status,'api-missing');
 }finally{e.stop();}
});
test('canary content or bootstrap pack visibility fails storage privacy without returning any document content',async()=>{
 const e=environment({players:1});try{const g=e.games[1],s=session();g.documentClasses.JournalEntry.database.get=async()=>[{_id:s.canaryDocumentId,name:'PRIVATE_NARRATIVE_CONTENT',flags:{'easy-plots':{storage:{value:'PRIVATE_NARRATIVE_CONTENT'}}}}];const result=await probePlayerPack({gameInstance:g,session:s,clientReadyAt:1100});assert.equal(result.playerIndexDenied,false);assert.equal(result.playerDocumentDenied,false);assert.equal(result.directDocumentFetch,'exposed');assert(!JSON.stringify(result).includes('PRIVATE_NARRATIVE_CONTENT'));
  g.documentClasses.JournalEntry.database.get=async()=>[];g.data.packs=[{packageType:'world',name:'easy-plots-private'}];const listed=await probePlayerPack({gameInstance:g,session:s,clientReadyAt:1100});assert.equal(listed.bootstrapPackListed,true);assert.equal(listed.playerBootstrapDenied,false);
 }finally{e.stop();}
});
test('client-ready timestamp is retained and stale bootstrap needs an actual new player module instance',async()=>{
 const e=environment({players:1});try{const server=e.make(0,null),old=e.make(1,null);e.stored=session();e.time=1000;await server.begin(e.stored);await flush();assert.equal(old.clientReadyAt,900);assert.equal(server.inspect().storageReady,false);assert.equal(server.inspect().participants[0].probe.status,'reload-required');
  old.stop();e.time=1200;const reloaded=e.make(1,1200);await reloaded.respondPending();await flush();assert.equal(server.inspect().storageReady,true);assert.equal(server.inspect().socketReady,false);assert.equal(server.inspect().flags.socketNoBroadcastVerified,false);
 }finally{e.stop();}
});
test('two reloaded real clients prove appended sender IDs and reciprocal target/witness delivery without narrative packets',async()=>{
 const e=environment();try{const server=e.make(0,null);e.stored=session();e.time=1000;await server.begin(e.stored);e.time=1200;const a=e.make(1,1200),b=e.make(2,1200);await Promise.all([a.respondPending(),b.respondPending()]);await flush();const report=server.inspect();assert.equal(report.storageReady,true);assert.equal(report.socketReady,true);assert(Object.values(report.flags).every(Boolean));assert.equal(report.rounds.length,2);assert(report.rounds.every(r=>r.complete&&r.witnessReports===1));assert(report.participants.every(p=>p.senderClaimRejected&&p.userId!==e.gm.id));
  assert(e.sent.every(row=>row.packet.kind.startsWith('setup.')));assert(e.sent.filter(row=>row.packet.kind==='setup.target').every(row=>row.recipients.length===1&&row.recipients[0]===row.packet.targetUserId));assert(!JSON.stringify(e.sent).includes('providerId'));assert(!JSON.stringify(e.sent).includes('PRIVATE_NARRATIVE_CONTENT'));
 }finally{e.stop();}
});
test('no response and a missing witness can never produce socket attestation',async()=>{
 const e=environment({dropKinds:['setup.witness-result']});try{const server=e.make(0,null);e.stored=session();e.time=1000;await server.begin(e.stored);await flush();assert.equal(server.inspect().storageReady,false);assert(Object.values(server.inspect().flags).every(value=>value===false));e.time=1200;const a=e.make(1,1200),b=e.make(2,1200);await Promise.all([a.respondPending(),b.respondPending()]);await flush();assert.equal(server.inspect().storageReady,true);assert.equal(server.inspect().socketReady,false);assert.equal(server.inspect().flags.socketNoBroadcastVerified,false);assert(server.inspect().rounds.some(r=>r.targetConfirmed&&!r.complete));
 }finally{e.stop();}
});
test('an unauthorized witness receiving a supposedly targeted packet permanently rejects no-broadcast proof',async()=>{
 const e=environment({broadcastTargets:true});try{const server=e.make(0,null);e.stored=session();e.time=1000;await server.begin(e.stored);e.time=1200;const a=e.make(1,1200),b=e.make(2,1200);await Promise.all([a.respondPending(),b.respondPending()]);await flush();const report=server.inspect();assert.equal(report.storageReady,true);assert.equal(report.socketReady,false);assert.equal(report.flags.socketNoBroadcastVerified,false);assert(report.issues.includes('TARGET_PACKET_REACHED_UNAUTHORIZED_WITNESS'));
 }finally{e.stop();}
});
test('forged sender claims, late unselected users and non-allowlisted packet data cannot establish proof',async()=>{
 const e=environment({players:3});try{const server=e.make(0,null);e.stored=session();e.time=1000;await server.begin(e.stored,{playerIds:[e.all[1].id,e.all[2].id]});e.time=1200;const late=e.make(3,1200);await late.respondPending();await flush();assert.equal(server.inspect().participants.length,0);
  const probe=await probePlayerPack({gameInstance:e.games[1],session:e.stored,clientReadyAt:1200});probe.observedAt=1200;e.games[1].socket.emit('module.easy-plots',{kind:'setup.probe-result',version:1,worldId:e.stored.worldId,sessionId:e.stored.id,claimedUserId:e.gm.id,probe:{...probe,providerId:'unsafe.injected'}},{recipients:[e.gm.id]});await flush();assert.equal(server.inspect().participants.length,0);
  e.games[1].socket.emit('module.easy-plots',{kind:'setup.probe-result',version:1,worldId:e.stored.worldId,sessionId:e.stored.id,claimedUserId:e.gm.id,probe},{recipients:[e.gm.id]});await flush();assert.deepEqual(server.inspect().participants.map(p=>p.userId),[e.all[1].id]);assert.equal(server.inspect().socketReady,false);assert.equal(server.inspect().flags.socketSenderVerified,false);
 }finally{e.stop();}
});
test('current GM revocation and failed replacement canary verification immediately invalidate prior readiness',async()=>{
 const e=environment({players:1});try{const server=e.make(0,null);e.stored=session();e.time=1000;await server.begin(e.stored);e.time=1200;await e.make(1,1200).respondPending();await flush();assert.equal(server.inspect().storageReady,true);e.gm.isGM=false;assert.equal(server.inspect().storageReady,false);assert(Object.values(server.inspect().flags).every(v=>v===false));await assert.rejects(server.begin(e.stored),{code:'SETUP_GM_REQUIRED'});e.gm.isGM=true;
  e.stored=session({id:'replacement_session001',canaryMarker:'A_DIFFERENT_SYNTHETIC_CANARY',startedAt:1300});e.time=1300;await assert.rejects(server.begin(e.stored),{code:'SETUP_CANARY_UNVERIFIED'});assert.equal(server.inspect().storageReady,false);
 }finally{e.stop();}
});
test('wrong world/build sessions and unregistered native sockets are rejected before canary reads',async()=>{
 const e=environment({players:1});try{const server=e.make(0,null);e.stored=session({coreBuild:'14.370'});await assert.rejects(server.begin(e.stored),{code:'SETUP_SESSION_INVALID'});assert.equal(e.packReads.length,0);e.games[1].modules=new Map();const verifier=new WorldSetupVerification({gameInstance:e.games[1],settingsReader:()=>null});assert.throws(()=>verifier.start(),{code:'SETUP_SOCKET_UNAVAILABLE'});
 }finally{e.stop();}
});
