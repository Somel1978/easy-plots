import test from 'node:test';import assert from 'node:assert/strict';
import {planFactionTurn,proposePressureClockAdvance} from '../src/orchestration/faction-orchestration.mjs';
const id=s=>`ep:test:${s}`;
const faction=id('zhent01'),agendaId=id('agenda01');
const agenda={id:agendaId,factionId:faction,status:'active',rules:[{id:'rule1',actionId:'threaten',requiredCanonicalFactIds:[id('fact001')],requiredFactionKnowledgeIds:[id('fact001')],requiresKnowledgeOfCanonicalFact:true,approvalPolicy:'gm-review'}]};
const due=[{id:id('due0001'),agendaId,factionId:faction,ruleId:'rule1',dueAt:100,revision:4}];
test('faction due action requires known fact not merely canonical truth',()=>{
 const denied=planFactionTurn({worldTime:110,agendas:[agenda],dueIndex:due,factionContexts:[{factionId:faction,canonicalFactIds:[id('fact001')],factionKnownFactIds:[]}]});
 assert.equal(denied.proposals.length,0);assert.equal(denied.skipped[0].reason,'condition-not-met-or-unknown');
 const granted=planFactionTurn({worldTime:110,agendas:[agenda],dueIndex:due,factionContexts:[{factionId:faction,canonicalFactIds:[id('fact001')],factionKnownFactIds:[id('fact001')]}]});
 assert.equal(granted.proposals.length,1);assert.equal(granted.proposals[0].status,'eligible-not-executed');assert.equal(granted.offscreenEventsInvented,0);
});
test('no future due index triggers an invented action',()=>{
 const r=planFactionTurn({worldTime:20,agendas:[agenda],dueIndex:due,factionContexts:[{factionId:faction}]});
 assert.equal(r.proposals.length,0);
});
test('unknown faction context stays unknown and inactive agenda is skipped',()=>{
 const r=planFactionTurn({worldTime:110,agendas:[agenda,{...agenda,id:id('agenda02'),status:'suspended'}],dueIndex:due});
 assert.equal(r.unknown.length,1);assert.equal(r.skipped.length,1);
});
test('duplicate source agenda or due index rejected',()=>{
 assert.throws(()=>planFactionTurn({worldTime:110,agendas:[agenda,agenda]}),{code:'FACTION_DUPLICATE'});
 assert.throws(()=>planFactionTurn({worldTime:110,dueIndex:[...due,...due]}),{code:'FACTION_DUE'});
});
test('proposals ordered by due time, do not commit or mutate source',()=>{
 const two={...agenda,id:id('agenda02')};const ix=[...due,{id:id('due0002'),agendaId:two.id,factionId:faction,ruleId:'rule1',dueAt:50}];
 const r=planFactionTurn({worldTime:120,agendas:[agenda,two],dueIndex:ix,factionContexts:[{factionId:faction,canonicalFactIds:[id('fact001')],factionKnownFactIds:[id('fact001')]}]});
 assert.deepEqual(r.proposals.map(p=>p.dueId),[id('due0002'),id('due0001')]);assert.equal(r.committed,false);
});
test('clock advancement bounded, revision checked and consequence not automatic',()=>{
 const clock={id:id('clock001'),revision:5,status:'active',ticks:4,maxTicks:6};
 const r=proposePressureClockAdvance({clock,sourceEventId:id('event001'),delta:3,expectedRevision:5});
 assert.equal(r.to,6);assert.equal(r.overflow,1);assert.equal(r.thresholdReached,true);assert.equal(clock.ticks,4);
 assert.throws(()=>proposePressureClockAdvance({clock,sourceEventId:id('event001'),expectedRevision:2}),{code:'REVISION_CONFLICT'});
});
