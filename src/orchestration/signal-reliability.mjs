/** Critical native intake survives admission loss. Recovery never repeats effects. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {validateNativeHookEvent,SUPPORTED_NATIVE_EVENT_TYPES} from '../platform/foundry-hook-ingress.mjs';
import {validateSourceUuid,validateSourceStamp} from '../platform/foundry-source-stamps.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const digest=value=>sha256Hex(JSON.stringify(value));
const stableStates=new Set(['review-required','evaluated','closed']);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function criticalSignalLocator(scope,eventId){
 assertNarrativeId(eventId);if(!eventId.startsWith('ep:event:')||!/^[a-z][a-z0-9-]{0,40}$/.test(scope??''))fail('SIGNAL_SCOPE','Bounded scope and event identity required');
 const hash=await sha256Hex(`${scope}\0${eventId}`),scopeHash=await sha256Hex(scope);
 return {id:`ep:critical-signal:${hash.slice(0,24)}`,scope:`signal-${scopeHash.slice(0,8)}-${hash.slice(0,2)}`};
}
export class NativeSignalReliability {
 #domains;#index;#ledger;#router;#gm;#readStamp;#scope;#policy=null;#locks=new Map();
 constructor({domains,index,ledger,router,gmProvider,readSourceStamp,scope='world'}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||typeof index?.stage!=='function'||typeof index?.page!=='function'||typeof ledger?.get!=='function'||typeof router?.ingest!=='function'||typeof gmProvider!=='function'||typeof readSourceStamp!=='function'||!/^[a-z][a-z0-9-]{0,40}$/.test(scope))fail('SIGNAL_DEPENDENCY','Protected intake, durable event ledger, GM context and trusted source reader required');
  this.#domains=domains;this.#index=index;this.#ledger=ledger;this.#router=router;this.#gm=gmProvider;this.#readStamp=readSourceStamp;this.#scope=scope;
 }
 #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
 get ready(){return this.#policy!==null;}
 async #policyId(){return `ep:ingress-policy:${(await sha256Hex(this.#scope)).slice(0,24)}`;}
 async load(){
  this.#context();const row=await this.#domains.read('ingress-policy',this.#scope,await this.#policyId());
  if(row){
   if(!Array.isArray(row.data.rules)||row.data.rules.length>8||!Array.isArray(row.data.sources)||row.data.sources.length>32)fail('SIGNAL_POLICY_CORRUPT','Reliability policy exceeds its bounded shape');
   this.#rules(row.data.rules);for(const uuid of row.data.sources)validateSourceUuid(uuid);
   if(new Set(row.data.sources).size!==row.data.sources.length)fail('SIGNAL_POLICY_CORRUPT','Duplicate watched source');
  }
  this.#context();this.#policy=row??{revision:null,data:{rules:[],sources:[]}};return clone(this.#policy);
 }
 #rules(rules){
  if(!Array.isArray(rules)||rules.length>8||new Set(rules.map(r=>r?.eventType)).size!==rules.length)fail('SIGNAL_POLICY','Up to eight unique native event rules required');
  for(const r of rules)if(!r||Object.keys(r).some(k=>!['eventType','tier'].includes(k))||!SUPPORTED_NATIVE_EVENT_TYPES.includes(r.eventType)||!['critical','best-effort'].includes(r.tier))fail('SIGNAL_POLICY','Only supported native event types and declared reliability tiers allowed');
 }
 async configure({rules=[],sourceUuids=[],expectedRevision=null,reviewEventId}={}){
  this.#context();assertNarrativeId(reviewEventId);this.#rules(rules);
  if(!Array.isArray(sourceUuids)||sourceUuids.length>32||new Set(sourceUuids).size!==sourceUuids.length)fail('SIGNAL_POLICY','Bounded unique native sources required');
  const old=await this.load();if(old.revision!==expectedRevision)fail('REVISION_CONFLICT','Reliability policy changed before review');
  // Retired watches remain discoverable; policy edits cannot hide old gaps.
  const sources=[...new Set([...old.data.sources,...sourceUuids])];if(sources.length>32)fail('SIGNAL_POLICY','Watched source catalog is full; explicit migration required');
  for(const uuid of sources){
   validateSourceUuid(uuid);const watch=await this.#watch(uuid);
   if(!watch){const stamp=validateSourceStamp(await this.#readStamp(uuid));await this.#domains.save({type:'signal-source-watch',scope:this.#scope,id:await this.#watchId(uuid),sourceEventId:reviewEventId,data:{documentUuid:uuid,baseline:stamp,state:'clear'}});}
  }
  const saved=await this.#domains.save({type:'ingress-policy',scope:this.#scope,id:await this.#policyId(),expectedRevision,sourceEventId:reviewEventId,data:{rules:clone(rules),sources}});
  this.#context();this.#policy=saved;return clone(saved);
 }
 tierForEvent(event){
  this.#context();if(!this.#policy)fail('SIGNAL_POLICY_NOT_READY','Load the protected reliability policy before accepting Hooks');
  return this.#policy.data.rules.find(r=>r.eventType===event?.eventType)?.tier??'best-effort';
 }
 async #lock(eventId,fn){
  this.#context();assertNarrativeId(eventId);if(!this.#locks.has(eventId)&&this.#locks.size>=32)fail('SIGNAL_OPERATION_BUDGET','Too many concurrent critical intake operations');
  const previous=this.#locks.get(eventId)??Promise.resolve(),work=previous.catch(()=>{}).then(fn),tail=work.catch(()=>{});this.#locks.set(eventId,tail);
  try{return await work;}finally{if(this.#locks.get(eventId)===tail)this.#locks.delete(eventId);}
 }
 async #signal(eventId){
  const loc=await criticalSignalLocator(this.#scope,eventId),row=await this.#domains.read('critical-signal',loc.scope,loc.id);
  if(row){
   const d=row.data;if(d.eventId!==eventId||!['pending','confirmed','dismissed'].includes(d.state)||!/^[a-f0-9]{64}$/.test(d.fingerprint??''))fail('SIGNAL_CORRUPT','Critical intake identity or lifecycle is invalid');
   if(d.event&&(d.event.id!==eventId||await digest(validateNativeHookEvent(d.event))!==d.fingerprint))fail('SIGNAL_CORRUPT','Critical event content changed');
   if(d.state!=='dismissed'&&!d.event)fail('SIGNAL_CORRUPT','A full critical intake is missing its original event');
   if(d.sourceStamp!==null&&d.sourceStamp!==undefined)validateSourceStamp(d.sourceStamp);
  }return {loc,row};
 }
 async #saveSignal(loc,eventId,data,expectedRevision,sourceEventId=eventId){
  this.#context();return this.#domains.save({type:'critical-signal',scope:loc.scope,id:loc.id,expectedRevision,data,sourceEventId});
 }
 async capture(event,{sourceStamp=null}={}){
  const canonical=validateNativeHookEvent(event);
  if(this.tierForEvent(canonical)!=='critical')fail('SIGNAL_TIER','Only configured critical native signals belong in durable intake');
  if(sourceStamp!==null)sourceStamp=validateSourceStamp(sourceStamp);
  return this.#lock(canonical.id,async()=>{
   const fingerprint=await digest(canonical),{loc,row}=await this.#signal(canonical.id);
   if(row&&row.data.fingerprint!==fingerprint)fail('SIGNAL_ID_CONFLICT','Critical event ID cannot be reused with different content');
   if(row&&row.data.state!=='pending')return clone(row);
   // Stage discovery FIRST. A crash before the full row remains visible as an
   // incomplete intake requiring review, never an invented event to replay.
   await this.#index.stage({eventId:canonical.id,fingerprint,eventType:canonical.eventType,documentUuid:canonical.source.documentUuid,hook:canonical.source.hook});
   return row??this.#saveSignal(loc,canonical.id,{eventId:canonical.id,event:canonical,fingerprint,state:'pending',sourceStamp},null);
  });
 }
 async inspect({eventId}={}){
  this.#context();const {row}=await this.#signal(eventId),candidate=await this.#index.get(eventId),entry=await this.#ledger.get(eventId),fingerprint=row?.data.fingerprint??candidate?.fingerprint;
  if(candidate&&row&&candidate.fingerprint!==row.data.fingerprint||entry&&fingerprint&&entry.fingerprint!==fingerprint)fail('SIGNAL_ID_CONFLICT','Pending intake and durable event do not describe the same occurrence');
  const status=row?.data.state==='dismissed'?(entry?'dismissed-with-existing-event':candidate?'dismissed-cleanup-required':'dismissed'):row?.data.state==='confirmed'?(candidate?'confirmed-cleanup-required':'confirmed'):
   entry?(stableStates.has(entry.state)?'accepted-awaiting-confirmation':'event-recovery-required'):row?.data.event?'pending-intake':candidate?'incomplete-intake':'absent';
  return {eventId,revision:row?.revision??null,status,ledgerState:entry?.state??null,event:clone(row?.data.event??null),candidate:clone(candidate),sourceStamp:clone(row?.data.sourceStamp??null),scope:'gm-only',effectsExecuted:0};
 }
 async #confirm(eventId,{noSubscribers=false}={}){
  const {loc,row}=await this.#signal(eventId),candidate=await this.#index.get(eventId),entry=await this.#ledger.get(eventId);
  if(row&&candidate&&row.data.fingerprint!==candidate.fingerprint)fail('SIGNAL_ID_CONFLICT','Pending index differs from immutable intake');
  if(row?.data.state==='dismissed'){
   if(entry)fail('SIGNAL_FINAL','Dismissed intake now has an event journal requiring explicit review');
   await this.#index.remove(eventId);return this.inspect({eventId});
  }
  const fingerprint=row?.data.fingerprint??candidate?.fingerprint;
  if(!fingerprint)fail('SIGNAL_MISSING','A recorded intake or durable pending candidate is required');
  if(entry&&entry.fingerprint!==fingerprint)fail('SIGNAL_ID_CONFLICT','Durable event does not match the recorded intake');
  if(row?.data.state==='confirmed'){await this.#index.remove(eventId);return this.inspect({eventId});}
  if(!entry&&!noSubscribers||entry&&!stableStates.has(entry.state))return this.inspect({eventId});
  const event=row?.data.event??validateNativeHookEvent(entry.event),data={eventId,event,fingerprint,state:'confirmed',sourceStamp:row?.data.sourceStamp??null,
   confirmation:entry?'verified-event-ledger':'verified-no-subscribers'};
  if(!row||row.data.state!=='confirmed')await this.#saveSignal(loc,eventId,data,row?.revision??null);
  await this.#index.remove(eventId);
  if(data.sourceStamp)await this.#ackObservedSource(event.source.documentUuid,data.sourceStamp,eventId);
  return this.inspect({eventId});
 }
 async reconcile({eventId}={}){return this.#lock(eventId,()=>this.#confirm(eventId));}
 async #deliver(eventId){
  const {row}=await this.#signal(eventId);if(!row?.data.event)fail('SIGNAL_INCOMPLETE','Full original native intake required; no reconstruction from current state');
  if(row.data.state!=='pending')return {status:'duplicate-or-recovery-required',eventId,persistedState:row.data.state};
  const existing=await this.#ledger.get(eventId);
  if(existing){await this.#confirm(eventId);return {status:stableStates.has(existing.state)?'duplicate-or-recovery-required':'uncertain',eventId,persistedState:existing.state};}
  this.#context();const outcome=await this.#router.ingest(clone(row.data.event));
  await this.#confirm(eventId,{noSubscribers:outcome?.status==='no-subscribers'&&outcome.eventId===eventId});return outcome;
 }
 async deliver(eventId){return this.#lock(eventId,()=>this.#deliver(eventId));}
 async resume({eventId,expectedRevision,approved=false}={}){
  if(approved!==true)fail('SIGNAL_APPROVAL','Explicit GM review is required before submitting a pending original signal');
  return this.#lock(eventId,async()=>{
   const {row}=await this.#signal(eventId);if(!row||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Critical intake changed before review');
   if(await this.#ledger.get(eventId))fail('SIGNAL_ALREADY_ACCEPTED','Inspect the existing event journal; accepted events are never replayed');
   return this.#deliver(eventId);
  });
 }
 async dismiss({eventId,expectedRevision,reviewEventId,reason,approved=false}={}){
  assertNarrativeId(reviewEventId);if(approved!==true||typeof reason!=='string'||!reason.trim()||reason.length>500)fail('SIGNAL_APPROVAL','GM review and a bounded reason are required');
  return this.#lock(eventId,async()=>{
   const {loc,row}=await this.#signal(eventId),candidate=await this.#index.get(eventId);
   if(!row&&!candidate)fail('SIGNAL_MISSING','An existing critical intake is required');
   if((row?.revision??null)!==expectedRevision)fail('REVISION_CONFLICT','Critical intake changed before dismissal');
   if(await this.#ledger.get(eventId))fail('SIGNAL_ALREADY_ACCEPTED','An existing event requires its own journal review');
   if(row&&row.data.state!=='pending')fail('SIGNAL_FINAL','Critical intake is already final');
   await this.#saveSignal(loc,eventId,{...(row?.data??{eventId,event:null,fingerprint:candidate.fingerprint,sourceStamp:null}),state:'dismissed',reviewEventId,reason},row?.revision??null,reviewEventId);
   await this.#index.remove(eventId);return this.inspect({eventId});
  });
 }
 async listPending(options={}){
  this.#context();const page=await this.#index.page(options),items=[];
  for(const candidate of page.items){const record=await this.inspect({eventId:candidate.eventId});if(record.status!=='confirmed'&&record.status!=='dismissed')items.push(record);}
  return {...page,items,scope:'gm-only',coverage:'pending-intake-index',effectsExecuted:0};
 }
 async #watchId(uuid){validateSourceUuid(uuid);return `ep:signal-watch:${(await sha256Hex(`${this.#scope}\0${uuid}`)).slice(0,24)}`;}
 async #watch(uuid){
  const row=await this.#domains.read('signal-source-watch',this.#scope,await this.#watchId(uuid));
  if(row){if(row.data.documentUuid!==uuid||!['clear','review-required'].includes(row.data.state))fail('SIGNAL_WATCH_CORRUPT','Watched source identity or state is invalid');validateSourceStamp(row.data.baseline);}
  return row;
 }
 async #ackObservedSource(uuid,stamp,eventId){
  if(!this.#policy?.data.sources.includes(uuid))return;
  const watch=await this.#watch(uuid);if(!watch||watch.data.state==='review-required')return;
  const current=validateSourceStamp(await this.#readStamp(uuid));if(!same(current,stamp)||same(watch.data.baseline,stamp))return;
  await this.#domains.save({type:'signal-source-watch',scope:this.#scope,id:watch.id,expectedRevision:watch.revision,sourceEventId:eventId,data:{...watch.data,baseline:stamp,lastConfirmedEventId:eventId}});
 }
 async checkSources({offset=0,limit=8,reviewEventId}={}){
  this.#context();assertNarrativeId(reviewEventId);const policy=await this.load();
  if(!Number.isSafeInteger(offset)||offset<0||offset>policy.data.sources.length||!Number.isSafeInteger(limit)||limit<1||limit>8)fail('SIGNAL_QUERY','Check at most eight explicitly watched sources');
  const items=[];for(const uuid of policy.data.sources.slice(offset,offset+limit)){
   let row=await this.#watch(uuid);if(!row)fail('SIGNAL_WATCH_CORRUPT','Configured source checkpoint is missing');
   const current=validateSourceStamp(await this.#readStamp(uuid)),changed=!same(current,row.data.baseline);
   if(changed&&(!same(row.data.detectedStamp,current)||row.data.state!=='review-required'))row=await this.#domains.save({type:'signal-source-watch',scope:this.#scope,id:row.id,expectedRevision:row.revision,sourceEventId:reviewEventId,data:{...row.data,state:'review-required',detectedStamp:current}});
   items.push({documentUuid:uuid,revision:row.revision,baseline:clone(row.data.baseline),current,requiresReview:changed||row.data.state==='review-required',missingOccurrences:'not-inferred'});
  }
  return {items,nextOffset:offset+limit<policy.data.sources.length?offset+limit:null,coverage:'configured-native-sources-only',effectsExecuted:0};
 }
 async acknowledgeSource({documentUuid,expectedRevision,expectedStamp,reviewEventId,reason,approved=false}={}){
  this.#context();assertNarrativeId(reviewEventId);validateSourceStamp(expectedStamp);
  if(approved!==true||typeof reason!=='string'||!reason.trim()||reason.length>500)fail('SIGNAL_APPROVAL','Explicit current-source review and reason required');
  const row=await this.#watch(documentUuid);if(!row||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Source checkpoint changed before review');
  const current=validateSourceStamp(await this.#readStamp(documentUuid));if(!same(current,expectedStamp))fail('SIGNAL_SOURCE_CHANGED','Native source changed since review');
  return this.#domains.save({type:'signal-source-watch',scope:this.#scope,id:row.id,expectedRevision,sourceEventId:reviewEventId,data:{...row.data,baseline:current,state:'clear',detectedStamp:null,lastAcknowledgement:{reviewEventId,reason}}});
 }
}
