# Easy Plots v1.11 — integrated development changes

This checkpoint continues the transferred v1.09 code and integrated v1.10 work. It is not final feature acceptance or real Foundry certification.

## Canonical domain integration and history

The previous extended-effect providers persisted facts, objectives, relationships and beliefs under hashed effect identities. Quest publications and faction agendas read stable canonical domain identities instead. New integration regressions reproduced this disconnect before the fix.

`canonical-domain-effects.mjs` now adapts these four providers to the shared `NarrativeDomainStore`. Objective transitions invalidate published quest projections; faction rules consume the fact actually written by the graph; relationship direction and observer-specific beliefs remain protected. Existing authored metadata survives updates, and journal operation/source receipts support idempotency and verification. Other extended effects retain their existing contracts.

Every domain replacement durably retains and verifies its previous full revision before updating the source. Exact hashed historical locators avoid scanning all history. Missing/unverified history blocks replacement. `readRevision` validates historical identity, fingerprint and index readiness.

Legacy hashed records are never silently imported. Inspection returns an exact fingerprint; explicit adoption requires the expected old revision, fingerprint and GM review event, preserves the original, and refuses conflicting canonical state. Registry composition preserves these migration capabilities.

`narrative.restore-domain-revision` previews and appends a corrective narrative revision through the ordinary GM proposal/journal pipeline. It rechecks current state and historical identity, preserves relationship/observer scope, and requires a new causal event. Native Actor, Item and other document effects are outside this correction capability.

## Graph views and focused GM workspace

Narrative, execution and knowledge layer filters preserve every canonical node and connector. Hidden boundary connections are counted. Global compact/comfortable/expanded density and individual expansion overrides change presentation without dirtying the graph, changing its revision or modifying execution.

The router emits bounded exact-graph local metadata only after an event becomes durably evaluated/reviewable. Focused cockpit subscriptions refresh at most 12 named relevant events, including nested graph traces. Closed views unsubscribe; role and focus changes fence stale responses.

The shared dock, inspector and full canvas use one GM-local focus controller and authoritative graph reads. Protected preferences are isolated by GM identity. Explicit scene bindings are limited to 24; scene changes follow the configured passive focus unless a persistent pin takes precedence. Attention stores at most 32 named signals with TTL. Manually pinned significance survives expiry and restart. Focus/view changes never mutate canonical plots. The editor refuses to discard unsaved work when another view changes focus.

## Forecast hypotheses

Persistent faction forecasts require a published agenda, relevant canonical facts and the faction's own published due knowledge receipts. A bounded explicit dependency manifest captures only selected rule sources, including observed absence. Inspection rechecks exact source revisions, missing dependencies and applicable temporal boundaries. A changed dependency suppresses stale predictions without invalidating unrelated rules' forecasts. Preview and publication create hypotheses only; no consequence is executed or declared inevitable. Knowledge coverage is explicitly limited to the selected receipts.

The Society/Knowledge desk provides forecast preview, explicit creation and freshness inspection. Rendered authored content remains inert text.

## Scheduling and diagnostics

Native Hook evaluations and selected GM background inspections share a bounded critical/interactive/background scheduler. Its fairness policy serves the oldest waiting task after a bounded priority burst, and observed expensive tasks lower concurrency within configured limits. Queue capacity rejects overload explicitly; queued Hook tasks recheck stop state and current writer authority before entering the router. Scheduler priority is not a reliability guarantee for missed native signals.

Anonymous timing diagnostics are disabled by default, GM-local, configurable and sampled. At most 128 observations are retained, with aggregate success/error/drop counts. The collector rejects event identities, content and other extra fields; collector failure cannot change a completed task's outcome. Representative real Foundry performance qualification is still deferred.

## Evidence and limits

- Syntax: 139 runtime modules pass.
- Node: 773 actual cases pass, zero failures or skipped cases.
- Chromium: typed graph authoring, layers/density, individual collapse, Portuguese action labels, approvals, event review, plans, forecasts, player-safe boards, committed-event cockpit refresh and coordinated dock/inspector/canvas pass.
- Specification, preliminary inventory consistency and current-source scenario evidence checks pass.
- Local test evidence contains the tested source fingerprint and individual case results. A changed source/test/language/manifest fingerprint invalidates the decision review until tests are rerun.
- All 125 decisions have individual observations. Evidence presence is deliberately distinct from complete decision acceptance. See `REVISAO_FECHO_v1.11.md` for the remaining frontier.
- No real Foundry world, multiplayer, final migration or representative-load test was run. Proprietary Foundry reference sources remain outside the checkout and packages. No commit, push or upload to manifest URLs occurred.
