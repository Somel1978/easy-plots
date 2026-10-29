# Easy Plots implementation delta — v0.51 through v0.58

This is **incremental coding within one complete-module implementation**, not a sequence of production releases. All new checks are automated debugging coverage. Live Foundry end-to-end checks remain part of final system integration, per the user-approved development process.

## v0.51 — GM-approved native Actor and Item shells

- Added `src/platform/foundry-actor-item-provider.mjs`.
- Typed shell materialization for system-declared world Actor and Item types, using opaque native IDs, `ownership.default=0`, protected provenance and read-back inspection.
- Native create is never blindly repeated after a prepared provenance record; ambiguous completion demands reconciliation.
- Added editor/catalog providers `core.resource.materialize-actor` and `core.resource.materialize-item` and fully journaled pipeline tests.

## v0.52 — Protected bindings to existing native resources

- Added `src/platform/foundry-resource-binding.mjs` and node `core.resource.bind-native`.
- Typed, revision-controlled binding to an existing world Actor, Item or JournalEntry without editing the native document.
- Explicit rebind and detach retain stable narrative identity. The provider does not claim exclusive ownership without a verified reverse-reference coordination contract.
- Added publication → event → approved binding integration tests.

## v0.53 — Observed co-GM handover fencing

- `DesignatedGMWriter` now pins the observed designated GM and can monitor `updateUser`, `createUser` and `deleteUser` Hooks.
- A transient observed coordinator change suspends local writes even if the original GM later resumes. Reconciliation is explicitly required.
- This is **not** server-side atomic CAS or a distributed lock: overlapping co-GM native updates remain outside the guaranteed scope.

## v0.54 — Unlinked scene-token Actor authorization

- `createScopedActorAuthorizer` supports the explicit `Scene.<id>.Token.<id>` form, restricted to a player viewing that scene and owning the synthetic unlinked Actor.
- Linked-token Actor authorization continues through the world Actor ownership path. Mere scene/token visibility does not authorize an intent.
- Native request and investigation-board adapters now use the scoped verifier.

## v0.55 — Bounded reverse-reference tracking

- Added `NativeReverseReferenceLedger`: protected links from narrative dependents to exact native Actor, Item, JournalEntry UUIDs.
- Checks the live protected binding on link creation; supports explicit retirement and read-only drift/orphan audits.
- Index lookups are partitioned by scope and hashed native UUID, never by global campaign scan.

## v0.56 — GM Native Resource Inspector

- Added a read-only ApplicationV2 inspector for a known stable resource ID or one native UUID's reverse-reference partition.
- All DOM data uses text nodes rather than untrusted HTML. Scoped queries only; no automatic native fixes or deletions.
- `openResourceInspector()` is exposed through the GM module API after native repository composition.
- Added browser smoke coverage.

## v0.57 — Journaled reverse-reference graph effect

- Added `core.resource.track-reference` with explicit link/retire contract and `narrative.track-native-reference` provider.
- The reverse-reference effect follows the same published graph → event ledger → GM approval → effect journal route as other narrative consequences.
- A failed dependency check creates an uncertain journal state rather than silently applying a later retry.

## v0.58 — Native resource origin invariants

- Native materialization/binding nodes default to the graph's actual stable ID for `sourceGraphId`.
- Draft save/publication rejects origin IDs that do not match the source graph.
- Added four positive and four negative preflight cases.

## Local validation results

- **498 passing Node tests** including new integration, authorization, handover and provenance tests.
- Chromium DOM smoke passed for authoring, GM approvals, Planning Lab and Resource Inspector.
- Specification consistency checks passed for 125 decisions and 97 proposed node contracts (not one-to-one implementation proof).
- No live Foundry world, multiplayer scenario, or complete user end-to-end test was run in these batches.

## Outstanding implementation (not deferred to a separate product release)

- Audit exact behavioral equivalence for all 97 proposed specialized node-provider contracts and implement missing semantics.
- Expand native Foundry game-system adapters and authored actor/item activities under validated capability restrictions.
- Complete advanced GM and player workflows for factions, relationships, investigations, arcs and scenario continuity.
- Complete authoritative co-GM conflict coordination without claiming unsupported native transactions.
- Integrate migration/recovery and reverse-reference reconciliation across all domain lifecycle events.
- Perform final comprehensive Foundry v14 integration and multiplayer validation only when the agreed feature implementation is complete.
