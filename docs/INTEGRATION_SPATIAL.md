# ADR-033 integration contract

The spatial implementation is in `src/orchestration/persistent-spatial.mjs`,
`src/domains/spatial-contract.mjs`, `src/runtime/spatial-region-provider.mjs`,
`src/platform/foundry-spatial-transport.mjs`, and `src/ui/spatial-desk.mjs`.

## Canonical records and graph definitions

`narrative-capabilities.mjs` now defines `core.location.place` →
`narrative.location-place` → canonical `location` with `locationId`, `name`,
`kind: region|site`, optional immutable `parentLocationId`. Existing
`core.location.discovery` and `core.location.route` now use canonical kinds
`location-discovery` and `location-route`, keyed by their authored identity IDs.
The original provider IDs and payload contracts are preserved. Versions become
1.1.0 through the existing canonical bridge. Old hashed capability records are
never silently adopted: `previewLegacyAdoption` and `adoptLegacy` require the
exact old revision/fingerprint and an explicit review event. An unadopted or
competing legacy source blocks provider execution. Discovery identity fixes
observer/location; route identity fixes both endpoints.

Add domain-store kinds `location-discovery`, `location-route`, `spatial-region`,
`spatial-view`. All use ordinary protected domain partitions:
`domain-<kind>-<scope>`, with existing `domain-history-*` revision retention.
No public or proprietary storage files are added.

Add editable effect node `core.location.region`, provider
`narrative.location-region`, ordinary `in`/`out` flow ports and payload default:

```js
{scope:'world', regionId:'ep:location:region_example',
 locationIds:[], routeIds:[], expectedRevision:null}
```

Register `validateSpatialRegion` from `domains/spatial-contract.mjs` in the
published graph validator for that node. Existing effect-node lowering must map
it to the provider, just as other domain effects. Register the provider with:

```js
providers.register(createSpatialRegionProvider({service:spatial,domains,gmProvider}));
```

The region provider persists a verified manifest only after ordinary graph
proposal approval/execution. It checks that the selected location is a region,
every listed child points directly to it, no ancestor cycle exceeds the depth
budget, and all route endpoints belong to the selected region. It supports
operation receipts and exact verification without discovering for any observer.

## Native composition and API

After constructing `knowledgeLedger`, compose:

```js
const spatial=new PersistentSpatialAtlas({domains,knowledge:knowledgeLedger,
  gmProvider,writer,worldTimeProvider:()=>gameInstance.time?.worldTime??0});
const spatialTransport=typeof resolveObserver==='function'?
  new NativeFoundrySpatialTransport({gameInstance,attestation,service:spatial,
    actorAuthorization:actorAuthorizer,resolveObserver}):null;
```

Return `spatial` and `spatialTransport` from the native subsystem. Explicit
`startSpatialTransport()` should assert the writer, reject absent binding,
then call `spatialTransport.start()`. Stop it in the subsystem's existing stop.
No sockets start automatically. Transport startup requires exact-world
`socketSenderVerified`, `socketRecipientVerified`, `socketForgeryRejected`, and
`socketNoBroadcastVerified` all true. It binds server-appended user ID to an
owned Actor and trusted observer, then repeats that authorization after awaiting
the projection. Replies are strictly validated and targeted to one recipient.

Expose GM-only service wrappers:

* `inspectSpatialRegion(spec)` → `spatial.inspectRegion(spec)`.
* `inspectSpatialAtlas(spec)` → `spatial.inspectView(spec)` (protected GM draft).
* `saveSpatialRegion(spec)` → `spatial.saveRegion(spec)`.
* `saveSpatialAtlas(spec)` → `spatial.saveView(spec)`.
* `previewSpatialAtlas(spec)` → `spatial.projection(spec)`.
* `planKnownSpatialRoute(spec)` → `spatial.route(spec)`.

Use `makeSpatialDeskWindow(Base,{gameInstance,service:spatial})` for the GM API
`openSpatialDesk()`, and expose it in the existing GM workspace/cockpit menu.
`makePlayerSpatialWindow(Base,{transport})` implements the separate player
window. Player bootstrap needs only `NativeFoundrySpatialTransport` and the
attestation: it must never construct the GM service/repository. An explicit
`startPlayerSpatialTransport` may compose/start it after the same four proofs;
`openPlayerSpatialAtlas()` opens the player window using that client. A request
is `{atlasId,actorId,scope:'world'}`. Share only the public atlas reference with
its intended observer. All denied/missing/stale conditions return the same
generic unavailable response.

## Authoring and projection semantics

First approve place/route/discovery nodes. Save a bounded region manifest
listing up to32 direct children and32 routes. Existing knowledge claims and
published observer receipts provide each map label and public alias. Save an
observer atlas with this shape:

```js
{scope:'world',atlasId:null,regionId,observerId,
 discoveries:[{discoveryId,receiptId,nextAtlasId /* optional known subregion */}],
 routeKnowledge:[{routeId,receiptId}],correctionIds:[],expectedRevision:null,
 sourceEventId:'ep:event:spatial_review_001'}
```

`atlasId:null` creates an independent random public atlas ID. Updating an atlas
requires its exact revision; its observer and selected region cannot change.
The selected region itself needs a current non-retracted discovery/receipt. Other
previously disclosed bindings may carry selected retractions so a revised atlas
can remove those locations/routes. Route knowledge alone
never reveals an undiscovered endpoint. Each alias must be a separate public
claim identity. `correctionIds` are explicit observer-authorized knowledge
corrections, matching the existing knowledge projection contract; publishing a
revised atlas selects newly disclosed corrections. Current discovery retraction
also removes that location and every incident route immediately.

The view pins the region manifest, location revisions and route revisions at
review. Labels come from the exact claim revisions pinned by the receipts.
Consequently adding a hidden neighbor, renaming a canonical place or privately
closing a route does not change an already published observer map. A reviewed
update is required to disclose that new information. Planning returns a route
through the observer's known open links; it does not claim the current canonical
world guarantees passage. Navigation is an explicit next-atlas reference for a
disclosed region belonging to the same observer, never an all-world scan.

Public projection allowlist: atlas `id`, public `regionId`, `locations` containing
only public `id/name/parentId/kind/atlasId?`, and `routes` containing only public
`id/name/fromId/toId/status`. No source IDs, observer IDs, revisions, protected
labels, hidden counts, coordinates, native UUIDs, provenance, or private route
criteria enter the response. Public route planning uses only those same links.

## Verification

Run exact existing focused files (outside sandbox when required by the session):

```sh
node --test --test-isolation=none tests/persistent-spatial.test.mjs tests/spatial-transport.test.mjs tests/narrative-capabilities.test.mjs tests/temporal-identity-spatial.test.mjs
```

This is automated protected-repository/graph/socket evidence, not a real Foundry
world qualification. The coordinating agent owns central integration and the
global browser/full-suite checks.
