# Easy Plots v1.13 — reliable intake, mixed graphs and reviewed planning

The existing v1.12 project is continued in place. This is a development checkpoint, not final Foundry acceptance.

## Critical intake and bounded admission

`NativeSignalReliability` composes a protected policy, a sharded pending-intake index, immutable original Hook metadata, the existing event ledger and the existing nonexecuting reactive router. Policy selects critical/best-effort tiers for the eight supported native event types. Best effort remains the default.

Critical discovery is staged before its full intake row and before graph-admission backpressure. A dropped observed critical signal remains available after restart. Interruption between discovery and full storage is shown as incomplete intake; current native state is never used to invent its missing payload. Raw document values, private chat text and arbitrary source fields are not copied. Embedded Item UUIDs remain supported in intake even though source checkpoint watching is limited to supported root documents.

Recovery inspects the original occurrence and its event fingerprint. A matching already accepted event can confirm intake without being resubmitted. Prepared/evaluating/uncertain events remain under the existing journal recovery rules. Explicit GM resumption is available only for an original pending signal that has not reached the event ledger. This evaluates proposals; separate effect approval remains mandatory. Reviewed dismissal preserves its reason and provenance. Per-occurrence local serialization fences concurrent resume/dismiss actions; native distributed atomicity is not claimed.

The pending index has eight deterministic buckets of at most 64 entries, revision-bound pages of at most 32 candidates, verified read-back and local per-bucket serialization. Critical persistence admits at most four concurrent captures by default, configurable up to eight. Overflow stops listeners and reports the exact critical event identity for review rather than pretending durable acceptance. Index cleanup interruptions remain discoverable and can be explicitly reconciled, including confirmed no-target and dismissed signals. Long-lived native record capacity and automatic repartitioning remain separate limitations.

## Scoped source reconciliation

Up to 32 explicitly configured root Actor, Item, JournalEntry, Combat or ChatMessage sources retain verified existence/modification checkpoints. Each request examines at most eight named sources. The native adapter rechecks designated-GM authority, exact collection/document identity, OWNER access and finite modification metadata. No source content is serialized. Source deletion also requires review.

A changed source with no matching recorded observation produces a durable review flag. This does not establish how many callbacks were missed or what happened between checkpoints. Coalesced or transient updates cannot be reconstructed from modification metadata. Coverage is explicitly limited to configured native sources.

Acknowledgement binds the exact reviewed native stamp and source-record revision and requires a reason. A subsequent change rejects stale acknowledgement. Source review cannot erase pending original signals. A previously detected gap also cannot be silently cleared by a later ordinary signal. Policy edits retain old source checkpoints so that retired settings do not hide outstanding review.

## Native lifecycle and interface

Verified Hook startup loads protected policy asynchronously and can be cancelled before listeners are registered. Opening or configuring the reliability window never enables Hooks. The existing exact-world attestation gates remain required.

Own protected-storage Journal Hooks are excluded before normalization and critical intake. This fixes a feedback risk where writing a signal, index or journal could itself create another narrative signal. The excluded pack identity comes from verified native composition. The supplied v14 sources confirm native pack identity and modification metadata APIs; this inspection is not a live-world test.

The GM Signal Reliability window, with English and Portuguese (Portugal) labels, integrates policy configuration, pending pages, original-signal inspection, journal reconciliation, reviewed resumption/dismissal, source checks and stamp-bound acknowledgement. Inputs invalidate review, authored strings remain inert, and GM revocation removes protected controls. Chromium exercises it against the real local service and event router.

## Canonical event contract

New native, GM-manual and due-event producers explicitly emit `eventVersion: 1.0.0`, bounded `causalParentIds` and correlation identity. Version and finite plain-JSON checks occur before routing/persistence. Parent occurrences must already exist in the same protected ledger. Reusing an occurrence with changed lineage is an identity conflict.

For versioned intake, the ledger retains both its established private runtime projection and a full canonical Event document matching the proposed v1 descriptor. The document contains world identity, original GM authorship, origin, correlation, causal parents, recorded acceptance time, optional known current world time, payload and GM access classification. It has its own immutable fingerprint and is cross-checked against the runtime projection on read. Its revision remains zero while the processing journal advances through lifecycle revisions. Recorded acceptance time is not proof that a proposed consequence occurred; actor participation is not inferred.

`canonical-event-schema.mjs` matches the proposed Event schema and is pinned by `spec/Canonical_Event_Compatibility.json`. Stable descriptor changes require a new supported version and explicit compatibility/migration handling. UI source is not part of that descriptor. Unsupported versions fail closed. Existing unversioned events preserve their original content/fingerprint and are explicitly recognized as legacy, without an inferred upgrade. No automatic historic migration is implemented or claimed.

The combined canonical document and review evidence are checked against the native record budget. Qualification fingerprints now cover normative specification inputs as well as source, tests, languages and manifests; changed acceptance inputs invalidate old evidence.

## Mixed graphs and verified continuations

`core.subgraph.mixed` combines named typed inputs/exports with a separate flow that proposes child effects. Pure data consumption cannot execute that flow. Published interfaces remain pinned; separate invocations have distinct operation identities. GM review reconstructs the call chain, parameters and selected state revisions before approval and execution.

`ApprovedOperationEventGateway` verifies both the completed proposal review and its matching completed effect journal before producing a fresh causally linked continuation. The `core.trigger.operations-completed` node can require several source nodes from an exact immutable version. Approval without execution, uncertain outcomes and mismatched provenance never qualify. The receiving graph evaluates current state and requires its own effect approvals. Event Review exposes this complete workflow.

## Published graph simulation and reviewed live plans

The planning lab runs the actual pinned graph evaluator with isolated state hypotheses, an isolated effect journal and injectable apply-ack/verification faults. Native providers and extension callbacks are never invoked. Proposed native payloads remain unqualified plans; no canonical events or real effects occur.

A saved plan is reviewed immutably, previewed as a GM-authored live intent and explicitly submitted through `ReviewedPlanEventGateway`. An authored `core.trigger.reviewed-plan` graph maps its suggestion into new proposals; each still requires separate GM effect approval. Submission rechecks observed source revisions, stages a stable event identity durably and can resume after interruption. Already accepted/uncertain events are never replayed. Hypothetical native origins, event IDs and diagnostic fault injections cannot become native evidence. Editing the planning input clears the displayed saved review and live submission controls.

## Persistent NPC actions and temporal catch-up

Approved NPC agenda/schedule graph effects now write the canonical records read by `PersistentNPCActions`. Both providers are version 1.1; older hashed capability records require explicit fingerprint/revision-bound adoption and remain intact. NPC ownership and established agenda links cannot be retargeted.

NPC action preparation resolves selected durable knowledge receipts for that NPC, claim revisions, selected corrections, disclosure time and independent canonical fact prerequisites. World truth alone never grants NPC knowledge. The new `core.npc.schedule-reviewed-action` effect prepares an indexed pending commitment through the normal approval journal. Due admission rechecks all recorded source observations. Neither preparation nor becoming due establishes an off-screen outcome. The GM inspector exposes assessment and indexed due-event review. Accepted legacy due events retain their identity across GM handover without replay.

`PersistentTemporalCatchup` retains one bounded candidate page before committing its bucket cursor. Explicit steps inspect one to eight buckets; pages survive interruption before cursor commit and are reused after restart. Completion means enumeration, never execution. Coverage is the index observed per retained bucket; late/backdated writes or index repairs need a new job. The inspector creates jobs, resumes progress and reads exact retained buckets. Dense buckets remain bounded. Fictional time zero is now discoverable. Canonical scopes have separate temporal buckets; existing world bucket locators remain compatible, while legacy non-world commitments require explicit exact-record index repair.

## Portable graph templates

`PortableGraphTemplates` reuses the immutable blueprint catalog and graph pages. Portable export normalizes internal graph/node/edge identities and replaces external narrative/native identifiers, state keys, scopes and pinned child references with explicit typed slots. Unsupported embedded references fail closed. The portable fingerprint is verified before storage or materialization; different pinned child versions remain separate bindings.

Reviewed instances have fresh graph/node/edge IDs, remapped internal connections/resource provenance and an exact `templateSource` revision. Creation stores a linked draft only, never activates it or creates native resources. A retained instance preparation survives an interrupted draft write; retries cannot overwrite local edits or change reviewed bindings. Publishing a newer template leaves earlier instances pinned. The existing blueprint field-adoption workflow remains separate from applying graph-level updates.

The GM template desk supports export/download, imported JSON verification, immutable storage, explicit binding fields, review and draft creation. Editing a binding/title invalidates the creation approval. Templates support at most 64 distinct bindings and a 5,000-byte catalog descriptor; graph pages keep existing bounded graph limits. Native destination permissions and effect contracts are still checked by later normal publication/GM execution, never inferred from a typed UUID binding.

## Structured player investigation edits

Authenticated native board requests now expose a v2 allowlisted projection with an opaque visible-content token and an own-theory edit permission. Public clue references map back to the exact known canonical evidence on the GM. Hidden-only changes do not change that public token. Undisclosed boards, forged senders, revoked Actor ownership, hidden clue references, reused client requests and truth-oracle fields fail closed.

Private fingerprinted requests feed a bounded GM desk. An explicitly prepared handler is a draft until the GM publishes/activates it; proposed edits require an independent durable effect approval and Execute. Own-theory revisions supersede the current view while preserving prior canonical records/history. A partially completed write remains uncertain and cannot be silently dismissed or repeated. The board form and player portal use the authenticated transport; native startup also requires verified nonbroadcast delivery.

## Continued plot authority, presentation and domain closure

Per-plot owner/grants now enforce edit, publish and activate independently through one physical GM writer. Authenticated targeted GM commands use internal requester capabilities and protected prepared/completed/uncertain receipts; unknown outcomes never replay. The editor, permission desk and original-request inspector share this contract. Explicit successor approval adoption preserves original review history and never executes the effect itself.

Version-pinned live appearance is separate from immutable graph execution. Private titles, labels and positions update the GM view/cockpit under edit rights; structural fields, stale activation and unknown indexes are rejected. Reset retains history. Canonical entity/persona nodes reuse existing revisioned domain effects, recipient knowledge and relationship providers, including irreversible alias retirement and optional native shell resolution. Native Compendium tests cover reconstruction without creating an Actor.

One observed native Combat deletion and one verified completed outcome produce an immutable world-wide canonical closure selection. Its stable causal event is retained even without subscribers and matching consequences remain proposals. Alternate selections, scope changes, GM succession and lost ACKs cannot duplicate the accepted closure.

A declared third-party action wraps one allowlisted core narrative capability with fixed scope/constants and typed inputs. Target version, action version and canonical manifest SHA-256 are pinned. Registration invokes no effects or extension callbacks; native recovery requires exact re-registration. An integrated native three-quest dispatch test confirms selective lookup and exactly three independently approved state writes, with no replay after duplicate ingress.

## Validation and limits

- **1,147 actual Node cases pass, zero failures/skips; 214 runtime modules pass syntax checks.** Latest evidence is recorded in `local-test-evidence-v1.13.jsonl` and the current Node/browser/spec logs. Functional closure is now reviewed; the next phase is real Foundry world qualification.
- Chromium exercises mixed graphs, verified continuations, published graph simulation, saved/reviewed/live planning with separate effect approval, NPC knowledge/due review and catch-up recovery after reopening the window.
- The evidence matrix records related local proof and remaining limitations, not completed decisions or a completion percentage.
- No real Foundry world, multiplayer, final migration/recovery or representative-load suite was run. No commit, push or upload occurred. Proprietary Foundry sources remain outside the repository and packages.

## Integrated functional closure

Six parallel fronts and root integration completed persistent spatial regions/known atlas routes; immutable alternative timeline versions and source-proven canonical selection; multiplot private session preparation; static compilation with exact persisted dependencies and publication severity/coverage; adaptive native index/posting partitions and lazy tiers; and bounded graph/cross-event convergence. Root also completed native resources planned→materialized→active, exact immutable setup-source preflight, and posting-cursor catchup across dense time buckets. These integrate with existing authoring, effect approval, journals, projections and native writer fences.

125 individual engineering reviews and97 semantic mapping dispositions now produce a passing functional qualification gate. The release matrix remains blocked pending actual native evidence. See FULL_SCOPE_QUALIFICATION.csv, SEMANTIC_CONTRACT_TRACE.csv and QUALIFICATION_STATUS.json. No arbitrary batch estimate or completed-scenario percentage is derived from test counts.
