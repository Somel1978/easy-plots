/** Immutable authored revision and instance-specific overrides with conflict-aware
 * three-way merge. Conflicts remain pending GM review, never forced adoption. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {clone} from '../contracts/record.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function mergeBlueprintInstance({base,updated,instance,allowedKeys,maxKeys=80}={}){
  if(!base||!updated||!instance||typeof base!=='object'||typeof updated!=='object'||typeof instance!=='object')fail('BLUEPRINT_INPUT','Three snapshots required');
  const keys=allowedKeys??Object.keys({...base,...updated,...instance});
  if(!Array.isArray(keys)||keys.length>maxKeys||new Set(keys).size!==keys.length)fail('BLUEPRINT_BUDGET','Bounded unique fields required');
  const merged={},conflicts=[],adopted=[],preserved=[];
  for(const key of keys){
    if(key==='id'||key==='sourceId'||key==='publishedRevision')continue;
    const b=base[key],u=updated[key],i=instance[key];
    if(eq(i,b)){merged[key]=clone(u);adopted.push(key);}
    else if(eq(u,b)||eq(u,i)){merged[key]=clone(i);preserved.push(key);}
    else {merged[key]=clone(i);conflicts.push({field:key,status:'review-required'});}
  }
  return {merged,conflicts,adopted,preserved,status:conflicts.length?'gm-reconciliation':'ready-for-gm-adoption',committed:false};
}
export function validateBlueprintPublication(blueprint,{seenRevisions=[]}={}){
  if(typeof blueprint?.id!=='string'||!Number.isInteger(blueprint.revision)||blueprint.revision<1)fail('BLUEPRINT_REVISION','Versioned blueprint required');
  if(seenRevisions.includes(`${blueprint.id}@${blueprint.revision}`))fail('BLUEPRINT_IMMUTABLE','Cannot overwrite published blueprint revision');
  return {id:blueprint.id,revision:blueprint.revision,publication:'eligible-not-committed'};
}
