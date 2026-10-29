# Easy Plots v1.12 — chronology and incremental arc archival

This checkpoint continues v1.11 in the existing workspace. The delivery scope remains all 125 decisions; final Foundry acceptance has not begun.

## Distinct chronologies

`NativeChronologyIndex` stores exact arc, timeline, observer, time-bucket and policy candidates. Queries read at most 24 named buckets, return at most 32 entries per page and bind continuation to the selected query and bucket revision. Changed cursors require a new query. Dense buckets have an explicit capacity limit and fail rather than claim complete coverage. Automatic repartitioning remains a separate unfinished storage capability.

`PersistentNarrativeChronology` validates candidates against canonical sources. Fiction time is explicitly authored and can remain unknown. Execution time is the event's recorded first acceptance time, distinct from successful application of effects. The event fingerprint and current processing state remain visible to the GM. Causal references are bounded, require earlier entries in the same arc and resolve timestamp ties consistently. This does not infer unrecorded narrative outcomes.

Knowledge chronology uses published canonical receipts scoped to the selected observer. Native disclosures record world time and the effective knowledge time is `max(disclosedAt, availableAt)`. This fixes a real integration issue: an availability default of zero previously permitted a later disclosure to count as knowledge at an earlier time. Observer projections and faction agenda assessment now enforce the same effective time; forecasts inherit the agenda gate. Retry delivery preserves the original disclosure timestamp. Knowledge availability does not claim that a human player physically read a message.

Old events without recorded acceptance time and old availability-only receipts remain readable by their existing services, but cannot acquire fabricated precise dates in chronology. Historical chronology repair needs explicit evidence. Private event payloads and canonical claim truth are not copied into timeline results. These services and the new window are GM-only; no new player transport was introduced.

## Reviewed resumable archives

`PersistentArcArchives` accepts a concluded arc with a verified committed resolution at the expected revision. It prepares a GM-authored summary and mandatory references to that arc and resolution. The GM can append batches of up to 12 exact canonical revisions, with at most 32 pages. Coverage is explicitly `explicit-members-only`; no all-world traversal is performed and no claim of discovering every historical reference is made.

Explicit GM sealing freezes the manifest. Each retention step verifies one content-addressed page, checks historical source fingerprints, durably retains the selected revisions using `NarrativeDomainStore.retainRevision`, and only then advances the saved cursor. Restart continues from the next page. A partially retained page can be checked again without rewriting historical identities or executing narrative effects.

Finalization checks the canonical arc and closure again. It stages the summary, marks the concluded arc as archived, records completion and publishes the summary in separate verified writes. Interrupted stages remain inspectable; pending summaries are suppressed. Explicit retries accept only the matching prior archive mutation and do not overwrite newer canonical state. Closure changes or modified sealed pages block progress.

Summary lookup reads one exact protected summary record. Historical content is loaded only by an explicitly requested page and is checked against retained source fingerprints. The original durable event and its fingerprint survive archival. Shared canonical facts can evolve while archives retain their selected old revisions. Native resources are never deleted by this service, and graph activation retains its separate contract.

## Foundry integration and interface

The verified native subsystem composes chronology, knowledge timestamps and archive services against the same domain store. The GM API exposes bounded chronology and archival operations. `openHistoryDesk()` is also available from Integration Status.

The Narrative History window supports fiction/execution/observer views, explicit recorded-event and disclosure indexing, archive preparation, reference selection, sealing, per-page progress, job inspection/recovery, summary lookup and lazy history pages. Written choices require GM review; input changes invalidate that review. Authored text is rendered inertly, and losing GM authority removes the protected interface. All labels in this new window have English and Portuguese (Portugal) translations; other existing module windows still have incomplete localization.

## Validation and remaining limits

- 797 actual Node cases pass, zero failures and skipped cases; 143 runtime modules pass syntax checks.
- Chromium exercises all prior workflows plus the history window using real local chronology, revision-store, closure and archive services. It tests publication guards, observer views, incremental retention, lazy summaries, inert authored markup and role revocation.
- Specification checks cover 125 decisions, 97 proposed candidate contracts, 28 requirement groups and 63 logical record groups. Inventory consistency does not establish semantic completeness.
- `DECISION_SCENARIO_REVIEW.csv` still contains 125 individual observations, checked against current-source case evidence. Related evidence is not whole-decision certification.
- The final real Foundry world, multiplayer, recovery, performance and migration scenarios remain deferred. No commit, push or publication to manifest URLs occurred.

The outstanding reliability-tier ingress and critical missed-signal reconciliation scenario is unchanged. The 48 partial observations also retain their explicit missing behavior/integration/evidence; see `REVISAO_FECHO_v1.12.md`.
