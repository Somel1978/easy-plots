/** Targeted, authenticated delivery of already approved narrative notices.
 * The GM selects an exact notice; the binding resolver and authorizer must
 * independently agree on the server-side recipient. Client ACK means receipt
 * by the client callback, NOT proof the human read or acted on the message.
 * An interrupted delivery remains uncertain and is never retried automatically.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {MODULE_SOCKET} from './foundry-socket.mjs';
import {validateNoticeView} from '../contracts/notification-view.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const ID=/^[A-Za-z0-9_.:-]{8,160}$/;
const LEVELS=new Set(['info','attention','urgent']);
export function validateNotificationPacket(packet){
 if(!packet||typeof packet!=='object'||Array.isArray(packet)||Object.keys(packet).some(k=>!['kind','version','deliveryId','noticeId','text','level','group'].includes(k))||
    packet.kind!=='notice.deliver'||![1,2].includes(packet.version)||(packet.version===2)!==(packet.group!==undefined)||!ID.test(packet.deliveryId)||!LEVELS.has(packet.level)||
    typeof packet.text!=='string'||!packet.text.trim()||packet.text.length>280)fail('INVALID_NOTIFICATION','Untrusted notification payload');
 assertNarrativeId(packet.noticeId);
 return Object.freeze(validateNoticeView({id:packet.noticeId,text:packet.text,level:packet.level,...(packet.group?{group:packet.group}:{})}));
}
export class NativeFoundryNotificationTransport {
 #game;#service;#resolve;#authorize;#onReceive;#writerCheck;#random;
 #listener=null;#active=false;#pending=new Map();#seen=new Set();#byNotice=new Set();
 constructor({gameInstance,service=null,resolveRecipientUser=null,authorizeRecipient=null,onReceive=null,
   checkGM=null,randomId=()=>`ep:delivery:${secureUUID().replaceAll('-','_')}`}={}){
  this.#game=gameInstance;this.#service=service;this.#resolve=resolveRecipientUser;
  this.#authorize=authorizeRecipient;this.#onReceive=onReceive;this.#writerCheck=checkGM;this.#random=randomId;
 }
 get started(){return this.#active;}
 #gm(){const gm=this.#game?.users?.activeGM;return gm?.active&&gm.isGM&&ID.test(gm.id)?gm:null;}
 start(){
  if(typeof this.#game?.socket?.on!=='function'||typeof this.#game?.socket?.emit!=='function'||this.#game?.modules?.get?.('easy-plots')?.socket!==true)
   fail('SOCKET_UNAVAILABLE','Verified module socket required');
  if(this.#game?.user?.isGM&&(!this.#service||typeof this.#resolve!=='function'||typeof this.#authorize!=='function'||typeof this.#writerCheck!=='function'))
   fail('NOTIFICATION_SERVER_UNAVAILABLE','GM notification service, authority and recipient binding required');
  if(!this.#game?.user?.isGM&&typeof this.#onReceive!=='function')fail('NOTIFICATION_CLIENT_UNAVAILABLE','Visible client receiver required');
  if(this.#active)return this;
  this.#listener=(packet,senderId)=>{void this.#receive(packet,senderId);};
  this.#game.socket.on(MODULE_SOCKET,this.#listener);this.#active=true;return this;
 }
 stop(){
  if(this.#listener)this.#game?.socket?.off?.(MODULE_SOCKET,this.#listener);
  this.#active=false;this.#listener=null;
  for(const p of this.#pending.values()){clearTimeout(p.timeout);p.reject(new EasyPlotsError('DELIVERY_UNCERTAIN','Transport stopped before receipt'));}
  this.#pending.clear();this.#byNotice.clear();this.#seen.clear();
 }
 #send(userId,packet){if(!this.#active||!ID.test(userId))fail('SOCKET_UNAVAILABLE','Exact recipient is required');
  this.#game.socket.emit(MODULE_SOCKET,packet,{recipients:[userId]});
 }
 async deliver({scope='world',noticeId,worldTime=null},{timeoutMs=10000}={}){
  if(!this.#game?.user?.isGM||this.#gm()?.id!==this.#game.user.id)fail('GM_REQUIRED','Designated GM required');
  if(!this.#active)fail('SOCKET_UNAVAILABLE','GM notification transport is not running');
  this.#writerCheck();assertNarrativeId(noticeId);
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)fail('DELIVERY_TIMEOUT','Invalid receipt timeout');
  const key=`${scope}:${noticeId}`;
  if(this.#pending.size>=16||this.#byNotice.has(key))fail('BACKPRESSURE','Concurrent or too many notification deliveries');
  this.#byNotice.add(key);
  try{
  const row=await this.#service.read({scope,noticeId});
  if(!row||row.data.state!=='published')fail('NOTICE_NOT_APPROVED','Only published notices may be delivered');
  if(row.data.deliveryReceipt)return {status:'acknowledged',noticeId};
  const recipientId=row.data.recipientId;
  const userId=await this.#resolve({scope,recipientId,noticeId});
  if(!ID.test(userId)||userId===this.#game.user.id||this.#game.users?.get?.(userId)?.isGM||this.#game.users?.get?.(userId)?.active!==true||
     await this.#authorize(userId,recipientId)!==true)fail('NOTIFICATION_RECIPIENT','Recipient binding or authorization failed');
  const projection=await this.#service.project({scope,noticeIds:[noticeId],recipientId,worldTime});
  if(projection.notifications.length!==1)fail('NOTICE_UNAVAILABLE','Notice is not projectable to the verified recipient');
  const item=projection.notifications[0];const deliveryId=String(this.#random());
  if(!ID.test(deliveryId)||this.#pending.has(deliveryId))fail('INVALID_NOTIFICATION','Duplicate or invalid delivery identity');
  const packet={kind:'notice.deliver',version:item.group?2:1,deliveryId,noticeId:item.id,text:item.text,level:item.level,...(item.group?{group:item.group}:{})};
  validateNotificationPacket(packet);
  return await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{this.#pending.delete(deliveryId);this.#byNotice.delete(key);
    reject(new EasyPlotsError('DELIVERY_UNCERTAIN','No authenticated client receipt; do not assume delivery'));},timeoutMs);
   this.#pending.set(deliveryId,{resolve,reject,timeout,key,userId,noticeId,scope,revision:row.revision});
   try{this.#send(userId,packet);}catch(err){clearTimeout(timeout);this.#pending.delete(deliveryId);this.#byNotice.delete(key);reject(err);}
  });
  }catch(error){this.#byNotice.delete(key);throw error;}
 }
 async #receive(packet,senderId){
  if(!this.#active||!packet||typeof packet!=='object'||!ID.test(senderId)||!this.#game?.users?.get?.(senderId))return;
  if(packet.kind==='notice.receipt'){
   if(!this.#game.user?.isGM||this.#gm()?.id!==this.#game.user.id||packet.version!==1||!ID.test(packet.deliveryId))return;
   const pending=this.#pending.get(packet.deliveryId);if(!pending||pending.userId!==senderId||packet.noticeId!==pending.noticeId||packet.status!=='received')return;
   this.#pending.delete(packet.deliveryId);clearTimeout(pending.timeout);
   try{
    this.#writerCheck();
    const recorded=await this.#service.acknowledge({scope:pending.scope,noticeId:pending.noticeId,
      expectedRevision:pending.revision,deliveryId:packet.deliveryId,recipientUserId:senderId});
    pending.resolve({status:'acknowledged',noticeId:recorded.id});
   }catch(error){pending.reject(error);}
   finally{this.#byNotice.delete(pending.key);}
   return;
  }
  if(packet.kind!=='notice.deliver'||this.#game.user?.isGM||senderId!==this.#gm()?.id)return;
  let item;try{item=validateNotificationPacket(packet);}catch{return;}
  if(this.#seen.has(packet.deliveryId)){
   this.#send(senderId,{kind:'notice.receipt',version:1,deliveryId:packet.deliveryId,noticeId:item.id,status:'received'});return;
  }
  try{
   const outcome=await this.#onReceive(item);
   if(outcome!==true)return; // No receipt for a failed/ignored display callback.
   if(this.#seen.size>=256)this.#seen.delete(this.#seen.values().next().value);
   this.#seen.add(packet.deliveryId);
   this.#send(senderId,{kind:'notice.receipt',version:1,deliveryId:packet.deliveryId,noticeId:item.id,status:'received'});
  }catch{/* no ACK; delivery remains uncertain */}
 }
}
