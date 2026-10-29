import test from 'node:test';import assert from 'node:assert/strict';
import {NativeRecordMigrationRegistry,migrationLocator} from '../src/storage/migrations.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gm=createLocalGMContext({user:{id:'gm-migrations',isGM:true}},'test-world');
const source={id:'ep:record:captain001',partitionId:'domain-npc-waterdeep',kind:'npc-state',name:'Captain',flags:{narrative:true}};
async function fixture(){const repository=new MemoryPartitionRepository();await repository.put(source,{expectedRevision:null});
 const migrator=new NativeRecordMigrationRegistry({repository,gmProvider:()=>gm});
 migrator.register({kind:'npc-state',from:1,to:2,transform:r=>({...r,flags:{...r.flags,role:'antagonist'}})});
 migrator.register({kind:'npc-state',from:2,to:3,transform:r=>({...r,roleStatus:'unresolved'})});
 return {repository,migrator};}
test('migration preview is pure, bounded and identity preserving',async()=>{
 const {repository,migrator}=await fixture();const plan=await migrator.preview({recordId:source.id,partitionId:source.partitionId,targetVersion:3});
 assert.equal(plan.status,'preview-only');assert.equal(plan.candidate.contractVersion,3);assert.equal(plan.candidate.flags.role,'antagonist');
 assert.equal((await repository.read(source.id,{partitionId:source.partitionId})).contractVersion,undefined);
 const result=await migrator.apply({recordId:source.id,partitionId:source.partitionId,targetVersion:3});
 assert.equal(result.state,'completed');assert.equal((await migrator.inspect({recordId:source.id,partitionId:source.partitionId,targetVersion:3})).classification,'target-observed');
 await assert.rejects(()=>migrator.apply({recordId:source.id,partitionId:source.partitionId,targetVersion:3}),{code:'MIGRATION_RECONCILIATION_REQUIRED'});
});
test('contract changes to narrative identities are rejected before native writes',async()=>{
 const {repository,migrator}=await fixture();
 migrator.register({kind:'npc-state',from:3,to:4,transform:r=>({...r,id:'ep:record:wrong001'})});
 await repository.put({...await repository.read(source.id,{partitionId:source.partitionId}),contractVersion:3},{expectedRevision:1});
 await assert.rejects(()=>migrator.preview({recordId:source.id,partitionId:source.partitionId,targetVersion:4}),{code:'MIGRATION_IDENTITY'});
});
test('migration stops on unknown future contracts and missing steps',async()=>{
 const {migrator}=await fixture();
 await assert.rejects(()=>migrator.preview({recordId:source.id,partitionId:source.partitionId,targetVersion:4}),{code:'MIGRATION_STEP_MISSING'});
});
test('interrupted migration stays journaled and requires inspection instead of blind retry',async()=>{
 const {repository,migrator}=await fixture();let failed=false;
 const proxy={read:(...args)=>repository.read(...args),put:async(r,opt)=>{
   if(r.kind==='npc-state'&&!failed){failed=true;throw Error('Native write interrupted');}
   return repository.put(r,opt);
 }};
 const guarded=new NativeRecordMigrationRegistry({repository:proxy,gmProvider:()=>gm});
 guarded.register({kind:'npc-state',from:1,to:2,transform:r=>({...r,title:'Captain'})});
 await assert.rejects(()=>guarded.apply({recordId:source.id,partitionId:source.partitionId,targetVersion:2}),{code:'MIGRATION_RECONCILIATION_REQUIRED'});
 const inspected=await guarded.inspect({recordId:source.id,partitionId:source.partitionId,targetVersion:2});
 assert.equal(inspected.classification,'source-observed');assert.equal(inspected.needsGMReview,true);
 await assert.rejects(()=>guarded.apply({recordId:source.id,partitionId:source.partitionId,targetVersion:2}),{code:'MIGRATION_RECONCILIATION_REQUIRED'});
});
test('audit locator stays deterministic and migration authority is mandatory',async()=>{
 assert.deepEqual(await migrationLocator({recordId:source.id,partitionId:source.partitionId,targetVersion:2}),await migrationLocator({recordId:source.id,partitionId:source.partitionId,targetVersion:2}));
 const {repository}=await fixture();
 const notGM=new NativeRecordMigrationRegistry({repository,gmProvider:()=>({userId:'player',isGM:false})});
 await assert.rejects(()=>notGM.preview({recordId:source.id,partitionId:source.partitionId,targetVersion:2}),{code:'GM_REQUIRED'});
});
