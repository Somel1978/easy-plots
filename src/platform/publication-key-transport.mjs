/** Per-request native socket key grants. Native document broadcasts never carry
 * this packet. Sender identity is appended by the v14 server, not the payload.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {requirePublicationCrypto} from '../security/publication-envelope.mjs';
import {MODULE_SOCKET} from './foundry-socket.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const ID=/^[A-Za-z0-9_.:-]{8,160}$/;
const ref=p=>p&&['ChatMessage','JournalEntry'].includes(p.nativeKind)&&typeof p.nativeId==='string'&&/^[A-Za-z0-9]{16}$/.test(p.nativeId);
export class NativePublicationKeyTransport {
 #game;#keys;#listener=null;#active=false;#pending=new Map();#inflight=0;
 constructor({gameInstance,keyProvider=null}={}){this.#game=gameInstance;this.#keys=keyProvider;}
 #gm(){const gm=this.#game?.users?.activeGM;return gm?.isGM&&gm.active&&ID.test(gm.id)?gm:null;}
 start(){
  if(typeof this.#game?.socket?.on!=='function'||typeof this.#game?.socket?.emit!=='function'||this.#game?.modules?.get?.('easy-plots')?.socket!==true)fail('SOCKET_UNAVAILABLE','Registered native module socket required');
  if(this.#game.user?.isGM&&this.#gm()?.id===this.#game.user.id&&typeof this.#keys!=='function')fail('PUBLICATION_SERVER_UNAVAILABLE','Protected key grant provider required');
  if(!this.#active){this.#listener=(packet,senderId)=>{void this.#receive(packet,senderId);};this.#game.socket.on(MODULE_SOCKET,this.#listener);this.#active=true;}return this;
 }
 stop(){
  if(this.#listener)this.#game.socket.off?.(MODULE_SOCKET,this.#listener);this.#listener=null;this.#active=false;
  for(const p of this.#pending.values()){clearTimeout(p.timeout);p.reject(new EasyPlotsError('PUBLICATION_UNAVAILABLE','Protected content is unavailable'));}this.#pending.clear();
 }
 #send(userId,packet){if(!this.#active||!ID.test(userId))fail('SOCKET_UNAVAILABLE','Exact authenticated recipient required');this.#game.socket.emit(MODULE_SOCKET,packet,{recipients:[userId]});}
 async request({nativeKind,nativeId,actorId},{requestId=secureUUID(),timeoutMs=10000}={}){
  requirePublicationCrypto();if(this.#game.user?.isGM&&this.#gm()?.id===this.#game.user.id)fail('PLAYER_ONLY','Authoritative GM reads its protected publication directly');
  if(!ref({nativeKind,nativeId})||!(actorId===''||ID.test(actorId))||!ID.test(requestId)||!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)fail('PUBLICATION_REQUEST','Bounded native document and optional owned Actor reference required');
  const gm=this.#gm();if(!gm)fail('GM_UNAVAILABLE','No authoritative GM is active');
  if(this.#pending.size>=16||this.#pending.has(requestId))fail('BACKPRESSURE','Duplicate or too many pending key requests');
  return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{this.#pending.delete(requestId);reject(new EasyPlotsError('PUBLICATION_UNAVAILABLE','Protected content is unavailable'));},timeoutMs);
   this.#pending.set(requestId,{resolve,reject,timeout,nativeKind,nativeId});
   try{this.#send(gm.id,{kind:'publication.key-request',version:1,requestId,nativeKind,nativeId,actorId});}catch(error){clearTimeout(timeout);this.#pending.delete(requestId);reject(error);}
  });
 }
 async #receive(packet,senderId){
  if(!this.#active||!packet||typeof packet!=='object'||!ID.test(senderId)||!this.#game.users?.get?.(senderId))return;
  if(packet.kind==='publication.key-reply')return this.#reply(packet,senderId);
  if(packet.kind!=='publication.key-request'||packet.version!==1||!this.#game.user?.isGM||this.#gm()?.id!==this.#game.user.id||!ID.test(packet.requestId))return;
  const sender=this.#game.users.get(senderId);if(!sender.active)return;
  const requestId=packet.requestId,deny=()=>{if(this.#active){try{this.#send(senderId,{kind:'publication.key-reply',version:1,requestId,state:'unavailable'});}catch{}}};
  if(this.#inflight>=8)return deny();this.#inflight++;
  try{
   if(Object.keys(packet).some(k=>!['kind','version','requestId','nativeKind','nativeId','actorId'].includes(k))||!ref(packet)||!(packet.actorId===''||ID.test(packet.actorId))||typeof this.#keys!=='function')return deny();
   const request={nativeKind:packet.nativeKind,nativeId:packet.nativeId,actorId:packet.actorId,verifiedUserId:senderId},grant=await this.#keys(request);
   if(!ref(grant)||grant.nativeId!==request.nativeId||grant.nativeKind!==request.nativeKind||!ID.test(grant.token)||typeof grant.key!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(grant.key))return deny();
   this.#send(senderId,{kind:'publication.key-reply',version:1,requestId,state:'ready',nativeKind:grant.nativeKind,nativeId:grant.nativeId,token:grant.token,key:grant.key});
  }catch{deny();}finally{this.#inflight--;}
 }
 #reply(packet,senderId){
  if(senderId!==this.#gm()?.id||packet.version!==1||!ID.test(packet.requestId)||!['ready','unavailable'].includes(packet.state))return;
  const pending=this.#pending.get(packet.requestId);if(!pending)return;
  this.#pending.delete(packet.requestId);clearTimeout(pending.timeout);
  if(packet.state!=='ready'||Object.keys(packet).some(k=>!['kind','version','requestId','state','nativeKind','nativeId','token','key'].includes(k))||!ref(packet)||packet.nativeKind!==pending.nativeKind||packet.nativeId!==pending.nativeId||!ID.test(packet.token)||typeof packet.key!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(packet.key))pending.reject(new EasyPlotsError('PUBLICATION_UNAVAILABLE','Protected content is unavailable'));
  else pending.resolve({nativeKind:packet.nativeKind,nativeId:packet.nativeId,token:packet.token,key:packet.key});
 }
}
