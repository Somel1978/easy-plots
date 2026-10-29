# Easy Plots — active work order

Updated29October2026. User-selected priority: startup/initiation and real GM workspace, GM Plot Editor, player workspace. The full module remains incomplete. Scope is unchanged; the125-decision assessment is the backlog source, not a completion certificate.

## Current milestone — usable entry and workspaces

**Current correction, 1.14.1-dev:** user confirmed the reported refresh loss occurred without clicking Save. New plots now persist immediately and ordinary guided edits autosave, with visible status, retained input on failure and browser refresh protection. The supplied three-screen design is the binding target, not the 1.14.0 navigation skeleton. The core GM/editor/player composition has been brought toward that target, and step discovery now uses categories/context instead of a long select. Validate the full-page no-Save reload journey before publishing. Details: DRAFT_REFRESH_AND_UI_CORRECTION.md. Remaining technical detail screens are still incomplete; continue the existing migration ledger rather than restart the project.

**UI correction, 29 October:** the user rejected the separate-window technical interface. Follow [the shared UI contract](UI_SYSTEM.md) and [whole-module screen ledger](UI_SCREEN_MIGRATION.md). The current implementation order is shared native frame → core authoring and setup → player foundation → session/review task forms → world-content browsers/forms → settings/recovery → native acceptance. Do not jump to unrelated service batches or label hosted legacy forms redesigned. The earlier statement that item7 alone was next is superseded by this UI order; underlying feature dependencies remain tracked below.

**Current evidence, 1.14.0-dev:** the shared frame and core authoring journey are locally verified, including actual native-repository adapter save/reopen, typed condition editing, publication/activation, preserved form input and one host window. Player foundation has role-aware navigation and inline notices; discovery is incomplete. Session/review/world task forms and recovery UX remain on the screen ledger. All 1,184 Node cases and the four local browser checks pass; see UI_VALIDATION_v1.14.json. Native Foundry acceptance has not run. This is a foundation build, not completion of the whole UI.

1. **Startup and access:** role-aware toolbar icon and Module Settings launcher; safe ready handling; clear loading/error state; no console required. GM opens campaign workspace; player opens own workspace. No world effect merely from opening a window.
2. **World storage:** visible create/unlock flow, persistent native drafts and restoration after reload; no silent memory fallback. Confidential data must not be placed in plaintext publicly readable flags. Create/unlock and persisted reconstruction are locally verified; native Foundry acceptance remains required. No fabricated privacy attestations.
3. **GM workspace:** actual saved plot list, create/open plot, setup/unlock state, pagination and refresh, real navigation. Unavailable subsystems show a reason and no enabled dead-end button. No sample campaign data in production.
4. **GM Plot Editor:** reachable from workspace and toolbar; correct storage mode; save/reload roundtrip; distinct validation/publication/activation; scrolling/resizing and retained unsaved changes. Existing graph engine is reused.
5. **Player workspace:** owned-character selection, audience-safe tabs for quests/investigations/journal/notices, loading/empty/coordinator-unavailable states. Display only received authorized data. Discovery/sharing transport must be completed before claiming a populated player hub; never manufacture content.
6. **Acceptance:** fresh-world bootstrap→setup→create plot→save→reload→reopen through normal UI; GM/player role checks; bounded-window scrolling; failed setup preserves data; unavailable tools remain disabled. Native Foundry retest is explicitly separate from local DOM/adapter checks.

Do not release this milestone as complete until its acceptance checks pass. A launcher alone is insufficient. Keep the priorv1.13.0-dev tag immutable; publish an explicitly labelled patch only with accurate scope and limitations.

## Following milestones, in dependency order

7. Participant/observer/recipient bindings and sharing discovery; player/coGM connection states.
8. Generic player request queue discovery, consequence preview, approved→processing→resolved execution and retry/reattempt UX.
9. Player vote submission; deadline/offline/quorum policy; complete runoff flow.
10. Friendly rule builder and ordinary entity/record selectors; reduce raw JSON/ID entry.
11. Identity/persona, NPC, faction/renown/agenda, relationship/debt management interfaces backed by existing canonical services.
12. Knowledge/disclosure, investigation/theory and quest/milestone end-to-end GM/player workflows.
13. Spatial discovery/routes, time/schedules/clocks, timelines and time-jump reconciliation UI integration and recovery.
14. Resource creation/batches, guided rebinding, provenance and safe lifecycle management; blueprint update/adoption.
15. Planning, forecasts, session preparation, recaps, arc endings and continuity workflows.
16. Migration definitions and uncertain-migration reconciliation; coGM handover and original-effect recovery management.
17. Diagnostics, scoped search, indexed coverage, representative performance, extension restoration/version compatibility.
18. Exact-environment native acceptance across the125 decisions and required multiplayer/privacy/recovery/load dimensions. Only then assess release readiness.

## Tracking rules

- The full per-feature remaining-work ledger is assessment/2026-10-29/FEATURE_ASSESSMENT_125.csv and .md. Every milestone must link affected ADRs and update concrete missing behavior, not turn a test count into completion.
- Status values: not started / implementing / locally verified / native verified / blocked. Record source commit, actual checks and residual limits.
- Preserve existing code and histories. No repeated service rewrites, extra features or proposed-interface scope expansion.
- Keep a current handover in MEMORY.md. If credits/context end, record exact unfinished integration and failing checks; do not say the module is complete.

## Historical handover — startup/workspace patch1.13.1-dev

- Locally verified: role-aware toolbar and Module Settings entry for GM and players, including worlds with no active canvas; startup guards; setup-aware Home with scrolling and disabled unavailable tools.
- Locally verified: create/unlock encrypted native world vault; wrong-password rejection; saved native draft reconstruction; chunk/tamper/AAD/role-loss failure checks. A passphrase is required and never stored in world settings. Reload intentionally locks the vault; it does not discard its plots.
- Locally verified: GM campaign workspace lists actual saved drafts, paginates and creates/opens the connected Plot Editor. Editor uses the real native repository after setup. Publication/activation still use the existing distinct workflows.
- Implemented player workspace: owned-character selector, audience tabs, received story-view cache and notification entry, explicit empty/unavailable states. **Automatic sharing/discovery and reload restoration of the player catalog remain outstanding (next task).** There is no fabricated sample campaign or hidden GM content in production screens.
- Positive local browser journey: actual bootstrap→setup→encrypted native save→GM list/reopen→player workspace. This uses native-document adapters in Chromium, not a real Foundry server. User retest in Foundry14.369 is still required.
- Work order item7 is next: complete targeted audience catalog/discovery, participant binding setup and visible connection management. Then items8–18 in order. Keep milestone5 partial until actual shared content is discoverable without pasted IDs.
- Unintegrated drafts world-setup-verification/WorldParticipants are retained as draft code; their presence is not a live enabled capability. Do not enable transports by inventing attestations. The old125-decision closure status is superseded by the product assessment.
