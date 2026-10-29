# Easy Plots v0.93–v0.98 — Integrated implementation delta

Development against v0.92 without intermediate release approvals. All functionality below resides inside the same Foundry module. This is **not** the completed 125-decision project or final live Foundry verification.

## v0.93 — Targeted approved-notice transport

- `src/platform/foundry-notification-transport.mjs`: server-appended sender ID validation; designated-GM checks; explicit native `recipients:[userId]` without broadcast; independently resolved and authorized recipient; strict allowlisted 280-character projection; authenticated client acknowledgement; bounded in-flight and seen-delivery maps; no automatic retry after an uncertain outcome.
- `PersistentNarrativeNotifications.acknowledge` persistently records the authenticated receipt and rejects foreign or conflicting receipts. A receipt indicates *client callback acknowledgement*, **not human reading**.
- GM native composition and protected API; GM Notification Review Desk has a separate send action after explicit approval. Player receiver opt-in API is exposed.

## v0.94 — Canonical narrative search validation

- `ScopedNarrativeSearch.indexVerifiedDomain` reads a single verified domain record by exact ID and derives bounded title tokens; untrusted client metadata cannot impersonate canonical records.
- Search checks canonical domain revision and event provenance as well as search-posting revision. A changed source cannot be represented by an outdated result.
- Search recovery remains exact-ID scoped; no whole-world scan.

## v0.95 — Automatic scoped indexing and bounded repair

- `NarrativeDomainStore.setCommittedIndexer` integrates post-commit indexing after a verified, revisioned narrative save. The native composition registers indexing for supported named domain records only.
- Index-write failure does **not** make a committed primary narrative write appear rolled back. The log flags targeted repair, and GM can resume a pending entry by ID. Outdated entries remain suppressed.
- Bounded compaction prunes verified obsolete postings only inside an exact full token shard. `hasMore` now reflects verified eligible matches rather than stale candidates.

## v0.96 — Authenticated player receiver

- The module automatically starts a player-only notification listener on `ready` when the native module socket is enabled. The player receives only designated-GM-targeted projections; the GM repository is never opened in the player client.
- Display text is escaped before being passed to Foundry notifications. Missing or unsuccessful display callback does not generate an acknowledgement.

## v0.97 — GM exact-record repair control

- The GM Narrative Search Desk includes a typed canonical-record reindex operation. It reads and verifies the exact existing record and does not modify narrative world state.

## v0.98 — Race and browser verification

- GM delivery reserves the notice identity before asynchronous authorization, preventing concurrent duplicate sends for the same notice.
- A duplicate already received client packet is acknowledged again without repeating the notification display.
- Chromium smoke checks exercise search repair and the independently approved notification send control.

## Local validation

- `npm run check`: **618 Node tests pass**, zero failures.
- `npm run spec:check`: specification still includes 125 decisions, 97 proposed specialized node contracts and 53 logical record groups.
- `python tests/browser/editor-smoke.py`: Chromium UI smoke test passes.
- Archives are generated from the integrated code and validated via ZIP integrity checks.

## Remaining scope and security boundary

- Live native multi-client Foundry socket/ownership/GM-turnover tests are **not** claimed as complete; explicitly verified native configuration is required to start GM delivery.
- The notification recipient resolver and authorization policy must be supplied by verified world configuration. A player callback acknowledgement cannot prove the human viewed a message.
- Domain indexing is bounded and best-effort; failed postings require targeted repair. No global document scan or complete search-index migration was added.
- Exact semantic coverage against the original 97 proposed node contracts, broader game-system adapters, co-GM fencing, and remaining 125-decision functionality continue to require implementation; final live Foundry end-to-end testing remains deferred until feature completion.
