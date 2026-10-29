# Final Foundry qualification — v1.13.0-dev

Functional entry is ready:125 engineering decisions reviewed,97 candidate mappings reviewed with explicit interface differences,1147 actual local Node tests passed and three Chromium workflows passed. The source-fingerprinted gate is `npm run qualify:functional`. This document starts native acceptance; it does not record a completed native run.

## Prepare the exact native environment

Use a disposable backed-up world on Foundry14 build369, matching the supplied reference and author manifest convention. Record the exact game-system ID/version, browser/version and platform; these are currently unknown in the qualification matrix. Install the development module archive into Data/modules/easy-plots, retaining module.json/src/static/lang. Enable the module and confirm the API version is1.13.0-dev.

Use one coordinator GM, a coGM and two separately authenticated players with distinct owned Actors plus an unowned Actor. Use synthetic narrative content and known canaries for the protected-pack tests. The existing NATIVE_VERIFICATION_PLAN.md and FOUNDRY_14_369_SOURCE_FINDINGS.md describe direct native pack/index/bootstrap and sender/recipient probes. Do those probes before claiming the exact-world attestation required by configureVerifiedNativeStorage. Code/reference inspection and Node mocks cannot supply that attestation.

## Execute and record the complete scope

FOUNDRY_FINAL_TESTS_v1.13.csv contains all125 original decision-specific proposed acceptance scenarios and expected observations, with empty fields for actual evidence. Execute each in the real environment and retain observed results. FULL_SCOPE_QUALIFICATION.csv links the same decisions to concrete implementation sources and current automated cases. Reproduce failures against the exact installed build; do not infer native passage from local case totals.

Exercise ApplicationV2 open/close/reopen/reload/resize/focus and retained drafts (ADR021); independent GM approvals and effects; delegated plot editing/publication/activation; authenticated directed player requests and projections; Actor/Item/Journal/Chat/Combat/Roll effects; native ACK loss and original-only reconciliation; restart during preparation/index writes/batches; migrations and one-page reconciliation; dense-world routing/catchup and measured loads. Check actual player network/native document payloads for protected content and cross-observer inference. All twelve required native dimensions and exact compatibility target identity fields are enumerated in tools/qualification/plan.json.

Resource acceptance must distinguish planned metadata, separately approved shell creation, explicit native-proof review, separately approved activation, and consumption. Delete or alter one synthetic native resource, or change the graph activation, and verify subsequent approval/execution stops without recreation. Spatial acceptance must retain old disclosed route/name versions despite hidden canonical changes, exclude undiscovered endpoints and recheck actual sender/Actor ownership after awaited reads.

## Qualification evidence

Use the native-run schema and validation instructions in INTEGRATION_QUALIFICATION.md. Only enter actual executed cases and exact environment identities. Keep absent/failed dimensions visible. `npm run qualify:report` regenerates reports; `npm run qualify:check` rejects stale ones. `npm run qualify:release` must stay blocked until all required native evidence passes for the claimed exact environment. A second core/system combination requires its own run; a single build does not establish range support.

No real Foundry world run has been performed by this workspace. No native acceptance fields have been filled automatically.
