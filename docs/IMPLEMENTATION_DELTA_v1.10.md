# Easy Plots — integrated checkpoint v1.10

This continues the supplied v1.09 source. All 125 decisions remain the target; the module is still in development. No real Foundry world or multiplayer final testing was run.

## Integrated behavior

- `src/graph/typed-data.mjs`: finite bounded JSON/scalar/entity types, protected data ports, named immutable child interfaces, payload bindings and typed comparisons. Unsafe keys, mismatched ports, ambiguous producers, missing required inputs and cycles fail preflight.
- `src/runtime/graph-data-frame.mjs`: lazy private data resolution from literals, canonical events, authoritative state, named parameters/exports and pinned pure subgraphs. Data links do not schedule flow or execute child effects. Bounds: 2 KiB per value, depth 8, 64 entries per container, 512 total entries per value, 32 resolved outputs and 8 nested calls per dependency frame; the router also applies its shared evaluation budget.
- `core.branch.data` selects an explicit true/false flow output from a protected typed boolean. `core.data.event` and `core.data.compare` compose event-to-boolean evaluation. Event values remain claims about the canonical occurrence; they never substitute for native state reads.
- `src/runtime/data-guards.mjs`: branch evidence records source revisions and selected ports without copying raw private values. Evidence follows the selected paths into nested event subgraphs and merges at all-input joins. Conflicting evidence fails closed.
- `DurableProposalReview`: reconstructs bound payloads, rejects altered static payloads, rechecks branch and data revisions on approval and again on execution. A state change, including creation after an absent-state branch or a same-value new revision, invalidates the proposal. This is bounded revision revalidation, not a cross-document atomic transaction.
- `DurableEventLedger`: verifies canonical event identity and fingerprint on read. The router clones a canonical occurrence before its first asynchronous lookup to avoid caller mutation during acceptance.
- Editor UI: literal/event/state values, comparisons, boolean branches and pure typed calls are authorable; explicit input selection supports multiple same-type inputs such as `left`/`right`. GM payload fields can be bound/unbound to typed outputs. None of these actions approves an effect.
- `FoundryOpposedRollCoordinator` and `resolveGMContestedCheck`: explicit GM-authored active/passive d20 checks, separate participant authorization, tie/partial policies, durable side observations and protected final results. Side observations have no invented DC or success classification. Lost acknowledgments and interrupted attempts require inspection rather than rerolling.
- Opt-in Combat create/update/delete and ChatMessage-create observations retain only bounded provenance/field names, not combatant lists, message content, recipients or roll values. Hook admission includes pending subscription lookups and respects explicit stop during a lookup.
- Module manifest: author Somel, requested easy-plots URL structure, English/pt-PT locale declarations and actual runtime asset paths. The main editor actions are localized; full-interface localization remains outstanding. `verified: 14.369` follows the author's requested manifest convention, not evidence of real-world certification. No hosting URL was uploaded or published.

## Reproducible evidence

- Node 24.19.0: `npm run check` — syntax checks and **710 tests passed**, 0 failed, 0 skipped. Record: `node-test-v1.10.log`.
- `npm run spec:check` — original 125 decision mappings, 125 proposed acceptance scenarios, 97 candidates, 54 logical storage groups, JSON schemas, TypeScript proposals and current audit consistency passed. The proposed Foundry scenarios remain unexecuted.
- `python tests/browser/editor-smoke.py` — Chromium smoke passed, including typed port connections, comparison/branch publication, pt-PT labels and existing GM/player screens. Record: `browser-check-v1.10.log`.
- User-supplied Foundry references: generation 14, stable build 369; **13 static signatures** confirmed. See `FOUNDRY_SOURCE_AUDIT_v1.10.json`. This does not establish live permissions, multiplayer safety or performance.

Some command-sandbox restrictions obscure Node child-test reporting or prevent Chromium startup. The recorded complete runs used the supported command escalation with inherited proxy/TLS configuration. A file-only count is not the 710-case result.

## Remaining implementation

`NODE_CONTRACT_AUDIT.csv` covers all 97 original candidates, including actual default editor ports, code/test pointers and specific mismatches. Seven mappings have targeted local contract tests; 90 still await individual semantic review. These are preliminary inventory classifications, not a verified gap audit. The earlier 48 interface-gap / 42 service-only split was not supported by individual end-to-end analysis and is withdrawn as a measure of missing functionality; see `COVERAGE_REPORT_CORRECTION.md`.

`DECISION_TRACEABILITY.csv` includes all 125 decisions and exact local ADR references when present. Neither a row nor a test-file pointer is automatic proof of the original complete acceptance scenario. Historical rough matches such as `core.condition` for graph preflight, or fact/persona mutation nodes for read-only data providers, are no longer presented as valid graph mappings.

Next implementation fronts remain in scope: mixed data/effect subgraph calls; authored approval/rate-budget/approved-operation continuation contracts; typed domain read/output providers; complete domain/player/GM workflows; system-specific adapters and remaining UI/localization; migration, repair, compatibility and qualification. Final live Foundry testing begins after functional completion, not after this checkpoint.

## Packaging

`python tools/package.py` produces deterministic source and native-module ZIPs with SHA-256 checksums, validates declared runtime assets and refuses to overwrite different existing artifacts. The module ZIP root is `easy-plots/`, including `lang/`. Foundry reference source and local development dependencies stay outside the checkout and distributions.

No commit, push, hosting publication or final feature-completeness claim was performed.
