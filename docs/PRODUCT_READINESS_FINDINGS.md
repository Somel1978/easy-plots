# Product readiness findings after the first real Foundry trial

**Audit scope:** the `1.13.1-dev` checkout after the launcher patch, before the new first-run setup implementation. Root owns that implementation. This document records the observed gaps and the acceptance needed to close them; it does not certify the later patch automatically.

**Finding:** the implemented domain services were not a usable first-run product in `1.13.0-dev`. The user's missing launcher, ephemeral storage, repeated protected-service errors and inaccessible Status actions follow directly from the actual bootstrap. The new launcher fixes discoverability, but it does not configure or restore native operation. Release should remain on hold until a fresh-world UI journey and reload persistence work without console-supplied JavaScript.

The earlier engineering closure reviewed service behavior and selected regression cases. It did not establish that an installed module could reach those services through its normal first-use UI. The functional qualification result therefore must not be described as proof that the product is ready for a GM to use. No closure record was rewritten in this audit.

## Concrete gaps

| ID | Priority | Observed implementation | User-visible consequence | Required product result |
|---|---|---|---|---|
| PR-01 | P0 | `ready` always initializes `integration=null` and a new `MemoryPartitionRepository`; the graph editor starts in `sandbox` (`src/bootstrap/index.mjs:71-77`). | Activating/reloading the module provides an ephemeral editor, even though durable native services exist. | First use clearly offers native world setup. A previously configured world restores the validated native backend on reload, or shows a precise actionable recovery reason. |
| PR-02 | P0 | The only native setup path is `configureVerifiedNative(...)`, requiring a pack reference, security evidence and callback functions (`src/bootstrap/index.mjs:525`). There is no first-run form, settings-backed configuration, pack creation/selection workflow or user-facing call to that method in the audited bootstrap. | Ordinary GMs cannot reach most implemented functionality. Telling them to invoke this API is developer integration, not product onboarding. | Complete the native setup journey from the module launcher/settings, with built-in reviewed policies and verified bindings. No pasted callback functions or invented attestation booleans. |
| PR-03 | P0 | Status renders all protected actions regardless of `integration`; click handlers generally catch a thrown error and show its message (`src/ui/status-window.mjs:8-48`). | The main menu looks functional but most buttons produce “Protected … required” errors with no next step. | Show setup/recovery as the primary action. Display each feature's actual prerequisites and offer a reachable way to satisfy them. Unavailable actions must not masquerade as ready services. |
| PR-04 | P0 | Native configuration and trusted binding callbacks exist only in the `ready` closure. No persistent world configuration is read on the next client load. Starting native mode replaces the model; saved sandbox drafts are not migrated. Dirty sandbox drafts are rejected, while a saved memory draft can still be abandoned by the switch. | Reload returns to sandbox. A user can lose work after “Save Draft” or when configuring native storage later. | Verify a native draft survives reload. Keep sandbox explicitly optional, protect unsaved/saved memory work during switching, and provide an explicit retain/export/copy/discard outcome. |
| PR-05 | P1 | Status is a 620×420 resizable ApplicationV2 window containing seven explanatory paragraphs and about25 buttons. `.easy-plots-status` is an unconstrained grid; no Status-specific scrolling region, height limit or window-content overflow rule exists (`static/easy-plots.css:1-5`). | The actual Foundry user reports no usable scrolling and cannot reach lower actions. | Inside the real ApplicationV2 content area, all actions remain reachable by pointer and keyboard at the default size and after resizing. Test actual overflow, not just DOM presence. |
| PR-06 | P0 | Optional configure callbacks control whether publication, board, continuity, spatial and roll services are composed (`src/platform/native-integration.mjs:238-295`). A minimal successful configure result can still omit these services. | “Native configured” does not mean the listed tools work. Several tools continue throwing dependency errors. | Setup creates/selects supported observer, native Actor and recipient bindings, and status reports each missing capability separately. Never claim a full native workspace from storage-only success. |
| PR-07 | P1 | Native configuration returns `transportStarted:false`. Hook ingress, co-GM commands and player transports need separate start methods/evidence. Status reports Hook state, but provides no complete UI flow for starting/stopping these dependencies. | Graph activation alone does not make native events react; player/co-GM requests may time out or return unavailable even after setup. | Explicitly enable verified requested capabilities through a visible control flow, report running/stopped/blocked states, and distinguish graph activation from Hook/transport startup. Effects still require their existing approvals. |
| PR-08 | P1 | The player portal asks for an exact story publication ID and native Actor ID (`src/ui/player-portal.mjs:25-34`). The new player launcher opens it, but it supplies no assigned-publication discovery flow. | A new player can open a portal yet have no usable story view or way to know which opaque publication ID to enter. | Give the GM a safe share/open workflow or give players an authorized publication listing/links. Empty state must explain when no approved view has been shared. Preserve observer confidentiality. |
| PR-09 | P1 | A secondary GM uses `connectGMPlotAuthoring({attestation})` and coordinator transport startup separately. Many other desks require a local `integration`. `integrationState` checks only that local variable. | A connected delegated editor can be in native mode while general status still says sandbox-only, and coordinator-only tools still fail. | Report coordinator versus delegated client accurately, expose granted tools, and give explicit connection/recovery instructions instead of generic storage errors. |

PR-01 through PR-04 and PR-06 are first-use product implementation gaps, not requests to rebuild the underlying125 domain services. PR-05 has direct user-reported native evidence. The launcher patch is a narrow, useful fix; it does not close these remaining items.

## What `configureVerifiedNative` actually requires

The audited public call is:

```js
configureVerifiedNative({
  packId,
  attestation,
  coreBuild,
  checkOpportunity,
  resolveObserver,
  resolveNativeActor,
  resolveNotificationUser,
  authorizeNotificationRecipient
})
```

The native storage checks require all of the following:

- The current user is a GM and the designated active Foundry GM writer. Merely being another active GM is insufficient.
- An existing unlocked world-owned `JournalEntry` Compendium with a collection ID, accessible through `game.packs.get(packId)`.
- Attestation `level === 'live-multiplayer'`, matching world ID, pack collection ID and supplied core build, with observed `playerIndexDenied`, `playerDocumentDenied` and `playerBootstrapDenied` evidence.
- A real `game.users.contents` array and a pack `getUserLevel` implementation reporting level0 for every non-GM user.
- Native `getDocuments` and `documentClass.createDocuments` APIs for actual protected reads/writes.
- A callable authoritative `checkOpportunity`. The factory refuses to initialize without one, even for a GM starting with the graph editor.
- No already-initialized native or remote authoring backend and no dirty sandbox model.

These are enforced in `src/storage/native-pack.mjs:19-30`, `src/security/gm-writer.mjs:45-57`, `src/platform/native-integration.mjs:113-132`, and `src/bootstrap/index.mjs:525-540`.

The current pack verifier compares the attested core build with the supplied `coreBuild` parameter. The product setup should derive the actual build from the live Foundry runtime and bind its saved configuration to it, rather than accept matching arbitrary strings as live build discovery.

The first-use path must be capable of obtaining and retaining the observations it needs. A form that asks a GM to check “verified” boxes or supplies `true` for old test-fixture flags does not execute the required checks. Conversely, retaining a gate that only a developer can satisfy leaves the product unusable. Root must resolve this integration boundary with a real native setup/probe workflow and clear pending states, while preserving fail-closed private storage.

Additional feature dependencies:

| Dependency | What is absent without it |
|---|---|
| `resolveObserver` | Native protected publication viewer/key service, player board-edit service and board server, continuity/quest/vote server, spatial server. GM-only core domain storage can exist independently. |
| `resolveNativeActor` plus native `Roll` | GM d20/opposed roll coordinators. An authored system policy is still a separate exact-system/build choice; it is not system-native rules certification. |
| `resolveNotificationUser` and `authorizeNotificationRecipient` | Notification delivery server cannot start. Having the notice repository alone is insufficient. |
| Native Actor/Item/Journal collections and create APIs | Corresponding materialization providers are omitted rather than fabricated. |
| Native Combat collection | Encounter closure service is omitted. |

The separate coordinator starts are `startVerifiedPlayerIntents`, `startVerifiedNotificationDelivery`, `startVerifiedContinuityRequests`, `startVerifiedBoardRequests`, `startSpatialTransport`, `startVerifiedPublicationKeys`, `startVerifiedGMPlotAuthoring`, and `startVerifiedReactiveHooks`. Socket-gated paths require verified authenticated sender, targeted recipient, forgery rejection and no-broadcast evidence. Reactive Hooks additionally require `nativeHooksVerified` and `gmHookOriginVerified`. Player spatial startup separately requires exact-world socket evidence. These must remain distinct capabilities in the setup/status UI; storage selection alone cannot prove them.

## What the present launcher test proves

`node --test tests/foundry-launcher.test.mjs` was run during this audit: **4 cases passed**.

It proves that the actual bootstrap registers the v14 control/settings launchers before ready, opens Status/Editor, rechecks GM role, handles pre-ready errors, and keeps player tools separate. The fixture's ApplicationV2 `render()` records the window ID. It neither configures native storage nor renders the actual window content. The Chromium launcher harness renders content into an unconstrained page container; it does not reproduce Foundry's fixed-height window chrome, so it cannot establish Status scrollability.

The native service regressions directly construct `createVerifiedGMStorageAndIntentSubsystem` using prepared packs, trusted callbacks and synthetic attestations. They exercise services after prerequisites already exist. They do not exercise a new user's path for supplying those prerequisites through the product.

No new test was added merely to assert that the current broken startup stays in sandbox. Root's native setup change needs the positive regression below; a passing test that preserves the old behavior would hide the actual defect.

## Required focused first-use regressions

1. **Fresh world, real bootstrap:** start with module enabled, no Easy Plots pack/settings, and no console calls. Open the launcher, reach setup, create/select appropriate protected storage through supported native APIs, and see clear validation/pending results. Do not mutate any narrative effect merely by opening the launcher.
2. **First useful persistent plot:** create a plot through the normal editor, save it to the configured pack, publish and activate it separately, reload the client, and reopen the same native draft/version. Assert that no memory repository silently replaced the configured backend.
3. **Reachable review:** from a configured GM UI, submit one explicit manual event for the saved graph, inspect its exact proposal, approve it and execute once. Assert the canonical state/journal survives reload and duplicate submission cannot repeat it.
4. **Capability progression:** verify storage-only, missing observer/Actor/recipient bindings, stopped Hooks and stopped transports each have specific states/actions. With supported bindings and observed evidence supplied through setup, open a formerly blocked desk and complete its real workflow.
5. **Failure and recovery:** cancel or fail setup, revoke pack visibility/GM role, change world/build/pack, and reload. Preserve prior work/configuration safely; expose a concrete recovery action and avoid marking unknown state ready.
6. **Status in window constraints:** render inside a fixed default-size ApplicationV2 content region; reach the final action by actual scrolling and keyboard focus, then resize smaller/larger. A test must inspect scroll range or last-button visibility after scrolling, not count buttons only.
7. **Player/co-GM entry:** connect one player and one delegated GM through normal launchers. Share a safe view without hand-copying protected IDs, confirm intended visibility, and show an actionable waiting state if the coordinator has not enabled a required transport.

These local regressions should be followed by the same narrow path in the user's actual Foundry world. Passing the service suite or refreshing engineering source hashes cannot substitute for that product journey. Native compatibility and broad multiplayer qualification remain separate claims.
