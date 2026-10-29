# Easy Plots — Foundry V14 Trust, Transport and Persistent-Storage Design

**Revision:** EP-TRUST-DRAFT-0.2  |  **Status:** Provisional engineering contract, not live verified.

## 1. Architectural security guarantees

- **Never** treat `game.socket` module messages as origin-authenticated or confidential. Official module documentation describes a relay to **all other connected clients**. Payload fields such as `userId`, `actorId`, `targetUserId`, `gmId`, and `approval` are attacker-controlled until independently attested.
- **Never** deliver GM-only data in a message merely addressed to a single player and rely on a client-side recipient check. Transport recipients may see raw network traffic even if their UI declines to render it.
- User-generated input requires a **native, permission-enforced, attributable source operation** or another independently verified Foundry v14 public API with demonstrated authentication and privacy. An assertion in the packet is not evidence.
- An eligible GM client constructs an `AuthorityContext` only from its own authenticated Foundry `game.user` context and a separately verified origin/ownership proof for the request being evaluated.
- All player-visible payloads are constructed from an allowlisted projection schema. Sending a filtered full-domain record is forbidden: never include hidden record IDs, private edge counts, secret condition names, inaccessible target metadata, or private diagnostic hints.
- GM-protected data should be held in genuinely GM-restricted native documents/Compendiums. Flag namespaces and naming conventions are **not** access controls; measure the actual client document and index visibility on target versions.

## 2. Trust-zone matrix

| Boundary | Trust | May contain | Must not contain | Allowed writes |
|---|---|---|---|---|
| GM-authorized world storage | Permission enforced, verification required | Protected graph, truth, operation journal, source events | N/A (within GM authorization) | Eligible GM under documented document permission policy |
| Public/player projection storage | Player-readable | Only published, scoped DTOs and public request receipts | Full graph, secret IDs, conditions, hidden milestone totals, private provenance | Only via authorized publication path |
| Ordinary module socket | Untrusted shared broadcast | Opaque invalidation hints, public non-secret announcements | Protected source data, personal GM results, privileged proof of identity | No state authority |
| Native authenticated request substrate | **Unverified until SPIKE-SEC-001** | Minimal player submissions after permission/identity proof | GM secrets | Native permission-constrained client operations |
| GM client runtime | Trusted for eligible GM decisions, not globally transactional | Authoritative evaluation and private state loaded under GM permissions | No credentials or secrets in public logs | Version-checked native operations |
| Player client runtime | Untrusted executor | Its own projected knowledge and public affordances | GM-only source state | Local UI; authorized native requests only |

**Consequence:** The full player-intent features remain in final delivery scope; they cannot be declared integrated until `SPIKE-SEC-001` validates a trustworthy native submission path. Do not assume a third-party socket helper is a security boundary.

## 3. Request submission protocol (normative logical stages)

1. **Discover:** the GM/projection layer provides an allowed `affordanceId`, opaque opportunity reference, and allowlisted input schema; hidden opportunities do not appear or leak via error differences.
2. **Construct:** player creates a canonical request with a client-local correlation ID, selected Actor and permitted public input. Claimed player identity, target and secret-related fields are untrusted.
3. **Submit:** use an approved Foundry-native authenticated mechanism; prove the real creator or permitted writer **independently of request JSON**. The exact v14 mechanism remains a blocking spike.
4. **Observe:** eligible GM receives minimal notification and reads the native source record under GM authority; never treat a broadcast notification as the request itself or authorization proof.
5. **Attest:** independently verify actual authenticated principal, permitted Actor control/delegation, source record revision, replay/duplicate key, scope and opportunity freshness.
6. **Validate:** re-evaluate the live world, configuration revision, deadline, attempt identity, secrecy constraints and resource budgets.
7. **Queue:** append a durable intent lifecycle record with identity and data provenance; do not execute until the request is authorized by policy or explicit GM review.
8. **Execute:** perform operations using the existing effect coordinator and append journal states before and after native writes, verifying uncertain results.
9. **Respond:** publish a **new sanitized recipient-specific projection** using a proven confidential platform path. If private delivery cannot be verified, expose only approved, non-sensitive outcome through separately permissioned native documents and an opaque public status.
10. **Reconcile:** on GM turnover/reconnect, re-read the persisted request and journal; do not replay an effect because a transport acknowledgement was lost.

### Unauthenticated fallback behavior

If the source request mechanism cannot prove the submitting user, **fail closed**: do not authorize player-triggered privileged operations. GM manual initiation remains possible. This is a test blocker for a *complete* release; it is not permission to omit the planned player functionality.

## 4. Error and oracle policy

The following public error families may be sent only if they do not disclose hidden entity existence: `REQUEST_UNAVAILABLE`, `ACTION_PENDING`, `ACTION_RESOLVED`, `RETRY_LATER`, `INVALID_PUBLIC_INPUT`.

A GM-only detailed diagnostic may include `UNKNOWN_NODE`, `HIDDEN_TARGET`, `PERMISSION_DENIED`, `STALE_CONTRACT`, `REFERENCE_MISSING`, `INDEX_STALE`, `EFFECT_UNCERTAIN`, `BUDGET_EXCEEDED`. The public response to both a nonexistent secret ID and an inaccessible secret ID must be indistinguishable at the payload/schema level. Test enumeration and timing leakage with adversarial clients.

## 5. Storage proposals — verify before choosing

**Preferred native substrate candidate:** user-configurable restricted World Compendium/document partitions under a `NarrativeRepository` facade. Record kinds (`graph`, `event`, `effect-operation`, `fact`, `claim`, `projection`, etc.) are logical and may share physical Foundry document types. **Do not** persist thousands of large records as globally mirrored settings or Actor flags.

**Partition key proposal:** `world/<worldId>/<domain>/<accessClass>/<arcOrRegionShard>` with further size-driven subdivision. Stable IDs are immutable and separate from Foundry document UUIDs. Large event logs are segmented append-only with separately maintained compact indices.

**Secrecy rule:** Secret *names, images, metadata, folder and index fields* must also be inaccessible; pack `getIndex` may expose more than the document body. Test `game.packs` membership, index, search, UUID lookup, Documents, flagged field visibility and compendium metadata as a player.

**Important distinction:** An index of public projections and an index of protected source records are two different security domains. Public indices must be derived from sanitized allowlisted records and must never store hidden counts or protected target IDs.

**Candidate native document types:** JournalEntry/JournalEntryPage and world Compendium containers are implementation candidates, not approved choices. v14 pack/document creation, permissions, locking, index fields, recursive ownership and write behavior must pass test spikes.

## 6. Native lifecycle and mutation rules

- Document revisions are advisory unless verified to support compare-and-swap; `expectedRevision` alone does not make a native update atomic.
- Every operation writes a durable `planned/authorized/prepared` journal record before dispatching an effect, then `applying -> verifying -> completed|failed|uncertain` with evidence.
- Co-GM lease/epoch is an advisory coordination mechanism unless demonstrably fenced by the actual native write substrate. On conflict or heartbeat loss, stop consequential writes and reconcile.
- No self-directed client loops that process unattended schedules while all eligible GMs are offline; due operations remain persisted for bounded catch-up.
- Native per-document permission enforcement must be confirmed; do not rely solely on front-end disabled buttons or form validation.

## 7. Target Foundry validation exercises

**FV-SEC-01 — Raw socket visibility:** GM emits test-only canary through `module.easy-plots` with two players connected; both player network clients log the full payload. The test must confirm this is public transport. No actual secret is transmitted.

**FV-SEC-02 — Claimed-user forgery:** player A sends a syntactically valid packet claiming player B/GM. GM must reject elevated privileges regardless of signature-free claimed fields. Instrument outcome and journal.

**FV-SEC-03 — Permissioned native request:** use a *candidate* player-editable native document. Confirm server-enforced per-user permission, creator identity, tamper resistance of provenance, and GM visibility; attempt cross-user edits/forged ownership. Mark blocker if not provable.

**FV-SEC-04 — Confidential source enumeration:** from a player account inspect `game.packs`, compendium index, document lookup, folder names, flags and search results; no protected identifier or label may appear.

**FV-SEC-05 — Sanitized projection oracle:** player submits nonexistent, secret, stale and forbidden entity references and compares response payloads/timing. Add standardization and rate limits if measurable differences expose protected truth.

**FV-SEC-06 — Recipient-private response:** independently verify intended and unintended clients cannot inspect protected response bytes. If no native channel meets this, use access-controlled native documents only after testing.

**FV-COORD-01 — GM split brain:** two GMs propose the same operation with simulated stale state. Only verified intended effects may be marked complete; unresolved writes must land in `uncertain` and await reconciliation.

**FV-STO-01 — Cold startup:** with 10K+ dormant records (fixture, not promised benchmark), inspect actual loaded protected graph count and memory; no entire-campaign hydration.

**FV-MIG-01 — Interrupted schema migration:** simulate stopping between partition rewrite and index publication; verify staged migration manifest identifies previous valid state and can resume or restore from world backup.

## 8. Sources reviewed

- Official module and socket documentation: https://foundryvtt.com/article/module-development/
- Official Foundry v14 CompendiumCollection API: https://foundryvtt.com/api/v14/classes/foundry.documents.collections.CompendiumCollection.html
- Official Foundry v14 ApplicationV2 API: https://foundryvtt.com/api/v14/classes/foundry.applications.api.ApplicationV2.html
- Official Foundry v14 Users and activeGM: https://foundryvtt.com/api/classes/foundry.documents.collections.Users.html
- Community socket overview (informational; native tests still required): https://github.com/foundry-vtt-community/wiki.js/blob/main/development/api/sockets.md

**Source evidence is documentation review, not an actual Foundry installation test.**
