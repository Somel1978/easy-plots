import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {NarrativeDomainStore,domainRevisionLocator} from '../src/domains/domain-store.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {createDomainCorrectionProvider} from '../src/runtime/domain-correction-provider.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
async function suite(){
 const repository=new MemoryPartitionRepository(),user={id:'gm_correction001',isGM:true},ctx=createLocalGMContext({user,epoch:'correction'},'world'),gmProvider=()=>ctx;
 const domains=new NarrativeDomainStore({repository,gmProvider}),id='ep:objective:correction001';
 await domains.save({type:'objective',scope:'world',id,data:{state:'active',title:'Original objective'},sourceEventId:'ep:event:correct_original001'});
 await domains.save({type:'objective',scope:'world',id,data:{state:'completed',title:'Mistaken conclusion'},expectedRevision:1,sourceEventId:'ep:event:correct_wrong001'});
 const provider=createDomainCorrectionProvider({domains,gmProvider}),providers=new EffectProviderRegistry();providers.register(provider);
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})});
 const ledger=new DurableEventLedger({repository,gmProvider}),journal=new MemoryOperationJournal(),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 const review=new DurableProposalReview({repository,registry,ledger,providers,journal,gmProvider});
 const payload={type:'objective',scope:'world',id,expectedRevision:2,targetRevision:1,reason:'The reported completion was mistaken'};
 const model=new GraphEditorModel({registry});model.newGraph('Controlled correction');const node=model.addNode('core.effect.proposal');
 model.updateSelected({providerId:provider.id,payloadJSON:JSON.stringify(payload)});model.connect(model.graph.rootNodeId,node);
 await model.save();const p=await model.publish();await model.activate(p.publishedVersion);
 const eventId='ep:event:correct_review001';await router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}});
 const proposal=(await ledger.get(eventId)).proposals[0];
 return {repository,user,domains,id,provider,payload,review,journal,eventId,proposal};
}
test('ADR-007: a reviewed graph correction restores narrative state while retaining both original events and revisions',async()=>{
 const s=await suite();assert.equal((await s.domains.read('objective','world',s.id)).revision,2);
 await assert.rejects(s.review.execute(s.eventId,s.proposal.operationId),{code:'APPROVAL_REQUIRED'});
 await s.review.decide(s.eventId,s.proposal.operationId,{approve:true});assert.equal((await s.review.execute(s.eventId,s.proposal.operationId)).status,'completed');
 const current=await s.domains.read('objective','world',s.id);assert.equal(current.revision,3);assert.equal(current.data.state,'active');assert.equal(current.sourceEventId,s.eventId);
 assert.equal(current.correctionReceipt.targetSourceEventId,'ep:event:correct_original001');
 assert.equal((await s.domains.readRevision('objective','world',s.id,2)).sourceEventId,'ep:event:correct_wrong001');
 assert.equal((await s.domains.readRevision('objective','world',s.id,1)).data.state,'active');
});
test('correction preview is read-only and its payload cannot select native resource types or arbitrary storage',async()=>{
 const s=await suite(),preview=await s.domains.previewCorrection(s.payload);assert.equal(preview.committed,false);assert.equal(preview.candidate.state,'active');
 assert.equal((await s.domains.read('objective','world',s.id)).revision,2);
 assert.throws(()=>s.provider.validate({...s.payload,type:'resource-manifest'}),{code:'CORRECTION_TYPE'});
 assert.throws(()=>s.provider.validate({...s.payload,partitionId:'arbitrary'}),{code:'CORRECTION_CONTRACT'});
});
test('state changes after correction approval prevent historical overwrite',async()=>{
 const s=await suite();await s.review.decide(s.eventId,s.proposal.operationId,{approve:true});
 await s.domains.save({type:'objective',scope:'world',id:s.id,data:{state:'failed'},expectedRevision:2,sourceEventId:'ep:event:correct_newer001'});
 assert.equal((await s.review.execute(s.eventId,s.proposal.operationId)).status,'uncertain');
 assert.equal((await s.domains.read('objective','world',s.id)).data.state,'failed');
});
test('corrupt historical data and original-event reuse cannot authorize a correction',async()=>{
 const s=await suite();await assert.rejects(s.provider.apply(s.payload,{operationId:'ep:operation:correct_reuse001',sourceEventId:'ep:event:correct_original001'}),{code:'CORRECTION_PROVENANCE'});
 const loc=await domainRevisionLocator('objective','world',s.id,1),old=await s.repository.read(loc.id,{partitionId:loc.partitionId});
 old.snapshot.data.state='injected';await s.repository.put(old,{expectedRevision:old.revision});
 await assert.rejects(s.domains.previewCorrection(s.payload),{code:'DOMAIN_HISTORY_CORRUPT'});
 assert.equal((await s.domains.read('objective','world',s.id)).revision,2);
});
test('corrective operation identities are idempotent and cannot be reused for a different reason',async()=>{
 const s=await suite(),ctx={operationId:'ep:operation:correct_once001',sourceEventId:s.eventId};
 await s.provider.apply(s.payload,ctx);assert.equal((await s.provider.apply(s.payload,ctx)).alreadyApplied,true);
 assert.equal((await s.domains.read('objective','world',s.id)).revision,3);
 await assert.rejects(s.provider.apply({...s.payload,reason:'Different rationale'},ctx),{code:'OPERATION_CONFLICT'});
});
test('correction history and execution remain inaccessible after GM authority is revoked',async()=>{
 const s=await suite();s.user.isGM=false;
 await assert.rejects(s.domains.previewCorrection(s.payload),{code:'GM_AUTHORITY_REVOKED'});
 await assert.rejects(s.provider.apply(s.payload,{operationId:'ep:operation:correct_denied001',sourceEventId:s.eventId}),{code:'GM_AUTHORITY_REVOKED'});
});
