import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NativeReverseReferenceLedger} from '../src/storage/native-reverse-references.mjs';
const gm=createLocalGMContext({user:{id:'gm-refs',isGM:true}},'world-test');
const nativeId='abcdefghijklmnop',nativeUuid=`Actor.${nativeId}`;
const refs=new Map();
const spec=(dependentId='ep:node:plotnode_001')=>({scope:'world',resourceId:'ep:resource:shared_001',dependentId,nativeUuid});
const context={operationId:'ep:operation:refs_0001',sourceEventId:'ep:event:refs_0001'};
const fixture=()=>{
 const repository=new MemoryPartitionRepository();refs.clear();refs.set('ep:resource:shared_001',{status:'bound',documentKind:'Actor',nativeId});
 return {ledger:new NativeReverseReferenceLedger({repository,gmProvider:()=>gm,
   resolveBinding:async({resourceId})=>refs.get(resourceId)??null}),repository};
};
test('reverse edge can be recorded twice only by the same causal operation',async()=>{
 const {ledger}=fixture();const result=await ledger.link(spec(),context);
 assert.match(result.recordId,/^ep:reverse-ref:/);
 assert.equal((await ledger.link(spec(),context)).alreadyApplied,true);
 await assert.rejects(()=>ledger.link(spec(),{operationId:'ep:operation:refs_0002',sourceEventId:context.sourceEventId}),{code:'REF_EXISTS'});
});
test('reverse lookup is scoped to one native world UUID and provides bounded metadata',async()=>{
 const {ledger}=fixture();await ledger.link(spec(),context);
 await ledger.link(spec('ep:node:plotnode_002'),{operationId:'ep:operation:refs_0002',sourceEventId:context.sourceEventId});
 const rows=await ledger.listForNative({scope:'world',nativeUuid,limit:8});
 assert.equal(rows.items.length,2);
 assert.deepEqual(Object.keys(rows.items[0]),['resourceId','dependentId','nativeUuid','status','revision']);
 await assert.rejects(()=>ledger.listForNative({scope:'world',nativeUuid,limit:100}),{code:'REF_BUDGET'});
});
test('drift and orphan reports do not mutate or automatically rebind native references',async()=>{
 const {ledger}=fixture();await ledger.link(spec(),context);
 refs.set('ep:resource:shared_001',{status:'bound',documentKind:'Actor',nativeId:'ponmlkjihgfedcba'});
 let audit=await ledger.auditNative({scope:'world',nativeUuid});
 assert.equal(audit.items[0].assessment,'drift');
 refs.delete('ep:resource:shared_001');
 audit=await ledger.auditNative({scope:'world',nativeUuid});
 assert.equal(audit.items[0].assessment,'orphaned');
 assert.equal((await ledger.get(spec())).status,'active');
});
test('retired links remain in historical index but are not active dependencies',async()=>{
 const {ledger}=fixture();await ledger.link(spec(),context);
 await ledger.retire(spec(),{expectedRevision:1,operationId:'ep:operation:refs_0003',sourceEventId:context.sourceEventId});
 const audit=await ledger.auditNative({scope:'world',nativeUuid});
 assert.equal(audit.items[0].assessment,'historical');
 await assert.rejects(()=>ledger.retire(spec(),{expectedRevision:1,operationId:'ep:operation:refs_0004',sourceEventId:context.sourceEventId}),{code:'REF_REVISION_CONFLICT'});
});
test('stale binding, unrelated reference and invalid UUID cannot create reverse edge',async()=>{
 const {ledger}=fixture();refs.get('ep:resource:shared_001').nativeId='ponmlkjihgfedcba';
 await assert.rejects(()=>ledger.link(spec(),context),{code:'REF_BINDING_STALE'});
 await assert.rejects(()=>ledger.link({...spec(),nativeUuid:'Compendium.secret.Actor.abcdef'},context),{code:'REF_UUID'});
});
