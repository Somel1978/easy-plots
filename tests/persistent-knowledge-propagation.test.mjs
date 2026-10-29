import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentKnowledgeLedger} from '../src/orchestration/persistent-knowledge.mjs';
import {PersistentKnowledgePropagation} from '../src/orchestration/persistent-knowledge-propagation.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const id=(kind,name)=>`ep:${kind}:${name}`;
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
const claim=id('claim','harbor001'),source=id('actor','source001'),alice=id('actor','alice001'),bob=id('actor','bob001'),carl=id('actor','carl001');
const evt=id('event','spread001'),planId=id('propagation','plan001'),approval=id('event','approve001');
async function setup(){
 const domains=new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider});
 const knowledge=new PersistentKnowledgeLedger({domains});
 const propagation=new PersistentKnowledgePropagation({domains,knowledge});
 await knowledge.createClaim({claimId:claim,publicId:id('public','public001'),publicText:'A shipment was seen',canonicalTruth:'Secret: THE BLACK VIPER',sourceEventId:id('event','truth001')});
 return {domains,knowledge,propagation};
}
function request(){return {planId,sourceEventId:evt,worldTime:10,
 disclosure:{eventId:evt,claimId:claim,sourceId:source,initialRecipientIds:[alice],stance:'reported'},
 recipientStates:[{observerId:alice,knownEventIds:[]},{observerId:bob,knownEventIds:[]}],
 connections:[{id:id('edge','alicebob001'),fromId:alice,toId:bob,policy:'review',delay:20}]};}
test('propagation plan is durable, requires GM adjudication and never publishes on its own',async()=>{
 const {propagation}=await setup();const plan=await propagation.plan(request());
 assert.equal(plan.data.proposals.length,2);
 assert.equal(JSON.stringify(plan).includes('BLACK VIPER'),false);
 assert.deepEqual(await propagation.projection({planId,observerId:alice,worldTime:100}),{claims:[]});
 await assert.rejects(propagation.approveRecipient({planId,recipientId:alice,expectedPlanRevision:1,approvalEventId:approval,worldTime:10}),{code:'PROPAGATION_AUTHORIZATION'});
 const result=await propagation.approveRecipient({planId,recipientId:alice,expectedPlanRevision:1,approvalEventId:approval,worldTime:10,approved:true});
 assert.equal(result.data.status,'approved-published');
 const aliceView=await propagation.projection({planId,observerId:alice,worldTime:10});
 assert.deepEqual(aliceView,{claims:[{id:id('public','public001'),text:'A shipment was seen',stance:'reported',correctionPublished:false,state:'known'}]});
 assert.equal(JSON.stringify(aliceView).includes(claim),false);
 assert.deepEqual(await propagation.projection({planId,observerId:bob,worldTime:100}),{claims:[]});
});
test('delays, out-of-scope users, stale approvals and source identity are enforced',async()=>{
 const {propagation}=await setup();await propagation.plan(request());
 await assert.rejects(propagation.approveRecipient({planId,recipientId:bob,expectedPlanRevision:1,approvalEventId:approval,worldTime:29,approved:true}),{code:'PROPAGATION_NOT_DUE'});
 await assert.rejects(propagation.approveRecipient({planId,recipientId:carl,expectedPlanRevision:1,approvalEventId:approval,worldTime:30,approved:true}),{code:'PROPAGATION_RECIPIENT'});
 await assert.rejects(propagation.approveRecipient({planId,recipientId:alice,expectedPlanRevision:9,approvalEventId:approval,worldTime:30,approved:true}),{code:'REVISION_CONFLICT'});
 await assert.rejects(propagation.plan({...request(),sourceEventId:id('event','wrong001'),planId:id('propagation','another001')}),{code:'PROPAGATION_ORIGIN'});
 const second=await propagation.approveRecipient({planId,recipientId:bob,expectedPlanRevision:1,approvalEventId:approval,worldTime:30,approved:true});
 assert.equal(second.data.receiptRevision,1);
 assert.equal((await propagation.projection({planId,observerId:bob,worldTime:29})).claims.length,0);
 assert.equal((await propagation.projection({planId,observerId:bob,worldTime:30})).claims.length,1);
});
test('identical approvals are retry safe but conflicting approvals are rejected',async()=>{
 const {propagation}=await setup();await propagation.plan(request());
 const q={planId,recipientId:alice,expectedPlanRevision:1,approvalEventId:approval,worldTime:10,approved:true};
 const a=await propagation.approveRecipient(q),b=await propagation.approveRecipient(q);
 assert.deepEqual(a,b);
 await assert.rejects(propagation.approveRecipient({...q,approvalEventId:id('event','other001')}),{code:'PROPAGATION_REVIEW_CONFLICT'});
 await assert.rejects(propagation.plan({...request(),disclosure:{...request().disclosure,stance:'believed'}}),{code:'PROPAGATION_IMMUTABLE'});
});
test('interrupted decision persistence can be reconciled from deterministic receipt',async()=>{
 const {propagation,domains}=await setup();await propagation.plan(request());
 // A receipt may exist before the propagation step record is saved.
 const knowledge=new PersistentKnowledgeLedger({domains});
 await knowledge.recordDisclosure({claimId:claim,observerId:alice,sourceEventId:evt,sourceId:source,stance:'reported',availableAt:10,state:'published'});
 const a=await propagation.approveRecipient({planId,recipientId:alice,expectedPlanRevision:1,approvalEventId:approval,worldTime:10,approved:true});
 assert.equal(a.revision,1);
});
test('different GM contexts cannot access propagation storage',async()=>{
 const repository=new MemoryPartitionRepository();
 const domains=new NarrativeDomainStore({repository,gmProvider:()=>createLocalGMContext({user:{id:'PLAYER',isGM:false},epoch:'test'},'world')});
 const prop=new PersistentKnowledgePropagation({domains,knowledge:{recordDisclosure:async()=>{}}});
 await assert.rejects(prop.readPlan({planId}),{code:'GM_REQUIRED'});
});
