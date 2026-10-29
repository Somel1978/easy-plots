/**
 * Bounded, GM-approved creation of *neutral shells* in Foundry world Actor/Item
 * collections. Game-system document type is checked against its declared types.
 * No description, item activity, scripts, permissions or character mechanics are
 * copied into the new shell. Native creation is intentionally never retried
 * after a protected provenance entry has been prepared.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';

const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const OP=/^ep:operation:[a-zA-Z0-9_:-]{6,200}$/;
const EV=/^ep:event:[a-zA-Z0-9_-]{8,120}$/;
const SCOPE=/^[a-z][a-z0-9-]{0,45}$/;
const TYPE=/^[a-z][a-z0-9_-]{0,79}$/;
const MODULE='easy-plots';
const TYPES=['Actor','Item'];

export function validateNativeShell(payload,kind){
  if(!TYPES.includes(kind))fail('NATIVE_KIND','Only Actor and Item shells are supported');
  assertPlainObject(payload,'NATIVE_SHELL');
  const allowed=['scope','resourceId','sourceGraphId','expectedRevision','visibility','documentType'];
  if(Object.keys(payload).some(k=>!allowed.includes(k)))fail('NATIVE_SHELL_FIELD','Only typed shell fields are allowed');
  assertNarrativeId(payload.resourceId);assertNarrativeId(payload.sourceGraphId);
  if(!SCOPE.test(payload.scope??'')||payload.expectedRevision!==null||payload.visibility!=='gm-only'||!TYPE.test(payload.documentType??''))
    fail('NATIVE_SHELL_POLICY','GM-only shell with explicit supported type and null revision required');
  return structuredClone(payload);
}

export async function nativeShellLocator(payload,kind){
  const p=validateNativeShell(payload,kind);
  // Type and native game-system subtype participate in identity: an approved
  // resource cannot silently change from NPC to character, or from Item to Actor.
  const digest=await sha256Hex(`${kind}\0${p.documentType}\0${p.scope}\0${p.resourceId}\0${p.sourceGraphId}`);
  return Object.freeze({id:`ep:native-shell:${digest.slice(0,24)}`,
    partitionId:`native-${kind.toLowerCase()}-${p.scope}-${digest.slice(0,2)}`,
    nativeId:digest.slice(0,16),proof:digest.slice(16,40)});
}

export function createFoundryActorItemShellProvider({kind,repository,gmProvider,gameInstance,writer}={}){
  if(!TYPES.includes(kind))fail('NATIVE_KIND','Unsupported native shell class');
  const collection=kind==='Actor'?gameInstance?.actors:gameInstance?.items;
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||
     typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function'||
     typeof collection?.get!=='function'||typeof collection?.documentClass?.createDocuments!=='function')
    fail('NATIVE_SHELL_DEPS','Protected repository, GM writer and native world collection required');
  const gm=()=>{const ctx=gmProvider();assertLocalGM(ctx);writer.assertEligible(ctx);return ctx;};
  const declaredTypes=()=>{
    const systemTypes=gameInstance?.system?.documentTypes?.[kind];
    // Missing system type introspection cannot justify a blind create.
    if(!Array.isArray(systemTypes)||!systemTypes.length)fail('NATIVE_TYPE_UNVERIFIED',`System ${kind} types unavailable`);
    return systemTypes;
  };
  const native=loc=>collection.get(loc.nativeId);
  const confirms=(document,loc,type)=>document?.id===loc.nativeId&&document?.type===type&&
    document?.getFlag?.(MODULE,'resourceProof')===loc.proof&&document?.ownership?.default===0;
  async function inspect(payload){
    const p=validateNativeShell(payload,kind),ctx=gm(),loc=await nativeShellLocator(p,kind);
    const row=await repository.read(loc.id,{partitionId:loc.partitionId,gm:ctx});
    if(row&&(row.id!==loc.id||row.partitionId!==loc.partitionId||row.kind!==`native-${kind.toLowerCase()}-shell`||
      row.resourceId!==p.resourceId||row.documentType!==p.documentType||row.sourceGraphId!==p.sourceGraphId))
      fail('NATIVE_SHELL_CORRUPT','Shell provenance mismatch');
    if(row&&typeof repository.hasReadyIndex==='function'&&
       !await repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:ctx}))
      fail('INDEX_UNCERTAIN','Native shell provenance index is incomplete');
    return {loc,row,nativeDocument:native(loc)};
  }
  return Object.freeze({id:`narrative.materialize-${kind.toLowerCase()}-shell`,version:'1.0.0',
    validate:p=>validateNativeShell(p,kind),inspect,
    async apply(payload,ctx){
      const p=validateNativeShell(payload,kind);
      if(!OP.test(ctx?.operationId)||!EV.test(ctx?.sourceEventId))
        fail('NATIVE_SHELL_PROVENANCE','Approved operation and event required');
      if(!declaredTypes().includes(p.documentType))fail('NATIVE_TYPE_UNSUPPORTED','Document type is not declared by the installed game system');
      const {loc,row,nativeDocument}=await inspect(p);
      if(row){
        if(row.operationId===ctx.operationId&&row.sourceEventId===ctx.sourceEventId&&row.state==='ready'&&
           confirms(nativeDocument,loc,p.documentType))return {recordId:loc.id,alreadyApplied:true};
        fail('NATIVE_SHELL_RECONCILIATION_REQUIRED','Previous native shell requires explicit reconciliation');
      }
      if(nativeDocument)fail('NATIVE_SHELL_COLLISION','Native ID occupied without matching protected provenance');
      const prepared=await repository.put({...loc,kind:`native-${kind.toLowerCase()}-shell`,resourceId:p.resourceId,
        sourceGraphId:p.sourceGraphId,scope:p.scope,documentType:p.documentType,operationId:ctx.operationId,
        sourceEventId:ctx.sourceEventId,visibility:'gm-only',state:'prepared'},
      {expectedRevision:null,gm:gm()});
      const before=await inspect(p);
      if(before.row?.revision!==prepared.revision||before.row?.state!=='prepared')
        fail('NATIVE_SHELL_RECONCILIATION_REQUIRED','Prepared shell provenance not confirmed');
      try{
        // Do not write user-provided system data, descriptions, token textures or
        // executable macros. Foundry initializes system defaults for this type.
        const docs=await collection.documentClass.createDocuments([{
          _id:loc.nativeId,type:p.documentType,
          name:`Easy Plots ${kind} ${loc.nativeId.slice(-6)}`,
          ownership:{default:0},flags:{[MODULE]:{resourceProof:loc.proof}}
        }],{keepId:true});
        if(!Array.isArray(docs)||docs.length!==1||!confirms(native(loc),loc,p.documentType))
          fail('NATIVE_SHELL_WRITE_UNCERTAIN','Native shell write cannot be verified');
        const ready=await repository.put({...before.row,state:'ready'},
          {expectedRevision:before.row.revision,gm:gm()});
        const after=await inspect(p);
        if(after.row?.revision!==ready.revision||after.row.state!=='ready')
          fail('NATIVE_SHELL_WRITE_UNCERTAIN','Protected shell acknowledgement is uncertain');
        return {recordId:loc.id,nativeUuid:`${kind}.${loc.nativeId}`,revision:ready.revision};
      }catch(error){
        throw new EasyPlotsError('NATIVE_SHELL_RECONCILIATION_REQUIRED',
          'Native creation may have occurred; manual verification is required before further actions',
          {reason:error.code??'UNKNOWN'});
      }
    },
    async confirmOriginal(payload,ctx,{approved=false}={}){
      const p=validateNativeShell(payload,kind);if(approved!==true||!OP.test(ctx?.operationId)||!EV.test(ctx?.sourceEventId))fail('NATIVE_SHELL_CONFIRMATION','Explicit original-outcome review required');const {loc,row,nativeDocument}=await inspect(p);if(!row||!['prepared','ready'].includes(row.state)||row.operationId!==ctx.operationId||row.sourceEventId!==ctx.sourceEventId||nativeDocument?.pack||!confirms(nativeDocument,loc,p.documentType))fail('NATIVE_SHELL_UNCONFIRMED','Only the exact already-created owned original native document can be confirmed');if(row.state==='ready')return {recordId:row.id,alreadyConfirmed:true};const actor=gm();await repository.put({...row,state:'ready',confirmedBy:actor.userId,confirmation:'native-observed-original-v1'},{expectedRevision:row.revision,gm:actor});const observed=await inspect(p);if(observed.row?.state!=='ready'||observed.row.operationId!==ctx.operationId||observed.row.sourceEventId!==ctx.sourceEventId||observed.row.confirmedBy!==actor.userId||!confirms(observed.nativeDocument,loc,p.documentType))fail('NATIVE_SHELL_UNCONFIRMED','Original native proof confirmation was not durably verified');return {recordId:row.id,confirmed:true};
    },
    async verify(payload,ctx){
      const p=validateNativeShell(payload,kind);
      const {loc,row,nativeDocument}=await inspect(p);
      return Boolean(row?.state==='ready'&&row.operationId===ctx?.operationId&&
        row.sourceEventId===ctx?.sourceEventId&&confirms(nativeDocument,loc,p.documentType));
    }
  });
}
