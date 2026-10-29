# Easy Plots v0.6 — Validation Report

Test environment: local Node.js 22; mock Foundry native Document/Compendium contracts; Playwright headless Chromium with a minimal ApplicationV2-style DOM shell. No running Foundry server was used.

- `npm run check`: **81/81 Node tests passed**, zero failed.
- `npm run spec:check`: **passed** — 125 decisions and proposed tests, 97 candidate provider types, 50 logical record groups, proposal schema/TypeScript validations.
- `python tests/browser/editor-smoke.py`: **passed** — Chromium DOM harness creates, connects, validates, saves, publishes, activates and safely renders title text; also exercises mocked GM intent review.

Local coverage includes typed graph authoring, persisted-memory and mocked-native snapshots, independent activation, integrity fingerprints, stale revision rejection, fail-closed pending indices, structural warning acknowledgements, portable hashing, secret-safe DOM text rendering, and mocked GM intent approval.

**Not verified:** Foundry v14.369 ApplicationV2 inside real Foundry, live player/GM/Compendium visibility, native Hooks and effects, game-system compatibility, server-atomic GM coordination, migrations, performance, historical data and complete 125-decision implementation.
