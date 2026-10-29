import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {createNarrativeStateProvider,stateLocator} from '../src/runtime/native-state-provider.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {graph} from './fixtures.mjs';
const eventId='ep:event:approval_trial_01';
const event={id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture',testId:'review'},payload:{verified:true}};
function suite(){
  const repo=new MemoryPartitionRepository();
  let user={id:'GM_1',isGM:true};
  let ctx=createLocalGMContext({user,epoch:'review'},'world');
  const gmProvider=()=>ctx;
  const base=new PersistentGraphRegistry({repository:repo,gmProvider});
  const catalog=new ActiveTriggerCatalog({repository:repo,gmProvider});
  const registry=new IndexedGraphRegistry({registry:base,catalog});
  const ledger=new DurableEventLedger({repository:repo,gmProvider});
  const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
  const providers=new EffectProviderRegistry();
  const provider=createNarrativeStateProvider({repository:repo,gmProvider});
  providers.register(provider);
  const journal=new MemoryOperationJournal();
  const review=new DurableProposalReview({repository:repo,ledger,registry,providers,journal,gmProvider});
  const changeGM=()=>{user.isGM=false;user={id:'GM_successor',isGM:true};ctx=createLocalGMContext({user,epoch:'successor'},'world');return ctx;};
  return {repo,get ctx(){return ctx;},user,registry,ledger,router,providers,provider,journal,review,changeGM};
}
async function ready(s){
  const g=graph();const draft=await s.registry.saveDraft(g);await s.registry.publish(g.id,{expectedRevision:draft.revision});
  await s.registry.activate(g.id,1,{expectedActivationRevision:null});
  assert.equal((await s.router.ingest(event)).status,'review-required');
  const persisted=await s.ledger.get(eventId);
  return persisted.proposals[0];
}
test('registry rejects duplicate provider names and malformed providers',()=>{
  const s=suite();assert.throws(()=>s.providers.register({id:'narrative.set-state'}),{code:'INVALID_PROVIDER'});
  assert.throws(()=>s.providers.register(s.provider),{code:'DUPLICATE_PROVIDER'});
});
test('narrative state provider writes bounded persistent record with causal identity',async()=>{
  const s=suite();const payload={scope:'world',key:'clue.discovered',value:{found:true}};
  const first=await s.provider.apply(payload,{operationId:'ep:operation:state_test_01'});
  assert.match(first.stateId,/^ep:state:/);
  assert.equal((await s.provider.verify(payload,{operationId:'ep:operation:state_test_01'})),true);
  assert.equal((await s.provider.verify(payload,{operationId:'ep:operation:wrong_002'})),false);
  assert.equal((await s.provider.apply(payload,{operationId:'ep:operation:state_test_01'})).alreadyApplied,true);
  assert.equal((await s.provider.get(payload)).value.found,true);
  assert.equal((await stateLocator(payload)).id,first.stateId);
});
test('state effect payload validation prevents oversized and privileged arbitrary property values',async()=>{
  const s=suite();
  assert.throws(()=>s.provider.validate({key:'__proto__',value:42}),{code:'INVALID_EFFECT'});
  assert.throws(()=>s.provider.validate({key:'clue.discovered',value:'a'.repeat(25000)}),{code:'EFFECT_BUDGET'});
  assert.throws(()=>s.provider.validate({key:'a'}),{code:'INVALID_EFFECT'});
  await assert.rejects(s.provider.apply({key:'good',value:1},{operationId:'user-supplied'}),{code:'OPERATION_ID_REQUIRED'});
});
test('effect cannot execute without durable explicit approval',async()=>{
  const s=suite();const proposal=await ready(s);
  await assert.rejects(s.review.execute(eventId,proposal.operationId),{code:'APPROVAL_REQUIRED'});
  assert.equal(await s.provider.get(proposal.payload),null);
});
test('approval transitions to one-time execution, verification and persisted review',async()=>{
  const s=suite();const p=await ready(s);
  const a=await s.review.decide(eventId,p.operationId,{approve:true,reason:'Verified by GM'});
  assert.equal(a.state,'approved');
  assert.equal((await s.review.decide(eventId,p.operationId,{approve:true})).state,'approved');
  const result=await s.review.execute(eventId,p.operationId);
  assert.equal(result.status,'completed');
  assert.equal((await s.provider.get(p.payload)).value,true);
  assert.equal((await s.journal.get(p.idempotencyKey)).state,'completed');
  assert.equal((await s.review.get(eventId,p.operationId)).state,'completed');
  await assert.rejects(s.review.execute(eventId,p.operationId),{code:'APPROVAL_REQUIRED'});
});
test('GM rejection never writes narrative state or operation journal',async()=>{
  const s=suite();const p=await ready(s);
  const row=await s.review.decide(eventId,p.operationId,{approve:false,reason:'Not approved'});
  assert.equal(row.state,'rejected');
  await assert.rejects(s.review.execute(eventId,p.operationId),{code:'APPROVAL_REQUIRED'});
  assert.equal(await s.provider.get(p.payload),null);
  assert.equal(await s.journal.get(p.idempotencyKey),null);
});
test('stale published revision forbids approval and execution',async()=>{
  const s=suite();const p=await ready(s);
  const old=await s.registry.getActivation(graph().id);
  await s.registry.deactivate(graph().id,{expectedActivationRevision:old.revision});
  await assert.rejects(s.review.decide(eventId,p.operationId,{approve:true}),{code:'PUBLISHED_REVISION_STALE'});
});
test('stale activation after approval cannot execute an approved effect',async()=>{
  const s=suite();const p=await ready(s);
  await s.review.decide(eventId,p.operationId,{approve:true});
  await s.registry.deactivate(graph().id,{expectedActivationRevision:1});
  await assert.rejects(s.review.execute(eventId,p.operationId),{code:'PUBLISHED_REVISION_STALE'});
  assert.equal(await s.provider.get(p.payload),null);
});
test('effect apply acknowledgment uncertainty leaves review and journal requiring recovery',async()=>{
  const s=suite();const p=await ready(s);
  const applying=s.provider.apply;
  let calls=0;
  const faulty={...s.provider,apply:async(payload,ctx)=>{calls++;await applying(payload,ctx);throw Error('ack disappeared');}};
  const mapped=new EffectProviderRegistry();mapped.register(faulty);
  const review=new DurableProposalReview({repository:s.repo,ledger:s.ledger,registry:s.registry,providers:mapped,journal:s.journal,gmProvider:()=>s.ctx});
  await review.decide(eventId,p.operationId,{approve:true});
  const result=await review.execute(eventId,p.operationId);
  assert.equal(result.status,'uncertain');
  assert.equal(calls,1);
  assert.equal((await review.inspectRecovery(eventId,p.operationId)).next,'manual-effect-verification-required');
  await assert.rejects(review.execute(eventId,p.operationId),{code:'APPROVAL_REQUIRED'});
  assert.equal(await s.provider.verify(p.payload,{operationId:p.operationId}),true,'State written despite lost acknowledgment');
});
test('forged proposal identity rejected; no direct effect access',async()=>{
  const s=suite();await ready(s);
  await assert.rejects(s.review.decide(eventId,'ep:operation:unknown_001',{approve:true}),{code:'PROPOSAL_NOT_FOUND'});
  await assert.rejects(s.review.get('not-event','ep:operation:unknown_001'),{code:'INVALID_EVENT'});
});
test('GM authority revocation prevents review and execution',async()=>{
  const s=suite();const p=await ready(s);
  s.user.isGM=false;
  await assert.rejects(s.review.decide(eventId,p.operationId,{approve:true}),{code:'GM_AUTHORITY_REVOKED'});
  assert.equal(await s.provider.get(p.payload).catch(e=>e.code),'GM_AUTHORITY_REVOKED');
});
test('review persists over service recreation (same repository)',async()=>{
  const s=suite();const p=await ready(s);
  await s.review.decide(eventId,p.operationId,{approve:true});
  const next=new DurableProposalReview({repository:s.repo,ledger:s.ledger,registry:s.registry,
    providers:s.providers,journal:s.journal,gmProvider:()=>s.ctx});
  assert.equal((await next.get(eventId,p.operationId)).state,'approved');
  assert.equal((await next.execute(eventId,p.operationId)).status,'completed');
});
async function uncertain(s,{verify}={}){
  const p=await ready(s),providers=new EffectProviderRegistry();let calls=0,verifications=0;
  providers.register({...s.provider,apply:async(payload,ctx)=>{calls++;await s.provider.apply(payload,ctx);throw Error('lost acknowledgement');},verify:async(...args)=>{verifications++;return verify?verify(...args):s.provider.verify(...args);}});
  const review=new DurableProposalReview({repository:s.repo,ledger:s.ledger,registry:s.registry,providers,journal:s.journal,gmProvider:()=>s.ctx});
  await review.decide(eventId,p.operationId,{approve:true});assert.equal((await review.execute(eventId,p.operationId)).status,'uncertain');
  return {p,review,get calls(){return calls;},get verifications(){return verifications;}};
}
test('ADR-065: successor GM explicitly reconciles verified original effect without applying or evaluating it again',async()=>{
  const s=suite(),u=await uncertain(s);s.changeGM();
  await s.registry.deactivate(graph().id,{expectedActivationRevision:1});
  await assert.rejects(u.review.reconcile(eventId,u.p.operationId),{code:'APPROVAL_REQUIRED'});
  const done=await u.review.reconcile(eventId,u.p.operationId,{approved:true});assert.equal(done.status,'completed');assert.equal(done.record.approvedBy,'GM_1');assert.equal(done.record.reconciledBy,'GM_successor');
  assert.equal(u.calls,1);assert.equal(u.verifications,1);assert.equal((await s.journal.get(u.p.idempotencyKey)).reconciliation.originalApprovedBy,'GM_1');
  assert.equal((await u.review.verifiedCompletion(eventId,u.p.operationId)).operationId,u.p.operationId);
  assert.equal((await u.review.reconcile(eventId,u.p.operationId,{approved:true})).status,'completed');assert.equal(u.verifications,1);
});
test('reconciliation refuses unverifiable outcomes and never retries an effect',async()=>{
  const s=suite(),u=await uncertain(s,{verify:async()=>false});
  await assert.rejects(u.review.reconcile(eventId,u.p.operationId,{approved:true}),{code:'VERIFICATION_UNCONFIRMED'});
  assert.equal((await u.review.get(eventId,u.p.operationId)).state,'uncertain');assert.equal((await s.journal.get(u.p.idempotencyKey)).state,'uncertain');assert.equal(u.calls,1);
});
test('reconciliation verifies every persisted proposal field before trusting a journal',async()=>{
  const s=suite(),u=await uncertain(s);await s.journal.change(u.p.idempotencyKey,'uncertain',{payload:{...u.p.payload,value:'forged'}});
  await assert.rejects(u.review.reconcile(eventId,u.p.operationId,{approved:true}),{code:'OPERATION_PROVENANCE'});assert.equal(u.verifications,0);assert.equal(u.calls,1);
});
test('reconciliation resumes journal-completed/review-uncertain interruption without repeating verification or effects',async()=>{
  const s=suite(),u=await uncertain(s),put=s.repo.put.bind(s.repo);let fail=true;
  s.repo.put=async(row,options)=>{if(fail&&row.kind==='proposal-review'&&row.state==='completed'){fail=false;throw Error('review write interrupted');}return put(row,options);};
  await assert.rejects(u.review.reconcile(eventId,u.p.operationId,{approved:true}),/interrupted/);assert.equal((await s.journal.get(u.p.idempotencyKey)).state,'completed');assert.equal((await u.review.get(eventId,u.p.operationId)).state,'uncertain');
  s.changeGM();assert.equal((await u.review.reconcile(eventId,u.p.operationId,{approved:true})).status,'completed');assert.equal(u.calls,1);assert.equal(u.verifications,1);
});
test('revocation during an asynchronous verifier cannot persist a completed reconciliation',async()=>{
  const s=suite(),u=await uncertain(s,{verify:async()=>{s.user.isGM=false;return true;}});
  await assert.rejects(u.review.reconcile(eventId,u.p.operationId,{approved:true}),{code:'GM_AUTHORITY_REVOKED'});assert.equal((await s.journal.get(u.p.idempotencyKey)).state,'uncertain');assert.equal(u.calls,1);
});
test('approved proposals and missing or merely prepared journals cannot be marked completed by reconciliation',async()=>{
  const s=suite(),p=await ready(s);await s.review.decide(eventId,p.operationId,{approve:true});
  await assert.rejects(s.review.reconcile(eventId,p.operationId,{approved:true}),{code:'RECONCILIATION_REQUIRED'});
  const row=await s.review.get(eventId,p.operationId);await s.repo.put({...row,state:'executing'},{expectedRevision:row.revision});
  await assert.rejects(s.review.reconcile(eventId,p.operationId,{approved:true}),{code:'OPERATION_NOT_COMPLETED'});
  await s.journal.createOnce(p.idempotencyKey,{...p,state:'prepared'});await assert.rejects(s.review.reconcile(eventId,p.operationId,{approved:true}),{code:'RECONCILIATION_REQUIRED'});
  assert.equal(await s.provider.get(p.payload),null);
});
test('successor explicitly adopts an unexecuted approval, preserves the original approver and executes only after a separate action',async()=>{
 const s=suite(),p=await ready(s);await s.review.decide(eventId,p.operationId,{approve:true,reason:'Initial GM approval'});s.changeGM();await assert.rejects(s.review.execute(eventId,p.operationId),{code:'APPROVER_CHANGED'});
 const old=await s.review.get(eventId,p.operationId),reason='The successor reviewed the unchanged operation';const adopted=await s.review.adoptApproval(eventId,p.operationId,{approved:true,expectedRevision:old.revision,reason});assert.equal(adopted.state,'approved');assert.equal(adopted.approvedBy,'GM_successor');assert.deepEqual(adopted.approvalHistory,[{approvedBy:'GM_1',reason:'Initial GM approval',revision:old.revision}]);
 assert.equal(await s.journal.get(p.idempotencyKey),null);assert.equal(await s.provider.get(p.payload),null);assert.equal((await s.ledger.get(eventId)).evaluations.length,1);assert.equal((await s.review.adoptApproval(eventId,p.operationId,{approved:true,expectedRevision:adopted.revision,reason})).revision,adopted.revision);
 assert.equal((await s.review.execute(eventId,p.operationId)).status,'completed');assert.equal((await s.provider.get(p.payload)).value,true);
});
test('approval adoption requires explicit review, a fresh revision and a genuinely different approver',async()=>{
 const s=suite(),p=await ready(s);await assert.rejects(s.review.adoptApproval(eventId,p.operationId,{approved:true,expectedRevision:1,reason:'No approval exists'}),{code:'APPROVAL_ADOPTION_STATE'});await s.review.decide(eventId,p.operationId,{approve:true});const row=await s.review.get(eventId,p.operationId);
 await assert.rejects(s.review.adoptApproval(eventId,p.operationId,{approved:true,expectedRevision:row.revision,reason:'Already the approver'}),{code:'APPROVAL_ALREADY_OWNED'});s.changeGM();await assert.rejects(s.review.adoptApproval(eventId,p.operationId,{expectedRevision:row.revision,reason:'Missing explicit approval'}),{code:'APPROVAL_ADOPTION_REVIEW'});await assert.rejects(s.review.adoptApproval(eventId,p.operationId,{approved:true,expectedRevision:99,reason:'Stale revision'}),{code:'REVISION_CONFLICT'});assert.equal((await s.review.get(eventId,p.operationId)).approvedBy,'GM_1');
});
for(const state of ['prepared','uncertain'])test(`approval transfer refuses an existing ${state} journal even when its review still says approved`,async()=>{
 const s=suite(),p=await ready(s);await s.review.decide(eventId,p.operationId,{approve:true});await s.journal.createOnce(p.idempotencyKey,{...p,state});s.changeGM();const row=await s.review.get(eventId,p.operationId);await assert.rejects(s.review.adoptApproval(eventId,p.operationId,{approved:true,expectedRevision:row.revision,reason:'Do not repeat an existing attempt'}),{code:'APPROVAL_ADOPTION_JOURNAL'});assert.equal((await s.review.get(eventId,p.operationId)).approvedBy,'GM_1');assert.equal(await s.provider.get(p.payload),null);
});
test('a pending native journal index is not absence proof for approval transfer',async()=>{
 const s=suite(),p=await ready(s);await s.review.decide(eventId,p.operationId,{approve:true});s.journal.hasRecordOrIndex=async()=>true;s.changeGM();const row=await s.review.get(eventId,p.operationId);assert.equal(await s.journal.get(p.idempotencyKey),null);await assert.rejects(s.review.adoptApproval(eventId,p.operationId,{approved:true,expectedRevision:row.revision,reason:'Prepared index needs reconciliation'}),{code:'APPROVAL_ADOPTION_JOURNAL'});
});
test('an uncertain review cannot be transferred as an unexecuted approval',async()=>{
 const s=suite(),u=await uncertain(s);s.changeGM();const row=await u.review.get(eventId,u.p.operationId);await assert.rejects(u.review.adoptApproval(eventId,u.p.operationId,{approved:true,expectedRevision:row.revision,reason:'Use outcome reconciliation instead'}),{code:'APPROVAL_ADOPTION_STATE'});assert.equal(u.calls,1);assert.equal(row.state,'uncertain');
});
test('approval transfer revalidates publication and authority before changing the approving GM',async()=>{
 const s=suite(),p=await ready(s);await s.review.decide(eventId,p.operationId,{approve:true});s.changeGM();const row=await s.review.get(eventId,p.operationId);await s.registry.deactivate(graph().id,{expectedActivationRevision:1});await assert.rejects(s.review.adoptApproval(eventId,p.operationId,{approved:true,expectedRevision:row.revision,reason:'Inactive source cannot transfer'}),{code:'PUBLISHED_REVISION_STALE'});
 const t=suite(),q=await ready(t);await t.review.decide(eventId,q.operationId,{approve:true});t.changeGM();const current=await t.review.get(eventId,q.operationId),get=t.journal.get.bind(t.journal);t.journal.get=async key=>{const result=await get(key);t.ctx.session.user.isGM=false;return result;};await assert.rejects(t.review.adoptApproval(eventId,q.operationId,{approved:true,expectedRevision:current.revision,reason:'Authority is revoked while inspecting journal'}),{code:'GM_AUTHORITY_REVOKED'});
});
