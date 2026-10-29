import test from 'node:test';import assert from 'node:assert/strict';
import {planKnowledgePropagation,projectDisclosedClaims} from '../src/orchestration/knowledge-propagation.mjs';
const id=s=>`ep:test:${s}`;
const d={eventId:id('event001'),claimId:id('claim001'),sourceId:id('author001'),initialRecipientIds:[id('alice001')],stance:'reported'};
const states=['alice001','bob0001','cara001'].map(x=>({observerId:id(x),knownEventIds:[]}));
const edge=(name,from,to,policy='allow',extra={})=>({id:id(name),fromId:id(from),toId:id(to),policy,...extra});
test('propagation distinguishes direct / delayed / reviewed recipients without committing',()=>{
 const r=planKnowledgePropagation({disclosure:d,recipientStates:states,worldTime:100,connections:[edge('ab00001','alice001','bob0001','allow',{delay:30}),edge('bc00001','bob0001','cara001','review')]});
 assert.deepEqual(r.proposals.map(p=>p.observerId),states.map(s=>s.observerId));
 assert.deepEqual(r.proposals.map(p=>p.status),['gm-review','scheduled-review','scheduled-review']);
 assert.equal(r.committed,false);assert.equal(r.canonicalTruthEvaluated,false);
});
test('explicit denied links do not transmit',()=>{
 const r=planKnowledgePropagation({disclosure:d,recipientStates:states,connections:[edge('ab00001','alice001','bob0001','deny')]});
 assert.equal(r.proposals.length,1);
});
test('cycles converge with deduplicated recipients',()=>{
 const r=planKnowledgePropagation({disclosure:d,recipientStates:states,connections:[edge('ab00001','alice001','bob0001'),edge('ba00001','bob0001','alice001')]});
 assert.equal(r.proposals.length,2);
});
test('known disclosure is not delivered again',()=>{
 const r=planKnowledgePropagation({disclosure:d,recipientStates:[{observerId:id('alice001'),knownEventIds:[d.eventId]}]});
 assert.equal(r.proposals.length,0);
});
test('missing recipient is explicitly excluded rather than guessed',()=>{
 const r=planKnowledgePropagation({disclosure:d,recipientStates:[]});
 assert.equal(r.proposals.length,0);assert.equal(r.excluded.length,1);
});
test('distortion must be explicitly provenance backed',()=>{
 assert.throws(()=>planKnowledgePropagation({disclosure:d,recipientStates:states,connections:[edge('ab00001','alice001','bob0001','allow',{distortion:{stance:'doubted'}})]}),{code:'KNOWLEDGE_DISTORTION'});
 const r=planKnowledgePropagation({disclosure:d,recipientStates:states,connections:[edge('ab00001','alice001','bob0001','allow',{distortion:{stance:'doubted',reasonId:id('reason1')}})]});
 assert.equal(r.proposals[1].stance,'doubted');assert.ok(r.proposals[1].provenanceEventIds.includes(id('reason1')));
});
test('bounds prevent broad propagation and invalid policies',()=>{
 assert.throws(()=>planKnowledgePropagation({disclosure:d,recipientStates:states,maxPlanned:1,connections:[edge('ab00001','alice001','bob0001')]}),{code:'KNOWLEDGE_LIMIT'});
 assert.throws(()=>planKnowledgePropagation({disclosure:d,recipientStates:states,connections:[edge('ab00001','alice001','bob0001','automatic')]}),{code:'KNOWLEDGE_POLICY'});
});
test('player projection only includes preauthorized published disclosure without truth metadata',()=>{
 const records=[{observerId:id('alice001'),state:'published',disclosureEventId:d.eventId,claimPublicId:'public-1',publicText:'A rumor',stance:'doubted',secretTruth:'known',provenancePublicIds:['source']},{observerId:id('alice001'),state:'published',disclosureEventId:id('other001'),claimPublicId:'public-2',publicText:'Hidden'},{observerId:id('bob0001'),state:'published',disclosureEventId:d.eventId,publicText:'Other'}];
 const r=projectDisclosedClaims({observerId:id('alice001'),records,authorizedEventIds:[d.eventId]});
 assert.deepEqual(r,[{claimPublicId:'public-1',text:'A rumor',stance:'doubted',provenancePublicIds:['source']}]);
 assert.equal(JSON.stringify(r).includes('secretTruth'),false);
});
