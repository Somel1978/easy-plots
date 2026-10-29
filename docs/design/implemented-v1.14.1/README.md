# Implemented correction — 1.14.1-dev

Actual module DOM and styles, exercised through the real bootstrap in Chromium with synthetic Foundry application/document adapters. Plot and character names are test inputs, not production sample data. These are not screenshots of a native Foundry world.

The supplied `../gm-player-preview.html` is the layout target. Remaining detail screens and feature dependencies are tracked in `../../UI_SCREEN_MIGRATION.md`.

- [GM workspace with an actual saved test plot](gm-workspace-saved.png)
- [Empty GM world](gm-campaign.png)
- [Plot editor](gm-plot-editor.png)
- [Categorized/contextual step discovery](step-discovery.png)
- [Constrained GM window](gm-narrow-window.png)
- [Player portal](player-workspace.png)

Reproduce with `tests/browser/workspace-ux-smoke.py`. The independent full-page autosave/reload regression is `tests/browser/world-refresh-smoke.py`.
