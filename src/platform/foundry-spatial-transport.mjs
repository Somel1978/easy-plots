/** Authenticated, targeted atlas queries. Players never initialize storage. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {atlasId,spatialScope,validateSpatialProjection} from '../domains/spatial-contract.mjs';
import {MODULE_SOCKET} from './foundry-socket.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const ID=/^[A-Za-z0-9_.:-]{8,160}$/;
const only=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k));
export class NativeFoundrySpatialTransport {
 #game;#proof;#service;#authorize;#observer;#random;#listener=null;#active=false;#pending=new Map();#inflight=0;
 constructor({gameInstance,attestation,service=null,actorAuthorization=null,resolveObserver=null,randomId=secureUUID}={}){this.#game=gameInstance;this.#proof=attestation;this.#service=service;this.#authorize=actorAuthorization;this.#observer=resolveObserver;this.#random=randomId;}
 get started(){return this.#active;}
 #gm(){const gm=this.#game?.users?.activeGM;return gm?.isGM&&gm.active&&ID.test(gm.id)?gm:null;}
 #verified(){if(this.#proof?.worldId!==this.#game.world?.id||!['socketSenderVerified','socketRecipientVerified','socketForgeryRejected','socketNoBroadcastVerified'].every(k=>this.#proof[k]===true))fail('SOCKET_UNVERIFIED','Exact-world authenticated targeted socket evidence required');}
 #server(){this.#verified();if(!this.#active||!this.#game.user?.isGM||this.#gm()?.id!==this.#game.user.id)fail('SPATIAL_AUTHORITY','Current designated GM required');}
 start(){
  this.#verified();if(typeof this.#game?.socket?.on!=='function'||typeof this.#game?.socket?.emit!=='function'||this.#game?.modules?.get?.('easy-plots')?.socket!==true)fail('SOCKET_UNAVAILABLE','Registered native module socket required');
  if(this.#game.user?.isGM&&(typeof this.#service?.projection!=='function'||typeof this.#authorize!=='function'||typeof this.#observer!=='function'))fail('SPATIAL_DEPENDENCY','GM atlas and authoritative Actor observer binding required');
  if(this.#active)return this;this.#listener=(packet,sender)=>{void this.#receive(packet,sender);};this.#game.socket.on(MODULE_SOCKET,this.#listener);this.#active=true;return this;
 }
 stop(){if(this.#listener)this.#game?.socket?.off?.(MODULE_SOCKET,this.#listener);this.#listener=null;this.#active=false;for(const pending of this.#pending.values()){clearTimeout(pending.timeout);pending.reject(new EasyPlotsError('TRANSPORT_STOPPED','Atlas requests stopped'));}this.#pending.clear();}
 #send(to,packet){this.#verified();if(!this.#active||!ID.test(to))fail('SOCKET_UNAVAILABLE','Authenticated atlas recipient required');this.#game.socket.emit(MODULE_SOCKET,packet,{recipients:[to]});}
 async request({atlasId:publicAtlasId,actorId,scope='world'},{requestId=null,timeoutMs=10000}={}){
  this.#verified();if(this.#game.user?.isGM)fail('PLAYER_ONLY','Player atlas request required');atlasId(publicAtlasId);spatialScope(scope);if(!ID.test(actorId)||!Number.isSafeInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)fail('SPATIAL_REQUEST','Native Actor and bounded request options required');
  const gm=this.#gm();if(!gm)fail('GM_UNAVAILABLE','Designated GM unavailable');requestId??=String(this.#random());if(!ID.test(requestId)||this.#pending.has(requestId)||this.#pending.size>=12)fail('BACKPRESSURE','Duplicate or excessive atlas requests');
  return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{this.#pending.delete(requestId);reject(new EasyPlotsError('REQUEST_TIMEOUT','No authenticated atlas reply'));},timeoutMs);this.#pending.set(requestId,{resolve,reject,timeout,atlasId:publicAtlasId,gmId:gm.id});try{this.#send(gm.id,{kind:'spatial.request',version:1,requestId,atlasId:publicAtlasId,actorId,scope});}catch(error){this.#pending.delete(requestId);clearTimeout(timeout);reject(error);}});
 }
 async #binding(sender,actorId){this.#server();const user=this.#game.users?.get?.(sender);if(!user?.active||user.isGM||await this.#authorize(sender,actorId)!==true)fail('SPATIAL_UNAVAILABLE','No approved spatial atlas available');const observer=await this.#observer({verifiedUserId:sender,actorId});assertNarrativeId(observer);this.#server();return observer;}
 async #receive(packet,sender){
  if(!this.#active||!ID.test(sender)||!this.#game.users?.get?.(sender)||!only(packet,['kind','version','requestId','atlasId','actorId','scope','state','value']))return;
  if(packet.kind==='spatial.reply')return this.#reply(packet,sender);
  if(packet.kind!=='spatial.request'||packet.version!==1||!ID.test(packet.requestId)||!only(packet,['kind','version','requestId','atlasId','actorId','scope'])||!this.#game.user?.isGM||this.#gm()?.id!==this.#game.user.id)return;
  const unavailable=()=>{try{this.#server();this.#send(sender,{kind:'spatial.reply',version:1,requestId:packet.requestId,state:'unavailable'});}catch{}};
  if(this.#inflight>=8)return unavailable();this.#inflight++;
  try{atlasId(packet.atlasId);spatialScope(packet.scope);if(!ID.test(packet.actorId))return unavailable();const observerId=await this.#binding(sender,packet.actorId),value=await this.#service.projection({scope:packet.scope,atlasId:packet.atlasId,observerId});validateSpatialProjection(value);if(value.id!==packet.atlasId||await this.#binding(sender,packet.actorId)!==observerId)return unavailable();this.#send(sender,{kind:'spatial.reply',version:1,requestId:packet.requestId,state:'ready',value});}
  catch{unavailable();}finally{this.#inflight--;}
 }
 #reply(packet,sender){
  if(this.#game.user?.isGM||packet.version!==1||sender!==this.#gm()?.id||!ID.test(packet.requestId)||!only(packet,['kind','version','requestId','state','value']))return;
  const pending=this.#pending.get(packet.requestId);if(!pending||pending.gmId!==sender||!['ready','unavailable'].includes(packet.state)||packet.state==='unavailable'&&Object.hasOwn(packet,'value'))return;
  try{this.#verified();if(packet.state==='ready'){validateSpatialProjection(packet.value);if(packet.value.id!==pending.atlasId)fail('INVALID_PROJECTION','Unexpected atlas response');}this.#pending.delete(packet.requestId);clearTimeout(pending.timeout);if(packet.state==='unavailable')pending.reject(new EasyPlotsError('SPATIAL_UNAVAILABLE','No approved spatial atlas available'));else pending.resolve(packet.value);}
  catch{this.#pending.delete(packet.requestId);clearTimeout(pending.timeout);pending.reject(new EasyPlotsError('INVALID_PROJECTION','Atlas response failed its projection contract'));}
 }
}
