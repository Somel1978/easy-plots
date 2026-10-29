import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {GMInvestigationWorkbench} from '../src/orchestration/investigation-workbench.mjs';
import {createReviewedHypothesisProvider} from '../src/runtime/reviewed-hypothesis-provider.mjs';
const id=s=>`ep:${s}`;
test('reviewed theory node follows publication, canonical event, GM approval, journal and player-safe projection',async()=>{
 const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true}},'world');
 const repository=new MemoryPartitionRepository(),journal=new MemoryOperationJournal();
 const domains=new NarrativeDomainStore({repository,gmProvider});
 const investigations=new GMInvestigationWorkbench({domains});
 const invId=id('investigation:test_001'),clueId=id('evidence:private_001'),viewer=id('actor:alice_001');
 await domains.save({type:'investigation',scope:'world',id:invId,sourceEventId:id('event:setup_001'),
  data:{title:'Mystery',evidence:[{id:clueId,publicId:id('public:clue_001'),title:'Secret',publicTitle:'Clue',disclosedTo:[viewer]}],
   theories:[],opportunities:[],canonicalTruth:'Marrek'}});
 const providers=new EffectProviderRegistry();providers.register(createReviewedHypothesisProvider({workbench:investigations,gmProvider}));
 const base=new PersistentGraphRegistry({repository,gmProvider}),catalog=new ActiveTriggerCatalog({repository,gmProvider});
 const registry=new IndexedGraphRegistry({registry:base,catalog});
 const ledger=new DurableEventLedger({repository,gmProvider});
 const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 const editor=new GraphEditorModel({registry});const g=editor.newGraph('Investigate the manifest');
 const node=editor.addNode('core.investigation.reviewed-hypothesis');
 editor.connect(g.rootNodeId,node);
 const hypothesisId=id('hypothesis:reviewed_001');
 const payload={scope:'world',investigationId:invId,hypothesisId,observerId:viewer,
  expectedRevision:1,title:'Smugglers moved cargo',reasoning:'Manifest has unusual destination',
  arguments:[{evidenceId:clueId,direction:'support'}],shareWith:[]};
 editor.updateSelected({payloadJSON:JSON.stringify(payload)});
 await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
 const eventId=id('event:review_theory_001');
 assert.equal((await router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}})).status,'review-required');
 const proposal=(await ledger.get(eventId)).proposals[0];assert.equal(proposal.providerId,'narrative.review-investigation-hypothesis');
 const reviews=new DurableProposalReview({repository,ledger,registry,providers,journal,gmProvider});
 await reviews.decide(eventId,proposal.operationId,{approve:true});
 assert.equal((await investigations.read({investigationId:invId})).data.theories.length,0);
 const result=await reviews.execute(eventId,proposal.operationId);assert.equal(result.status,'completed');
 const board=await investigations.boardForObserver({investigationId:invId,observerId:viewer});
 assert.deepEqual(board.theories[0].supportEvidenceIds,[id('public:clue_001')]);
 assert.equal(JSON.stringify(board).includes('Marrek'),false);
 assert.equal((await journal.get(proposal.idempotencyKey)).state,'completed');
});
test('hypothesis node rejects hidden answer-oracle fields at publication',async()=>{
 const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true}},'world');
 const repo=new MemoryPartitionRepository(),base=new PersistentGraphRegistry({repository:repo,gmProvider});
 const registry=new IndexedGraphRegistry({registry:base,catalog:new ActiveTriggerCatalog({repository:repo,gmProvider})});
 const editor=new GraphEditorModel({registry});const g=editor.newGraph('Hidden truth trap');const node=editor.addNode('core.investigation.reviewed-hypothesis');
 editor.connect(g.rootNodeId,node);
 const data=editor.selectedNode.data.payload;editor.updateSelected({payloadJSON:JSON.stringify({...data,canonicalTruth:'secret'})});
 await assert.rejects(editor.save(),{code:'HYPOTHESIS_PAYLOAD'});
});
