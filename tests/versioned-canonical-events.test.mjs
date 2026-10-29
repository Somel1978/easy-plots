import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CANONICAL_EVENT_SCHEMA_V1} from '../src/contracts/canonical-event-schema.mjs';
import {CANONICAL_EVENT_VERSION,versionedEvent,validateEventVersion,validateCanonicalEventDocument} from '../src/contracts/canonical-event.mjs';
import {sha256Hex} from '../src/contracts/digest.mjs';
import {DurableEventLedger,eventLocator} from '../src/runtime/event-ledger.mjs';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {createNarrativeStateProvider} from '../src/runtime/native-state-provider.mjs';
import {normalizeFoundryHook} from '../src/platform/foundry-hook-ingress.mjs';
import {GMManualEventGateway} from '../src/runtime/manual-event-gateway.mjs';
const id=n=>`ep:event:versioned_${String(n).padStart(8,'0')}`;
const fixture=(n,extra={})=>versionedEvent({id:id(n),eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{amount:7},...extra});
function setup(){const repository=new MemoryPartitionRepository(),user={id:'gm_event_version001',isGM:true},ctx=createLocalGMContext({user,epoch:'event-contract'},'world'),gmProvider=()=>ctx;
 return {repository,user,gmProvider,ledger:new DurableEventLedger({repository,gmProvider,now:()=>1000,worldTimeProvider:()=>100})};}
test('ADR-121: stable canonical descriptor matches the proposed Event schema and its published version fingerprint',async()=>{
 const proposed=JSON.parse(readFileSync(new URL('../spec/Proposed_Core_Schemas_V1.json',import.meta.url))).$defs.Event;
 assert.deepEqual(CANONICAL_EVENT_SCHEMA_V1,proposed);
 const versions=JSON.parse(readFileSync(new URL('../spec/Canonical_Event_Compatibility.json',import.meta.url))).versions;
 assert.equal(await sha256Hex(JSON.stringify(CANONICAL_EVENT_SCHEMA_V1)),versions[CANONICAL_EVENT_VERSION].schemaSha256);
 assert.equal(validateCanonicalEventDocument(JSON.parse(readFileSync(new URL('../spec/Example_Canonical_Event_V1.json',import.meta.url)))).eventVersion,'1.0.0');
 assert.throws(()=>CANONICAL_EVENT_SCHEMA_V1.required.push('a-ui-field'),TypeError);
 const changed=structuredClone(CANONICAL_EVENT_SCHEMA_V1);changed.required.push('new-stable-field');
 assert.notEqual(await sha256Hex(JSON.stringify(changed)),versions[CANONICAL_EVENT_VERSION].schemaSha256,'A changed descriptor cannot retain its previous pinned version fingerprint');
});
test('ADR-070: versioned canonical event and typed fixture keep causal lineage stable through replay and GM approval',async()=>{
 const s=setup(),catalog=new ActiveTriggerCatalog(s),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry(s)}),model=new GraphEditorModel({registry});
 model.newGraph('Versioned typed event');const data=model.addNode('core.data.event');model.updateSelected({payloadJSON:'{"path":["payload","amount"],"valueType":"number"}'});
 const effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"versioned-value","value":null}'});
 model.connect(model.graph.rootNodeId,effect);model.bindSelectedInput({field:'value',sourceNodeId:data});await model.save();const publication=await model.publish();await model.activate(publication.publishedVersion);
 const parent=fixture(1),event=fixture(2,{causalParentIds:[parent.id],correlationId:'typed-fixture-001'});await s.ledger.accept(parent);
 const router=new DurableReactiveRouter({...s,registry,catalog});assert.equal((await router.ingest(event)).status,'review-required');
 const row=await s.ledger.get(event.id);assert.equal(validateCanonicalEventDocument(row.canonical).eventVersion,'1.0.0');assert.deepEqual(row.canonical.causalParentIds,[parent.id]);assert.equal(row.canonical.worldId,'world');assert.equal(row.canonical.worldTime,100);
 assert.equal(row.proposals[0].payload.value,7);assert.equal((await router.ingest(structuredClone(row.event))).status,'duplicate-or-recovery-required');
 const state=createNarrativeStateProvider(s),providers=new EffectProviderRegistry();providers.register(state);
 const reviews=new DurableProposalReview({...s,registry,providers,journal:new MemoryOperationJournal()});event.payload.amount=999;
 await reviews.decide(row.sourceEventId,row.proposals[0].operationId,{approve:true});await reviews.execute(row.sourceEventId,row.proposals[0].operationId);
 const latest=await s.ledger.get(row.sourceEventId);assert.equal(latest.canonicalFingerprint,row.canonicalFingerprint);assert.deepEqual(latest.canonical.causalParentIds,[parent.id]);
 assert.equal((await state.get({scope:'world',key:'versioned-value',value:null})).value,7);
});
test('unknown event versions and incomplete causal envelopes are rejected before persistence',async()=>{
 const s=setup();await assert.rejects(()=>s.ledger.accept({...fixture(1),eventVersion:'2.0.0'}),{code:'EVENT_VERSION_UNSUPPORTED'});
 await assert.rejects(()=>s.ledger.accept({...fixture(1),causalParentIds:undefined}),{code:'EVENT_ENVELOPE'});
 const legacy={id:id(1),eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{},causalParentIds:[]};
 await assert.rejects(()=>s.ledger.accept(legacy),{code:'EVENT_VERSION_REQUIRED'});assert.equal(s.repository.instrumentation.partitionCount,0);
});
test('causal parents must already exist in the same ledger and self or duplicate parents fail closed',async()=>{
 const s=setup();await assert.rejects(()=>s.ledger.accept(fixture(2,{causalParentIds:[id(1)]})),{code:'EVENT_CAUSAL_PARENT_MISSING'});
 assert.throws(()=>fixture(1,{causalParentIds:[id(1)]}),{code:'EVENT_ENVELOPE'});
 assert.throws(()=>fixture(2,{causalParentIds:[id(1),id(1)]}),{code:'EVENT_ENVELOPE'});
 assert.equal(s.repository.instrumentation.partitionCount,0);
});
test('existing unversioned events retain their exact payload and fingerprint without an inferred upgrade',async()=>{
 const s=setup(),legacy={id:id(1),eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{amount:3}};
 const accepted=await s.ledger.accept(legacy);assert.equal(accepted.record.fingerprint,await sha256Hex(JSON.stringify(legacy)));assert.equal(accepted.record.canonical,undefined);
 const child=fixture(2,{causalParentIds:[legacy.id]});await s.ledger.accept(child);
 assert.deepEqual((await s.ledger.get(legacy.id)).event,legacy);assert.equal(validateEventVersion(legacy),'legacy-unversioned');
 await assert.rejects(()=>s.ledger.accept(fixture(1)),{code:'EVENT_REUSE_CONFLICT'});
});
test('versioned events reject non-JSON and unbounded causal values before journal writes',async()=>{
 const s=setup();for(const bad of [NaN,Infinity,undefined,()=>42,new Date()])await assert.rejects(()=>s.ledger.accept({...fixture(1),payload:{bad}}),{code:'EVENT_JSON'});
 const cyclic={};cyclic.self=cyclic;await assert.rejects(()=>s.ledger.accept({...fixture(1),payload:cyclic}),{code:'EVENT_JSON_BUDGET'});
 assert.equal(s.repository.instrumentation.partitionCount,0);
});
test('canonical document corruption is caught independently of the runtime event fingerprint',async()=>{
 const s=setup(),event=fixture(1);await s.ledger.accept(event);const row=await s.ledger.get(event.id);row.canonical.payload.amount=999;
 row.canonicalFingerprint=await sha256Hex(JSON.stringify(row.canonical));await s.repository.put(row,{expectedRevision:row.revision});
 await assert.rejects(()=>s.ledger.get(event.id),{code:'EVENT_CANONICAL_CORRUPT'});
});
test('canonical metadata and its first author survive lifecycle changes and GM handover',async()=>{
 const s=setup(),event=fixture(1);await s.ledger.accept(event);const original=await s.ledger.get(event.id);
 await s.ledger.transition(event.id,'prepared','evaluating');await s.ledger.transition(event.id,'evaluating','evaluated');
 const gm=createLocalGMContext({user:{id:'gm_successor001',isGM:true},epoch:'next'},'world'),next=new DurableEventLedger({repository:s.repository,gmProvider:()=>gm});
 const read=await next.get(event.id);assert.deepEqual(read.canonical,original.canonical);assert.equal(read.canonical.provenance[0].authorId,s.user.id);assert.equal(read.canonical.revision,0);assert.equal(read.revision,3);
});
test('native and GM-authored producers explicitly emit the supported version and preserve stable request identity',async()=>{
 const native=normalizeFoundryHook('updateActor',[{uuid:'Actor.version001',documentName:'Actor'}, {},{},'gm'],{randomId:()=> 'native_version001'});
 assert.equal(native.eventVersion,CANONICAL_EVENT_VERSION);assert.deepEqual(native.causalParentIds,[]);
 const s=setup(),seen=[],gateway=new GMManualEventGateway({router:{ingest:async e=>{seen.push(e);return {status:'evaluated'};}},gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},worldId:'world'});
 const spec={requestId:'ep:request:versioned001',eventType:'evidence.discovered',payload:{amount:7},causalParentIds:[id(1)],correlationId:'campaign-thread001'};
 await gateway.emit(spec);await gateway.emit(spec);assert.deepEqual(seen[0],seen[1]);assert.equal(seen[0].eventVersion,'1.0.0');assert.deepEqual(seen[0].causalParentIds,[id(1)]);
});
test('canonical schema rejects foreign fields, unsupported document versions and incomplete provenance shape',()=>{
 const example=JSON.parse(readFileSync(new URL('../spec/Example_Canonical_Event_V1.json',import.meta.url)));
 assert.throws(()=>validateCanonicalEventDocument({...example,arbitraryUIState:true}),{code:'CANONICAL_EVENT_SCHEMA'});
 assert.throws(()=>validateCanonicalEventDocument({...example,schemaVersion:'2.0.0'}),{code:'EVENT_VERSION_UNSUPPORTED'});
 assert.throws(()=>validateCanonicalEventDocument({...example,provenance:'gm'}),{code:'CANONICAL_EVENT_SCHEMA'});
});
