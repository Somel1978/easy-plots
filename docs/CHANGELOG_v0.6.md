# Easy Plots — v0.6 Integration Batch

## Completed

- `PersistentGraphRegistry` on the existing partitioned repository contract: bounded GM-only draft records, immutable published snapshot records, separate activation records, optimistic revision checks, persisted snapshot SHA-256 fingerprints and recovery-aware index readiness checks. A snapshot does not activate its graph automatically.
- Explicit acknowledgement of reachable/unreachable narrative design warnings before publishing. This is **structural preflight only**, not full security, game-system, or narrative-provider certification.
- `GraphEditorModel` with draft creation, rename, typed node addition, connection and cycle checks, node settings, canvas positions, saving, publishing, activation and scope-limited browsing.
- Foundry `ApplicationV2` GM graph editor with visual SVG node canvas, editable inspector, flow connectors, and memory-sandbox/native-mode labels. Dragging node positions updates local draft data, which must be saved to persist.
- `ApplicationV2` GM request review: exact-key durable lookup, explicit approve/reject transitions. Approval **does not execute effects**.
- GM bootstrap `api.openEditor()`, `api.openStatus()`, `api.openApprovals()`, and explicit `api.configureVerifiedNative(...)`. No privileged transport/storage startup by default. Player-intent transport additionally requires explicit successful sender/recipient/forgery/broadcast attestation flags, besides protected pack proof.
- Portable SHA-256 fallback for deterministic IDs on Foundry HTTP LAN sessions lacking `crypto.subtle`. The fallback produces identical IDs; secure UUID generation uses `getRandomValues` if `randomUUID` is not exposed. Neither mechanism replaces native authorization.
- Test extensions: persistent drafts, snapshot isolation, activation CAS-like revision checking, native mock read-back, interrupted snapshot indexing, unknown provider gating, warning review, and editor model behavior.

## Important scope and limitations

- **Development checkpoint only; complete 125-decision module remains unfinished**. Graph editor offers an initial typed subset (event, condition, proposed effect), not the 97 proposed node providers.
- Memory sandbox UI works without protected Compendium verification, but cannot persist across Foundry page reload; it is separate from live world records.
- Native graph persistence remains manually gated and requires independently observed live GM/player access tests. Attestation fields represent a checked deployment prerequisite; supplied fake flags are not proof of security.
- Live Hooks-driven graph execution, real effects, player-safe projections and cross-GM distributed fencing are NOT enabled by the editor's activation pointer.
- Graph records are conservatively limited to 44 KB. Future published graph partition/chunk formats require a deliberate versioned design.
- Foundry ApplicationV2 UI was tested in a Chromium DOM harness using a small stand-in for the ApplicationV2 shell. No real Foundry v14 server was executed in this environment.
- Proprietary Foundry source archives were consulted but are not redistributed in the module ZIP.

## Next batch

1. Test exact Foundry v14.369 native Compendium security, sockets and multi-GM behavior in a disposable world.
2. Add lazy persisted active-snapshot subscriptions with GM-only Hook adapters and durable event/effect coordination.
3. Expand the full provider catalog and controlled graph authoring tools in parallel workstreams, with incremental acceptance tests.
