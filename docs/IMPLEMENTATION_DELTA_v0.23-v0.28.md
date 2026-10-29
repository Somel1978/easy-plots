# Easy Plots integrated development delta v0.23–v0.28

This is an incremental coding checkpoint, not a separate release or a request for user testing. The complete agreed module remains the final delivery scope.

## Executable advances

1. **Typed narrative capabilities** — 18 additional explicitly validated, GM-only effect providers. Each writes a deterministic scoped record through the guarded repository with revision CAS checks, operation/source-event provenance, read-back verification and one-time handling for immutable historical entries.
2. **Graph logic** — 16 pure bounded logic nodes (including 10 domain gates), with authoring schema validation and protected, event-derived decisions; no implicit truth oracle, client-side data authorization, or autonomous effects.
3. **Published subgraphs** — version-pinned child-graph traversal using on-demand targeted retrieval, nested evaluation limits and recursion detection. Nested effect proposals retain the full root-to-child reference chain so GM approval can verify that the root is still active and every call matches its immutable published revision.
4. **Editor usability** — scrollable and zoomable SVG canvas, row-wrapped node placement, corrected zoom-aware dragging, and deterministic paged-draft titles without reading full graphs.
5. **Preflight** — typed effect payload validation for the existing faction, obligation and evidence providers; cycle detection prevents manual/imported unbounded flow loops.
6. **Cross-plot indexing** — GM-only bounded dependency index that reads by event type, checks scope, known facts and target revisions, and returns only eligibility for local evaluation. It cannot execute cross-plot effects or automatically disclose knowledge.

## Automated evidence

- Baseline v0.22: 208 Node tests.
- Integrated v0.28: 294 Node tests, zero failures.
- Chromium DOM harness: passed (including graph zoom, GM reviews and player-safe board UI).
- Architecture specification consistency: passed (125 decisions, 97 proposed catalog entries). These are traceability checks, **not 125 implementation acceptance tests**.
- Full real Foundry v14 world testing remains scheduled for the end of full implementation as requested.

## Known remaining implementation scope

The module is not yet feature-complete against all 125 decisions. Missing work includes richer faction/NPC/quest/relationship and map interfaces; full procedural and knowledge-propagation systems; robust time-jump orchestration and narrative foresight integration; native adapters for all game-system activities; all specialized node providers from the proposed catalog; and complete subsystem migration/reconciliation flows. These should continue in coordinated coding batches without intermediate user approval.

## Security boundaries

All new capability records are GM-only. No player projection is built directly from a stored capability record. Requests and effects still follow the existing protected GM authority and durable approval gateways. Development does not require a separately running backend/server.
