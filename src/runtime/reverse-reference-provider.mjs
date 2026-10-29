/** Journaled graph effect for reverse-reference creation/retirement. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertPlainObject} from '../contracts/record.mjs';
import {reverseRefLocator} from '../storage/native-reverse-references.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const ID=/^ep:operation:[a-zA-Z0-9_:-]{6,200}$/;
const EVENT=/^ep:event:[a-zA-Z0-9_-]{8,120}$/;
export function validateNativeReferenceEffect(data){
  assertPlainObject(data,'NATIVE_REFERENCE_EFFECT');
  if(Object.keys(data).some(k=>!['scope','resourceId','dependentId','nativeUuid','action','expectedRevision','visibility'].includes(k)))
    fail('REF_EFFECT_FIELD','Unexpected native reference field');
  if(!['link','retire'].includes(data.action)||data.visibility!=='gm-only')
    fail('REF_EFFECT_POLICY','Protected reference operation required');
  if(data.action==='link'&&data.expectedRevision!==null||
     data.action==='retire'&&(!Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<1))
    fail('REF_EFFECT_REVISION','Reference operation requires expected revision');
  // Validate UUID, IDs and scope through the canonical ledger locator.
  // Its SHA-256 locator is asynchronous; syntactic shape is checked here.
  if(typeof data.scope!=='string'||!/^[a-z][a-z0-9-]{0,45}$/.test(data.scope)||
     typeof data.resourceId!=='string'||!/^ep:[a-z][a-z0-9-]*:[a-zA-Z0-9_-]{3,120}$/.test(data.resourceId)||
     typeof data.dependentId!=='string'||!/^ep:[a-z][a-z0-9-]*:[a-zA-Z0-9_-]{3,120}$/.test(data.dependentId)||
     typeof data.nativeUuid!=='string'||!/^(Actor|Item|JournalEntry)\.[A-Za-z0-9]{16}$/.test(data.nativeUuid))
    fail('REF_EFFECT_ID','Typed resource ID and world document UUID required');
  return structuredClone(data);
}
export function createNativeReferenceEffectProvider({ledger,gmProvider}={}){
  if(typeof ledger?.link!=='function'||typeof ledger?.retire!=='function'||
    typeof ledger?.get!=='function'||typeof gmProvider!=='function')
    fail('REF_EFFECT_DEPS','Protected reference ledger and GM context required');
  return Object.freeze({id:'narrative.track-native-reference',version:'1.0.0',validate:validateNativeReferenceEffect,
    async apply(payload,ctx){
      const p=validateNativeReferenceEffect(payload);
      if(!ID.test(ctx?.operationId??'')||!EVENT.test(ctx?.sourceEventId??''))
        fail('REF_EFFECT_PROVENANCE','Approved causal operation required');
      const spec={scope:p.scope,resourceId:p.resourceId,dependentId:p.dependentId,nativeUuid:p.nativeUuid};
      const event={operationId:ctx.operationId,sourceEventId:ctx.sourceEventId};
      const result=p.action==='link'?await ledger.link(spec,event):
        await ledger.retire(spec,{...event,expectedRevision:p.expectedRevision});
      return {recordId:result.recordId??result.id,revision:result.revision,alreadyApplied:result.alreadyApplied??false};
    },
    async verify(payload,ctx){
      const p=validateNativeReferenceEffect(payload);
      const row=await ledger.get(p);
      return Boolean(row&&row.lastOperationId===ctx?.operationId&&row.lastSourceEventId===ctx?.sourceEventId&&
        row.status===(p.action==='link'?'active':'retired'));
    }
  });
}
