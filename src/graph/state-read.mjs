/** Pure, bounded contract for a GM-only authoritative narrative state read. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export const STATE_READ_TYPE='core.state.read';
export const STATE_READ_DEFAULT=Object.freeze({scope:'world',key:'clue-found',expectedValue:true,expectedRevision:null});
const bytes=x=>new TextEncoder().encode(JSON.stringify(x)).length;
function normalized(value,depth=0){
  if(depth>8)fail('STATE_READ_BUDGET','State value nesting exceeds the bounded comparison depth');
  if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
  if(Array.isArray(value)){
    if(value.length>64)fail('STATE_READ_BUDGET','State list too large');
    return value.map(v=>normalized(v,depth+1));
  }
  if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype){
    const keys=Object.keys(value).sort();if(keys.length>64||keys.some(k=>['__proto__','constructor','prototype'].includes(k)))fail('STATE_READ_DATA','Unsafe state comparison key');
    return Object.fromEntries(keys.map(k=>[k,normalized(value[k],depth+1)]));
  }
  fail('STATE_READ_DATA','State comparison requires finite JSON data');
}
export function validateStateRead(node){
  if(node?.typeId!==STATE_READ_TYPE)fail('STATE_READ_CONTRACT','Incorrect state reader node type');
  const data=node.data;
  if(!data||typeof data!=='object'||Array.isArray(data))fail('STATE_READ_CONTRACT','State read requires bounded typed data');
  if(typeof data.scope!=='string'||!/^[a-z][a-z0-9-]{0,50}$/.test(data.scope))fail('STATE_READ_SCOPE','Invalid state scope');
  if(typeof data.key!=='string'||!/^[a-zA-Z][a-zA-Z0-9_.:-]{0,110}$/.test(data.key))fail('STATE_READ_KEY','Invalid stable state key');
  if(!Object.hasOwn(data,'expectedValue'))fail('STATE_READ_CONTRACT','Expected value is required');
  if(data.expectedRevision!==undefined&&data.expectedRevision!==null&&(!Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<1))fail('STATE_READ_REVISION','Expected revision must be positive');
  if(Object.keys(data).some(k=>!['scope','key','expectedValue','expectedRevision'].includes(k)))fail('STATE_READ_CONTRACT','Unexpected state-read field');
  const value=normalized(data.expectedValue);
  if(bytes(value)>1024||bytes(data)>1600)fail('STATE_READ_BUDGET','State comparison exceeds bounded budget');
  const ports=node.ports??[];
  if(!['match','mismatch','absent'].every(id=>ports.some(p=>p.id===id&&p.direction==='output')))
    fail('STATE_READ_PORTS','State reader requires explicit match, mismatch, and absent output ports');
  return true;
}
/** The caller must retrieve this row through the protected native state provider. */
export function evaluateStateRead(node,row){
  validateStateRead(node);
  if(row===null||row===undefined)return {pass:true,allowedPorts:['absent']};
  if(row.kind!=='narrative-state'||row.scope!==node.data.scope||row.stateKey!==node.data.key||!Number.isSafeInteger(row.revision)||row.revision<1)
    fail('STATE_READ_CORRUPT','Authoritative state record does not match its locator');
  const eq=JSON.stringify(normalized(row.value))===JSON.stringify(normalized(node.data.expectedValue));
  const revisionMatches=node.data.expectedRevision===undefined||node.data.expectedRevision===null||row.revision===node.data.expectedRevision;
  return {pass:true,allowedPorts:[eq&&revisionMatches?'match':'mismatch']};
}
