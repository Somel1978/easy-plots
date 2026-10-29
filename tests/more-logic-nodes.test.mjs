import test from 'node:test';import assert from 'node:assert/strict';
import {LOGIC_NODE_CONFIG,validateLogicNode,evaluateLogicNode} from '../src/graph/logic-nodes.mjs';
const id=s=>`ep:test:${s}`;
const tests=[
 ['core.gate.faction-knowledge',{factionId:id('faction001'),claimId:id('claim001')},{factionId:id('faction001'),factionKnownClaimIds:[id('claim001')]},'out'],
 ['core.gate.npc-agenda',{npcId:id('npc0001'),agendaId:id('agenda001'),status:'active'},{npcId:id('npc0001'),agendaId:id('agenda001'),agendaStatus:'active'},'out'],
 ['core.gate.deadline',{deadlineId:id('deadline001'),status:'due'},{deadlineId:id('deadline001'),deadlineStatus:'due'},'out'],
 ['core.gate.known-route',{routeId:id('route001'),observerId:id('actor001')},{observerId:id('actor001'),authorizedRouteIds:[id('route001')]},'out'],
 ['core.gate.continuity',{sourceArcId:id('arc001'),entityId:id('npc0001')},{sourceArcId:id('arc001'),continuityEntityIds:[id('npc0001')]},'out'],
 ['core.gate.hypothesis',{hypothesisId:id('hypothesis001'),status:'reviewed'},{hypothesisId:id('hypothesis001'),hypothesisStatus:'reviewed'},'out'],
 ['core.gate.provenance',{sourceEventId:id('event001')},{provenanceEventIds:[id('event001')]},'out'],
 ['core.gate.faction-standing',{factionId:id('faction001'),actorId:id('actor001'),minStanding:5},{factionId:id('faction001'),actorId:id('actor001'),standing:6},'out'],
 ['core.branch.milestone',{milestoneId:id('mile001')},{milestoneId:id('mile001'),milestoneEligibility:'eligible'},'qualified'],
 ['core.branch.disclosure',{disclosureId:id('disc001')},{disclosureId:id('disc001'),disclosureStatus:'approved'},'approved']
];
for(const [typeId,data,p,port] of tests)test(`${typeId} validates and routes committed-source event`,()=>{
 assert.ok(LOGIC_NODE_CONFIG[typeId]);const n={typeId,data};validateLogicNode(n);
 const result=evaluateLogicNode(n,{payload:p});assert.equal(result.pass,true);
 assert.equal(result.allowedPorts===null?port==='out':result.allowedPorts.includes(port),true);
});
test('invalid source values rejected without mutating world',()=>{
 assert.throws(()=>validateLogicNode({typeId:'core.gate.faction-standing',data:{factionId:id('faction001'),actorId:id('actor001'),minStanding:999999}}),{code:'LOGIC_NODE_STANDING'});
 assert.equal(evaluateLogicNode({typeId:'core.gate.known-route',data:{routeId:id('route001'),observerId:id('actor001')}},{payload:{observerId:id('actor001'),authorizedRouteIds:[]}}).pass,false);
});
