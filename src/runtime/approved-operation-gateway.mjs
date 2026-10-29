/** Explicit GM continuation from durable completed operations. No effect replay. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {versionedEvent} from '../contracts/canonical-event.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export class ApprovedOperationEventGateway {
 #reviews;#router;#gm;#writer;#world;
 constructor({reviews,router,gmProvider,writer,worldId}={}){
  if(typeof reviews?.verifiedCompletion!=='function'||typeof router?.ingest!=='function'||typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function'||typeof worldId!=='string'||!worldId||worldId.length>120)fail('OPERATION_GATEWAY','Verified operation review, router and current native GM writer required');
  this.#reviews=reviews;this.#router=router;this.#gm=gmProvider;this.#writer=writer;this.#world=worldId;
 }
 #authority(){const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);}
 async preview({operations}={}){
  this.#authority();
  if(!Array.isArray(operations)||operations.length<1||operations.length>8)fail('OPERATION_GATEWAY_BUDGET','Select between one and eight completed operations');
  const keys=new Set(),ordered=[];
  for(const ref of operations){
   if(!ref||Object.keys(ref).sort().join(',')!=='operationId,sourceEventId')fail('OPERATION_GATEWAY_REFERENCE','An exact event and operation reference is required');
   assertNarrativeId(ref.sourceEventId);assertNarrativeId(ref.operationId);const key=`${ref.sourceEventId}|${ref.operationId}`;
   if(keys.has(key))fail('OPERATION_GATEWAY_REFERENCE','Duplicate completion reference');keys.add(key);ordered.push({sourceEventId:ref.sourceEventId,operationId:ref.operationId});
  }
  ordered.sort((a,b)=>a.sourceEventId<b.sourceEventId?-1:a.sourceEventId>b.sourceEventId?1:a.operationId<b.operationId?-1:1);
  const completions=[];for(const ref of ordered)completions.push(await this.#reviews.verifiedCompletion(ref.sourceEventId,ref.operationId));
  const hash=await sha256Hex(JSON.stringify({worldId:this.#world,operations:ordered})),id=`ep:event:after_ops_${hash.slice(0,32)}`;
  const event=versionedEvent({id,eventType:'narrative.operations-completed',source:{kind:'gm-approved-intent',capability:'verified-operations-v1',requestId:`ep:request:after_ops_${hash.slice(0,32)}`},
   causalParentIds:[...new Set(ordered.map(ref=>ref.sourceEventId))],correlationId:`completed-operations:${hash.slice(0,32)}`,payload:{completions,verified:true}});
  if(new TextEncoder().encode(JSON.stringify(event)).length>10000)fail('OPERATION_GATEWAY_BUDGET','Completion evidence exceeds its event budget');
  const cascade=typeof this.#router.previewCascade==='function'?await this.#router.previewCascade(event):null;
  this.#authority();return {event,...(cascade?{cascade}:{}),effectsExecuted:0};
 }
 async emit(spec,{approved=false}={}){
  if(approved!==true)fail('OPERATION_CONTINUATION_APPROVAL','Explicit GM review of completed operations is required');
  const {event}=await this.preview(spec);this.#authority();return {eventId:event.id,...await this.#router.ingest(event)};
 }
}
