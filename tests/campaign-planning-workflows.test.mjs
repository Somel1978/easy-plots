import test from 'node:test';import assert from 'node:assert/strict';
import {planNPCCampaignTurn} from '../src/orchestration/npc-schedule-planner.mjs';
import {analyzeInvestigationViability} from '../src/orchestration/investigation-viability.mjs';
import {prepareContinuityHandoff} from '../src/orchestration/continuity-handoff.mjs';
import {evaluatePlanningFixture} from '../src/ui/planning-lab.mjs';
const id=s=>`ep:test:${s}`;
test('NPC scheduler honors both canonical and NPC-specific knowledge',()=>{
 const input={worldTime:120,npcs:[{id:id('captain'),status:'active',knownFactIds:[]}],knownFactIds:[id('secret')],dueActions:[{id:id('action001'),npcId:id('captain'),agendaId:id('agenda001'),dueWorldTime:110,status:'due',requiredKnowledgeIds:[id('secret')]}]};
 let result=planNPCCampaignTurn(input);assert.equal(result.proposals.length,0);assert.equal(result.blocked[0].reason,'npc-does-not-know-prerequisites');
 result=planNPCCampaignTurn({...input,npcs:[{...input.npcs[0],knownFactIds:[id('secret')]}]});
 assert.equal(result.proposals.length,1);assert.equal(result.proposals[0].outcome,'undetermined');assert.equal(result.committed,false);
});
test('analyzer reports uncertainty on incomplete dependency scope, not unjustified failure',()=>{
 const a={investigationId:id('investigation001'),objectives:[{id:id('objective001'),requiredEvidenceIds:[id('evidence001')]}],opportunities:[],verifiedEvidenceIds:[]};
 assert.equal(analyzeInvestigationViability({...a,coverage:'partial'}).results[0].classification,'undetermined');
 assert.equal(analyzeInvestigationViability({...a,coverage:'complete'}).results[0].classification,'no-known-discovery-route');
 assert.equal(analyzeInvestigationViability({...a,coverage:'complete',objectives:[{...a.objectives[0],allowFailure:true}]}).results[0].classification,'legitimate-failure-route');
 assert.equal(analyzeInvestigationViability({...a,coverage:'complete',verifiedEvidenceIds:[id('evidence001')]}).results[0].completionAwarded,false);
});
test('continuity handoff uses source references and never starts a sequel',()=>{
 const input={sourceArcId:id('arcwaterdeep'),targetArcId:id('arcneverwinter'),sourceResolutionId:id('resolution001'),refs:[{narrativeId:id('hook001'),sourceEventId:id('event001'),kind:'story-hook',bindingState:'available',intention:'dormant'},{narrativeId:id('npc001'),sourceEventId:id('event002'),kind:'living-entity',bindingState:'stale',intention:'reference'}]};
 const result=prepareContinuityHandoff(input);
 assert.equal(result.dormantHooks.length,1);assert.equal(result.unresolved.length,1);assert.equal(result.nextArcActivated,false);
 assert.equal(result.sourceGraphCopied,false);
 assert.throws(()=>prepareContinuityHandoff({...input,targetArcId:input.sourceArcId}),{code:'CONTINUITY_SELF'});
});
test('planning lab exposes functional fixtures for all new workflows',()=>{
 const npc={worldTime:100,npcs:[],dueActions:[]};
 assert.equal(evaluatePlanningFixture('npc-turn',npc).committed,false);
 const viability={investigationId:id('inv001'),coverage:'unknown',objectives:[],opportunities:[],verifiedEvidenceIds:[]};
 assert.equal(evaluatePlanningFixture('viability',viability).scopeComplete,false);
 const continuity={sourceArcId:id('arc001'),targetArcId:id('arc002'),sourceResolutionId:id('resolution001'),refs:[]};
 assert.equal(evaluatePlanningFixture('continuity',continuity).nextArcActivated,false);
});
