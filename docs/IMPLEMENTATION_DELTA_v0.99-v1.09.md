# Easy Plots — Integrated implementation delta v0.99–v1.09

These are continuous implementation batches, not individually approved release stages. All changes share one Foundry v14+ native, GM-authoritative module. Local automated tests verify contracts; no actual Foundry multi-client end-to-end testing is claimed.

| Batch | Integrated code and behavioral boundary |
|---|---|
| v0.99 | `foundry-continuity-transport.mjs`: designated-GM, authenticated, targeted session recap and finalized-vote queries, with exact observer Actor ownership and allowlisted replies; rejected requests do not reveal hidden record existence. |
| v1.00 | Continuity transport composed in native subsystem and bootstrap APIs; safe player recap/vote presentation through ApplicationV2. Explicit GM transport start requires a verified native configuration. |
| v1.01 | Revision-checked `PersistentQuestProjections` domain service for GM-authored disclosure plans, protected objective IDs, independent public IDs and stale-version invalidation. |
| v1.02 | Targeted `quest-board` read through continuity transport and player projection UI; GM prepare/review/approve APIs; unauthorized requests fail closed. |
| v1.03 | ApplicationV2 GM Quest Publication Desk with exact objective selection, explicit authorization and review acknowledgment; Chromium interface coverage. |
| v1.04 | Specialized root triggers `core.trigger.manual`, `core.trigger.schedule-due`, `core.trigger.document-event` with distinct source provenance contracts enforced by authoring, publication, subscriptions and reactive execution. Extracted pure shared event-type validator to prevent circular imports. |
| v1.05 | ApplicationV2 Player Narrative Portal for authenticated approved recaps, final votes, protected quest views and learned investigation evidence. |
| v1.06 | GM Manual Event Desk for explicit authored narrative event submission; event submission is not effect approval or execution. |
| v1.07 | Full mocked native quest publication + GM/player transport regression, including revision-based withholding; `quest-publication` added to persistent logical record map (54 groups). |
| v1.08 | Root-trigger type switching in graph editor with safely initialized per-source defaults, stable root node identity and editable source-type selector. |
| v1.09 | `core.state.read` typed, read-only native state gate. Publication validates scope, key, revision, bounded JSON comparison and explicit match/mismatch/absent ports; router reads through authenticated narrative-state provider. Missing provider or corrupt/incomplete authoritative data fails closed to uncertain review, not event-payload trust. |

## Important capability boundaries

- Protected player projection services still depend on verified Foundry socket sender identity and explicitly configured Actor→observer authorization. There is no arbitrary player access to native Compendium content.
- `core.state.read` is an authorable **bounded state-comparison branch**. The original candidate `easy-plots.core.state-read` calls for an output value; this implementation does not yet provide arbitrary typed value-output wiring and must **not** be labeled one-to-one semantic equivalence.
- Authored due-commitment events depend on the existing GM manual-event gateway's canonical schedule/index verification. Source labels alone are not authority outside that gateway.
- Local tests use simulated Foundry and native repositories. Real V14 world, multi-client, permissions and performance tests are deferred until the entire feature scope is implemented, as requested.
- The original 125 architectural decisions remain the target; the 97 proposed node-provider contracts still require rigorous one-to-one contract traceability and implementation of outstanding semantics. Registered node counts do not prove contract equivalence.

## Local validation

```bash
npm run check
npm run spec:check
python tests/browser/editor-smoke.py
```

The tests include end-to-end local paths for continuity replies, quest publication/projection, trigger separation, manual GM events, and authoritative narrative state branches. No production-readiness approval or interim manual test is required between future implementation batches.
