# Easy Plots — full-scope UI image checkpoint, 29 October 2026

57 PNG screen images: the 3 original approved references and 54 generated concepts. These are design material with sample campaign content, including unfinished features. They do not establish implementation, test results, or native Foundry compatibility.

The user explicitly stopped coding after rejecting another approximation of the agreed layout, requested image generation only, and chose the **full agreed scope including unfinished features**, without additions outside that scope. Preserve the original campaign frame, navigation, graph canvas and separate inspector. Do not treat a generated control or sample label as a new feature requirement. The 125-decision register and assessment remain the scope boundary.

The original generated rules image introduced unsupported AI, an official D&D adapter and incorrect Foundry version claims. It was replaced. Storage and event-reliability images were also replaced to remove unsupported backup/certification and bulk-review claims. Only their replacements are included here. Other images remain concepts needing a control-by-control scope and UX review before implementation. Minor generated text/count inconsistencies are not requirements; footer totals in some images are unreliable. The manifest has the actual count.

## Recovery and continuation

Read [HANDOVER.md](../../../HANDOVER.md), [MEMORY.md](../../../MEMORY.md), and [the next steps](../../NEXT_STEPS_UI.md) before editing runtime code. The exact approved main references remain [GM workspace](../images/gm-workspace.png), [plot editor](../images/gm-editor.png), and [player workspace](../images/player-portal.png). Existing implementation screenshots in the separate implemented-v1.14.1 directory do **not** show a faithful implementation of this design.

All 57 PNGs are normal Git-tracked files, so a fresh clone or GitHub repository ZIP recovers them without this chat or workspace. [MANIFEST.json](MANIFEST.json) records each file and SHA-256. To recreate an images-only ZIP after cloning, run from the repository root:

```sh
python -m zipfile -c Easy_Plots_Full_Scope_UI_Images.zip docs/design/full-scope-2026-10-29/images/*.png
```

## Screen catalog

| Screen | Image | Type |
| --- | --- | --- |
| 01 | [GM campaign workspace](images/01-GM-campaign-workspace.png) | approved original reference |
| 02 | [GM plot editor narrative](images/02-GM-plot-editor-narrative.png) | approved original reference |
| 03 | [Player workspace quests](images/03-Player-workspace-quests.png) | approved original reference |
| 04 | [Session overview](images/04-Session-overview.png) | generated full-scope concept |
| 05 | [Session preparation](images/05-Session-preparation.png) | generated full-scope concept |
| 06 | [Record story event](images/06-Record-story-event.png) | generated full-scope concept |
| 07 | [Session handoff recap](images/07-Session-handoff-recap.png) | generated full-scope concept |
| 08 | [Encounter closure](images/08-Encounter-closure.png) | generated full-scope concept |
| 09 | [Planning simulation](images/09-Planning-simulation.png) | generated full-scope concept |
| 10 | [Time commitments clocks](images/10-Time-commitments-clocks.png) | generated full-scope concept |
| 11 | [Campaign continuity](images/11-Campaign-continuity.png) | generated full-scope concept |
| 12 | [Player request review](images/12-Player-request-review.png) | generated full-scope concept |
| 13 | [Narrative event review](images/13-Narrative-event-review.png) | generated full-scope concept |
| 14 | [Investigation board review](images/14-Investigation-board-review.png) | generated full-scope concept |
| 15 | [Knowledge publication review](images/15-Knowledge-publication-review.png) | generated full-scope concept |
| 16 | [Campaign notice review](images/16-Campaign-notice-review.png) | generated full-scope concept |
| 17 | [Plot publication checks](images/17-Plot-publication-checks.png) | generated full-scope concept |
| 18 | [Plot permissions](images/18-Plot-permissions.png) | generated full-scope concept |
| 19 | [Live plot appearance](images/19-Live-plot-appearance.png) | generated full-scope concept |
| 20 | [People and knowledge](images/20-People-and-knowledge.png) | generated full-scope concept |
| 21 | [GM investigation board](images/21-GM-investigation-board.png) | generated full-scope concept |
| 22 | [Quest milestone editor](images/22-Quest-milestone-editor.png) | generated full-scope concept |
| 23 | [Places and routes](images/23-Places-and-routes.png) | generated full-scope concept |
| 24 | [Campaign timelines](images/24-Campaign-timelines.png) | generated full-scope concept |
| 25 | [Resource preparation](images/25-Resource-preparation.png) | generated full-scope concept |
| 26 | [Resource detail rebinding](images/26-Resource-detail-rebinding.png) | generated full-scope concept |
| 27 | [Ordered resource actions](images/27-Ordered-resource-actions.png) | generated full-scope concept |
| 28 | [Plot templates bindings](images/28-Plot-templates-bindings.png) | generated full-scope concept |
| 29 | [History and recovery](images/29-History-and-recovery.png) | generated full-scope concept |
| 30 | [Event sources reliability](images/30-Event-sources-reliability.png) | generated full-scope concept |
| 31 | [Native storage maintenance](images/31-Native-storage-maintenance.png) | generated full-scope concept |
| 32 | [Game rules native checks](images/32-Game-rules-native-checks.png) | generated full-scope concept |
| 33 | [World participants](images/33-World-participants.png) | generated full-scope concept |
| 34 | [Narrative search](images/34-Narrative-search.png) | generated full-scope concept |
| 35 | [World storage setup](images/35-World-storage-setup.png) | generated full-scope concept |
| 36 | [Player investigation board](images/36-Player-investigation-board.png) | generated full-scope concept |
| 37 | [Player known map](images/37-Player-known-map.png) | generated full-scope concept |
| 38 | [Player journal](images/38-Player-journal.png) | generated full-scope concept |
| 39 | [Player notifications](images/39-Player-notifications.png) | generated full-scope concept |
| 40 | [Protected shared content](images/40-Protected-shared-content.png) | generated full-scope concept |
| 41 | [Factions membership renown](images/41-Factions-membership-renown.png) | generated full-scope concept |
| 42 | [Identities relationships](images/42-Identities-relationships.png) | generated full-scope concept |
| 43 | [Truth beliefs knowledge](images/43-Truth-beliefs-knowledge.png) | generated full-scope concept |
| 44 | [NPC schedules agendas](images/44-NPC-schedules-agendas.png) | generated full-scope concept |
| 45 | [GM voting setup](images/45-GM-voting-setup.png) | generated full-scope concept |
| 46 | [Player voting](images/46-Player-voting.png) | generated full-scope concept |
| 47 | [Plot rule builder](images/47-Plot-rule-builder.png) | generated full-scope concept |
| 48 | [Categorized step discovery](images/48-Categorized-step-discovery.png) | generated full-scope concept |
| 49 | [Narrative diagnostics](images/49-Narrative-diagnostics.png) | generated full-scope concept |
| 50 | [Data migration review](images/50-Data-migration-review.png) | generated full-scope concept |
| 51 | [Plot versions publication](images/51-Plot-versions-publication.png) | generated full-scope concept |
| 52 | [Plot outline cross plot links](images/52-Plot-outline-cross-plot-links.png) | generated full-scope concept |
| 53 | [Plot execution layer](images/53-Plot-execution-layer.png) | generated full-scope concept |
| 54 | [Plot knowledge layer](images/54-Plot-knowledge-layer.png) | generated full-scope concept |
| 55 | [Nested plot typed ports](images/55-Nested-plot-typed-ports.png) | generated full-scope concept |
| 56 | [Arc finalization continuity](images/56-Arc-finalization-continuity.png) | generated full-scope concept |
| 57 | [Extensions developer validation](images/57-Extensions-developer-validation.png) | generated full-scope concept |
