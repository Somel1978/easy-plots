import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export function validateRollInput(d){
 if(!d||!['d20','opposed'].includes(d.rollKind)||!['total','outcome'].includes(d.field)||!Number.isSafeInteger(d.expectedRevision)||d.expectedRevision<1||!(d.rollKind==='d20'?d.side==='self':['initiator','opponent'].includes(d.side)))fail('ROLL_INPUT_CONTRACT','Exact native roll kind, attempt revision, selected side and field required');
 assertNarrativeId(d.attemptId);if(!d.attemptId.startsWith('ep:attempt:'))fail('ROLL_INPUT_CONTRACT','Authoritative native attempt identity required');return d;
}
/** Read-only mechanical provenance. Never evaluates dice or grants knowledge. */
export async function resolveRollInput(readRoll,spec){
 validateRollInput(spec);if(typeof readRoll!=='function')fail('ROLL_READ_UNAVAILABLE','Protected authoritative roll reader unavailable');
 const row=await readRoll(spec.rollKind,spec.attemptId);
 if(!row||row.state!=='resolved'||row.kind!==(spec.rollKind==='d20'?'native-roll':'native-opposed-roll')||row.attemptId!==spec.attemptId||row.revision!==spec.expectedRevision||row.fingerprint!==await sha256Hex(JSON.stringify(row.request)))fail('ROLL_INPUT_STALE','Resolved native roll identity, revision and request proof required');
 const total=spec.rollKind==='d20'?row.total:row.totals?.[spec.side];let outcome=row.outcome;
 if(spec.rollKind==='opposed')outcome=row.winner==='tie'?'tie':row.band==='partial'?(row.winner===spec.side?'partial-success':'partial-failure'):(row.winner===spec.side?'success':'failure');
 const value=spec.field==='total'?total:outcome;
 if(spec.field==='total'?!Number.isSafeInteger(value):!['success','partial','failure','partial-success','partial-failure','tie'].includes(value))fail('ROLL_INPUT_UNAVAILABLE','Selected mechanical result is unavailable');
 return {value,observation:{kind:'native-roll',rollKind:spec.rollKind,attemptId:spec.attemptId,revision:row.revision,field:spec.field,side:spec.side,sourceEventId:row.request.sourceEventId,requestFingerprint:row.fingerprint,recordDigest:await sha256Hex(JSON.stringify(row)),value,inputs:clone(row.request)}};
}
