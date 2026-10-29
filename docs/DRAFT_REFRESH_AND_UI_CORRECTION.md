# Draft refresh and UI correction — 1.14.1-dev

The user clarified that the reported plot had been created/edited without clicking Save draft. In 1.14.0-dev that state existed only in the editor's memory. It had not been committed to world storage. The earlier browser test saved explicitly and reopened within one client; it did not cover this expected workflow. This correction prevents recurrence; it does not recover the discarded unsaved plot.

## Draft persistence

- Creating a plot stores its first draft before its editor opens. A failed initial save opens the editor with the draft still in memory and reports the failure.
- Ordinary guided-editor changes autosave after a short idle period. Save draft remains available to save immediately. Autosave writes drafts only; publication, activation and effects remain explicit separate actions.
- The editor distinguishes pending, saving, saved and failed states. “Saved to this world” follows the existing native repository's verified save; it is not a client-cache acknowledgement.
- Typing focus and caret position survive autosave. Entered values remain available when a save fails. An open editor with pending/failed changes registers the browser's refresh/leave warning. Browser termination or deliberately overriding that warning is not a durability guarantee for pending changes.
- Reload locks the existing encrypted vault. Unlock it with the same passphrase to discover/reopen saved plots. No replacement vault or plaintext recovery cache is created.
- Plot browsing follows bounded empty physical index pages. An incomplete search is labelled incomplete, rather than claiming that saved plots are absent.

`tests/browser/world-refresh-smoke.py` exercises the actual bootstrap with a synthetic Foundry database held outside the browser page. It creates a plot, edits its title and authored step name without clicking Save, reloads the entire page, unlocks the same vault, finds the plot without its ID and reopens the saved values. It checks encrypted server bytes and tests server write failure, invalid input, refresh protection, retained typing focus and recovery. This is stronger local regression evidence; native Foundry-world acceptance remains separate.

## UI target and correction

The delivered 1.14.0 shell deviated because the implementation treated the supplied designs as a loose reference while prioritizing service navigation. The target is now explicit in UI_SYSTEM.md: `docs/design/gm-player-preview.html` and its three role/workspace screenshots.

The core composition now uses the top workspace switch, campaign/context navigation, GM plot cards with a review/activity rail, a graph-led editor with separate inspector, and the character-led player portal with content tabs and notice rail. Nodes support authored story names. Layer/outline navigation reuses the existing model. All production cards use actual saved or authorized data; the prototype's sample quests, people, notices and counts are not copied into the module.

Step discovery is grouped into ten categories, with bounded result cards, descriptions, search and suggestions related to the selected step. Every existing non-trigger type remains discoverable; start triggers stay in the plot-start chooser. Choosing a library result neither connects nor runs a step.

This correction does not finish all screens or backend features. Session/review/world-detail service forms still need guided redesign; resource/version browsing, complete localization, personal notes and automatic player discovery remain on the migration ledger. Disabled or absent controls are not counted as implemented features. The full 125-decision product assessment remains authoritative.
