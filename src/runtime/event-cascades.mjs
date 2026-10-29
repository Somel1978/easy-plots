/** Durable bounded admission for causal reactions. No world providers or scans. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {validateRuntimeEvent} from './event-ledger.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export const DEFAULT_CASCADE_LIMITS=Object.freeze({maxDepth:8,maxEvents:32,maxFanout:8,maxRepeats:3,maxReads:64});
export async function cascadeLocator(rootEventId,scope='main'){
 if(typeof scope!=='string'||!/^[a-z][a-z0-9-]{0,45}$/.test(scope))fail('CASCADE_SCOPE','A bounded registry scope is required');
 const hash=await sha256Hex(`event-cascade:v1:${scope}:${rootEventId}`);return {id:`ep:cascade:${hash.slice(0,28)}`,partitionId:`event-cascades:${scope}:${hash.slice(0,2)}`};
}
async function reactionKeys(event){
 // Completion identities vary per occurrence; each originating published rule
 // remains a repeated reaction even when the GM groups it with other rules.
 const base={eventType:event.eventType,sourceKind:event.source.kind,capability:event.source.capability??null},completions=event.payload.completions;
 const rules=event.source.capability==='verified-operations-v1'&&Array.isArray(completions)&&completions.length<=8?completions.map(c=>({graphId:c?.rootGraphId,version:c?.rootPublishedVersion,nodeIds:Array.isArray(c?.nodeIds)?[...c.nodeIds].sort():[]})):[];
 const encoded=rules.length?[...new Set(rules.map(rule=>JSON.stringify({...base,rule})))]:[JSON.stringify(base)];
 return (await Promise.all(encoded.map(value=>sha256Hex(value)))).sort();
}
export class BoundedEventCascades {
 #repo;#ledger;#gm;#scope;#limits;#policy;
 constructor({repository,ledger,gmProvider,scope='main',...limits}={}){
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof ledger?.get!=='function'||typeof gmProvider!=='function')fail('CASCADE_RUNTIME','Protected repository, causal ledger and current GM required');
  if(Object.keys(limits).some(k=>!Object.hasOwn(DEFAULT_CASCADE_LIMITS,k)))fail('CASCADE_LIMITS','Unknown cascade limit');
  this.#limits={...DEFAULT_CASCADE_LIMITS,...limits};
  for(const [key,value] of Object.entries(this.#limits))if(!Number.isSafeInteger(value)||value<1||value>({maxDepth:16,maxEvents:64,maxFanout:16,maxRepeats:8,maxReads:128})[key])fail('CASCADE_LIMITS','Cascade limits exceed the supported bounded contract');
  this.#repo=repository;this.#ledger=ledger;this.#gm=gmProvider;this.#scope=scope;this.#policy=JSON.stringify(this.#limits);
 }
 #authority(){const gm=this.#gm();assertLocalGM(gm);return gm;}
 #diagnostic(event,code,{rootEventIds=[],depth=0,reads=0,...details}={}){return {...details,allowed:!code,code:code??'CASCADE_WITHIN_BUDGET',eventId:event.id,rootEventIds,depth,reads,limits:{...this.#limits},effectsExecuted:0};}
 async #ancestry(event){
  const roots=new Set(),known=new Map(),queue=(event.causalParentIds??[]).map(id=>({id,depth:1}));let depth=0,reads=0;
  if(!queue.length)roots.add(event.id);
  for(let i=0;i<queue.length;i++){
   const item=queue[i];depth=Math.max(depth,item.depth);
   if(item.depth>this.#limits.maxDepth)return this.#diagnostic(event,'CASCADE_DEPTH_BUDGET',{depth,reads});
   if(item.id===event.id)return this.#diagnostic(event,'CASCADE_CAUSAL_CYCLE',{depth,reads});
   if(known.has(item.id)&&known.get(item.id)>=item.depth)continue;
   if(++reads>this.#limits.maxReads)return this.#diagnostic(event,'CASCADE_ANCESTRY_BUDGET',{depth,reads:reads-1});
   this.#authority();const row=await this.#ledger.get(item.id);
   if(!row)return this.#diagnostic(event,'CASCADE_PARENT_MISSING',{depth,reads,parentEventId:item.id});
   known.set(item.id,item.depth);const parents=row.event.causalParentIds??[];
   if(!parents.length)roots.add(item.id);else for(const id of parents)queue.push({id,depth:item.depth+1});
   if(roots.size>8||queue.length>this.#limits.maxReads*8)return this.#diagnostic(event,'CASCADE_ANCESTRY_BUDGET',{depth,reads});
  }
  return this.#diagnostic(event,null,{rootEventIds:[...roots].sort(),depth,reads});
 }
 async #root(rootEventId){
  const gm=this.#authority(),loc=await cascadeLocator(rootEventId,this.#scope),row=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});
  if(typeof this.#repo.indexStatus==='function'&&!row&&(await this.#repo.indexStatus(loc.id,{partitionId:loc.partitionId,gm}))!==null)fail('CASCADE_INDEX_UNCERTAIN','Cascade index points to an unavailable record');
  if(row){
   if(row.kind!=='event-cascade'||row.rootEventId!==rootEventId||row.policy!==this.#policy||!Array.isArray(row.events)||row.events.length>this.#limits.maxEvents||new Set(row.events.map(e=>e.eventId)).size!==row.events.length||row.events.some(e=>typeof e.eventId!=='string'||typeof e.fingerprint!=='string'||!Array.isArray(e.reactionKeys)||!e.reactionKeys.length||e.reactionKeys.length>8||e.reactionKeys.some(k=>typeof k!=='string')||!Array.isArray(e.parentIds)||e.parentIds.length>8))fail('CASCADE_RECORD','Cascade record or its pinned budget policy is invalid');
   if(typeof this.#repo.hasReadyIndex==='function'&&!await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm}))fail('CASCADE_INDEX_UNCERTAIN','Cascade index requires explicit reconciliation');
  }
  this.#authority();return {loc,row};
 }
 #check(event,inspection,row,keys,fingerprint){
  const events=row?.events??[],existing=events.find(e=>e.eventId===event.id);
  if(existing){if(existing.fingerprint!==fingerprint)fail('EVENT_REUSE_CONFLICT','Reserved causal event identity belongs to different content');return null;}
  if(events.length>=this.#limits.maxEvents)return this.#diagnostic(event,'CASCADE_EVENT_BUDGET',inspection);
  for(const key of keys)if(events.filter(e=>e.reactionKeys.includes(key)).length>=this.#limits.maxRepeats)return this.#diagnostic(event,'CASCADE_REPEATED_REACTION',{...inspection,reactionKey:key});
  for(const parentId of event.causalParentIds??[])if(events.filter(e=>e.parentIds.includes(parentId)).length>=this.#limits.maxFanout)return this.#diagnostic(event,'CASCADE_FANOUT_BUDGET',{...inspection,parentEventId:parentId});
  return null;
 }
 /** Read only, including a second writer's already reserved budget. */
 async inspect(raw){
  this.#authority();const event=validateRuntimeEvent(raw),inspection=await this.#ancestry(event);this.#authority();if(!inspection.allowed)return inspection;
  const keys=await reactionKeys(event),fingerprint=await sha256Hex(JSON.stringify(event));
  for(const rootId of inspection.rootEventIds){const {row}=await this.#root(rootId),blocked=this.#check(event,inspection,row,keys,fingerprint);if(blocked)return blocked;}
  this.#authority();return inspection;
 }
 /** Reservations are monotone. Interrupted multi-root writes consume budget;
  * retrying the same occurrence can finish reservation without counting twice. */
 async reserve(raw){
  this.#authority();const event=validateRuntimeEvent(raw),inspection=await this.#ancestry(event);this.#authority();if(!inspection.allowed)return inspection;
  const keys=await reactionKeys(event),fingerprint=await sha256Hex(JSON.stringify(event));
  for(const rootId of inspection.rootEventIds){let written=false;
   for(let attempt=0;attempt<3&&!written;attempt++){
    const {loc,row}=await this.#root(rootId),blocked=this.#check(event,inspection,row,keys,fingerprint);if(blocked)return blocked;
    if(row?.events.some(e=>e.eventId===event.id)){written=true;break;}
    const entry={eventId:event.id,fingerprint,reactionKeys:keys,parentIds:[...(event.causalParentIds??[])]};
    const next={...loc,kind:'event-cascade',rootEventId:rootId,policy:this.#policy,events:[...(row?.events??[]),entry]};
    if(new TextEncoder().encode(JSON.stringify(next)).length>44000)return this.#diagnostic(event,'CASCADE_RECORD_BUDGET',inspection);
    this.#authority();
    try{await this.#repo.put(next,{expectedRevision:row?.revision??null,gm:this.#authority()});}
    catch(error){if(error.code==='REVISION_CONFLICT')continue;throw error;}
    const confirmed=await this.#root(rootId);if(!confirmed.row?.events.some(e=>e.eventId===event.id&&e.fingerprint===fingerprint))fail('CASCADE_WRITE_UNCERTAIN','Causal budget reservation was not confirmed');written=true;
   }
   if(!written)fail('CASCADE_CONCURRENT_UPDATE','Concurrent admission requires a fresh explicit submission');
  }
  this.#authority();return inspection;
 }
}
