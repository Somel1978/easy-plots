import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NativeCrossPlotDependencyCatalog,validateCrossPlotLink} from '../src/domains/crossplot-index.mjs';
const link=(n='one')=>({id:`ep:link:dependency_${n}`,sourcePlotId:'ep:plot:source_001',targetId:'ep:plot:target_001',kind:'qualify',eventType:'evidence.discovered',scope:'waterdeep',expectedRevision:3,requiredKnownFactIds:['ep:fact:manifest_001']});
const setup=(repository=new MemoryPartitionRepository())=>{const gm=createLocalGMContext({user:{id:'gm',isGM:true}},'world');return {repository,catalog:new NativeCrossPlotDependencyCatalog({repository,gmProvider:()=>gm})};};
test('exact indexed subscription qualifies only with protected GM-known facts and matching revisions',async()=>{
 const {catalog,repository}=setup();assert.equal((await catalog.stage(link(),{activeRevision:3})).staged,true);
 assert.equal((await catalog.stage(link(),{activeRevision:3})).existing,true);
 const event={id:'ep:event:dependency_test_01',eventType:'evidence.discovered'};
 const skipped=await catalog.evaluate(event,{approvedScopes:['waterdeep']});
 assert.equal(skipped.qualified.length,0);assert.equal(skipped.skipped[0].reason,'knowledge-prerequisite');
 repository.resetBudget();const ready=await catalog.evaluate(event,{knownFactIds:['ep:fact:manifest_001'],approvedScopes:['waterdeep']});
 assert.equal(ready.qualified.length,1);assert.equal(ready.effectsExecuted,0);assert.equal(ready.committed,false);
 assert.ok(repository.instrumentation.readRequests<=1);
});
test('stale dependency target revision prevents eligibility',async()=>{
 const {catalog}=setup();await catalog.stage(link('stale'),{activeRevision:4});
 const r=await catalog.evaluate({id:'ep:event:dependency_test_02',eventType:'evidence.discovered'},
   {knownFactIds:['ep:fact:manifest_001'],approvedScopes:['waterdeep']});
 assert.equal(r.qualified.length,0);assert.equal(r.skipped[0].reason,'stale-target-revision');
});
test('crossplot changes to existing link require separate link identity',async()=>{
 const {catalog}=setup();await catalog.stage(link(),{activeRevision:3});
 await assert.rejects(()=>catalog.stage({...link(),kind:'unlock'},{activeRevision:3}),{code:'CROSSPLOT_CONFLICT'});
});
test('crossplot rejects arbitrary payloads and incomplete authority',async()=>{
 assert.throws(()=>validateCrossPlotLink({...link(),hiddenTargetName:'GM secret'}),{code:'CROSSPLOT_FIELDS'});
 const {catalog}=setup();await assert.rejects(()=>catalog.stage(link(),{activeRevision:null}),{code:'CROSSPLOT_REVISION'});
});
