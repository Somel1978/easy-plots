/** Read-only, bounded GM causal explanation of persisted event evaluation.
 * The record is an inspection of what WAS evaluated, not a recomputation of
 * potentially changed canonical state or an explanation to player clients.
 * The trace deliberately contains no source payload, secret field or argument.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const safeStatus=new Set(['passed','disabled','condition-blocked','branch-selected','logic-blocked','extension-blocked']);
export async function explainNarrativeEvent({eventId,graphId,ledger,gmProvider,maxNodes=160}={}){
  assertNarrativeId(eventId);assertNarrativeId(graphId);
  if(!eventId.startsWith('ep:event:')||!graphId.startsWith('ep:graph:')||typeof ledger?.get!=='function'||typeof gmProvider!=='function')
    fail('EXPLAIN_CONTRACT','A GM-only event ledger and graph identity are required');
  if(!Number.isSafeInteger(maxNodes)||maxNodes<1||maxNodes>500)fail('EXPLAIN_BUDGET','Bounded causal explanation required');
  assertLocalGM(gmProvider());
  const event=await ledger.get(eventId);
  if(!event)return {eventId,graphId,status:'not-found',trace:[],conclusion:'No stored event evaluation exists for this ID'};
  if(!['evaluated','review-required','closed'].includes(event.state))return {eventId,graphId,status:'incomplete',
    trace:[],conclusion:'Event evaluation is pending or uncertain; do not infer an outcome'};
  const entries=(event.evaluations??[]).filter(e=>e.graphId===graphId);
  if(entries.length>8)fail('EXPLAIN_BUDGET','Too many evaluations in one scoped graph');
  if(!entries.length)return {eventId,graphId,status:'not-observed',trace:[],
    conclusion:'No persisted evaluation for this graph; absence is not evidence of a failed condition'};
  const trace=[];
  for(const e of entries){
    if(!Array.isArray(e.trace)||e.trace.length>maxNodes)fail('EXPLAIN_BUDGET','Malformed or oversized evaluation trace');
    for(const row of e.trace){
      if(!row||!safeStatus.has(row.status))fail('EXPLAIN_CORRUPT','Unexpected trace status');
      assertNarrativeId(row.nodeId);assertNarrativeId(row.graphId);
      if(row.selectedPorts!==undefined&&(!Array.isArray(row.selectedPorts)||row.selectedPorts.length>16||
        row.selectedPorts.some(p=>typeof p!=='string'||p.length>64)))fail('EXPLAIN_CORRUPT','Invalid selected port reference');
      // Allowlist only; never return stored event payload or private provider inputs.
      trace.push({graphId:row.graphId,nodeId:row.nodeId,status:row.status,
        ...(row.selectedPorts?{selectedPorts:clone(row.selectedPorts)}:{})});
      if(trace.length>maxNodes)fail('EXPLAIN_BUDGET','Trace exceeds inspection budget');
    }
  }
  const blocked=trace.filter(x=>x.status.endsWith('-blocked'));
  return {eventId,graphId,status:'observed',trace,blockedCount:blocked.length,
    proposalCount:(event.proposals??[]).filter(x=>x.graphId===graphId).length,
    historical:true,gmOnly:true,conclusion:blocked.length?'One or more authored conditions or gates did not pass':'Stored evaluation trace contains no recorded blocking gate'};
}
