# Whole-module screen migration ledger

This ledger follows [UI_SYSTEM.md](UI_SYSTEM.md). The one-window host applies to factories composed by `src/bootstrap/index.mjs`; it does not make the retained technical forms finished UX. “Local” means DOM/adapter verification, never native Foundry certification.

| Screen / source in `src/ui/` | Destination | Current state | Next acceptance requirement |
| --- | --- | --- | --- |
| `workspace-shell.mjs` | Shared frame | Local core journey | Native window lifecycle, keyboard and role-change acceptance |
| `campaign-workspaces.mjs` GM | Campaign | Real plot list, create, continue, open, setup state | Search/filter and publication summaries from indexed records |
| `world-setup-window.mjs` | Settings → Storage | Create/unlock inside shared frame | Native reload/unlock acceptance |
| `graph-editor.mjs`, `plot-editor-view.mjs` | Plot editor | Guided default; retained advanced view | Compound rule builder, entity selectors, dedicated domain forms and localization |
| `campaign-workspaces.mjs` player | Player sections | Owned-character context, shared-view cache, inline notices | Authorized discovery and catalog restoration after reload |
| `player-notification-inbox.mjs` | Player → Notifications | Notices integrated into workspace | Incoming native delivery acceptance; badge and unread state |
| `gm-cockpit.mjs` | Session → Overview | Hosted technical form | Select plot by title, actual activity list, contextual action/detail panes |
| `session-preparation-desk.mjs` | Session → Prepare | Hosted technical form | Plot picker, readiness cards and drag/order controls |
| `manual-event-desk.mjs` | Session → Record event | Hosted technical form | Named plot/context selection, typed event form, review summary |
| `session-handoff-desk.mjs` | Session → Handoff | Hosted technical form | Recap editor, audience selection, explicit publish/reopen flow |
| `encounter-closure-desk.mjs` | Session → Encounter | Hosted technical form | Native encounter selector, participant summary, completion review |
| `approval-window.mjs` | Review → Player requests | Hosted technical form | Request inbox, readable consequences, approve/reject/retry state; execution gap remains |
| `event-review-window.mjs` | Review → Narrative events | Hosted technical form | Indexed event list, causal timeline, consequence preview and explicit decisions |
| `board-edit-review.mjs` | Review → Board changes | Hosted technical form | Board/request selector, before/after diff and reviewed result |
| `knowledge-publication-desk.mjs` | Review → Publications | Hosted technical form | Content browser, audience selector and player preview |
| `graph-preflight-desk.mjs` | Plot editor → Checks | Hosted technical form | Named missing dependencies and links to repair them |
| `plot-authority-desk.mjs` | Plot editor → Permissions | Hosted technical form | Named GM list, labelled rights and ownership summary |
| `live-appearance-desk.mjs` | Plot editor → Appearance | Hosted technical form | In-place graph labels/layout without raw node identifiers |
| `knowledge-faction-desk.mjs` | World → People and knowledge | Hosted technical form | Entity list/detail, structured facts, relationships and audience controls |
| `investigation-board.mjs` | World / Player → Investigations | Hosted board | Board discovery, labelled evidence/theory selectors and proposal state |
| `quest-publication-desk.mjs` | World → Quests | Hosted technical form | Quest list, milestone editor, visible audience preview |
| `spatial-desk.mjs` | World / Player → Places | Hosted technical form/projection | Region browser, known routes and audience-aware discovery |
| `timeline-branch-desk.mjs` | World → Timelines | Hosted technical form | Branch list/compare and reviewed canonical selection |
| `resource-manifest-desk.mjs` | World → Resources | Hosted technical form | Foundry document pickers, binding status and lifecycle preview |
| `native-resource-inspector.mjs` | World → Resource details | Hosted technical form | Named resource references and guided repair/rebind |
| `native-batch-desk.mjs` | World → Resource actions | Hosted technical form | Action rows, typed values and ordered consequence preview |
| `template-desk.mjs` | World → Templates | Hosted technical form | Template browser, named binding slots and instance review |
| `planning-lab.mjs` | Session → Planning | Hosted technical form | Scenario form, readable simulated outcomes, explicit isolation from live state |
| `causal-planning-inspector.mjs` | Session → Time and commitments | Hosted technical form | Schedule/clock list, due-work review and time-jump summary |
| `continuity-desk.mjs` | Session → Continuity | Hosted technical form | Named arcs, recap/closure flow and correction review |
| `history-desk.mjs` | Settings → History/recovery | Hosted technical form | Human chronology and selected recovery plan |
| `signal-reliability-desk.mjs` | Settings → Event connections | Hosted technical form | Source list, connection status, explicit enable/recovery tasks |
| `storage-partition-desk.mjs` | Settings → Storage maintenance | Hosted technical form | Usage summaries, labelled archive/restore and failure recovery |
| `roll-system-policy-desk.mjs` | Settings → Game rules | Hosted technical form | System capability summary and structured policy controls |
| `world-participants-desk.mjs` | Settings → Participants | Unintegrated draft | Compose verified participant bindings; named user/character selectors |
| `status-window.mjs` | Settings → Advanced tools | Retained service directory | Keep technical diagnostics separate from ordinary tasks |
| `gm-workspace.mjs` | Contextual plot/session views | Legacy dock/inspector hosted | Merge contextual information into side panes without another window |
| `narrative-search-desk.mjs` | Shared search | Hosted technical form | Named results, scope filters, open result in existing workspace |
| `notification-desk.mjs` | Review → Share update | Hosted technical form | Compose message, select actual audience, preview and send status |
| `player-portal.mjs` | Retire ordinary ID-based entry | Advanced legacy entry retained | Replace with discovered authorized content, no pasted IDs |
| `player-continuity.mjs` | Player → Quests/Journal | Hosted projections | In-workspace selection and navigation from shared catalog |
| `protected-publication-viewer.mjs` | Player → Shared content | Hosted protected viewer | Preserve audience checks and native content links |
| `convergence-diagnostics.mjs` | Settings → Diagnostics | Diagnostic renderer | Plain-language incident summary with optional technical detail |
| `localization.mjs` | Shared infrastructure | Existing fallback retained | Translate all guided task copy in English and pt-PT |

Features without a complete screen yet remain on the 125-decision assessment and WORK_ORDER: voting, identity/persona management, friendly schedules/clocks, migrations and uncertain-effect recovery among others. This is an inventory of existing interfaces, not an assertion that the inventory covers all feature requirements.
