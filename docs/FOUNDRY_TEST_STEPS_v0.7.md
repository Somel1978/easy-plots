# Easy Plots v0.7 — Disposable Foundry v14.369 Test Procedure

This document describes **manual tests that have NOT been executed in this workspace**. Do not use real campaign documents or secrets.

## A. Sandbox/UI — no live modifications

1. Make a disposable Foundry 14.369 world, preferably with a GM and two player accounts.
2. Install `easy-plots` under `Data/modules/easy-plots/` and enable the module.
3. As GM, open the browser console and run:

   ```js
   const ep = game.modules.get('easy-plots').api;
   ep.openStatus();
   ep.openEditor();
   ep.reactiveStatus;
   ```

4. Create a simple event-trigger → condition → effect-proposal graph; save, publish and activate it. Verify `reactiveStatus.running === false` and that no world effect executes.
5. Reload; verify the *sandbox* graph is absent. This is correct and protects worlds from accidental writes.
6. As a player, confirm no privileged GM editor or event-inspector action is available.

## B. Native permission and request transport gates

- Follow `docs/NATIVE_VERIFICATION_PLAN.md` and `tools/native-pack-access-probes.mjs` using synthetic canaries in a world-owned private `JournalEntry` Compendium.
- Test index, direct document/database reads, flags, bootstrap metadata and reconnect behavior for every non-GM role, **not just sidebar visibility**.
- Test socket authenticated sender parameter, forgery rejection, targeted recipient delivery, backpressure and disconnects as described in `docs/FOUNDRY_14_369_SOURCE_FINDINGS.md`.
- Capture exact Foundry build, pack ID, user roles and pass/fail evidence. Do not fabricate attestation objects or trust a client-only success indicator.
- Never enable protected native storage if any private metadata is retrievable by a player.

## C. Hook callback shape and safe routing

Before enabling native reactive Hooks, run a metadata-only probe in the GM console:

```js
const {installEasyPlotsHookProbe} = await import('/modules/easy-plots/tools/foundry-hook-observation-probe.mjs');
const probe = installEasyPlotsHookProbe();
// Edit a harmless test Actor and Journal Entry in the disposable world.
probe.results(); // only Hook name, documentName, UUID-present and userId-present
probe.stop();
```

Confirm callback signatures and that unexpected user payload values never enter the Easy Plots event ledger.

Only after successful **live** storage and Hook tests should an eligible GM use the guarded `configureVerifiedNative(...)` API with recorded evidence and an explicit, knowledge-safe `checkOpportunity` callback. Then inspect `ep.startVerifiedReactiveHooks()` opt-in. Those APIs must fail closed when evidence is absent. Publishing/activating a test graph subscribes the event type, but does **not** authorize effects.

Use `ep.openEventReview()` or `await ep.inspectNarrativeEvent(eventId)` to inspect a *known* durable event and its proposed operations. Validate that unauthorized clients cannot read this data. The event review UI must have no Execute button.

## D. Multi-GM and recovery

- Change designated GM during an intentionally interrupted *synthetic* index write; confirm the losing writer is suspended rather than continuing.
- Confirm an interrupted event records `prepared`, `evaluating` or `uncertain` and is not automatically replayed as a fresh event.
- Verify stale subscription records cannot execute an inactive graph or old published revision.
- Reconcile index pages using the explicit repository operations only after comparing real persisted data.

**Do not enable real game-document effects from this build.** A completed live security test would not by itself guarantee distributed multi-GM fencing, migration safety or native effect correctness.
