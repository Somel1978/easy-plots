/** Synthetic server-backed Compendium adapter used by native integration tests.
 * Every read requires one exact opaque document ID. This is Node adapter
 * evidence and does not attest actual Foundry multiplayer permissions. */
import {createVerifiedGMStorageAndIntentSubsystem} from '../../src/platform/native-integration.mjs';
export function syntheticNativeWorld(){
 const gm={id:'GM_001',active:true,isGM:true},player={id:'player_001',active:true,isGM:false},users=new Map([[gm.id,gm],[player.id,player]]);
 const game={user:gm,world:{id:'ep-timeline-session-testing'},users:{contents:[...users.values()],activeGM:gm,get:id=>users.get(id)}};
 const docs=new Map(),observations={fetches:[],creates:0,updates:0};
 const pack={collection:'world.ep-timeline-session-secret',metadata:{packageType:'world'},documentName:'JournalEntry',locked:false,
  getUserLevel:user=>user.isGM?3:0,
  getDocuments:async query=>{
   if(!query||Object.keys(query).length!==1||typeof query._id!=='string'||!/^[a-f0-9]{16}$/.test(query._id))throw Error('Campaign or Compendium enumeration forbidden in this fixture');
   observations.fetches.push(query._id);const doc=docs.get(query._id);if(!doc)return [];
   return [{id:query._id,getFlag:()=>structuredClone(doc.flags['easy-plots'].storage),update:async change=>{observations.updates++;doc.flags['easy-plots'].storage=structuredClone(change['flags.easy-plots.storage']);}}];
  },documentClass:{createDocuments:async rows=>{for(const row of rows){if(docs.has(row._id))throw Error('duplicate native document');docs.set(row._id,structuredClone(row));observations.creates++;}return rows;}}
 };
 const attestation={level:'live-multiplayer',worldId:game.world.id,coreBuild:'14.369',packId:pack.collection,playerIndexDenied:true,playerDocumentDenied:true,playerBootstrapDenied:true};
 const instantiate=(options={})=>createVerifiedGMStorageAndIntentSubsystem({gameInstance:game,pack,attestation,coreBuild:'14.369',checkOpportunity:async()=>true,...options});
 const addUser=user=>{users.set(user.id,user);game.users.contents=[...users.values()];};
 return {game,docs,pack,observations,instantiate,addUser};
}
