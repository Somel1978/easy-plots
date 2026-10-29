/**
 * Opt-in Foundry v14 hook adapter.
 * Hook callbacks come from the local Foundry runtime, never from a client-
 * supplied module socket. The GM still validates current designated authority.
 * Raw Document objects, update values and user-provided options are NOT stored.
 * This adapter does not execute effects or mutate source documents.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {nativeHookStamp} from './foundry-source-stamps.mjs';
import {versionedEvent,validateEventVersion} from '../contracts/canonical-event.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const specs=Object.freeze({
  updateActor:{documentName:'Actor',eventType:'foundry.actor.updated',change:true},
  updateItem:{documentName:'Item',eventType:'foundry.item.updated',change:true},
  createJournalEntry:{documentName:'JournalEntry',eventType:'foundry.journal.created',change:false},
  updateJournalEntry:{documentName:'JournalEntry',eventType:'foundry.journal.updated',change:true},
  createCombat:{documentName:'Combat',eventType:'foundry.combat.created',change:false},
  updateCombat:{documentName:'Combat',eventType:'foundry.combat.updated',change:true},
  deleteCombat:{documentName:'Combat',eventType:'foundry.combat.deleted',change:false},
  createChatMessage:{documentName:'ChatMessage',eventType:'foundry.chat.created',change:false}
});
export const SUPPORTED_FOUNDRY_HOOKS=Object.freeze(Object.keys(specs));
export const SUPPORTED_NATIVE_EVENT_TYPES=Object.freeze(Object.values(specs).map(s=>s.eventType));
const own=x=>x&&typeof x==='object'&&!Array.isArray(x);
const safeFieldNames=changes=>{
  if(!own(changes))return [];
  // The changed value is NOT copied. Only bounded, top-level field names.
  return Object.keys(changes).filter(x=>/^[A-Za-z_][A-Za-z0-9_.-]{0,70}$/.test(x)).slice(0,24);
};
export function normalizeFoundryHook(name,args,{randomId=secureUUID}={}){
  const spec=specs[name];if(!spec)fail('HOOK_UNSUPPORTED','Only declared Foundry hooks may enter the narrative engine');
  const [document]=args??[];
  if(!document||document.documentName!==spec.documentName||typeof document.uuid!=='string'||!document.uuid||document.uuid.length>220)
    fail('HOOK_SOURCE_INVALID','Foundry document does not match the hook contract');
  const userId=spec.change?args[3]:args[2];
  if(typeof userId!=='string'||userId.length>80)fail('HOOK_SOURCE_INVALID','Native hook must provide requesting user ID');
  const changeKeys=spec.change?safeFieldNames(args[1]):[];
  const eventId=String(randomId());
  if(!/^[A-Za-z0-9_-]{8,120}$/.test(eventId))fail('INVALID_EVENT','Event ID generator returned invalid ID');
  return versionedEvent({
    id:`ep:event:${eventId}`,eventType:spec.eventType,
    source:{kind:'native-hook',hook:name,documentUuid:document.uuid,requestingUserId:userId},
    payload:{documentType:document.documentName,documentUuid:document.uuid,changeKeys}
  });
}
export function validateNativeHookEvent(event){
 validateEventVersion(event);
 const spec=specs[event?.source?.hook],source=event?.source,payload=event?.payload;
 if(!spec||event.eventType!==spec.eventType||source?.kind!=='native-hook'||!/^ep:event:[A-Za-z0-9_-]{8,120}$/.test(event.id??'')||
  Object.keys(event).some(k=>!['id','eventType','eventVersion','causalParentIds','correlationId','source','payload'].includes(k))||Object.keys(source).some(k=>!['kind','hook','documentUuid','requestingUserId'].includes(k))||
  typeof source.documentUuid!=='string'||!source.documentUuid||source.documentUuid.length>220||typeof source.requestingUserId!=='string'||source.requestingUserId.length>80||
  !own(payload)||Object.keys(payload).some(k=>!['documentType','documentUuid','changeKeys'].includes(k))||payload.documentType!==spec.documentName||payload.documentUuid!==source.documentUuid||
  !Array.isArray(payload.changeKeys)||payload.changeKeys.length>24||payload.changeKeys.some(k=>typeof k!=='string'||!/^[A-Za-z_][A-Za-z0-9_.-]{0,70}$/.test(k)))fail('SIGNAL_EVENT','Only normalized native Hook metadata may enter the critical inbox');
 return structuredClone(event);
}
/** Hooks only installed after explicit native security verification. */
export class VerifiedFoundryHookIngress {
  #hooks;#router;#game;#gm;#writer;#randomId;#handlers=new Map();#started=false;
  #inflight=new Set();#recent=[];#onError;#maximum;#pending=0;
  #scheduler;#reliability;#criticalCaptures=0;#maximumCritical;#protectedPackId;
  constructor({hooks,router,gameInstance,gmProvider,writer,randomId=secureUUID,
    onError=()=>{},maxInflight=16,scheduler=null,reliability=null,maxCriticalCaptures=4,protectedPackId=null}={}){
    if(!hooks?.on||!hooks?.off||typeof router?.ingest!=='function'||typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function')
      fail('INVALID_HOOK_ADAPTER','Foundry Hooks, durable router, writer and GM provider required');
    if(!Number.isInteger(maxInflight)||maxInflight<1||maxInflight>32)fail('HOOK_BUDGET','Invalid max inflight events');
    if(scheduler!==null&&typeof scheduler?.submit!=='function')fail('HOOK_BUDGET','Configured scheduler must support bounded task admission');
    if(reliability!==null&&['tierForEvent','capture','deliver'].some(k=>typeof reliability?.[k]!=='function')||!Number.isSafeInteger(maxCriticalCaptures)||maxCriticalCaptures<1||maxCriticalCaptures>8)fail('HOOK_BUDGET','Bounded critical intake configuration required');
    this.#reliability=reliability;this.#maximumCritical=maxCriticalCaptures;
    if(protectedPackId!==null&&(typeof protectedPackId!=='string'||!protectedPackId||protectedPackId.length>220))fail('HOOK_BUDGET','Protected storage pack identity must be exact');
    this.#protectedPackId=protectedPackId;
    this.#scheduler=scheduler;
    this.#hooks=hooks;this.#router=router;this.#game=gameInstance;this.#gm=gmProvider;this.#writer=writer;this.#randomId=randomId;this.#onError=onError;this.#maximum=maxInflight;
  }
  get status(){return Object.freeze({running:this.#started,inflight:this.#pending,recentEventIds:[...this.#recent],...(this.#reliability?{criticalIntakes:this.#criticalCaptures}:{})});}
  #verify(){const gm=this.#gm();assertLocalGM(gm);if(!this.#game?.user?.isGM||gm.userId!==this.#game.user.id)fail('GM_REQUIRED','Active local GM required');this.#writer.assertEligible(gm);}
  start(){
    this.#verify();if(this.#started)return this;
    if(this.#reliability&&!this.#reliability.ready)fail('SIGNAL_POLICY_NOT_READY','Protected reliability policy must be loaded before Hook registration');
    for(const hook of SUPPORTED_FOUNDRY_HOOKS){
      const handler=(...args)=>{void this.#handle(hook,args);};
      this.#hooks.on(hook,handler);this.#handlers.set(hook,handler);
    }
    this.#started=true;return this;
  }
  stop(){for(const [hook,handler] of this.#handlers)this.#hooks.off(hook,handler);
    this.#handlers.clear();this.#started=false;
  }
  async #handle(hook,args){
    if(!this.#started)return;
    let reserved=false,event=null,critical=false;
    try{
      this.#verify();
      // Native storage writes must not generate their own narrative intake.
      // The pack identity comes from verified composition, not socket options.
      if(this.#protectedPackId&&(args[0]?.pack===this.#protectedPackId||args[0]?.compendium?.collection===this.#protectedPackId))return;
      if(this.#reliability){
        event=normalizeFoundryHook(hook,args,{randomId:this.#randomId});critical=this.#reliability.tierForEvent(event)==='critical';
        if(critical){
          if(this.#criticalCaptures>=this.#maximumCritical)fail('CRITICAL_INTAKE_OVERLOAD','Critical intake capacity exceeded; reconcile watched sources');
          this.#criticalCaptures++;
          try{let sourceStamp=null;try{sourceStamp=nativeHookStamp(hook,args[0]);}catch{/* Missing metadata cannot manufacture a source checkpoint. */}
            await this.#reliability.capture(event,{sourceStamp});
          }finally{this.#criticalCaptures--;}
        }
      }
      if(this.#pending>=this.#maximum)fail('HOOK_BACKPRESSURE','Too many concurrent narrative events');
      this.#pending++;reserved=true;
      event??=normalizeFoundryHook(hook,args,{randomId:this.#randomId});
      // Best-effort events consult one bounded subscription index. Critical
      // intake is already durable and also records an observed no-target result.
      if(!critical){const refs=await this.#router.subscribed(event.eventType);if(!refs.length)return;}
      if(!this.#started)return;
      this.#verify();
      const run=()=>{if(!this.#started)fail('HOOK_STOPPED','Hook ingress stopped before queued execution');this.#verify();return critical?this.#reliability.deliver(event.id):this.#router.ingest(event);};
      const promise=this.#scheduler?this.#scheduler.submit({priority:critical||hook.includes('Combat')?'critical':'interactive',run}):run();
      this.#inflight.add(promise);
      try{
        const outcome=await promise;
        this.#recent.unshift(event.id);if(this.#recent.length>20)this.#recent.pop();
        if(outcome?.status==='uncertain')this.#onError({code:'EVENT_REVIEW_REQUIRED',eventId:event.id});
      }finally{this.#inflight.delete(promise);}
    }catch(error){
      // Native writer or read failures must not become a retry loop.
      if(['NOT_DESIGNATED_GM','GM_SESSION_MISMATCH','GM_WRITE_SUSPENDED','GM_WRITE_UNCERTAIN','INDEX_UNCERTAIN','GM_AUTHORITY_REVOKED','EVENT_RECOVERY_REQUIRED'].includes(error?.code)||critical&&!['HOOK_BACKPRESSURE','TASK_BACKPRESSURE'].includes(error?.code))this.stop();
      this.#onError({code:error?.code??'HOOK_PROCESSING_FAILED',...(critical&&event?{eventId:event.id}:{})});
    }finally{if(reserved)this.#pending--;}
  }
}
