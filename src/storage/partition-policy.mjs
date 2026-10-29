/** All tiers live in the same attested GM-only native pack. These names are
 * loading policy, never a change in permissions or native document ownership. */
import {EasyPlotsError} from '../contracts/errors.mjs';
export const NATIVE_PARTITION_POLICY=Object.freeze({version:1,pageSize:32,pagesPerShard:8,maxDepth:20,maxMigrationPages:8,tiers:['top-level','shard','historical']});
export function storageTierForRecord(record){
 const kind=record?.kind;
 if(typeof kind!=='string'||!kind.length)return 'shard';
 return kind==='domain-revision'||kind==='immutable-graph-page'||kind==='immutable-graph-manifest'||kind==='graph-snapshot'||kind==='published-graph'||kind==='blueprint-revision'||/^arc-archive(?:-|$)/.test(kind)?'historical':'shard';
}
export function assertPartitionId(partitionId){
 if(typeof partitionId!=='string'||!partitionId.length||partitionId.length>240)throw new EasyPlotsError('SCOPE_REQUIRED','Bounded explicit partition required');
}
export const partitionManifestKey=(partitionId,path='')=>`ep:partition:${partitionId}:${path||'root'}`;
// Preserve every legacy index and payload key. Only split leaf indices have a
// new physical key; narrative IDs, references and public locators never move.
export const partitionIndexKey=(partitionId,page,path='')=>path?`ep:shard-index:${partitionId}:${path}:${page}`:`ep:index:${partitionId}:${page}`;
export function hashBit(hex,depth){return (parseInt(hex[Math.floor(depth/4)],16)>>(3-depth%4))&1;}
