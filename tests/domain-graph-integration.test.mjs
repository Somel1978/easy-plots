import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {createFactionStandingProvider,createObligationProvider,createEvidenceAttestationProvider} from '../src/runtime/domain-providers.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
const actor='ep:actor:hero_001',faction='ep:faction:harpers_001';
function build(){
  const repository=new MemoryPartitionRepository(),gm=createLocalGMContext({user:{id:'gm',isGM:true}},'world');
  const gmProvider=()=>gm;const base=new PersistentGraphRegistry({repository,gmProvider});
  const catalog=new ActiveTriggerCatalog({repository,gmProvider});const registry=new IndexedGraphRegistry({registry:base,catalog});
  const ledger=new DurableEventLedger({repository,gmProvider});const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
  const providers=new EffectProviderRegistry();
  const standing=createFactionStandingProvider({repository,gmProvider});providers.register(standing);
  providers.register(createObligationProvider({repository,gmProvider}));
  providers.register(createEvidenceAttestationProvider({repository,gmProvider}));
  const reviews=new DurableProposalReview({repository,ledger,registry,providers,journal:new MemoryOperationJournal(),gmProvider});
  const editor=new GraphEditorModel({registry});return {editor,registry,ledger,router,reviews,standing};
}
test('typed faction node authors, publishes, proposes and executes only after GM approval',async()=>{
  const s=build();const graph=s.editor.newGraph('Faction reputation');const id=s.editor.addNode('core.faction.standing');
  s.editor.updateSelected({payloadJSON:JSON.stringify({factionId:faction,actorId:actor,dimension:'reputation',delta:4})});
  s.editor.connect(graph.rootNodeId,id);await s.editor.save();const published=await s.editor.publish();
  await s.editor.activate(published.publishedVersion);
  const eventId='ep:event:faction_demo_001';
  assert.equal((await s.router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}})).status,'review-required');
  const [p]=(await s.ledger.get(eventId)).proposals;
  assert.equal(p.providerId,'narrative.change-faction-standing');
  assert.equal(await s.standing.get(p.payload),null);
  await s.reviews.decide(eventId,p.operationId,{approve:true});
  assert.equal((await s.reviews.execute(eventId,p.operationId)).status,'completed');
  assert.equal((await s.standing.get(p.payload)).value,4);
});
test('other domain node types compile to exact registered effect IDs',async()=>{
  for(const [nodeType,providerId] of [
    ['core.obligation.resolve','narrative.resolve-obligation'],
    ['core.investigation.attest-evidence','narrative.attest-evidence']]){
    const s=build(),g=s.editor.newGraph('A full plot'),id=s.editor.addNode(nodeType);
    s.editor.connect(g.rootNodeId,id);await s.editor.save();const publication=await s.editor.publish();await s.editor.activate(publication.publishedVersion);
    const eventId=`ep:event:${nodeType.replaceAll('.','_')}_01`;
    await s.router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}});
    assert.equal((await s.ledger.get(eventId)).proposals[0].providerId,providerId);
  }
});
test('editor refuses non-JSON typed node content',()=>{
  const s=build();s.editor.newGraph('Typed graph');s.editor.addNode('core.obligation.resolve');
  assert.throws(()=>s.editor.updateSelected({payloadJSON:'{bad'}),{code:'INVALID_EFFECT'});
});
