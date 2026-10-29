import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentKnowledgeLedger} from '../src/orchestration/persistent-knowledge.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const id=x=>`ep:${x}`;const claimId=id('claim:secret001'),publicId=id('public:rumor001');
const alice=id('actor:alice001'),bob=id('actor:bob001');
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'local'},'world');
async function setup(){const d=new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider});const ledger=new PersistentKnowledgeLedger({domains:d});
 await ledger.createClaim({claimId,publicId,publicText:'A masked person was seen at the harbor',canonicalTruth:'GM-ONLY: MARREK IS THE VIPER',sourceEventId:id('event:truth001')});
 return {d,ledger};}
const disclosure={claimId,observerId:alice,sourceEventId:id('event:disclose001'),sourceId:id('actor:informant001'),stance:'reported',availableAt:15};
test('explicit observer receipt publishes only allowlisted text and public ID',async()=>{
 const {ledger}=await setup();const r=await ledger.recordDisclosure(disclosure);
 const early=await ledger.projection({observerId:alice,receiptIds:[r.id],worldTime:10});assert.equal(early.claims.length,0);
 const visible=await ledger.projection({observerId:alice,receiptIds:[r.id],worldTime:15});
 assert.deepEqual(visible.claims,[{id:publicId,text:'A masked person was seen at the harbor',stance:'reported',correctionPublished:false,state:'known'}]);
 assert.equal(JSON.stringify(visible).includes('MARREK'),false);assert.equal(JSON.stringify(visible).includes(claimId),false);
 const other=await ledger.projection({observerId:bob,receiptIds:[r.id],worldTime:15});assert.deepEqual(other.claims,[]);
});
test('receipt deduplicates exact source event and does not silently modify history',async()=>{
 const {ledger}=await setup();const first=await ledger.recordDisclosure(disclosure);
 const second=await ledger.recordDisclosure(disclosure);assert.equal(second.revision,first.revision);
 await assert.rejects(ledger.recordDisclosure({...disclosure,stance:'believed'}),{code:'KNOWLEDGE_RECEIPT_CONFLICT'});
 await assert.rejects(ledger.recordDisclosure({...disclosure,authorized:false,sourceEventId:id('event:other001')}),{code:'KNOWLEDGE_DISCLOSURE'});
});
test('correction is separate historical event; only explicitly provided corrections are visible',async()=>{
 const {ledger,d}=await setup();const receipt=await ledger.recordDisclosure({...disclosure,availableAt:0});
 const correction=await ledger.correctReceipt({correctionId:id('correction:one001'),receiptId:receipt.id,
  sourceEventId:id('event:correct001'),sourceId:id('actor:informant001'),kind:'retracted',revisedStance:'retracted',reason:'Witness recanted'});
 const old=await ledger.projection({observerId:alice,receiptIds:[receipt.id],worldTime:1});assert.equal(old.claims[0].stance,'reported');
 const revised=await ledger.projection({observerId:alice,receiptIds:[receipt.id],correctionIds:[correction.id],worldTime:1});
 assert.equal(revised.claims[0].stance,'retracted');assert.equal(revised.claims[0].correctionPublished,true);
 const canonical=await d.read('knowledge-receipt','world',receipt.id);assert.equal(canonical.data.stance,'reported');
 await assert.rejects(ledger.projection({observerId:bob,correctionIds:[correction.id]}),{code:'KNOWLEDGE_OBSERVER_DENIED'});
});
test('pending receipt never reveals claim or its existence in player projection',async()=>{
 const {ledger}=await setup();const r=await ledger.recordDisclosure({...disclosure,state:'pending-review',availableAt:0});
 const visible=await ledger.projection({observerId:alice,receiptIds:[r.id],worldTime:100});assert.deepEqual(visible.claims,[]);
});
test('unavailable canonical claim fails without creating a receipt',async()=>{
 const {ledger}=await setup();await assert.rejects(ledger.recordDisclosure({...disclosure,claimId:id('claim:missing001')}),{code:'KNOWLEDGE_CLAIM_MISSING'});
});
test('ADR-038: later claim wording cannot silently change what an observer was previously told',async()=>{
 const {ledger,d}=await setup(),before=await ledger.recordDisclosure({...disclosure,availableAt:0}),claim=await d.read('knowledge-claim','world',claimId);
 await d.save({type:'knowledge-claim',scope:'world',id:claimId,expectedRevision:claim.revision,sourceEventId:id('event:retcon_claim001'),data:{...claim.data,publicText:'The witness withdrew the account',canonicalTruth:'A different GM-only explanation'}});
 const later=await ledger.recordDisclosure({...disclosure,observerId:bob,sourceEventId:id('event:later_disclose001'),availableAt:0}),old=await ledger.projection({observerId:alice,receiptIds:[before.id],worldTime:50}),fresh=await ledger.projection({observerId:bob,receiptIds:[later.id],worldTime:50});
 assert.equal(old.claims[0].text,'A masked person was seen at the harbor');assert.equal(fresh.claims[0].text,'The witness withdrew the account');assert.equal((await d.read('knowledge-receipt','world',before.id)).data.claimRevision,1);assert.equal((await d.read('knowledge-receipt','world',later.id)).data.claimRevision,2);
 const correction=await ledger.correctReceipt({correctionId:id('correction:retcon001'),receiptId:before.id,sourceEventId:id('event:retcon_notice001'),sourceId:disclosure.sourceId,kind:'retracted',revisedStance:'retracted',reason:'Explicitly tell this observer the account was retracted'}),revised=await ledger.projection({observerId:alice,receiptIds:[before.id],correctionIds:[correction.id],worldTime:50});assert.equal(revised.claims[0].text,old.claims[0].text);assert.equal(revised.claims[0].stance,'retracted');assert.equal(JSON.stringify(revised).includes('GM-only'),false);
});
test('missing historical claim proof fails closed rather than exposing newly edited wording',async()=>{
 const {ledger,d}=await setup(),receipt=await ledger.recordDisclosure({...disclosure,availableAt:0}),claim=await d.read('knowledge-claim','world',claimId);
 await d.save({type:'knowledge-claim',scope:'world',id:claimId,expectedRevision:1,sourceEventId:id('event:claim_changed001'),data:{...claim.data,publicText:'NOT-YET-DISCLOSED'}});d.readRevision=async()=>null;
 await assert.rejects(ledger.projection({observerId:alice,receiptIds:[receipt.id],worldTime:50}),{code:'KNOWLEDGE_CLAIM_REVISION_MISSING'});
});
