> Historical inventory, superseded as an active instruction by the user stopping coding and requesting images only. See [NEXT_STEPS_UI.md](NEXT_STEPS_UI.md) and the57-image design catalog. The34existing-view backlog and57design images count different things; neither means the full product/UI is complete. Exact approved layout has not been faithfully implemented.

# Remaining UI count after 1.14.1-dev

There are **34 existing views with substantive UI work outstanding**: 31 detail views and the three partially completed main workspaces. This count comes from UI_SCREEN_MIGRATION.md; it is not a count of all unimplemented product features.

| Area | Existing views needing work |
| --- | ---: |
| Session | 8 |
| Review and sharing | 5 |
| Plot checks, permissions and appearance | 3 |
| World content | 9 |
| Settings, participants and recovery | 5 |
| Search | 1 |
| Finish GM workspace, plot editor and player workspace | 3 |
| **Total** | **34** |

The three main workspaces are implemented and locally tested but retain the specific gaps recorded in the migration ledger. Most detail views are existing technical forms; hosting them inside the workspace did not finish their UX.

Excluded from this screen-work count: shared frame/localization/diagnostic helpers, setup requiring native verification, notice and projection components already folded into the player workspace, the retained advanced-tools directory, and legacy views being merged or retired. Exclusion does not certify native acceptance.

The inventory also identifies features without a complete screen/workflow, including voting and migration/recovery work. Their unresolved scope/dependencies mean that 34 is not a promise that completing these views alone completes the module.

The user reports 5% credits remaining and prioritizes finishing screens. Freeze the supplied reference layout; direct implementation effort to the existing detail views, reusing current UI controls and backend services. Record backend blockers explicitly. Do not spend this remaining scope on another shell redesign or convert a new test count into a completion claim. No reliable credit-to-completion estimate is available.
