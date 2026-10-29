/** Native multiplayer setup probes. Every payload contains public setup
 * metadata or synthetic canaries; no narrative repository/provider is used. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
const CHANNEL='module.easy-plots',VERSION=1;
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const sessionKeys=['id','nonce','worldId','coreBuild','packId','canaryDocumentId','canaryMarker','startedAt','gmUserId'];
const fields={
 'setup.session':['gmUserId'],
 'setup.probe-result':['claimedUserId','probe'],
 'setup.arm':['roundId','targetUserId','witnessUserIds'],
 'setup.armed':['roundId','claimedUserId'],
 'setup.target':['roundId','targetUserId','marker'],
 'setup.target-result':['roundId','marker','claimedUserId'],
 'setup.finish':['roundId'],
 'setup.witness-result':['roundId','sawTarget','claimedUserId'],
 'setup.witness-leak':['roundId','claimedUserId']
};
const text=(value,max=160)=>typeof value==='string'&&value.length>0&&value.length<=max;
const own=(obj,keys)=>obj&&Object.getPrototypeOf(obj)===Object.prototype&&Object.keys(obj).every(key=>keys.includes(key));
const clone=value=>structuredClone(value);
function users(game){return game.users?.contents??[...(game.users?.values?.()??[])];}
function user(game,id){return game.users?.get?.(id)??users(game).find(u=>u.id===id);}
function currentBuild(game){return game.version??game.release?.version??(game.release?.generation&&game.release?.build?`${game.release.generation}.${game.release.build}`:null);}
function checkedSession(input,game){
 if(!own(input,sessionKeys)||!['id','worldId','coreBuild','packId','canaryDocumentId','canaryMarker','gmUserId'].every(key=>text(input[key]))||input.nonce!==undefined&&!text(input.nonce)||!Number.isSafeInteger(input.startedAt)||input.startedAt<0||input.worldId!==game.world?.id||currentBuild(game)!==input.coreBuild||!/^world\.[A-Za-z0-9_-]+$/.test(input.packId)||!/^[A-Za-z0-9_-]{8,80}$/.test(input.canaryDocumentId))fail('SETUP_SESSION_INVALID','Exact-world/build public synthetic canary session required');
 return clone(input);
}
function listedPack(value,packId){
 if(value?.has?.(packId))return true;
 if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(value,packId))return true;
 const rows=Array.isArray(value)?value:value?.contents??[...(value?.values?.()??[])];
 return rows.some(row=>typeof row==='string'?row===packId:row&&(row.id===packId||row.collection===packId||row.metadata?.id===packId||`${row.packageName}.${row.name}`===packId||row.packageType==='world'&&`world.${row.name}`===packId));
}
const probeKeys=['clientReadyAt','observedAt','packListed','bootstrapPackListed','bootstrapAvailable','apiAvailable','directIndexFetch','directDocumentFetch','playerIndexDenied','playerDocumentDenied','playerBootstrapDenied','reloaded','status'];
const outcomes=new Set(['denied','empty','exposed','api-missing','invalid-response']);
function checkedProbe(probe){
 if(!own(probe,probeKeys)||probeKeys.some(key=>!Object.hasOwn(probe,key))||!Number.isSafeInteger(probe.clientReadyAt)||!Number.isSafeInteger(probe.observedAt)||!outcomes.has(probe.directIndexFetch)||!outcomes.has(probe.directDocumentFetch)||!['passed','failed','reload-required','api-missing'].includes(probe.status)||probeKeys.filter(k=>!['clientReadyAt','observedAt','directIndexFetch','directDocumentFetch','status'].includes(k)).some(key=>typeof probe[key]!=='boolean'))fail('SETUP_PROBE_INVALID','Only bounded synthetic denial evidence is accepted');
 const index=probe.apiAvailable&&['denied','empty'].includes(probe.directIndexFetch),document=probe.apiAvailable&&['denied','empty'].includes(probe.directDocumentFetch),bootstrap=probe.reloaded&&probe.bootstrapAvailable&&!probe.packListed&&!probe.bootstrapPackListed;
 if(probe.playerIndexDenied!==index||probe.playerDocumentDenied!==document||probe.playerBootstrapDenied!==bootstrap)fail('SETUP_PROBE_INVALID','Probe summary differs from its concrete observations');
 return clone(probe);
}
/** Exact-canary low-level queries. Returned documents/errors are never copied
 * into reports or socket packets. An absent API cannot establish denial. */
export async function probePlayerPack({gameInstance,session,clientReadyAt}={}){
 const game=gameInstance;session=checkedSession(session,game);
 if(game.user?.isGM||!game.user?.active)fail('SETUP_PLAYER_REQUIRED','An active non-GM client must perform the independent canary probe');
 if(!Number.isSafeInteger(clientReadyAt))fail('SETUP_BOOTSTRAP_REQUIRED','The retained module-ready timestamp is required');
 const cls=game.documentClasses?.JournalEntry??globalThis.foundry?.documents?.JournalEntry?.implementation;
 const available=typeof cls?.database?.get==='function',bootstrapAvailable=typeof game.packs?.get==='function'&&game.data&&Object.hasOwn(game.data,'packs');
 const result={clientReadyAt,observedAt:Date.now(),packListed:!!game.packs?.get?.(session.packId),bootstrapPackListed:listedPack(game.data?.packs,session.packId),bootstrapAvailable:!!bootstrapAvailable,apiAvailable:available,directIndexFetch:'api-missing',directDocumentFetch:'api-missing',playerIndexDenied:false,playerDocumentDenied:false,playerBootstrapDenied:false,reloaded:clientReadyAt>=session.startedAt,status:'api-missing'};
 const read=async index=>{
  if(!available)return 'api-missing';
  try{const rows=await cls.database.get(cls,{query:{_id:session.canaryDocumentId},...(index?{index:true,indexFields:['name']}:{}),pack:session.packId},game.user);
   const records=Array.isArray(rows)?rows:Array.isArray(rows?.contents)?rows.contents:null;return records?records.length?'exposed':'empty':'invalid-response';
  }catch{return 'denied';}
 };
 result.directIndexFetch=await read(true);result.directDocumentFetch=await read(false);
 result.playerIndexDenied=available&&['denied','empty'].includes(result.directIndexFetch);result.playerDocumentDenied=available&&['denied','empty'].includes(result.directDocumentFetch);
 result.playerBootstrapDenied=result.reloaded&&result.bootstrapAvailable&&!result.packListed&&!result.bootstrapPackListed;
 result.status=!available?'api-missing':!result.reloaded?'reload-required':result.playerIndexDenied&&result.playerDocumentDenied&&result.playerBootstrapDenied?'passed':'failed';
 return result;
}
export class WorldSetupVerification {
 #game;#hooks;#settings;#packProbe;#onReport;#now;#readyAt;#listener;#hookIds=[];#session=null;#expected=[];#participants=new Map();#rounds=new Map();#localRounds=new Map();#canary=false;#issues=[];#sent=new Set();#responding=null;#roundStarting=false;
 constructor({gameInstance,hooks=null,settingsReader,probePrivatePack,onReport=null,now=Date.now}={}){
  if(!gameInstance||typeof settingsReader!=='function'||typeof now!=='function'||onReport!==null&&typeof onReport!=='function')fail('SETUP_VERIFIER_CONFIG','Native game, public session reader and clock are required');
  this.#game=gameInstance;this.#hooks=hooks;this.#settings=settingsReader;this.#packProbe=probePrivatePack;this.#onReport=onReport;this.#now=now;this.#readyAt=now();
 }
 get clientReadyAt(){return this.#readyAt;}
 get started(){return !!this.#listener;}
 #gm(session=this.#session){const current=session&&user(this.#game,session.gmUserId);return !!(current?.isGM&&current.active&&(!this.#game.users?.activeGM||this.#game.users.activeGM.id===current.id));}
 #isPlayer(id){const selected=user(this.#game,id);return !!(selected&&!selected.isGM&&selected.active);}
 #eligibleGM(){return !!(this.#session&&this.#game.user?.id===this.#session.gmUserId&&this.#gm()&&this.#game.user.isGM&&currentBuild(this.#game)===this.#session.coreBuild&&this.#game.world?.id===this.#session.worldId);}
 #notify(){try{Promise.resolve(this.#onReport?.(this.inspect())).catch(()=>{});}catch{}}
 #send(recipients,kind,body={}){
  if(!this.started||!this.#session||!this.#gm()||!Array.isArray(recipients)||!recipients.length||recipients.some(id=>!user(this.#game,id)?.active))fail('SETUP_TRANSPORT_UNAVAILABLE','A live session and exact active recipients are required');
  const packet={kind,version:VERSION,worldId:this.#session.worldId,sessionId:this.#session.id,...body};
  if(!fields[kind]||!own(packet,['kind','version','worldId','sessionId',...fields[kind]])||JSON.stringify(packet).length>6000)fail('SETUP_PACKET_INVALID','Only bounded public setup probes may leave this transport');
  this.#game.socket.emit(CHANNEL,packet,{recipients});
 }
 start(){
  if(this.started)return {started:true,clientReadyAt:this.#readyAt};
  if(this.#game.modules?.get?.('easy-plots')?.socket!==true||typeof this.#game.socket?.on!=='function'||typeof this.#game.socket?.emit!=='function'||typeof this.#game.socket?.off!=='function')fail('SETUP_SOCKET_UNAVAILABLE','The registered native Easy Plots module socket API is required');
  this.#listener=(packet,senderId)=>{void this.#receive(packet,senderId).catch(()=>{});};this.#game.socket.on(CHANNEL,this.#listener);
  const listen=(name,fn)=>{if(this.#hooks?.on)this.#hookIds.push([name,this.#hooks.on(name,fn)??fn]);};
  listen('ready',()=>{void this.respondPending().catch(()=>{});});listen('updateSetting',()=>{void this.respondPending().catch(()=>{});});listen('updateUser',()=>this.#notify());
  return {started:true,clientReadyAt:this.#readyAt};
 }
 stop(){if(this.#listener)this.#game.socket.off(CHANNEL,this.#listener);this.#listener=null;for(const [name,id] of this.#hookIds)this.#hooks?.off?.(name,id);this.#hookIds=[];this.#localRounds.clear();return {started:false};}
 async begin(input,{playerIds=null}={}){
  const session=checkedSession(input,this.#game);
  if(!this.started||!this.#game.user?.isGM||this.#game.user.id!==session.gmUserId||!user(this.#game,session.gmUserId)?.active)fail('SETUP_GM_REQUIRED','The current active GM must start this native canary session');
  this.#session=session;this.#canary=false;this.#participants.clear();this.#rounds.clear();this.#expected=[];this.#issues=[];this.#notify();if(!this.#eligibleGM())fail('SETUP_GM_REQUIRED','The current designated GM must own this verification');
  const stored=checkedSession(await this.#settings(),this.#game);if(sessionKeys.some(key=>stored[key]!==session[key]))fail('SETUP_SESSION_NOT_PERSISTED','Persist this exact public session before starting verification');
  if(typeof this.#packProbe!=='function')fail('SETUP_CANARY_UNVERIFIED','The GM must read back the exact synthetic private-pack canary');
  const proof=await this.#packProbe(clone(session));if(proof!==true&&proof?.canaryPresent!==true)fail('SETUP_CANARY_UNVERIFIED','Synthetic canary presence and marker were not confirmed by the GM');
  if(!this.#eligibleGM())fail('SETUP_GM_REQUIRED','GM authority changed while confirming the canary');
  const selected=playerIds??users(this.#game).filter(u=>u.active&&!u.isGM).map(u=>u.id);
  if(!Array.isArray(selected)||selected.length>32||new Set(selected).size!==selected.length||selected.some(id=>!text(id)||!this.#isPlayer(id)))fail('SETUP_PLAYERS_INVALID','Select up to 32 currently active non-GM canary witnesses');
  this.#expected=[...selected].sort();this.#participants.clear();this.#rounds.clear();this.#localRounds.clear();this.#issues=[];this.#canary=true;
  if(this.#expected.length)this.#send(this.#expected,'setup.session',{gmUserId:session.gmUserId});this.#notify();return this.inspect();
 }
 async respondPending(){
  if(this.#responding)return this.#responding;
  this.#responding=this.#respond();try{return await this.#responding;}finally{this.#responding=null;}
 }
 async #respond(){
  if(!this.started||this.#game.user?.isGM||!this.#game.user?.active)return {responded:false};
  const input=await this.#settings();if(!input)return {responded:false};const session=checkedSession(input,this.#game);if(!this.#gm(session))return {responded:false};
  this.#session=session;if(this.#sent.has(session.id))return {responded:false,alreadyReported:true};
  const probe=await probePlayerPack({gameInstance:this.#game,session,clientReadyAt:this.#readyAt});probe.observedAt=this.#now();
  if(!this.started||!this.#isPlayer(this.#game.user.id)||!this.#gm())return {responded:false};
  const latest=await this.#settings();if(latest?.id!==session.id)return {responded:false};
  this.#send([session.gmUserId],'setup.probe-result',{claimedUserId:session.gmUserId,probe});this.#sent.add(session.id);return {responded:true,probe};
 }
 async #storedMatches(){try{const current=await this.#settings();return current?.id===this.#session?.id&&current?.worldId===this.#session?.worldId&&current?.startedAt===this.#session?.startedAt;}catch{return false;}}
 async #receive(packet,senderId){
  if(!this.started||!packet||!fields[packet.kind]||!own(packet,['kind','version','worldId','sessionId',...fields[packet.kind]])||JSON.stringify(packet).length>6000||packet.version!==VERSION||packet.worldId!==this.#game.world?.id||!text(senderId)||!user(this.#game,senderId)?.active)return;
  if(packet.kind==='setup.session'){
   const stored=await this.#settings();if(!stored||packet.sessionId!==stored.id||packet.gmUserId!==senderId||stored.gmUserId!==senderId||!this.#gm(stored))return;
   await this.respondPending();return;
  }
  if(!this.#session||packet.sessionId!==this.#session.id||!this.#gm()||!(await this.#storedMatches()))return;
  if(this.#game.user?.isGM){
   if(!this.#eligibleGM()||!this.#expected.includes(senderId)||!this.#isPlayer(senderId))return;
   const claimed=packet.claimedUserId;
   if(packet.kind==='setup.probe-result'){
    const probe=checkedProbe(packet.probe);if(probe.clientReadyAt>this.#now()+1000||probe.observedAt<this.#session.startedAt||probe.observedAt>this.#now()+1000||probe.reloaded!==(probe.clientReadyAt>=this.#session.startedAt))return;
    const prior=this.#participants.get(senderId);if(prior&&JSON.stringify(prior.probe)!==JSON.stringify(probe)){
     if(probe.clientReadyAt<=prior.probe.clientReadyAt||probe.observedAt<prior.probe.observedAt){this.#issues.push('PLAYER_PROBE_CHANGED');this.#notify();return;}
     // A later module-ready timestamp is a new client bootstrap. Fresh
     // independent reads replace an earlier reload-required observation.
     for(const [id,round] of this.#rounds)if(round.targetUserId===senderId||round.witnessUserIds.includes(senderId))this.#rounds.delete(id);
    }
    if(probe.packListed||probe.bootstrapPackListed||probe.directIndexFetch==='exposed'||probe.directDocumentFetch==='exposed')this.#issues.push('PRIVATE_PACK_CANARY_EXPOSED');
    this.#participants.set(senderId,{userId:senderId,probe,senderClaimRejected:claimed===this.#session.gmUserId&&senderId!==claimed});await this.#advance();this.#notify();return;
   }
   const round=this.#rounds.get(packet.roundId);if(!round)return;
   if(packet.kind==='setup.armed'&&[round.targetUserId,...round.witnessUserIds].includes(senderId)&&claimed===this.#session.gmUserId){round.armed.add(senderId);if(round.armed.size===round.witnessUserIds.length+1&&!round.sent){round.sent=true;this.#send([round.targetUserId],'setup.target',{roundId:round.id,targetUserId:round.targetUserId,marker:round.marker});}}
   else if(packet.kind==='setup.target-result'&&senderId===round.targetUserId&&packet.marker===round.marker&&claimed===this.#session.gmUserId&&round.sent){round.targetConfirmed=true;this.#send([round.targetUserId,...round.witnessUserIds],'setup.finish',{roundId:round.id});}
   else if(packet.kind==='setup.witness-leak'&&round.witnessUserIds.includes(senderId)){round.leak=true;this.#issues.push('TARGET_PACKET_REACHED_UNAUTHORIZED_WITNESS');}
   else if(packet.kind==='setup.witness-result'&&round.witnessUserIds.includes(senderId)&&round.armed.has(senderId)&&round.targetConfirmed&&typeof packet.sawTarget==='boolean'&&claimed===this.#session.gmUserId){round.witnesses.set(senderId,!packet.sawTarget);if(packet.sawTarget){round.leak=true;this.#issues.push('TARGET_PACKET_REACHED_UNAUTHORIZED_WITNESS');}await this.#advance();}
   this.#notify();return;
  }
  if(senderId!==this.#session.gmUserId||!this.#isPlayer(this.#game.user.id))return;
  if(packet.kind==='setup.arm'){
   if(!text(packet.roundId)||!text(packet.targetUserId)||!Array.isArray(packet.witnessUserIds)||packet.witnessUserIds.length<1||packet.witnessUserIds.length>31||!([packet.targetUserId,...packet.witnessUserIds].includes(this.#game.user.id)))return;
   this.#localRounds.set(packet.roundId,{targetUserId:packet.targetUserId,witnessUserIds:[...packet.witnessUserIds],sawTarget:false});this.#send([senderId],'setup.armed',{roundId:packet.roundId,claimedUserId:senderId});
  }else{
   const round=this.#localRounds.get(packet.roundId);if(!round)return;
   if(packet.kind==='setup.target'){
    if(!text(packet.marker)||packet.targetUserId!==round.targetUserId)return;round.sawTarget=true;
    if(this.#game.user.id===round.targetUserId)this.#send([senderId],'setup.target-result',{roundId:packet.roundId,marker:packet.marker,claimedUserId:senderId});
    else this.#send([senderId],'setup.witness-leak',{roundId:packet.roundId,claimedUserId:senderId});
   }else if(packet.kind==='setup.finish'&&round.witnessUserIds.includes(this.#game.user.id))this.#send([senderId],'setup.witness-result',{roundId:packet.roundId,sawTarget:round.sawTarget,claimedUserId:senderId});
  }
 }
 #passed(){return [...this.#participants.values()].filter(p=>this.#isPlayer(p.userId)&&p.probe.clientReadyAt>=(this.#session?.startedAt??Infinity)&&p.probe.status==='passed'&&p.probe.playerIndexDenied&&p.probe.playerDocumentDenied&&p.probe.playerBootstrapDenied&&p.senderClaimRejected);}
 #complete(round){return round.targetConfirmed&&!round.leak&&round.witnessUserIds.every(id=>round.witnesses.get(id)===true);}
 async #advance(){
  if(this.#roundStarting||!this.#eligibleGM()||this.#issues.includes('TARGET_PACKET_REACHED_UNAUTHORIZED_WITNESS'))return;
  const players=this.#passed().map(p=>p.userId).sort();if(players.length<2)return;
  const pair=players.slice(0,2);if([...this.#rounds.values()].some(r=>!this.#complete(r)))return;
  const tested=new Set([...this.#rounds.values()].filter(r=>this.#complete(r)).map(r=>r.targetUserId)),target=pair.find(id=>!tested.has(id));if(!target)return;
  this.#roundStarting=true;try{const id=secureUUID(),round={id,targetUserId:target,witnessUserIds:pair.filter(id=>id!==target),marker:secureUUID(),armed:new Set(),witnesses:new Map(),sent:false,targetConfirmed:false,leak:false};this.#rounds.set(id,round);this.#send(pair,'setup.arm',{roundId:id,targetUserId:target,witnessUserIds:round.witnessUserIds});}finally{this.#roundStarting=false;}
 }
 inspect(){
  const passed=this.#passed(),exposed=this.#issues.includes('PRIVATE_PACK_CANARY_EXPOSED')||[...this.#participants.values()].some(p=>p.probe.packListed||p.probe.bootstrapPackListed||p.probe.directIndexFetch==='exposed'||p.probe.directDocumentFetch==='exposed'),current=this.started&&this.#eligibleGM(),storageReady=current&&this.#canary&&passed.length>=1&&!exposed;
  const completed=[...this.#rounds.values()].filter(r=>this.#complete(r)&&this.#isPlayer(r.targetUserId)&&r.witnessUserIds.every(id=>this.#isPlayer(id))),socketReady=storageReady&&passed.length>=2&&new Set(completed.map(r=>r.targetUserId)).size>=2&&!this.#issues.includes('TARGET_PACKET_REACHED_UNAUTHORIZED_WITNESS');
  return {kind:'world-setup-verification',session:this.#session?clone(this.#session):null,clientReadyAt:this.#readyAt,expectedUserIds:[...this.#expected],participants:[...this.#participants.values()].map(clone),storageReady,socketReady,
   flags:{playerIndexDenied:storageReady,playerDocumentDenied:storageReady,playerBootstrapDenied:storageReady,socketSenderVerified:socketReady,socketRecipientVerified:socketReady,socketForgeryRejected:socketReady,socketNoBroadcastVerified:socketReady},
   rounds:[...this.#rounds.values()].map(r=>({id:r.id,targetUserId:r.targetUserId,witnessUserIds:[...r.witnessUserIds],armedCount:r.armed.size,targetConfirmed:r.targetConfirmed,witnessReports:r.witnesses.size,leak:r.leak,complete:this.#complete(r)})),
   issues:[...new Set([...this.#issues,...(!storageReady?['RELOADED_PLAYER_STORAGE_PROOF_REQUIRED']:[]),...(!socketReady?['TWO_PLAYER_TARGET_AND_WITNESS_PROOFS_REQUIRED']:[]),...(exposed?['PRIVATE_PACK_CANARY_EXPOSED']:[])])]};
 }
}
