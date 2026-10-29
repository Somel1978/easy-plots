import assert from 'node:assert/strict';
import {NativePackRepository} from '../../src/storage/native-pack.mjs';
import {DesignatedGMWriter} from '../../src/security/gm-writer.mjs';
import {createLocalGMContext} from '../../src/security/authority.mjs';
export function nativeStorageFixture(){
 const user={id:'gm_storage001',isGM:true,active:true},game={user,world:{id:'storage-world'},users:{contents:[user,{id:'player_storage001',isGM:false}],activeGM:user}};
 const records=new Map(),reads=[];let fault=null;
 const trip=(phase,key,value)=>{if(fault?.(phase,key,value)){fault=null;throw Error('Injected storage interruption');}};
 const pack={collection:'world.storage-secret',documentName:'JournalEntry',metadata:{packageType:'world'},locked:false,getUserLevel:()=>0,
  getDocuments:async query=>{assert.deepEqual(Object.keys(query),['_id']);const r=records.get(query._id);reads.push(r?.flags['easy-plots'].storage.key??query._id);if(!r)return [];return [{id:query._id,getFlag:()=>structuredClone(r.flags['easy-plots'].storage),update:async change=>{const value=structuredClone(change['flags.easy-plots.storage']);trip('beforeUpdate',value.key,value);r.flags['easy-plots'].storage=value;trip('afterUpdate',value.key,value);}}];},
  documentClass:{createDocuments:async(data,opts)=>{assert.equal(opts.keepId,true);for(const r of data){const value=r.flags['easy-plots'].storage;trip('beforeCreate',value.key,value);assert.equal(records.has(r._id),false);records.set(r._id,structuredClone(r));trip('afterCreate',value.key,value);}return data;}}
 };
 const gm=createLocalGMContext({user,epoch:'storage'},game.world.id),attestation={level:'live-multiplayer',worldId:game.world.id,coreBuild:'14.369',packId:pack.collection,playerIndexDenied:true,playerDocumentDenied:true,playerBootstrapDenied:true};
 const reopen=()=>new NativePackRepository({gameInstance:game,pack,attestation,coreBuild:'14.369',writer:new DesignatedGMWriter({gameInstance:game})});
 return {repo:reopen(),reopen,records,reads,user,game,gm,gmProvider:()=>gm,fault:fn=>{fault=fn;},raw:key=>[...records.values()].find(r=>r.flags['easy-plots'].storage.key===key)?.flags['easy-plots'].storage,remove:key=>{for(const [id,r] of records)if(r.flags['easy-plots'].storage.key===key)records.delete(id);}};
}
