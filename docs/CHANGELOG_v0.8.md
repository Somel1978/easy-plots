# v0.8 code batch

- Added explicit effect-provider registry, guarded narrative-state and milestone providers.
- Added durable GM proposal approval/rejection and separate apply action; journal before native effects; verify after; mark uncertain without retry on failed acknowledgement.
- Bound approved operation identity and source event identity to provider application context instead of trusting payload data.
- Extended native integration composition and GM event review ApplicationV2 window.
- Added true/false branch nodes and milestone qualifier nodes, with editor port selection and per-port routing.
- Corrected native operation journal handling for races where another writer already created a journal record.
- Added 18 Node tests, including one mocked native-persistence restart integration, and updated Chromium harness.
- Follow-up implementation remains in the same complete-module project; no end-to-end Foundry testing requested between code batches.
