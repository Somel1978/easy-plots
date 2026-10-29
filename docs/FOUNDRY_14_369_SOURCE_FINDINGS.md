# Easy Plots — Foundry v14.369 Source Findings

**Evidence:** user-provided `Foundry.zip` (client/common and `package.json`, generation 14, stable build 369) and `foundryvtt_dist.zip` (server distribution). This workspace **does not redistribute any of the supplied Foundry source files**. Re-run the signatures with `npm run audit:foundry -- /path/to/Foundry /path/to/dist`.

## Newly source-confirmed findings

| Source location | Source-supported consequence | Limit |
|---|---|---|
| `Foundry/common/packages/base-package.mjs` | Module manifests support `socket: boolean`. | Loading an enabled module's socket still needs a live probe. |
| `dist/packages/package.mjs`, `registerCustomSocket` | A package with a socket registers the `module.<id>` event channel. | Restricted to the particular build supplied. |
| `dist/server/sockets.mjs`, `handleCustomSocket` | The authenticated server socket has `this.user`; receiver callbacks are invoked with `this.user.id` appended, independently of the message payload. | An untrusted `claimedUserId` inside the payload is **never** identity proof. |
| Same source, `handleCustomSocket` | `socket.emit(channel, packet, {recipients: [userId]})` routes to targeted sessions rather than broadcasting by default. | Must still prove confidentiality from unauthorized clients in a real multiplayer world. |
| `Foundry/client/documents/user.mjs`, `Foundry/client/config.mjs` | `User.query` + namespaced `CONFIG.queries` is an alternative native user-to-user API and checks `QUERY_USER`. | Eligibility depends on user role/permission and live target user. Not assumed for every world. |
| `Foundry/client/documents/collections/compendium-collection.mjs` | Compendium has explicit ownership and allows index/document retrieval queries. | **Not evidence** that every GM-only pack index or read is withheld from unauthorized players. |
| `dist/database/backend/server-document.mjs`, `dist/database/backend/server-backend.mjs` | Reads run through backend operations; generic pre-get hooks do not alone establish a secrecy boundary. | Direct requests and bootstrap visibility must be tested on this exact build. |
| `Foundry/client/applications/api/application.mjs` | ApplicationV2 is present. | No graph-editor implementation is implied. |

## Architectural correction to earlier v0.3 assumptions

The general statement **“raw module sockets do not provide sender identity or recipient targeting”** was too broad. In the supplied v14.369 **server-side** implementation, the core handler provides both a server-attested sender parameter and recipient-based routing. These are valid primitives for a native transport adapter. They do **not** authorize player effects on their own.

The new `NativeFoundryIntentTransport` models these semantics. Its GM handler uses the *separate server sender-ID argument*, validates Actor ownership via a configured callback, and does not acknowledge intent persistence until a verified durable queue returns `{durable:true}`. Player replies are generic and only target the server-attested requester.

## Still not cleared by source inspection

1. **LIVE-SEC-001:** Verify the actual authenticated sender argument and the inability to spoof it by providing extra socket arguments or an arbitrary payload user ID.
2. **LIVE-SEC-002:** Verify a targeted response cannot be read by uninvolved players from their network layer, cache, or module hooks, even after reconnect.
3. **LIVE-SEC-003:** Check Actor ownership at the actual time of acceptance, review and effect execution, including unlinked tokens and delegated control.
4. **LIVE-STO-001:** Verify GM-only *pack and index metadata* are inaccessible to every unauthorized client through direct API requests and client bootstrap. Do not rely on the absence of a sidebar item.
5. **LIVE-COORD-001:** Multi-GM fencing and journal recovery during concurrent writes/disconnections.
6. **LIVE-API-001:** Exercise ApplicationV2 and all relevant native integration APIs in the target Foundry world.

Until these gates pass, the default bootstrap remains read-only, the native protected-storage adapter stays disabled, and no autonomous effects are allowed to mutate campaign documents.

## Safe test procedure

1. Create a disposable, backed-up Foundry **14.369** world and enable the development module from this workspace.
2. Log in as a GM and two distinct players. Open the browser console for all three.
3. On each console, import the module probe and call `installNativeModuleSocketProbe()`.
4. On player A's console call `sendNativeModuleSocketProbe(gmId)`. GM should receive, uninvolved player B should not; the authenticated sender should be player A, not the spoofed claimed ID.
5. Have the GM send a synthetic probe only to player A. Player B should not see it in developer tools, raw listeners or network frames.
6. Repeat with player B, reconnect scenarios and a co-GM. Record exact observed build and pass/fail evidence.
7. For protected storage, use synthetic canaries and the existing `inspectProtectedPack(packId)` probe from player clients. Check even index and metadata fields.
8. Do not test using actual GM secrets or a live campaign. Remove test listeners when complete.

**No live multiplayer results are claimed in this document.**
