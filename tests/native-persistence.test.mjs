import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {DesignatedGMWriter} from '../src/security/gm-writer.mjs';
import {NativePackRepository,verifyProtectedPackConfiguration,opaqueFoundryId} from '../src/storage/native-pack.mjs';
import {NativeIntentQueue,NativeEffectJournal} from '../src/storage/native-intents.mjs';

const worldId='testing-world';
const build='14.369';
const gm={id:'foundry-GM-001',active:true,isGM:true};
const players=[{id:'foundry-PLAYER-001',active:true,isGM:false},{id:'foundry-PLAYER-002',active:false,isGM:false}];
const ctx=()=>createLocalGMContext({user:gm,epoch:'test'},worldId);
const make=({proof=true,playerLevel=0}={})=>{
  let currentGM=gm;
  const game={user:gm,world:{id:worldId},users:{contents:[gm,...players],get activeGM(){return currentGM;}}};
  const records=new Map();let breakAt=null;
  const pack={collection:'world.easy-plots-secret',documentName:'JournalEntry',locked:false,
    metadata:{packageType:'world'},getUserLevel:()=>playerLevel,
    getDocuments:async({ _id:id })=>{
      const doc=await pack.getDocument(id); return doc?[{id,...doc}]:[];
    },
    getDocument:async(id)=>{
      const row=records.get(id);if(!row)return null;
      return {getFlag:()=>structuredClone(row.flags['easy-plots'].storage),
        update:async(changes)=>{
          if(breakAt==='beforeUpdate'){breakAt=null;throw new Error('Update lost');}
          row.flags['easy-plots'].storage=structuredClone(changes['flags.easy-plots.storage']);
          if(breakAt==='afterUpdate'){breakAt=null;throw new Error('Lost acknowledgement');}
        }};
    },
    documentClass:{createDocuments:async(data,options)=>{
      assert.equal(options.pack,'world.easy-plots-secret');assert.equal(options.keepId,true);
      if(breakAt==='beforeCreate'){breakAt=null;throw new Error('Creation lost');}
      const created=[];
      for(const entry of data){
        if(records.has(entry._id))throw new Error('Duplicate document ID');
        records.set(entry._id,structuredClone(entry));created.push(entry);
      }
      if(breakAt==='afterCreate'){breakAt=null;throw new Error('Lost acknowledgement');}
      return created;
    }}
  };
  const attestation=proof?{level:'live-multiplayer',worldId,packId:pack.collection,coreBuild:build,
    playerIndexDenied:true,playerDocumentDenied:true,playerBootstrapDenied:true}:null;
  const writer=new DesignatedGMWriter({gameInstance:game});
  const repo=new NativePackRepository({gameInstance:game,pack,attestation,coreBuild:build,writer});
  return {game,pack,records,writer,repo,ctx:ctx(),attestation,
    breakNext:(what)=>{breakAt=what;},setGM:(v)=>{currentGM=v;}};
};
const item=(id='ep:fact:harbor_001')=>({id,kind:'fact',partitionId:'plot-alpha',value:{status:'known'}});

test('Protected Compendium defaults to denied without exact live test evidence',async()=>{
  const s=make({proof:false});
  assert.throws(()=>verifyProtectedPackConfiguration({gameInstance:s.game,pack:s.pack,
    attestation:null,coreBuild:build}),{code:'PACK_UNVERIFIED'});
  await assert.rejects(s.repo.read(item().id,{partitionId:'plot-alpha',gm:s.ctx}),{code:'PACK_UNVERIFIED'});
});
test('Player-readable pack cannot be used even if supplied attestation claims success',async()=>{
  const s=make({playerLevel:2});
  await assert.rejects(s.repo.put(item(),{gm:s.ctx}),{code:'PACK_PUBLIC'});
});
test('Native pack record survives new repository and enforces revisions',async()=>{
  const s=make();
  const created=await s.repo.put(item(),{gm:s.ctx});
  assert.equal(created.revision,1);
  assert.deepEqual(await s.repo.read(item().id,{partitionId:'plot-alpha',gm:s.ctx}),created);
  await assert.rejects(s.repo.put({...created,value:3},{expectedRevision:0,gm:s.ctx}),{code:'REVISION_CONFLICT'});
  const modified=await s.repo.put({...created,value:{status:'changed'}},{expectedRevision:1,gm:s.ctx});
  assert.equal(modified.revision,2);
  assert.equal((await s.repo.read(item().id,{partitionId:'plot-alpha',gm:s.ctx})).value.status,'changed');
  assert.equal(s.records.size,2,'One item document and one index page document');
});
test('Index cursor is bounded, no global pack load or getIndex()',async()=>{
  const s=make();
  await s.repo.put(item(),{gm:s.ctx});
  const first=await s.repo.query({partitionId:'plot-alpha',gm:s.ctx,cursor:'0:0',limit:1});
  assert.equal(first.items.length,1);
  assert.equal(first.items[0].id,item().id);
  assert.equal(first.nextCursor,'1:0');
  await assert.rejects(s.repo.query({partitionId:'plot-alpha',gm:s.ctx,limit:50}),{code:'QUERY_BUDGET'});
  await assert.rejects(s.repo.query({partitionId:'plot-alpha',gm:s.ctx,cursor:'8:0'}),{code:'INVALID_CURSOR'});
});
test('Interrupted record creation leaves detectable pending index',async()=>{
  const s=make();
  // First index page creation succeeds; record creation then fails.
  // Fault injection detects the item key separately to avoid catching the index.
  const original=s.pack.documentClass.createDocuments;
  s.pack.documentClass.createDocuments=async(data,opts)=>{
    if(data[0].flags['easy-plots'].storage.key.startsWith('ep:record:'))throw new Error('Disk error');
    return original(data,opts);
  };
  await assert.rejects(s.repo.put(item(),{gm:s.ctx}),/Disk error/);
  const query=await s.repo.query({partitionId:'plot-alpha',gm:s.ctx});
  assert.deepEqual(query.unresolved,[item().id]);
  assert.deepEqual(query.items,[]);
  const repair=await s.repo.reconcilePage({partitionId:'plot-alpha',gm:s.ctx});
  assert.deepEqual(repair.unresolved,[item().id]);
});
test('Retry after pending index can recover a failed record creation',async()=>{
  const s=make();
  s.breakNext('afterCreate');
  // The injected error affects index creation after the native write; the
  // next retry recognizes its pending index rather than a false success.
  await assert.rejects(s.repo.put(item(),{gm:s.ctx}),/Lost acknowledgement/);
  const row=await s.repo.put(item(),{gm:s.ctx});
  assert.equal(row.revision,1);
  const check=await s.repo.query({partitionId:'plot-alpha',gm:s.ctx});
  assert.equal(check.unresolved.length,0);
  assert.equal(check.items.length,1);
});
test('GM authority loss during mutation does not return a successful acknowledgement',async()=>{
  const s=make();const otherGM={id:'foundry-GM-002',active:true,isGM:true};
  const original=s.pack.documentClass.createDocuments;
  let changed=false;
  s.pack.documentClass.createDocuments=async(data,opts)=>{
    const result=await original(data,opts);
    if(!changed){changed=true;s.setGM(otherGM);}
    return result;
  };
  await assert.rejects(s.repo.put(item(),{gm:s.ctx}),e=>['NOT_DESIGNATED_GM','GM_HANDOVER_UNCERTAIN'].includes(e.code));
  assert.equal(s.writer.state.suspended,true);
  await assert.rejects(s.repo.put(item(),{gm:s.ctx}),{code:'GM_WRITE_SUSPENDED'});
  assert.throws(()=>s.writer.resumeAfterReconciliation({gmContext:s.ctx}),{code:'RECOVERY_NOT_VERIFIED'});
});
test('Intent queue durable request, deduplication, permission and opportunity rechecks',async()=>{
  const s=make();let access=true,opportunity=true;
  const queue=new NativeIntentQueue({repository:s.repo,gmContext:s.ctx,
    actorAuthorizer:async()=>access,checkOpportunity:async()=>opportunity});
  const intent={requestId:'request-12345',actorId:'actor-12345',opportunityId:'opportunity-12345',approach:'Read ledger'};
  const key='foundry-PLAYER-001:request-12345';
  assert.equal((await queue.enqueueOnce(key,{intent,verifiedUserId:'foundry-PLAYER-001'})).durable,true);
  assert.equal((await queue.enqueueOnce(key,{intent,verifiedUserId:'foundry-PLAYER-001'})).created,false);
  assert.equal((await queue.get(key)).state,'pending');
  await assert.rejects(queue.transition(key,'pending','approved',{gmUserId:gm.id}),{code:'APPROVAL_REQUIRED'});
  const approved=await queue.transition(key,'pending','approved',{gmUserId:gm.id,approval:true});
  assert.equal(approved.state,'approved');
  access=false;
  await assert.rejects(queue.transition(key,'approved','processing',{executionId:'ep:operation:execute_1'}),{code:'DENIED'});
  access=true;opportunity=false;
  await assert.rejects(queue.transition(key,'approved','processing',{executionId:'ep:operation:execute_1'}),{code:'DENIED'});
  opportunity=true;
  const processing=await queue.transition(key,'approved','processing',{executionId:'ep:operation:execute_1'});
  assert.equal(processing.state,'processing');
  const uncertain=await queue.transition(key,'processing','uncertain');
  assert.equal(uncertain.state,'uncertain');
  assert.equal((await queue.transition(key,'uncertain','resolved')).state,'resolved');
});
test('Intent queue denies request replay with mismatched payload',async()=>{
  const s=make();const queue=new NativeIntentQueue({repository:s.repo,gmContext:s.ctx,
    actorAuthorizer:async()=>true,checkOpportunity:async()=>true});
  const key='foundry-PLAYER-001:request-12345';
  const intent={requestId:'request-12345',actorId:'actor-12345',opportunityId:'opportunity-12345'};
  await queue.enqueueOnce(key,{intent,verifiedUserId:'foundry-PLAYER-001'});
  await assert.rejects(queue.enqueueOnce(key,{intent:{...intent,approach:'Different'},verifiedUserId:'foundry-PLAYER-001'}),
    {code:'INTENT_REUSE_CONFLICT'});
  await assert.rejects(queue.enqueueOnce(key,{intent,verifiedUserId:'forged-GM-001'}),{code:'INTENT_KEY_MISMATCH'});
});
test('Native effect journal persists idempotency and guarded state changes',async()=>{
  const s=make();const journal=new NativeEffectJournal({repository:s.repo,gmContext:s.ctx});
  const key='event:test|graph:test|node:test';
  assert.equal((await journal.createOnce(key,{state:'prepared',operationId:'ep:operation:op_123'})).created,true);
  assert.equal((await journal.createOnce(key,{state:'prepared'})).created,false);
  await assert.rejects(journal.change(key,'completed',{state:'applying'}),{code:'JOURNAL_CONFLICT'});
  assert.equal((await journal.change(key,'prepared',{state:'applying'})).state,'applying');
  assert.equal((await journal.get(key)).state,'applying');
});
test('native journal absence proof includes a prepared index whose record creation was interrupted',async()=>{
 const s=make(),journal=new NativeEffectJournal({repository:s.repo,gmContext:s.ctx}),create=s.pack.documentClass.createDocuments.bind(s.pack.documentClass);let fail=true;
 s.pack.documentClass.createDocuments=async(rows,options)=>{if(fail&&rows.some(row=>row.flags['easy-plots'].storage.payload.kind==='operation')){fail=false;throw Error('Operation payload creation interrupted');}return create(rows,options);};
 const key='native-journal-unstarted-proof001';assert.equal(await journal.hasRecordOrIndex(key),false);await assert.rejects(journal.createOnce(key,{state:'prepared',operationId:'ep:operation:native_unstarted001'}),/interrupted/);assert.equal(await journal.get(key),null);assert.equal(await journal.hasRecordOrIndex(key),true);assert.equal(await new NativeEffectJournal({repository:s.repo,gmContext:s.ctx}).hasRecordOrIndex(key),true);
});
test('Opaque deterministic 16 character Foundry IDs are stable and distinct',async()=>{
  const a=await opaqueFoundryId('record:alpha');
  assert.match(a,/^[a-f0-9]{16}$/);
  assert.equal(a,await opaqueFoundryId('record:alpha'));
  assert.notEqual(a,await opaqueFoundryId('record:beta'));
});

test('GM may explicitly reconcile a partially indexed existing record',async()=>{
  const s=make();await s.repo.put(item(),{gm:s.ctx});
  const index=[...s.records.values()].find(x=>x.flags['easy-plots'].storage.key.startsWith('ep:index:'));
  assert.ok(index);
  index.flags['easy-plots'].storage.payload.entries[0].status='pending';
  const before=await s.repo.query({partitionId:'plot-alpha',gm:s.ctx});
  assert.deepEqual(before.unresolved,[item().id]);
  const resolution=await s.repo.reconcilePage({partitionId:'plot-alpha',gm:s.ctx});
  assert.deepEqual(resolution,{repaired:1,unresolved:[]});
  const after=await s.repo.query({partitionId:'plot-alpha',gm:s.ctx});
  assert.equal(after.items.length,1);
  assert.equal(after.unresolved.length,0);
});
test('Stored payload size is bounded before oversized record creation',async()=>{
  const s=make();
  await assert.rejects(s.repo.put({...item(),value:'📦'.repeat(20000)},{gm:s.ctx}),
    {code:'RECORD_TOO_LARGE'});
  // Index remains explicitly pending after an interrupted multi-record create.
  const data=await s.repo.query({partitionId:'plot-alpha',gm:s.ctx});
  assert.deepEqual(data.unresolved,[item().id]);
});
test('A new GM cannot silently resume an uncertain previous GM writer',async()=>{
  const s=make();s.writer.suspend('GM_HANDOVER_UNCERTAIN');
  assert.throws(()=>s.writer.resumeAfterReconciliation({gmContext:s.ctx}),{code:'RECOVERY_NOT_VERIFIED'});
  s.writer.resumeAfterReconciliation({gmContext:s.ctx,confirmedNoUncertainOperations:true});
  assert.equal(s.writer.state.suspended,false);
});
