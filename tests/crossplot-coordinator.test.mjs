import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NativeCrossPlotDependencyCatalog} from '../src/domains/crossplot-index.mjs';
import {GMCrossPlotCoordinator} from '../src/orchestration/crossplot-coordinator.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const origin='ep:plot:waterdeep_001',other='ep:plot:other_001',target='ep:objective:harpers_001';
const eid='ep:event:crossplot_source_001';
async function setup(){
 const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true}},'world');
 const catalog=new NativeCrossPlotDependencyCatalog({repository:new MemoryPartitionRepository(),gmProvider});
 const revisions=new Map([[target,3]]);
 const coordinator=new GMCrossPlotCoordinator({catalog,gmProvider,resolveCurrentTarget:async id=>({revision:revisions.get(id)})});
 const link={id:'ep:link:harpers_001',sourcePlotId:origin,targetId:target,kind:'qualify',eventType:'evidence.discovered',scope:'waterdeep',expectedRevision:3,requiredKnownFactIds:['ep:fact:manifest_001']};
 await catalog.stage(link,{activeRevision:3});
 return {catalog,coordinator,link,revisions};
}
const event={id:eid,eventType:'evidence.discovered'};
const args={event,verifiedSourcePlotId:origin,knownFactIds:['ep:fact:manifest_001'],approvedScopes:['waterdeep']};
test('cross-plot link is not eligible from an unrelated plot event of the same type',async()=>{
 const {coordinator}=await setup();
 const r=await coordinator.preview({...args,verifiedSourcePlotId:other});
 assert.equal(r.qualified.length,0);assert.equal(r.skipped[0].reason,'source-plot-mismatch');assert.equal(r.effectsExecuted,0);
});
test('same causal event independently qualifies a target only on current canonical revision',async()=>{
 const {coordinator,revisions}=await setup();
 const ok=await coordinator.preview(args);assert.equal(ok.qualified.length,1);assert.equal(ok.qualified[0].targetId,target);
 assert.equal(ok.gmReviewRequired,true);revisions.set(target,4);
 const stale=await coordinator.preview(args);assert.equal(stale.qualified.length,0);
 assert.equal(stale.skipped[0].reason,'stale-target-revision');
});
test('knowledge and approved-scope constraints remain independent of source verification',async()=>{
 const {coordinator}=await setup();
 const unknown=await coordinator.preview({...args,knownFactIds:[]});assert.equal(unknown.qualified.length,0);
 assert.equal(unknown.skipped[0].reason,'knowledge-prerequisite');
 const withheld=await coordinator.preview({...args,approvedScopes:[]});assert.equal(withheld.qualified.length,0);
 assert.equal(withheld.skipped[0].reason,'scope-not-approved');
});
test('missing canonical target never inherits a stale indexed revision',async()=>{
 const {coordinator,revisions}=await setup();revisions.delete(target);
 const r=await coordinator.preview(args);assert.equal(r.qualified.length,0);
 assert.equal(r.skipped[0].reason,'target-unverified');
});
