/** Sampled GM-local timing data. Event contents and identities are never logged. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export class BoundedDiagnostics {
 #gm;#enabled=false;#every=8;#capacity=64;#seen=0;#samples=[];#counts={ok:0,error:0,dropped:0};
 constructor({gmProvider}={}){if(typeof gmProvider!=='function')fail('DIAGNOSTIC_CONFIG','GM context required');this.#gm=gmProvider;}
 configure({enabled=false,sampleEvery=8,capacity=64}={}){
  assertLocalGM(this.#gm());
  if(typeof enabled!=='boolean'||!Number.isSafeInteger(sampleEvery)||sampleEvery<1||sampleEvery>1024||!Number.isSafeInteger(capacity)||capacity<1||capacity>128)fail('DIAGNOSTIC_CONFIG','Bounded sampling configuration required');
  this.#enabled=enabled;this.#every=sampleEvery;this.#capacity=capacity;this.#samples=this.#samples.slice(-capacity);return this.snapshot();
 }
 record(metric){
  if(!this.#enabled)return;
  assertLocalGM(this.#gm());
  if(!metric||Object.keys(metric).some(k=>!['kind','priority','durationMs','queueDepth','outcome'].includes(k))||!['task','hook','storage','evaluation'].includes(metric.kind)||!['critical','interactive','background'].includes(metric.priority)||!['ok','error','dropped'].includes(metric.outcome)||!Number.isFinite(metric.durationMs)||metric.durationMs<0||metric.durationMs>86400000||!Number.isSafeInteger(metric.queueDepth)||metric.queueDepth<0||metric.queueDepth>128)fail('DIAGNOSTIC_METRIC','Only bounded anonymous timing metrics are accepted');
  this.#seen++;this.#counts[metric.outcome]++;
  if(metric.outcome==='ok'&&this.#seen%this.#every!==0)return;
  this.#samples.push({...metric});if(this.#samples.length>this.#capacity)this.#samples.shift();
 }
 snapshot(){assertLocalGM(this.#gm());return {enabled:this.#enabled,sampleEvery:this.#every,capacity:this.#capacity,observations:this.#seen,counts:{...this.#counts},samples:this.#samples.map(s=>({...s})),scope:'gm-local'};}
 clear(){assertLocalGM(this.#gm());this.#samples=[];this.#seen=0;this.#counts={ok:0,error:0,dropped:0};}
}
