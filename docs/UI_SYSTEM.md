# Easy Plots UI implementation contract

The user rejected the window-per-service interface on 29 October 2026. This document defines the replacement across the module. Existing services and the 125-decision scope remain authoritative; a screen or a passing test does not establish that a feature is complete.

The visual implementation target is `docs/design/gm-player-preview.html` and its GM workspace, GM editor and player portal screenshots, reaffirmed by the user's comparison on 29 October. Treat its layout and hierarchy as requirements: shared top workspace switch, campaign/context navigation, a graph-led editor with separate inspector, and character-led player content. Populate it with real world/audience data and honest empty states. The 1.14.0 navigation skeleton deviated from this target and is not a replacement design.

New plots must be persisted immediately as drafts. Ordinary editor changes autosave with a visible pending/saving/saved/error state. A pending or failed save protects refresh with a browser warning. Explicit publication and activation remain separate. Acceptance includes a full page reload using server state outside the JavaScript realm, unlocking the same vault, and finding/reopening the plot without knowing its ID.

## Shared application structure

One Easy Plots ApplicationV2 per client. The toolbar and module settings reopen it. Navigation changes its content, rather than creating another Foundry window. Persistent navigation, campaign name, current location and storage status remain visible. Supporting views have a Back action. Changing location preserves an open plot and its unapplied form values. Opening a different plot requires saving or deliberately discarding existing edits.

GM navigation:

| Area | Purpose | Primary workflows |
| --- | --- | --- |
| Campaign | Start here; see actual saved plots and next steps | Set up/unlock storage; create or continue a plot |
| Plot editor | Author the current plot | Name → choose start → add/connect steps → check → save → publish → activate |
| Session | Run prepared content | Session preparation, cockpit, manual events, encounter closure, handoff |
| Review | Inspect proposed changes before acting | Player requests, narrative events, board edits, publication review |
| World | Manage reusable campaign content | Characters/factions, knowledge/investigations/quests, places, time, resources |
| Settings | Configure and troubleshoot | Storage, permissions, integration availability, advanced tools |

Player navigation: Quests, Investigations, Known world, Journal and Notifications, within the same application. A labelled owned-character selector establishes the audience. No GM navigation, private drafts or raw record lookup appears. Empty content must explain whether nothing is shared or discovery is unavailable; never manufacture campaign content.

## Screen and component rules

- Consistent spacing, typography, dark surfaces, focus rings and button hierarchy, scoped to Easy Plots. Responsive navigation and bounded vertical scrolling in small Foundry windows.
- Headings say what the user is doing. Visible labels accompany every field; helper text explains required choices. Technical identifiers are values, not labels. Internal IDs, event strings, raw JSON and security diagnostics belong in explicitly opened advanced tools.
- Each task has an obvious next action. Distinguish draft saving, checking, publication and activation; do not imply that publishing executes effects.
- Primary actions display progress and prevent duplicate submission. Recoverable errors state the failed task and preserve entered values. Never relax command or authority checks to make the UI appear connected.
- Empty/loading/unavailable/read-only/error/success states are part of each screen's acceptance criteria. Disabled actions explain what is needed. Opening the application has no world effect.
- Forms retain edits while navigating. Explicit Save includes entered form values. No unexplained Rename/Apply sequence is required before saving a title.
- Graph nodes, list entries, ports and inspector headings use readable names. The node library is labelled and searchable. Structured data uses labelled controls; advanced configuration remains available for unsupported expressions.
- Setup is a task inside Settings. Storage connection state is shared throughout the application. Vault passphrases remain transient password fields.

## Migration order and acceptance

| Stage | Existing screens | Required outcome |
| --- | --- | --- |
| 1. Application frame | launchers, campaign workspaces, all ApplicationV2 factories | One native host; role-aware navigation; no nested Easy Plots windows; safe background refresh |
| 2. Core authoring | campaign list, world setup, graph editor, permissions, appearance | Complete create/save/find/reopen journey; retain edits; fix strict-command browsing failure; friendly default authoring |
| 3. Player foundation | player workspace, notification inbox, authorized projections | Consistent frame and character context; no GM leakage; inline notices; honest discovery limitations |
| 4. Session and review | cockpit, preparation, handoff, manual events, event/request/board/publication review | Task lists, selected plot context, previews, labelled forms, explicit approval outcomes |
| 5. World content | identity/faction, knowledge, investigation, quest, spatial, time/timeline, resources/templates | Entity browsers and selectors instead of record IDs; structured editors; linked detail views |
| 6. Settings and recovery | safety/reliability, history, storage, roll policy, migration/recovery | Clear connection and recovery tasks; technical detail progressively disclosed |
| 7. Native acceptance | all above | Real Foundry 14.369 GM/player tests, role changes, reload, failure recovery and constrained-window use |

Legacy service desks hosted in the frame remain advanced interfaces until their task forms pass stage-specific acceptance. Hosting them does not mean their UX has been redesigned. Player discovery, vote submission, generic approved-request execution and other assessment gaps remain feature work; UI changes must not claim to implement them.

Local acceptance covers the actual bootstrap and user actions in Chromium, including one host instance, setup, a named saved/reopened plot, browsing without undefined command fields, navigation with unsaved input, role isolation, and narrow-window scrolling. Native Foundry acceptance is recorded separately.
