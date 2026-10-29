# Explicit world participant bindings

Compose after the protected NativePack repository and current designated GM
writer exist. No DomainStore change, story query, Actor mutation, effect or
transport starts when this service is constructed.

```js
import {WorldParticipants} from '../orchestration/world-participants.mjs';
const participants=new WorldParticipants({repository,gmProvider,writer,gameInstance});
```

Default trusted callbacks in native integration:

```js
resolveObserver ??= spec=>participants.resolveObserver(spec);
resolveNativeActor ??= spec=>participants.resolveNativeActor(spec);
resolveNotificationUser ??= spec=>participants.resolveRecipientUser(spec);
authorizeNotificationRecipient ??= (userId,recipientId)=>participants.authorizeRecipient(userId,recipientId);
```

If the integration creates these closures before the repository, use a lazy
service variable and construct it before any callback can run. These are GM
server callbacks; never expose the raw service or caller-supplied verified user
IDs to player APIs. resolveObserver rechecks the actual active non-GM user's
OWNER permission on the exact current world Actor after protected awaits.
resolveNativeActor also verifies the supplied GM ID equals the trusted current
GM and returns the real Actor document. Synthetic/unlinked token references are
not world participant bindings.

GM APIs:

- `save({nativeActorId,narrativeActorId,observerId,scope:'world',status:'active',expectedRevision:null})`
  explicitly creates a binding. Narrative Actor ID must use `ep:actor:...`;
  observer ID must be a stable narrative ID. They may be the same ID.
- `read({nativeActorId})` returns ready protected metadata or null. Known
  incomplete indices, prepared bindings and missing/mismatched reverse refs
  fail closed.
- `inspect({nativeActorId})` returns `{binding,references,canRecover}` so the GM
  can inspect an interrupted preparation without treating it as active.
- `recover({nativeActorId,expectedRevision})` explicitly completes the exact
  original prepared metadata. It creates no Actor, story record or effect.
- `save({...loaded identity fields,status:'retired',expectedRevision:loaded.revision})`
  retires the binding. IDs remain reserved; identities cannot be changed and
  retired bindings cannot be reactivated through this API.

`resolveRecipientUser({scope:'world',recipientId})` accepts a bound narrative
Actor ID or observer ID and requires exactly one active non-GM OWNER of its
actual world Actor. Zero or multiple recipients fail explicitly. The selected
owner, active mapping revision and permissions are rechecked after async reads.
`authorizeRecipient(userId,recipientId)` independently resolves this same
binding and returns whether that exact verified user is the recipient.

Primary kind `native-participant-binding` uses an exact native-ID hash in
`native-participants:world:<hash-prefix>`. Unified narrative/observer aliases
use kind `native-participant-ref` in
`native-participant-refs:world:<hash-prefix>`. The single alias namespace prevents
cross-field notification ambiguity. Creation stages the primary and its alias
claims before marking it ready; interruption cannot activate a partial binding.
No distributed lock or multi-document atomicity is claimed. The native
designated writer remains authoritative; metadata writes use exact revisions.

Launch the GM desk with:

```js
import {makeWorldParticipantsDesk} from '../ui/world-participants-desk.mjs';
const Desk=makeWorldParticipantsDesk(ApplicationV2,{service:participants,gameInstance});
new Desk().render(true);
```

The desk selects a local world Actor, accepts explicitly entered stable IDs,
loads its exact revision and exposes explicit prepared-binding completion.
Names are displayed as text and do not create inferred narrative identities.
