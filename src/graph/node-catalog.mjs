import {NARRATIVE_NODE_EFFECT_PROVIDER,NARRATIVE_NODE_DEFAULTS} from '../runtime/narrative-capabilities.mjs';
import {LOGIC_NODE_TYPES} from './logic-nodes.mjs';
import {DATA_NODE_TYPES} from './typed-data.mjs';
/** Shared graph-node contract; every supported node has a single provider mapping.
 * A type may be edited only when it has an actual runtime implementation.
 */
export const DOMAIN_EFFECT_NODE_PROVIDER=Object.freeze({
  'core.faction.standing':'narrative.change-faction-standing',
  'core.faction.review-agenda':'narrative.review-faction-agenda',
  'core.faction.schedule-reviewed-action':'narrative.schedule-reviewed-faction-action',
  'core.npc.schedule-reviewed-action':'narrative.schedule-npc-action',
  'core.obligation.resolve':'narrative.resolve-obligation',
  'core.investigation.attest-evidence':'narrative.attest-evidence',
  'core.investigation.reviewed-hypothesis':'narrative.review-investigation-hypothesis',
  'core.investigation.apply-board-edit':'narrative.apply-player-board-edit',
  'core.milestone.complete-reviewed':'narrative.complete-investigation-milestone',
  'core.world.fact':'narrative.record-world-fact',
  'core.relationship.transition':'narrative.set-relationship',
  'core.knowledge.belief':'narrative.record-observer-belief',
  'core.quest.objective':'narrative.transition-objective',
  'core.knowledge.disclose':'narrative.record-disclosure',
  'core.knowledge.approve-recipient':'narrative.approve-knowledge-recipient',
  'core.knowledge.publish-native':'narrative.publish-known-content',
  'core.notification.queue':'narrative.queue-notification',
  'core.arc.conclude':'narrative.finalize-arc',
  'core.story.hook':'narrative.transition-story-hook',
  'core.time.scheduled-action':'narrative.transition-scheduled-action',
  'core.resource.materialize-journal':'narrative.materialize-journal-shell',
  'core.resource.materialize-actor':'narrative.materialize-actor-shell',
  'core.resource.materialize-item':'narrative.materialize-item-shell',
  'core.resource.bind-native':'narrative.bind-native-reference',
  'core.resource.ordered-batch':'narrative.execute-ordered-native-batch',
  'core.resource.activate-manifest':'narrative.activate-resource-manifest',
  'core.location.region':'narrative.location-region',
  'core.resource.track-reference':'narrative.track-native-reference'
});
export const GRAPH_NODE_TYPES=Object.freeze([
  'core.trigger.event','core.trigger.manual','core.trigger.schedule-due','core.trigger.document-event','core.trigger.operations-completed','core.trigger.reviewed-plan','core.trigger.encounter-closed','core.trigger.resource-activation','core.condition','core.branch.condition','core.branch.data','core.state.read','core.flow.join','core.subgraph.call','core.effect.proposal','core.milestone.qualify',
  ...Object.keys(DOMAIN_EFFECT_NODE_PROVIDER),...Object.keys(NARRATIVE_NODE_EFFECT_PROVIDER),...LOGIC_NODE_TYPES,...DATA_NODE_TYPES
]);
export const DOMAIN_NODE_DEFAULTS=Object.freeze({...NARRATIVE_NODE_DEFAULTS,
  'core.resource.activate-manifest':{scope:'world',manifestId:'ep:manifest:example_001',expectedManifestRevision:1,graphId:'ep:graph:example_001',publishedVersion:1,expectedActivationRevision:1},
  'core.location.region':{scope:'world',regionId:'ep:location:example_region001',locationIds:[],routeIds:[],expectedRevision:null},
  'core.resource.ordered-batch':{scope:'world',batchId:'ep:batch:example_001',expectedBatchRevision:1,batchFingerprint:'0'.repeat(64)},
  'core.notification.queue':{scope:'world',noticeId:'ep:notice:example_001',recipientId:'ep:actor:example_001',groupKey:'narrative-update',publicGroup:null,level:'info',gmDetail:'GM-only context',safeText:'An authorized narrative update',expiresAt:null},
  'core.knowledge.publish-native':{scope:'world',publicationId:'ep:publication:example_001',expectedPublicationRevision:2},
  'core.investigation.apply-board-edit':{scope:'world',requestId:'ep:board-edit:example_001',expectedRequestRevision:1,shareWith:[]},
  'core.npc.schedule-reviewed-action':{scope:'world',scheduleId:'ep:schedule:example_001',commitmentId:'ep:scheduled:npc_example001',expectedScheduleRevision:1,expectedAgendaRevision:1,knowledgeReceiptIds:[],correctionIds:[],worldTime:0},
  'core.faction.schedule-reviewed-action':{scope:'world',decisionId:'ep:agenda-decision:example_001',commitmentId:'ep:scheduled:example_001',dueAt:100},
  'core.faction.review-agenda':{scope:'world',agendaId:'ep:agenda:example_001',ruleId:'review-operation',knowledgeReceiptIds:[],worldTime:0,expectedAgendaRevision:1},
  'core.knowledge.approve-recipient':{scope:'world',planId:'ep:propagation:example_001',recipientId:'ep:actor:example_001',expectedPlanRevision:1,worldTime:0},
  'core.milestone.complete-reviewed':{scope:'world',milestoneId:'ep:milestone:example_001',expectedContractRevision:1,expectedProgressRevision:1},
  'core.investigation.reviewed-hypothesis':{scope:'world',investigationId:'ep:investigation:example_001',hypothesisId:'ep:hypothesis:example_001',observerId:'ep:actor:example_001',expectedRevision:1,title:'Investigate the manifest',reasoning:'Evidence supports this approach',arguments:[],shareWith:[]},
  'core.resource.track-reference':{scope:'world',resourceId:'ep:resource:example_bound',dependentId:'ep:node:dependent_001',nativeUuid:'Actor.abcdefghijklmnop',action:'link',expectedRevision:null,visibility:'gm-only'},
  'core.resource.bind-native':{scope:'world',resourceId:'ep:resource:example_bound',sourceGraphId:'ep:graph:example_001',documentKind:'Actor',nativeId:'abcdefghijklmnop',previousNativeId:null,action:'bind',ownership:'borrowed',expectedRevision:null,visibility:'gm-only'},
  'core.resource.materialize-actor':{scope:'world',resourceId:'ep:resource:example_actor',sourceGraphId:'ep:graph:example_001',documentType:'npc',expectedRevision:null,visibility:'gm-only'},
  'core.resource.materialize-item':{scope:'world',resourceId:'ep:resource:example_item',sourceGraphId:'ep:graph:example_001',documentType:'loot',expectedRevision:null,visibility:'gm-only'},
  'core.resource.materialize-journal':{scope:'world',resourceId:'ep:resource:example_001',sourceGraphId:'ep:graph:example_001',expectedRevision:null,visibility:'gm-only'},
  'core.world.fact':{scope:'world',factId:'ep:fact:example_001',value:'The shipment was diverted',status:'asserted',expectedRevision:null},
  'core.relationship.transition':{scope:'world',relationshipId:'ep:relationship:example_001',fromId:'ep:actor:example_001',toId:'ep:actor:example_002',relation:'ally',status:'active',expectedRevision:null},
  'core.knowledge.belief':{scope:'world',beliefId:'ep:belief:example_001',observerId:'ep:actor:example_001',claimId:'ep:claim:example_001',stance:'uncertain',knownEvidenceIds:[],expectedRevision:null},
  'core.quest.objective':{scope:'world',objectiveId:'ep:objective:example_001',state:'active',previousState:null,expectedRevision:null},
  'core.knowledge.disclose':{scope:'world',disclosureId:'ep:disclosure:example_001',claimId:'ep:claim:example_001',sourceId:'ep:actor:example_001',recipientIds:['ep:actor:example_002'],expectedRevision:null},
  'core.arc.conclude':{scope:'world',arcId:'ep:arc:example_001',resolutionId:'ep:resolution:example_001',endingId:'partial-victory',outcome:'concluded',openThreadIds:[],expectedRevision:null},
  'core.story.hook':{scope:'world',hookId:'ep:hook:example_001',sourceArcId:'ep:arc:example_001',status:'dormant',expectedRevision:null},
  'core.time.scheduled-action':{scope:'world',scheduleId:'ep:schedule:example_001',ownerId:'ep:faction:example_001',actionId:'reconvene',dueWorldTime:100,status:'pending',expectedRevision:null}
});

export const ALL_EFFECT_NODE_PROVIDER=Object.freeze({...DOMAIN_EFFECT_NODE_PROVIDER,...NARRATIVE_NODE_EFFECT_PROVIDER});
