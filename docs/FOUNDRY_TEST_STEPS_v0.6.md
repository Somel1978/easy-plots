# Easy Plots v0.6 — Disposable Foundry v14.369 Test World

## Install / explore the GM sandbox

1. Back up any world you care about. Use **a separate disposable world**, not an active campaign.
2. Extract the development module ZIP inside `Data/modules/` so the final structure is `Data/modules/easy-plots/module.json`.
3. Enable Easy Plots in the world's Module Management. Use a verified Foundry v14.369 installation.
4. Join as a GM. Open the browser console (F12), and run:

   ```js
   game.modules.get('easy-plots').api.openStatus();
   game.modules.get('easy-plots').api.openEditor();
   ```

5. In the editor, create a plot, add a condition and effect proposal, connect the nodes, edit the inspector, save, validate, publish, and activate the published graph. All actions remain **sandbox-only**, unless a separate guarded native integration has been explicitly verified/configured.
6. Reloading the browser loses sandbox graphs. In this build activation changes only the registry's state; it deliberately does **not** subscribe to real Hooks or perform world effects.
7. Join as a player. The normal module API should not permit opening GM tools or writing protected records. These checks are necessary but insufficient to certify native Compendium secrecy.

## Before enabling real native storage

Run the included `tools/native-pack-access-probes.mjs` instructions with one GM and multiple player roles against a synthetic world-owned JournalEntry pack. Test direct pack index queries, direct document/database queries, client bootstrap state, metadata, and socket traffic for every non-GM role. Repeat after configuration/permission changes.

Native configuration is NOT done automatically. Only a GM with genuine, recorded live evidence for the exact pack and Foundry build should provide that evidence to `api.configureVerifiedNative(...)`. Never fabricate attestation flags. If any test fails or is uncertain, leave native storage disabled.

Native player intents require additional independently verified socket-origin, recipient-routing, forged-identity rejection, and non-broadcast tests; do not start `startVerifiedPlayerIntents()` until those are complete.

## Multi-GM and interrupted-write caution

Designated-GM local serialization is not a server-atomic distributed lock. Do not simultaneously write from two GMs. Suspended/uncertain native writes require explicit reconciliation before any retry or handover. Do not use actual campaign secrets or trigger live narrative effects with this development build.

## Local repeatable tests

```sh
npm run check
npm run spec:check
python tests/browser/editor-smoke.py   # only if Chromium and Playwright are available
```

These tests prove local contracts and DOM behavior, not multiplayer security or persistent storage operation in a real Foundry server.
