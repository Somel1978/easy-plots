# v0.7 — Published graph subscriptions and review-only Foundry Hook routing

## Implemented
- Bounded per-event-type indexed subscriptions with activation-before/after ordering safeguards.
- Durable, idempotent canonical event inbox with read-back/index checks and explicit recovery states.
- GM-authored graph evaluation from native document Hooks, with no native effect execution.
- Opt-in Hook ingress for four declared Foundry document hooks, only storing bounded metadata.
- GM-only ApplicationV2 event review window, accessible via module API/status window.
- Native socket UUID fallback for HTTP LAN / insecure contexts.
- Separate transport vs Hook stop operations.

## Tests added
- Memory-backed indexed publication and activation, stale pointers, interrupted index stages, corrupt index detection.
- Durable event inbox transition/id reuse/recovery/GM authority/bounded shard tests.
- Condition evaluation and no-autonomous-effects tests.
- Mocked native Compendium reload and persistent proposals.
- Mocked Foundry Hook listener/start/stop/handover and secret-field nonserialization tests.
- Chromium DOM test of indexed activation and GM event review.

## Known limitations / future gates
- This is not production-ready; no Foundry server was launched for the tests.
- Native Compendium confidentiality, target socket delivery, multi-GM fencing and Hook callback origins need live evidence.
- Effect proposals are not executable from the event inspector. No generic native effect adapter is installed.
- Event recovery states require explicit GM reconciliation. No offline scheduler or cross-document exactly-once guarantee.
- Hook event metadata stored in GM-only ledger includes UUIDs; clients must not receive it.
- Per-event fan-out and payload budgets are conservative prototypes and may be refined after performance tests.
