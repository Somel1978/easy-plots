/** GM-authoritative notification lifecycle. Player delivery is a separately
 * approved projection; GM-only detail never crosses recipient boundaries.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {sha256Hex,secureUUID} from '../contracts/digest.mjs';
import {validateNoticeView,validateNoticeGroup} from '../contracts/notification-view.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const LEVELS=new Set(['info','attention','urgent']);
const GROUPS=/^[a-z][a-z0-9-]{2,63}$/;
export class PersistentNarrativeNotifications {
 #domains;
 constructor({domains}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||typeof domains?.queryScoped!=='function')fail('NOTIFICATION_DEPENDENCY','Bounded protected domain repository required');
  this.#domains=domains;
 }
 async read({scope='world',noticeId}={}){assertNarrativeId(noticeId);return this.#domains.read('notification',scope,noticeId);}
 async #publicGroup({scope,recipientId,groupKey,publicGroup,sourceEventId}){
  if(publicGroup===null)return null;
  if(typeof publicGroup!=='string'||!publicGroup.trim()||publicGroup.length>80)fail('NOTIFICATION_GROUP','Explicit recipient-safe group title required');
  const id=`ep:notification-group:${(await sha256Hex(`${recipientId}\0${groupKey}`)).slice(0,28)}`,existing=await this.#domains.read('notification-group',scope,id);
  if(existing){if(existing.data.recipientId!==recipientId||existing.data.groupKey!==groupKey||existing.data.title!==publicGroup)fail('NOTIFICATION_GROUP_CONFLICT','Group identity or reviewed public title differs');return validateNoticeGroup({id:existing.data.publicId,title:existing.data.title});}
  const data={recipientId,groupKey,publicId:`ep:notice-group:${secureUUID()}`,title:publicGroup};
  await this.#domains.save({type:'notification-group',scope,id,sourceEventId,data});
  const confirmed=await this.#domains.read('notification-group',scope,id);if(!confirmed||JSON.stringify(confirmed.data)!==JSON.stringify(data))fail('NOTIFICATION_GROUP_UNCERTAIN','Public group identity lacks durable confirmation');return {id:data.publicId,title:data.title};
 }
 async queue({scope='world',noticeId,recipientId,sourceEventId,groupKey,level='info',gmDetail='',safeText='',expiresAt=null,publicGroup=null,operationId=null}={}){
  for(const id of [noticeId,recipientId,sourceEventId])assertNarrativeId(id);
  if(!GROUPS.test(groupKey)||!LEVELS.has(level))fail('NOTIFICATION_CONTRACT','Invalid typed notice group or priority');
  if(typeof gmDetail!=='string'||gmDetail.length>1000||typeof safeText!=='string'||safeText.length>280)fail('NOTIFICATION_TEXT','Invalid bounded message');
  if(expiresAt!==null&&(!Number.isFinite(expiresAt)||expiresAt<0))fail('NOTIFICATION_TIME','Invalid expiry');
  if(operationId!==null&&!/^ep:operation:[A-Za-z0-9_:-]{6,200}$/.test(operationId??''))fail('NOTIFICATION_PROVENANCE','Invalid journaled queue operation');
  const existing=await this.read({scope,noticeId});
  if(existing){
   const sameOrigin=existing.data.sourceEventId===sourceEventId&&existing.data.recipientId===recipientId&&existing.data.groupKey===groupKey&&(existing.data.queueOperationId??null)===operationId;
   const sameAuthoredFields=existing.data.level===level&&existing.data.gmDetail===gmDetail&&existing.data.safeText===safeText&&existing.data.expiresAt===expiresAt&&(existing.data.publicGroup?.title??null)===publicGroup;
   if(sameOrigin&&(operationId===null||sameAuthoredFields))return existing;
   fail('NOTIFICATION_COLLISION','Notice identity already used by a different causal event');
  }
  const group=await this.#publicGroup({scope,recipientId,groupKey,publicGroup,sourceEventId});
  return this.#domains.save({type:'notification',scope,id:noticeId,sourceEventId,data:{state:'pending-review',recipientId,sourceEventId,groupKey,level,gmDetail,safeText,expiresAt,approvalEventId:null,...(group?{publicGroup:group}:{}),...(operationId?{queueOperationId:operationId}:{})},expectedRevision:null});
 }
 async approve({scope='world',noticeId,expectedRevision,approvalEventId}={}){
  for(const id of [noticeId,approvalEventId])assertNarrativeId(id);
  const old=await this.read({scope,noticeId});
  if(!old)fail('NOTIFICATION_MISSING','Notice does not exist');
  if(old.revision!==expectedRevision)fail('REVISION_CONFLICT','Notice was updated');
  if(old.data.state!=='pending-review')fail('NOTIFICATION_STATE','Only pending notices can be approved');
  if(!old.data.safeText)fail('NOTIFICATION_PUBLIC_TEXT','Safe recipient text must be explicitly authored before approval');
  return this.#domains.save({type:'notification',scope,id:noticeId,sourceEventId:approvalEventId,expectedRevision,
   data:{...old.data,state:'published',approvalEventId}});
 }
 async acknowledge({scope='world',noticeId,expectedRevision,deliveryId,recipientUserId}={}){
  for(const id of [noticeId,deliveryId])assertNarrativeId(id);
  if(typeof recipientUserId!=='string'||!(/^[A-Za-z0-9_.:-]{8,160}$/).test(recipientUserId))fail('NOTIFICATION_RECIPIENT','Invalid authenticated user identity');
  const prior=await this.read({scope,noticeId});
  if(!prior||prior.data.state!=='published')fail('NOTICE_NOT_APPROVED','Only published notices can be acknowledged');
  if(prior.data.deliveryReceipt){
   if(prior.data.deliveryReceipt.deliveryId===deliveryId&&prior.data.deliveryReceipt.userId===recipientUserId)return prior;
   fail('NOTIFICATION_DELIVERY_CONFLICT','Notice has another authenticated receipt');
  }
  if(prior.revision!==expectedRevision)fail('REVISION_CONFLICT','Notice changed before receipt');
  return this.#domains.save({type:'notification',scope,id:noticeId,expectedRevision,
   sourceEventId:`ep:event:receipt_${deliveryId.replaceAll(':','_')}`,
   data:{...prior.data,deliveryReceipt:{deliveryId,userId:recipientUserId}}});
 }
 async archive({scope='world',noticeId,expectedRevision,sourceEventId}={}){
  for(const id of [noticeId,sourceEventId])assertNarrativeId(id);
  const old=await this.read({scope,noticeId});if(!old)fail('NOTIFICATION_MISSING','Notice not found');
  if(old.revision!==expectedRevision)fail('REVISION_CONFLICT','Notice changed before archival');
  return this.#domains.save({type:'notification',scope,id:noticeId,sourceEventId,expectedRevision,data:{...old.data,state:'archived'}});
 }
 async project({scope='world',noticeIds=[],recipientId,worldTime=null}={}){
  assertNarrativeId(recipientId);
  if(!Array.isArray(noticeIds)||noticeIds.length>24||new Set(noticeIds).size!==noticeIds.length)fail('NOTIFICATION_BUDGET','Explicit bounded IDs required');
  if(worldTime!==null&&(!Number.isFinite(worldTime)||worldTime<0))fail('NOTIFICATION_TIME','Invalid world time');
  const visible=[];
  for(const id of noticeIds){
   assertNarrativeId(id);const row=await this.read({scope,noticeId:id});
   if(!row||row.data.state!=='published'||row.data.recipientId!==recipientId)continue;
   if(row.data.expiresAt!==null&&(worldTime===null||worldTime>=row.data.expiresAt))continue;
   visible.push(validateNoticeView({id:row.id,text:row.data.safeText,level:row.data.level,...(row.data.publicGroup?{group:row.data.publicGroup}:{})}));
  }
  return {notifications:visible};
 }
 async listGM({scope='world',cursor='0:0',limit=16}={}){
  const result=await this.#domains.queryScoped({type:'notification',scope,cursor,limit});
  return {items:result.items.map(r=>({id:r.id,revision:r.revision,state:r.data.state,groupKey:r.data.groupKey,level:r.data.level,recipientId:r.data.recipientId})),nextCursor:result.nextCursor};
 }
}
