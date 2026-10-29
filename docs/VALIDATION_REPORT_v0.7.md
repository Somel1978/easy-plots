# Easy Plots v0.7 — Validation Report

Date: 2026-10-27

**Environment:** local Node.js 22, in-memory and mocked Foundry JournalEntry repository, synthetic Hook implementation, Playwright Chromium DOM harness. No actual Foundry server launched.

## Verified locally

- `npm run check`: **113 / 113 tests passed**, zero failures.
- `npm run spec:check`: **passed** — 125 decisions and their proposed acceptance scenarios, 97 candidate node types, 50 logical storage groups, two structurally valid JSON Schema bundles, TypeScript proposal contracts.
- `python tests/browser/editor-smoke.py`: **passed** — author, connect, inspect, validate, save, publish, activation through indexed registry, safe text rendering and mock GM request/event review.
- Mocked native Compendium round-trip of graph subscriptions and GM-review event proposals across a reconstructed native integration instance.
- Negative tests for corrupted or unfinished subscription indices, stale publications, deactivation, interrupted staging, duplicate event IDs, incomplete ledger states, GM authority revocation and unsafe Hook fields.
- No real effect provider is invoked by the opt-in reactive event router. Outcomes contain **only pending proposals**.

## Not tested or certified

- Live Foundry v14.369 Hooks and ApplicationV2 behavior (only source-informed and mocked).
- Native player-vs-GM Compendium secrecy, including bootstrap data, flags, direct index/document fetch and network traces.
- Authentication and recipient confidentiality of module sockets in a running multiplayer world.
- Durable write behavior under actual disk and network interruptions, reconnects, crash recovery and multi-GM split brain.
- Production native effect providers or downstream narrative state mutations.
- Migration, larger campaigns, resource budgets on realistic worlds, optional game-system adapters and complete 125-decision functionality.

## Non-negotiable gates

Native storage and live Hooks are disabled by default. They require explicit configuration by an eligible GM after documented exact-world security tests. A running Hook cannot execute an effect: it can only create GM-review event ledger entries. The deployment is **for disposable test worlds only**.
