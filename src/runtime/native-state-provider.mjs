/** Durable narrative-state mutation through the same guarded repository as the graph. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {clone} from '../contracts/record.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const MAX_VALUE_BYTES=2048;
function assertPayload(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('INVALID_EFFECT','State payload must be an object');
  if(typeof payload.key!=='string'||!/^[a-zA-Z][a-zA-Z0-9_.:-]{0,110}$/.test(payload.key))
    fail('INVALID_EFFECT','State key is missing or invalid');
  if(!Object.hasOwn(payload,'value'))fail('INVALID_EFFECT','State value must be provided');
  let serialized;try{serialized=JSON.stringify(payload.value);}catch{fail('INVALID_EFFECT','State value must be JSON serializable');}
  if(serialized===undefined||new TextEncoder().encode(serialized).length>MAX_VALUE_BYTES)
    fail('EFFECT_BUDGET','State value is too large');
  if(payload.scope!==undefined&&(!/^[a-z][a-z0-9-]{0,50}$/.test(payload.scope)))fail('INVALID_EFFECT','Invalid state scope');
  return {key:payload.key,value:clone(payload.value),scope:payload.scope??'world'};
}
export async function stateLocator(payload){
  const p=assertPayload(payload);
  const h=await sha256Hex(`${p.scope}\u0000${p.key}`);
  return {id:`ep:state:${h.slice(0,24)}`,partitionId:`state:${h.slice(0,2)}`,scope:p.scope,key:p.key};
}
/** Required operationId is passed in the execution context, not accepted from an untrusted proposal payload. */
export function createNarrativeStateProvider({repository,gmProvider}={}){
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function')
    fail('INVALID_PROVIDER','Narrative state provider needs revisioned repository and GM identity');
  const gm=()=>{const context=gmProvider();assertLocalGM(context);return context;};
  const get=async payload=>{
    const loc=await stateLocator(payload);
    const row=await repository.read(loc.id,{partitionId:loc.partitionId,gm:gm()});
    if(row&&(row.id!==loc.id||row.kind!=='narrative-state'||row.stateKey!==loc.key||row.scope!==loc.scope))
      fail('STATE_CORRUPT','Narrative state record is inconsistent');
    if(row&&typeof repository.hasReadyIndex==='function'&&
      !await repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:gm()}))
      fail('INDEX_UNCERTAIN','Narrative state index needs reconciliation');
    return row;
  };
  return Object.freeze({
    id:'narrative.set-state',version:'1.0.0',
    validate:assertPayload,
    get,
    async apply(payload,{operationId}={}){
      gm();const p=assertPayload(payload);
      if(typeof operationId!=='string'||!/^ep:operation:[a-zA-Z0-9_:-]{6,200}$/.test(operationId))
        fail('OPERATION_ID_REQUIRED','A journaled operation identity must be supplied');
      const loc=await stateLocator(p),old=await get(p);
      if(old?.lastOperationId===operationId){
        if(JSON.stringify(old.value)!==JSON.stringify(p.value))fail('OPERATION_CONFLICT','Reused operation identity with different state');
        return {stateId:loc.id,recordRevision:old.revision,alreadyApplied:true};
      }
      // Later revisions are not replaced by a stale proposal without explicit author review.
      const saved=await repository.put({...loc,kind:'narrative-state',stateKey:p.key,value:p.value,
        lastOperationId:operationId},{expectedRevision:old?.revision??null,gm:gm()});
      return {stateId:loc.id,recordRevision:saved.revision};
    },
    async verify(payload,{operationId}={}){
      const p=assertPayload(payload),row=await get(p);
      return Boolean(row&&row.lastOperationId===operationId&&JSON.stringify(row.value)===JSON.stringify(p.value));
    }
  });
}
