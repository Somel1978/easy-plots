import test from 'node:test';
import assert from 'node:assert/strict';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {evaluateFactionAgenda,proposeStandingChange,qualifyFactionPrivilege} from '../src/domains/factions.mjs';
import {proposeRelationshipTransition,observerRelationshipView,proposeObligationSettlement} from '../src/domains/relationships.mjs';
import {analyzePlayerTheory,evaluateInvestigationViability,registerInvestigationAttempt} from '../src/domains/investigations.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gm=createLocalGMContext({user:{id:'gm1',isGM:true}},'world1');
test('domain store verifies scoped persistence and rejects stale revisions',async()=>{
  const repo=new MemoryPartitionRepository(); const store=new NarrativeDomainStore({repository:repo,gmProvider:()=>gm});
  const id='ep:faction:abcdef';
  const row=await store.save({type:'faction',scope:'worlda',id,data:{name:'Harper'},sourceEventId:'ep:event:abc12345'});
  assert.equal(row.revision,1);assert.equal((await store.read('faction','worlda',id)).data.name,'Harper');
  assert.equal(await store.read('faction','worldb',id),null);
  await assert.rejects(()=>store.save({type:'faction',scope:'worlda',id,data:{name:'Wrong'},sourceEventId:'ep:event:abc12345'}),{code:'REVISION_CONFLICT'});
  const updated=await store.save({type:'faction',scope:'worlda',id,data:{name:'Harpers'},sourceEventId:'ep:event:abc12346',expectedRevision:1});
  assert.equal(updated.revision,2);
  await assert.rejects(()=>store.save({type:'unknown',scope:'worlda',id,data:{},sourceEventId:'ep:event:abc12346'}),{code:'DOMAIN_SCOPE'});
});
test('domain store never accepts non-GM writes or unscoped data',async()=>{
  const store=new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider:()=>null});
  await assert.rejects(()=>store.save({type:'faction',scope:'worlda',id:'ep:faction:abcdef',data:{},sourceEventId:'ep:event:abc12345'}),{code:'GM_REQUIRED'});
});
test('faction agenda cannot react to truth it has not learned',()=>{
  const agenda={id:'agenda1',factionId:'f1',rules:[{id:'rule1',actionId:'retaliate',requiredCanonicalFactIds:['identity'],requiresKnowledgeOfCanonicalFact:true},{id:'rule2',actionId:'patrol',notBefore:5}]};
  const result=evaluateFactionAgenda(agenda,{canonicalFactIds:['identity'],factionKnownFactIds:[],worldTime:6});
  assert.deepEqual(result.proposals.map(x=>x.actionId),['patrol']);
  assert.equal(evaluateFactionAgenda(agenda,{canonicalFactIds:['identity'],factionKnownFactIds:['identity'],worldTime:6}).proposals.length,2);
});
test('membership and rank changes are not numeric reputation deltas',()=>{
  assert.equal(proposeStandingChange({factionId:'f1',actorId:'a1',delta:3,sourceEventId:'ep:event:x'}).committed,false);
  assert.throws(()=>proposeStandingChange({factionId:'f1',actorId:'a1',delta:1,relationship:'rank',sourceEventId:'ep:event:x'}),{code:'FACTION_REVIEW_REQUIRED'});
  assert.equal(qualifyFactionPrivilege({memberships:['ally'],minRenown:5,requiredKnownFacts:['a']},{membership:'ally',renown:6,knownFactIds:['a']}).eligible,true);
});
test('directional relationship transitions preserve history and never update reverse edge',()=>{
  const edge={fromId:'actorA',toId:'actorB',trust:3,history:[]};
  const next=proposeRelationshipTransition(edge,{id:'ep:event:a',trustDelta:-2},{worldTime:100});
  assert.equal(next.next.trust,1);assert.equal(edge.trust,3);
  assert.equal(proposeRelationshipTransition(next.next,{id:'ep:event:a'},{worldTime:101}).status,'duplicate');
});
test('observer relationship views reveal only explicitly disclosed beliefs',()=>{
  const edges=[{observerId:'p1',disclosureId:'x',publicFromId:'a',publicToId:'b',believedStance:'friend',secretTruth:'enemy'},{observerId:'p2',disclosureId:'x',publicFromId:'a',publicToId:'b'}];
  const result=observerRelationshipView(edges,{observerId:'p1',authorizedDisclosureIds:['x']});
  assert.deepEqual(result,[{fromId:'a',toId:'b',stance:'friend',status:'unverified'}]);
});
test('obligation requires exact debtor and creditor provenance',()=>{
  const o={id:'debt1',debtorId:'harper',creditorId:'party',state:'outstanding'};
  assert.equal(proposeObligationSettlement(o,{eventId:'ep:event:x',debtorId:'harper',creditorId:'party'}).status,'gm-review');
  assert.throws(()=>proposeObligationSettlement(o,{eventId:'ep:event:x',debtorId:'party',creditorId:'harper'}),{code:'OBLIGATION_CONTEXT'});
});
test('investigation arguments never reveal private GM truth',()=>{
  const theory={id:'t1',observerId:'p1',secretAnswer:'marrek'};
  const evidence=[{id:'e1',publicEvidenceId:'handout1',theoryId:'t1',direction:'support',disclosedTo:['p1'],hiddenAnswer:true},
    {id:'e2',publicEvidenceId:'handout2',theoryId:'t1',direction:'contradict',disclosedTo:['p2'],hiddenAnswer:true}];
  const result=analyzePlayerTheory(theory,evidence,{authorizedEvidenceIds:['e1','e2']});
  assert.equal(result.supportCount,1);assert.equal(result.contradictionCount,0);assert.equal(result.truthStatus,undefined);
  assert.equal(JSON.stringify(result).includes('marrek'),false);
});
test('investigation viability is GM-only scoped classification, not auto success',()=>{
  const result=evaluateInvestigationViability([{id:'mystery'}],[{objectiveId:'mystery',status:'open',requiredKnownIds:['clue']}],{knownIds:[]});
  assert.equal(result[0].status,'blocked-or-conditional');assert.equal(result[0].completed,false);
});
test('attempt identity distinguishes duplicate deliveries from repeated opportunities',()=>{
  const history=[{eventId:'evt1',opportunityId:'o1',actorId:'p1',state:'resolved'}];
  assert.equal(registerInvestigationAttempt({eventId:'evt1',opportunityId:'o1',actorId:'p1'},history).status,'duplicate-delivery');
  assert.equal(registerInvestigationAttempt({eventId:'evt2',opportunityId:'o1',actorId:'p1'},history).status,'repeat-needs-policy');
  assert.equal(registerInvestigationAttempt({eventId:'evt2',opportunityId:'o1',actorId:'p1',newApproachId:'test'},history).status,'eligible-for-authorized-resolution');
});
