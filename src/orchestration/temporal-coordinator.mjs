/** GM-authoritative schedule lifecycle backed by scoped native domain records
 * and an independently indexed due-time candidate list. Never infers that a
 * due agenda action succeeded, and never simulates skipped days.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const KINDS=new Set(['npc-action','faction-action','deadline','obligation-review','explicit-expiry','arc-event']);
const MAX_TIME=1_000_000_000;
export class GMTemporalCoordinator {
 #domains;#index;
 constructor({domains,index}={}){
  if(typeof domains?.save!=='function'||typeof domains?.read!=='function'||
     typeof index?.stage!=='function'||typeof index?.due!=='function')
    fail('TIME_COORDINATION','Protected schedule records and a due index are required');
  this.#domains=domains;this.#index=index;
 }
 get indexPolicy(){return this.#index.policy??null;}
 async read({scope='world',id}={}){
  assertNarrativeId(id);return this.#domains.read('scheduled-commitment',scope,id);
 }
 async schedule({scope='world',id,sourceEventId,ownerId,kind,dueAt,expectedRevision=null,
     originRevision=1,prerequisiteIds=[]}={}){
  for(const v of [id,sourceEventId,ownerId])assertNarrativeId(v);
  if(!KINDS.has(kind)||!Number.isSafeInteger(dueAt)||dueAt<0||dueAt>MAX_TIME||
    !Number.isSafeInteger(originRevision)||originRevision<1||!Array.isArray(prerequisiteIds)||prerequisiteIds.length>32)
    fail('SCHEDULE_CONTRACT','Typed bounded scheduled commitment required');
  prerequisiteIds.forEach(assertNarrativeId);
  const saved=await this.#domains.save({type:'scheduled-commitment',scope,id,sourceEventId,expectedRevision,
    data:{ownerId,kind,dueAt,originRevision,prerequisiteIds,status:'pending'}});
  try{await this.#index.stage({id,kind,dueAt,sourceRevision:saved.revision,sourceEventId,sourceScope:scope});}
  catch(error){fail('SCHEDULE_INDEX_UNCERTAIN',`Canonical commitment was stored but index requires repair (${error.code??'UNKNOWN'})`);}
  return {commitment:saved,indexed:true,outcomeEstablished:false};
 }
 async repairIndex({scope='world',id}={}){
  const row=await this.read({scope,id});
  if(!row)fail('SCHEDULE_MISSING','Schedule does not exist');
  const {kind,dueAt,status}=row.data;
  if(status==='resolved'||status==='cancelled')return {indexed:false,status:'completed-or-cancelled'};
  return this.#index.stage({id,kind,dueAt,sourceRevision:row.revision,sourceEventId:row.sourceEventId,sourceScope:scope});
 }
 async due({scope='world',from,to,maxDue=64}={}){
  return this.#index.due({from,to,maxDue,sourceScope:scope,resolveCurrent:async(id,kind)=>{
    const row=await this.read({scope,id});
    if(!row||row.data.kind!==kind)return null;
    return {sourceRevision:row.revision,dueAt:row.data.dueAt,status:row.data.status};
  }});
 }
 async page({scope='world',from,to,maxDue=64,cursor=null}={}){if(typeof this.#index.page!=='function'){if(cursor!==null)fail('DUE_CURSOR','This temporal index cannot resume a posting page');return {...await this.due({scope,from,to,maxDue}),nextCursor:null};}return this.#index.page({from,to,maxDue,cursor,sourceScope:scope,resolveCurrent:async(id,kind)=>{const row=await this.read({scope,id});return !row||row.data.kind!==kind?null:{sourceRevision:row.revision,dueAt:row.data.dueAt,status:row.data.status};}});}
 /** Record an independently authorized resolution event. This is NOT the
  * underlying Actor/Faction/Item effect; those use the effect gateway. */
 async recordOutcome({scope='world',id,expectedRevision,resolutionEventId,outcome}={}){
  assertNarrativeId(resolutionEventId);
  if(!['resolved','cancelled'].includes(outcome))fail('SCHEDULE_OUTCOME','Explicit review outcome required');
  const row=await this.read({scope,id});
  if(!row)fail('SCHEDULE_MISSING','Schedule does not exist');
  if(row.revision!==expectedRevision)fail('REVISION_CONFLICT','Schedule changed during review');
  if(row.data.status!=='pending'&&row.data.status!=='due')fail('SCHEDULE_STATE','Already resolved commitment cannot be replayed');
  return this.#domains.save({type:'scheduled-commitment',scope,id,expectedRevision:row.revision,
    sourceEventId:resolutionEventId,data:{...row.data,status:outcome,resolutionEventId}});
 }
}
