import test from 'node:test';
import assert from 'node:assert/strict';
import {ADVANCED_LOGIC_CONFIG,validateAdvancedLogicNode,evaluateAdvancedLogicNode} from '../src/graph/advanced-logic.mjs';
import {LOGIC_NODE_CONFIG,LOGIC_NODE_TYPES,validateLogicNode,evaluateLogicNode} from '../src/graph/logic-nodes.mjs';
import {EDITABLE_NODE_TYPES,makeEditableGraph,GraphEditorModel} from '../src/editor/model.mjs';
import {GraphRegistry} from '../src/graph/registry.mjs';
const id=t=>`ep:${t}:example_001`;
const validEvents={
'core.gate.event-origin':{sourceId:id('actor'),originVerified:true},
'core.gate.causal-depth':{causalDepth:2},
'core.gate.after-time':{worldTime:100},
'core.gate.before-time':{worldTime:50},
'core.gate.faction-pressure':{factionId:id('faction'),pressure:5},
'core.gate.investigation-progress':{investigationId:id('investigation'),verifiedMilestones:3},
'core.gate.evidence-corroborated':{corrobEventVerified:true,corroboratedEvidenceIds:[id('evidence')]},
'core.gate.obligation-status':{obligationId:id('obligation'),obligationStatus:'outstanding'},
'core.gate.npc-disposition':{npcId:id('npc'),observerId:id('actor'),disposition:'friendly'},
'core.gate.milestone-credit':{milestoneId:id('milestone'),creditedActorIds:[id('actor')]},
'core.gate.identity-persona':{entityId:id('entity'),personaId:id('persona'),identityVerified:true},
'core.gate.route-status':{routeId:id('route'),routeStatus:'open'},
'core.branch.investigation-outcome':{investigationId:id('investigation'),outcomeVerified:true,investigationOutcome:'partial'},
'core.branch.arc-ending':{arcId:id('arc'),endingId:'partial-victory',endingEligibility:'eligible'},
'core.branch.threat-clock':{clockId:id('clock'),ticks:6},
'core.gate.social-debt':{debtorId:id('faction'),creditorId:id('actor'),obligationStatus:'outstanding'},
'core.gate.faction-operation':{agendaId:id('agenda'),agendaStatus:'active'},
'core.gate.resource-integrity':{resourceId:id('resource'),integrityStatus:'tracked'},
'core.gate.blueprint-version':{blueprintId:id('blueprint'),blueprintVersion:2},
'core.gate.player-contribution':{objectiveId:id('objective'),contributionVerified:true,contributorIds:[id('actor')]},
'core.gate.campaign-readiness':{arcId:id('arc'),continuityState:'reviewed'},
'core.gate.identity-disclosure':{entityId:id('entity'),disclosureVerified:true,identityObserverIds:[id('actor')]},
'core.branch.request-result':{requestId:id('request'),requestOutcomeVerified:true,requestState:'approved'},
'core.branch.reputation':{factionId:id('faction'),actorId:id('actor'),standing:8}
};
for(const [typeId,config] of Object.entries(ADVANCED_LOGIC_CONFIG))test(`specialized gate ${typeId} authorable, validates, executes`,()=>{
  assert.ok(LOGIC_NODE_TYPES.includes(typeId));assert.ok(EDITABLE_NODE_TYPES.some(x=>x.id===typeId));
  const node={typeId,data:structuredClone(config.data)};
  assert.equal(validateLogicNode(node),true);
  const result=evaluateLogicNode(node,{payload:validEvents[typeId]});
  assert.equal(result.pass,true);
  if(typeId==='core.branch.investigation-outcome')assert.deepEqual(result.allowedPorts,['partial']);
  if(typeId==='core.branch.arc-ending')assert.deepEqual(result.allowedPorts,['eligible']);
  if(typeId==='core.branch.threat-clock')assert.deepEqual(result.allowedPorts,['breached']);
  if(typeId==='core.branch.request-result')assert.deepEqual(result.allowedPorts,['approved']);
  if(typeId==='core.branch.reputation')assert.deepEqual(result.allowedPorts,['positive']);
  const malformed={typeId,data:{...config.data,unrecognized:'secret'}};
  assert.throws(()=>validateAdvancedLogicNode(malformed));
});
test('specialized logic fails closed for missing corroboration and unverified outcomes',()=>{
  assert.equal(evaluateLogicNode({typeId:'core.gate.evidence-corroborated',data:ADVANCED_LOGIC_CONFIG['core.gate.evidence-corroborated'].data},{payload:{corroboratedEvidenceIds:[id('evidence')]}}).pass,false);
  assert.equal(evaluateLogicNode({typeId:'core.branch.investigation-outcome',data:ADVANCED_LOGIC_CONFIG['core.branch.investigation-outcome'].data},{payload:{investigationId:id('investigation'),investigationOutcome:'solved'}}).pass,false);
  assert.equal(evaluateLogicNode({typeId:'core.gate.identity-persona',data:ADVANCED_LOGIC_CONFIG['core.gate.identity-persona'].data},{payload:{entityId:id('entity'),personaId:id('persona')}}).pass,false);
});
test('advanced node editor attaches only its declared ports',()=>{
  const editor=new GraphEditorModel({registry:{}});const graph=editor.newGraph('Advanced decision');
  const nodeId=editor.addNode('core.branch.investigation-outcome');
  const created=editor.selectedNode;
  assert.equal(created.id,nodeId);
  assert.deepEqual(created.ports.filter(p=>p.direction==='output').map(p=>p.id),['solved','partial','failed','unresolved']);
  assert.equal(editor.connect(graph.rootNodeId,nodeId)!==null,true);
});
