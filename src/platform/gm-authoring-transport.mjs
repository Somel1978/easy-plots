/** Private targeted GM authoring RPC; native appended sender ID is authoritative. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {clone} from '../contracts/record.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {normalizeGMAuthoringCommand} from '../orchestration/gm-plot-authoring.mjs';
import {MODULE_SOCKET} from './foundry-socket.mjs';
const ID=/^[A-Za-z0-9_.:-]{8,160}$/;
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const bounded=packet=>{try{return new TextEncoder().encode(JSON.stringify(packet)).length<=900_000;}catch{return false;}};
export class NativeGMAuthoringTransport {
 #game;#service;#proof;#scope;#listener=null;#active=false;#pending=new Map();#inflight=0;
 constructor({gameInstance,service=null,attestation,scope='main'}={}){this.#game=gameInstance;this.#service=service;this.#proof=attestation;this.#scope=scope;}
 get started(){return this.#active;}
 #gm(id){const user=this.#game.users?.get?.(id);return Boolean(user?.isGM&&user.active);}
 #coordinator(){const gm=this.#game.users?.activeGM;return gm?.isGM&&gm.active&&ID.test(gm.id)?gm:null;}
 start(){
  if(!this.#gm(this.#game.user?.id))fail('GM_REQUIRED','Current active GM required');
  if(this.#proof?.worldId!==this.#game.world?.id||!['socketSenderVerified','socketRecipientVerified','socketForgeryRejected','socketNoBroadcastVerified'].every(k=>this.#proof[k]===true))fail('SOCKET_UNVERIFIED','Exact-world authenticated targeted native socket evidence required');
  if(this.#game.modules?.get?.('easy-plots')?.socket!==true||typeof this.#game.socket?.on!=='function'||typeof this.#game.socket?.emit!=='function')fail('SOCKET_UNAVAILABLE','Registered native module socket required');
  if(!this.#active){this.#listener=(packet,senderId)=>{void this.#receive(packet,senderId);};this.#game.socket.on(MODULE_SOCKET,this.#listener);this.#active=true;}return {started:true};
 }
 stop(){if(this.#listener)this.#game.socket.off?.(MODULE_SOCKET,this.#listener);this.#listener=null;this.#active=false;for(const p of this.#pending.values()){clearTimeout(p.timeout);p.reject(new EasyPlotsError('GM_COMMAND_STOPPED','GM authoring transport stopped'));}this.#pending.clear();return {started:false};}
 #send(userId,packet){if(!this.#active||!this.#gm(this.#game.user.id)||!this.#gm(userId)||!bounded(packet))fail('GM_COMMAND_UNAVAILABLE','Exact GM recipient and bounded packet required');this.#game.socket.emit(MODULE_SOCKET,packet,{recipients:[userId]});}
 async request(method,args,{requestId=`gm-authoring-${secureUUID()}`,timeoutMs=10000}={}){
  args=normalizeGMAuthoringCommand(method,args);const coordinator=this.#coordinator(),userId=this.#game.user?.id;
  if(!this.#active||!this.#gm(userId)||!coordinator)fail('GM_COMMAND_UNAVAILABLE','Active GM authoring coordinator required');
  if(!ID.test(requestId)||!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)fail('GM_COMMAND_INVALID','Bounded request identity and timeout required');
  if(this.#pending.size>=16||this.#pending.has(requestId))fail('BACKPRESSURE','Duplicate or excessive pending commands');
  return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{this.#pending.delete(requestId);reject(new EasyPlotsError('GM_COMMAND_TIMEOUT',`No result for ${requestId}. Refresh before another change; preserve this request ID for inspection.`));},timeoutMs);this.#pending.set(requestId,{resolve,reject,timeout,coordinatorId:coordinator.id,userId});try{this.#send(coordinator.id,{kind:'gm.authoring-request',version:1,worldId:this.#game.world.id,scope:this.#scope,requestId,method,args});}catch(error){clearTimeout(timeout);this.#pending.delete(requestId);reject(error);}});
 }
 async #receive(packet,senderId){
  if(!this.#active||!packet||!ID.test(senderId??'')||!this.#gm(senderId)||!this.#gm(this.#game.user.id)||packet.version!==1||packet.worldId!==this.#game.world.id||packet.scope!==this.#scope||!ID.test(packet.requestId??'')||!bounded(packet))return;
  if(packet.kind==='gm.authoring-reply'){
   const pending=this.#pending.get(packet.requestId);if(!pending||senderId!==pending.coordinatorId||senderId!==this.#coordinator()?.id||pending.userId!==this.#game.user.id||Object.keys(packet).some(k=>!['kind','version','worldId','scope','requestId','state','result','code'].includes(k)))return;
   this.#pending.delete(packet.requestId);clearTimeout(pending.timeout);
   if(packet.state==='ready'&&packet.result&&typeof packet.result==='object')pending.resolve(clone(packet.result));else pending.reject(new EasyPlotsError(typeof packet.code==='string'&&/^[A-Z0-9_]{1,80}$/.test(packet.code)?packet.code:'GM_COMMAND_REJECTED','GM authoring command rejected; refresh the plot before another change'));return;
  }
  if(packet.kind!=='gm.authoring-request'||!this.#service||this.#coordinator()?.id!==this.#game.user.id)return;
  const requestId=packet.requestId,reply=(state,result=null,code=null)=>{if(this.#active&&this.#gm(senderId)&&this.#coordinator()?.id===this.#game.user.id){try{this.#send(senderId,{kind:'gm.authoring-reply',version:1,worldId:this.#game.world.id,scope:this.#scope,requestId,state,...(state==='ready'?{result}:{code})});}catch{}}};
  if(this.#inflight>=4)return reply('rejected',null,'BACKPRESSURE');this.#inflight++;
  try{if(Object.keys(packet).some(k=>!['kind','version','worldId','scope','requestId','method','args'].includes(k)))fail('GM_COMMAND_INVALID','Unexpected authoring packet fields');const method=packet.method,args=normalizeGMAuthoringCommand(method,packet.args);const result=await this.#service.execute({method,args,requestId,verifiedUserId:senderId});reply('ready',result);}catch(error){reply('rejected',null,typeof error?.code==='string'?error.code:'GM_COMMAND_FAILED');}finally{this.#inflight--;}
 }
}
