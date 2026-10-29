import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=()=>{throw new EasyPlotsError('NOTICE_QUEUE_PAYLOAD','Typed bounded private notification preparation required');};
export function validateQueueNoticePayload(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['scope','noticeId','recipientId','groupKey','publicGroup','level','gmDetail','safeText','expiresAt'].includes(k))||!(/^[a-z][a-z0-9-]{0,45}$/).test(p.scope??'')||!(/^[a-z][a-z0-9-]{2,63}$/).test(p.groupKey??'')||!['info','attention','urgent'].includes(p.level)||typeof p.gmDetail!=='string'||p.gmDetail.length>1000||typeof p.safeText!=='string'||!p.safeText.trim()||p.safeText.length>280||p.publicGroup!==null&&(typeof p.publicGroup!=='string'||!p.publicGroup.trim()||p.publicGroup.length>80)||p.expiresAt!==null&&(!Number.isFinite(p.expiresAt)||p.expiresAt<0))fail();
 assertNarrativeId(p.noticeId);assertNarrativeId(p.recipientId);return clone(p);
}
export function createNotificationQueueProvider({service,gmProvider}={}){
 return Object.freeze({id:'narrative.queue-notification',version:'1.0.0',validate:validateQueueNoticePayload,
  async apply(payload,context){assertLocalGM(gmProvider());const p=validateQueueNoticePayload(payload);if(!context?.operationId||!context?.sourceEventId)fail();const row=await service.queue({...p,operationId:context.operationId,sourceEventId:context.sourceEventId});return {noticeId:row.id,revision:row.revision,state:row.data.state,messagesSent:0};},
  async verify(payload,context){assertLocalGM(gmProvider());const p=validateQueueNoticePayload(payload),row=await service.read({scope:p.scope,noticeId:p.noticeId});return Boolean(row&&row.data.queueOperationId===context.operationId&&row.data.sourceEventId===context.sourceEventId&&['recipientId','groupKey','level','gmDetail','safeText','expiresAt'].every(key=>JSON.stringify(row.data[key])===JSON.stringify(p[key]))&&(row.data.publicGroup?.title??null)===p.publicGroup);}
 });
}
