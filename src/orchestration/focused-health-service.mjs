/** Real GM-only focused health diagnostics from exact canonical records.
 * Never scans arbitrary campaign partitions or interprets missing coverage as clear.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assessNarrativeHealth} from './narrative-health.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const checkIds=(ids,name)=>{
 if(!Array.isArray(ids)||ids.length>24||new Set(ids).size!==ids.length)fail('HEALTH_BUDGET',`Bounded unique ${name} IDs required`);
 ids.forEach(assertNarrativeId);
};
export class GMFocusedHealthService {
 #domains;#resources;
 constructor({domains,resourceReader=null}={}){
  if(typeof domains?.read!=='function')fail('HEALTH_DEPENDENCY','Verified scoped domain store required');
  this.#domains=domains;this.#resources=resourceReader;
 }
 async inspect({scope='world',arcId,worldTime,objectiveIds=[],deadlineIds=[],resourceIds=[]}={}){
  assertNarrativeId(arcId);
  if(!Number.isFinite(worldTime)||worldTime<0)fail('HEALTH_TIME','Current world time required');
  for(const [ids,name] of [[objectiveIds,'objective'],[deadlineIds,'deadline'],[resourceIds,'resource']])checkIds(ids,name);
  if(objectiveIds.length+deadlineIds.length+resourceIds.length>48)fail('HEALTH_BUDGET','Maximum 48 selected canonical records');
  const objectives=[],deadlines=[],unresolvedLinks=[];
  for(const id of objectiveIds){
   const row=await this.#domains.read('objective',scope,id);
   if(!row){unresolvedLinks.push({id,status:'missing'});continue;}
   const state=row.data?.state??row.data?.status;
   if(['active','completed','failed','suspended','unresolved'].includes(state))
    objectives.push({id,status:state,confirmedBlocked:row.data.confirmedBlocked===true});
   else unresolvedLinks.push({id,status:'unverified'});
  }
  for(const id of deadlineIds){
   const row=await this.#domains.read('scheduled-commitment',scope,id);
   if(!row){unresolvedLinks.push({id,status:'missing'});continue;}
   const d=row.data;
   if(Number.isFinite(d?.dueAt)&&['pending','resolved','cancelled'].includes(d.status))
    deadlines.push({id,dueAt:d.dueAt,status:d.status});
   else unresolvedLinks.push({id,status:'unverified'});
  }
  for(const id of resourceIds){
   if(this.#resources){const report=await this.#resources({scope,id});if(report.integrityStatus!=='verified'||report.effectiveState!=='active')unresolvedLinks.push({id,status:['missing','stale'].includes(report.integrityStatus)?report.integrityStatus:'unverified'});continue;}
   const row=await this.#domains.read('resource-manifest',scope,id);
   if(!row){unresolvedLinks.push({id,status:'missing'});continue;}
   if(['missing','stale','unverified'].includes(row.data?.integrityStatus))
    unresolvedLinks.push({id,status:row.data.integrityStatus});
  }
  const report=assessNarrativeHealth({arcId,worldTime,coverage:'partial',objectives,deadlines,unresolvedLinks,
   maxRecords:Math.max(1,objectiveIds.length+deadlineIds.length+resourceIds.length)});
  return {...report,selectedRecordCount:objectiveIds.length+deadlineIds.length+resourceIds.length,
   indexCoverage:'explicit-records-only',effectsExecuted:0};
 }
}
