import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentKnowledgeLedger} from '../src/orchestration/persistent-knowledge.mjs';
import {KnowledgePublications} from '../src/orchestration/knowledge-publications.mjs';
import {ProtectedNativePublications,createProtectedPublicationProvider} from '../src/platform/protected-native-publications.mjs';
import {openPublication} from '../src/security/publication-envelope.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {EffectCoordinator} from '../src/runtime/effects.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {NativeEffectJournal} from '../src/storage/native-intents.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {preparePublicationHandlerDraft} from '../src/orchestration/publication-handler.mjs';
import {FoundryD20RollCoordinator} from '../src/platform/foundry-rolls.mjs';
import {FoundryOpposedRollCoordinator} from '../src/platform/foundry-opposed-rolls.mjs';
const observerId='ep:actor:recipient_publication001',claimId='ep:claim:private_source_publication001',publicationId='ep:publication:known_report001';
function nativeCollection(kind,fault){
 const docs=new Map(),writes=[];const collection={get:id=>docs.get(id),documents:docs,writes,documentClass:{async createDocuments(data,options){
  assert.equal(options.keepId,true);writes.push(structuredClone(data));const result=data.map(raw=>{assert.equal(docs.has(raw._id),false);const source=structuredClone(raw),doc={id:raw._id,documentName:kind,toObject:()=>structuredClone(source),getFlag:(module,key)=>structuredClone(source.flags?.[module]?.[key]),source};docs.set(doc.id,doc);return doc;});
  if(fault.lostAck)throw Error('Native acknowledgement lost');return result;
 }}};return collection;
}
async function setup(nativeKind='ChatMessage'){
 const repository=new MemoryPartitionRepository(),gm={id:'GMPrivateNative1',isGM:true,active:true},player={id:'PlayerRecipient1',isGM:false,active:true},other={id:'OtherRecipient01',isGM:false,active:true},users=new Map([[gm.id,gm],[player.id,player],[other.id,other]]),fault={lostAck:false},access={allowed:true};
 let current=createLocalGMContext({user:gm,epoch:'publication'},'world');const gmProvider=()=>current,writer={assertEligible:ctx=>{if(ctx.userId!==current.userId)throw Object.assign(Error('GM changed'),{code:'NOT_DESIGNATED_GM'});}};
 const game={user:gm,world:{id:'world'},users:{get:id=>users.get(id),get activeGM(){return game.user;}},messages:nativeCollection('ChatMessage',fault),journal:nativeCollection('JournalEntry',fault)};
 const domains=new NarrativeDomainStore({repository,gmProvider}),knowledge=new PersistentKnowledgeLedger({domains,worldTimeProvider:()=>5});
 await knowledge.createClaim({claimId,publicId:'ep:claim-public:known_report001',publicText:'PRIVATE-KNOWN-REPORT-FOR-ONE-OBSERVER',canonicalTruth:'GM-ONLY-CANONICAL-TRUTH',sourceEventId:'ep:event:publication_claim001'});
 const receipt=await knowledge.recordDisclosure({claimId,observerId,sourceId:'ep:npc:private_informant001',sourceEventId:'ep:event:publication_disclosure001',stance:'believed'});
 const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({registry:new PersistentGraphRegistry({repository,gmProvider}),catalog}),ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 class RollFixture{static calls=0;constructor(formula,data){this.total=12+data.modifier;}async evaluate(){RollFixture.calls++;return this;}}
 const rolls=new FoundryD20RollCoordinator({repository,gmProvider,RollClass:RollFixture,authorizeActor:async()=>true}),opposedRolls=new FoundryOpposedRollCoordinator({repository,gmProvider,RollClass:RollFixture,authorizeActor:async()=>true});
 const plans=new KnowledgePublications({domains,knowledgeLedger:knowledge,gmProvider,writer,router,ledger,worldId:'world',readRoll:(kind,id)=>(kind==='d20'?rolls:opposedRolls).get(id)});
 const actorAuthorization=async(user,actor)=>access.allowed&&actor==='NativeActorKnown1'&&[player.id,other.id].includes(user),resolveObserver=async({verifiedUserId})=>verifiedUserId===player.id?observerId:'ep:actor:other_observer001';
 const compose=()=>new ProtectedNativePublications({domains,plans,gmProvider,writer,gameInstance:game,actorAuthorization,resolveObserver}),service=compose();
 const draft=await plans.prepare({id:publicationId,observerId,nativeKind,title:'PRIVATE-RECIPIENT-TITLE',receiptIds:[receipt.id],worldTime:10,sourceEventId:'ep:event:publication_prepare001'}),approved=await plans.approve({id:publicationId,expectedRevision:draft.revision,reviewEventId:'ep:event:publication_review001'});
 const payload={scope:'world',publicationId,expectedPublicationRevision:approved.revision},context={operationId:'ep:operation:publish_report001',sourceEventId:'ep:event:publish_report001'},identity={verifiedUserId:player.id,actorId:'NativeActorKnown1'};
 const changeGM=()=>{const next={id:'NewGMNativeUser1',isGM:true,active:true};gm.isGM=false;users.set(next.id,next);game.user=next;current=createLocalGMContext({user:next,epoch:'new-publication-GM'},'world');};
 repository.hasReadyIndex=async()=>true; // Memory fixture models a verified protected index; native-pack denial is tested separately.
 const composeReviews=()=>{const providers=new EffectProviderRegistry();providers.register(createProtectedPublicationProvider({service:compose(),gmProvider}));const journal=new NativeEffectJournal({repository,gmContext:current});return {journal,reviews:new DurableProposalReview({repository,registry,ledger,providers,journal,gmProvider})};};
 return {repository,domains,gm,player,other,users,game,fault,access,gmProvider,writer,knowledge,receipt,plans,service,compose,payload,context,identity,nativeKind,changeGM,catalog,registry,ledger,router,composeReviews,rolls,opposedRolls,RollFixture};
}
for(const kind of ['ChatMessage','JournalEntry'])test(`ADR-045: ${kind} broadcasts only a generic encrypted shell, never private wording, source IDs or keys`,async()=>{
 const s=await setup(kind),result=await s.service.apply(s.payload,s.context);assert.equal(result.alreadyApplied,false);assert.equal(await s.service.verify(s.payload,s.context),true);
 const collection=kind==='ChatMessage'?s.game.messages:s.game.journal,raw=JSON.stringify(collection.writes),records=await s.domains.queryScoped({type:'native-publication-envelope',scope:'world'}),key=records.items[0].data.key;
 for(const secret of ['PRIVATE-KNOWN','PRIVATE-RECIPIENT','GM-ONLY',observerId,claimId,publicationId,s.context.operationId,s.context.sourceEventId,s.player.id,key])assert.equal(raw.includes(secret),false,secret);
 const nativeRef={nativeKind:kind,nativeId:result.nativeId},doc=collection.get(result.nativeId),envelope=doc.getFlag('easy-plots','publicationEnvelope');
 const grant=await s.service.keyForPlayer({...nativeRef,...s.identity}),view=await openPublication(envelope,grant.key,nativeRef);assert.equal(view.claims[0].text,'PRIVATE-KNOWN-REPORT-FOR-ONE-OBSERVER');assert.equal(view.claims[0].stance,'believed');assert.equal(JSON.stringify(view).includes('GM-ONLY'),false);
 await assert.rejects(()=>s.service.keyForPlayer({...nativeRef,...s.identity,verifiedUserId:s.other.id}),{code:'PUBLICATION_UNAVAILABLE'});
 assert.equal((await s.service.apply(s.payload,s.context)).alreadyApplied,true);assert.equal(collection.writes.length,1);
 if(kind==='JournalEntry')assert.deepEqual(doc.source.ownership,{default:2});else{assert.deepEqual(doc.source.whisper,[]);assert.deepEqual(doc.source.rolls,[]);}
});
test('publication preparation uses selected, time-available recipient knowledge and exact source revisions',async()=>{
 const s=await setup();await assert.rejects(()=>s.plans.prepare({id:'ep:publication:wrong_observer001',observerId:'ep:actor:other_observer001',nativeKind:'ChatMessage',title:'No permission',receiptIds:[s.receipt.id],worldTime:10,sourceEventId:'ep:event:denied_publication001'}),{code:'PUBLICATION_KNOWLEDGE'});
 await assert.rejects(()=>s.plans.prepare({id:'ep:publication:too_early001',observerId,nativeKind:'ChatMessage',title:'Too early',receiptIds:[s.receipt.id],worldTime:4,sourceEventId:'ep:event:early_publication001'}),{code:'PUBLICATION_KNOWLEDGE'});
 const claim=await s.domains.read('knowledge-claim','world',claimId);await s.domains.save({type:'knowledge-claim',scope:'world',id:claimId,expectedRevision:claim.revision,data:claim.data,sourceEventId:'ep:event:changed_publication_source001'});
 await assert.rejects(()=>s.service.apply(s.payload,s.context),{code:'PUBLICATION_SOURCE_STALE'});assert.equal(s.game.messages.writes.length,0);
});
test('native acknowledgement loss stays uncertain until the exact original document is explicitly confirmed',async()=>{
 const s=await setup(),providers=new EffectProviderRegistry();providers.register(createProtectedPublicationProvider({service:s.service,gmProvider:s.gmProvider}));const journal=new MemoryOperationJournal(),coordinator=new EffectCoordinator({providers,journal}),spec={...s.context,idempotencyKey:'publication-uncertainty-001',providerId:'narrative.publish-known-content',payload:s.payload,graphId:'ep:graph:publication001',nodeId:'ep:node:publication001'};
 s.fault.lostAck=true;const first=await coordinator.execute(spec,s.gmProvider());assert.equal(first.status,'uncertain');assert.equal(s.game.messages.writes.length,1);const info=await s.service.inspect({publicationId});assert.equal(info.state,'prepared');assert.equal(info.nativeConfirmed,true);
 await assert.rejects(()=>s.service.keyForPlayer({...info,...s.identity}),{code:'PUBLICATION_UNAVAILABLE'});assert.equal((await coordinator.execute(spec,s.gmProvider())).status,'reconciliation-required');assert.equal(s.game.messages.writes.length,1);
 s.changeGM();await s.compose().confirm({publicationId,expectedEnvelopeRevision:info.revision,reviewEventId:'ep:event:new_gm_confirmation001'});assert.equal(await s.compose().verify(s.payload,s.context),true);assert.equal(s.game.messages.writes.length,1);assert.equal((await s.compose().keyForPlayer({...info,...s.identity})).token,s.game.messages.get(info.nativeId).getFlag('easy-plots','publicationEnvelope').token);
 assert.equal((await journal.get(spec.idempotencyKey)).state,'uncertain','Native confirmation must not silently rewrite the operation journal');
});
test('native tampering, retired plans and late Actor revocation block key delivery without leaking their private reason',async()=>{
 const s=await setup(),result=await s.service.apply(s.payload,s.context),nativeRef={nativeKind:s.nativeKind,nativeId:result.nativeId};
 s.access.allowed=false;await assert.rejects(()=>s.service.keyForPlayer({...nativeRef,...s.identity}),{code:'PUBLICATION_UNAVAILABLE'});s.access.allowed=true;
 const doc=s.game.messages.get(result.nativeId),original=doc.source.content;doc.source.content='Native tampering';assert.equal(await s.service.verify(s.payload,s.context),false);await assert.rejects(()=>s.service.keyForPlayer({...nativeRef,...s.identity}),{code:'PUBLICATION_UNAVAILABLE'});doc.source.content=original;
 await s.plans.retire({id:publicationId,expectedRevision:s.payload.expectedPublicationRevision,reason:'No further key grants',reviewEventId:'ep:event:retire_publication001'});await assert.rejects(()=>s.service.keyForPlayer({...nativeRef,...s.identity}),{code:'PUBLICATION_UNAVAILABLE'});assert.equal(await s.service.verify(s.payload,s.context),true,'Historical native creation remains verifiable after retirement');
});
test('native publication state persists across service reconstruction and grants no keys when authority is revoked',async()=>{
 const s=await setup(),result=await s.service.apply(s.payload,s.context);assert.equal((await s.compose().viewForGM({nativeKind:s.nativeKind,nativeId:result.nativeId})).title,'PRIVATE-RECIPIENT-TITLE');
 s.gm.isGM=false;await assert.rejects(()=>s.compose().keyForPlayer({nativeKind:s.nativeKind,nativeId:result.nativeId,...s.identity}),{code:'GM_AUTHORITY_REVOKED'});
});
async function handler(s){
 const {graphId}=await preparePublicationHandlerDraft({registry:s.registry,mode:'sandbox'});assert.equal(await s.registry.getActive(graphId),null);
 const model=new GraphEditorModel({registry:s.registry});await model.load(graphId);const published=await model.publish();await model.activate(published.publishedVersion);return model;
}
for(const kind of ['ChatMessage','JournalEntry'])test(`ADR-045: ${kind} follows approved plan → published handler → persisted proposal → separate approval → protected native creation`,async()=>{
 const s=await setup(kind);await handler(s);const {journal,reviews}=s.composeReviews(),submitted=await s.plans.propose({id:publicationId,expectedRevision:s.payload.expectedPublicationRevision});
 assert.equal(submitted.status,'review-required');const entry=await s.ledger.get(submitted.eventId),p=entry.proposals[0],collection=kind==='ChatMessage'?s.game.messages:s.game.journal;
 assert.equal(entry.proposals.length,1);assert.deepEqual(p.payload,s.payload);assert.equal(collection.writes.length,0);
 await assert.rejects(reviews.execute(submitted.eventId,p.operationId),{code:'APPROVAL_REQUIRED'});await reviews.decide(submitted.eventId,p.operationId,{approve:true});assert.equal(collection.writes.length,0);
 assert.equal((await reviews.execute(submitted.eventId,p.operationId)).status,'completed');assert.equal(collection.writes.length,1);assert.equal((await journal.get(p.idempotencyKey)).verification,'confirmed');
 assert.equal((await s.plans.propose({id:publicationId,expectedRevision:s.payload.expectedPublicationRevision})).status,'duplicate-or-recovery-required');assert.equal(collection.writes.length,1);assert.equal((await s.composeReviews().reviews.verifiedCompletion(submitted.eventId,p.operationId)).operationId,p.operationId);
});
test('lost native creation acknowledgement is confirmed and reconciled after GM handover without another native create',async()=>{
 const s=await setup();await handler(s);const first=s.composeReviews(),event=await s.plans.propose({id:publicationId,expectedRevision:s.payload.expectedPublicationRevision}),p=(await s.ledger.get(event.eventId)).proposals[0];await first.reviews.decide(event.eventId,p.operationId,{approve:true});s.fault.lostAck=true;
 assert.equal((await first.reviews.execute(event.eventId,p.operationId)).status,'uncertain');assert.equal(s.game.messages.writes.length,1);s.changeGM();const next=s.composeReviews();
 await assert.rejects(next.reviews.reconcile(event.eventId,p.operationId,{approved:true}),{code:'VERIFICATION_UNCONFIRMED'});
 const info=await s.compose().inspect({publicationId});await s.compose().confirm({publicationId,expectedEnvelopeRevision:info.revision,reviewEventId:'ep:event:handover_native_confirm001'});
 assert.equal((await next.reviews.reconcile(event.eventId,p.operationId,{approved:true})).status,'completed');assert.equal(s.game.messages.writes.length,1);assert.equal((await next.journal.get(p.idempotencyKey)).reconciliation.byUserId,'NewGMNativeUser1');
 assert.equal((await next.reviews.get(event.eventId,p.operationId)).approvedBy,'GMPrivateNative1');assert.equal((await next.reviews.verifiedCompletion(event.eventId,p.operationId)).operationId,p.operationId);
});
test('source changes after effect approval block native creation and cannot be reconciled into a false success',async()=>{
 const s=await setup();await handler(s);const {reviews}=s.composeReviews(),event=await s.plans.propose({id:publicationId,expectedRevision:s.payload.expectedPublicationRevision}),p=(await s.ledger.get(event.eventId)).proposals[0];await reviews.decide(event.eventId,p.operationId,{approve:true});
 const claim=await s.domains.read('knowledge-claim','world',claimId);await s.domains.save({type:'knowledge-claim',scope:'world',id:claimId,expectedRevision:claim.revision,data:claim.data,sourceEventId:'ep:event:changed_after_approval001'});
 assert.equal((await reviews.execute(event.eventId,p.operationId)).status,'uncertain');assert.equal(s.game.messages.writes.length,0);await assert.rejects(reviews.reconcile(event.eventId,p.operationId,{approved:true}),{code:'VERIFICATION_UNCONFIRMED'});
});
test('scoped publication intent preserves its exact scope through typed event bindings',async()=>{
 const s=await setup();await handler(s);const scope='harbor',id='ep:publication:scoped_known_report001';
 const scopedKnowledge=new PersistentKnowledgeLedger({domains:s.domains,worldTimeProvider:()=>5});await scopedKnowledge.createClaim({scope,claimId,publicId:'ep:public:scoped_report001',publicText:'Scoped disclosed report',canonicalTruth:'Scoped protected truth',sourceEventId:'ep:event:scoped_claim001'});
 const receipt=await scopedKnowledge.recordDisclosure({scope,claimId,observerId,sourceId:'ep:npc:scoped_informant001',sourceEventId:'ep:event:scoped_disclosure001'}),draft=await s.plans.prepare({scope,id,observerId,nativeKind:'JournalEntry',title:'Scoped report',receiptIds:[receipt.id],worldTime:10,sourceEventId:'ep:event:scoped_prepare001'}),approved=await s.plans.approve({scope,id,expectedRevision:draft.revision,reviewEventId:'ep:event:scoped_review001'}),event=await s.plans.propose({scope,id,expectedRevision:approved.revision}),p=(await s.ledger.get(event.eventId)).proposals[0],{reviews}=s.composeReviews();
 assert.equal(p.payload.scope,scope);await reviews.decide(event.eventId,p.operationId,{approve:true});assert.equal((await reviews.execute(event.eventId,p.operationId)).status,'completed');assert.equal(s.game.journal.writes.length,1);assert.equal(await s.domains.read('knowledge-publication','world',id),null);
 const info=await s.service.inspect({scope,publicationId:id});assert.equal((await s.service.keyForPlayer({...info,...s.identity})).nativeId,info.nativeId);
});
async function rollPlan(s,{audience='gm-only',disclosure='total-only',mode='active',kind='d20',side}={}){
 const attemptId='ep:attempt:protected_native_roll001',sourceEventId='ep:event:protected_native_roll001';
 const resolved=kind==='d20'?await s.rolls.resolve({attemptId,sourceEventId,actorId:observerId,mode,modifier:2,dc:19,partialMargin:5,visibility:'gm-only'}):await s.opposedRolls.resolve({attemptId,sourceEventId,initiator:{actorId:observerId,mode:'active',modifier:2},opponent:{actorId:'ep:npc:secret_roll_opponent001',mode:'passive',modifier:5},tiePolicy:'opponent',partialMargin:2});
 const spec={id:'ep:publication:mechanical_report001',rollKind:kind,attemptId,expectedRollRevision:resolved.record.revision,title:'Mechanical report',worldTime:10,audience,observerIds:audience==='observers'?[observerId]:[],disclosure,...(side?{side}:{}),sourceEventId:'ep:event:prepare_mechanical_report001'};
 return {spec,roll:resolved.record,draft:await s.plans.prepareRoll(spec)};
}
for(const audience of ['gm-only','all-players','observers'])test(`ADR-089: ${audience} mechanical publication enforces its policy independently of private narrative knowledge`,async()=>{
 const s=await setup();await handler(s);const {draft}=await rollPlan(s,{audience}),approved=await s.plans.approve({id:draft.id,expectedRevision:draft.revision,reviewEventId:'ep:event:approve_mechanical_report001'}),event=await s.plans.propose({id:approved.id,expectedRevision:approved.revision}),p=(await s.ledger.get(event.eventId)).proposals[0],{reviews}=s.composeReviews();
 assert.deepEqual(approved.data.view,{kind:'roll-publication',version:1,title:'Mechanical report',worldTime:10,mode:'active',disclosure:'total-only',total:14});await reviews.decide(event.eventId,p.operationId,{approve:true});assert.equal((await reviews.execute(event.eventId,p.operationId)).status,'completed');
 const info=await s.service.inspect({publicationId:draft.id}),request={nativeKind:info.nativeKind,nativeId:info.nativeId,...s.identity},doc=s.game.messages.get(info.nativeId),raw=JSON.stringify(doc.toObject());
 for(const secret of ['GM-ONLY','PRIVATE-KNOWN','PRIVATE-RECIPIENT','Mechanical report','gm-only','all-players','observers','ep:attempt:',observerId,'"dc"','"total"','"modifier"']){
  assert.equal(raw.includes(secret),false,secret);
 }
 assert.deepEqual(doc.toObject().rolls,[]);assert.equal(s.RollFixture.calls,1);
 if(audience==='gm-only')await assert.rejects(s.service.keyForPlayer(request),{code:'PUBLICATION_UNAVAILABLE'});else{const key=await s.service.keyForPlayer(request);assert.equal((await openPublication(doc.getFlag('easy-plots','publicationEnvelope'),key.key,request)).total,14);}
 const other={...request,verifiedUserId:s.other.id,actorId:''};if(audience==='all-players')assert.equal((await s.service.keyForPlayer(other)).nativeId,info.nativeId);else await assert.rejects(s.service.keyForPlayer(other),{code:'PUBLICATION_UNAVAILABLE'});
 const peer={id:'CoGMRecipient001',isGM:true,active:true};s.users.set(peer.id,peer);assert.equal((await s.service.keyForUser({...other,verifiedUserId:peer.id})).nativeId,info.nativeId);peer.isGM=false;if(audience!=='all-players')await assert.rejects(s.service.keyForUser({...other,verifiedUserId:peer.id}),{code:'PUBLICATION_UNAVAILABLE'});
 const privateKnowledge=await s.knowledge.projection({observerId:'ep:actor:other_observer001',receiptIds:[],worldTime:10});assert.equal(privateKnowledge.claims.length,0,'Mechanical publication must not create a narrative disclosure receipt');
});
test('ADR-109: passive and contested partial checks disclose only the selected mechanical fields with no opponent/DC oracle',async()=>{
 const passive=await setup(),p=await rollPlan(passive,{mode:'passive',disclosure:'outcome-only'});assert.equal(passive.RollFixture.calls,0);assert.equal(p.draft.data.view.outcome,'failure');assert.equal(Object.hasOwn(p.draft.data.view,'total'),false);
 const opposed=await setup(),o=await rollPlan(opposed,{kind:'opposed',side:'initiator',disclosure:'total-and-outcome',audience:'observers'});assert.deepEqual(o.draft.data.view,{kind:'roll-publication',version:1,title:'Mechanical report',worldTime:10,mode:'opposed',disclosure:'total-and-outcome',total:14,outcome:'partial-failure'});assert.equal(opposed.RollFixture.calls,1);
 const serialized=JSON.stringify(o.draft.data.view);for(const key of ['opponent','modifier','dc','canonicalTruth','attemptId','sourceEventId'])assert.equal(serialized.includes(key),false,key);
 await assert.rejects(opposed.plans.prepareRoll({...o.spec,id:'ep:publication:injected_roll001',canonicalTruth:true}),{code:'PUBLICATION_CONTRACT'});
});
test('mechanical publication approval and application require the exact authoritative roll revision; neither rerolls',async()=>{
 const s=await setup(),r=await rollPlan(s);const row=r.roll;await s.repository.put({...row,total:50},{expectedRevision:row.revision});await assert.rejects(s.plans.approve({id:r.draft.id,expectedRevision:r.draft.revision,reviewEventId:'ep:event:changed_roll_approval001'}),{code:'PUBLICATION_SOURCE_STALE'});assert.equal(s.RollFixture.calls,1);assert.equal(s.game.messages.writes.length,0);
 await assert.rejects(s.plans.prepareRoll({...r.spec,id:'ep:publication:missing_roll_source001',attemptId:'ep:attempt:missing_roll_source001'}),{code:'PUBLICATION_SOURCE_STALE'});
});
test('roll public view rejects hidden criteria, raw native results and fields outside the selected disclosure',async()=>{
 const s=await setup(),{draft}=await rollPlan(s);const {sealPublication}=await import('../src/security/publication-envelope.mjs');const ref={nativeKind:'ChatMessage',nativeId:'MechanicalDoc001'};
 for(const changes of [{dc:19},{modifier:2},{rolls:[{total:14}]},{outcome:'success'},{canonicalTruth:true}])await assert.rejects(sealPublication({...draft.data.view,...changes},ref),{code:'PUBLICATION_VIEW'});
});
test('GM-only key grants recheck the actual GM role after asynchronous protected lookups',async()=>{
 const s=await setup(),{draft}=await rollPlan(s);const approved=await s.plans.approve({id:draft.id,expectedRevision:draft.revision,reviewEventId:'ep:event:blind_role_review001'}),result=await s.service.apply({scope:'world',publicationId:draft.id,expectedPublicationRevision:approved.revision},s.context),peer={id:'CoGMRevoked001',isGM:true,active:true};s.users.set(peer.id,peer);
 const read=s.plans.read.bind(s.plans);s.plans.read=async spec=>{const row=await read(spec);peer.isGM=false;return row;};
 await assert.rejects(s.service.keyForUser({...result,verifiedUserId:peer.id,actorId:''}),{code:'PUBLICATION_UNAVAILABLE'});assert.equal(s.RollFixture.calls,1);
});
