/**
 * Easy Plots — Proposed V1 platform-neutral public domain contracts
 * SPEC STATUS: DRAFT; NOT an implemented or Foundry-verified API.
 * IDs, field defaults, semantics, and native adapter signatures require validation.
 * This file intentionally avoids direct import of Foundry globals so multiple
 * implementation workstreams can consume it without binding to one system adapter.
 */

export type NarrativeId = string & { readonly __brand: 'NarrativeId' };
export type RevisionId = string & { readonly __brand: 'RevisionId' };
export type CorrelationId = string & { readonly __brand: 'CorrelationId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type ActorId = string & { readonly __brand: 'ActorId' };
export type WorldId = string & { readonly __brand: 'WorldId' };
export type UtcTimestamp = string & { readonly __brand: 'UtcTimestamp' };
export type NativeUUID = string & { readonly __brand: 'FoundryUUID' };

export type AccessClass = 'gm-secret' | 'gm' | 'observer-private' | 'party' | 'published';
export type KnowledgeAudience = 'gm' | 'recipient' | 'party' | 'public';
export type GraphEdgeType = 'flow' | 'condition' | 'event' | 'data' | 'relationship';
export type NodeRole = 'narrative' | 'logic' | 'effect' | 'presentation';
export type OwnerMode = 'borrowed' | 'shared' | 'exclusive' | 'detached';
export type CapabilityState = 'available' | 'missing' | 'incompatible' | 'unverified';
export type ContractVersion = `${number}.${number}.${number}`;

export interface AuditRef {
  readonly eventId?: NarrativeId;
  readonly operationId?: NarrativeId;
  readonly sourceRevision?: number;
  readonly sourceDocument?: NativeUUID;
  readonly authorId?: UserId;
  readonly decisionId?: string;
}
export interface RevisionedRecord {
  readonly id: NarrativeId;
  readonly kind: string;
  readonly schemaVersion: ContractVersion;
  readonly revision: number;
  readonly partitionId: string;
  readonly updatedAt: UtcTimestamp;
  readonly accessClass: AccessClass;
  readonly provenance: readonly AuditRef[];
}
export interface NativeBinding {
  readonly uuid: NativeUUID;
  readonly documentType: string;
  readonly status: 'valid' | 'missing' | 'stale' | 'ambiguous' | 'detached';
  readonly revisionHint?: string;
  readonly validatedAt?: UtcTimestamp;
}
export interface ReferenceRecord extends RevisionedRecord {
  readonly kind: 'reference';
  readonly entityId: NarrativeId;
  readonly binding?: NativeBinding;
  readonly aliases: readonly string[];
  readonly ownershipMode: OwnerMode;
  readonly lineage: readonly NarrativeId[];
}

export interface ScopeRef {
  readonly worldId: WorldId;
  readonly arcId?: NarrativeId;
  readonly plotId?: NarrativeId;
  readonly entityId?: NarrativeId;
  readonly observerId?: NarrativeId;
  readonly partitionId?: string;
}
export interface WorkBudget {
  readonly maxPartitionReads: number;
  readonly maxIndexHits: number;
  readonly maxGraphNodes: number;
  readonly maxEffects: number;
  readonly maxCausalDepth: number;
  readonly wallClockMs?: number;
}
export interface GMContext {
  /** Must be constructed after checking the authenticated local Foundry GM session. */
  readonly principal: 'verified-gm';
  readonly userId: UserId;
  readonly sessionEpoch: string;
  readonly worldId: WorldId;
  readonly authorizationRevision: string;
}
export interface ReadContext {
  readonly principalId: UserId;
  readonly audience: KnowledgeAudience;
  readonly actorContextId?: ActorId;
  readonly scope: ScopeRef;
  readonly budget: WorkBudget;
}
export interface GMWriteContext extends ReadContext {
  readonly gm: GMContext;
  readonly expectedPublishedRevision?: RevisionId;
}
export interface UntrustedTransportContext {
  readonly localObservedChannel: string;
  /** No userId from a socket packet is an authenticated principal on its own. */
  readonly senderIdentityStatus: 'unverified' | 'platform-attested';
  readonly attestedUserId?: UserId;
}

export type ValueType =
  | 'boolean' | 'string' | 'number' | 'integer' | 'date' | 'duration'
  | 'narrative-id' | 'entity-reference' | 'event' | 'state' | 'knowledge'
  | 'array' | `provider:${string}`;
export interface PortSpec {
  readonly id: string;
  readonly direction: 'input' | 'output';
  readonly valueType: ValueType;
  readonly multiplicity: 'single' | 'many';
  readonly required: boolean;
  readonly accessClass: AccessClass;
}
export interface GraphNodeV1 {
  readonly id: NarrativeId;
  readonly graphId: NarrativeId;
  readonly typeId: string;
  readonly typeVersion: ContractVersion;
  readonly label: string;
  readonly role: NodeRole;
  readonly ports: readonly PortSpec[];
  readonly data: Readonly<Record<string, unknown>>;
  readonly accessClass: AccessClass;
  readonly parentSubgraphId?: NarrativeId;
  readonly disabled?: boolean;
}
export interface GraphEndpoint { readonly nodeId: NarrativeId; readonly portId: string; }
export interface GraphEdgeV1 {
  readonly id: NarrativeId;
  readonly source: GraphEndpoint;
  readonly target: GraphEndpoint;
  readonly kind: GraphEdgeType;
  readonly priority?: number;
  readonly guard?: ConditionAstV1;
  readonly accessClass: AccessClass;
}
export interface NarrativeGraphV1 extends RevisionedRecord {
  readonly kind: 'graph';
  readonly name: string;
  readonly rootNodeId: NarrativeId;
  readonly nodes: readonly GraphNodeV1[];
  readonly edges: readonly GraphEdgeV1[];
  readonly subgraphRefs: readonly { id: NarrativeId; revision: RevisionId; portContract: readonly PortSpec[] }[];
  readonly requiredCapabilityIds: readonly string[];
  readonly semanticHash: string;
}
export type ConditionAstV1 =
  | { readonly op: 'all' | 'any'; readonly terms: readonly ConditionAstV1[] }
  | { readonly op: 'not'; readonly term: ConditionAstV1 }
  | { readonly op: 'compare'; readonly operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'; readonly left: ValueExpressionV1; readonly right: ValueExpressionV1 }
  | { readonly op: 'provider-predicate'; readonly providerId: string; readonly predicateId: string; readonly inputs: Readonly<Record<string, ValueExpressionV1>> };
export type ValueExpressionV1 =
  | { readonly type: 'literal'; readonly value: boolean | string | number | null }
  | { readonly type: 'reference'; readonly path: readonly string[]; readonly requiredPermission: AccessClass };

export interface NarrativeEventV1 extends RevisionedRecord {
  readonly kind: 'event';
  readonly eventType: string;
  readonly eventVersion: ContractVersion;
  readonly worldId: WorldId;
  readonly origin: { readonly kind: 'foundry-hook' | 'gm-decision' | 'approved-intent' | 'scheduler' | 'reconciliation'; readonly sourceId?: string };
  readonly causalParentIds: readonly NarrativeId[];
  readonly correlationId: CorrelationId;
  readonly originOperationId?: NarrativeId;
  readonly involvedActorIds: readonly ActorId[];
  readonly realTime: UtcTimestamp;
  readonly worldTime?: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadAccess: AccessClass;
}
export interface NarrativeStateRecord extends RevisionedRecord {
  readonly kind: 'state';
  readonly ownerId: NarrativeId;
  readonly stateType: string;
  readonly lastAppliedEventId?: NarrativeId;
  readonly data: Readonly<Record<string, unknown>>;
}
export interface EvaluationRecord extends RevisionedRecord {
  readonly kind: 'evaluation';
  readonly graphRevision: RevisionId;
  readonly triggerEventId: NarrativeId;
  readonly evaluatedNodeIds: readonly NarrativeId[];
  readonly inputRevisions: Readonly<Record<string, number>>;
  readonly reasonCodes: readonly string[];
  readonly outcome: 'qualified' | 'rejected' | 'review' | 'budget-exceeded' | 'unknown';
  readonly authorizedEffectIntents: readonly NarrativeId[];
}

export type PlayerRequestState = 'received' | 'validated' | 'queued' | 'rejected' | 'gm-review' | 'authorized' | 'executing' | 'verifying' | 'completed' | 'failed' | 'uncertain' | 'cancelled';
export interface PlayerIntentV1 extends RevisionedRecord {
  readonly kind: 'intent';
  readonly intentType: string;
  readonly requestState: PlayerRequestState;
  readonly claimedUserId?: UserId; // informational only, NOT proof of identity
  readonly verifiedUserId?: UserId; // populated only from verified native security gate
  readonly requestedActorId: ActorId;
  readonly opportunityId: NarrativeId;
  readonly approach?: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly expectedGraphRevision: RevisionId;
  readonly createdAt: UtcTimestamp;
}
export interface PublicRequestReceipt {
  readonly publicRequestId: string;
  readonly state: 'received' | 'pending' | 'resolved' | 'unavailable';
  readonly explanationCode: string; // must not reveal secret existence
}
export type EffectState = 'planned' | 'validated' | 'authorized' | 'prepared' | 'applying' | 'verifying' | 'completed' | 'denied' | 'failed' | 'uncertain' | 'compensation-proposed' | 'manually-reconciled';
export interface EffectOperationV1 extends RevisionedRecord {
  readonly kind: 'effect-operation';
  readonly effectId: NarrativeId;
  readonly operationState: EffectState;
  readonly causeEventId: NarrativeId;
  readonly nativeTarget?: NativeBinding;
  readonly providerId: string;
  readonly providerVersion: ContractVersion;
  readonly idempotencyKey: string;
  readonly expectedTargetRevision?: number;
  readonly intendedMutation: Readonly<Record<string, unknown>>;
  readonly nativeReceipt?: Readonly<Record<string, unknown>>;
  readonly verificationOutcome?: 'confirmed' | 'not-applied' | 'uncertain' | 'requires-gm';
}
export interface ApprovalDecision {
  readonly approver: UserId;
  readonly decision: 'approve' | 'deny' | 'request-more-context';
  readonly basisRevision: number;
  readonly reason?: string;
}

export interface FactV1 extends RevisionedRecord {
  readonly kind: 'fact';
  readonly subject: NarrativeId;
  readonly predicate: string;
  readonly value: unknown;
  readonly validFrom?: number;
  readonly validTo?: number;
}
export interface ClaimV1 extends RevisionedRecord {
  readonly kind: 'claim';
  readonly subject: NarrativeId;
  readonly predicate: string;
  readonly claimedValue: unknown;
  readonly observerId: NarrativeId;
  readonly confidence?: number;
  readonly evidenceIds: readonly NarrativeId[];
  readonly contradictedBy: readonly NarrativeId[];
  readonly sourceEventIds: readonly NarrativeId[];
}
export interface DisclosureV1 extends RevisionedRecord {
  readonly kind: 'disclosure';
  readonly sourceRecordId: NarrativeId;
  readonly recipientIds: readonly NarrativeId[];
  readonly newKnowledgeIds: readonly NarrativeId[];
  readonly mode: 'share' | 'rumor' | 'deduced' | 'corrected' | 'retracted';
  readonly authorizedBy: UserId;
}
export interface HypothesisV1 extends RevisionedRecord {
  readonly kind: 'hypothesis';
  readonly authorObserverId: NarrativeId;
  readonly claimIds: readonly NarrativeId[];
  readonly supportingEvidenceIds: readonly NarrativeId[];
  readonly contradictingEvidenceIds: readonly NarrativeId[];
  readonly publicStatus: 'proposed' | 'under-review' | 'withdrawn' | 'published-conclusion';
}
export interface SafeAffordance { readonly id: string; readonly label: string; readonly publicInputSchema: Readonly<Record<string, unknown>>; }
export interface SanitizedNarrativeView { readonly projectionId: string; readonly audience: KnowledgeAudience; readonly revision: string; readonly entries: readonly Readonly<Record<string, unknown>>[]; }
export interface PlayerViewScope { readonly observerId: NarrativeId; readonly actorContextId?: ActorId; readonly plotId?: NarrativeId; }
export interface SafePlayerActionInput { readonly affordanceId: string; readonly actorId: ActorId; readonly publicFields: Readonly<Record<string, unknown>>; }
export interface PlayerEvidenceLink { readonly hypothesisId: NarrativeId; readonly evidenceIds: readonly NarrativeId[]; }
export interface PlayerHypothesisInput { readonly claimIds: readonly NarrativeId[]; readonly publicEvidenceIds: readonly NarrativeId[]; }
export interface VotingIntent { readonly ballotId: NarrativeId; readonly choiceId: string; readonly actorId?: ActorId; }

export type MilestoneKind = 'discovery' | 'corroboration' | 'verified-conclusion' | 'decision' | 'intervention' | 'disclosure' | 'failure';
export interface MilestoneV1 extends RevisionedRecord {
  readonly kind: 'milestone';
  readonly objectiveId: NarrativeId;
  readonly milestoneType: MilestoneKind;
  readonly requiredEventTypes: readonly string[];
  readonly preconditions: ConditionAstV1;
  readonly completionPolicy: 'published-rule' | 'gm-review' | 'gm-manual';
  readonly repeatPolicy: 'once' | 'per-actor' | 'per-opportunity' | 'explicit-repeat';
  readonly awardIntentIds: readonly NarrativeId[];
}
export interface CrossPlotDependencyV1 {
  readonly id: NarrativeId;
  readonly sourceEventType: string;
  readonly sourceObjectiveId: NarrativeId;
  readonly targetObjectiveId: NarrativeId;
  readonly meaning: 'observe' | 'qualify' | 'unlock' | 'reevaluate' | 'aggregate' | 'react';
  readonly requiredConditions?: ConditionAstV1;
  readonly maxDepth: number;
}
export interface EndingContractV1 {
  readonly id: NarrativeId;
  readonly arcId: NarrativeId;
  readonly exclusiveGroup?: string;
  readonly prerequisites: ConditionAstV1;
  readonly outcomeFacets: Readonly<Record<string, unknown>>;
  readonly allowedCoOutcomes: readonly NarrativeId[];
  readonly requiresGMApproval: boolean;
}
export interface ArcResolutionRecordV1 extends RevisionedRecord {
  readonly kind: 'arc-resolution';
  readonly arcId: NarrativeId;
  readonly chosenEndingId: NarrativeId;
  readonly secondaryOutcomeIds: readonly NarrativeId[];
  readonly unresolvedThreadIds: readonly NarrativeId[];
  readonly committedEventId: NarrativeId;
  readonly approvedBy: UserId;
}
export interface ContinuityManifestV1 extends RevisionedRecord {
  readonly kind: 'continuity-manifest';
  readonly sourceArcId: NarrativeId;
  readonly sourceEndingRevision: RevisionId;
  readonly referencedEntityIds: readonly NarrativeId[];
  readonly dormantHookIds: readonly NarrativeId[];
  readonly independentObligationIds: readonly NarrativeId[];
  readonly activationPolicy: 'gm-manual' | 'published-and-authorized' | 'planning-only';
}
export interface TimeTransitionPlanV1 extends RevisionedRecord {
  readonly kind: 'time-transition-plan';
  readonly fromWorldTime: number;
  readonly toWorldTime: number;
  readonly dueEventIds: readonly NarrativeId[];
  readonly proposedOperationIds: readonly NarrativeId[];
  readonly unresolvedEventIds: readonly NarrativeId[];
  readonly dependencyRevisions: Readonly<Record<string, number>>;
}

export interface GraphPreflightReportV1 extends RevisionedRecord {
  readonly kind: 'publication-report';
  readonly candidateGraphId: NarrativeId;
  readonly candidateRevision: number;
  readonly findings: readonly {
    readonly code: string;
    readonly severity: 'pass' | 'warning' | 'blocker' | 'unverified';
    readonly affectedIds: readonly NarrativeId[];
    readonly explanation: string;
  }[];
  readonly dependencyRevisions: Readonly<Record<string, number>>;
  readonly requiredCoverageComplete: boolean;
  readonly gmAcknowledgementIds: readonly NarrativeId[];
}
export interface PublishedSnapshotV1 extends RevisionedRecord {
  readonly kind: 'published-graph';
  readonly graphId: NarrativeId;
  readonly sourceDraftRevision: number;
  readonly frozenGraph: NarrativeGraphV1;
  readonly preflightReportId: NarrativeId;
  readonly contentHash: string;
  readonly active: boolean; // A separate activation record may be preferable.
}

export interface IndexQuery {
  readonly indexName: string;
  readonly keyPrefix: string;
  readonly limit: number;
  readonly continuation?: string;
}
export interface IndexHit { readonly id: NarrativeId; readonly partitionId: string; readonly recordRevision: number; }
export interface PartitionHealth { readonly partitionId: string; readonly state: 'healthy' | 'stale' | 'missing' | 'unknown'; readonly indexRevision?: number; }
export interface RecordMutation { readonly recordId: NarrativeId; readonly newValue: Readonly<Record<string, unknown>>; readonly causeEventId: NarrativeId; }
export interface CommitResult { readonly status: 'committed' | 'conflict' | 'uncertain'; readonly revision?: number; }
export interface AppendResult { readonly status: 'recorded' | 'duplicate' | 'uncertain'; readonly recordId: NarrativeId; }
export interface Revisioned<T> { readonly value: T; readonly revision: number; }
export interface BindingResolution { readonly status: 'resolved' | 'missing' | 'ambiguous' | 'unauthorized'; readonly nativeUuid?: NativeUUID; }
export interface NarrativeRepository {
  read<T>(id: NarrativeId, ctx: ReadContext): Promise<Revisioned<T> | null>;
  readMany<T>(ids: readonly NarrativeId[], ctx: ReadContext): Promise<ReadonlyArray<Revisioned<T>>>;
  scanIndex(query: IndexQuery, ctx: ReadContext): AsyncIterable<IndexHit>;
  commit(record: RecordMutation, expectedRevision: number, ctx: GMWriteContext): Promise<CommitResult>;
  appendEvent(event: NarrativeEventV1, ctx: GMWriteContext): Promise<AppendResult>;
  appendOperation(operation: EffectOperationV1, ctx: GMWriteContext): Promise<AppendResult>;
  resolveBinding(ref: NativeBinding, ctx: ReadContext): Promise<BindingResolution>;
  getPartitionStatus(id: string, ctx: ReadContext): Promise<PartitionHealth>;
}

export interface CapabilityManifest {
  readonly providerId: string;
  readonly version: ContractVersion;
  readonly requiredFoundryRange: string;
  readonly supportedSystems: readonly { id: string; versionRange: string }[];
  readonly nodeTypeIds: readonly string[];
  readonly actionTypeIds: readonly string[];
  readonly declaredReadScopes: readonly string[];
  readonly requiredPermissions: readonly string[];
  readonly lazyEntrypoint: string;
}
export interface ValidatedEffect<I> { readonly data: I; readonly validationHash: string; }
export interface EffectVerification { readonly state: 'confirmed' | 'not-applied' | 'uncertain'; readonly evidence: Readonly<Record<string, unknown>>; }
export interface CompensationProposal { readonly description: string; readonly effectInput: Readonly<Record<string, unknown>>; readonly requiresGMApproval: true; }
export interface GMEffectContext extends GMWriteContext { readonly operationId: NarrativeId; }
export interface EffectProvider<I, O> {
  readonly manifest: CapabilityManifest;
  validate(input: I, ctx: GMEffectContext): Promise<ValidatedEffect<I>>;
  apply(input: ValidatedEffect<I>, ctx: GMEffectContext): Promise<O>;
  verify(input: ValidatedEffect<I>, result: O | null, ctx: GMEffectContext): Promise<EffectVerification>;
  proposeCompensation?(input: ValidatedEffect<I>, ctx: GMEffectContext): Promise<CompensationProposal>;
}

/**
 * Open V1 decisions:
 * - Player transport cannot be deemed authenticated by merely supplying UserId.
 * - Native Compendium visibility/locking and atomic-write behavior require spikes.
 * - PublishedSnapshot.active may migrate to an independent activation record.
 * - Numeric worldTime requires compatible calendar/time authority rules.
 * - Data migrations and field validation schemas must be defined before production.
 */
