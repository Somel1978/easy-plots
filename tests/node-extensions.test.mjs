import test from 'node:test';import assert from 'node:assert/strict';
import {NarrativeNodeExtensions} from '../src/graph/node-extensions.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
const gm=createLocalGMContext({user:{id:'gm',isGM:true}},'world');
const port=(id,direction)=>({id,direction,valueType:'event',accessClass:'gm'});
function manifest(evaluate=async data=>data.enabled){return {typeId:'example.gate.check',version:'1.0.0',label:'GM logic gate',
  ports:[port('in','input'),port('out','output')],defaultData:{enabled:false},
  validate:data=>{if(typeof data.enabled!=='boolean')throw Error('enabled must be bool');},evaluate};}
function env(extensions){const repository=new MemoryPartitionRepository(),gmProvider=()=>gm;
  const base=new PersistentGraphRegistry({repository,gmProvider,extensions});
  const catalog=new ActiveTriggerCatalog({repository,gmProvider});
  const registry=new IndexedGraphRegistry({registry:base,catalog});
  const ledger=new DurableEventLedger({repository,gmProvider});
  return {repository,catalog,registry,ledger,editor:new GraphEditorModel({registry,extensions}),
    router:new DurableReactiveRouter({registry,catalog,ledger,gmProvider,extensions})};}
test('versioned extension logic composes into authoring and published reactive graph',async()=>{
  const extensions=new NarrativeNodeExtensions();extensions.register(manifest());
  const s=env(extensions),g=s.editor.newGraph('Extension demo'),id=s.editor.addNode('example.gate.check');
  s.editor.connect(g.rootNodeId,id);await s.editor.save();const published=await s.editor.publish();await s.editor.activate(published.publishedVersion);
  const event={id:'ep:event:extension_gate_001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}};
  assert.equal((await s.router.ingest(event)).status,'evaluated');
  assert.equal((await s.ledger.get(event.id)).evaluations[0].evaluatedNodeIds.length,2);
});
test('extension contract enforces version, declared ports, shape and no arbitrary effects',async()=>{
  const extensions=new NarrativeNodeExtensions();extensions.register(manifest(async()=>({effects:[{type:'delete'}]})));
  const s=env(extensions),g=s.editor.newGraph('Unsafe extension'),id=s.editor.addNode('example.gate.check');
  s.editor.connect(g.rootNodeId,id);s.editor.updateSelected({payloadJSON:'{"enabled":true}'});
  await s.editor.save();const pub=await s.editor.publish();await s.editor.activate(pub.publishedVersion);
  const res=await s.router.ingest({id:'ep:event:extension_unsafe_01',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}});
  assert.equal(res.status,'uncertain');assert.equal(res.reason,'EXTENSION_RESULT');
  assert.throws(()=>extensions.validateNode({...s.editor.graph.nodes.find(n=>n.id===id),providerVersion:'9.0.0'}),{code:'EXTENSION_VERSION'});
  assert.throws(()=>extensions.validateNode({...s.editor.graph.nodes.find(n=>n.id===id),ports:[]}),{code:'EXTENSION_PORT'});
});
test('lazy node provider is registered on demand and never during module init',async()=>{
  const extensions=new NarrativeNodeExtensions();let count=0;
  extensions.registerLazy('example.gate.check',async()=>{count++;return manifest();});
  assert.equal(count,0);await extensions.load('example.gate.check');await extensions.load('example.gate.check');assert.equal(count,1);
  assert.throws(()=>extensions.register(manifest()),{code:'EXTENSION_DUPLICATE'});
});
test('ADR-073: an unavailable provider version loads without losing data and cannot execute or republish',async()=>{
 const original=new NarrativeNodeExtensions();original.register(manifest());const s=env(original);
 const graph=s.editor.newGraph('Preserved older provider'),id=s.editor.addNode('example.gate.check');
 s.editor.updateSelected({payloadJSON:'{"enabled":true}'});s.editor.connect(graph.rootNodeId,id);
 await s.editor.save();const p=await s.editor.publish();await s.editor.activate(p.publishedVersion);
 const newer=new NarrativeNodeExtensions();newer.register({...manifest(),version:'2.0.0'});
 const gmProvider=()=>gm,registry=new IndexedGraphRegistry({catalog:s.catalog,registry:new PersistentGraphRegistry({repository:s.repository,gmProvider,extensions:newer})});
 const editor=new GraphEditorModel({registry,extensions:newer});await editor.load(graph.id);
 const before=editor.graph.nodes.find(n=>n.id===id);assert.equal(before.providerVersion,'1.0.0');assert.deepEqual(before.data,{enabled:true});
 await assert.rejects(editor.save(),{code:'EXTENSION_VERSION'});assert.deepEqual(editor.graph.nodes.find(n=>n.id===id),before);
 const router=new DurableReactiveRouter({registry,catalog:s.catalog,ledger:s.ledger,gmProvider,extensions:newer});
 const event={id:'ep:event:older_provider001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}};
 const result=await router.ingest(event);assert.equal(result.status,'uncertain');assert.equal(result.reason,'EXTENSION_VERSION');
 assert.equal((await s.ledger.get(event.id)).proposals.length,0);
});
