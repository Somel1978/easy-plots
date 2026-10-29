import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {createNarrativeStateProvider} from '../src/runtime/native-state-provider.mjs';
import {createFactionStandingProvider} from '../src/runtime/domain-providers.mjs';
import {ApprovedOperationEventGateway} from '../src/runtime/approved-operation-gateway.mjs';
import {BoundedEventCascades,cascadeLocator} from '../src/runtime/event-cascades.mjs';
import {versionedEvent} from '../src/contracts/canonical-event.mjs';
const input=(n,parents=[],eventType='narrative.cascade',capability='cascade-test-v1')=>versionedEvent({id:`ep:event:cascade_input_${String(n).padStart(8,'0')}`,eventType,source:{kind:'gm-approved-intent',capability,requestId:`ep:request:cascade_input_${String(n).padStart(8,'0')}`},payload:{},causalParentIds:parents});
function base(limits={}){
 const repository=new MemoryPartitionRepository(),user={id:'gm_cascades001',isGM:true},context=createLocalGMContext({user,epoch:'cascade'},'world'),gmProvider=()=>context,ledger=new DurableEventLedger({repository,gmProvider});
 const cascades=new BoundedEventCascades({repository,ledger,gmProvider,...limits});return {repository,user,gmProvider,ledger,cascades};
}
async function reserveAndStore(s,event){const result=await s.cascades.reserve(event);if(result.allowed)await s.ledger.accept(event);return result;}
const reference=(path,value)=>({op:'compare',operator:'eq',left:{type:'reference',path:['event',...path],requiredPermission:'gm'},right:{type:'literal',value}});
async function reactiveSetup({factions=false,...limits}={}){
 const s=base(limits),{repository,ledger,gmProvider,cascades}=s,catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})});
 const state=createNarrativeStateProvider({repository,gmProvider}),standing=createFactionStandingProvider({repository,gmProvider}),providers=new EffectProviderRegistry();providers.register(state);providers.register(standing);const journal=new MemoryOperationJournal();
 const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider,cascades}),reviews=new DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal}),writer={assertEligible(){}},gateway=new ApprovedOperationEventGateway({reviews,router,gmProvider,writer,worldId:'world'});
 const a=new GraphEditorModel({registry}),b=new GraphEditorModel({registry});a.newGraph('Faction A conditional reaction');b.newGraph('Faction B conditional reaction');
 const payloadA={factionId:'ep:faction:cascade_a001',actorId:'ep:actor:cascade_hero001',dimension:'renown',delta:1},payloadB={...payloadA,factionId:'ep:faction:cascade_b001'};
 for(const [editor,other,first,payload] of [[a,b,true,payloadA],[b,a,false,payloadB]]){
  editor.selectNode(editor.graph.rootNodeId);editor.updateSelected({eventType:'narrative.operations-completed'});
  const gate=editor.addNode('core.event.filter'),condition=reference(['completions','0','rootGraphId'],other.graph.id);
  editor.updateSelected({payloadJSON:JSON.stringify({condition})});
  const effect=editor.addNode(factions?'core.faction.standing':'core.effect.proposal');
  editor.updateSelected(factions?{payloadJSON:JSON.stringify(payload)}:{providerId:'narrative.set-state',payloadJSON:JSON.stringify({key:first?'faction-a-reaction':'faction-b-reaction',value:true})});
  editor.connect(editor.graph.rootNodeId,gate);editor.connect(gate,effect);await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
 }
 const root=versionedEvent({id:'ep:event:cascade_mutual_root001',eventType:'narrative.operations-completed',source:{kind:'gm-approved-intent',requestId:'ep:request:cascade_seed001'},payload:{completions:[{rootGraphId:b.graph.id}]}});
 const complete=async(eventId)=>{const row=await ledger.get(eventId);assert.equal(row.proposals.length,1);const operationId=row.proposals[0].operationId;await assert.rejects(()=>reviews.execute(eventId,operationId),{code:'APPROVAL_REQUIRED'});await reviews.decide(eventId,operationId,{approve:true});assert.equal((await reviews.execute(eventId,operationId)).status,'completed');return {operations:[{sourceEventId:eventId,operationId}]};};
 return {...s,catalog,registry,state,standing,journal,router,reviews,writer,gateway,a,b,root,complete,payloadA,payloadB};
}
test('ADR-014 mutually reactive published faction rules stop at the causal budget before another standing proposal or world effect',async()=>{
 const s=await reactiveSetup({factions:true,maxDepth:1,maxRepeats:8});assert.equal((await s.router.ingest(s.root)).proposals,1);assert.equal(await s.standing.get(s.payloadA),null);const a=await s.complete(s.root.id);assert.equal((await s.standing.get(s.payloadA)).value,1);
 const loc=await cascadeLocator(s.root.id),before=await s.repository.read(loc.id,{partitionId:loc.partitionId}),preview=await s.gateway.preview(a);assert.equal(preview.cascade.allowed,true);assert.deepEqual(await s.repository.read(loc.id,{partitionId:loc.partitionId}),before);assert.equal(await s.ledger.get(preview.event.id),null);assert.equal(await s.standing.get(s.payloadB),null);
 const next=await s.gateway.emit(a,{approved:true});assert.equal(next.proposals,1);assert.equal(await s.standing.get(s.payloadB),null);const b=await s.complete(next.eventId);assert.equal((await s.standing.get(s.payloadB)).value,1);
 const blockedPreview=await s.gateway.preview(b);assert.equal(blockedPreview.cascade.code,'CASCADE_DEPTH_BUDGET');assert.equal(await s.ledger.get(blockedPreview.event.id),null);
 s.repository.query=()=>{throw Error('Campaign scans are forbidden');};const blocked=await s.gateway.emit(b,{approved:true});assert.equal(blocked.status,'evaluated');assert.equal(blocked.proposals,0);assert.equal(blocked.cascade.code,'CASCADE_DEPTH_BUDGET');const row=await s.ledger.get(blocked.eventId);assert.equal(row.reason,'CASCADE_DEPTH_BUDGET');assert.equal(row.evaluations[0].trace[0].status,'cascade-stopped');assert.deepEqual(row.proposals,[]);
 const restarted=new DurableReactiveRouter({registry:s.registry,catalog:s.catalog,ledger:s.ledger,gmProvider:s.gmProvider,cascades:new BoundedEventCascades({repository:s.repository,ledger:s.ledger,gmProvider:s.gmProvider,maxDepth:1,maxRepeats:8})});assert.equal((await restarted.ingest(row.event)).status,'duplicate-or-recovery-required');assert.equal((await s.standing.get(s.payloadA)).revision,1);assert.equal((await s.standing.get(s.payloadB)).revision,1);assert.equal((await s.journal.list()).length,2);
});
test('ADR-014 changing occurrence IDs cannot reset repeated completed-operation reactions and every hop keeps independent approvals',async()=>{
 const s=await reactiveSetup({maxRepeats:1});await s.router.ingest(s.root);let spec=await s.complete(s.root.id);
 for(let i=0;i<2;i++){const next=await s.gateway.emit(spec,{approved:true});assert.equal(next.proposals,1);spec=await s.complete(next.eventId);}
 const preview=await s.gateway.preview(spec);assert.equal(preview.cascade.code,'CASCADE_REPEATED_REACTION');const stopped=await s.gateway.emit(spec,{approved:true});assert.equal(stopped.proposals,0);assert.equal(stopped.cascade.depth,3);assert.equal((await s.journal.list()).length,3);assert.equal((await s.state.get({key:'faction-a-reaction',value:null})).revision,2);assert.equal((await s.state.get({key:'faction-b-reaction',value:null})).revision,1);
 const loc=await cascadeLocator(s.root.id),row=await s.repository.read(loc.id,{partitionId:loc.partitionId});assert.equal(row.events.length,3);assert.equal((await s.gateway.emit(spec,{approved:true})).status,'duplicate-or-recovery-required');assert.equal((await s.repository.read(loc.id,{partitionId:loc.partitionId})).events.length,3);
});
test('ADR-014 direct bounded root reservations stop fanout and total events without scans, and preview does not reserve',async()=>{
 const s=base({maxFanout:1,maxEvents:3,maxRepeats:8}),root=input(1);await reserveAndStore(s,root);const a=input(2,[root.id]);assert.equal((await s.cascades.inspect(a)).allowed,true);const loc=await cascadeLocator(root.id);assert.equal((await s.repository.read(loc.id,{partitionId:loc.partitionId})).events.length,1);await reserveAndStore(s,a);
 assert.equal((await s.cascades.reserve(input(3,[root.id]))).code,'CASCADE_FANOUT_BUDGET');const b=input(4,[a.id]);await reserveAndStore(s,b);assert.equal((await s.cascades.reserve(input(5,[b.id]))).code,'CASCADE_EVENT_BUDGET');assert.equal((await s.cascades.reserve(b)).allowed,true);assert.equal((await s.repository.read(loc.id,{partitionId:loc.partitionId})).events.length,3);
});
test('ADR-014 merged causal roots retain every original budget across restart and interrupted multi-root reservations',async()=>{
 const s=base({maxEvents:3,maxRepeats:8}),a=input(10),b=input(11);await reserveAndStore(s,a);await reserveAndStore(s,b);const join=input(12,[a.id,b.id]);const locB=await cascadeLocator(b.id),put=s.repository.put.bind(s.repository);let interrupted=true;
 s.repository.put=async(row,opts)=>{if(row.id===locB.id&&interrupted){interrupted=false;throw Object.assign(Error('ACK lost before second root reservation'),{code:'WRITE_INTERRUPTED'});}return put(row,opts);};await assert.rejects(()=>s.cascades.reserve(join),{code:'WRITE_INTERRUPTED'});
 const restarted=new BoundedEventCascades({repository:s.repository,ledger:s.ledger,gmProvider:s.gmProvider,maxEvents:3,maxRepeats:8});assert.equal((await restarted.reserve(join)).allowed,true);await s.ledger.accept(join);const next=input(13,[join.id]);assert.equal((await restarted.reserve(next)).allowed,true);await s.ledger.accept(next);assert.equal((await restarted.reserve(input(14,[next.id]))).code,'CASCADE_EVENT_BUDGET');
 for(const root of [a,b]){const loc=await cascadeLocator(root.id),row=await s.repository.read(loc.id,{partitionId:loc.partitionId});assert.equal(row.events.length,3);assert.deepEqual(row.events.map(e=>e.eventId),[root.id,join.id,next.id]);}
});
test('ADR-014 concurrent reservations cannot overrun sibling budgets and reused IDs cannot change their content',async()=>{
 const s=base({maxFanout:1,maxRepeats:8}),root=input(20);await reserveAndStore(s,root);const outcomes=await Promise.all([s.cascades.reserve(input(21,[root.id])),s.cascades.reserve(input(22,[root.id]))]);assert.equal(outcomes.filter(x=>x.allowed).length,1);assert.equal(outcomes.find(x=>!x.allowed).code,'CASCADE_FANOUT_BUDGET');
 const loc=await cascadeLocator(root.id),row=await s.repository.read(loc.id,{partitionId:loc.partitionId}),reserved=row.events.at(-1),different=input(Number(reserved.eventId.slice(-8)),[root.id]);different.payload={changed:true};await assert.rejects(()=>s.cascades.reserve(different),{code:'EVENT_REUSE_CONFLICT'});
});
test('ADR-014 regrouping completed rules cannot disguise a repeated reaction',async()=>{
 const s=base({maxRepeats:1}),root=input(40),a=input(41,[root.id],'narrative.operations-completed','verified-operations-v1');
 a.payload.completions=[{rootGraphId:'ep:graph:reaction_a001',rootPublishedVersion:1,nodeIds:['ep:node:reaction_a001']}];await reserveAndStore(s,root);await reserveAndStore(s,a);
 const grouped=input(42,[a.id],'narrative.operations-completed','verified-operations-v1');grouped.payload.completions=[{rootGraphId:'ep:graph:reaction_b001',rootPublishedVersion:1,nodeIds:['ep:node:reaction_b001']},...a.payload.completions];assert.equal((await s.cascades.reserve(grouped)).code,'CASCADE_REPEATED_REACTION');
});
test('ADR-014 missing parents, unbounded ancestry, changed policy and revoked GM authority fail closed',async()=>{
 const s=base({maxReads:1,maxRepeats:8}),a=input(30),b=input(31);await reserveAndStore(s,a);await reserveAndStore(s,b);assert.equal((await s.cascades.inspect(input(32,['ep:event:missing_parent001']))).code,'CASCADE_PARENT_MISSING');assert.equal((await s.cascades.inspect(input(33,[a.id,b.id]))).code,'CASCADE_ANCESTRY_BUDGET');
 const changed=new BoundedEventCascades({repository:s.repository,ledger:s.ledger,gmProvider:s.gmProvider,maxEvents:2,maxRepeats:8,maxReads:1});await assert.rejects(()=>changed.inspect(a),{code:'CASCADE_RECORD'});s.user.isGM=false;await assert.rejects(()=>s.cascades.inspect(a),{code:'GM_AUTHORITY_REVOKED'});
});
test('ADR-014 lost reservation acknowledgements leave an uncertain accepted event and never replay evaluation after restart',async()=>{
 const s=await reactiveSetup(),put=s.repository.put.bind(s.repository);let lost=true;
 s.repository.put=async(row,opts)=>{const saved=await put(row,opts);if(row.kind==='event-cascade'&&lost){lost=false;throw Object.assign(Error('Reservation ACK lost'),{code:'ACK_LOST'});}return saved;};
 assert.equal((await s.router.ingest(s.root)).status,'uncertain');assert.equal((await s.ledger.get(s.root.id)).reason,'ACK_LOST');assert.equal(await s.state.get({key:'faction-a-reaction',value:null}),null);assert.deepEqual(await s.journal.list(),[]);
 const cascades=new BoundedEventCascades({repository:s.repository,ledger:s.ledger,gmProvider:s.gmProvider}),router=new DurableReactiveRouter({registry:s.registry,catalog:s.catalog,ledger:s.ledger,gmProvider:s.gmProvider,cascades});assert.equal((await router.ingest(s.root)).status,'duplicate-or-recovery-required');assert.equal(await s.state.get({key:'faction-a-reaction',value:null}),null);assert.deepEqual(await s.journal.list(),[]);
});
test('ADR-014 protected cascade index uncertainty and authority lost during ancestry reads fail closed',async()=>{
 const s=base(),root=input(50);await reserveAndStore(s,root);const loc=await cascadeLocator(root.id);s.repository.hasReadyIndex=async id=>id!==loc.id;await assert.rejects(()=>s.cascades.inspect(root),{code:'CASCADE_INDEX_UNCERTAIN'});delete s.repository.hasReadyIndex;
 const get=s.ledger.get.bind(s.ledger);s.ledger.get=async id=>{const row=await get(id);s.user.isGM=false;return row;};await assert.rejects(()=>s.cascades.inspect(input(51,[root.id])),{code:'GM_AUTHORITY_REVOKED'});
});
