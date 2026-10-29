# Easy Plots — Native Foundry VTT v14 Verification Plan (v0.4)

**Status: NOT YET VERIFIED IN A LIVE FOUNDRY WORLD.** The shipped source deliberately prohibits privileged native effects, player intent submission and protected data persistence until these checks pass.

## Platform documentation reviewed

1. Foundry v14 [ChatMessage API](https://foundryvtt.com/api/v14/classes/foundry.documents.ChatMessage.html) documents message visibility, author information and whisper recipient targeting. The chat documentation describes whisper access controls. **This is not yet a proof that user-supplied ChatMessage fields cannot be forged.**
2. Foundry [Users and Permissions](https://foundryvtt.com/article/users/) and [Compendiums](https://foundryvtt.com/article/compendium/) describe ownership and pack visibility.
3. The supplied **v14.369 server-side source** registers socket-enabled module channels and appends a server-attested sender User ID to custom socket callbacks; `{recipients:[id]}` permits targeted delivery. The client-side `SocketInterface` helper is different. This evidence does **not** replace live cross-client authentication and confidentiality testing.
4. A [Foundry v14 issue #13484](https://github.com/foundryvtt/foundryvtt/issues/13484) describes dangerous behavior in a Compendium with empty ownership; pack setup and access control must be tested against the exact target build. No assumption is made that the issue affects every v14 patch or that fixing one behavior proves complete privacy.

## Required test actors

- One GM, one co-GM, two distinct player users, at least one owned Actor and one unowned Actor.
- A disposable backed-up test world using an exact pinned Foundry v14 build; test a second patched build before claiming range support.
- A module-owned secret Compendium/document and a separately sanitized public record, all containing synthetic canary strings only.

## SEC-000: Native module socket source and recipient probe

Use the v0.4 `installNativeModuleSocketProbe()` and `sendNativeModuleSocketProbe(gmId)` functions with a GM and two players. A player sends a synthetic record with a forged claimed identity to the GM; check that the native callback sender ID matches the sending player, not the payload. Check that the uninvolved player does not receive targeted messages, including at the network layer; repeat for GM-to-player and after reconnect. A third-party module or GM-owned malicious code running in the recipient client is not excluded by this test. See `FOUNDRY_14_369_SOURCE_FINDINGS.md`.

## SEC-001: User-origin attestation (alternative native document path)

Open GM devtools and import `tools/foundry-v14-probes.mjs` through your module's mounted path. Run `installChatOriginObserver()`; save the returned cleanup function. In the player console run `sendOriginProbe()` and compare GM `createChatMessage` callback `requestingUserId` against the spoofed flag user ID. Repeat as each player, a GM and a co-GM. Attempt creation with forged `author`, `speaker`, flag and payload claim. Document whether server checks, native event user ID, message authorship and retention match; confirm handling after deletion/retry and offline GM rejoin.

**Acceptance:** A GM can attribute each persistent native submission to an independently verified authenticated sender without accepting claimed packet fields, enforce actual Actor ownership and reject forged or unverified provenance. If not possible, fail closed and evaluate another native document mechanism.

## SEC-002: Confidential responses

Send synthetic GM/player-targeted ChatMessages and document projections; inspect `game.messages`, `game.packs`, browser network traffic, computed flags and raw document source from another player client. Verify neither secret content nor sensitive metadata reaches unauthorized clients. Repeat on reconnect. A message being hidden in the chat UI is **not** sufficient. If no confidential delivery is verified, use validated per-user native document access and only opaque public receipts.

## STO-001: Protected persistence and indices

Build the module-owned Compendium with non-empty, deliberate ownership. Probe pack visibility and `getIndex()`/`getDocument()` using `inspectProtectedPack(packId)` as both players; repeat for world JournalEntry and embedded pages, direct UUID resolution and client connection bootstrap. Check document names, counts, GM-only flags and source metadata, not just full document text. Remove unauthorized player grants. Verify protected data after pack lock/unlock and migration. Test on the target v14 patch, including the behavior noted in issue #13484.

## COORD-001: Co-GM and interrupted writes

Simultaneously run two GM operations on the same narrative state revision, disconnect one after a native write but before client acknowledgement, and observe both clients on reconnection. The journal must never treat a stale lease or unknown acknowledgement as proof of exactly-once cross-document application. Mark uncertain outcomes and require verification or manual reconciliation.

## Test evidence schema

For each experiment record: test ID, target Foundry exact build, game system version, user roles, test account principal, expected/observed server-side behavior, network observation, persisted result, pass/fail, failure reproduction, tested API URLs, and reviewer. **Do not** mark SPIKE-SEC-001/SPIKE-STO-001 cleared based on the isolated Node tests.
