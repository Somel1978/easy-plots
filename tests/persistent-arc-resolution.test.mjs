import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentArcResolutions} from '../src/orchestration/persistent-arc-resolution.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'local'},'world');
const id=x=>`ep:${x}`;
const arcId=id('arc:waterdeep001'),resolutionId=id('resolution:waterdeep001');
const endingId=id('ending:partial001'),approvalEventId=id('event:approval_001');
const arc={status:'active',worldTime:180,worldFacets:{leader:'captured',network:'active'},
 endingContracts:[{id:endingId,exclusiveGroup:'primary',requiredFacets:{leader:'captured',network:'active'}}],
 objectives:[{id:id('objective:shipment001'),status:'completed'},{id:id('objective:zhentarim001'),status:'active'}],
 unresolvedThreads:[{id:id('hook:officer001'),sourceEventId:id('event:escape001'),disposition:'dormant'}]};
async function setup({wrap}={}){
 const domains=new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider});
 const row=await domains.save({type:'arc',scope:'world',id:arcId,data:arc,sourceEventId:id('event:start001')});
 const service=new PersistentArcResolutions({domains:wrap?wrap(domains):domains});
 return {domains,row,service};
}
const args={arcId,resolutionId,endingId,approvalEventId,expectedArcRevision:1};
test('GM arc finalization persists a historical snapshot without closing unresolved objectives',async()=>{
 const {domains,service}=await setup();const plan=await service.plan({arcId});assert.equal(plan.eligible.length,1);
 const done=await service.finalize(args);assert.equal(done.state,'committed');assert.equal(done.effectsExecuted,0);
 const canonical=await domains.read('arc','world',arcId);assert.equal(canonical.data.status,'concluded');
 assert.equal(canonical.data.objectives[1].status,'active');assert.equal(canonical.data.unresolvedThreads[0].disposition,'dormant');
 const snapshot=await domains.read('arc-resolution','world',resolutionId);
 assert.equal(snapshot.data.snapshot.facets.leader,'captured');assert.equal(snapshot.data.epiloguePublished,false);
 await assert.rejects(service.finalize(args),{code:'ARC_RESOLUTION_EXISTS'});
 await assert.rejects(service.plan({arcId}),{code:'ARC_ALREADY_CONCLUDED'});
});
test('exclusive ending conflicts and unknown alternative prevent durable resolution writes',async()=>{
 const {domains,service}=await setup();
 const row=await domains.read('arc','world',arcId);
 await domains.save({type:'arc',scope:'world',id:arcId,expectedRevision:1,sourceEventId:id('event:change001'),
  data:{...row.data,endingContracts:[...row.data.endingContracts,{id:id('ending:unknown001'),exclusiveGroup:'primary',requiredFacets:{future:'unknown'}}]}});
 await assert.rejects(service.finalize({...args,expectedArcRevision:2}),{code:'ARC_COVERAGE'});
 assert.equal(await domains.read('arc-resolution','world',resolutionId),null);
});
test('staged but unconfirmed resolution never replays automatically',async()=>{
 const {domains,service}=await setup({wrap:real=>({
  read:(...params)=>real.read(...params),
  save:(spec)=>spec.type==='arc'&&spec.expectedRevision!==null?Promise.reject(Object.assign(Error('interrupted'),{code:'SIMULATED_FAILURE'})):real.save(spec)
 })});
 await assert.rejects(service.finalize(args),{code:'ARC_COMMIT_UNCERTAIN'});
 const state=await service.inspect({arcId,resolutionId});assert.equal(state.state,'prepared');assert.equal(state.requiresGMReconciliation,true);
 await assert.rejects(service.reconcile({arcId,resolutionId,reviewEventId:id('event:review001'),expectedResolutionRevision:1}),{code:'ARC_RECOVERY_REVIEW'});
 assert.equal((await domains.read('arc','world',arcId)).data.status,'active');
});
test('GM explicitly reconciles a prepared resolution when the arc really concluded',async()=>{
 const {domains,service}=await setup({wrap:real=>({
  read:(...params)=>real.read(...params),
  save:spec=>spec.type==='arc-resolution'&&spec.expectedRevision===1?
   Promise.reject(Object.assign(Error('interrupted'),{code:'SIMULATED_FAILURE'})):real.save(spec)
 })});
 await assert.rejects(service.finalize(args),{code:'ARC_COMMIT_UNCERTAIN'});
 const before=await service.inspect({arcId,resolutionId});assert.equal(before.arcPointsToThis,true);
 // Reconciliation on a stable GM repository (simulating an implementation restart).
 const resumed=new PersistentArcResolutions({domains});
 const result=await resumed.reconcile({arcId,resolutionId,reviewEventId:id('event:manualreview001'),expectedResolutionRevision:1});
 assert.equal(result.state,'committed');assert.equal(result.effectsExecuted,0);
 const state=await resumed.inspect({arcId,resolutionId});assert.equal(state.requiresGMReconciliation,false);
});
test('stale expected revision and wrong resolution identity fail closed',async()=>{
 const {service}=await setup();
 await assert.rejects(service.finalize({...args,expectedArcRevision:2}),{code:'REVISION_CONFLICT'});
 await assert.rejects(service.finalize({...args,endingId:id('ending:invented001')}),{code:'ARC_NOT_ELIGIBLE'});
 const state=await service.inspect({arcId,resolutionId});assert.equal(state.state,'not-started');
});
