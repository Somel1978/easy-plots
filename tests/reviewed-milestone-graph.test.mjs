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
import {PersistentInvestigationMilestones} from '../src/orchestration/persistent-investigation-milestones.mjs';
import {createReviewedMilestoneProvider} from '../src/runtime/reviewed-milestone-provider.mjs';
const id=s=>`ep:${s}`;
const milestoneId=id('milestone:reviewed001'),invId=id('investigation:harbor001'),clue=id('evidence:manifest001');
const actor=id('actor:hero001');
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true}},'world');
async function setup(){
 const repository=new MemoryPartitionRepository(),journal=new MemoryOperationJournal();
 const domains=new NarrativeDomainStore({repository,gmProvider}),service=new PersistentInvestigationMilestones({domains});
 await domains.save({type:'investigation',scope:'world',id:invId,sourceEventId:id('event:setup001'),
  data:{title:'Manifest',canonicalTruth:'Hidden villain',evidence:[{id:clue,disclosedTo:[actor]}],theories:[]}});
 await service.createContract({milestoneId,investigationId:invId,objectiveId:id('objective:harbor001'),
  kind:'discovery',requiredEvidenceIds:[clue],publicId:id('public:manifest001'),publicTitle:'Found evidence',
  allowedObserverIds:[actor],sourceEventId:id('event:publish001')});
 const providers=new EffectProviderRegistry();providers.register(createReviewedMilestoneProvider({service,gmProvider}));
 const base=new PersistentGraphRegistry({repository,gmProvider}),catalog=new ActiveTriggerCatalog({repository,gmProvider});
 const registry=new IndexedGraphRegistry({registry:base,catalog}),ledger=new DurableEventLedger({repository,gmProvider});
 const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 const editor=new GraphEditorModel({registry});const graph=editor.newGraph('Milestone qualification');
 const nodeId=editor.addNode('core.milestone.complete-reviewed');editor.connect(graph.rootNodeId,nodeId);
 editor.updateSelected({payloadJSON:JSON.stringify({scope:'world',milestoneId,expectedContractRevision:1,expectedProgressRevision:1})});
 await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
 const reviews=new DurableProposalReview({repository,ledger,registry,providers,journal,gmProvider});
 return {service,editor,router,ledger,reviews,journal};
}
test('reviewed milestone node completes only after canonical evidence and GM effect approval',async()=>{
 const {service,router,ledger,reviews,journal}=await setup();
 await service.recordEvidence({milestoneId,actorId:actor,evidenceId:clue,sourceEventId:id('event:discovery001'),expectedRevision:null});
 const event=id('event:milestone001');assert.equal((await router.ingest({id:event,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}})).status,'review-required');
 const proposal=(await ledger.get(event)).proposals[0];assert.equal(proposal.providerId,'narrative.complete-investigation-milestone');
 assert.equal((await service.assess({milestoneId})).completed,false);
 await reviews.decide(event,proposal.operationId,{approve:true});
 assert.equal((await reviews.execute(event,proposal.operationId)).status,'completed');
 assert.equal((await service.assess({milestoneId})).completed,true);
 assert.equal((await journal.get(proposal.idempotencyKey)).state,'completed');
 assert.deepEqual(await service.project({observerId:id('actor:outsider001'),milestoneIds:[milestoneId]}),{milestones:[]});
});
test('graph publisher rejects invalid reviewed milestone revisions and privileged injected fields',async()=>{
 const {editor}=await setup();editor.updateSelected({payloadJSON:JSON.stringify({scope:'world',milestoneId,expectedContractRevision:1,expectedProgressRevision:1,canonicalTruth:'hidden'})});
 await assert.rejects(editor.save(),{code:'MILESTONE_PAYLOAD'});
});
