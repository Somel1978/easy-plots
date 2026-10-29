/**
 * Easy Plots — Cross-domain V1 PROPOSALS (not an executable engine).
 * Extends Contracts_V1_Proposed.ts. These interfaces must be validated by real
 * Foundry integrations and reconciled with the original decision register.
 * NO runtime claims, secret data transmission, or automatic background workers.
 */
import type {
  AccessClass, ActorId, AuditRef, CapabilityManifest, ConditionAstV1,
  ContractVersion, CorrelationId, GMWriteContext, KnowledgeAudience,
  NarrativeEventV1, NarrativeId, PlayerIntentV1, ReadContext,
  RevisionedRecord, UtcTimestamp, UserId, WorldId, RevisionId,
} from './Contracts_V1_Proposed';

export type StableEntityKind =
  | 'npc' | 'actor-persona' | 'faction' | 'location' | 'region'
  | 'object' | 'clue' | 'obligation' | 'quest' | 'arc' | 'plot';
export type ConfidenceBand = 'unknown' | 'low' | 'medium' | 'high' | 'verified';
export type Entitlement = 'gm' | 'owner' | 'delegate' | 'party' | 'public';
export type ArtifactReadiness = 'draft' | 'validated' | 'published' | 'active' | 'suspended' | 'archived';
export type ProposedChangeStatus = 'proposed' | 'needs-review' | 'authorized' | 'applied' | 'rejected' | 'uncertain';

// Identity and social domain
export interface NarrativeEntityV1 extends RevisionedRecord {
  readonly kind: 'entity';
  readonly entityKind: StableEntityKind;
  readonly displayName: string;
  readonly nativeBindings: readonly { uuid: string; purpose: string }[];
  readonly aliases: readonly { text: string; sinceEventId?: NarrativeId; visibleTo: AccessClass }[];
  readonly lifecycle: 'active' | 'retired' | 'merged' | 'archived';
  readonly replacedBy?: NarrativeId;
}
export interface IdentityPersonaV1 extends RevisionedRecord {
  readonly kind: 'persona';
  readonly entityId: NarrativeId;
  readonly personaName: string;
  readonly representedActorId?: ActorId;
  readonly lineageEventIds: readonly NarrativeId[];
  readonly disclosurePolicy: AccessClass;
}
export interface DirectionalRelationshipV1 extends RevisionedRecord {
  readonly kind: 'relationship';
  readonly fromEntityId: NarrativeId;
  readonly toEntityId: NarrativeId;
  readonly personaContextId?: NarrativeId;
  readonly observerContextId?: NarrativeId;
  readonly relationType: string;
  readonly status: string;
  readonly validFromWorldTime?: number;
  readonly evidenceEventIds: readonly NarrativeId[];
  readonly notInterchangeableWith?: readonly NarrativeId[];
}
export interface NarrativeObligationV1 extends RevisionedRecord {
  readonly kind: 'obligation';
  readonly creditorId: NarrativeId;
  readonly debtorId: NarrativeId;
  readonly obligationType: 'favor' | 'debt' | 'contract' | 'promise' | 'other';
  readonly state: 'open' | 'disputed' | 'fulfilled' | 'waived' | 'expired';
  readonly creationEventId: NarrativeId;
  readonly resolutionEventId?: NarrativeId;
  readonly dueWorldTime?: number;
}

// Factions: membership, renown and rank/privileges MUST remain distinct.
export interface FactionMembershipV1 extends RevisionedRecord {
  readonly kind: 'faction-membership';
  readonly factionId: NarrativeId;
  readonly entityId: NarrativeId;
  readonly membership: 'none' | 'candidate' | 'member' | 'former' | 'secret';
  readonly rankId?: NarrativeId;
  readonly privilegeIds: readonly NarrativeId[];
  readonly lastChangeEventId: NarrativeId;
}
export interface FactionRenownV1 extends RevisionedRecord {
  readonly kind: 'faction-renown';
  readonly factionId: NarrativeId;
  readonly observerOrEntityId: NarrativeId;
  readonly renown: number;
  readonly lastChangeEventId: NarrativeId;
  readonly visibilityPolicy: AccessClass;
}
export interface FactionAgendaV1 extends RevisionedRecord {
  readonly kind: 'faction-agenda';
  readonly factionId: NarrativeId;
  readonly objectiveId: NarrativeId;
  readonly dueWorldTime?: number;
  readonly qualifyingConditions: ConditionAstV1;
  readonly mustKnowFactIds: readonly NarrativeId[];
  readonly authorizedEffectProviderIds: readonly string[];
  readonly policy: 'gm-review' | 'published-rule' | 'manual';
  readonly active: boolean;
}

// Spatial domain: historical location and route accessibility kept separate.
export interface LocationNodeV1 extends RevisionedRecord {
  readonly kind: 'location';
  readonly parentLocationId?: NarrativeId;
  readonly regionId?: NarrativeId;
  readonly discoveredByIds: readonly NarrativeId[];
  readonly nativeSceneBindings: readonly string[];
  readonly mapLayerId?: NarrativeId;
}
export interface TravelRouteV1 extends RevisionedRecord {
  readonly kind: 'route';
  readonly fromLocationId: NarrativeId;
  readonly toLocationId: NarrativeId;
  readonly direction: 'one-way' | 'two-way';
  readonly availability: ConditionAstV1;
  readonly travelDurationSeconds?: number;
  readonly observationPolicy: AccessClass;
}

// Knowledge: observer claim is not a canonical fact; provenance survives correction.
export interface EvidenceV1 extends RevisionedRecord {
  readonly kind: 'evidence';
  readonly sourceEntityId?: NarrativeId;
  readonly sourceEventId: NarrativeId;
  readonly nativeDocumentUuid?: string;
  readonly claimIds: readonly NarrativeId[];
  readonly availableToObserverIds: readonly NarrativeId[];
  readonly reliabilityDescriptor?: string;
}
export interface ObserverBeliefV1 extends RevisionedRecord {
  readonly kind: 'belief';
  readonly observerId: NarrativeId;
  readonly claimId: NarrativeId;
  readonly currentStance: 'unaware' | 'uncertain' | 'accepts' | 'rejects' | 'suspended';
  readonly confidence: ConfidenceBand;
  readonly supportingEvidenceIds: readonly NarrativeId[];
  readonly contradictingEvidenceIds: readonly NarrativeId[];
  readonly lastUpdateEventId: NarrativeId;
}
export interface CommunicationPolicyV1 {
  readonly allowedChannels: readonly ('spoken' | 'letter' | 'chat' | 'journal' | 'faction-intelligence')[];
  readonly recipients: readonly NarrativeId[];
  readonly propagationDepthLimit: number;
  readonly requiresReview: boolean;
  readonly distortionPolicyId?: string;
}
export interface ClaimPropagationV1 extends RevisionedRecord {
  readonly kind: 'claim-propagation';
  readonly initiatingDisclosureEventId: NarrativeId;
  readonly sourceClaimId: NarrativeId;
  readonly policy: CommunicationPolicyV1;
  readonly visitedObserverIds: readonly NarrativeId[];
  readonly pendingRecipientIds: readonly NarrativeId[];
  readonly nextDueWorldTime?: number;
  readonly lastCausalEventId?: NarrativeId;
}

// Investigations: public theory arguments never automatically reveal canonical truth.
export interface InvestigationObjectiveV1 extends RevisionedRecord {
  readonly kind: 'investigation-objective';
  readonly plotId: NarrativeId;
  readonly discoveryOpportunityIds: readonly NarrativeId[];
  readonly eligibleEvidenceIds: readonly NarrativeId[];
  readonly conclusionPolicy: 'gm-review' | 'published-rule' | 'manual';
  readonly unresolvedIsValid: boolean;
}
export interface InvestigatorContributionV1 extends RevisionedRecord {
  readonly kind: 'investigator-contribution';
  readonly objectiveId: NarrativeId;
  readonly actorId: ActorId;
  readonly contributionType: 'evidence' | 'reasoning' | 'check' | 'decision' | 'disclosure';
  readonly sourceEventId: NarrativeId;
  readonly sharedWithIds: readonly NarrativeId[];
}
export interface TheoryArgumentV1 extends RevisionedRecord {
  readonly kind: 'theory-argument';
  readonly hypothesisId: NarrativeId;
  readonly authorObserverId: NarrativeId;
  readonly publicEvidenceIds: readonly NarrativeId[];
  readonly supportingClaimIds: readonly NarrativeId[];
  readonly contradictingClaimIds: readonly NarrativeId[];
  readonly statedConclusion: string;
  readonly visibility: AccessClass;
}
export interface ProtectedTruthReviewV1 extends RevisionedRecord {
  readonly kind: 'protected-truth-review';
  readonly hypothesisId: NarrativeId;
  readonly reviewerId: UserId;
  readonly canonicalFactIds: readonly NarrativeId[];
  readonly assessment: 'supported' | 'partially-supported' | 'refuted' | 'unverifiable';
  readonly publishableFindingEventId?: NarrativeId;
}

// Quests, objective state and independent event-linked milestone attribution.
export interface QuestProjectionV1 extends RevisionedRecord {
  readonly kind: 'quest-projection';
  readonly plotId: NarrativeId;
  readonly audience: KnowledgeAudience;
  readonly visibleMilestoneIds: readonly NarrativeId[];
  readonly publicStatus: 'active' | 'pending' | 'resolved' | 'suspended';
  readonly projectionRevision: string;
}
export interface MilestoneAwardV1 extends RevisionedRecord {
  readonly kind: 'milestone-award';
  readonly milestoneId: NarrativeId;
  readonly qualifiedByEventId: NarrativeId;
  readonly scope: 'party' | 'actor' | 'opportunity';
  readonly scopeId: NarrativeId;
  readonly idempotencyKey: string;
  readonly approvedBy?: UserId;
  readonly state: 'eligible' | 'pending-approval' | 'completed' | 'reconciled';
  readonly consequenceOperationIds: readonly NarrativeId[];
}

// NPC behavior and timed operations: due != occurred.
export interface NpcScheduleEntryV1 extends RevisionedRecord {
  readonly kind: 'npc-schedule';
  readonly npcId: NarrativeId;
  readonly dueWorldTime: number;
  readonly plannedActivityId: string;
  readonly requiredContext: ConditionAstV1;
  readonly state: 'scheduled' | 'due' | 'review' | 'completed' | 'cancelled';
  readonly establishedOutcomeEventId?: NarrativeId;
}
export interface WorldClockV1 {
  readonly observedWorldSeconds: number;
  readonly optionalCalendarAdapterId?: string;
  readonly epochRevision: string;
}
export interface TimeDueRecordV1 extends RevisionedRecord {
  readonly kind: 'time-due';
  readonly parentRecordId: NarrativeId;
  readonly dueAtWorldSeconds: number;
  readonly duePolicy: 'derived-expiration' | 'conditional-action' | 'gm-review';
  readonly prerequisitesRevision: number;
  readonly currentStatus: 'scheduled' | 'due' | 'pending-review' | 'resolved' | 'cancelled';
}

// Encounter and roll source adapter: roll mechanics != narrative disclosure.
export interface RollPolicyV1 {
  readonly adapterId: string;
  readonly rollKind: 'active' | 'passive' | 'contested' | 'group';
  readonly visibility: 'public' | 'gm' | 'blind' | 'private';
  readonly successBands: readonly { id: string; minInclusive?: number; maxInclusive?: number }[];
  readonly gmAdjudicationRequired: boolean;
}
export interface NarrativeRollResultV1 extends RevisionedRecord {
  readonly kind: 'roll-result';
  readonly sourceRequestId: NarrativeId;
  readonly policyId: NarrativeId;
  readonly adapterId: string;
  readonly rollArtifactUuid?: string;
  readonly numericResult?: number;
  readonly outcomeBandId?: string;
  readonly disclosedToObserverIds: readonly NarrativeId[];
  readonly causalEventId: NarrativeId;
}

// Multi-actor voting / deliberate attempt identity.
export interface NarrativeVoteV1 extends RevisionedRecord {
  readonly kind: 'vote';
  readonly objectiveId: NarrativeId;
  readonly eligibleActorIds: readonly ActorId[];
  readonly quorumRule: { readonly kind: 'count' | 'fraction' | 'all'; readonly value?: number };
  readonly deadlineWorldSeconds?: number;
  readonly offlinePolicy: 'hold' | 'ignore' | 'manual';
  readonly publicChoices: readonly { id: string; label: string }[];
  readonly resolutionPolicy: 'gm-reviewed' | 'published-rule';
  readonly state: 'open' | 'resolved' | 'expired' | 'cancelled';
}
export interface NarrativeAttemptIdentityV1 {
  readonly opportunityId: NarrativeId;
  readonly actorId: ActorId;
  readonly approachFingerprint: string;
  readonly evidenceRevision: string;
  readonly meaningfulTimeContext?: number;
  readonly explicitNewAttemptApprovalEventId?: NarrativeId;
  readonly transportRetryNonce?: string; // never alone establishes a new fictional attempt
}

// Resource lifecycle and blueprints; GM modifications are protected.
export interface ResourceManifestV1 extends RevisionedRecord {
  readonly kind: 'resource-manifest';
  readonly sourceTemplateId?: NarrativeId;
  readonly resourceRefs: readonly {
    readonly logicalId: NarrativeId;
    readonly nativeUuid: string;
    readonly ownership: 'borrowed' | 'shared' | 'exclusive' | 'detached';
    readonly materializedByEventId?: NarrativeId;
    readonly lastVerifiedRevision?: string;
    readonly gmModified: boolean;
  }[];
  readonly preparationState: 'planned' | 'materializing' | 'ready' | 'review' | 'archived';
}
export interface GraphBlueprintV1 extends RevisionedRecord {
  readonly kind: 'blueprint';
  readonly publishedGraphRevision: RevisionId;
  readonly baseBlueprintRevision?: RevisionId;
  readonly graphOverridePatch: Readonly<Record<string, unknown>>;
  readonly instanceIds: readonly NarrativeId[];
  readonly mergePolicy: 'gm-reviewed-three-way';
}
export interface BlueprintMergeConflictV1 {
  readonly blueprintId: NarrativeId;
  readonly instanceId: NarrativeId;
  readonly path: readonly string[];
  readonly baseRevision: RevisionId;
  readonly sourceRevision: RevisionId;
  readonly instanceRevision: RevisionId;
  readonly protectionClass: AccessClass;
  readonly decision: 'unresolved' | 'keep-instance' | 'adopt-source' | 'manual-merge';
}

// Campaign resolution, handoff and what-if safety.
export interface ArcOutcomeFacetV1 {
  readonly facetId: NarrativeId;
  readonly outcomeKind: string;
  readonly qualifiedByEventIds: readonly NarrativeId[];
  readonly currentlyEstablished: boolean;
  readonly publicationScope: AccessClass;
}
export interface ArcHandoffV1 extends RevisionedRecord {
  readonly kind: 'arc-handoff';
  readonly sourceArcResolutionId: NarrativeId;
  readonly currentEntityRefIds: readonly NarrativeId[];
  readonly unresolvedObligationIds: readonly NarrativeId[];
  readonly dormantHookIds: readonly NarrativeId[];
  readonly publishedRecapIds: readonly NarrativeId[];
  readonly activationPolicy: 'gm-only' | 'published-trigger' | 'planning-only';
}
export interface SimulationSandboxV1 {
  readonly sandboxId: string;
  readonly baseSnapshotIds: readonly NarrativeId[];
  readonly baseRevisions: Readonly<Record<string, number>>;
  readonly hypotheticalEventIds: readonly NarrativeId[];
  readonly effectWrites: false;
  readonly allowPublicProjection: false;
  readonly resourceBudget: { readonly partitions: number; readonly events: number; readonly causalDepth: number };
}
export interface ForesightFindingV1 extends RevisionedRecord {
  readonly kind: 'foresight-finding';
  readonly generatedFromRevisionIds: readonly RevisionId[];
  readonly boundedDependencies: readonly NarrativeId[];
  readonly findingType: 'deadline' | 'pressure' | 'risk' | 'opportunity' | 'unresolved-choice';
  readonly recommendedGMAction?: string;
  readonly status: 'fresh' | 'stale' | 'unverified';
  readonly createsCanonicalEvents: false;
}

// Graph publication and separate activation contract (fixes provisional active bool).
export interface GraphActivationV1 extends RevisionedRecord {
  readonly kind: 'graph-activation';
  readonly publishedSnapshotId: NarrativeId;
  readonly publishedRevision: RevisionId;
  readonly state: 'inactive' | 'active' | 'suspended' | 'archived';
  readonly authorityEpoch: string;
  readonly lastValidatedAt: UtcTimestamp;
  readonly activatedByEventId?: NarrativeId;
}

// Typed errors: public code must not reveal whether protected identifiers exist.
export type PublicNarrativeErrorCode =
  | 'REQUEST_UNAVAILABLE' | 'INVALID_PUBLIC_INPUT' | 'ACTION_PENDING'
  | 'ACTION_RESOLVED' | 'RETRY_LATER';
export type ProtectedNarrativeErrorCode =
  | 'PERMISSION_DENIED' | 'PRIVATE_REFERENCE' | 'MISSING_REFERENCE'
  | 'STALE_REVISION' | 'UNSUPPORTED_CAPABILITY' | 'MISSING_INDEX'
  | 'BUDGET_EXCEEDED' | 'INVARIANT_VIOLATION' | 'UNCERTAIN_EFFECT'
  | 'UNKNOWN_CONTRACT_VERSION';
export interface PublicNarrativeError {
  readonly error: PublicNarrativeErrorCode;
  readonly receiptId?: string;
  readonly retryAfter?: number;
}
export interface GMNarrativeDiagnosticV1 {
  readonly code: ProtectedNarrativeErrorCode;
  readonly correlationId: CorrelationId;
  readonly relevantRevisionIds: readonly RevisionId[];
  readonly recordIds: readonly NarrativeId[];
  readonly safeRationale: string;
  readonly sourceEventId?: NarrativeId;
}

// Logical signatures, not validated Foundry-native methods.
export interface NarrativeCommandsV1 {
  proposeIntent(input: PlayerIntentV1, verifiedNativeOrigin: unknown): Promise<{ receiptId: string; status: 'queued' | 'rejected' }>;
  publishGraph(graphId: NarrativeId, candidateRevision: number, gm: GMWriteContext): Promise<{ snapshotId?: NarrativeId; status: 'published' | 'blocked' | 'conflict' }>;
  setActivation(snapshotId: NarrativeId, state: GraphActivationV1['state'], gm: GMWriteContext): Promise<{ status: ProposedChangeStatus }>;
  runScopedEvaluation(event: NarrativeEventV1, gm: GMWriteContext): Promise<{ outcomeEventIds: readonly NarrativeId[]; pendingOperationIds: readonly NarrativeId[] }>;
  getPlayerProjection(observerId: NarrativeId, context: ReadContext): Promise<Readonly<Record<string, unknown>>>;
  simulate(snapshotIds: readonly NarrativeId[], gm: GMWriteContext): Promise<SimulationSandboxV1>;
}

/**
 * SECURITY NOTE: unknown transport source is not proof of principal identity.
 * This API must NEVER be wired to raw socket payloads as an authority mechanism.
 * All `AccessClass` fields are classification metadata; actual storage/access
 * boundaries must be enforced and tested at the native Foundry document layer.
 */
export interface NativeProvenanceAdapter {
  readonly adapterId: string;
  readonly contractVersion: ContractVersion;
  readonly proofStatus: 'verified-on-exact-foundry-build' | 'unverified';
  attestRequestOrigin(sourceHandle: unknown): Promise<{
    readonly authenticatedUserId: UserId;
    readonly sourceArtifactId: string;
    readonly serverEnforcedOwnershipVerified: true;
  } | null>;
  exposeResultToRecipient(result: Readonly<Record<string, unknown>>, intendedRecipient: UserId): Promise<{ readonly outcome: 'published-private' | 'refused' }>;
}
