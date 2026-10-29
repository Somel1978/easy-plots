import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentBlueprintCatalog} from '../src/orchestration/persistent-blueprints.mjs';
import {PortableGraphTemplates} from '../src/orchestration/graph-templates.mjs';
import {createPortableTemplate,validatePortableTemplate,materializeTemplate,templateDigest} from '../src/graph/portable-template.mjs';
import {ImmutableGraphPageStore} from '../src/storage/graph-chunks.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {createNarrativeStateProvider} from '../src/runtime/native-state-provider.mjs';
const blueprintId='ep:blueprint:portable_actor001',sourceEventId='ep:event:template_publish001';
function harness(){
 const repository=new MemoryPartitionRepository(),user={id:'gm_templates001',isGM:true},context=createLocalGMContext({user,epoch:'templates'},'world'),gmProvider=()=>context,writer={assertEligible:()=>{}};
 const domains=new NarrativeDomainStore({repository,gmProvider}),catalog=new PersistentBlueprintCatalog({domains}),pages=new ImmutableGraphPageStore({repository,gmProvider,scope:'templates'}),subscriptions=new ActiveTriggerCatalog({repository,gmProvider});
 const registry=new IndexedGraphRegistry({catalog:subscriptions,registry:new PersistentGraphRegistry({repository,gmProvider,pageStore:new ImmutableGraphPageStore({repository,gmProvider})})});
 const compose=()=>new PortableGraphTemplates({catalog,pages,registry,domains,gmProvider,writer}),service=compose(),state=createNarrativeStateProvider({repository,gmProvider}),providers=new EffectProviderRegistry();providers.register(state);
 const ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry,catalog:subscriptions,ledger,gmProvider,stateReader:({scope,key})=>state.get({scope,key,value:null})}),reviews=new DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal:new MemoryOperationJournal()});
 return {repository,user,gmProvider,writer,domains,catalog,pages,registry,compose,service,state,providers,ledger,router,reviews};
}
async function source(s){
 const model=new GraphEditorModel({registry:s.registry});model.newGraph('Reusable harbor structure');const value=model.addNode('core.state.value');model.updateSelected({payloadJSON:'{"scope":"world","key":"source-private-value","valueType":"number","expectedRevision":null}'});
 const effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"source-private-target","value":null}'});model.bindSelectedInput({field:'value',sourceNodeId:value});model.connect(model.graph.rootNodeId,effect);
 const actor=model.addNode('core.effect.proposal');model.updateSelected({providerId:'native.actor.set-health',payloadJSON:'{"actorUuid":"Actor.private_source001","value":5}'});model.connect(model.graph.rootNodeId,actor);
 await model.save();const graph=await model.publish(),template=await s.service.exportGraph({graphId:graph.id,publishedVersion:graph.publishedVersion,blueprintId,revision:1});
 return {model,graph,template};
}
function bindings(template,suffix='one'){
 return Object.fromEntries(template.slots.map(slot=>[slot.id,slot.kind==='scope'?'world':slot.kind==='native-uuid'?'Actor.destination_actor001':slot.kind==='state-key'?(slot.label.includes('payload.key')?`target-${suffix}`:`input-${suffix}`):'INVALID_UNEXPECTED_SLOT']));
}
test('ADR-019: portable export retains world graph structure while removing native/campaign identifiers and prior revision expectations',async()=>{
 const s=harness(),f=await source(s),encoded=JSON.stringify(f.template);
 for(const value of [f.graph.id,...f.graph.nodes.map(n=>n.id),'Actor.private_source001','source-private-value','source-private-target'])assert.equal(encoded.includes(value),false,value);
 assert.equal(f.template.graph.nodes.length,f.graph.nodes.length);assert.equal(f.template.graph.edges.length,f.graph.edges.length);assert.equal(f.template.formatVersion,'1.0.0');assert.ok(f.template.slots.some(s=>s.kind==='native-uuid'));
 assert.equal(await s.registry.getActive(f.graph.id),null);assert.equal(await s.domains.read('blueprint-revision','world','ep:blueprint-revision:portable_actor001_1'),null);
 assert.equal((await validatePortableTemplate(JSON.parse(encoded))).fingerprint,f.template.fingerprint);
});
test('ADR-040: one stored reusable graph creates distinct linked instances with fresh IDs and exact source revision',async()=>{
 const original=harness(),f=await source(original),s=harness();await s.service.store({template:JSON.parse(JSON.stringify(f.template)),sourceEventId});
 const results=[];
 for(const suffix of ['one','two']){
  const spec={blueprintId,revision:1,instanceId:`ep:graph:portable_instance_${suffix}`,bindings:bindings(f.template,suffix),title:`Harbor ${suffix}`,sourceEventId};
  const preview=await s.compose().previewInstance(spec);assert.equal(await s.registry.getDraft(spec.instanceId),null);await assert.rejects(()=>s.service.instantiate(spec),{code:'TEMPLATE_REVIEW_REQUIRED'});
  const made=await s.compose().instantiate(spec,{approved:true,expectedFingerprint:preview.instanceSpecDigest}),draft=await s.registry.getDraft(made.graphId),record=await s.domains.read('blueprint-instance','world',made.graphId);results.push(draft);
  assert.equal(draft.templateSource.revision,1);assert.equal(draft.templateSource.blueprintId,blueprintId);assert.equal(record.data.sourceRevision,1);assert.equal(record.data.fields.instanceGraphId,draft.id);assert.equal(made.nativeResourcesCreated,0);assert.equal(await s.registry.getActive(draft.id),null);
  assert.equal(draft.nodes.find(n=>n.data.providerId==='native.actor.set-health').data.payload.actorUuid,'Actor.destination_actor001');
 }
 assert.notEqual(results[0].id,results[1].id);assert.equal(results[0].nodes.some(a=>results[1].nodes.some(b=>a.id===b.id)),false);assert.equal(results[0].edges.some(a=>results[1].edges.some(b=>a.id===b.id)),false);
 // Authoring, publishing and activation remain distinct. The unactivated
 // template and second draft cannot receive this occurrence.
 const graph=await s.registry.publish(results[0].id,{expectedRevision:results[0].revision});await s.registry.activate(graph.id,graph.publishedVersion);
 await s.state.apply({key:'input-one',value:7},{operationId:'ep:operation:template_seed001'});
 const eventId='ep:event:template_instance_run001';await s.router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}});const row=await s.ledger.get(eventId);assert.equal(row.proposals.length,2);const effect=row.proposals.find(p=>p.providerId==='narrative.set-state');assert.equal(effect.payload.key,'target-one');
 assert.equal(await s.state.get({key:'target-one',value:null}),null);await s.reviews.decide(eventId,effect.operationId,{approve:true});await s.reviews.execute(eventId,effect.operationId);assert.equal((await s.state.get({key:'target-one',value:null})).value,7);assert.equal(await s.state.get({key:'target-two',value:null}),null);
});
test('template draft interruption resumes the same reviewed instance and cannot overwrite later local edits',async()=>{
 const s=harness(),f=await source(s);await s.service.store({template:f.template,sourceEventId});const spec={blueprintId,revision:1,instanceId:'ep:graph:template_recovery001',bindings:bindings(f.template),sourceEventId},preview=await s.service.previewInstance(spec),save=s.registry.saveDraft.bind(s.registry);
 s.registry.saveDraft=async()=>{throw Error('draft interrupted');};await assert.rejects(()=>s.service.instantiate(spec,{approved:true,expectedFingerprint:preview.instanceSpecDigest}),/draft interrupted/);assert.ok(await s.domains.read('blueprint-instance','world',spec.instanceId));assert.equal(await s.registry.getDraft(spec.instanceId),null);
 s.registry.saveDraft=save;const resumed=await s.compose().instantiate(spec,{approved:true,expectedFingerprint:preview.instanceSpecDigest});assert.equal(resumed.draftRevision,1);
 assert.equal((await s.service.instantiate(spec,{approved:true,expectedFingerprint:preview.instanceSpecDigest})).alreadyCreated,true);
 const draft=await s.registry.getDraft(spec.instanceId);await s.registry.saveDraft({...draft,title:'Local override'},{expectedRevision:draft.revision});
 await assert.rejects(()=>s.service.instantiate(spec,{approved:true,expectedFingerprint:preview.instanceSpecDigest}),{code:'TEMPLATE_INSTANCE_CONFLICT'});
});
test('template versions remain immutable and publishing a new source does not change existing instances',async()=>{
 const s=harness(),f=await source(s);await s.service.store({template:f.template,sourceEventId});const spec={blueprintId,revision:1,instanceId:'ep:graph:template_pinned001',bindings:bindings(f.template),sourceEventId},p=await s.service.previewInstance(spec);await s.service.instantiate(spec,{approved:true,expectedFingerprint:p.instanceSpecDigest});
 f.model.rename('New blueprint description');await f.model.save();const next=await f.model.publish(),updated=await s.service.exportGraph({graphId:next.id,publishedVersion:next.publishedVersion,blueprintId,revision:2});await s.service.store({template:updated,sourceEventId});
 assert.equal((await s.registry.getDraft(spec.instanceId)).templateSource.revision,1);assert.equal((await s.service.exportStored({blueprintId,revision:1})).fingerprint,f.template.fingerprint);assert.equal((await s.service.exportStored({blueprintId,revision:2})).fingerprint,updated.fingerprint);
 const altered=structuredClone(f.template);altered.graph.title='Overwritten';const {fingerprint,...body}=altered;altered.fingerprint=await templateDigest(body);await assert.rejects(()=>s.service.store({template:altered,sourceEventId}),{code:'BLUEPRINT_IMMUTABLE'});
});
test('unbound native references, unsupported versions, wrong binding types and stale previews fail before draft creation',async()=>{
 const s=harness(),f=await source(s);await s.service.store({template:f.template,sourceEventId});const instanceId='ep:graph:template_invalid001',all=bindings(f.template);
 await assert.rejects(()=>materializeTemplate(f.template,{instanceId,bindings:{}}),{code:'TEMPLATE_BINDING_REQUIRED'});
 const nativeSlot=f.template.slots.find(s=>s.kind==='native-uuid');await assert.rejects(()=>materializeTemplate(f.template,{instanceId,bindings:{...all,[nativeSlot.id]:'Item.wrong_kind001'}}),{code:'TEMPLATE_BINDING_TYPE'});
 const unsafe=structuredClone(f.template);unsafe.graph.nodes.find(n=>n.data.providerId==='native.actor.set-health').data.payload.actorUuid='Actor.unreviewed_native001';const {fingerprint,...body}=unsafe;unsafe.fingerprint=await templateDigest(body);await assert.rejects(()=>validatePortableTemplate(unsafe),{code:'TEMPLATE_UNBOUND_REFERENCE'});
 await assert.rejects(()=>validatePortableTemplate({...f.template,formatVersion:'99.0.0'}),{code:'TEMPLATE_CONTRACT'});
 await assert.rejects(()=>s.service.instantiate({blueprintId,revision:1,instanceId,bindings:all,sourceEventId},{approved:true,expectedFingerprint:'wrong'}),{code:'TEMPLATE_REVIEW_STALE'});assert.equal(await s.registry.getDraft(instanceId),null);
 const graph=structuredClone(f.graph);graph.title='See Actor.private_source001';await assert.rejects(()=>createPortableTemplate(graph,{blueprintId,revision:3}),{code:'TEMPLATE_EMBEDDED_REFERENCE'});
});
test('GM revocation or writer change blocks portable export and instantiation',async()=>{
 const s=harness(),f=await source(s);await s.service.store({template:f.template,sourceEventId});s.writer.assertEligible=()=>{throw Object.assign(Error('writer changed'),{code:'NOT_DESIGNATED_GM'});};
 await assert.rejects(()=>s.service.exportStored({blueprintId,revision:1}),{code:'NOT_DESIGNATED_GM'});s.user.isGM=false;await assert.rejects(()=>s.service.exportGraph({graphId:f.graph.id,publishedVersion:1,blueprintId,revision:2}),{code:'GM_AUTHORITY_REVOKED'});
});
test('different pinned child versions remain distinct explicit local template dependencies',async()=>{
 const s=harness(),child=new GraphEditorModel({registry:s.registry});child.newGraph('Child one');await child.save();await child.publish();child.rename('Child two');await child.save();await child.publish();
 const parent=new GraphEditorModel({registry:s.registry});parent.newGraph('Two pinned calls');
 for(const version of [1,2]){const n=parent.addNode('core.subgraph.call');parent.updateSelected({payloadJSON:JSON.stringify({graphId:child.graph.id,publishedVersion:version})});parent.connect(parent.graph.rootNodeId,n);}
 await parent.save();const graph=await parent.publish(),template=await createPortableTemplate(graph,{blueprintId,revision:1}),deps=template.slots.filter(s=>s.kind==='published-graph');assert.equal(deps.length,2);assert.deepEqual(deps.map(s=>s.versionHint),[1,2]);assert.equal(JSON.stringify(template).includes(child.graph.id),false);
 const mapped=await materializeTemplate(template,{instanceId:'ep:graph:child_template_instance001',bindings:Object.fromEntries(deps.map((s,i)=>[s.id,{graphId:child.graph.id,publishedVersion:i+1}]))});assert.deepEqual(mapped.nodes.filter(n=>n.typeId==='core.subgraph.call').map(n=>n.data.publishedVersion),[1,2]);
});
test('resource materialization provenance is remapped to the new instance graph',async()=>{
 const s=harness(),model=new GraphEditorModel({registry:s.registry});model.newGraph('Portable resource');const node=model.addNode('core.resource.materialize-actor');model.connect(model.graph.rootNodeId,node);await model.save();const graph=await model.publish(),template=await createPortableTemplate(graph,{blueprintId,revision:1});
 const mapped=await materializeTemplate(template,{instanceId:'ep:graph:resource_template_instance001',bindings:Object.fromEntries(template.slots.map(s=>[s.id,s.kind==='scope'?'world':'ep:resource:new_instance_resource001']))});
 assert.equal(mapped.nodes.find(n=>n.typeId==='core.resource.materialize-actor').data.payload.sourceGraphId,mapped.id);assert.equal(mapped.nodes.find(n=>n.typeId==='core.resource.materialize-actor').data.payload.resourceId,'ep:resource:new_instance_resource001');await s.registry.saveDraft(mapped,{expectedRevision:null});
});
