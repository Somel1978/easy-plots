import test from 'node:test';import assert from 'node:assert/strict';
import {GMFocusedHealthService} from '../src/orchestration/focused-health-service.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
const arcId='ep:arc:waterdeep001',objectiveId='ep:objective:trade001',dueId='ep:schedule:raid001',refId='ep:resource:missing001';
const build=repo=>new NarrativeDomainStore({repository:repo,gmProvider});
test('focused health reads only exact selected records and marks unknown coverage',async()=>{
 const domains=build(new MemoryPartitionRepository()),svc=new GMFocusedHealthService({domains});
 await domains.save({type:'objective',scope:'world',id:objectiveId,data:{state:'active',confirmedBlocked:true},sourceEventId:'ep:event:objective001'});
 await domains.save({type:'scheduled-commitment',scope:'world',id:dueId,data:{dueAt:40,status:'pending'},sourceEventId:'ep:event:deadline001'});
 const r=await svc.inspect({arcId,worldTime:100,objectiveIds:[objectiveId],deadlineIds:[dueId],resourceIds:[refId]});
 assert.equal(r.coverage,'partial');assert.equal(r.status,'incomplete-coverage');assert.equal(r.findings.length,3);
 assert.equal(r.effectsExecuted,0);assert.equal(r.selectedRecordCount,3);
});
test('unknown states remain unverified, not silently assumed completed',async()=>{
 const domains=build(new MemoryPartitionRepository()),svc=new GMFocusedHealthService({domains});
 await domains.save({type:'objective',scope:'world',id:objectiveId,data:{state:'unrecognized'},sourceEventId:'ep:event:objective001'});
 const r=await svc.inspect({arcId,worldTime:100,objectiveIds:[objectiveId]});
 assert.equal(r.findings[0].kind,'reference-integrity');assert.equal(r.indexCoverage,'explicit-records-only');
});
test('unbounded list and player authority are refused',async()=>{
 const domains=build(new MemoryPartitionRepository()),svc=new GMFocusedHealthService({domains});
 await assert.rejects(svc.inspect({arcId,worldTime:1,objectiveIds:Array(25).fill(objectiveId)}),{code:'HEALTH_BUDGET'});
 const player=new GMFocusedHealthService({domains:new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider:()=>createLocalGMContext({user:{id:'P',isGM:false},epoch:'test'},'world')})});
 await assert.rejects(player.inspect({arcId,worldTime:1,objectiveIds:[objectiveId]}),{code:'GM_REQUIRED'});
});
