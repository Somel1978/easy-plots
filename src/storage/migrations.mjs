/** Explicit bounded native-record migrations with durable provenance.
 * This is NOT an all-world automatic migrator: one selected, GM-authorized
 * record is upgraded by an exact registered kind/version contract. The original
 * record is journaled before mutation. Recovery is read-only until reviewed.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const MAX_BYTES=24000;
const hash=async value=>sha256Hex(JSON.stringify(value));
function boundedRecord(row){
 assertPlainObject(row,'MIGRATION_RECORD');assertNarrativeId(row.id);
 if(typeof row.kind!=='string'||! /^[a-z][a-z0-9-]{1,90}$/.test(row.kind)||typeof row.partitionId!=='string'||row.partitionId.length>120)
   fail('MIGRATION_RECORD','Record needs explicit type and bounded partition');
 if(!Number.isSafeInteger(row.revision)||row.revision<1)fail('MIGRATION_RECORD','Source revision is required');
 if(new TextEncoder().encode(JSON.stringify(row)).length>MAX_BYTES)fail('MIGRATION_BUDGET','Migration source exceeds bounded record size');
 return row;
}
export async function migrationLocator({recordId,partitionId,targetVersion}){
 assertNarrativeId(recordId);
 if(typeof partitionId!=='string'||!partitionId.length||!Number.isSafeInteger(targetVersion)||targetVersion<2)
   fail('MIGRATION_SCOPE','Migration needs explicit target version and partition');
 const digest=await sha256Hex(`${recordId}\0${partitionId}\0${targetVersion}`);
 return {id:`ep:migration:${digest.slice(0,24)}`,partitionId:`migration-audit-${digest.slice(0,2)}`};
}
export class NativeRecordMigrationRegistry {
 #repository;#gm;#steps=new Map();
 constructor({repository,gmProvider}={}){
   if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function')
     fail('MIGRATION_DEPS','GM-authorized repository and context required');
   this.#repository=repository;this.#gm=gmProvider;
 }
 register({kind,from,to,transform}={}){
   if(typeof kind!=='string'||! /^[a-z][a-z0-9-]{1,90}$/.test(kind)||!Number.isSafeInteger(from)||from<1||to!==from+1||typeof transform!=='function')
     fail('MIGRATION_CONTRACT','Sequential typed migration required');
   const key=`${kind}:${from}`;if(this.#steps.has(key))fail('MIGRATION_DUPLICATE','Migration contract already registered');
   this.#steps.set(key,{kind,from,to,transform});return this;
 }
 #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
 async #read(recordId,partitionId){return this.#repository.read(recordId,{partitionId,gm:this.#context()});}
 async #audit(recordId,partitionId,targetVersion){
   const loc=await migrationLocator({recordId,partitionId,targetVersion});
   const row=await this.#read(loc.id,loc.partitionId);
   if(row&&(row.id!==loc.id||row.partitionId!==loc.partitionId||row.kind!=='migration-audit'||row.recordId!==recordId||row.targetPartitionId!==partitionId||row.toVersion!==targetVersion))
     fail('MIGRATION_CORRUPT','Migration audit identity mismatch');
   if(row&&typeof this.#repository.hasReadyIndex==='function'&&!await this.#repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:this.#context()}))
     fail('INDEX_UNCERTAIN','Migration audit index is not ready');
   return {loc,row};
 }
 async preview({recordId,partitionId,targetVersion}={}){
   this.#context();const source=boundedRecord(await this.#read(recordId,partitionId));
   if(source.id!==recordId||source.partitionId!==partitionId)fail('MIGRATION_RECORD','Stored key mismatch');
   const currentVersion=source.contractVersion??1;
   if(!Number.isSafeInteger(currentVersion)||currentVersion<1||targetVersion<=currentVersion||targetVersion>currentVersion+8)
     fail('MIGRATION_RANGE','A bounded forward migration is required');
   const steps=[],draft=clone(source);
   for(let version=currentVersion;version<targetVersion;version++){
     const step=this.#steps.get(`${source.kind}:${version}`);if(!step)fail('MIGRATION_STEP_MISSING',`No ${source.kind} migration ${version}->${version+1}`);
     const updated=step.transform(clone(draft));
     assertPlainObject(updated,'MIGRATION_OUTPUT');
     for(const field of ['id','kind','partitionId','revision'])if(JSON.stringify(updated[field])!==JSON.stringify(source[field]))
       fail('MIGRATION_IDENTITY','Migration cannot rewrite stable identity, revision or ownership');
     // Prior migration functions must not mutate their input or stash raw Foundry objects.
     if(new TextEncoder().encode(JSON.stringify(updated)).length>MAX_BYTES)fail('MIGRATION_BUDGET','Migrated record exceeds bound');
     Object.assign(draft,clone(updated),{contractVersion:version+1});
     steps.push(`${source.kind}:${version}->${version+1}`);
   }
   const next=clone(draft),sourceDigest=await hash(source),targetDigest=await hash(next);
   return {recordId,partitionId,sourceRevision:source.revision,fromVersion:currentVersion,toVersion:targetVersion,
     sourceDigest,targetDigest,steps,source:clone(source),candidate:next,status:'preview-only'};
 }
 async apply({recordId,partitionId,targetVersion}={}){
   this.#context();
   const priorAudit=await this.#audit(recordId,partitionId,targetVersion);
   if(priorAudit.row)fail('MIGRATION_RECONCILIATION_REQUIRED','Migration already attempted; inspect audit, never auto-retry');
   const plan=await this.preview({recordId,partitionId,targetVersion});
   const loc=priorAudit.loc;
   const state={...loc,kind:'migration-audit',recordId,targetPartitionId:partitionId,
     fromVersion:plan.fromVersion,toVersion:plan.toVersion,sourceRevision:plan.sourceRevision,
     sourceDigest:plan.sourceDigest,targetDigest:plan.targetDigest,sourceSnapshot:plan.source,
     state:'prepared',requestedBy:this.#context().userId};
   await this.#repository.put(state,{expectedRevision:null,gm:this.#context()});
   const prepared=await this.#audit(recordId,partitionId,targetVersion);
   if(!prepared.row||prepared.row.state!=='prepared')fail('MIGRATION_AUDIT_UNCERTAIN','Preparation audit not verified');
   const applying=await this.#repository.put({...prepared.row,state:'applying'},
     {expectedRevision:prepared.row.revision,gm:this.#context()});
   try{
     const observed=boundedRecord(await this.#read(recordId,partitionId));
     if(observed.revision!==plan.sourceRevision||await hash(observed)!==plan.sourceDigest)
       fail('MIGRATION_STALE','Source changed after migration preview');
     // Rebuild the patch from the captured source only; no arbitrary client input.
     const migrated=await this.#repository.put(plan.candidate,{expectedRevision:plan.sourceRevision,gm:this.#context()});
     const verified=boundedRecord(await this.#read(recordId,partitionId));
     if(verified.revision!==migrated.revision||await hash({...verified,revision:plan.sourceRevision})!==plan.targetDigest)
       fail('MIGRATION_VERIFY','Migrated data was not verified');
     const completed=await this.#repository.put({...applying,state:'completed',resultRevision:verified.revision},
       {expectedRevision:applying.revision,gm:this.#context()});
     return {state:'completed',recordId,resultRevision:verified.revision,auditId:completed.id};
   }catch(error){
     // The source write may have succeeded even when its response was lost.
     try{await this.#repository.put({...applying,state:'uncertain',failureCode:error.code??'UNKNOWN'},
       {expectedRevision:applying.revision,gm:this.#context()});}catch{}
     throw new EasyPlotsError('MIGRATION_RECONCILIATION_REQUIRED','Migration failed; inspect historical audit before further changes',{reason:error.code??'UNKNOWN'});
   }
 }
 async inspect({recordId,partitionId,targetVersion}={}){
   this.#context();const {row}=await this.#audit(recordId,partitionId,targetVersion);
   if(!row)return {state:'not-started'};
   const target=await this.#read(recordId,partitionId);
   if(!target)return {state:'record-missing',auditState:row.state,needsGMReview:true};
   boundedRecord(target);
   const digestAtOriginalRevision=await hash({...target,revision:row.sourceRevision});
   const classification=digestAtOriginalRevision===row.targetDigest?'target-observed':
      target.revision===row.sourceRevision&&await hash(target)===row.sourceDigest?'source-observed':'conflicting-state';
   return {state:row.state,auditId:row.id,recordId,classification,needsGMReview:row.state!=='completed'||classification!=='target-observed',
     sourceSnapshotAvailable:!!row.sourceSnapshot};
 }
}
