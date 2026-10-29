/** Bounded local task admission. Execution never implies GM effect approval. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const priorities=['critical','interactive','background'];
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export class BoundedPriorityScheduler {
 #queue=[];#running=0;#maximum;#capacity;#limit;#burst;#highRun=0;#closed=false;#next=0;#scheduled=false;#now;#target;#diagnostics;
 constructor({concurrency=4,capacity=32,maxPriorityBurst=4,targetTaskMs=24,now=()=>performance.now(),diagnostics=null}={}){
  if(!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>8||!Number.isSafeInteger(capacity)||capacity<concurrency||capacity>64||!Number.isSafeInteger(maxPriorityBurst)||maxPriorityBurst<1||maxPriorityBurst>16||!Number.isFinite(targetTaskMs)||targetTaskMs<1||typeof now!=='function'||diagnostics!==null&&typeof diagnostics.record!=='function')fail('TASK_CONFIG','Bounded concurrency, queue capacity and fairness policy required');
  this.#maximum=concurrency;this.#limit=concurrency;this.#capacity=capacity;this.#burst=maxPriorityBurst;this.#now=now;this.#target=targetTaskMs;this.#diagnostics=diagnostics;
 }
 get status(){return {queued:this.#queue.length,running:this.#running,concurrency:this.#limit,capacity:this.#capacity,closed:this.#closed};}
 submit({priority='interactive',run}={}){
  if(this.#closed)return Promise.reject(new EasyPlotsError('TASK_CLOSED','Scheduler is closed'));
  if(!priorities.includes(priority)||typeof run!=='function')return Promise.reject(new EasyPlotsError('TASK_CONTRACT','A declared priority and task are required'));
  if(this.#queue.length+this.#running>=this.#capacity)return Promise.reject(new EasyPlotsError('TASK_BACKPRESSURE','Task capacity reached'));
  const promise=new Promise((resolve,reject)=>this.#queue.push({priority,run,resolve,reject,sequence:++this.#next}));
  this.#schedule();return promise;
 }
 #schedule(){if(this.#scheduled||this.#closed)return;this.#scheduled=true;queueMicrotask(()=>{this.#scheduled=false;this.#drain();});}
 #take(){
  let index=0;
  if(this.#highRun>=this.#burst){
   // Oldest admitted task gets a turn even during endless high-priority arrivals.
   for(let i=1;i<this.#queue.length;i++)if(this.#queue[i].sequence<this.#queue[index].sequence)index=i;
   this.#highRun=0;
  }else{
   for(let i=1;i<this.#queue.length;i++)if(priorities.indexOf(this.#queue[i].priority)<priorities.indexOf(this.#queue[index].priority))index=i;
   const chosen=this.#queue[index];
   if(this.#queue.some(t=>t.sequence<chosen.sequence))this.#highRun++;else this.#highRun=0;
  }
  return this.#queue.splice(index,1)[0];
 }
 #drain(){
  while(!this.#closed&&this.#running<this.#limit&&this.#queue.length){
   const task=this.#take();this.#running++;const start=this.#now();let outcome='ok';
   Promise.resolve().then(task.run).then(task.resolve,error=>{outcome='error';task.reject(error);}).finally(()=>{
    const durationMs=Math.max(0,this.#now()-start);this.#running--;
    if(durationMs>this.#target)this.#limit=Math.max(1,this.#limit-1);else if(this.#queue.length>this.#limit)this.#limit=Math.min(this.#maximum,this.#limit+1);
    try{this.#diagnostics?.record({kind:'task',priority:task.priority,durationMs,queueDepth:this.#queue.length,outcome});}catch{/* Diagnostics cannot change task outcomes. */}
    this.#schedule();
   });
  }
 }
 close(){this.#closed=true;for(const task of this.#queue.splice(0))task.reject(new EasyPlotsError('TASK_CLOSED','Queued task cancelled before execution'));}
}
