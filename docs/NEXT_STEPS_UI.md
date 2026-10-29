# Easy Plots — continuation order after the image checkpoint

Updated 29 October 2026. **Current task is preservation, not implementation.** The user stopped coding and requested image generation only, then GitHub backup. Resume code changes when requested. Preserve the full 125-decision deliverable and existing code; do not restart or add features inferred from generated images.

## 1. Recover and establish the baseline

1. Clone/fetch `Somel1978/easy-plots` main. Read `HANDOVER.md`, `MEMORY.md`, this document and `docs/assessment/2026-10-29/README.md`.
2. Check the 57 PNG files against `docs/design/full-scope-2026-10-29/MANIFEST.json`. The first 3 files are the approved original anchors. Screens 30–32 in this set are replacements; old versions remain excluded.
3. Read `docs/UI_SCREEN_MIGRATION.md`, `docs/UI_SYSTEM.md`, and `docs/WORK_ORDER.md` as implementation inventories, not proof that their layout claims were accepted. Exact supplied layout is still unimplemented. The older 34-view count and 57 design-image count measure different things.
4. Preserve immutable release tags and `releases/v1.14.1-dev/module.zip`. Do not rebuild/release a runtime for documentation changes.

## 2. Reconcile the concepts before using them as specifications

For each screen, map fields/actions to the relevant accepted ADRs and actual existing service contracts. Mark behavior implemented, incomplete, or needing integration. Remove unsupported generated controls; do not implement them just because image generation drew them. Fix incidental text/count contradictions in the eventual UI. Sample campaign prose/portraits/maps remain design data, never production seed data or promises of generators.

Freeze the shared layout from the 3 approved references: top workspace switch; campaign/character rail; original card proportions and content hierarchy; GM decision/activity rail; graph-dominant editor with separate inspector. Use the original prototype as the structure to port. Do not produce another loose approximation or redesign the frame between screens. The complete image catalog is in `docs/design/full-scope-2026-10-29/README.md`.

## 3. Implement in this order, reusing existing services

| Order | Deliverable / image references | Completion evidence |
| --- | --- | --- |
| A | Shared frame, GM campaign, plot editor, player workspace (01–03) | Matched side-by-side layout at reference and narrow sizes; one host window; GM/player easy entry; labelled controls, bounded scrolling, keyboard/focus behavior; no console needed |
| B | Storage/setup and participant discovery (29–35), player views (36–40) | Create/edit without Save → full refresh → unlock same vault → draft restored; failed saves retain edits; real authorized content discovers and restores after reload; co-GM/role changes and offline/unavailable states covered |
| C | Plot checks/authority/appearance (17–19), editor rules/library/versions/outline/layers/subplots (47–48, 51–55) | Categorized/contextual step selection; authored labels; compound rules and typed ports; real bindings; immutable publication; separate activation and review; useful validation links |
| D | GM review and sharing (12–16), votes (45–46) | Named inbox items, before/after and audience previews; approved requests actually reach verified execution; reject/retry versus reattempt lifecycle; quorum/deadline/offline rules; player never receives hidden GM truth |
| E | People/knowledge/investigations/quests/places/timelines/resources (20–28, 41–44) | Complete create/edit/save/reload and GM/player journeys; scoped knowledge and evidence; independent milestone/investigation closure; renown/rank/privileges distinct; guided rebinding/provenance and template merge review |
| F | Session preparation/events/handoff/encounters/planning/time/continuity (04–11, 56) | Real named context selectors; proposed versus committed outcomes; isolated what-if state; reviewed time jumps, recaps and endings; unresolved hooks/debts persist |
| G | Diagnostics, migrations and extension validation (49–50, 57), maintenance/recovery (29–32) | Human-readable causes; scoped repair plans; migration conflicts and role loss recover without repeating uncertain effects; installed-system capabilities and unknown extensions handled truthfully |
| H | Full-scope reconciliation and final native Foundry qualification | Every accepted ADR mapped to complete behavior and acceptance evidence; exact Foundry 14.369+ world, multi-client permissions/disclosure/co-GM/socket/reload/load/migration/recovery checks; do not infer native compatibility from local tests |

When implementations are authorized, proceed through necessary routine batches without approval requests. Keep automated tests appropriate to each real change; preserve existing passing behavior and run required repository checks. Test user journeys and failure cases, not just renderer strings. Record actual commits/checks/remaining gaps; do not turn counts into a completion estimate.

## Known feature gaps to retain

Participant/co-GM bindings and bootstrap, automatic safe player catalog discovery/reload restoration, generic approved-intent execution, player vote submission, compound rule UX, identity/persona/faction/relationship/knowledge workflows, structured hypotheses and milestones, temporal/spatial reconciliation, guided resource lifecycle/rebinding/blueprint adoption, planning/closure, migrations and uncertain-effect recovery remain in the assessment. The images do not close these gaps. Current latest local evidence is historical `docs/UI_VALIDATION_v1.14.1-dev.json`; native acceptance is still pending.

## Checkpoint completion

Commit all image files, manifest, catalog, this work order, both handover entries and memory. Push to main using normal fast-forward Git history, verify remote HEAD equals the checkpoint commit and confirm representative GitHub file reads. Do not depend on chat-only files, local generated-image UUIDs, or promises of background work. No Foundry distribution source, passwords or tokens belong in this backup.
