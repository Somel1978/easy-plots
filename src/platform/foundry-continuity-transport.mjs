/** Authenticated, narrowly scoped player requests for approved session recaps and
 * finalized decisions. Deliberately separate from GM-native read APIs. A denied
 * request never reveals whether the underlying private record exists.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {MODULE_SOCKET} from './foundry-socket.mjs';

const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const ID=/^[A-Za-z0-9_.:-]{8,160}$/;
const KINDS=new Set(['session-recap','vote-result','quest-board']);
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const own=(obj,keys)=>isRecord(obj)&&Object.keys(obj).every(k=>keys.includes(k));
const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;

/** Strict response allowlisting: private IDs, GM status, evidence, ballots and
 * undisclosed row counts are never valid fields in an audience projection. */
export function validateContinuityProjection(kind,value){
 if(kind==='session-recap'){
  if(!own(value,['recap'])||!Array.isArray(value.recap)||value.recap.length>16)fail('INVALID_PROJECTION','Invalid recap structure');
  const seen=new Set();
  for(const item of value.recap){
   if(!own(item,['id','text'])||typeof item.text!=='string'||!item.text.trim()||item.text.length>320)fail('INVALID_PROJECTION','Invalid recap entry');
   assertNarrativeId(item.id);
   if(seen.has(item.id))fail('INVALID_PROJECTION','Duplicate public recap reference');seen.add(item.id);
  }
 }else if(kind==='quest-board'){
  if(value===null)return null;
  if(!own(value,['id','title','objectives'])||typeof value.title!=='string'||!value.title.trim()||value.title.length>100||
    !Array.isArray(value.objectives)||value.objectives.length<1||value.objectives.length>24)fail('INVALID_PROJECTION','Invalid quest projection');
  assertNarrativeId(value.id);
  const seen=new Set();
  for(const obj of value.objectives){
   if(!own(obj,['id','text','status'])||typeof obj.text!=='string'||!obj.text.trim()||obj.text.length>240||
      !['available','active','completed'].includes(obj.status))fail('INVALID_PROJECTION','Invalid audience objective');
   assertNarrativeId(obj.id);if(seen.has(obj.id))fail('INVALID_PROJECTION','Duplicate objective');seen.add(obj.id);
  }
 }else if(kind==='vote-result'){
  if(value===null)return null;
  if(!own(value,['id','choiceId','state'])||typeof value.choiceId!=='string'||value.choiceId.length>100||
    value.state!=='finalized')fail('INVALID_PROJECTION','Invalid final decision result');
  assertNarrativeId(value.id);
 }else fail('INVALID_PROJECTION','Unrecognized projection type');
 if(bytes(value)>8000)fail('PROJECTION_BUDGET','Audience projection exceeds message budget');
 return value;
}

export class NativeFoundryContinuityTransport {
 #game;#authorizer;#resolveObserver;#handoffs;#votes;#quests;#random;#listener=null;#pending=new Map();#active=false;
 constructor({gameInstance,actorAuthorization=null,resolveObserver=null,handoffs=null,votes=null,quests=null,randomId=secureUUID}={}){
  this.#game=gameInstance;this.#authorizer=actorAuthorization;this.#resolveObserver=resolveObserver;
  this.#handoffs=handoffs;this.#votes=votes;this.#quests=quests;this.#random=randomId;
 }
 #gm(){const gm=this.#game?.users?.activeGM;return gm?.isGM&&gm?.active&&ID.test(gm.id)?gm:null;}
 start(){
  if(typeof this.#game?.socket?.on!=='function'||typeof this.#game?.socket?.emit!=='function'||
    this.#game?.modules?.get?.('easy-plots')?.socket!==true)fail('SOCKET_UNAVAILABLE','Registered module socket required');
  if(this.#game.user?.isGM&&(!this.#authorizer||typeof this.#resolveObserver!=='function'||
    typeof this.#handoffs?.project!=='function'||typeof this.#votes?.project!=='function'||typeof this.#quests?.project!=='function'))
   fail('CONTINUITY_SERVER_UNAVAILABLE','GM projection services and authoritative Actor binding required');
  if(this.#active)return this;
  this.#listener=(packet,senderId)=>{void this.#receive(packet,senderId);};
  this.#game.socket.on(MODULE_SOCKET,this.#listener);this.#active=true;return this;
 }
 stop(){
  if(this.#listener)this.#game?.socket?.off?.(MODULE_SOCKET,this.#listener);
  this.#listener=null;this.#active=false;
  for(const p of this.#pending.values()){
   clearTimeout(p.timeout);p.reject(new EasyPlotsError('TRANSPORT_STOPPED','Continuity requests stopped'));
  }
  this.#pending.clear();
 }
 #send(to,packet){
  if(!this.#active||!ID.test(to))fail('SOCKET_UNAVAILABLE','Authenticated targeted recipient required');
  this.#game.socket.emit(MODULE_SOCKET,packet,{recipients:[to]});
 }
 async request({kind,recordId,actorId},{requestId=null,timeoutMs=10000}={}){
  if(this.#game?.user?.isGM)fail('PLAYER_ONLY','Player projection request required');
  if(!KINDS.has(kind)||!ID.test(actorId))fail('CONTINUITY_REQUEST','Valid projection kind and native Actor required');
  assertNarrativeId(recordId);
  if(kind==='session-recap'&&!recordId.startsWith('ep:session:'))fail('CONTINUITY_REQUEST','Session identifier expected');
  if(kind==='vote-result'&&!recordId.startsWith('ep:vote:'))fail('CONTINUITY_REQUEST','Decision identifier expected');
  if(kind==='quest-board'&&!recordId.startsWith('ep:quest-publication:'))fail('CONTINUITY_REQUEST','Quest publication identifier expected');
  const gm=this.#gm();if(!gm)fail('GM_UNAVAILABLE','Designated GM unavailable');
  requestId??=String(this.#random());
  if(!ID.test(requestId)||!Number.isSafeInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)fail('CONTINUITY_REQUEST','Invalid request options');
  if(this.#pending.size>=12||this.#pending.has(requestId))fail('BACKPRESSURE','Too many pending requests');
  return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{this.#pending.delete(requestId);reject(new EasyPlotsError('REQUEST_TIMEOUT','No authenticated reply'));},timeoutMs);
   this.#pending.set(requestId,{resolve,reject,timeout,kind,recordId});
   try{this.#send(gm.id,{kind:'continuity.request',version:1,requestId,projectionKind:kind,recordId,actorId});}
   catch(error){clearTimeout(timeout);this.#pending.delete(requestId);reject(error);}
  });
 }
 async #receive(packet,senderId){
  if(!this.#active||!isRecord(packet)||!ID.test(senderId)||!this.#game?.users?.get?.(senderId))return;
  if(packet.kind==='continuity.reply')return this.#receiveReply(packet,senderId);
  if(packet.kind!=='continuity.request'||packet.version!==1||!this.#game.user?.isGM||this.#gm()?.id!==this.#game.user.id)return;
  if(!own(packet,['kind','version','requestId','projectionKind','recordId','actorId'])||!ID.test(packet.requestId))return;
  const user=this.#game.users.get(senderId);
  if(user?.isGM||!user?.active)return;
  const unavailable=()=>this.#send(senderId,{kind:'continuity.reply',version:1,requestId:packet.requestId,state:'unavailable'});
  try{
   if(!KINDS.has(packet.projectionKind)||!ID.test(packet.actorId))return unavailable();
   assertNarrativeId(packet.recordId);
   if(packet.projectionKind==='session-recap'&&!packet.recordId.startsWith('ep:session:'))return unavailable();
   if(packet.projectionKind==='vote-result'&&!packet.recordId.startsWith('ep:vote:'))return unavailable();
   if(packet.projectionKind==='quest-board'&&!packet.recordId.startsWith('ep:quest-publication:'))return unavailable();
   if(await this.#authorizer(senderId,packet.actorId)!==true)return unavailable();
   const observerId=await this.#resolveObserver({verifiedUserId:senderId,actorId:packet.actorId});
   assertNarrativeId(observerId);
   const value=packet.projectionKind==='session-recap'?
     await this.#handoffs.project({sessionId:packet.recordId,observerId}):
     packet.projectionKind==='vote-result'?await this.#votes.project({decisionId:packet.recordId,observerId}):
     await this.#quests.project({publicationId:packet.recordId,observerId});
   validateContinuityProjection(packet.projectionKind,value);
   // Never disclose private record existence via missing vote or handoff status.
   if(value===null||packet.projectionKind==='session-recap'&&value.recap.length===0)return unavailable();
   this.#send(senderId,{kind:'continuity.reply',version:1,requestId:packet.requestId,state:'ready',projectionKind:packet.projectionKind,recordId:packet.recordId,value});
  }catch{return unavailable();}
 }
 #receiveReply(packet,senderId){
  if(this.#game.user?.isGM||senderId!==this.#gm()?.id||packet.version!==1||!ID.test(packet.requestId))return;
  const pending=this.#pending.get(packet.requestId);if(!pending)return;
  if(!own(packet,['kind','version','requestId','state','projectionKind','recordId','value'])||!['ready','unavailable'].includes(packet.state))return;
  if(packet.state==='ready'&&(packet.projectionKind!==pending.kind||packet.recordId!==pending.recordId))return;
  if(packet.state!=='ready'&&Object.hasOwn(packet,'value'))return;
  this.#pending.delete(packet.requestId);clearTimeout(pending.timeout);
  if(packet.state==='unavailable')return pending.reject(new EasyPlotsError('CONTINUITY_UNAVAILABLE','No approved projection available'));
  try{validateContinuityProjection(pending.kind,packet.value);pending.resolve(packet.value);}
  catch{return pending.reject(new EasyPlotsError('INVALID_PROJECTION','GM response failed strict projection validation'));}
 }
}
