import test from 'node:test';import assert from 'node:assert/strict';
import {graph as fixture} from './fixtures.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {CoreNodeContractCatalog,GraphDependencyResolver,executionFingerprint} from '../src/graph/graph-dependencies.mjs';
import {PublicationPreflight} from '../src/graph/publication-preflight.mjs';
import {PersistentGraphValidations} from '../src/graph/persistent-validations.mjs';
import {PersistentGraphRegistry,assertSupported} from '../src/graph/persistent-registry.mjs';
import {ImmutableGraphPageStore} from '../src/storage/graph-chunks.mjs';
import {ActiveTriggerCatalog} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {CompiledGraphCache} from '../src/graph/compiled-graph-cache.mjs';
import {dataNodePorts} from '../src/graph/typed-data.mjs';
import {sha256Hex} from '../src/contracts/digest.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
const gm=createLocalGMContext({user:{id:'GM_validation',isGM:true}},'world');
const graph=id=>{const g=fixture();g.revision=1;if(id){g.id=id;for(const node of g.nodes)node.graphId=id;}return g;};
function env({repository=new MemoryPartitionRepository(),externalChecks=null,paged=false}={}){
 const providers=new EffectProviderRegistry();providers.register({id:'narrative.set-state',validate:payload=>{if(typeof payload.key!=='string')throw Error('Named key required');},apply:async()=>{},verify:async()=>true});
 const nodeContracts=new CoreNodeContractCatalog();let registry,validations;
 const dependencies=new GraphDependencyResolver({providers,nodeContracts,readPublished:(...args)=>registry.getPublished(...args),readPublishedManifest:snapshot=>validations.publishedManifest(snapshot)});
 const preflight=new PublicationPreflight({dependencies,validateSupported:assertSupported,externalChecks});
 registry=new PersistentGraphRegistry({repository,gmProvider:()=>gm,preflight:()=>preflight,validations:()=>validations,...(paged?{pageStore:new ImmutableGraphPageStore({repository,gmProvider:()=>gm})}:{})});
 validations=new PersistentGraphValidations({repository,gmProvider:()=>gm,preflight,dependencies});return {providers,nodeContracts,dependencies,preflight,registry,validations,repository};
}
test('ADR-119: publication preflight blocks secret disclosure paths and reports actionable required coverage',async()=>{
 const e=env(),g=graph();g.nodes[1].accessClass='published';g.nodes[1].ports.forEach(p=>p.accessClass='published');
 const report=await e.preflight.inspect(g);assert.equal(report.ok,false);assert.ok(report.blockers.some(x=>x.code==='SECRET_DISCLOSURE_PATH'));assert.ok(report.blockers.every(x=>x.remediation));assert.equal(report.coverage.checks.find(c=>c.id==='disclosure-paths').status,'blocked');
 assert.throws(()=>e.preflight.assertPublishable(report,{acknowledgeWarnings:true}),{code:'PUBLICATION_BLOCKED'});
});
test('unavailable providers block publication with exact node context while unreachable nodes require warning acknowledgement',async()=>{
 const e=env(),g=graph();g.nodes[2].data.providerId='example.provider.missing';let report=await e.preflight.inspect(g);assert.equal(report.ok,false);assert.ok(report.blockers.some(x=>x.code==='EFFECT_PROVIDER_UNAVAILABLE'&&x.nodeId===g.nodes[2].id));
 g.nodes[2].data.providerId='narrative.set-state';g.edges.splice(1,1);report=await e.preflight.inspect(g);assert.equal(report.ok,true);assert.equal(report.warnings[0].code,'UNREACHABLE_NODE');assert.throws(()=>e.preflight.assertPublishable(report),{code:'PREFLIGHT_REVIEW_REQUIRED'});assert.equal(e.preflight.assertPublishable(report,{acknowledgeWarnings:true}),report);
});
test('native batch publication requires source coverage for every immutable plan pointer',async()=>{
 const e=env();e.providers.register({id:'narrative.execute-ordered-native-batch',validate(){},apply:async()=>{},verify:async()=>true});const g=graph();g.nodes[2].data={providerId:'narrative.execute-ordered-native-batch',payload:{scope:'world',batchId:'ep:batch:preflight001',expectedBatchRevision:1,batchFingerprint:'0'.repeat(64)}};
 const blocked=await e.preflight.inspect(g);assert.ok(blocked.blockers.some(x=>x.code==='NATIVE_SOURCE_PREFLIGHT_UNAVAILABLE'));
 const preflight=new PublicationPreflight({dependencies:e.dependencies,externalChecks:async()=>({issues:[],coverage:[{id:'native-source-contracts',status:'passed',checked:1,total:1}]})});assert.equal((await preflight.inspect(g)).ok,true);
});
test('ADR-078: persisted validations selectively become stale after one node contract changes across service reload',async()=>{
 const e=env(),a=graph('ep:graph:validate_a001'),b=graph('ep:graph:validate_b001');b.nodes.splice(1,1);b.edges=[{...b.edges[0],target:b.edges[1].target}];
 await e.validations.validateCandidate(a);await e.validations.validateCandidate(b);
 const reloaded=new PersistentGraphValidations({repository:e.repository,gmProvider:()=>gm,preflight:e.preflight,dependencies:e.dependencies});
 assert.equal((await reloaded.inspectCandidate(a)).status,'current');assert.equal((await reloaded.inspectCandidate(b)).status,'current');
 e.nodeContracts.define('core.condition',{version:'2.0.0',descriptor:{conditionContract:'reviewed'}});
 assert.equal((await reloaded.inspectCandidate(a)).status,'stale');assert.equal((await reloaded.inspectCandidate(b)).status,'current');
 await assert.rejects(reloaded.assertCurrent(a),{code:'GRAPH_VALIDATION_STALE'});await reloaded.assertCurrent(b);
});
test('cosmetic draft revisions keep current validation and report tampering fails closed',async()=>{
 const e=env(),g=graph();const saved=await e.validations.validateCandidate(g);g.title='New visual title';g.revision++;g.nodes[0].layout={x:1,y:2};assert.equal((await e.validations.inspectCandidate(g)).status,'current');
 const bad=structuredClone(saved.report);bad.ok=false;assert.throws(()=>e.preflight.assertPublishable(bad),{code:'PREFLIGHT_REPORT_CORRUPT'});
 g.nodes[2].data.payload.value=false;assert.equal((await e.validations.inspectCandidate(g)).status,'stale');
});
test('registry publication/activation require durable current validation and preserve exact manifests',async()=>{
 const e=env(),draft=await e.registry.saveDraft(graph());await assert.rejects(e.registry.publish(draft.id,{expectedRevision:1}),{code:'GRAPH_VALIDATION_STALE'});
 await e.registry.validateCandidate(draft.id,{expectedRevision:1});const snapshot=await e.registry.publish(draft.id,{expectedRevision:1});assert.equal(snapshot.dependencyManifest.kind,'graph-dependency-manifest');assert.deepEqual(await e.registry.getPublished(draft.id,1),snapshot);
 await e.registry.activate(draft.id,1);e.nodeContracts.define('core.condition',{version:'2.0.0',descriptor:{change:true}});
 await assert.rejects(e.registry.activate(draft.id,1,{expectedActivationRevision:1}),{code:'GRAPH_DEPENDENCIES_STALE'});assert.equal((await e.registry.getPublished(draft.id,1)).publishedVersion,1);
});
test('legacy publications remain readable and require explicit safe adoption without snapshot mutation',async()=>{
 const e=env(),legacyRegistry=new PersistentGraphRegistry({repository:e.repository,gmProvider:()=>gm}),draft=await legacyRegistry.saveDraft(graph('ep:graph:legacy_adopt001'));
 const original=await legacyRegistry.publish(draft.id,{expectedRevision:1});assert.equal(original.dependencyManifest,undefined);assert.deepEqual(await e.registry.getPublished(draft.id,1),original);
 await assert.rejects(e.registry.activate(draft.id,1),{code:'GRAPH_DEPENDENCIES_UNTRACKED'});
 await assert.rejects(e.registry.adoptPublishedDependencies(draft.id,1,{expectedExecutionFingerprint:executionFingerprint(original),reason:'review'}),{code:'LEGACY_DEPENDENCY_REVIEW_REQUIRED'});
 const adopted=await e.registry.adoptPublishedDependencies(draft.id,1,{approved:true,expectedExecutionFingerprint:executionFingerprint(original),reason:'GM reviewed this exact legacy graph against installed contracts'});assert.equal(adopted.created,true);
 assert.deepEqual(await e.registry.getPublished(draft.id,1),original);assert.deepEqual(await e.registry.publishedDependencyManifest(original),adopted.manifest);await e.registry.activate(draft.id,1);
 e.nodeContracts.define('core.condition',{version:'2.0.0',descriptor:{change:true}});await assert.rejects(e.validations.adoptPublished(original,{approved:true,expectedExecutionFingerprint:executionFingerprint(original),reason:'trying to silently replace'}),{code:'GRAPH_DEPENDENCIES_STALE'});
});
test('validation persistence verifies native index readiness and designated writer eligibility',async()=>{
 const e=env(),g=graph();let eligible=true;
 const service=new PersistentGraphValidations({repository:e.repository,gmProvider:()=>gm,preflight:e.preflight,dependencies:e.dependencies,writer:{assertEligible(){if(!eligible)throw Object.assign(Error('successor GM'),{code:'GM_WRITER_REQUIRED'});}}});
 await service.validateCandidate(g);eligible=false;await assert.rejects(service.inspectCandidate(g),{code:'GM_WRITER_REQUIRED'});
 eligible=true;e.repository.hasReadyIndex=async()=>false;await assert.rejects(service.inspectCandidate(g),{code:'INDEX_UNCERTAIN'});
});
test('paged publication fingerprints preserve embedded preflight/manifests across registry reinitialization',async()=>{
 const e=env({paged:true}),draft=await e.registry.saveDraft(graph('ep:graph:paged_validation001'));await e.registry.validateCandidate(draft.id,{expectedRevision:1});const snapshot=await e.registry.publish(draft.id,{expectedRevision:1});
 const reloaded=env({repository:e.repository,paged:true});assert.deepEqual(await reloaded.registry.getPublished(draft.id,1),snapshot);await reloaded.registry.activate(draft.id,1);
 const later=structuredClone(draft);later.title='A subsequent draft';await e.registry.saveDraft(later,{expectedRevision:1});assert.deepEqual(await reloaded.registry.getPublished(draft.id,1),snapshot);
});
test('actual router cache reuse re-reads authoritative state/rolls for two distinct events',async()=>{
 const e=env(),g=graph('ep:graph:cached_runtime001'),effect=g.nodes[2];effect.data.payload={key:'cached-review',value:0,rollTotal:0};effect.data.inputBindings={value:'state-in',rollTotal:'roll-in'};
 for(const id of ['state-in','roll-in'])effect.ports.push({id,direction:'input',valueType:'number',accessClass:'gm-secret'});
 const stateId='ep:node:cached_state001',rollId='ep:node:cached_roll001';
 g.nodes.push({id:stateId,graphId:g.id,typeId:'core.state.value',accessClass:'gm-secret',ports:dataNodePorts('core.state.value','number'),data:{scope:'world',key:'fresh-count',valueType:'number',expectedRevision:null}},
 {id:rollId,graphId:g.id,typeId:'core.roll.value',accessClass:'gm-secret',ports:dataNodePorts('core.roll.value','number'),data:{rollKind:'d20',attemptId:'ep:attempt:cached_runtime001',expectedRevision:2,side:'self',field:'total',valueType:'number'}});
 g.edges.push({id:'ep:edge:cached_state001',kind:'data',source:{nodeId:stateId,portId:'value'},target:{nodeId:effect.id,portId:'state-in'}},{id:'ep:edge:cached_roll001',kind:'data',source:{nodeId:rollId,portId:'value'},target:{nodeId:effect.id,portId:'roll-in'}});
 const draft=await e.registry.saveDraft(g);await e.registry.validateCandidate(g.id,{expectedRevision:1});const snapshot=await e.registry.publish(g.id,{expectedRevision:1});await e.registry.activate(g.id,1);
 const catalog=new ActiveTriggerCatalog({repository:e.repository,gmProvider:()=>gm});await catalog.stage(snapshot);const ledger=new DurableEventLedger({repository:e.repository,gmProvider:()=>gm}),cache=new CompiledGraphCache({dependencies:e.dependencies});
 let stateValue=1,stateReads=0,rollReads=0;const request={sourceEventId:'ep:event:original_cached001'},roll={kind:'native-roll',attemptId:'ep:attempt:cached_runtime001',revision:2,state:'resolved',request,fingerprint:await sha256Hex(JSON.stringify(request)),total:14,outcome:'success'};
 const router=new DurableReactiveRouter({registry:e.registry,catalog,ledger,gmProvider:()=>gm,compiledCache:cache,dependencyManifestReader:s=>e.validations.publishedManifest(s),stateReader:async()=>{stateReads++;return {kind:'narrative-state',scope:'world',stateKey:'fresh-count',revision:stateValue,value:stateValue};},rollReader:async()=>{rollReads++;return structuredClone(roll);}});
 for(const n of [1,2]){stateValue=n;const event={id:`ep:event:cached_runtime00${n}`,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true}};assert.equal((await router.ingest(event)).status,'review-required');const entry=await ledger.get(event.id);assert.equal(entry.proposals[0].payload.value,n);assert.equal(entry.proposals[0].payload.rollTotal,14);assert.equal(entry.evaluations[0].inputObservations[0].attemptId,roll.attemptId);}
 assert.equal(stateReads,2);assert.equal(rollReads,2);assert.equal(cache.instrumentation.compilations,1);assert.equal(cache.instrumentation.hits,1);assert.equal((await e.registry.getDraft(g.id)).revision,draft.revision);
});
test('editor publication persists full candidate evidence and reuses it on cosmetic edits',async()=>{
 const e=env(),editor=new GraphEditorModel({registry:e.registry});editor.newGraph('Validated editor');await editor.save();const published=await editor.publish();assert.equal(published.publicationReport.kind,'graph-publication-preflight');assert.equal((await e.registry.inspectValidation(published.id)).revision,1);
 editor.rename('Cosmetic rename');await editor.save();await editor.publish();assert.equal((await e.registry.inspectValidation(published.id)).revision,1);
});
test('cached cyclic routing starts fresh convergence rounds for every canonical event',async()=>{
 const e=env(),model=new GraphEditorModel({registry:e.registry});model.newGraph('Cached bounded convergence');const gate=model.addNode('core.flow.converge');model.updateSelected({payloadJSON:JSON.stringify({initialValue:0,step:1,targetValue:3,maxPasses:4})});
 const body=model.addNode('core.branch.parallel'),effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"cached-convergence","value":true}'});model.connect(model.graph.rootNodeId,gate);model.connect(gate,body,{sourcePortId:'repeat'});model.connect(body,gate);model.connect(gate,effect,{sourcePortId:'converged'});
 await model.save();const graph=await model.publish();await model.activate(graph.publishedVersion);const catalog=new ActiveTriggerCatalog({repository:e.repository,gmProvider:()=>gm});await catalog.stage(graph);
 const ledger=new DurableEventLedger({repository:e.repository,gmProvider:()=>gm}),cache=new CompiledGraphCache({dependencies:e.dependencies}),router=new DurableReactiveRouter({registry:e.registry,catalog,ledger,gmProvider:()=>gm,compiledCache:cache});
 for(const n of [1,2]){const event={id:`ep:event:cached_convergence00${n}`,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}};assert.equal((await router.ingest(event)).status,'review-required');const row=await ledger.get(event.id);assert.equal(row.proposals.length,1);assert.deepEqual(row.evaluations[0].trace.filter(t=>t.nodeId===gate).map(t=>t.status),['convergence-repeat','convergence-repeat','convergence-reached']);}
 assert.equal(cache.instrumentation.compilations,1);assert.equal(cache.instrumentation.hits,1);
});
