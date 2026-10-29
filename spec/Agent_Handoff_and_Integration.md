# Easy Plots — Parallel Agent Handoff and Incremental Integration

**Status:** Coordinated full-module build plan, proposed alongside EP-SPEC-V1-DRAFT-0.1.

## Binding delivery interpretation

Implement **all accepted capability domains in one coordinated Easy Plots module project**, using parallel agents or branches as available. Test and integrate after each batch to make faults localizable. The early end-to-end graph is a **debugging/integration checkpoint, not a smaller final deliverable**. The final completion gate covers quests, investigations, knowledge, NPC/factions, temporal/spatial systems, arc continuity, resources, planning/simulation, and both GM/player interfaces.

No separate runtime backend, web service, worker or database is permitted. If a technical obstacle threatens that constraint, record a blocked spike rather than add infrastructure silently.

## Agent kickoff requirements

Each workstream receives:

- Frozen working revision of `Contracts_V1_Proposed.ts` and `Proposed_Core_Schemas_V1.json`.
- The main specification, decision register, traceability, threat model and assumptions.
- An explicit path ownership list and boundaries of permissible changes.
- Mock interfaces for dependencies not yet ready.
- At least one passing-path and one failure/security-path integration fixture.
- A definition of done: complete source files, validation, release notes for changed contracts, tests, and actual Foundry verification where required.

Never treat provisional API proposals as verified native Foundry behavior. Every use of an API not corroborated by the version-pinned docs must be recorded and experimentally checked on the target build.

## Suggested workstreams and integration artifacts

### W0 — Contract and integration owner

Own `src/contracts/`, cross-domain IDs, event schemas, node registry interfaces, provider manifests, test fixtures and compatibility governance. Deliver generated validators and stable V1 revisions. No direct game mechanics. Approves every incompatible schema edit. **Gate:** TypeScript checks, JSON schema validation, identity and migration samples, frozen contract manifest.

### W1 — Foundry persistence and bounded indices

Own `src/storage/`, `src/platform/documents` and `src/platform/packs`. Deliver protected persistence adapters, partition locator, index shard revision/health, event/operation journals and migration runner. **Critical spike:** unauthorized client visibility of world documents and Compendium indices. **Gate:** GM/player permission tests and dormant graph bounded-load benchmark.

### W2 — Security, authorization, runtime and recovery

Own `src/security/`, `src/runtime/`. Deliver contextual Actor permission gateway, GM coordination, canonical event router, requested/approved operations, journal state machine, dedup/retry/uncertain recovery, scheduler and failover. **Critical spike:** authenticating player request provenance using permitted Foundry mechanisms; raw socket-supplied user IDs must never confer privilege. **Gate:** hostile player test, lost-ACK test, co-GM conflict, privileged effect rejection.

### W3 — Graph compiler, preflight and publication

Own `src/graph/`, `src/domains/plots/nodes` and `src/domains/plots/compiler`. Deliver typed editor data API, node/port compiler, nested graph revisions, declarative condition AST, graph validation, preflight findings, publication snapshot and separate activation. **Gate:** render/validate/save/publish real plot; stale draft does not affect active graph; privacy blocker prevents publication.

### W4 — Native Foundry and game-system capabilities

Own `src/platform/hooks`, `src/capabilities/`. Build native event adapters, document effects, roll/Chat/Combat capability providers with declared system compatibility and read/verify semantics. **Gate:** native event and effect work against exact chosen v14/system versions; unsupported provider fails without side effects.

### W5 — Quests, knowledge and investigations

Own `src/domains/knowledge/`, `src/domains/investigation/` and plot milestones/quest projections. Build truth/claim/disclosure, evidence/hypotheses, boards, milestones, cross-plot fan-out, viability, shared knowledge, knowledge-safe affordances. **Gate:** evidence event updates authorized milestone, unsupported theory remains unconfirmed, recipients never see hidden canonical truth.

### W6 — People, factions, relationships, spatial and temporal

Own `src/domains/people/`, `src/domains/factions/`, `src/domains/spatial/`, `src/domains/temporal/`. Build entity/persona lineage, agendas, renown, relationships and debts, clocks, NPC schedules, routes and world-time reconciliation. **Gate:** knowledge is prerequisite to faction response; time jump does not invent events; no history rewriting.

### W7 — Arcs, resources, blueprints, simulation and planning

Own `src/domains/arcs/`, `src/domains/resources/`, `src/domains/simulation/`, `src/domains/planning/`. Build endings/epilogues, dormant continuity hooks, blueprint inheritance and three-way merges, native resource preparation/provenance, GM session planner, health and narrative foresight. **Gate:** conflicting endings stop; historical snapshots retained; simulations do not mutate canonical state; GM edits not discarded.

### W8 — Foundry ApplicationV2 UI

Own `src/ui/`, `static/templates`, `static/styles`. Build GM graph, inspector, approval queue, cockpit, planner, reports and player evidence/quest/knowledge/intent views. Implement views against **sanitized mocked DTOs** so UI development can begin in parallel; never import protected repository records into player components. **Gate:** accessible end-to-end GUI and security projection review.

### W9 — QA, fixtures and packaging

Own `src/tests/`, `src/devtools/`, build and release packaging. Start immediately, not after W1–W8. Supply v14 integration world fixtures, hostile player session, two-GM setup, world backups, fault injector, scale generator, migration rehearsal and per-merge smoke suite. **Gate:** all mandatory tests and every complete-domain acceptance row pass in verified compatibility matrix.

## Example merge and test cadence

```text
Contract approval + high-risk Foundry spikes
     ├─ W1 storage ..............┐
     ├─ W2 security/runtime .... ├─ IC-2: actual native event -> journal -> safe result
     ├─ W3 graph/publishing .... ┤
     ├─ W4 native adapters .....┘
     └─ W8 interface mocks ....................┐
         W5 knowledge/quests/investigations ...├─ domain integration smoke
         W6 faction/NPC/time/location .........┤
         W7 arcs/blueprints/planning ..........┘
                  └─ full cross-domain acceptance + migration + adversarial testing
                              └─ one complete module deliverable
```

Parallel **writing** can begin with mocks after shared interfaces are accepted, but consequential native **integration** must wait for its safety and persistence dependencies.

## Cross-agent change policy

1. Agents own paths; unexpected cross-domain edits must be proposed to the integration owner.
2. PRs changing public contracts must show the previous and new schema versions, migration/adapter, test updates and dependency impact before merge.
3. Each PR includes a single feature-focused test scenario, at least one failure mode, and a reproducible Foundry fixture when it touches Foundry APIs.
4. The security owner vetoes routes that place GM-only data in player-readable documents or unauthenticated/broadcast payloads.
5. Every merge runs TypeScript, schema validation, unit contracts and incremental smoke before the next integration batch is accepted.
6. Every major integration checkpoint runs representative native Foundry tests and logs exact core/system versions.
7. Failed gates are fixed **in their introducing batch** when possible; do not defer broken interfaces until the end.
8. A complete module release is gated on all 125 decisions being mapped to verified implementation evidence, with intentional variations documented and approved.

## Initial blockers that must be resolved before real player workflows

- **SPIKE-SEC-001:** Trustworthy authenticated sender identity and client-private transport/response scope.
- **SPIKE-STO-001:** GM-only source data security in the actual selected native storage and index APIs.
- **SPIKE-COORD-001:** Conflict safety and recovery under two concurrent GM clients.
- **SPIKE-V14-001 / SYS-001:** Verified exact Foundry and game-system capabilities.

Do not silently work around these by moving execution into a separate server or treating sockets as authenticated/private without evidence.
