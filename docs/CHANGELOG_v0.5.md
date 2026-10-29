# Easy Plots — v0.5 development checkpoint

## Implemented in this batch

- `NativePackRepository`: GM-only, manually gated prototype for a **world-owned JournalEntry Compendium** with deterministic opaque 16-character IDs, native server-backed document retrieval (`getDocuments({_id})`), capped record size, eight bounded index pages with 32 entries each, staged `pending → record → ready` creation and explicit manual reconciliation.
- `NativeIntentQueue`: persistent, server-sender-keyed intent acceptance with durable read-back, duplicate suppression, GM review lifecycle, and Actor/opportunity revalidation before processing.
- `NativeEffectJournal`: durable idempotency record adapter compatible with `EffectCoordinator`'s state transitions and partition-scoped review.
- `DesignatedGMWriter`: serialized writes for the elected active GM client, fail-closed authority loss, manual reconciliation before rearming after handover. **Not a distributed lock or server-side CAS.**
- `createVerifiedGMStorageAndIntentSubsystem`: explicit composition of verified native source adapters; never auto-starts.
- Transport now supports replaying the *same* `requestId` after a timeout, and does not label an already-completed intent as newly pending.
- `tools/native-pack-access-probes.mjs`: player-side direct database/index canary checks in addition to UI visibility checks.
- 11 new Node-level storage/coordinator/queue tests; source-informed and mock-backed, not live Foundry multiplayer tests.

## Blockers / not claimed

1. The supplied v14.369 source is a reference, but no running Foundry server is accessible in this environment. **Native storage confidentiality, permissions, persistence, and concurrency are unverified.** The adapter cannot run without a matching manual live multiplayer attestation.
2. `pack.getDocuments` is server-backed in the supplied client source, but behavior and permissions require real runtime verification. Module flags in a JournalEntry are not by themselves confidential.
3. No server-enforced atomic compare-and-swap was found in this adapter. A designated active GM serializes locally, but co-GM split-brain remains unresolved and execution must suspend for handover reconciliation.
4. The published graph registry is still in-memory; the full UI, all 97 proposed provider types, migrations and real native effects remain unfinished.
5. Do not install into a real campaign or store actual GM secrets until probes pass in a disposable world and a migration/backup plan is tested.

## Integration sequence

1. Create synthetic GM-only world Compendium and verify every non-GM role, direct database access, index and metadata, bootstrap and websocket traffic.
2. Verify transport recipient targeting and sender attestation in three independent clients.
3. Exercise synthetic pack create/update/reconnect/GM handover in Foundry v14.369. Record build hashes, user roles and pass/fail evidence.
4. Enable verified storage only in the disposable world using the explicit manual integration factory, initially for synthetic narrative IDs.
5. Connect graph draft/publication repository and GM review interface after security gates pass.

This remains the one complete Easy Plots module project—not a reduced final release.
