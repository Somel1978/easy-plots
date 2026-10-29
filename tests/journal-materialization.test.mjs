import test from 'node:test';import assert from 'node:assert/strict';
import {createFoundryJournalMaterializationProvider,validateJournalMaterialization} from '../src/platform/foundry-journal-provider.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gm=createLocalGMContext({user:{id:'gm-resource',isGM:true}},'test-world');
const payload={scope:'world',resourceId:'ep:resource:journal001',sourceGraphId:'ep:graph:plot001',expectedRevision:null,visibility:'gm-only'};
function make(){const docs=new Map(),repo=new MemoryPartitionRepository();
 const journal={get:id=>docs.get(id)??null,documentClass:{createDocuments:async datas=>{
   const created=datas.map(d=>{const row={id:d._id,ownership:d.ownership,name:d.name,
     getFlag:(scope,key)=>d.flags?.[scope]?.[key]};docs.set(row.id,row);return row;});return created;}}};
 const provider=createFoundryJournalMaterializationProvider({repository:repo,gmProvider:()=>gm,writer:{assertEligible:g=>assert.equal(g.userId,gm.userId)},gameInstance:{journal}});
 return {provider,docs,repo,journal};}
const ctx={operationId:'ep:operation:materialize_001',sourceEventId:'ep:event:materialize_001'};
test('approved shell materialization is idempotent and only stores opaque native metadata',async()=>{
 const {provider,docs}=make();const result=await provider.apply(payload,ctx);
 assert.match(result.nativeUuid,/^JournalEntry\.[a-f0-9]{16}$/);
 const doc=[...docs.values()][0];assert.deepEqual(doc.ownership,{default:0});assert.ok(!doc.name.includes('journal001'));
 assert.equal(await provider.verify(payload,ctx),true);
 assert.equal((await provider.apply(payload,ctx)).alreadyApplied,true);
});
test('duplicate existing native ID without provenance aborts before modification',async()=>{
 const {provider,docs}=make();const first=await provider.inspect(payload);
 docs.set(first.loc.nativeId,{id:first.loc.nativeId,getFlag:()=>null});
 await assert.rejects(()=>provider.apply(payload,ctx),{code:'MATERIALIZE_NATIVE_COLLISION'});
});
test('native lost acknowledgement leaves prepared record and prevents implicit recreation',async()=>{
 const {provider,journal}=make();journal.documentClass.createDocuments=async()=>{throw Error('disconnect');};
 await assert.rejects(()=>provider.apply(payload,ctx),{code:'MATERIALIZE_RECONCILIATION_REQUIRED'});
 assert.equal((await provider.inspect(payload)).row.state,'prepared');
 await assert.rejects(()=>provider.apply(payload,ctx),{code:'MATERIALIZE_RECONCILIATION_REQUIRED'});
});
test('explicit confirmation of an already-created original Journal repairs only protected proof and never creates another document',async()=>{
 const {provider,journal,docs}=make(),create=journal.documentClass.createDocuments;let creates=0;journal.documentClass.createDocuments=async rows=>{creates++;await create(rows);throw Error('Native create ACK lost');};await assert.rejects(provider.apply(payload,ctx),{code:'MATERIALIZE_RECONCILIATION_REQUIRED'});assert.equal(await provider.verify(payload,ctx),false);await assert.rejects(provider.confirmOriginal(payload,ctx),{code:'MATERIALIZE_CONFIRMATION'});const doc=[...docs.values()][0];doc.ownership.default=3;await assert.rejects(provider.confirmOriginal(payload,ctx,{approved:true}),{code:'MATERIALIZE_UNCONFIRMED'});doc.ownership.default=0;await provider.confirmOriginal(payload,ctx,{approved:true});assert.equal(await provider.verify(payload,ctx),true);assert.equal(creates,1);assert.equal((await provider.inspect(payload)).row.confirmedBy,gm.userId);
});
test('materializer rejects arbitrary metadata, raw html, and published secret flags',()=>{
 assert.throws(()=>validateJournalMaterialization({...payload,html:'<script>alert(1)</script>'}),{code:'MATERIALIZE_FIELD'});
 assert.throws(()=>validateJournalMaterialization({...payload,visibility:'published'}),{code:'MATERIALIZE_POLICY'});
});
