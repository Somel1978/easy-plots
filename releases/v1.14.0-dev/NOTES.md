Easy Plots 1.14.0-dev introduces the shared application frame and guided core authoring workflow. This is a UI foundation build. The whole module and its UI redesign remain incomplete.

- One role-aware Easy Plots window with persistent navigation. Setup, authoring and supporting views stay inside it; background updates do not steal navigation or reopen a closed workspace.
- GM Campaign and Plot editor support naming, typed condition fields, readable nodes and connections, draft saving, checking, publication and activation. Pending editor input survives navigation. The advanced editor remains available in-place.
- Player sections use owned-character context and inline notifications. Incoming notices no longer open another window.
- Fixed `GM_COMMAND_INVALID` during draft browsing by omitting absent optional values; strict command validation is preserved.
- The [UI contract](https://github.com/Somel1978/easy-plots/blob/v1.14.0-dev/docs/UI_SYSTEM.md) and [screen-by-screen migration ledger](https://github.com/Somel1978/easy-plots/blob/v1.14.0-dev/docs/UI_SCREEN_MIGRATION.md) define the remaining systematic work.

Local validation: 1,184 actual Node cases passed, zero failed/skipped; 224 modules passed syntax checks; composed workspace, launcher, advanced workflow and bounded Home Chromium checks passed. Specification/schema/TypeScript checks passed. Chromium uses synthetic Foundry application/document adapters. Native Foundry-world acceptance has not run.

Remaining: session/review/world-content desks are hosted but still use technical forms. Dedicated guided tasks, entity selectors, compound rules and complete task localization remain. Automatic player content discovery/catalog restoration and the other feature gaps in the 125-decision assessment remain incomplete. This release does not certify final-test readiness or complete product scope.

[Implemented UI screenshots](https://github.com/Somel1978/easy-plots/tree/v1.14.0-dev/docs/design/implemented-v1.14)

[Download module.zip](https://github.com/Somel1978/easy-plots/raw/refs/tags/v1.14.0-dev/releases/v1.14.0-dev/module.zip)

Manual installation: replace the `easy-plots` module folder with the one in the ZIP, then reload Foundry. Open Easy Plots from the left toolbar or Module Settings. Existing encrypted world storage uses the same vault passphrase. The manifest retains the author's custom-hosting convention; this publication does not upload those hosting endpoints.

The download above is an immutable Git-tracked ZIP mirror so it remains available when the GitHub asset upload endpoint is unavailable. Its checksum is in the adjacent SHA256SUMS.txt.
