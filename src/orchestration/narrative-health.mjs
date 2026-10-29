/** GM-only, bounded narrative-health assessment. This produces advisory observations,
 * not canonical events, automated corrections, or any player-visible disclosure.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const STATES=new Set(['active','completed','failed','suspended','unresolved']);
const COVERAGE=new Set(['complete','partial','unknown']);
const isId=id=>typeof id==='string'&&/^ep:[a-z][a-z0-9-]*:[a-zA-Z0-9_-]{3,120}$/.test(id);
const checkList=(value,max,name)=>{
 if(!Array.isArray(value)||value.length>max)fail('HEALTH_BUDGET',`${name} must be a bounded array`);
 for(const row of value)if(!row||typeof row!=='object'||Array.isArray(row)||!isId(row.id))fail('HEALTH_RECORD',`Invalid ${name} record`);
 if(new Set(value.map(x=>x.id)).size!==value.length)fail('HEALTH_DUPLICATE',`Duplicate ${name} records`);
};
const issue=(id,kind,severity,reason,source)=>Object.freeze({id,kind,severity,reason,sourceId:source});
export function assessNarrativeHealth({arcId,worldTime,coverage='partial',objectives=[],deadlines=[],requests=[],unresolvedLinks=[],maxRecords=96}={}){
 assertNarrativeId(arcId);
 if(!COVERAGE.has(coverage))fail('HEALTH_COVERAGE','Invalid verification coverage');
 if(typeof worldTime!=='number'||!Number.isFinite(worldTime)||worldTime<0)fail('HEALTH_TIME','Finite world time required');
 if(!Number.isInteger(maxRecords)||maxRecords<1||maxRecords>256)fail('HEALTH_BUDGET','Invalid maximum record count');
 for(const [list,name] of [[objectives,'objectives'],[deadlines,'deadlines'],[requests,'requests'],[unresolvedLinks,'unresolvedLinks']])checkList(list,maxRecords,name);
 if(objectives.length+deadlines.length+requests.length+unresolvedLinks.length>maxRecords)fail('HEALTH_BUDGET','Combined scoped records exceed budget');
 const findings=[];
 for(const o of objectives){
   if(!STATES.has(o.status))fail('HEALTH_STATUS','Unsupported objective state');
   if(o.status==='active'&&o.confirmedBlocked===true)findings.push(issue(`block:${o.id}`,'blocked-objective','review','Explicitly confirmed blocked objective',o.id));
   if(o.status==='unresolved')findings.push(issue(`pending:${o.id}`,'unresolved-objective','attention','Objective remains unresolved',o.id));
 }
 for(const d of deadlines){
   if(!Number.isFinite(d.dueAt)||d.dueAt<0||!['pending','resolved','cancelled'].includes(d.status))fail('HEALTH_DEADLINE','Invalid deadline contract');
   if(d.status==='pending'&&d.dueAt<worldTime)findings.push(issue(`overdue:${d.id}`,'overdue-deadline','attention','Scheduled commitment is overdue; outcome is not implied',d.id));
 }
 for(const r of requests){
   if(!['pending','review-required','approved','resolved','rejected','uncertain'].includes(r.state))fail('HEALTH_REQUEST','Invalid review state');
   if(['review-required','uncertain'].includes(r.state))findings.push(issue(`review:${r.id}`,'pending-review',r.state==='uncertain'?'review':'attention','Operation requires GM review or reconciliation',r.id));
 }
 for(const l of unresolvedLinks){
   if(!['missing','stale','unverified'].includes(l.status))fail('HEALTH_REFERENCE','Invalid reference status');
   findings.push(issue(`reference:${l.id}`,'reference-integrity',l.status==='missing'?'review':'attention','Explicit reference issue; no automatic repair',l.id));
 }
 const counts={review:findings.filter(f=>f.severity==='review').length,attention:findings.filter(f=>f.severity==='attention').length};
 return Object.freeze({kind:'gm-narrative-health',arcId,worldTime,coverage,
   status:coverage==='complete'?(counts.review?'requires-review':counts.attention?'attention':'no-known-issues'):'incomplete-coverage',
   counts,examined:{objectives:objectives.length,deadlines:deadlines.length,requests:requests.length,unresolvedLinks:unresolvedLinks.length},
   findings:Object.freeze(findings),effectsExecuted:0,visibility:'gm-only'});
}
