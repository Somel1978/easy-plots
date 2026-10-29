import test from 'node:test';import assert from 'node:assert/strict';
import {evaluatePlanningFixture} from '../src/ui/planning-lab.mjs';
const id=s=>`ep:test:${s}`;
test('GM planning lab routes knowledge propagation without native effects',()=>{
 const r=evaluatePlanningFixture('knowledge',{worldTime:1,disclosure:{eventId:id('event001'),claimId:id('claim001'),sourceId:id('actor001'),initialRecipientIds:[id('recipient1')]},recipientStates:[{observerId:id('recipient1'),knownEventIds:[]}]});
 assert.equal(r.proposals.length,1);assert.equal(r.committed,false);
});
test('GM planning lab routes due faction turn without inventing events',()=>{
 const r=evaluatePlanningFixture('faction',{worldTime:1});assert.equal(r.proposals.length,0);assert.equal(r.offscreenEventsInvented,0);
});
test('GM planning lab routes arc closure and resource audit',()=>{
 const closure=evaluatePlanningFixture('closure',{arcId:id('arc0001'),arcRevision:1,worldTime:1,worldFacets:{},endingContracts:[]});
 const resource=evaluatePlanningFixture('resources',{resources:[],bindings:[],knownNarrativeIds:[]});
 assert.equal(closure.committed,false);assert.equal(resource.deletionsProposed,0);
});
test('planning lab rejects unknown mode and oversized input',()=>{
 assert.throws(()=>evaluatePlanningFixture('untrusted',{worldTime:1}));
 assert.throws(()=>evaluatePlanningFixture('resources',{large:'x'.repeat(30000)}));
});
