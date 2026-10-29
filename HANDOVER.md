# Easy Plots — current handover, 29 October 2026

This file supersedes completion/readiness claims in older handovers. Read this first, then [MEMORY.md](MEMORY.md) and [the next steps](docs/NEXT_STEPS_UI.md). Continue the existing project; do not rebuild it.

## Latest user direction

The user rejected the implemented UI as another approximation of the agreed design. The assistant acknowledged that the exact approved layout was still only the prototype, despite earlier restoration claims. The user explicitly stopped coding and requested **images of every screen only**. They clarified that the images should cover the **full agreed 125-decision scope, including unfinished features**, with no additional features. At roughly 2% credits, they requested this GitHub backup and updated handover/memory so work survives workspace loss. Do not resume implementation solely because older documents say to continue batches; wait for a new implementation instruction. Once authorized, do not request approval between routine batches.

## Recoverable material

- Repository: https://github.com/Somel1978/easy-plots ; normal continuation branch: `main`.
- [57-image catalog](docs/design/full-scope-2026-10-29/README.md): 3 approved original references plus 54 generated full-scope concepts, all stored as individual PNGs in Git. [Manifest and SHA-256 values](docs/design/full-scope-2026-10-29/MANIFEST.json).
- [Approved GM workspace](docs/design/images/gm-workspace.png), [plot editor](docs/design/images/gm-editor.png), [player workspace](docs/design/images/player-portal.png); [original interactive prototype](docs/design/gm-player-preview.html).
- [125-decision feature assessment](docs/assessment/2026-10-29/README.md), `spec/Decision_Register_125.csv`, and the 28 requirement groups define the scope. Full original Q1–112 wording is unavailable; do not invent missing decisions.
- [Work order](docs/WORK_ORDER.md), [existing interface ledger](docs/UI_SCREEN_MIGRATION.md), and [UI system](docs/UI_SYSTEM.md) remain useful after reading the latest correction below.
- Original transferred source/spec material and existing source/tests remain in the repository. `/workspace`, `/tmp`, chat attachments and generated-image UUID paths are not required to recover this checkpoint. Native Foundry distribution ZIPs were reference material, not part of this design backup; do not publish proprietary Foundry code or credentials.

## Actual product state

**The module and the agreed UI are incomplete.** The exact supplied layout has not been faithfully ported into the installed module. Existing technical forms hosted in one window do not constitute finished UX. Neither the 57 concepts nor the older 34-view backlog count is a feature-completion percentage or a promise that every missing workflow has been enumerated.

Latest runtime/source release: `1.14.1-dev`, source commit `a52d83b`, immutable tag `v1.14.1-dev`; latest documentation baseline before this checkpoint `dd5824b`. Release: https://github.com/Somel1978/easy-plots/releases/tag/v1.14.1-dev . Git-tracked installable ZIP: `releases/v1.14.1-dev/module.zip`, SHA-256 `be8825fe8bfd0c614d36250a3a2f0c1ae664b1335ef0309305fd29d90bccdba1`. Prior GitHub release-asset uploads failed authentication; the tagged ZIP mirror is the verified download. This checkpoint changes images/docs only, not the module version or release.

Last recorded local runtime evidence: 1,190 Node test cases, 227 module syntax checks and 5 browser checks passed, plus spec/schema/TypeScript/coverage checks; see `docs/UI_VALIDATION_v1.14.1-dev.json`. These were earlier local/synthetic-adapter runs, not rerun or newly certified by this documentation checkpoint. No final native Foundry-world/multiplayer acceptance has been performed.

The reported lost draft was created/edited **without clicking Save** in 1.14.0. Do not describe this as verified storage corruption or claim to have recovered the lost work. 1.14.1 creates a native draft immediately and autosaves guided edits after 900ms with pending/error/refresh protection. Reload requires unlocking the same encrypted vault.

Outstanding work includes faithful UI integration; participant/co-GM/player discovery and restored player catalogs; generic approved-intent execution; player voting submission; compound rule authoring; identity, faction, knowledge, investigation and quest workflows; schedules/clocks/spatial/timeline reconciliation; guided resources/rebinding/template updates; session/arc continuity; migrations and uncertain-effect recovery. Read the assessment for per-feature detail. The composed co-GM bootstrap may still key off local integration despite configured remote authoring; native acceptance is outstanding.

## Image fidelity and scope boundaries

Image generation initially introduced unverified controls and unsupported AI/official D&D adapter/old Foundry version claims. These were acknowledged. Screens 30, 31 and 32 were replaced; only the replacements are in the committed set. All remaining images are **concepts**, requiring a control-by-control check against the scope before coding. Sample names, decorative maps, generated footer totals, incidental labels and illustrations are not new capabilities, requirements or proof of map/AI generation. The manifest count is authoritative: 57 files. Do not claim the images perfectly specify all 125 decisions.

Retain native Foundry 14.369+ as the target, no mandatory external backend; GM authority; knowledge-safe views; separate draft saving, publication, activation and effect execution; immutable published snapshots; verified/reconciled uncertain effects. Never auto-apply narrative consequences merely because a screen opens, a draft is saved, or content is published.

## Next implementation sequence, when requested

Follow [NEXT_STEPS_UI.md](docs/NEXT_STEPS_UI.md): review scope/actions and freeze the shared visual structure; faithfully port the three main workspaces; connect real storage/discovery and role-aware entry; then finish editor, review, world, session and maintenance workflows using existing services. Keep automated regression checks during implementation and reserve final native Foundry qualification until the full deliverable is implemented. Report concrete residual gaps rather than batch counts or test totals as readiness.

All active changes at this checkpoint should be on GitHub main. Verify the commit and remote branch after pushing. If recovery starts from a fresh workspace, clone/fetch main; do not use an older module ZIP as the development source. [EASY_PLOTS_HANDOVER.md](EASY_PLOTS_HANDOVER.md) is the historical transfer document with a current-status pointer.
