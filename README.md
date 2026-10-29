## Draft autosave and reference UI correction — 1.14.1-dev

New plots are saved as drafts immediately. Ordinary guided-editor changes autosave with visible status; pending/failed edits protect refresh with a browser warning. After reload, unlock the same world vault to find and reopen your plots. Save draft remains available for an immediate save; publishing and activation stay separate.

The GM workspace, plot editor and player portal now follow the supplied design hierarchy rather than the earlier generic navigation shell. Step discovery uses categories, descriptions, search and related suggestions. [Correction and validation scope](docs/DRAFT_REFRESH_AND_UI_CORRECTION.md). This does not recover edits discarded before they were ever saved.

The complete UI and module remain in development: guided detail screens, player discovery, private notes, resource/version browsers and other assessed features are incomplete. No native Foundry-world acceptance is claimed from local adapters or screenshots.

## Previous UI foundation — 1.14.0-dev

Open Easy Plots from the left toolbar or Configure Settings → Module Settings → Easy Plots. One role-aware workspace contains campaign navigation, storage setup and the Plot Editor. Name a plot, choose how it starts, add/connect story steps, save, check, publish and activate. The default editor uses labelled forms; technical controls are available through Advanced editor. Navigating preserves unfinished editor input. Keep the vault passphrase: it is required to unlock saved world data after reload.

Players use character-visible sections and inline notices in the same workspace. **Automatic content discovery remains incomplete.** Existing session/review/world service desks are hosted in the frame but still need their guided task redesign. See [the UI contract](docs/UI_SYSTEM.md), [the whole-module migration ledger](docs/UI_SCREEN_MIGRATION.md) and [the ordered work plan](docs/WORK_ORDER.md). This development build does not complete the 125-feature scope or establish native Foundry-server acceptance.

> **Status correction —29 October2026:** The shipped module is incomplete. The earlier readiness statement is withdrawn. See the [full scope/code assessment](docs/assessment/2026-10-29/README.md) and its125 individual feature records. Unpublished drafts and proposed screenshots are not released functionality.

# Easy Plots

Foundry VTT v14+ native, GM-authoritative narrative engine targeting **all 125 agreed architectural decisions**. No external backend or separate server. Implementation batches are merged continuously; local automated regression tests during development, full real Foundry end-to-end tests after feature completion.

## Previous qualification result — superseded by product assessment

The previous functional-closure and final-test-readiness claims are withdrawn. Historical qualification files and versioned test logs are retained for traceability; they do not certify product completeness. Use the [125-decision assessment](docs/assessment/2026-10-29/README.md) and current work order for outstanding work. The manifest's verified field follows the author's convention, not executed compatibility evidence. Native multiplayer, permissions, lifecycle, recovery and performance acceptance remain separate work.

## Integrated changes v1.13

- Configurable critical/best-effort native event policy. Critical metadata is discoverable and durable before graph-admission backpressure; restart recovery keeps the original occurrence and requires GM review before resubmission.
- Reconciliation checks the existing event journal. Accepted or uncertain events are never replayed; observed changes in explicitly watched native sources become protected review flags without invented history.
- A translated GM Signal Reliability window configures policy, reviews pending intake, resumes/dismisses original signals and acknowledges current source checkpoints. Opening it never starts native Hooks.
- Native storage Journal Hooks are excluded from their own narrative intake, preventing protected-storage feedback. Startup waits for policy loading and can be cancelled safely.
- Native/manual/due producers emit `eventVersion: 1.0.0`. The journal verifies a full canonical Event document against the proposed schema, retains causal parents and correlation, and checks its independent fingerprint. Existing unversioned events keep their original contents and fingerprints.
- A pinned canonical schema/version descriptor detects incompatible stable-contract edits. Qualification fingerprints now include normative specification files as well as source, tests, languages and manifests.
- Mixed subgraphs combine typed values with separately approved child/parent effects. Verified completed operations can explicitly start a new approval-only continuation.
- The planning lab simulates actual published graphs with isolated hypotheses and effect faults. Saved, reviewed plans can enter authored live graphs as GM intents, with separate approval for every resulting effect.
- Canonical NPC agendas and schedules use the NPC own persistent knowledge and disclosure timing, prepare reviewed due commitments and survive restart/index repair. Becoming due never establishes an off-screen outcome.
- Durable temporal catch-up retains bounded candidate pages before advancing its cursor; the GM can reopen the inspector and resume. Enumeration executes no actions. Time-zero commitments and separate narrative scopes are covered.
- Portable full-graph templates remove external identities into explicit local binding slots, retain immutable source revisions and create distinct linked instance drafts. The GM template desk supports export/download, storage, binding review and creation without activation.
- Authenticated structured player board proposals stay private until a published handler and separate GM effect approval apply them. Own-theory revisions retain history; hidden changes cannot change public board tokens, and stale/uncertain writes fail closed.
- **1,147 actual Node cases pass; 214 runtime modules pass syntax checks.** Current executed-case evidence is in `docs/local-test-evidence-v1.13.jsonl`. Local automation does not establish full acceptance of all 125 decisions.

See `docs/IMPLEMENTATION_DELTA_v1.13.md` and `docs/REVISAO_FECHO_v1.13.md`. Watched-source reconciliation has explicit coverage and capacity limits; it does not reconstruct every unobserved native occurrence.

## Previous integrated changes v1.12

- Separate indexed fiction, recorded execution and observer-knowledge chronologies with stable causal ordering and revision-bound pages. Exact arc/time/observer lookups avoid loading campaign history.
- Events retain their first durable acceptance time. Native knowledge receipts record disclosure time; knowledge becomes available at the later of disclosure and its authored availability boundary. Player projections and faction rules use the same time gate.
- Reviewed concluded-arc archives retain selected historical revisions in bounded, resumable pages. Staged publication preserves uncertainty after interruption and exposes the summary only after completion. Reading a summary does not preload its historical records.
- A GM Narrative History window provides chronology entry/query, disclosure indexing, archive preparation, reference selection, retention progress, recovery and lazy historical pages. Its labels are available in English and Portuguese (Portugal).
- **797 actual Node cases pass**, Chromium workflows pass and specification/evidence checks pass. All 125 scenario observations remain individually documented; related local evidence does not certify complete decisions.

See `docs/IMPLEMENTATION_DELTA_v1.12.md` and `docs/REVISAO_FECHO_v1.12.md`. Legacy records without verified historical dates remain undated. Archive selection is explicitly scoped to named members; graph activation and native-resource lifecycle retain their own contracts.

## Previous integrated changes v1.11

- Graph effects for facts, objectives, relationships and observer beliefs now use the canonical records consumed by quests, factions and history. Explicit reviewed adoption handles older effect records without silent overwrites.
- Immutable domain revision history and journaled GM narrative corrections append provenance without pretending to undo native Actor/Item effects.
- Independent narrative/execution/knowledge graph views, compact/expanded nodes and individual detail toggles preserve the canonical graph and publication.
- Durable grounded faction forecast hypotheses recheck their exact source revisions and time boundaries. Stale predictions are withheld; forecasts never establish canonical futures.
- A reactive focused cockpit and a shared GM dock/inspector/canvas use exact graph lookups. Protected per-GM focus pins survive scene changes and restart; temporary attention expires independently of pinned significance.
- A bounded priority scheduler provides fair service to older background tasks and adapts concurrency. Disabled-by-default anonymous diagnostics support bounded sampling.
- **773 Node tests pass**, Chromium workflows pass, and specification checks pass. `docs/local-test-evidence-v1.11.jsonl` records executed cases against a fingerprint of the tested source.
- `docs/DECISION_SCENARIO_REVIEW.csv` contains 125 individually authored observations linked to executed local cases. Its statuses describe evidence and limitations, not completed decisions or final Foundry acceptance.

See `docs/IMPLEMENTATION_DELTA_v1.11.md` and `docs/REVISAO_FECHO_v1.11.md` for concrete boundaries and remaining work.

## Previous integrated changes v1.10

- GM-private typed values from canonical events, literals and authoritative native state; event claims remain distinct from native truth.
- Explicit data links, typed comparisons and boolean branches in the editor. Payload bindings propose effects and never grant approval.
- Immutable typed subgraph interfaces with named parameters/exports, bounded lazy reads and pinned child revisions. Pure data calls do not execute child effects.
- GM review revalidates payload data and the state revisions that selected each branch, including AND-join paths and absent-state observations.
- Protected native Chat/Journal publication from reviewed recipient knowledge, and independently authorized blind/public/private mechanical roll reports. Native Documents carry a generic fixed-size encrypted shell; targeted key grants recheck current roles/Actor knowledge. No secret DC, raw Roll or canonical narrative truth enters the native fields.
- Historical knowledge projections retain the wording actually disclosed. Durable correction reviews gate registered graph/domain conclusions before approval/execution, retain source pages across restart and require explicit GM decisions; corrections never replay reasoning or rewrite past receipts.
- Grouped notifications use reviewed recipient-specific public titles/IDs and a bounded client inbox. The graph node queues a private draft; publication and authenticated delivery remain separate.
- Typed `core.roll.value` conditions record exact native attempt/revision/provenance, rechecked during approval/execution and saved-plan submission. Event Review includes a compact effect preview and explicit successor-GM reconciliation without replay.
- Durable system-neutral opposed d20 checks, active/passive modes, authored tie/partial policies and uncertainty recovery without rerolling. No arbitrary DC is attached to opposed-side observations.
- Opt-in native Combat and ChatMessage observations; private message content, recipients and roll values are not copied. Admission budgets include pending index lookups.
- Somel module metadata and versioned URLs; English and Portuguese (Portugal) language files currently cover the main editor actions.
- Preliminary inventories: `docs/NODE_CONTRACT_AUDIT.csv` and `docs/DECISION_TRACEABILITY.csv`. These identify candidate mappings and test references; they do not measure missing functionality. See `docs/COVERAGE_REPORT_CORRECTION.md`.

See `docs/IMPLEMENTATION_DELTA_v1.10.md` for boundaries and outstanding work. All 125 decisions remain the delivery target; this is a development checkpoint.

## Integrated changes v0.99–v1.09

- Authenticated player-safe targeted session recap and finalized vote outcomes, with GM verification of Actor ownership.
- Durable GM-authored quest projections, recipient-specific objective disclosures, independent public IDs, revision-bound approval and stale projection suppression.
- ApplicationV2 GM Quest Publication Desk and Player Narrative Portal for approved recap, quest, vote and investigation views.
- Three distinct authorable event-source trigger contracts: GM manual, canonically verified scheduled due-event, and native document Hook.
- GM Manual Event Desk to submit authored events without bypassing separate GM effect approval.
- Root trigger kind switching in graph editor, with source-sensitive validation.
- Bounded **`core.state.read`** graph node that queries the protected native narrative-state provider and branches on match, mismatch or absent; fails closed on unavailable/corrupt reads.

See `docs/IMPLEMENTATION_DELTA_v0.99-v1.09.md` for file-level behavior, exact boundaries and outstanding work.

## Local verification

```bash
npm run check
npm run spec:check
python tests/browser/editor-smoke.py
npm run coverage:check
npm run review:check
```

## Native configuration

`game.modules.get('easy-plots').api` exposes the GM and player interfaces from earlier batches plus targeted `requestApprovedSessionRecap`, `requestFinalizedVoteResult`, `requestApprovedQuestBoard`, `openPlayerNarrativePortal`, `openQuestPublicationDesk` and `openManualEventDesk` interfaces. Protected GM services require explicit `configureVerifiedNative(...)` and verified designated-writer and socket authorization. `resolveGMContestedCheck` adds protected opposed d20 checks when verified Actor bindings and a native Roll adapter are configured. Existing APIs remain available.

The current GM API adds `openNarrativeDock`, `openNarrativeInspector`, `inspectGMFocus`, `prepareNarrativeForecast`, `inspectNarrativeForecast`, `inspectDomainRevision`, `previewNarrativeCorrection`, `inspectLegacyCanonicalDomain`, `adoptLegacyCanonicalDomain`, `configureRuntimeDiagnostics` and `inspectRuntimeDiagnostics`. The dock explicitly configures scene bindings and pins; automatic scene focus uses the local `canvasReady` lifecycle. Corrective effects still require a reviewed graph proposal through `narrative.restore-domain-revision`.

Use `openHistoryDesk()` for the new history window, also accessible from Integration Status. GM chronology APIs are `recordNarrativeChronology`, `indexNarrativeDisclosure` and `inspectNarrativeChronology`. Archive APIs are `prepareArcArchive`, `appendArcArchiveBatch`, `sealArcArchive`, `advanceArcArchive`, `finalizeArcArchive`, `inspectArcArchive`, `readArcArchiveSummary` and `readArcArchivePage`. Sealing requires explicit GM review. Interruption recovery starts by inspecting the saved job revision; completed event effects are never replayed by archival.

Use `openSignalReliabilityDesk()` for native-event policy and recovery review. The corresponding GM API exposes `configureSignalReliability`, `inspectPendingCriticalSignals`, `inspectCriticalSignal`, `reconcileCriticalSignal`, `resumeCriticalSignal`, `dismissCriticalSignal`, `checkWatchedSignalSources` and `acknowledgeSignalSource`. `startVerifiedReactiveHooks()` now returns a Promise: await it after the existing exact-world security verification. Policy loading and window opening never start Hooks automatically. The default tier is best effort until explicitly configured.

## Continued integrated workflows

Plot owners delegate editing, publication and activation separately. The coordinator uses `startVerifiedGMPlotAuthoring()` after its existing native configuration; another GM connects with `connectGMPlotAuthoring({attestation})` and uses the same editor. `openPlotAuthority()` handles grants, transfer, reviewed legacy adoption and unavailable-owner recovery. Lost replies can be inspected with `inspectGMPlotAuthoringRequest(requestId)`; unknown commands are not repeated. `reconnectGMPlotAuthoring()` preserves that client model.

`openLiveAppearance()` updates the active view title and up to64 selected node labels/positions independently of executable snapshots. It applies plot edit rights, version/activation checks and retained history. Structural changes still use draft publication. `openEncounterClosures()` selects one verified outcome from a native Combat deletion, then submits one stable causal event; downstream effects require separate approval. `core.trigger.encounter-closed` accepts that verified closure.

`core.identity.entity` and `core.identity.persona` persist lightweight identities without requiring an Actor. Personas retain a separate entity link and terminal retirement history. `resolveNarrativeIdentity()` and the Society & Knowledge inspector show optional resource bindings without mutating borrowed native content. Recipient-specific reveals and persona reputation continue through the existing independent knowledge and relationship effects.

A third-party module may register a declarative action after native configuration:

```js
const api = game.modules.get('easy-plots').api;
const action = await api.registerNarrativeAction({
  id: 'example.quest.mark', version: '1.0.0', label: 'Mark quest',
  targetProviderId: 'narrative.set-state', targetVersion: '1.0.0',
  constants: { scope: 'example-integration', key: 'quest-mark' },
  inputs: { value: { type: 'boolean', default: true } }
});
```

Use `action.id` and `action.defaultPayload` in an Effect proposal node. The payload includes the visible fixed target fields, action version and exact manifest fingerprint. Core capability validation, GM approval and the effect journal still apply. Registration permits only allowlisted narrative targets and no execution callbacks. Installed GM JavaScript remains trusted. Re-register the exact manifest after coordinator initialization; a changed declaration cannot silently reinterpret a published action.

## Scope

This ZIP is an integrated development build, **not a declaration that all 97 originally proposed specialized node contracts or all 125 architectural decisions are implemented**. `core.state.read` remains a GM-only equality branch; typed native-state output is implemented separately by `core.state.value`. Preliminary contract mappings and unresolved equivalence assessments are recorded in `docs/NODE_CONTRACT_AUDIT.csv`. Advanced provider contracts, native adapters and interfaces are still outstanding. Real Foundry multi-client validation remains deferred to final completion.

## Development packaging

After the verification commands pass, run `python tools/package.py`. It writes separate workspace and native-module ZIPs plus SHA-256 checksums under `/workspace/artifacts`, with no Foundry reference source included. `bash tools/package.sh` runs verification and then packages; its optional argument is `--output /path/to/artifact-directory`. Packaging does not upload to the URLs declared in the manifest.

The `compatibility` target 14.369 follows the module-manifest convention requested by the author. The `verified` metadata is not evidence of real-world or multiplayer testing; that final validation remains deferred.
