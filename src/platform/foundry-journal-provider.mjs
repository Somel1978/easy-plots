/** GM-approved Foundry-native JournalEntry shell materializer (v14-compatible).
 * No raw HTML, scripted pages, arbitrary document patches, or auto-deletes.
 * The protected repository stores provenance; the created Journal is a neutral
 * shell with NONE ownership. Interrupted creation never automatically retries.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const OP=/^ep:operation:[a-zA-Z0-9_:-]{6,200}$/;
const EV=/^ep:event:[a-zA-Z0-9_-]{8,120}$/;
const SCOPE=/^[a-z][a-z0-9-]{0,45}$/;
const MODULE='easy-plots';
export function validateJournalMaterialization(p){
 assertPlainObject(p,'MATERIALIZE_DATA');
 const allowed=['scope','resourceId','sourceGraphId','expectedRevision','visibility'];
 if(Object.keys(p).some(k=>!allowed.includes(k)))fail('MATERIALIZE_FIELD','Only typed resource references may be materialized');
 assertNarrativeId(p.resourceId);assertNarrativeId(p.sourceGraphId);
 if(!SCOPE.test(p.scope??'')||p.visibility!=='gm-only'||p.expectedRevision!==null)
   fail('MATERIALIZE_POLICY','Explicit GM-only create contract and null expected revision required');
 return structuredClone(p);
}
export async function journalMaterializationLocator(p){
 const payload=validateJournalMaterialization(p);
 const digest=await sha256Hex(`${payload.scope}\0${payload.resourceId}\0${payload.sourceGraphId}`);
 return {id:`ep:materialization:${digest.slice(0,24)}`,partitionId:`materialize-journal-${payload.scope}-${digest.slice(0,2)}`,
   nativeId:digest.slice(0,16),proof:digest.slice(16,40)};
}
export function createFoundryJournalMaterializationProvider({repository,gmProvider,gameInstance,writer}={}){
 if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function'||
   typeof gameInstance?.journal?.documentClass?.createDocuments!=='function'||typeof gameInstance.journal.get!=='function')
   fail('MATERIALIZE_DEPS','Protected repository, GM writer, and native JournalEntry collection required');
 const gm=()=>{const g=gmProvider();assertLocalGM(g);writer.assertEligible(g);return g;};
 async function locate(p){const loc=await journalMaterializationLocator(p);return loc;}
 async function inspect(p){const ctx=gm(),loc=await locate(p),row=await repository.read(loc.id,{partitionId:loc.partitionId,gm:ctx});
   if(row&&(row.id!==loc.id||row.partitionId!==loc.partitionId||row.kind!=='journal-materialization'||row.resourceId!==p.resourceId))
     fail('MATERIALIZE_CORRUPT','Resource provenance does not match protected index');
   if(row&&typeof repository.hasReadyIndex==='function'&&!await repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:ctx}))
     fail('INDEX_UNCERTAIN','Materialization provenance index is not ready');
   return {loc,row};
 }
 const native=loc=>gameInstance.journal.get(loc.nativeId);
 const confirms=(doc,loc)=>doc?.id===loc.nativeId&&doc?.getFlag?.(MODULE,'resourceProof')===loc.proof;
 return Object.freeze({id:'narrative.materialize-journal-shell',version:'1.0.0',validate:validateJournalMaterialization,
   inspect,
   async apply(payload,ctx){
     const p=validateJournalMaterialization(payload);
     if(!OP.test(ctx?.operationId)||!EV.test(ctx?.sourceEventId))fail('MATERIALIZE_PROVENANCE','Approved operation and event required');
     const {loc,row}=await inspect(p);
     if(row){
       if(row.operationId===ctx.operationId&&row.state==='ready'&&confirms(native(loc),loc))return {recordId:loc.id,alreadyApplied:true};
       fail('MATERIALIZE_RECONCILIATION_REQUIRED','A previous native resource creation needs explicit reconciliation');
     }
     if(native(loc))fail('MATERIALIZE_NATIVE_COLLISION','Native ID is already in use without matching provenance');
     // Journal metadata contains no hidden narrative identifier or GM text.
     const prepared=await repository.put({...loc,kind:'journal-materialization',scope:p.scope,
       sourceGraphId:p.sourceGraphId,resourceId:p.resourceId,visibility:'gm-only',operationId:ctx.operationId,
       sourceEventId:ctx.sourceEventId,state:'prepared'}, {expectedRevision:null,gm:gm()});
     const verified=await inspect(p);
     if(!verified.row||verified.row.state!=='prepared'||verified.row.revision!==prepared.revision)
       fail('MATERIALIZE_RECONCILIATION_REQUIRED','Failed to verify prepared resource record');
     try{
       const docs=await gameInstance.journal.documentClass.createDocuments([{
         _id:loc.nativeId,name:`Easy Plots Resource ${loc.nativeId.slice(-6)}`,
         ownership:{default:0},flags:{[MODULE]:{resourceProof:loc.proof}}
       }],{keepId:true});
       if(!Array.isArray(docs)||docs.length!==1||!confirms(native(loc),loc))
         fail('MATERIALIZE_WRITE_UNCERTAIN','Native Journal creation could not be verified');
       const ready=await repository.put({...verified.row,state:'ready',nativeId:loc.nativeId},
         {expectedRevision:verified.row.revision,gm:gm()});
       const observed=await inspect(p);
       if(observed.row?.state!=='ready'||observed.row.revision!==ready.revision)
         fail('MATERIALIZE_WRITE_UNCERTAIN','Protected provenance acknowledgement failed');
       return {recordId:loc.id,nativeUuid:`JournalEntry.${loc.nativeId}`,revision:ready.revision};
     }catch(error){
       // A server write may have succeeded even if acknowledgment was lost.
       // Do not duplicate create; keep durable prepared state for review.
       throw new EasyPlotsError('MATERIALIZE_RECONCILIATION_REQUIRED','Native resource may be partially created; inspect before recovery',{reason:error.code??'UNKNOWN'});
     }
   },
   async confirmOriginal(payload,ctx,{approved=false}={}){
     const p=validateJournalMaterialization(payload);if(approved!==true||!OP.test(ctx?.operationId)||!EV.test(ctx?.sourceEventId))fail('MATERIALIZE_CONFIRMATION','Explicit original-outcome review required');const {loc,row}=await inspect(p),document=native(loc);if(!row||!['prepared','ready'].includes(row.state)||row.operationId!==ctx.operationId||row.sourceEventId!==ctx.sourceEventId||document?.pack||document?.ownership?.default!==0||!confirms(document,loc))fail('MATERIALIZE_UNCONFIRMED','Only the exact already-created owned original Journal can be confirmed');if(row.state==='ready')return {recordId:row.id,alreadyConfirmed:true};const actor=gm();await repository.put({...row,state:'ready',nativeId:loc.nativeId,confirmedBy:actor.userId,confirmation:'native-observed-original-v1'},{expectedRevision:row.revision,gm:actor});const observed=await inspect(p);if(observed.row?.state!=='ready'||observed.row.operationId!==ctx.operationId||observed.row.sourceEventId!==ctx.sourceEventId||observed.row.confirmedBy!==actor.userId||!confirms(native(loc),loc))fail('MATERIALIZE_UNCONFIRMED','Original native Journal proof was not durably verified');return {recordId:row.id,confirmed:true};
   },
   async verify(payload,ctx){
     const p=validateJournalMaterialization(payload);
     const {loc,row}=await inspect(p);
     return Boolean(row?.state==='ready'&&row.operationId===ctx?.operationId&&row.sourceEventId===ctx?.sourceEventId&&confirms(native(loc),loc));
   }
 });
}
