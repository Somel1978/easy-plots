/** Versioned, published blueprint revisions and explicit instance adoption.
 * Never auto-updates the target Foundry documents or published graph snapshots.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject,clone} from '../contracts/record.mjs';
import {mergeBlueprintInstance} from '../domains/blueprints.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const SCOPE=/^[a-z][a-z0-9-]{0,47}$/;
const fieldOK=k=>/^[a-z][a-zA-Z0-9_-]{0,63}$/.test(k)&&!['id','sourceId','publishedRevision'].includes(k);
function assertSnapshot(value){assertPlainObject(value,'BLUEPRINT_CONTENT');const keys=Object.keys(value);
 if(keys.length>80||keys.some(k=>!fieldOK(k))||new TextEncoder().encode(JSON.stringify(value)).length>14000)
  fail('BLUEPRINT_CONTENT','Bounded plain blueprint fields required');
 return clone(value);
}
function revisionRecordId(blueprintId,revision){assertNarrativeId(blueprintId);
 if(!/^ep:blueprint:[a-zA-Z0-9_-]{3,105}$/.test(blueprintId)||!Number.isInteger(revision)||revision<1||revision>99999)
  fail('BLUEPRINT_REVISION','Stable blueprint source and revision required');
 const suffix=blueprintId.slice('ep:blueprint:'.length);
 return `ep:blueprint-revision:${suffix}_${revision}`;
}
function assertScope(scope){if(typeof scope!=='string'||!SCOPE.test(scope))fail('BLUEPRINT_SCOPE','Explicit scope required');}
export class PersistentBlueprintCatalog {
 #domains;
 constructor({domains}={}){if(typeof domains?.read!=='function'||typeof domains?.save!=='function')fail('BLUEPRINT_STORE','Protected domain store required');this.#domains=domains;}
 async getRevision({scope='world',blueprintId,revision}={}){
  assertScope(scope);const id=revisionRecordId(blueprintId,revision);
  const row=await this.#domains.read('blueprint-revision',scope,id);
  if(row&&(row.data.blueprintId!==blueprintId||row.data.blueprintRevision!==revision||row.data.state!=='published'))
   fail('BLUEPRINT_CORRUPT','Published revision identity mismatch');
  return row;
 }
 async publish({scope='world',blueprintId,revision,fields,sourceEventId,expectedPreviousRevision=null}={}){
  assertScope(scope);assertNarrativeId(sourceEventId);const values=assertSnapshot(fields);
  const id=revisionRecordId(blueprintId,revision);
  if(await this.getRevision({scope,blueprintId,revision}))fail('BLUEPRINT_IMMUTABLE','Published blueprint revision cannot be overwritten');
  if(revision>1){
   if(expectedPreviousRevision!==revision-1)fail('BLUEPRINT_SEQUENCE','Expected preceding revision required');
   const previous=await this.getRevision({scope,blueprintId,revision:revision-1});
   if(!previous)fail('BLUEPRINT_PREDECESSOR','Published predecessor is unavailable');
  } else if(expectedPreviousRevision!==null)fail('BLUEPRINT_SEQUENCE','Initial revision has no predecessor');
  return this.#domains.save({type:'blueprint-revision',scope,id,sourceEventId,
   data:{blueprintId,blueprintRevision:revision,fields:values,state:'published',sourceEventId}});
 }
 async instantiate({scope='world',instanceId,blueprintId,blueprintRevision,sourceEventId,overrides={}}={}){
  assertScope(scope);for(const id of [instanceId,sourceEventId])assertNarrativeId(id);
  const base=await this.getRevision({scope,blueprintId,revision:blueprintRevision});
  if(!base)fail('BLUEPRINT_MISSING','Published source revision required');
  const local=assertSnapshot(overrides);
  for(const k of Object.keys(local))if(!Object.hasOwn(base.data.fields,k))fail('BLUEPRINT_OVERRIDE','Override must reference a known source field');
  const effective={...clone(base.data.fields),...local};
  return this.#domains.save({type:'blueprint-instance',scope,id:instanceId,sourceEventId,
   data:{instanceId,blueprintId,sourceRevision:blueprintRevision,base:clone(base.data.fields),
    fields:effective,overrides:local,state:'linked',nativeResourceCreated:false,sourceEventId}});
 }
 async planAdoption({scope='world',instanceId,targetRevision}={}){
  assertScope(scope);assertNarrativeId(instanceId);
  const instance=await this.#domains.read('blueprint-instance',scope,instanceId);
  if(!instance)fail('BLUEPRINT_INSTANCE_MISSING','Instance required');
  const old=await this.getRevision({scope,blueprintId:instance.data.blueprintId,revision:instance.data.sourceRevision});
  const next=await this.getRevision({scope,blueprintId:instance.data.blueprintId,revision:targetRevision});
  if(!old||!next||targetRevision<=instance.data.sourceRevision)fail('BLUEPRINT_ADOPTION','Newer published source revision required');
  const base=old.data.fields;
  const result=mergeBlueprintInstance({base,updated:next.data.fields,instance:instance.data.fields,
   allowedKeys:[...new Set([...Object.keys(base),...Object.keys(next.data.fields),...Object.keys(instance.data.fields)])]});
  // The instance must be based on the correct published revision, not on a
  // fabricated local baseline supplied by the caller.
  if(JSON.stringify(instance.data.base)!==JSON.stringify(base))fail('BLUEPRINT_BASE_DRIFT','Instance source baseline does not match published history');
  return clone({instanceId,instanceRevision:instance.revision,targetRevision,...result,
   sourceId:instance.data.blueprintId,committed:false,nativeResourcesModified:false});
 }
 async adopt({scope='world',instanceId,targetRevision,expectedInstanceRevision,
  reviewEventId,conflictResolutions={}}={}){
  assertScope(scope);assertNarrativeId(reviewEventId);assertPlainObject(conflictResolutions,'BLUEPRINT_CONFLICT_RESOLUTIONS');
  const plan=await this.planAdoption({scope,instanceId,targetRevision});
  if(plan.instanceRevision!==expectedInstanceRevision)fail('REVISION_CONFLICT','Instance changed during GM review');
  const target=await this.getRevision({scope,blueprintId:plan.sourceId,revision:targetRevision});
  const choices=Object.keys(conflictResolutions);
  if(choices.some(key=>!plan.conflicts.some(c=>c.field===key))||
    plan.conflicts.some(c=>!['instance','source'].includes(conflictResolutions[c.field])))
   fail('BLUEPRINT_CONFLICT_REVIEW','Every conflicting field requires an explicit GM decision');
  const merged=clone(plan.merged);
  for(const [field,decision] of Object.entries(conflictResolutions))if(decision==='source'){
   if(Object.hasOwn(target.data.fields,field))merged[field]=clone(target.data.fields[field]);else delete merged[field];
  }
  const current=await this.#domains.read('blueprint-instance',scope,instanceId);
  if(current.revision!==expectedInstanceRevision)fail('REVISION_CONFLICT','Instance changed before commit');
  const overrides={};for(const key of Object.keys(merged))
   if(JSON.stringify(merged[key])!==JSON.stringify(target.data.fields[key]))overrides[key]=clone(merged[key]);
  const saved=await this.#domains.save({type:'blueprint-instance',scope,id:instanceId,
   expectedRevision:expectedInstanceRevision,sourceEventId:reviewEventId,
   data:{...clone(current.data),sourceRevision:targetRevision,base:clone(target.data.fields),
    fields:merged,overrides,adoptionEventId:reviewEventId,previousInstanceRevision:expectedInstanceRevision,
    nativeResourceCreated:false}});
  return clone({instanceId,instanceRevision:saved.revision,sourceRevision:targetRevision,
   acceptedConflicts:clone(conflictResolutions),nativeResourcesModified:false,committed:true});
 }
}
