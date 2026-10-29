import test from 'node:test';
import assert from 'node:assert/strict';
import {LOGIC_NODE_CONFIG,validateLogicNode,evaluateLogicNode} from '../src/graph/logic-nodes.mjs';
const ids={factionId:'ep:faction:example_001',memberId:'ep:actor:example_001',actorId:'ep:actor:example_001',npcId:'ep:npc:example_001',locationId:'ep:location:example_001',objectiveId:'ep:objective:example_001',arcId:'ep:arc:example_001',clockId:'ep:clock:example_001',observerId:'ep:actor:example_001',claimId:'ep:claim:example_001',relationshipId:'ep:relationship:example_001'};
const fixtures={
 'core.gate.faction-membership':{...ids,membershipStatus:'member'},
 'core.gate.faction-rank':{...ids,factionRank:'officer'},
 'core.gate.npc-location':ids,
 'core.gate.quest-state':{...ids,objectiveState:'active'},
 'core.gate.arc-state':{...ids,arcState:'concluded'},
 'core.gate.pressure-threshold':{...ids,ticks:4},
 'core.gate.knowledge-claim':{...ids,authorizedClaimIds:[ids.claimId]},
 'core.gate.relationship':{...ids,relationshipStatus:'active'},
 'core.gate.disclosure-recipient':{disclosureRecipientIds:[ids.observerId]},
 'core.branch.authorized-choice':{choiceId:'investigate'}
};
for(const [type,payload] of Object.entries(fixtures))test(`${type}: authored condition matches exact canonical data only`,()=>{
 const node={typeId:type,data:structuredClone(LOGIC_NODE_CONFIG[type].data)};
 assert.equal(validateLogicNode(node),true);
 const yes=evaluateLogicNode(node,{payload});assert.equal(yes.pass,true);
 const altered=structuredClone(payload);
 if(type==='core.branch.authorized-choice')altered.choiceId='invalid';
 else if(type==='core.gate.disclosure-recipient')altered.disclosureRecipientIds=[];
 else if(type==='core.gate.knowledge-claim')altered.authorizedClaimIds=[];
 else if(type==='core.gate.pressure-threshold')altered.ticks=0;
 else if(type==='core.gate.faction-rank')altered.factionRank='initiate';
 else if(type==='core.gate.arc-state')altered.arcState='active';
 else if(type==='core.gate.quest-state')altered.objectiveState='failed';
 else if(type==='core.gate.relationship')altered.relationshipStatus='ended';
 else if(type==='core.gate.faction-membership')altered.membershipStatus='former';
 else altered.locationId='ep:location:other_001';
 assert.equal(evaluateLogicNode(node,{payload:altered}).pass,false);
});
test('secrecy gates fail closed with missing observer authorization and invalid choices',()=>{
 const claim={typeId:'core.gate.knowledge-claim',data:LOGIC_NODE_CONFIG['core.gate.knowledge-claim'].data};
 assert.equal(evaluateLogicNode(claim,{payload:{observerId:ids.observerId,secretKnownClaimIds:[ids.claimId]}}).pass,false);
 const choice={typeId:'core.branch.authorized-choice',data:LOGIC_NODE_CONFIG['core.branch.authorized-choice'].data};
 assert.deepEqual(evaluateLogicNode(choice,{payload:{choiceId:'negotiate'}}).allowedPorts,['negotiate']);
 assert.deepEqual(evaluateLogicNode(choice,{payload:{choiceId:'secret-ending'}}),{pass:false,allowedPorts:[]});
 assert.throws(()=>validateLogicNode({typeId:choice.typeId,data:{allowedChoices:['investigate','investigate']}}),{code:'LOGIC_NODE_CHOICES'});
});
