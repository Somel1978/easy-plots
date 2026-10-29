import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {createFoundryActorItemShellProvider,validateNativeShell} from '../src/platform/foundry-actor-item-provider.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';

const ctx={operationId:'ep:operation:native_shell_001',sourceEventId:'ep:event:native_shell_001'};
const gm=createLocalGMContext({user:{id:'gm-shell',isGM:true}},'world-1');
const p=(documentType,resourceId)=>({scope:'world',resourceId,sourceGraphId:'ep:graph:source_001',documentType,visibility:'gm-only',expectedRevision:null});
function fixture(){
  const repository=new MemoryPartitionRepository(),maps={Actor:new Map(),Item:new Map()};
  const collections={};
  for(const kind of ['Actor','Item']){
    const docs=maps[kind];
    collections[kind]={get:id=>docs.get(id)??null,documentClass:{createDocuments:async data=>data.map(d=>{
      const record={id:d._id,type:d.type,name:d.name,ownership:d.ownership,flags:d.flags,
        getFlag:(scope,key)=>d.flags?.[scope]?.[key]};docs.set(record.id,record);return record;
    })}};
  }
  const gameInstance={actors:collections.Actor,items:collections.Item,system:{documentTypes:{Actor:['npc','character'],Item:['loot','weapon']}}};
  const writer={assertEligible:g=>assert.equal(g.userId,gm.userId)};
  return {repository,gameInstance,maps,writer,gmProvider:()=>gm};
}
test('Actor shell is GM-owned, opaque, idempotent, and verified against native type',async()=>{
  const f=fixture(),provider=createFoundryActorItemShellProvider({...f,kind:'Actor'});
  const spec=p('npc','ep:resource:actor_001');const result=await provider.apply(spec,ctx);
  assert.match(result.nativeUuid,/^Actor\.[a-f0-9]{16}$/);
  const created=[...f.maps.Actor.values()][0];
  assert.equal(created.type,'npc');assert.equal(created.ownership.default,0);
  assert.ok(!created.name.includes('actor_001'));
  assert.deepEqual(Object.keys(created.flags['easy-plots']),['resourceProof']);
  assert.equal(await provider.verify(spec,ctx),true);
  assert.equal((await provider.apply(spec,ctx)).alreadyApplied,true);
});
test('explicit original-outcome confirmation recovers a lost native create acknowledgment without another Actor creation',async()=>{
 const f=fixture(),create=f.gameInstance.actors.documentClass.createDocuments;let creates=0;f.gameInstance.actors.documentClass.createDocuments=async rows=>{creates++;await create(rows);throw Error('Native ACK lost');};const provider=createFoundryActorItemShellProvider({...f,kind:'Actor'}),spec=p('npc','ep:resource:confirm_original001');await assert.rejects(provider.apply(spec,ctx),{code:'NATIVE_SHELL_RECONCILIATION_REQUIRED'});assert.equal(await provider.verify(spec,ctx),false);await assert.rejects(provider.confirmOriginal(spec,ctx),{code:'NATIVE_SHELL_CONFIRMATION'});await assert.rejects(provider.confirmOriginal(spec,{...ctx,operationId:'ep:operation:other_original001'},{approved:true}),{code:'NATIVE_SHELL_UNCONFIRMED'});const document=[...f.maps.Actor.values()][0],proof=document.flags['easy-plots'].resourceProof;document.flags['easy-plots'].resourceProof='foreign-proof';await assert.rejects(provider.confirmOriginal(spec,ctx,{approved:true}),{code:'NATIVE_SHELL_UNCONFIRMED'});document.flags['easy-plots'].resourceProof=proof;await provider.confirmOriginal(spec,ctx,{approved:true});assert.equal(await provider.verify(spec,ctx),true);assert.equal(creates,1);assert.equal((await provider.inspect(spec)).row.confirmedBy,gm.userId);
});
test('Item shell requires declared game-system type; no document is written on invalid type',async()=>{
  const f=fixture(),provider=createFoundryActorItemShellProvider({...f,kind:'Item'});
  await assert.rejects(()=>provider.apply(p('unknown','ep:resource:item_001'),ctx),{code:'NATIVE_TYPE_UNSUPPORTED'});
  assert.equal(f.maps.Item.size,0);
  const spec=p('loot','ep:resource:item_001');const r=await provider.apply(spec,ctx);
  assert.match(r.nativeUuid,/^Item\.[a-f0-9]{16}$/);
  assert.equal(await provider.verify(spec,ctx),true);
});
test('Actor type creation refuses missing system type declarations',async()=>{
  const f=fixture();delete f.gameInstance.system.documentTypes.Actor;
  const provider=createFoundryActorItemShellProvider({...f,kind:'Actor'});
  await assert.rejects(()=>provider.apply(p('npc','ep:resource:actor_001'),ctx),{code:'NATIVE_TYPE_UNVERIFIED'});
});
test('Unknown native collision is never adopted or overwritten',async()=>{
  const f=fixture(),provider=createFoundryActorItemShellProvider({...f,kind:'Actor'});
  const spec=p('npc','ep:resource:actor_001');const {loc}=await provider.inspect(spec);
  f.maps.Actor.set(loc.nativeId,{id:loc.nativeId,type:'npc',getFlag:()=>null});
  await assert.rejects(()=>provider.apply(spec,ctx),{code:'NATIVE_SHELL_COLLISION'});
});
test('Lost acknowledgement leaves protected pending record and disables automatic replay',async()=>{
  const f=fixture(),provider=createFoundryActorItemShellProvider({...f,kind:'Item'});
  f.gameInstance.items.documentClass.createDocuments=async()=>{throw Error('socket disconnected');};
  const spec=p('loot','ep:resource:item_001');
  await assert.rejects(()=>provider.apply(spec,ctx),{code:'NATIVE_SHELL_RECONCILIATION_REQUIRED'});
  assert.equal((await provider.inspect(spec)).row.state,'prepared');
  await assert.rejects(()=>provider.apply(spec,ctx),{code:'NATIVE_SHELL_RECONCILIATION_REQUIRED'});
});
test('Creation payload rejects unknown fields, secret text, other visibility and non-null revisions',()=>{
  const spec=p('npc','ep:resource:actor_001');
  assert.throws(()=>validateNativeShell({...spec,system:{hp:100}},'Actor'),{code:'NATIVE_SHELL_FIELD'});
  assert.throws(()=>validateNativeShell({...spec,visibility:'public'},'Actor'),{code:'NATIVE_SHELL_POLICY'});
  assert.throws(()=>validateNativeShell({...spec,expectedRevision:1},'Actor'),{code:'NATIVE_SHELL_POLICY'});
});
test('Graph authoring → publication → event → GM approval → Item shell is a journaled operation',async()=>{
  const f=fixture(),providers=new EffectProviderRegistry(),journal=new MemoryOperationJournal();
  providers.register(createFoundryActorItemShellProvider({...f,kind:'Item'}));
  const gmProvider=()=>gm,repository=f.repository;
  const raw=new PersistentGraphRegistry({repository,gmProvider});
  const subscriptions=new ActiveTriggerCatalog({repository,gmProvider});
  const registry=new IndexedGraphRegistry({registry:raw,catalog:subscriptions});
  const ledger=new DurableEventLedger({repository,gmProvider});
  const router=new DurableReactiveRouter({registry,catalog:subscriptions,ledger,gmProvider});
  const editor=new GraphEditorModel({registry});
  const graph=editor.newGraph('A locked item cache'),effect=editor.addNode('core.resource.materialize-item');
  editor.selectNode(effect);editor.updateSelected({payloadJSON:JSON.stringify({...p('loot','ep:resource:relic_001'),sourceGraphId:graph.id})});
  editor.connect(graph.rootNodeId,effect);
  await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
  const eventId='ep:event:item_shell_0001';
  assert.equal((await router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}})).status,'review-required');
  const proposal=(await ledger.get(eventId)).proposals[0];
  assert.equal(proposal.providerId,'narrative.materialize-item-shell');
  const review=new DurableProposalReview({repository,ledger,registry,providers,journal,gmProvider});
  await review.decide(eventId,proposal.operationId,{approve:true});
  assert.equal(f.maps.Item.size,0);
  assert.equal((await review.execute(eventId,proposal.operationId)).status,'completed');
  assert.equal(f.maps.Item.size,1);
  assert.equal((await review.get(eventId,proposal.operationId)).state,'completed');
});
