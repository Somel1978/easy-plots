# Easy Plots implementation delta — v0.83–v0.92

These are **continuous implementation batches**, not public releases or mandatory intermediate production testing. The final goal remains one complete Foundry VTT v14+ module with no external backend.

| Batch | Integrated implementation | Validation |
|---|---|---|
| v0.83 | Pure bounded GM narrative-health assessment, with explicit coverage, overdue and blocked status; Planning Lab integration | Input/coverage/privacy and durable planning tests |
| v0.84 | Durable revision-checked session handoff: explicit unresolved references, GM-only notes, dormant hooks, recipient-specific recap projection | Concurrency, player-projection, restart and authorization tests |
| v0.85 | ApplicationV2 Session Handoff Desk and GM API with explicit review before approval | Browser DOM and local authority tests |
| v0.86 | Scoped GM exact-token search with 8 fixed shards, canonical record revalidation and interrupted-index recovery | Search paging, stale postings, hostile terms, replay and scope tests |
| v0.87 | Protected native search composition, API and ApplicationV2 search interface | Chromium XSS and integration tests |
| v0.88 | Durable GM narrative notification queue: separate source detail and recipient-safe text, explicit approval, expiry, scoped page reads | Recipient separation, idempotency, visibility tests |
| v0.89 | GM notification review interface and native integration composition | Local lifecycle and native interface tests |
| v0.90 | Focused native narrative-health inspector: exact canonical objective, schedule and resource IDs; incomplete coverage never reported as complete | Native-repository scenarios and missing status tests |
| v0.91 | Updated status launcher, session handoff, search and notification interface smoke tests | Chromium automated interactions |
| v0.92 | Native-pack round-trip integration for new services, supplemental storage mapping, final local regression | Full Node, Chromium and specification suites |

## Contract notes

- **Narrative health**: only explicitly selected records are considered. No claim of complete campaign coverage; output is GM-only and non-mutating.
- **Session handoff**: GM notes and unresolved references remain in protected storage; only explicitly approved public recap text is projected to allowed observers.
- **Search**: explicit keyword indexing and exact-term bounded retrieval, not automatic indexing of the whole campaign. Token postings are advisory, canonically checked; stale or incomplete entries cannot become verified results. Scope and token-capacity limits are deliberate.
- **Notifications**: recording a notice, publishing audience-safe text and actually sending a socket message are separate concerns. This implementation **does not broadcast notifications**.
- **Storage**: four supplemental logical storage records were added to the proposed storage map; the underlying native architecture still requires final Foundry-world verification.
- **Release scope**: the original 97 proposed specialized node contracts still require exact semantic one-to-one verification or implementation. The registered authorable-node count is not treated as proof of contract completeness.

## Remaining implementation

Complete specialized node-contract equivalence and additional native game-system adapters; broader player and GM workflows; automated notification delivery with authenticated recipient binding; search indexing coordinated with all authoritative record updates; co-GM distributed authority; remaining advanced narrative orchestration; final integrated Foundry-world testing after implementation completes.
