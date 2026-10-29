import test from 'node:test';
import assert from 'node:assert/strict';
import {graph as fixture} from './fixtures.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {NarrativeNodeExtensions} from '../src/graph/node-extensions.mjs';
import {CoreNodeContractCatalog,GraphDependencyResolver,executionFingerprint} from '../src/graph/graph-dependencies.mjs';
import {CompiledGraphCache} from '../src/graph/compiled-graph-cache.mjs';
import {contractHash} from '../src/graph/dependency-contracts.mjs';
import {GraphDataFrame} from '../src/runtime/graph-data-frame.mjs';
import {dataNodePorts} from '../src/graph/typed-data.mjs';
function providers(version='1.0.0',changed=false){const p=new EffectProviderRegistry();p.register({id:'narrative.set-state',version,validate:payload=>{if(typeof payload.key!=='string')throw Error('key required');},apply:changed?async()=>({changed:true}):async()=>({changed:false}),verify:async()=>true});return p;}
const graph=(id='ep:graph:dependency_001')=>{const g=fixture();g.id=id;g.revision=1;for(const n of g.nodes)n.graphId=id;return g;};
const withoutCondition=id=>{const g=graph(id);g.nodes.splice(1,1);g.edges=[{...g.edges[0],target:g.edges[1].target}];return g;};
test('ADR-058: compiled graph indexes are reused while only affected contract partitions invalidate',async()=>{
 const nodeContracts=new CoreNodeContractCatalog(),dependencies=new GraphDependencyResolver({providers:providers(),nodeContracts}),cache=new CompiledGraphCache({dependencies});
 const a=graph(),b=withoutCondition('ep:graph:dependency_002'),ma=(await dependencies.capture(a)).manifest,mb=(await dependencies.capture(b)).manifest;
 const ca=await cache.get(a,{manifest:ma}),cb=await cache.get(b,{manifest:mb});
 assert.equal(await cache.get(a,{manifest:ma}),ca);assert.equal(await cache.get(b,{manifest:mb}),cb);
 assert.equal(cache.instrumentation.compilations,2);
 nodeContracts.define('core.condition',{version:'2.0.0',descriptor:{operator:'reviewed-v2'}});
 await assert.rejects(cache.get(a,{manifest:ma}),{code:'GRAPH_DEPENDENCIES_STALE'});
 assert.equal(await cache.get(b,{manifest:mb}),cb);assert.equal(cache.instrumentation.entries,1);
 const next=(await dependencies.capture(a)).manifest;assert.notEqual(await cache.get(a,{manifest:next}),ca);assert.equal(cache.instrumentation.compilations,3);
});
test('cosmetic graph/node overlays preserve executable identity and cache reuse',async()=>{
 const dependencies=new GraphDependencyResolver({providers:providers()}),cache=new CompiledGraphCache({dependencies}),g=graph(),manifest=(await dependencies.capture(g)).manifest;
 const first=await cache.get(g,{manifest});g.title='A private label';g.revision++;g.layout={zoom:2};g.nodes[0].label='<img src=x>';g.nodes[0].layout={x:900,y:200};g.semanticHash='presentation-only';
 assert.equal(executionFingerprint(g),manifest.executionFingerprint);assert.equal(await cache.get(g,{manifest}),first);
 assert.throws(()=>{first.nodes.get(g.rootNodeId).data.eventType='changed';},TypeError);assert.equal(first.nodes.set,undefined);
 g.nodes[0].data.eventType='different.event';await assert.rejects(cache.get(g,{manifest}),{code:'GRAPH_DEPENDENCIES_STALE'});
});
test('compiled cache enforces entry/node bounds and selective explicit invalidation',async()=>{
 const dependencies=new GraphDependencyResolver({providers:providers()}),cache=new CompiledGraphCache({dependencies,maxEntries:2,maxNodes:6});
 for(let n=1;n<=3;n++){const g=graph(`ep:graph:bounded_00${n}`);await cache.get(g,{manifest:(await dependencies.capture(g)).manifest});}
 assert.equal(cache.instrumentation.entries,2);assert.equal(cache.instrumentation.nodes,6);assert.equal(cache.instrumentation.evictions,1);
 assert.deepEqual(cache.invalidate({kind:'node',id:'core.condition'}),{invalidated:2});assert.equal(cache.instrumentation.entries,0);
 const g=graph();await assert.rejects(cache.get(g),{code:'GRAPH_DEPENDENCIES_UNTRACKED'});
});
test('exact effect implementation fingerprints detect same-version drift and preserve optional original confirmation',async()=>{
 let current=providers();const dependencies=new GraphDependencyResolver({providers:()=>current}),g=graph(),manifest=(await dependencies.capture(g)).manifest;
 current=providers('1.0.0',true);const drift=await dependencies.compare(manifest,g);assert.equal(drift.current,false);assert.deepEqual(drift.changed,['provider:narrative.set-state']);
 const fn=async()=>true;current.register({id:'example.native-confirm',apply:fn,verify:fn,validate(){},confirmOriginal:fn});assert.equal(current.get('example.native-confirm').confirmOriginal,fn);
});
test('node extension contract identities exclude labels and bind ports/data/evaluators',()=>{
 const manifest={typeId:'example.logic.gate',label:'First',version:'1.0.0',ports:[{id:'in',direction:'input',valueType:'event',accessClass:'gm'}],defaultData:{enabled:true},validate(){},evaluate:()=>true};
 const a=new NarrativeNodeExtensions(),b=new NarrativeNodeExtensions(),c=new NarrativeNodeExtensions();a.register(manifest);b.register({...manifest,label:'New label'});c.register({...manifest,evaluate:()=>false});
 assert.deepEqual(a.contract(manifest.typeId),b.contract(manifest.typeId));assert.notEqual(a.contract(manifest.typeId).fingerprint,c.contract(manifest.typeId).fingerprint);
});
test('exact immutable child dependencies include transitive contracts and reject untracked children',async()=>{
 let p=providers();const children=new Map(),dependencies=new GraphDependencyResolver({providers:()=>p,readPublished:async(id,v)=>children.get(`${id}@${v}`)});
 const child=graph('ep:graph:child_dependency001');child.publishedVersion=1;children.set(`${child.id}@1`,child);
 const parent=graph('ep:graph:parent_dependency001');parent.nodes[1]={...parent.nodes[1],typeId:'core.subgraph.call',data:{graphId:child.id,publishedVersion:1}};
 assert.ok((await dependencies.capture(parent)).issues.some(x=>x.code==='SUBGRAPH_DEPENDENCIES_UNTRACKED'));
 child.dependencyManifest=(await dependencies.capture(child)).manifest;const captured=await dependencies.capture(parent);assert.deepEqual(captured.issues,[]);
 assert.ok(captured.manifest.dependencies.some(d=>d.kind==='graph'&&d.id===`${child.id}@1`));
 p=providers('2.0.0');const drift=await dependencies.compare(captured.manifest,parent);assert.ok(drift.changed.includes('provider:narrative.set-state'));assert.ok(drift.issues.some(x=>x.code==='SUBGRAPH_DEPENDENCIES_STALE'));
 children.clear();assert.equal((await dependencies.compare(captured.manifest,parent)).current,false);
});
test('action declarations require exact actionVersion/actionContract and exact external plan providers',async()=>{
 const p=providers(),hash=contractHash({action:'reviewed'});p.register({id:'example.plot.action',validate(){},apply:async()=>{},verify:async()=>true});let action={version:'1.0.0',contractFingerprint:hash,targetProviderId:'narrative.set-state',targetVersion:'1.0.0'};
 const dependencies=new GraphDependencyResolver({providers:p,actions:{describe:()=>action},externalDependencies:async({providerId})=>providerId==='example.plot.action'?{dependencies:[{kind:'provider',id:'narrative.set-state',...p.contract('narrative.set-state')}],issues:[]}:null});
 const g=graph();g.nodes[2].data={providerId:'example.plot.action',payload:{actionVersion:'1.0.0',actionContract:hash}};const captured=await dependencies.capture(g);assert.deepEqual(captured.issues,[]);assert.ok(captured.manifest.dependencies.some(d=>d.kind==='action'));assert.ok(captured.manifest.dependencies.some(d=>d.id==='narrative.set-state'));
 action={...action,contractFingerprint:contractHash({action:'changed'})};assert.ok((await dependencies.compare(captured.manifest,g)).issues.some(x=>x.code==='ACTION_CONTRACT_STALE'));
});
test('compile reuse retains fresh per-event state and roll data frames',async()=>{
 const g=withoutCondition('ep:graph:fresh_frame001');
 const stateId='ep:node:state_fresh001',rollId='ep:node:roll_fresh001';
 g.nodes.push({id:stateId,graphId:g.id,typeId:'core.state.value',accessClass:'gm-secret',ports:dataNodePorts('core.state.value','number'),data:{scope:'world',key:'count',valueType:'number',expectedRevision:null}},
 {id:rollId,graphId:g.id,typeId:'core.roll.value',accessClass:'gm-secret',ports:dataNodePorts('core.roll.value','number'),data:{rollKind:'d20',attemptId:'ep:attempt:fresh_frame001',expectedRevision:2,side:'self',field:'total',valueType:'number'}});
 const dependencies=new GraphDependencyResolver({providers:providers()}),cache=new CompiledGraphCache({dependencies}),manifest=(await dependencies.capture(g)).manifest;let stateValue=1,stateReads=0;
 const compiled=await cache.get(g,{manifest});const opts={readState:async()=>{stateReads++;return {kind:'narrative-state',scope:'world',stateKey:'count',revision:stateValue,value:stateValue};}};
 const one=new GraphDataFrame(g,opts);assert.equal(await one.value(stateId),1);stateValue=2;
 assert.equal(await cache.get(g,{manifest}),compiled);const two=new GraphDataFrame(g,opts);assert.equal(await two.value(stateId),2);assert.equal(stateReads,2);
 assert.equal(compiled.nodes.get(rollId).data.attemptId,'ep:attempt:fresh_frame001');assert.equal('values' in compiled,false);
});
