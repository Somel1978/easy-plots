# Easy Plots — Integrated implementation delta v0.66–v0.72

The project continues as **one Foundry VTT v14+ module**, with no external backend. These are internal implementation checkpoints, not separate releases or per-batch live-testing requests.

## v0.66 — Durable, reviewed campaign arc closure

- `PersistentArcResolutions` loads canonical scoped arc revisions, evaluates authored ending contracts, and refuses exclusive/unknown alternatives.
- Resolution is staged separately from the canonical arc, with historical facets, unresolved thread references, and an explicit uncertain/reconciliation state.
- No automatically executed world effects, epilogue publication or sequel activation.
- Interruption tests cover failure before the canonical arc write and after the arc write but before resolution confirmation.

## v0.67 — Published blueprints and safe instance updates

- `PersistentBlueprintCatalog` preserves versioned published revisions and separate linked instance snapshots.
- Three-way updates adopt unchanged source fields, preserve instance overrides, and require explicit field-level decisions for true conflicts.
- Published source revisions cannot be overwritten, and adoption never modifies a Foundry Actor/Item or a live graph by itself.

## v0.68 — Knowledge receipts and corrections

- `PersistentKnowledgeLedger` stores canonical claims and independently approved observer-specific disclosure receipts.
- Knowledge projections use explicit, bounded receipt IDs and omit canonical truth, private source IDs, and hidden record counts.
- Corrections create distinct historical events without rewriting original disclosures; recipients see correction status only when the approved correction reference is provided.

## v0.69 — ApplicationV2 Continuity Desk

- GM-only interface for arc finalization, blueprint adoption, and knowledge projection, accessible with `ep.openContinuityDesk()` from a verified protected native integration.
- Preview and an explicit acknowledgement are required before authored arc or blueprint transitions. Input edits invalidate the current preview.
- Secure random IDs use the shared cryptographic generator, including HTTP LAN fallback; output uses `textContent`.
- Chromium DOM smoke test covers approval gating and mocked arc finalization.

## v0.70 — Persistent investigation milestone qualification

- `PersistentInvestigationMilestones` stores typed milestone contracts, canonical known-evidence contributions, review eligibility, and a separate one-time completion.
- A submitted theory or secret canonical truth cannot qualify a conclusion without an independent verification event.
- The safe projection includes only disclosed public IDs/titles and completion state, never secret milestones or aggregate hidden totals.

## v0.71 — Journaled GM-reviewed milestone node

- Added `core.milestone.complete-reviewed` -> `narrative.complete-investigation-milestone` with typed payload validation at graph publication.
- Integrated path: authored node → published snapshot → indexed narrative event → persistent GM proposal → approval → effect journal → milestone completion → safe projection.
- The provider verifies causal operation identity and cannot repeat a milestone awarded through a different operation.

## v0.72 — Persistent narrative votes

- `PersistentNarrativeVotes` stores authored, scoped choices, participants, deadlines and policy plus one private immutable ballot per participant.
- Decision evaluation uses bounded deterministic per-participant lookups, not a global ballot scan.
- Finalization requires quorum, eligibility and explicit GM action; private results are never published before finalization.
- Player projections use authored *public* decision IDs, not canonical private IDs or ballot records.
- The callable ballot-write service is GM-only; verified participant context must be supplied by a trusted authenticated adapter before binding it to player sockets.

## Automated validation

- 552 passing Node tests; zero failures.
- Syntax check across source modules passed.
- Chromium UI smoke harness passed, including the new Continuity Desk.
- Existing 125-decision/97-candidate-node/50-storage-group specification consistency checks passed.

## Additional technical work to complete

- Remaining original specialized node contract semantics and behavioral traceability, beyond matching catalog counts.
- Integration of full faction/NPC/encounter/player UIs and game-system adapters.
- More operations routed through the GM-approved causal effect journal instead of GM-only direct domain services.
- Native Foundry multi-client and cross-GM end-to-end verification at the final project testing phase.
