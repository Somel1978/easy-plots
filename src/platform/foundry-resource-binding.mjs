/**
 * Protected binding of a stable narrative resource to an existing native world
 * document. This provider NEVER writes flags or data to the target document.
 * A rebind requires the current native ID, record revision, and explicit GM
 * operation; detaching preserves historical provenance in the effect journal.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const OP=/^ep:operation:[a-zA-Z0-9_:-]{6,200}$/;
const EV=/^ep:event:[a-zA-Z0-9_-]{8,120}$/;
const SCOPE=/^[a-z][a-z0-9-]{0,45}$/;
const ID=/^[A-Za-z0-9]{16}$/;
const KINDS=['Actor','Item','JournalEntry'];
const ACTIONS=['bind','rebind','detach'];
export function validateNativeBinding(spec){
  assertPlainObject(spec,'NATIVE_BINDING');
  const fields=['scope','resourceId','sourceGraphId','documentKind','nativeId','previousNativeId',
    'action','ownership','expectedRevision','visibility'];
  if(Object.keys(spec).some(k=>!fields.includes(k)))fail('NATIVE_BINDING_FIELD','Only typed native resource binding fields are allowed');
  assertNarrativeId(spec.resourceId);assertNarrativeId(spec.sourceGraphId);
  if(!SCOPE.test(spec.scope??'')||!KINDS.includes(spec.documentKind)||
     !ACTIONS.includes(spec.action)||spec.visibility!=='gm-only'||
     !['borrowed','shared'].includes(spec.ownership))
    fail('NATIVE_BINDING_POLICY','Explicit protected native binding with supported ownership mode required');
  if(spec.action==='bind'){
    if(!ID.test(spec.nativeId??'')||spec.previousNativeId!==null||spec.expectedRevision!==null)
      fail('NATIVE_BINDING_POLICY','First binding requires native ID and no prior record');
  }else if(spec.action==='rebind'){
    if(!ID.test(spec.nativeId??'')||!ID.test(spec.previousNativeId??'')||spec.nativeId===spec.previousNativeId||
       !Number.isSafeInteger(spec.expectedRevision)||spec.expectedRevision<1)
      fail('NATIVE_BINDING_POLICY','Rebinding requires distinct native IDs and expected revision');
  }else if(spec.nativeId!==null||!ID.test(spec.previousNativeId??'')||
     !Number.isSafeInteger(spec.expectedRevision)||spec.expectedRevision<1)
    fail('NATIVE_BINDING_POLICY','Detach requires old native ID and expected record revision');
  return structuredClone(spec);
}
export async function nativeBindingLookupLocator({scope,resourceId}={}){
  if(!SCOPE.test(scope??''))fail('NATIVE_BINDING_POLICY','Known bounded scope required');
  assertNarrativeId(resourceId);
  const hash=await sha256Hex(`${scope}\0${resourceId}`);
  return Object.freeze({id:`ep:native-binding:${hash.slice(0,24)}`,
    partitionId:`native-bindings-${scope}-${hash.slice(0,2)}`});
}
export async function nativeBindingLocator(spec){
  return nativeBindingLookupLocator(validateNativeBinding(spec));
}
export function createFoundryResourceBindingProvider({repository,gmProvider,gameInstance,writer}={}){
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||
     typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function')
    fail('NATIVE_BINDING_DEPS','Protected repository and GM writer required');
  const gm=()=>{const g=gmProvider();assertLocalGM(g);writer.assertEligible(g);return g;};
  const collection=(kind)=>{
    const native={Actor:gameInstance?.actors,Item:gameInstance?.items,JournalEntry:gameInstance?.journal}[kind];
    if(typeof native?.get!=='function')fail('NATIVE_BINDING_UNSUPPORTED',`Native ${kind} world collection unavailable`);
    return native;
  };
  async function inspect(spec){
    const p=validateNativeBinding(spec),loc=await nativeBindingLocator(p),g=gm();
    const row=await repository.read(loc.id,{partitionId:loc.partitionId,gm:g});
    if(row&&(row.id!==loc.id||row.kind!=='native-resource-binding'||row.resourceId!==p.resourceId||
      row.sourceGraphId!==p.sourceGraphId||row.scope!==p.scope||row.partitionId!==loc.partitionId))
      fail('NATIVE_BINDING_CORRUPT','Protected binding identity differs from expected record');
    if(row&&typeof repository.hasReadyIndex==='function'&&
       !await repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:g}))
      fail('INDEX_UNCERTAIN','Protected binding index is incomplete');
    return {loc,row};
  }
  return Object.freeze({id:'narrative.bind-native-reference',version:'1.0.0',
    validate:validateNativeBinding,inspect,
    async apply(spec,ctx){
      const p=validateNativeBinding(spec);
      if(!OP.test(ctx?.operationId)||!EV.test(ctx?.sourceEventId))
        fail('NATIVE_BINDING_PROVENANCE','Approved operation and source event are required');
      const {loc,row}=await inspect(p),g=gm();
      if(row?.lastOperationId===ctx.operationId){
        if(row.lastSourceEventId!==ctx.sourceEventId||row.lastAction!==p.action||
           row.previousNativeId!==p.previousNativeId||row.lastRequestedNativeId!==p.nativeId)
          fail('NATIVE_BINDING_CONFLICT','Reused operation identity has different binding instructions');
        return {recordId:loc.id,alreadyApplied:true};
      }
      if((row?.revision??null)!==p.expectedRevision)fail('REVISION_CONFLICT','Native binding changed since approval');
      if(p.action==='bind'&&row)fail('NATIVE_BINDING_EXISTS','A stable binding already exists');
      if(p.action!=='bind'&&(!row||row.status!=='bound'||row.nativeId!==p.previousNativeId||
         row.documentKind!==p.documentKind))
        fail('NATIVE_BINDING_STALE','The previous bound document does not match the authorized change');
      if(p.action!=='detach'){
        const doc=collection(p.documentKind).get(p.nativeId);
        if(!doc||doc.id!==p.nativeId||doc.pack)fail('NATIVE_BINDING_TARGET_MISSING','Target world document is missing or not a world document');
        // The binding stores only the opaque reference. No native document data
        // or secret metadata is copied into the public world collection.
      }
      const next=await repository.put({...loc,kind:'native-resource-binding',scope:p.scope,
        resourceId:p.resourceId,sourceGraphId:p.sourceGraphId,documentKind:p.documentKind,
        nativeId:p.action==='detach'?null:p.nativeId,status:p.action==='detach'?'detached':'bound',
        ownership:p.ownership,visibility:'gm-only',previousNativeId:p.previousNativeId,
        lastRequestedNativeId:p.nativeId,lastAction:p.action,lastOperationId:ctx.operationId,
        lastSourceEventId:ctx.sourceEventId},
      {expectedRevision:p.expectedRevision,gm:g});
      const confirmed=(await inspect(p)).row;
      if(confirmed?.revision!==next.revision||confirmed.lastOperationId!==ctx.operationId)
        fail('NATIVE_BINDING_UNCERTAIN','Protected binding update lacks read-back verification');
      return {recordId:loc.id,revision:next.revision};
    },
    async verify(spec,ctx){
      const p=validateNativeBinding(spec),{row}=await inspect(p);
      return Boolean(row&&row.lastOperationId===ctx?.operationId&&row.lastSourceEventId===ctx?.sourceEventId&&
        row.lastAction===p.action&&row.lastRequestedNativeId===p.nativeId&&
        row.previousNativeId===p.previousNativeId&&row.documentKind===p.documentKind&&
        row.nativeId===(p.action==='detach'?null:p.nativeId)&&row.ownership===p.ownership);
    }
  });
}
