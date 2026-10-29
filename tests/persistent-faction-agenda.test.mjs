import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentKnowledgeLedger} from '../src/orchestration/persistent-knowledge.mjs';
import {PersistentFactionAgenda} from '../src/orchestration/persistent-faction-agenda.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const id=(k,s)=>`ep:${k}:${s}`, faction=id('faction','harpers001'), fact=id('fact','evidence001'), claim=id('claim','conspiracy001'), agendaId=id('agenda','harpers001'),ruleId='prepare-raid';
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
const rules=[{id:ruleId,actionId:'watch-pier',notBefore:20,expiresAt:100,requiredCanonicalFactIds:[fact],requiredFactionKnowledgeIds:[claim]}];
async function setup(){const domains=new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider});
 const knowledge=new PersistentKnowledgeLedger({domains}), agenda=new PersistentFactionAgenda({domains});
 await domains.save({type:'world-fact',scope:'world',id:fact,sourceEventId:id('event','truth001'),data:{status:'asserted'}});
 await knowledge.createClaim({claimId:claim,publicId:id('public','conspiracy001'),publicText:'Cargo is diverted',canonicalTruth:'Marrek controls the routes',sourceEventId:id('event','claim001')});
 const receipt=await knowledge.recordDisclosure({observerId:faction,claimId:claim,sourceId:id('actor','informant001'),sourceEventId:id('event','received001'),availableAt:30});
 await agenda.publish({agendaId,factionId:faction,sourceEventId:id('event','publish001'),rules});
 return {domains,knowledge,agenda,receipt};}
test('faction requires its own known claim and established canonical fact',async()=>{
 const {agenda,receipt}=await setup();
 assert.equal((await agenda.assess({agendaId,worldTime:31})).proposals.length,0);
 await assert.rejects(agenda.assess({agendaId,worldTime:20,knowledgeReceiptIds:[receipt.id]}),{code:'AGENDA_KNOWLEDGE'});
 const good=await agenda.assess({agendaId,worldTime:31,knowledgeReceiptIds:[receipt.id]});
 assert.equal(good.proposals.length,1);assert.equal(good.proposals[0].approval,'gm-review');
 assert.equal(JSON.stringify(good).includes('Marrek'),false);
});
test('faction agenda never uses newly disclosed knowledge retroactively through an earlier availability default',async()=>{
 const {domains,agenda}=await setup(),knowledge=new PersistentKnowledgeLedger({domains,worldTimeProvider:()=>60});
 const receipt=await knowledge.recordDisclosure({observerId:faction,claimId:claim,sourceId:id('actor','informant001'),sourceEventId:id('event','received_late001'),availableAt:0});
 await assert.rejects(()=>agenda.assess({agendaId,worldTime:50,knowledgeReceiptIds:[receipt.id]}),{code:'AGENDA_KNOWLEDGE'});
 assert.equal((await agenda.assess({agendaId,worldTime:61,knowledgeReceiptIds:[receipt.id]})).proposals.length,1);
});
test('faction cannot use other recipients knowledge as if its own',async()=>{
 const {agenda,knowledge}=await setup();
 const receipt=await knowledge.recordDisclosure({observerId:id('faction','other001'),claimId:claim,sourceId:id('actor','informant001'),sourceEventId:id('event','other001'),availableAt:0});
 await assert.rejects(agenda.assess({agendaId,worldTime:50,knowledgeReceiptIds:[receipt.id]}),{code:'AGENDA_KNOWLEDGE'});
});
test('review is explicit, revision checked, deduplicated and has no effects',async()=>{
 const {agenda,receipt}=await setup();const args={agendaId,ruleId,knowledgeReceiptIds:[receipt.id],worldTime:35,sourceEventId:id('event','review001'),expectedAgendaRevision:1,gmApproved:true};
 await assert.rejects(agenda.review({...args,gmApproved:false}),{code:'AGENDA_APPROVAL'});
 await assert.rejects(agenda.review({...args,expectedAgendaRevision:2}),{code:'REVISION_CONFLICT'});
 const a=await agenda.review(args);assert.equal(a.data.effectsExecuted,0);
 assert.equal(a.data.status,'gm-reviewed-action-proposal');
 const b=await agenda.review(args);assert.deepEqual(a,b);
 await assert.rejects(agenda.review({...args,worldTime:36}),{code:'AGENDA_DECISION_CONFLICT'});
});
test('published agenda is immutable and rule window cannot be invalid',async()=>{
 const {agenda}=await setup();
 await assert.rejects(agenda.publish({agendaId,factionId:faction,sourceEventId:id('event','publish002'),rules}),{code:'AGENDA_IMMUTABLE'});
 await assert.rejects(agenda.publish({agendaId:id('agenda','bad001'),factionId:faction,sourceEventId:id('event','bad001'),rules:[{id:ruleId,actionId:'sack-pier',notBefore:40,expiresAt:20}]}),{code:'AGENDA_TIME'});
});
