This build corrects draft persistence expectations and brings the core UI back toward the supplied GM workspace, plot editor and player portal designs. The module and remaining detail screens are still incomplete.

- New plots are saved as drafts immediately. Guided edits autosave, with pending/saving/saved/error status, retained typing focus and a browser refresh warning for pending or failed changes. Save draft remains available for immediate saving. Publication, activation and effects stay explicit.
- A full-page reload regression creates and edits a plot without clicking Save, reloads the entire client, unlocks the same encrypted vault, finds the plot and reopens its title and authored step name. The synthetic database lives outside browser JavaScript. Server write failure, invalid input, refresh protection and recovery are also checked. This is local evidence, not native Foundry certification.
- The core layout now follows the reference's top workspace switch, campaign/context navigation, plot cards and review/activity rail, graph-led editor with separate inspector, and character-led player portal with content tabs and a notice rail. Production content comes from actual saved or approved data.
- Step discovery has categories, descriptions, contextual suggestions, search and bounded result pages. The complete non-trigger step catalog remains discoverable. Authored step names persist.
- Empty physical storage pages are followed within a budget and do not falsely claim that plots are absent.

[Download module.zip](https://github.com/Somel1978/easy-plots/raw/refs/tags/v1.14.1-dev/releases/v1.14.1-dev/module.zip)

[Actual module screenshots](https://github.com/Somel1978/easy-plots/tree/v1.14.1-dev/docs/design/implemented-v1.14.1) · [Correction details](https://github.com/Somel1978/easy-plots/blob/v1.14.1-dev/docs/DRAFT_REFRESH_AND_UI_CORRECTION.md) · [Remaining screen work](https://github.com/Somel1978/easy-plots/blob/v1.14.1-dev/docs/UI_SCREEN_MIGRATION.md)

Local validation: 1,190 actual Node cases passed, zero failed/skipped; 227 runtime modules passed syntax checks; five Chromium checks passed (full refresh, composed UI, existing advanced workflows, launcher, bounded Home). Specification/schema/TypeScript/inventory checks passed. Native Foundry-world acceptance has not run.

Manual installation: replace the easy-plots module folder using the ZIP, then reload Foundry. Existing vault data uses the same passphrase; unlock world storage after reload. This cannot recover an earlier draft that was never saved. The immutable tagged-repository ZIP and its adjacent SHA256SUMS.txt provide the download independently of release-asset upload availability.

Remaining: guided session/review/world-detail forms, automatic player discovery and catalog restoration, private personal notes, resource/version browsers, complete localization and the other assessed feature gaps. These are not counted as completed by this UI correction. Custom-hosting manifest URLs follow the author's convention; this publication does not upload those endpoints.
