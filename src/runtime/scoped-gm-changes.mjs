/** Local post-commit view notifications. No sockets, payloads or graph scans. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export class ScopedGMChanges {
 #gm;#listeners=new Map();#limit;#next=0;#onError;
 constructor({gmProvider,maxSubscribers=64,onError=()=>{}}={}){
  if(typeof gmProvider!=='function'||!Number.isSafeInteger(maxSubscribers)||maxSubscribers<1||maxSubscribers>128||typeof onError!=='function')fail('VIEW_SUBSCRIPTION','Bounded local GM notification configuration required');
  this.#gm=gmProvider;this.#limit=maxSubscribers;this.#onError=onError;
 }
 #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
 subscribe({graphId,onChange}={}){
  const gm=this.#context();assertNarrativeId(graphId);
  if(!graphId.startsWith('ep:graph:')||typeof onChange!=='function'||this.#listeners.size>=this.#limit)fail('VIEW_SUBSCRIPTION','An exact graph and bounded callback slot are required');
  const key=++this.#next;this.#listeners.set(key,{graphId,onChange,userId:gm.userId});
  return ()=>{this.#listeners.delete(key);};
 }
 publish({graphIds,eventId,state}={}){
  const gm=this.#context();assertNarrativeId(eventId);
  if(!eventId.startsWith('ep:event:')||!Array.isArray(graphIds)||graphIds.length>256||!['review-required','evaluated'].includes(state))fail('VIEW_NOTIFICATION','Only bounded committed event metadata may invalidate views');
  graphIds.forEach(id=>{assertNarrativeId(id);if(!id.startsWith('ep:graph:'))fail('VIEW_NOTIFICATION','Expected graph identity');});
  const selected=new Set(graphIds);let notified=0;
  for(const [key,listener] of this.#listeners){
   if(listener.userId!==gm.userId){this.#listeners.delete(key);continue;}
   if(!selected.has(listener.graphId))continue;
   const change=Object.freeze({graphId:listener.graphId,eventId,state});
   try{Promise.resolve(listener.onChange(change)).catch(()=>this.#onError({code:'VIEW_REFRESH_FAILED'}));notified++;}
   catch{this.#onError({code:'VIEW_REFRESH_FAILED'});}
  }
  return {notified};
 }
}
