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
import {ApprovedOperationEventGateway} from '../src/runtime/approved-operation-gateway.mjs';
async function setup({two=false}={}){
 const repository=new MemoryPartitionRepository(),user={id:'gm_afterops001',isGM:true},ctx=createLocalGMContext({user,epoch:'after-ops'},'world'),gmProvider=()=>ctx;
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})}),state=createNarrativeStateProvider({repository,gmProvider});
 const ledger=new DurableEventLedger({repository,gmProvider}),providers=new EffectProviderRegistry();providers.register(state);const journal=new MemoryOperationJournal();
 const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider,stateReader:({scope,key})=>state.get({scope,key,value:null})}),reviews=new DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal});
 const writer={assertEligible:()=>{}},gateway=new ApprovedOperationEventGateway({reviews,router,gmProvider,writer,worldId:'world'});
 const source=new GraphEditorModel({registry});source.newGraph('Approved source');const nodeIds=[];
 for(let i=0;i<(two?2:1);i++){const id=source.addNode('core.effect.proposal');source.updateSelected({providerId:'narrative.set-state',payloadJSON:JSON.stringify({key:i?'second-operation':'first-operation',value:1})});source.connect(source.graph.rootNodeId,id);nodeIds.push(id);}
 await source.save();const published=await source.publish();await source.activate(published.publishedVersion);
 const target=new GraphEditorModel({registry});target.newGraph('Verified follow-up');target.setRootTriggerType('core.trigger.operations-completed');
 target.updateSelected({payloadJSON:JSON.stringify({eventType:'narrative.operations-completed',sourceKinds:['gm-approved-intent'],sourceGraphId:published.id,sourcePublishedVersion:published.publishedVersion,requiredNodeIds:nodeIds})});
 const value=target.addNode('core.state.value');target.updateSelected({payloadJSON:'{"scope":"world","key":"first-operation","valueType":"number","expectedRevision":null}'});
 const followup=target.addNode('core.effect.proposal');target.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"followup-operation","value":null}'});target.bindSelectedInput({field:'value',sourceNodeId:value});target.connect(target.graph.rootNodeId,followup);
 await target.save();const targetGraph=await target.publish();await target.activate(targetGraph.publishedVersion);
 const event={id:'ep:event:afterops_source001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}};await router.ingest(event);const row=await ledger.get(event.id);
 const operations=row.proposals.map(p=>({sourceEventId:event.id,operationId:p.operationId}));
 async function complete(index=0){const p=row.proposals[index];await reviews.decide(event.id,p.operationId,{approve:true});await reviews.execute(event.id,p.operationId);}
 return {repository,user,gmProvider,registry,state,ledger,router,reviews,journal,writer,gateway,event,row,operations,complete,target,source,nodeIds};
}
test('completed-operation continuation starts fresh follow-up proposals after verified execution and preserves separate GM approval',async()=>{
 const s=await setup();await assert.rejects(()=>s.gateway.preview({operations:s.operations}),{code:'OPERATION_NOT_COMPLETED'});
 await s.reviews.decide(s.event.id,s.row.proposals[0].operationId,{approve:true});await assert.rejects(()=>s.gateway.preview({operations:s.operations}),{code:'OPERATION_NOT_COMPLETED'});
 await s.reviews.execute(s.event.id,s.row.proposals[0].operationId);const preview=await s.gateway.preview({operations:s.operations});assert.deepEqual(preview.event.causalParentIds,[s.event.id]);
 assert.equal(await s.ledger.get(preview.event.id),null);await assert.rejects(()=>s.gateway.emit({operations:s.operations}),{code:'OPERATION_CONTINUATION_APPROVAL'});
 await s.state.apply({key:'first-operation',value:2},{operationId:'ep:operation:afterops_current001'});
 const result=await s.gateway.emit({operations:s.operations},{approved:true});assert.equal(result.status,'review-required');
 const entry=await s.ledger.get(result.eventId);assert.equal(entry.proposals.length,1);assert.equal(entry.proposals[0].payload.value,2);assert.equal(entry.event.eventVersion,'1.0.0');
 assert.equal(await s.state.get({key:'followup-operation',value:null}),null);
 await s.reviews.decide(result.eventId,entry.proposals[0].operationId,{approve:true});await s.reviews.execute(result.eventId,entry.proposals[0].operationId);
 assert.equal((await s.state.get({key:'followup-operation',value:null})).value,2);assert.equal((await s.state.get({key:'first-operation',value:null})).value,2);
 assert.equal((await s.gateway.emit({operations:s.operations},{approved:true})).status,'duplicate-or-recovery-required');
});
test('a required set of completed source nodes must be present and input ordering does not duplicate continuation identity',async()=>{
 const s=await setup({two:true});await s.complete(0);await s.complete(1);
 const subset=await s.gateway.emit({operations:[s.operations[0]]},{approved:true});assert.equal(subset.proposals,0);
 const full=await s.gateway.emit({operations:s.operations},{approved:true});assert.equal(full.proposals,1);
 const again=await s.gateway.emit({operations:[...s.operations].reverse()},{approved:true});assert.equal(again.eventId,full.eventId);assert.equal(again.status,'duplicate-or-recovery-required');
});
test('manually claimed completed-operation payload does not satisfy the verified producer capability',async()=>{
 const s=await setup();const result=await s.router.ingest({id:'ep:event:afterops_claim001',eventType:'narrative.operations-completed',source:{kind:'gm-approved-intent',requestId:'ep:request:claimed001'},payload:{verified:true,completions:[{rootGraphId:s.source.graph.id,rootPublishedVersion:s.source.graph.revision,nodeIds:s.nodeIds}]}});
 assert.equal(result.proposals,0);assert.equal(await s.state.get({key:'followup-operation',value:null}),null);
});
test('uncertain or mismatched effect journals cannot establish a completed prerequisite',async()=>{
 const s=await setup();await s.complete();const p=s.row.proposals[0];await s.journal.change(p.idempotencyKey,'completed',{state:'uncertain'});
 await assert.rejects(()=>s.gateway.preview({operations:s.operations}),{code:'OPERATION_NOT_COMPLETED'});
 await s.journal.change(p.idempotencyKey,'uncertain',{state:'completed',payload:{key:'forged-state',value:1}});
 await assert.rejects(()=>s.gateway.preview({operations:s.operations}),{code:'OPERATION_PROVENANCE'});
});
test('historical closed source events remain valid prerequisites without reopening or replaying them',async()=>{
 const s=await setup();await s.complete();await s.ledger.transition(s.event.id,'review-required','closed');
 assert.equal((await s.gateway.emit({operations:s.operations},{approved:true})).status,'review-required');assert.equal((await s.ledger.get(s.event.id)).state,'closed');
});
test('completed-operation publication rejects missing source versions and non-operation node references',async()=>{
 const s=await setup();s.target.selectNode(s.target.graph.rootNodeId);s.target.updateSelected({payloadJSON:JSON.stringify({eventType:'narrative.operations-completed',sourceKinds:['gm-approved-intent'],sourceGraphId:s.source.graph.id,sourcePublishedVersion:99,requiredNodeIds:s.nodeIds})});
 await s.target.save();await assert.rejects(()=>s.target.publish(),{code:'OPERATION_SOURCE_CONTRACT'});
});
test('continuation checks GM authority and current designated writer and rejects duplicate or excessive prerequisites',async()=>{
 const s=await setup();await s.complete();await assert.rejects(()=>s.gateway.preview({operations:[s.operations[0],s.operations[0]]}),{code:'OPERATION_GATEWAY_REFERENCE'});
 await assert.rejects(()=>s.gateway.preview({operations:new Array(9).fill(s.operations[0])}),{code:'OPERATION_GATEWAY_BUDGET'});
 s.writer.assertEligible=()=>{throw Object.assign(Error('changed writer'),{code:'NOT_DESIGNATED_GM'});};await assert.rejects(()=>s.gateway.preview({operations:s.operations}),{code:'NOT_DESIGNATED_GM'});
 s.user.isGM=false;await assert.rejects(()=>s.gateway.preview({operations:s.operations}),{code:'GM_AUTHORITY_REVOKED'});
});
test('continuation freezes selected operation identities before asynchronous proof lookup',async()=>{
 const s=await setup();await s.complete();let release,entered=false;const verified=s.reviews.verifiedCompletion.bind(s.reviews);
 s.reviews.verifiedCompletion=async(...args)=>{entered=true;await new Promise(resolve=>{release=resolve;});return verified(...args);};
 const requested=structuredClone(s.operations),pending=s.gateway.preview({operations:requested});
 while(!entered)await new Promise(resolve=>setImmediate(resolve));requested[0].sourceEventId='ep:event:changed_after001';release();
 assert.deepEqual((await pending).event.causalParentIds,[s.event.id]);
});
