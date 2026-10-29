import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {validateGraph} from '../src/graph/validate.mjs';
import {boundedValue,validateDataNode,dataNodePorts} from '../src/graph/typed-data.mjs';
import {GraphDataFrame} from '../src/runtime/graph-data-frame.mjs';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {createNarrativeStateProvider} from '../src/runtime/native-state-provider.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';

function fixture({literal=false,valueType='number',value=42}={}){
  const repository=new MemoryPartitionRepository(),user={id:'gm_data001',isGM:true};
  const context=createLocalGMContext({user,epoch:'data-test'},'world'),gmProvider=()=>context;
  const state=createNarrativeStateProvider({repository,gmProvider});
  const providers=new EffectProviderRegistry();providers.register(state);
  const catalog=new ActiveTriggerCatalog({repository,gmProvider});
  const registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})});
  const ledger=new DurableEventLedger({repository,gmProvider}),journal=new MemoryOperationJournal();
  const readState=({scope,key})=>state.get({scope,key,value:null});
  const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider,stateReader:readState});
  const review=new DurableProposalReview({repository,registry,ledger,journal,providers,gmProvider});
  const editor=new GraphEditorModel({registry});editor.newGraph('Typed state flow');
  const sourceId=editor.addNode(literal?'core.data.literal':'core.state.value');
  editor.updateSelected({payloadJSON:JSON.stringify(literal?{valueType,value}:{scope:'world',key:'source',valueType,expectedRevision:null})});
  const effectId=editor.addNode('core.effect.proposal');
  editor.updateSelected({providerId:'narrative.set-state',payloadJSON:JSON.stringify({key:'destination',value:null})});
  editor.connect(editor.graph.rootNodeId,effectId);
  editor.bindSelectedInput({field:'value',sourceNodeId:sourceId});
  const event={id:'ep:event:typed_data_flow001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true,value:999}};
  const seed=()=>state.apply({key:'source',value},{operationId:'ep:operation:seed_data001'});
  const ready=async()=>{await editor.save();const p=await editor.publish();await editor.activate(p.publishedVersion);};
  const propose=async()=>{assert.equal((await router.ingest(event)).status,'review-required');return (await ledger.get(event.id)).proposals[0];};
  return {repository,user,gmProvider,state,providers,catalog,registry,ledger,journal,readState,router,review,editor,sourceId,effectId,event,seed,ready,propose};
}

test('ADR-004: typed state data is authorable, published and routed to an approval-only effect',async()=>{
  const s=fixture();await s.seed();await s.ready();const p=await s.propose();
  assert.equal(p.payload.value,42);assert.equal(p.stateInputs[0].revision,1);
  assert.equal(await s.state.get({key:'destination',value:null}),null);
  await assert.rejects(s.review.execute(s.event.id,p.operationId),{code:'APPROVAL_REQUIRED'});
  await s.review.decide(s.event.id,p.operationId,{approve:true});
  assert.equal((await s.review.execute(s.event.id,p.operationId)).status,'completed');
  assert.equal((await s.state.get({key:'destination',value:null})).value,42);
});
test('core.state-read: typed value comes from native state and ignores event-payload claims',async()=>{
  const secret='PRIVATE_STATE_VALUE_42_DO_NOT_TRACE',s=fixture({valueType:'string',value:secret});await s.seed();await s.ready();const p=await s.propose();
  assert.notEqual(p.payload.value,s.event.payload.value);
  assert.equal(JSON.stringify((await s.ledger.get(s.event.id)).evaluations).includes(secret),false,'Trace contains no raw private value');
});
test('ADR-082: changed input revision blocks approval even when the value is unchanged',async()=>{
  const s=fixture();await s.seed();await s.ready();const p=await s.propose();
  await s.state.apply({key:'source',value:42},{operationId:'ep:operation:changed_same001'});
  await assert.rejects(s.review.decide(s.event.id,p.operationId,{approve:true}),{code:'DATA_REVISION_STALE'});
  assert.equal(await s.journal.get(p.idempotencyKey),null);
});
test('ADR-082: input state is revalidated after durable GM approval and before execution',async()=>{
  const s=fixture();await s.seed();await s.ready();const p=await s.propose();
  await s.review.decide(s.event.id,p.operationId,{approve:true});
  await s.state.apply({key:'source',value:43},{operationId:'ep:operation:changed_after001'});
  await assert.rejects(s.review.execute(s.event.id,p.operationId),{code:'DATA_REVISION_STALE'});
  assert.equal(await s.state.get({key:'destination',value:null}),null);
});
test('ADR-067: revoking GM authority prevents typed reads and proposal execution',async()=>{
  const s=fixture();await s.seed();await s.ready();const p=await s.propose();s.user.isGM=false;
  await assert.rejects(s.review.decide(s.event.id,p.operationId,{approve:true}),{code:'GM_AUTHORITY_REVOKED'});
});
test('typed literal values require no state provider and survive service recreation',async()=>{
  const s=fixture({literal:true,valueType:'json',value:{nested:[true,'safe',2]}});await s.ready();const p=await s.propose();
  assert.deepEqual(p.payload.value,{nested:[true,'safe',2]});assert.deepEqual(p.stateInputs,[]);
  await s.review.decide(s.event.id,p.operationId,{approve:true});assert.equal((await s.review.execute(s.event.id,p.operationId)).status,'completed');
});
test('absent authoritative data fails closed without persisting an effect proposal',async()=>{
  const s=fixture();await s.ready();const r=await s.router.ingest(s.event);
  assert.equal(r.status,'uncertain');assert.equal(r.reason,'DATA_STATE_ABSENT');
  assert.equal((await s.ledger.get(s.event.id)).proposals?.length??0,0);
});
test('unavailable authoritative data provider fails closed',async()=>{
  const s=fixture();await s.ready();const router=new DurableReactiveRouter({...s,gmProvider:s.gmProvider});
  assert.equal((await router.ingest(s.event)).reason,'STATE_READ_UNAVAILABLE');
});
test('typed data mismatches and corrupt state rows are rejected rather than coerced',async()=>{
  const s=fixture();const g=s.editor.graph;
  for(const row of [{kind:'narrative-state',scope:'world',stateKey:'source',revision:1,value:'42'},
    {kind:'narrative-state',scope:'elsewhere',stateKey:'source',revision:1,value:42}]){
    const frame=new GraphDataFrame(g,{readState:async()=>row});
    await assert.rejects(frame.payload(g.nodes.find(n=>n.id===s.effectId)),{code:row.scope==='world'?'DATA_TYPE':'STATE_READ_CORRUPT'});
  }
});
test('authored expected revision is enforced by the lazy state provider',async()=>{
  const s=fixture();await s.seed();s.editor.selectNode(s.sourceId);
  s.editor.updateSelected({payloadJSON:JSON.stringify({scope:'world',key:'source',valueType:'number',expectedRevision:2})});
  await s.ready();assert.equal((await s.router.ingest(s.event)).reason,'DATA_REVISION_STALE');
});
test('entity data input selects state by stable narrative identity',async()=>{
  const s=fixture();const entityId=s.editor.addNode('core.data.literal');
  s.editor.updateSelected({payloadJSON:JSON.stringify({valueType:'entity',value:'ep:actor:identity001'})});
  s.editor.connect(entityId,s.sourceId,{sourcePortId:'value',targetPortId:'entity'});
  await s.state.apply({key:'ep:actor:identity001',value:7},{operationId:'ep:operation:entity_state001'});
  await s.ready();const p=await s.propose();assert.equal(p.payload.value,7);assert.equal(p.stateInputs[0].key,'ep:actor:identity001');
});
test('ADR-064: publication blocks data links into less protected ports',()=>{
  const s=fixture(),g=s.editor.graph;g.nodes.find(n=>n.id===s.effectId).accessClass='published';
  assert.throws(()=>validateGraph(g),{code:'DATA_BINDING'});
  g.nodes.find(n=>n.id===s.effectId).accessClass='gm-secret';
  g.nodes.find(n=>n.id===s.sourceId).ports[0].accessClass='published';
  assert.throws(()=>validateGraph(g),{code:'DATA_PORTS'});
});
test('publication rejects ambiguous and disconnected data inputs',()=>{
  const s=fixture(),g=s.editor.graph,e=g.edges.find(e=>e.kind==='data');
  g.edges.push({...e,id:'ep:edge:duplicate_data001'});assert.throws(()=>validateGraph(g),{code:'DATA_CARDINALITY'});
  g.edges=g.edges.filter(e=>e.kind!=='data');assert.throws(()=>validateGraph(g),{code:'DATA_CARDINALITY'});
});
test('ADR-087: data dependency cycles are blocked at authoring and publication',()=>{
  const s=fixture({valueType:'entity',value:'ep:actor:example001'}),other=s.editor.addNode('core.state.value');
  s.editor.updateSelected({payloadJSON:JSON.stringify({scope:'world',key:'other',valueType:'entity',expectedRevision:null})});
  s.editor.connect(s.sourceId,other,{sourcePortId:'value',targetPortId:'entity'});
  assert.throws(()=>s.editor.connect(other,s.sourceId,{sourcePortId:'value',targetPortId:'entity'}),{code:'CYCLE_BLOCKED'});
});
test('unselected branches never resolve private data or produce effects',async()=>{
  const s=fixture(),root=s.editor.graph.rootNodeId;
  s.editor.disconnect(s.editor.graph.edges.find(e=>e.kind==='flow').id);
  const branch=s.editor.addNode('core.condition');s.editor.updateSelected({conditionJSON:JSON.stringify({op:'compare',operator:'eq',left:{type:'literal',value:1},right:{type:'literal',value:2}})});
  s.editor.connect(root,branch);s.editor.connect(branch,s.effectId);await s.ready();
  assert.equal((await s.router.ingest(s.event)).status,'evaluated','Missing state cannot break an unselected consumer');
});
test('typed node edits preserve connected port types atomically',()=>{
  const s=fixture();s.editor.selectNode(s.sourceId);const before=s.editor.graph;
  assert.throws(()=>s.editor.updateSelected({payloadJSON:JSON.stringify({scope:'world',key:'source',valueType:'string',expectedRevision:null})}),{code:'INVALID_PORT_TYPE'});
  assert.deepEqual(s.editor.graph,before);
});
test('unbinding keeps the authored static payload and removes only the selected data edge',()=>{
  const s=fixture();s.editor.unbindSelectedInput('value');
  assert.equal(s.editor.graph.edges.some(e=>e.kind==='data'),false);
  assert.equal(s.editor.selectedNode.data.inputBindings,undefined);
  assert.equal(s.editor.selectedNode.data.payload.value,null);
});
test('bounded typed values reject prototype keys, non-finite numbers and oversized data',()=>{
  for(const value of [JSON.parse('{"__proto__":true}'),NaN,Infinity,undefined,new Date(),Array(65).fill(1),'x'.repeat(3000)])
    assert.throws(()=>boundedValue(value),error=>['DATA_VALUE','DATA_BUDGET'].includes(error.code));
  assert.throws(()=>boundedValue('not-an-id','entity'));
  assert.throws(()=>boundedValue(true,'number'),{code:'DATA_TYPE'});
});
test('payload bindings cannot target unsafe or nonexisting fields',()=>{
  const s=fixture();for(const field of ['__proto__','constructor','unknown'])
    assert.throws(()=>s.editor.bindSelectedInput({field,sourceNodeId:s.sourceId}),{code:'DATA_BINDING'});
});
test('ADR-121: bootstrap and both manifests identify the same integrated version',()=>{
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url))),mod=JSON.parse(readFileSync(new URL('../module.json',import.meta.url)));
  const bootstrap=readFileSync(new URL('../src/bootstrap/index.mjs',import.meta.url),'utf8');
  assert.equal(pkg.version,mod.version);assert.ok(bootstrap.includes(`const VERSION='${pkg.version}'`));
});
