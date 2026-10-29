# Normative Technical Specification Addendum — Foundry v14.369 Native Transport

**Status:** Source verified for the supplied Foundry v14 Stable **build 369**, pending live adversarial validation. **Effective for Easy Plots v0.4 integration work.** This addendum supersedes any absolute claim in the v0.2 specification and `Foundry_Trust_Boundaries_v0.2.md` that *all* custom module sockets lack an authenticated sender identifier or recipient routing. All other architectural invariants remain binding.

## Source evidence

- `common/packages/base-package.mjs`: `socket` is a package manifest boolean.
- `dist/packages/package.mjs`: `registerCustomSocket` binds package custom events to the server handler.
- `dist/server/sockets.mjs`: the server uses the authenticated session's `this.user.id` as a separately appended callback argument and supports `{recipients:[userId]}` targeting.
- `client/config.mjs`, `client/documents/user.mjs`: namespaced `CONFIG.queries` and `User.query` are additional native user-query facilities, permission dependent.
- `common/abstract/document.mjs`: native ownership predicates are available for rechecking Actor control.

## Updated contracts

1. **Native PlayerIntent transport** may use `module.easy-plots` with manifest `socket:true`; the GM must consume the extra server-supplied callback sender-ID argument and **never** treat packet fields as an attestation.
2. **Native responses** should target the authenticated requester via `{recipients:[verifiedSenderId]}` and must include only allowlisted, recipient-authorized data. Confidentiality must be proven with a GM plus two player clients, network observation and reconnect tests.
3. **GM request handling** must revalidate designated GM authority, current Actor permissions, current opportunity visibility, request shape, revisions and rate limits, and persist a durable pending intent before acknowledging it.
4. **Idempotency scope** is at least `(verified requester ID, request ID)` and must persist across GM disconnect and restart; a client in-memory map is insufficient.
5. **Co-GM write fencing** is a separate unresolved problem; `game.users.activeGM` is a useful selection primitive but not a durable exclusive lease.
6. **Source confidentiality is separate from message routing**. The provided client and server Compendium code is not sufficient proof that a hidden pack, index fields or direct document reads remain confidential. `SPIKE-STO-001` remains a hard blocker.
7. **Fail closed** when the sender/recipient transport cannot be verified in the actual target Foundry build. The initial v0.4 adapter is source-backed and mock-tested, but not auto-activated.

## Impact on original decisions

No architectural decision is reversed. Q64, Q66, Q67, Q81–88, Q90–92, Q108 and Q119 continue to require authenticated authority, recipient-safe projections, durability and recovery. This narrows **how** the approved transport boundary can be implemented for Foundry 14.369. It is an evidence-based correction to an earlier technical assumption, not permission to weaken secrecy.

## Priorities for next batch

- Prove client-side sender-ID and recipient exclusivity in a disposable v14.369 world.
- Validate protected storage and index access using raw direct APIs and two unauthorized players.
- Implement actual durable native `enqueueOnce()` storage only after the backing storage passes confidentiality tests.
- Introduce independently revision-validated multi-GM fencing; do not depend on client memory for exclusive write authority.
