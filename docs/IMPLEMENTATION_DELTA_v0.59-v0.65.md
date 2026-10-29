# Easy Plots — Implementation delta v0.59–v0.65

The complete-module project remains one Foundry v14+ module, with no external backend. These are coordinated implementation checkpoints, not independent releases or requests for per-batch manual testing.

## v0.59 — Historical causal explanations
- Reactive event evaluations now durably record bounded, GM-private node outcomes (`passed`, `condition-blocked`, `logic-blocked`, branch choices, etc.) without copying event payloads into trace entries.
- `explainNarrativeEvent` reads only one authorized event and filters one graph's evaluations. Incomplete or missing evaluation is not mislabeled a failed condition.
- GM Cockpit includes a historical explanation control; `api.explainNarrativeEvent(graphId,eventId)` is available in protected native mode.

## v0.60 — Reviewed investigation hypotheses
- Added `GMInvestigationWorkbench`: revision-controlled, event-attributed hypotheses, knowledge-aware evidence citations, authorized recipient checks and safe player board projections.
- Fixed evidence-citation mapping when private evidence IDs differ from public player IDs. Duplicate public IDs are rejected.
- Direct reviewed-hypothesis GM API available for existing workflows; the v0.65 journaled effect path below is preferred for graph-authored operations.

## v0.61 — Indexed due-time candidates
- `NativeTemporalIndex`: durable bounded bucket writes and read-back checks. Queries must validate every candidate against the authoritative schedule revision and state.
- Stale entries cannot trigger events. The index does not simulate intervening days or execute consequences.

## v0.62 — Coordinated schedules
- `GMTemporalCoordinator` persists one bounded scheduled commitment and stages its due-time index.
- Explicit status-resolution events are separate from underlying Actor/faction effects; interrupted indexing is reported as uncertain and recoverable.

## v0.63 — Causality-aware cross-plot checks
- `GMCrossPlotCoordinator` requires a verified source-plot ID, scoped knowledge policies and a fresh canonical target revision. Same event type alone is insufficient.
- GM-only `api.previewCrossPlotDependencies()` returns eligibility proposals, not effects or player disclosures.

## v0.64 — GM Causal Planning Inspector
- New ApplicationV2 read-only window for bounded temporal and cross-plot queries; no player controls and no mutation actions.
- Exposed through `api.openCausalPlanningInspector()` after protected native composition.

## v0.65 — Journaled reviewed-hypothesis node
- Added `core.investigation.reviewed-hypothesis` -> `narrative.review-investigation-hypothesis` with typed publication validation.
- GM-approved proposals are recorded through the existing EffectCoordinator and durable journal.
- Hypothesis source event and operation identity are derived from approved effect context; canonical truth is never accepted as a node payload field.
- Full local integration test covers graph authoring, publication, event evaluation, approval, effect journaling and safe board projection.

## Verification
- 525 passing Node tests (498 baseline + 27 new tests).
- Chromium UI smoke harness passed.
- Existing 125-decision specification validator passed.
- 103 built-in authorable node types, **not** a claim that all original 97 proposed contracts have matching semantics. Continue using `docs/PROPOSED_NODE_CONTRACT_TRACE_v0.50.csv` for conservative contract coverage reporting.
- Full live Foundry end-to-end testing remains a single final project phase, after complete feature implementation.

## Open full-module work
- Complete behavioral coverage of each proposed node contract, including system adapters and more complex narrative policies.
- Advanced NPC, faction, knowledge, quest, arc, timeline, encounter and player-facing interfaces and integration.
- Authority handover and native multi-client integration test harness, migration coverage, installation and full module verification.
