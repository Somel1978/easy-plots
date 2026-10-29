/** GM-private preferences and attention. Scene changes never mutate plots. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const graph=id=>{assertNarrativeId(id);if(!id.startsWith('ep:graph:'))fail('FOCUS_GRAPH','A narrative graph is required');};
const time=n=>{if(!Number.isFinite(n)||n<0)fail('FOCUS_TIME','A nonnegative attention time is required');};
const scene=id=>{if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(id))fail('FOCUS_SCENE','An exact native scene ID is required');};
export class PersistentGMFocus {
 #domains;#gm;
 constructor({domains,gmProvider}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||typeof gmProvider!=='function')fail('FOCUS_DEPENDENCY','Protected storage and GM authority are required');
  this.#domains=domains;this.#gm=gmProvider;
 }
 async #identity(){const gm=this.#gm();assertLocalGM(gm);return {userId:gm.userId,id:`ep:gm-focus:${(await sha256Hex(gm.userId)).slice(0,24)}`};}
 async read(){
  const {userId,id}=await this.#identity(),row=await this.#domains.read('gm-focus','world',id);
  if(row&&row.data.userId!==userId)fail('FOCUS_IDENTITY','GM workspace owner mismatch');
  return {id,revision:row?.revision??null,data:clone(row?.data??{userId,pinnedGraphId:null,sceneGraphs:{},attention:[]})};
 }
 async #change(expectedRevision,sourceEventId,fn){
  assertNarrativeId(sourceEventId);const row=await this.read();
  if(row.revision!==expectedRevision)fail('REVISION_CONFLICT','GM workspace changed before this action');
  const data=clone(row.data);fn(data);const identity=await this.#identity();
  if(data.userId!==identity.userId)fail('FOCUS_IDENTITY','GM identity changed during this action');
  return this.#domains.save({type:'gm-focus',scope:'world',id:identity.id,data,expectedRevision,sourceEventId});
 }
 async pin({graphId=null,expectedRevision=null,sourceEventId}={}){
  if(graphId!==null)graph(graphId);
  return this.#change(expectedRevision,sourceEventId,d=>{d.pinnedGraphId=graphId;});
 }
 /** Explicit preparation pins are separate from the single current view focus.
  * Their activation/publication observations are verified by the session service. */
 async pinSessionPlots({plotRefs=[],expectedRevision=null,sourceEventId}={}){
  if(!Array.isArray(plotRefs)||plotRefs.length>8)fail('FOCUS_BUDGET','Maximum eight explicitly pinned session plots');
  const seen=new Set(),refs=plotRefs.map(ref=>{
   if(!ref||typeof ref!=='object'||Object.keys(ref).some(k=>!['graphId','publishedVersion','activationRevision'].includes(k)))fail('FOCUS_SESSION_PIN','Exact active plot references required');
   graph(ref.graphId);if(seen.has(ref.graphId)||![ref.publishedVersion,ref.activationRevision].every(n=>Number.isSafeInteger(n)&&n>0))fail('FOCUS_SESSION_PIN','Unique plots with exact publication and activation revisions required');
   seen.add(ref.graphId);return {graphId:ref.graphId,publishedVersion:ref.publishedVersion,activationRevision:ref.activationRevision};
  });
  return this.#change(expectedRevision,sourceEventId,d=>{d.sessionPlotRefs=refs;});
 }
 async bindScene({sceneId,graphId=null,expectedRevision=null,sourceEventId}={}){
  scene(sceneId);if(graphId!==null)graph(graphId);
  return this.#change(expectedRevision,sourceEventId,d=>{
   if(graphId===null)delete d.sceneGraphs[sceneId];else d.sceneGraphs={...d.sceneGraphs,[sceneId]:graphId};
   if(Object.keys(d.sceneGraphs).length>24)fail('FOCUS_BUDGET','Maximum 24 explicitly configured scene bindings');
  });
 }
 async observe({eventId,graphId,observedAt,ttl=1800,expectedRevision=null,sourceEventId}={}){
  assertNarrativeId(eventId);if(!eventId.startsWith('ep:event:'))fail('FOCUS_EVENT','An event identity is required');graph(graphId);time(observedAt);
  if(!Number.isFinite(ttl)||ttl<1||ttl>86400)fail('FOCUS_TIME','Attention TTL must be between one second and one day');
  return this.#change(expectedRevision,sourceEventId,d=>{
   const previous=d.attention.find(a=>a.eventId===eventId);
   if(previous&&previous.graphId!==graphId)fail('FOCUS_EVENT','Attention cannot retarget an existing event');
   d.attention=d.attention.filter(a=>a.eventId!==eventId&&(a.pinned||a.expiresAt>observedAt));
   d.attention.push({eventId,graphId,observedAt,expiresAt:observedAt+ttl,pinned:previous?.pinned===true});
   if(d.attention.length>32)fail('FOCUS_BUDGET','Attention capacity is 32; explicitly unpin or remove a signal');
  });
 }
 async pinAttention({eventId,pinned,expectedRevision=null,sourceEventId}={}){
  assertNarrativeId(eventId);if(typeof pinned!=='boolean')fail('FOCUS_PIN','Choose whether narrative significance is pinned');
  return this.#change(expectedRevision,sourceEventId,d=>{const entry=d.attention.find(a=>a.eventId===eventId);if(!entry)fail('FOCUS_EVENT','Known attention event required');entry.pinned=pinned;});
 }
 async snapshot({sceneId=null,explicitGraphId=null,now}={}){
  time(now);if(sceneId!==null)scene(sceneId);if(explicitGraphId!==null)graph(explicitGraphId);
  const row=await this.read(),d=row.data,passiveGraphId=sceneId===null?null:Object.hasOwn(d.sceneGraphs,sceneId)?d.sceneGraphs[sceneId]:null;
  return {revision:row.revision,graphId:d.pinnedGraphId??explicitGraphId??passiveGraphId,
   focusSource:d.pinnedGraphId?'pinned':explicitGraphId?'explicit':passiveGraphId?'scene':'none',
   pinnedGraphId:d.pinnedGraphId,passiveGraphId,attention:d.attention.filter(a=>a.pinned||a.expiresAt>now),scope:'gm-only',effectsExecuted:0};
 }
}
/** One client focus shared by dock, inspector and canvas. No canonical writes. */
export class GMFocusController {
 #service;#gm;#now;#sceneId=null;#explicit=null;#listeners=new Set();#owner;#sequence=0;
 constructor({service,gmProvider,now=()=>Date.now()/1000}={}){
  if(typeof service?.snapshot!=='function'||typeof gmProvider!=='function'||typeof now!=='function')fail('FOCUS_DEPENDENCY','Focus service and GM context required');
  this.#service=service;this.#gm=gmProvider;this.#now=now;this.#owner=this.#context().userId;
 }
 #context(){const gm=this.#gm();assertLocalGM(gm);if(this.#owner&&gm.userId!==this.#owner)fail('FOCUS_IDENTITY','Client focus belongs to another GM');return gm;}
 subscribe(callback){this.#context();if(typeof callback!=='function'||this.#listeners.size>=16)fail('FOCUS_BUDGET','A bounded local focus subscriber is required');this.#listeners.add(callback);return ()=>this.#listeners.delete(callback);}
 async snapshot(){this.#context();const row=await this.#service.snapshot({sceneId:this.#sceneId,explicitGraphId:this.#explicit,now:this.#now()});this.#context();return row;}
 async refresh(){const token=++this.#sequence,snapshot=await this.snapshot();if(token!==this.#sequence)return snapshot;for(const callback of this.#listeners){try{await callback(clone(snapshot));}catch{/* One closed view cannot block other views. */}}return snapshot;}
 async select(graphId){this.#context();graph(graphId);const current=await this.snapshot();if(current.pinnedGraphId&&current.pinnedGraphId!==graphId)fail('FOCUS_PINNED','Unpin the current graph before switching explicit focus');this.#explicit=graphId;return this.refresh();}
 async sceneChanged(sceneId){this.#context();if(sceneId!==null)scene(sceneId);this.#sceneId=sceneId;this.#explicit=null;return this.refresh();}
}
