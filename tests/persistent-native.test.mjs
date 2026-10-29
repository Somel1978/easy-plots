import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {DesignatedGMWriter} from '../src/security/gm-writer.mjs';
import {NativePackRepository} from '../src/storage/native-pack.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {graph} from './fixtures.mjs';

function makePack({approved=true}={}){
  const gm={id:'gm_one',isGM:true,active:true};
  const player={id:'player_one',isGM:false,active:true};
  const game={user:gm,world:{id:'test-world'},users:{contents:[gm,player],get activeGM(){return gm;}}};
  const data=new Map();const pack={
    collection:'world.easy-plots-secret',documentName:'JournalEntry',locked:false,
    metadata:{packageType:'world'},getUserLevel:()=>0,
    getDocuments:async({_id})=>{
      const row=data.get(_id);if(!row)return [];
      return [{id:_id,getFlag:()=>structuredClone(row.flags['easy-plots'].storage),update:async(changes)=>{
        row.flags['easy-plots'].storage=structuredClone(changes['flags.easy-plots.storage']);
      }}];
    },
    documentClass:{createDocuments:async(docs,{pack,keepId})=>{
      assert.equal(pack,'world.easy-plots-secret');assert.equal(keepId,true);
      for(const doc of docs){if(data.has(doc._id))throw new Error('Duplicate');data.set(doc._id,structuredClone(doc));}
      return docs;
    }}
  };
  const ctx=createLocalGMContext({user:gm,epoch:'native-test'},game.world.id);
  const writer=new DesignatedGMWriter({gameInstance:game});
  const attestation=approved?{level:'live-multiplayer',worldId:game.world.id,packId:pack.collection,coreBuild:'14.369',playerIndexDenied:true,playerDocumentDenied:true,playerBootstrapDenied:true}:null;
  const repo=new NativePackRepository({gameInstance:game,pack,attestation,coreBuild:'14.369',writer});
  const registry=()=>new PersistentGraphRegistry({repository:repo,gmProvider:()=>ctx});
  return {ctx,game,pack,repo,registry,data,writer};
}

test('mocked native Foundry Compendium persists draft snapshot and active pointer separately',async()=>{
  const s=makePack(),r=s.registry();const g=graph();
  await r.saveDraft(g);
  assert.equal((await s.registry().getDraft(g.id)).revision,1);
  await r.publish(g.id,{expectedRevision:1});
  assert.equal(await r.getActive(g.id),null);
  const active=await r.activate(g.id,1);
  assert.equal(active.revision,1);
  assert.equal((await s.registry().getActive(g.id)).publishedVersion,1);
  assert.equal(s.data.size,6,'Three native documents and three bounded index documents');
  await r.deactivate(g.id,{expectedActivationRevision:1});
  assert.equal(await r.getActive(g.id),null);
});

test('native Compendium publication is denied without live access evidence',async()=>{
  const s=makePack({approved:false});
  await assert.rejects(s.registry().saveDraft(graph()),{code:'PACK_UNVERIFIED'});
  assert.equal(s.data.size,0);
});

test('interrupted native snapshot write cannot activate a non-durable revision',async()=>{
  const s=makePack(),r=s.registry(),g=graph();await r.saveDraft(g);
  const prior=s.pack.documentClass.createDocuments;
  s.pack.documentClass.createDocuments=async(docs,opts)=>{
    if(docs[0].flags?.['easy-plots']?.storage?.key?.startsWith('ep:record:graph-snapshots:'))
      throw new Error('Simulated disk failure on snapshot');
    return prior(docs,opts);
  };
  await assert.rejects(r.publish(g.id,{expectedRevision:1}),/Simulated disk failure/);
  await assert.rejects(r.activate(g.id,1),{code:'NOT_FOUND'});
  assert.equal(await r.getActive(g.id),null);
});

test('native graph registry rejects a snapshot with an incomplete partition index',async()=>{
  const s=makePack(),r=s.registry(),g=graph();await r.saveDraft(g);
  const prior=s.pack.documentClass.createDocuments;
  // Write pending record and actual snapshot, but fail before committing the ready index.
  const priorGet=s.pack.getDocuments;
  let blockReady=true;
  s.pack.getDocuments=priorGet;
  const docWrites=[];
  s.pack.documentClass.createDocuments=async(docs,opts)=>{docWrites.push(docs[0].flags['easy-plots'].storage.key);return prior(docs,opts);};
  // Allow the native snapshot to be created, but return failure when its
  // index transitions from pending to ready.
  const original=s.pack.getDocuments;
  s.pack.getDocuments=async(query)=>{
    const docs=await original(query);
    if(blockReady)for(const doc of docs){
      const value=doc.getFlag('easy-plots','storage');
      if(value?.key?.startsWith('ep:index:graph-snapshots:')){
        const originalUpdate=doc.update;
        doc.update=async(change)=>{
          if(change['flags.easy-plots.storage']?.payload?.entries?.some(e=>e.status==='ready')){
            blockReady=false;throw new Error('Power loss during index finalization');
          }
          return originalUpdate(change);
        };
      }
    }
    return docs;
  };
  await assert.rejects(r.publish(g.id,{expectedRevision:1}),/Power loss during index finalization/);
  await assert.rejects(r.getPublished(g.id,1),{code:'INDEX_UNCERTAIN'});
  await assert.rejects(r.activate(g.id,1),{code:'INDEX_UNCERTAIN'});
});
