# Easy Plots — all125 registered decisions: code and product assessment

Baseline: shipped `2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a` (`v1.13.0-dev`). Working patch is unpublished. Assessment date2026-10-29.

This is a code/entry-path assessment, not a certificate that125 scenarios passed. Existing engineering rationales below describe bounded code and are retained with source/test references; they are not accepted as proof of finished product delivery. Each row separates code present, missing product/feature behavior and acceptance still needed. Original full Q1–112 wording is unavailable; the condensed register and proposed acceptance observations are the reconstructable baseline.

## ADR-001 — Hybrid narrative/execution graphs

**Scope:** Execute a graph mixing narrative records and effect nodes; expected: Only eligible authored branches request authorized effects; narrative nodes remain distinguishable

**Code present:** Published domain nodes request effects; runtime and domain tests distinguish evaluation from approved mutation. Complete layered presentation is reviewed separately in ADR-022.

**Assessment:** bounded implementation present; not complete-product certified; product: **temporary-preview-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration

**Shipped access:** GM console API openEditor; temporary sandbox on default startup

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25)

**Local evidence references:** `tests/domain-graph-integration.test.mjs` — typed faction node authors

**Still needed:** Execute a graph mixing narrative records and effect nodes in the installed module, through reachable GM/player UI and persistent world storage, observing Only eligible authored branches request authorized effects; narrative nodes remain distinguishable

## ADR-002 — GM-reviewed narrative vs automatic logic

**Scope:** Evaluate a branch requiring GM approval alongside an automatic condition; expected: Approval-gated consequences do not execute before GM authorization

**Code present:** Automatic conditions propose consequences; durable explicit GM approval remains necessary before provider execution.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/proposal-review.test.mjs` — effect cannot execute without durable

**Still needed:** Evaluate a branch requiring GM approval alongside an automatic condition in the installed module, through reachable GM/player UI and persistent world storage, observing Approval-gated consequences do not execute before GM authorization

## ADR-003 — Facts with optional Foundry bindings

**Scope:** Create narrative fact with and without a native Foundry binding; expected: Both retain stable identity and validity; missing native binding is diagnosable

**Code present:** Narrative facts are established through approved graph effects with no native document, survive optional Actor binding and native target deletion, and remain unchanged by binding. Borrowed Actor content is preserved. The integrated scenario uses the actual GM gateway, graph publication and independent effect approvals.

**Assessment:** bounded implementation present; not complete-product certified; product: **api-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/identity.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/identity.mjs#L4), [src/domains/relationships.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/relationships.mjs#L4), [src/orchestration/resource-reconciliation.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/resource-reconciliation.mjs#L9), [src/platform/foundry-actor-item-provider.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actor-item-provider.mjs#L21), [src/platform/foundry-resource-binding.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-resource-binding.mjs#L18), [src/runtime/extended-providers.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/extended-providers.mjs#L21)

**Local evidence references:** `tests/domain-workflow-scenarios.test.mjs` — ADR-003:

**Still needed:** Create narrative fact with and without a native Foundry binding in the installed module, through reachable GM/player UI and persistent world storage, observing Both retain stable identity and validity; missing native binding is diagnosable

## ADR-004 — Typed flow/condition/event/data edges

**Scope:** Connect flow, condition, event and data ports incorrectly; expected: Valid typed edges work; incompatible connections fail preflight

**Code present:** Typed data and event-flow connections are validated; incompatible ports and missing producers are rejected in local integration tests.

**Assessment:** bounded implementation present; not complete-product certified; product: **temporary-preview-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration

**Shipped access:** GM console API openEditor; temporary sandbox on default startup

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25)

**Local evidence references:** `tests/typed-data-flow.test.mjs` — ADR-004: typed state data

**Still needed:** Connect flow, condition, event and data ports incorrectly in the installed module, through reachable GM/player UI and persistent world storage, observing Valid typed edges work; incompatible connections fail preflight

## ADR-005 — Nested subgraphs and typed ports

**Scope:** Call a versioned child subgraph through typed interface ports; expected: Port contracts validate and child changes do not corrupt parent snapshot

**Code present:** Pure and mixed calls remain pinned to immutable child interfaces. Mixed flow proposes child and parent effects separately; typed values alone cannot execute effects. Review reconstructs parameters and rejects changed input revisions.

**Assessment:** bounded implementation present; not complete-product certified; product: **temporary-preview-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration

**Shipped access:** GM console API openEditor; temporary sandbox on default startup

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/runtime/graph-data-frame.mjs:6](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/graph-data-frame.mjs#L6), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/typed-subgraphs.test.mjs` — ADR-005: parent remains pinned; `tests/mixed-subgraph.test.mjs` — mixed

**Still needed:** Call a versioned child subgraph through typed interface ports in the installed module, through reachable GM/player UI and persistent world storage, observing Port contracts validate and child changes do not corrupt parent snapshot

## ADR-006 — Configurable branching exclusivity

**Scope:** Resolve exclusive and parallel branches from the same input; expected: Exclusivity and concurrent paths follow published policy without duplicate effects

**Code present:** Boolean selection is exclusive; parallel and all/any join tests cover bounded convergent paths without repeated effects.

**Assessment:** bounded implementation present; not complete-product certified; product: **temporary-preview-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration

**Shipped access:** GM console API openEditor; temporary sandbox on default startup

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25)

**Local evidence references:** `tests/data-guards.test.mjs` — ADR-006: an authoritative typed boolean

**Still needed:** Resolve exclusive and parallel branches from the same input in the installed module, through reachable GM/player UI and persistent world storage, observing Exclusivity and concurrent paths follow published policy without duplicate effects

## ADR-007 — Persistent state, event history and controlled rollback

**Scope:** Restart after state event and request controlled rollback; expected: Event history persists and corrective event preserves original provenance

**Code present:** A canonical narrative correction now follows published graph, persisted proposal, explicit approval and a verified operation journal. Earlier source events/revisions remain intact and native document/resource undo is excluded.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/runtime/domain-correction-provider.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/domain-correction-provider.mjs#L7), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/domain-correction.test.mjs` — ADR-007: a reviewed

**Still needed:** Restart after state event and request controlled rollback in the installed module, through reachable GM/player UI and persistent world storage, observing Event history persists and corrective event preserves original provenance

## ADR-008 — Knowledge-aware disclosure

**Scope:** Observe same fact as informed and uninformed recipients; expected: Only authorized audience receives disclosed fact and metadata

**Code present:** Observer-specific receipts and allowlisted projections withhold undisclosed claims and metadata; native privacy is reserved for final world tests.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/platform/foundry-actors.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actors.mjs#L7), [src/platform/foundry-board-transport.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-board-transport.mjs#L16), [src/platform/foundry-socket.mjs:26](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-socket.mjs#L26)

**Local evidence references:** `tests/persistent-knowledge.test.mjs` — explicit observer receipt publishes

**Still needed:** Observe same fact as informed and uninformed recipients in the installed module, through reachable GM/player UI and persistent world storage, observing Only authorized audience receives disclosed fact and metadata

## ADR-009 — Reactive GM workspace

**Scope:** Update qualifying event while GM workspace open; expected: Affected widgets update without hydrating unrelated graph partitions

**Code present:** The focused cockpit now subscribes to exact-graph post-commit changes and refreshes relevant event rows. Callbacks contain no event values and view failures cannot roll back accepted events.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** No installed GM launcher or automatically connected workspace. Focused cockpit needs selected graph/event IDs; the proposed campaign dashboard is not implemented.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** GM console API; no installed navigation/settings launcher in shipped build

**Unpublished work:** A launcher and replacement Home are drafted. Neither is in the installed tag.

**Source:** [src/bootstrap/index.mjs:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/bootstrap/index.mjs#L1), [src/editor/model.mjs:53](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/editor/model.mjs#L53), [src/runtime/scoped-gm-changes.mjs:6](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/scoped-gm-changes.mjs#L6), [src/ui/gm-cockpit.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/gm-cockpit.mjs#L3), [src/ui/graph-editor.mjs:30](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/graph-editor.mjs#L30)

**Local evidence references:** `tests/scoped-gm-changes.test.mjs` — ADR-009: focused

**Still needed:** Update qualifying event while GM workspace open in the installed module, through reachable GM/player UI and persistent world storage, observing Affected widgets update without hydrating unrelated graph partitions

## ADR-010 — References and lightweight narrative entities

**Scope:** Reference a native Actor and a lightweight fictional entity; expected: Both resolve through stable narrative IDs without mandatory Actor duplication

**Code present:** Canonical lightweight identities resolve independently of optional native Actor/Item/Journal resource bindings. Approved graph operations persist records without creating an Actor; borrowed native content is untouched and a deleted Actor cannot erase the entity. Native Compendium reconstruction and explicit missing-reference status are covered. Real Foundry qualification remains deferred.

**Assessment:** bounded implementation present; not complete-product certified; product: **api-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-identities.mjs:8](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-identities.mjs#L8), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/platform/foundry-resource-binding.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-resource-binding.mjs#L18), [src/runtime/canonical-domain-effects.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/canonical-domain-effects.mjs#L11), [src/runtime/extended-providers.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/extended-providers.mjs#L21), [src/runtime/narrative-capabilities.mjs:62](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/narrative-capabilities.mjs#L62)

**Local evidence references:** `tests/domain-workflow-scenarios.test.mjs` — lightweight and optionally Actor-bound entities

**Still needed:** Reference a native Actor and a lightweight fictional entity in the installed module, through reachable GM/player UI and persistent world storage, observing Both resolve through stable narrative IDs without mandatory Actor duplication

## ADR-011 — Factions, renown and membership

**Scope:** Join/leave faction and modify renown independently; expected: Membership and reputation remain distinct historical states

**Code present:** Persistent join, independent renown changes and leave are exercised through approved graph effects; leaving preserves renown, original causal operation history and service-recreated membership state. A native Actor is not required for membership records.

**Assessment:** bounded implementation present; not complete-product certified; product: **api-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/npc-schedule-planner.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/npc-schedule-planner.mjs#L11), [src/orchestration/persistent-faction-agenda.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-faction-agenda.mjs#L18), [src/runtime/domain-providers.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/domain-providers.mjs#L14)

**Local evidence references:** `tests/domain-workflow-scenarios.test.mjs` — ADR-011:

**Still needed:** Join/leave faction and modify renown independently in the installed module, through reachable GM/player UI and persistent world storage, observing Membership and reputation remain distinct historical states

## ADR-012 — GM-controlled faction agendas

**Scope:** Trigger faction agenda without player-visible prerequisites; expected: Agenda is GM-reviewed and private knowledge remains protected

**Code present:** A formerly disconnected fact write now reaches the agenda's canonical source. The regression separately requires the faction's own knowledge receipt.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/npc-schedule-planner.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/npc-schedule-planner.mjs#L11), [src/orchestration/persistent-faction-agenda.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-faction-agenda.mjs#L18), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/runtime/domain-providers.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/domain-providers.mjs#L14)

**Local evidence references:** `tests/canonical-domain-integration.test.mjs` — ADR-012: approved fact graph

**Still needed:** Trigger faction agenda without player-visible prerequisites in the installed module, through reachable GM/player UI and persistent world storage, observing Agenda is GM-reviewed and private knowledge remains protected

## ADR-013 — Renown, rank and privileges separated

**Scope:** Increase renown without changing membership rank; expected: No rank or privilege changes unless independent conditions authorize them

**Code present:** Numeric reputation cannot promote rank or grant privileges. Rank and privilege proposals receive independent approvals: an unapproved/rejected promotion cannot execute while an explicitly approved privilege can; a later explicit promotion preserves the privilege revision.

**Assessment:** bounded implementation present; not complete-product certified; product: **api-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/npc-schedule-planner.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/npc-schedule-planner.mjs#L11), [src/orchestration/persistent-faction-agenda.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-faction-agenda.mjs#L18), [src/runtime/domain-providers.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/domain-providers.mjs#L14)

**Local evidence references:** `tests/domain-workflow-scenarios.test.mjs` — ADR-013:

**Still needed:** Increase renown without changing membership rank in the installed module, through reachable GM/player UI and persistent world storage, observing No rank or privilege changes unless independent conditions authorize them

## ADR-014 — Conditional reactions with bounded cascades

**Scope:** Trigger mutually reactive faction rules; expected: Cycle budget halts unintended repeated reactions and records diagnostic

**Code present:** Protected causal-root budgets now bound mutually reactive rules before another proposal. Original roots remain charged across merges and restarts; interrupted reservations remain uncertain and cannot replay evaluation. Canonical declared parents carry lineage; unrelated roots intentionally start separate budgets. No arbitrary convergence or automatic world mutation is claimed.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/runtime/approved-operation-gateway.mjs:8](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/approved-operation-gateway.mjs#L8), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/runtime/event-cascades.mjs:8](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/event-cascades.mjs#L8), [src/runtime/reviewed-plan-gateway.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/reviewed-plan-gateway.mjs#L9)

**Local evidence references:** `tests/event-cascades.test.mjs` — mutually reactive published faction rules stop; `tests/event-cascades.test.mjs` — merged causal roots retain every original budget; `tests/event-cascades.test.mjs` — lost reservation acknowledgements

**Still needed:** Trigger mutually reactive faction rules in the installed module, through reachable GM/player UI and persistent world storage, observing Cycle budget halts unintended repeated reactions and records diagnostic

## ADR-015 — Truth, beliefs, rumors and false knowledge

**Scope:** Propagate a true fact and a false rumor to different observers; expected: Canonical truth is separate from observer beliefs and rumor claims

**Code present:** Canonical facts, claims, observer receipts and rumor propagation are separate; propagation plans do not commit truth or disclosure automatically.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14)

**Local evidence references:** `tests/knowledge-propagation.test.mjs` — propagation distinguishes direct

**Still needed:** Propagate a true fact and a false rumor to different observers in the installed module, through reachable GM/player UI and persistent world storage, observing Canonical truth is separate from observer beliefs and rumor claims

## ADR-016 — World-time timelines and time jumps

**Scope:** Advance campaign time past a scheduled deadline; expected: Due states are indexed and reconciled without day-by-day simulation

**Code present:** Canonical schedules use bounded due-index windows; a due commitment remains a GM review candidate rather than an invented outcome.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/scheduler.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/scheduler.mjs#L5), [src/orchestration/temporal-coordinator.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/temporal-coordinator.mjs#L10), [src/storage/native-temporal-index.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-temporal-index.mjs#L15)

**Local evidence references:** `tests/temporal-coordinator.test.mjs` — authoritative due scheduling supports

**Still needed:** Advance campaign time past a scheduled deadline in the installed module, through reachable GM/player UI and persistent world storage, observing Due states are indexed and reconciled without day-by-day simulation

## ADR-017 — Extension APIs

**Scope:** Register a third-party provider through declared public API; expected: Provider can validate and execute only permitted contract capabilities

**Code present:** The public GM API registers declarative versioned third-party actions wrapping an allowlisted core narrative capability. Fixed scope/constants and typed scalar inputs are visible in the proposal; the exact canonical manifest SHA-256 and target version are pinned in its payload. No action callback receives document or arbitrary effect APIs. Existing independent GM approval, target verification and effect journal remain authoritative; scope override, native mutation target and changed contract fail closed. Re-registration after native reconstruction is explicit. This does not sandbox installed GM JavaScript; real Foundry qualification remains deferred.

**Assessment:** bounded implementation present; not complete-product certified; product: **api-only**.

**Missing / limits:** Public extension/action APIs exist; installing a third-party declaration still requires developer registration and exact re-registration after coordinator initialization. No user-facing extension management workflow.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Trusted developer registration API

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/bootstrap/index.mjs:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/bootstrap/index.mjs#L1), [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113), [src/runtime/narrative-action-api.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/narrative-action-api.mjs#L15), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18), [src/runtime/provider-registry.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/provider-registry.mjs#L5)

**Local evidence references:** `tests/narrative-action-api.test.mjs` — a declared third-party action validates and executes; `tests/native-reactive.test.mjs` — third-party action re-registers its exact contract

**Still needed:** Register a third-party provider through declared public API in the installed module, through reachable GM/player UI and persistent world storage, observing Provider can validate and execute only permitted contract capabilities

## ADR-018 — Co-GM permission model

**Scope:** Two GMs with different delegation rights edit protected plots; expected: Unauthorized GM action rejected; authorized edits revision checked

**Code present:** Per-plot owner and separately delegated edit/publish/activate rights are enforced by the designated physical writer using an authenticated native sender context. Revision checks, read-only editor, explicit legacy adoption/owner transfer/recovery and private command receipts survive reconstruction; uncertain commands cannot replay. Chromium exercises both GM principals and separate publication/activation. Real multi-client Foundry qualification remains deferred.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Delegated authoring requires manually configured coordinator sockets and attestation; many other desks need a local integration and do not become usable merely by connecting the delegated editor.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Participant binding helpers are new unpublished code; coordinator onboarding is still not integrated.

**Source:** [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/orchestration/gm-plot-authoring.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/gm-plot-authoring.mjs#L11), [src/platform/gm-authoring-transport.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/gm-authoring-transport.mjs#L10), [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113), [src/security/plot-authority.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/security/plot-authority.mjs#L10), [src/ui/graph-editor.mjs:30](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/graph-editor.mjs#L30), [src/ui/plot-authority-desk.mjs:2](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/plot-authority-desk.mjs#L2)

**Local evidence references:** `tests/gm-plot-authoring.test.mjs` — native targeted co-GM editing; `tests/native-reactive.test.mjs` — native Compendium retains co-GM plot ownership; `tests/plot-authority.test.mjs` — two GMs own different plots

**Still needed:** Two GMs with different delegation rights edit protected plots in the installed module, through reachable GM/player UI and persistent world storage, observing Unauthorized GM action rejected; authorized edits revision checked

## ADR-019 — World persistence and portable templates

**Scope:** Save world record and export/reuse narrative template; expected: World state persists and portable template excludes unwanted native identities

**Code present:** Portable full-graph export removes source graph/node/edge identities, native UUIDs and scoped state references into explicit typed local bindings. Immutable template pages and the existing blueprint catalog persist in protected storage. Embedded references without an adapter fail closed rather than silently leaking. Instantiation creates a linked draft only; Foundry persistence/performance acceptance remains deferred.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** No first-run storage selection/creation or restoration. Save uses memory by default. Template services do not make an installed world persistent automatically.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Repository/GM APIs after manual native configuration; not automatic first-use persistence

**Unpublished work:** New world-setup and encrypted-pack drafts exist, but bootstrap does not compose them. They are not accepted persistence.

**Source:** [src/graph/portable-template.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/portable-template.mjs#L21), [src/orchestration/graph-templates.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/graph-templates.mjs#L9), [src/ui/template-desk.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/template-desk.mjs#L5)

**Local evidence references:** `tests/graph-templates.test.mjs` — ADR-019: portable export

**Still needed:** Save world record and export/reuse narrative template in the installed module, through reachable GM/player UI and persistent world storage, observing World state persists and portable template excludes unwanted native identities

## ADR-020 — Contextual native document creation

**Scope:** Prepare native resource in context of a plot; expected: Document is created only after GM approval and provenance is recorded

**Code present:** Native shell creation follows graph publication, persisted proposal, GM approval and operation journal; separate tests reject provenance collisions.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/orchestration/resource-reconciliation.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/resource-reconciliation.mjs#L9), [src/platform/foundry-actor-item-provider.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actor-item-provider.mjs#L21), [src/platform/foundry-resource-binding.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-resource-binding.mjs#L18), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/journal-graph-integration.test.mjs` — native Journal shell node follows

**Still needed:** Prepare native resource in context of a plot in the installed module, through reachable GM/player UI and persistent world storage, observing Document is created only after GM approval and provenance is recorded

## ADR-021 — Resizable ApplicationV2 graph workspace

**Scope:** Resize/popout graph ApplicationV2 workspace; expected: Editor preserves interaction, focus and graph state after window changes

**Code present:** Reviewed the implemented resizable ApplicationV2 editor and persisted graph positions. The remaining popout, focus, resize and actual native window lifecycle behavior is explicitly reserved for final Foundry qualification, not treated as an absent editor feature.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **temporary-preview-only**.

**Missing / limits:** Native installed window usability failed: Status lacks a bounded scroll region. No visible launcher. Popout/resize/focus lifecycle is not accepted in real Foundry.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration

**Shipped access:** GM console API; no installed navigation/settings launcher in shipped build

**Unpublished work:** Launcher4 Node cases and Home4 Node cases plus focused DOM checks were run; new Home scrolling is unpublished. Native user retest remains open.

**Source:** [src/bootstrap/index.mjs:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/bootstrap/index.mjs#L1), [src/editor/model.mjs:53](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/editor/model.mjs#L53), [src/ui/gm-cockpit.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/gm-cockpit.mjs#L3), [src/ui/graph-editor.mjs:30](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/graph-editor.mjs#L30)

**Local evidence references:** `tests/persistent-graphs.test.mjs` — moving a node is captured

**Still needed:** Resize/popout graph ApplicationV2 workspace in the installed module, through reachable GM/player UI and persistent world storage, observing Editor preserves interaction, focus and graph state after window changes

## ADR-022 — Layered narrative graph

**Scope:** Switch narrative/execution/knowledge graph layers; expected: Layer navigation shows only authorized elements and preserves connections

**Code present:** Layer selection is now implemented as a view-only projection: canonical nodes, connections and draft revisions stay unchanged; cross-layer links are counted.

**Assessment:** bounded implementation present; not complete-product certified; product: **temporary-preview-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration

**Shipped access:** GM console API openEditor; temporary sandbox on default startup

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/bootstrap/index.mjs:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/bootstrap/index.mjs#L1), [src/editor/model.mjs:53](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/editor/model.mjs#L53), [src/ui/gm-cockpit.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/gm-cockpit.mjs#L3), [src/ui/graph-editor.mjs:30](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/graph-editor.mjs#L30)

**Local evidence references:** `tests/graph-view-state.test.mjs` — ADR-022: switching

**Still needed:** Switch narrative/execution/knowledge graph layers in the installed module, through reachable GM/player UI and persistent world storage, observing Layer navigation shows only authorized elements and preserves connections

## ADR-023 — Variable-density node presentation

**Scope:** Expand and collapse a node density presentation; expected: Visual change never mutates canonical node execution semantics

**Code present:** Compact/comfortable/expanded density and individual expansion are now view-only preferences. Local tests preserve canonical data and saved revisions.

**Assessment:** bounded implementation present; not complete-product certified; product: **temporary-preview-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration

**Shipped access:** GM console API; no installed navigation/settings launcher in shipped build

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/bootstrap/index.mjs:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/bootstrap/index.mjs#L1), [src/editor/model.mjs:53](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/editor/model.mjs#L53), [src/ui/gm-cockpit.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/gm-cockpit.mjs#L3), [src/ui/graph-editor.mjs:30](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/graph-editor.mjs#L30)

**Local evidence references:** `tests/graph-view-state.test.mjs` — ADR-023: compact

**Still needed:** Expand and collapse a node density presentation in the installed module, through reachable GM/player UI and persistent world storage, observing Visual change never mutates canonical node execution semantics

## ADR-024 — Validated rule builder and optional expressions

**Scope:** Submit invalid expression and a valid typed AST; expected: Unsafe expression rejected; valid rule evaluates predictably

**Code present:** Structured predicates reject unsafe paths, unsupported providers and excessive recursion; comparisons are typed and do not evaluate arbitrary script text.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **temporary-preview-only**.

**Missing / limits:** The graph editor exposes structured condition JSON, not a completed user-facing validated rule builder. Safe expression evaluation/AST validation is not that authoring workflow.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** No rule-builder replacement in frozen working snapshot.

**Source:** [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25)

**Local evidence references:** `tests/contracts.test.mjs` — conditions block prototype traversal

**Still needed:** Submit invalid expression and a valid typed AST in the installed module, through reachable GM/player UI and persistent world storage, observing Unsafe expression rejected; valid rule evaluates predictably

## ADR-025 — Isolated what-if simulation

**Scope:** Run hypothetical branch containing native effect node; expected: Canonical world and native documents remain unchanged

**Code present:** The actual pinned published graph evaluator runs with isolated hypotheses, journal and fault providers. Native Actor payloads remain planned; no canonical intake, native provider calls or world writes occur. Native adapter compatibility still needs final Foundry validation.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/ui/planning-lab.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/planning-lab.mjs#L45)

**Local evidence references:** `tests/published-graph-simulation.test.mjs` — ADR-025: an actual published graph

**Still needed:** Run hypothetical branch containing native effect node in the installed module, through reachable GM/player UI and persistent world storage, observing Canonical world and native documents remain unchanged

## ADR-026 — Cosmetic live edits vs published structural edits

**Scope:** Edit visual labels and then structural node ports on live graph; expected: Cosmetic edits follow policy; structural change requires published snapshot

**Code present:** GM live appearance stores a title and at most64 selected node labels/positions per exact active published version. It never changes the executable snapshot or draft, and rejects ports/data fields, unknown nodes, stale revisions and changed activation. Plot edit grants are rechecked through the designated writer; active view/cockpit and Chromium use the separate projection. Reset preserves history; structural edits still need publication. Native Compendium reconstruction passes locally; final real-world qualification remains deferred.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/gm-plot-authoring.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/gm-plot-authoring.mjs#L11), [src/orchestration/live-graph-appearance.mjs:8](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/live-graph-appearance.mjs#L8), [src/runtime/gm-cockpit.mjs:6](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/gm-cockpit.mjs#L6), [src/ui/graph-editor.mjs:30](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/graph-editor.mjs#L30), [src/ui/live-appearance-desk.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/live-appearance-desk.mjs#L3)

**Local evidence references:** `tests/live-graph-appearance.test.mjs` — live cosmetic labels and positions persist separately; `tests/native-reactive.test.mjs` — live appearance separately

**Still needed:** Edit visual labels and then structural node ports on live graph in the installed module, through reachable GM/player UI and persistent world storage, observing Cosmetic edits follow policy; structural change requires published snapshot

## ADR-027 — GM-authoritative durable operations

**Scope:** Disconnect eligible GM during native effect sequence; expected: Durable journal records state and later review avoids blind replay

**Code present:** Lost acknowledgments leave durable uncertain review/journal state and prevent blind retries; the native writer is fenced on handover.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/proposal-review.test.mjs` — effect apply acknowledgment uncertainty

**Still needed:** Disconnect eligible GM during native effect sequence in the installed module, through reachable GM/player UI and persistent world storage, observing Durable journal records state and later review avoids blind replay

## ADR-028 — Optimistic revision concurrency

**Scope:** Two GMs write same narrative record from stale revisions; expected: Conflict detected and no silent last-writer authoritative overwrite

**Code present:** Expected revisions and read-back verification reject stale writers. Actual concurrent native-document races remain a final-world test, not a transaction guarantee.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18), [src/storage/graph-chunks.mjs:19](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/graph-chunks.mjs#L19), [src/storage/native-pack.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-pack.mjs#L15)

**Local evidence references:** `tests/native-persistence.test.mjs` — Native pack record survives

**Still needed:** Two GMs write same narrative record from stale revisions in the installed module, through reachable GM/player UI and persistent world storage, observing Conflict detected and no silent last-writer authoritative overwrite

## ADR-029 — Grouped permission-aware notifications

**Scope:** Deliver grouped notices with different observer permissions; expected: Each recipient sees only authorized grouped facts and references

**Code present:** Notifications now have recipient-specific durable random public groups and explicitly reviewed public titles. A GM index page groups private records by recipient/category; each player inbox groups only locally received allowlisted notices, with bounded counts, urgency, deduplication and local dismissal. A published node queues a private draft only after effect approval; publication and targeted delivery remain separate. v1 ungrouped packets remain compatible; v2 carries only public grouping fields. Native target-build qualification remains deferred.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Player inbox/grouping code exists, but native delivery needs manually supplied recipient authorization callbacks and separately started sockets; no configured player discovery/entry flow.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** GM console API; no installed navigation/settings launcher in shipped build

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/contracts/notification-view.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/contracts/notification-view.mjs#L4), [src/orchestration/persistent-notifications.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-notifications.mjs#L11), [src/platform/foundry-notification-transport.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-notification-transport.mjs#L15), [src/runtime/notification-queue-provider.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/notification-queue-provider.mjs#L5), [src/ui/notification-desk.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/notification-desk.mjs#L5), [src/ui/player-notification-inbox.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/player-notification-inbox.mjs#L5)

**Local evidence references:** `tests/grouped-notifications.test.mjs` — ADR-029:; `tests/grouped-notifications.test.mjs` — published notification node

**Still needed:** Deliver grouped notices with different observer permissions in the installed module, through reachable GM/player UI and persistent world storage, observing Each recipient sees only authorized grouped facts and references

## ADR-030 — GM-reviewed player contributions

**Scope:** Player contributes to scene narrative requiring GM review; expected: Contribution cannot change canonical facts before explicit authorization

**Code present:** Authenticated player contributions enter a durable GM queue; Actor and opportunity conditions are rechecked before reviewed transitions.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Generic player contributions stop at queue review: shipped approval UI changes pending to approved/rejected, with no product path advancing approved requests through processing to resolved effects. Board-edit proposals have a separate handler and do not close the generic request gap.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Technical player/GM APIs and selected request forms; transport/setup required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/platform/foundry-actors.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actors.mjs#L7), [src/platform/foundry-board-transport.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-board-transport.mjs#L16), [src/platform/foundry-socket.mjs:26](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-socket.mjs#L26), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/native-persistence.test.mjs` — Intent queue durable request

**Still needed:** Player contributes to scene narrative requiring GM review in the installed module, through reachable GM/player UI and persistent world storage, observing Contribution cannot change canonical facts before explicit authorization

## ADR-031 — Quests as narrative projections

**Scope:** Complete plot milestone and open player quest view; expected: Quest displays authorized projection rather than independent conflicting state

**Code present:** Graph objective effects now update the exact source read by quest publication; canonical changes suppress stale approved projections.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Quest publication is a selected-record GM workflow; players need exact publication IDs and native Actor IDs. No ordinary discoverable quest list or normal installed sharing flow.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-investigation-milestones.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-investigation-milestones.mjs#L12), [src/orchestration/persistent-quest-projections.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-quest-projections.mjs#L12), [src/runtime/canonical-domain-effects.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/canonical-domain-effects.mjs#L11)

**Local evidence references:** `tests/canonical-domain-integration.test.mjs` — ADR-031: approved objective graph

**Still needed:** Complete plot milestone and open player quest view in the installed module, through reachable GM/player UI and persistent world storage, observing Quest displays authorized projection rather than independent conflicting state

## ADR-032 — Temporal directional relationship graph

**Scope:** Update directional relationship then inspect historical time; expected: Current and historical directions remain distinct and correct

**Code present:** Approved graph relationship transitions now use the canonical directional store and immutable history. Identity retargeting is rejected; prior relation/source events remain readable.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Directional canonical relationship logic exists; no integrated people/relationship authoring and browsing workspace demonstrated for normal users.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/domains/identity.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/identity.mjs#L4), [src/domains/relationships.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/relationships.mjs#L4), [src/runtime/canonical-domain-effects.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/canonical-domain-effects.mjs#L11), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/extended-providers.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/extended-providers.mjs#L21), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/canonical-domain-integration.test.mjs` — ADR-032: approved relationship

**Still needed:** Update directional relationship then inspect historical time in the installed module, through reachable GM/player UI and persistent world storage, observing Current and historical directions remain distinct and correct

## ADR-033 — Spatial hierarchy, routes and discovery

**Scope:** Discover route and location hierarchy from selected region; expected: Authorized spatial links appear; secret neighboring locations remain hidden

**Code present:** Persistent selected-region hierarchies, approved place/discovery/route/region effects, pinned observer maps and known-route resolution are composed with authenticated targeted transport. Restart and hidden-change regressions preserve observer knowledge; role/ownership/source changes after awaits fail closed. Bounded selected-region navigation is intentional; there is no global world scan or arbitrary typed candidate data port.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Selected-region and known-route services exist, but no installed entry or participant mapping setup. The known-map forms use explicit IDs; a discoverable player atlas journey is not established.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/spatial-contract.mjs:6](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/spatial-contract.mjs#L6), [src/orchestration/persistent-spatial.mjs:13](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-spatial.mjs#L13), [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113), [src/runtime/spatial-region-provider.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/spatial-region-provider.mjs#L7)

**Local evidence references:** `tests/persistent-spatial.test.mjs` — persisted selected-region hierarchy; `tests/spatial-native.test.mjs` — approved region graph; `tests/spatial-transport.test.mjs` — Actor ownership and observer binding

**Still needed:** Discover route and location hierarchy from selected region in the installed module, through reachable GM/player UI and persistent world storage, observing Authorized spatial links appear; secret neighboring locations remain hidden

## ADR-034 — NPC schedules

**Scope:** Schedule an NPC move then stop time before event; expected: Due schedule remains pending, not falsely marked completed

**Code present:** Approved NPC graph records feed canonical agenda/schedule sources. Reviewed preparation records exact knowledge/source revisions, stages a native due index and survives service reconstruction. Due creates a new approval-only intent and never establishes an off-screen outcome.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** NPC schedules require explicitly authored canonical records, selected knowledge and manual native initialization; no complete NPC schedule management journey from installation.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-npc-actions.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-npc-actions.mjs#L14), [src/runtime/narrative-capabilities.mjs:62](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/narrative-capabilities.mjs#L62), [src/runtime/npc-action-provider.mjs:6](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/npc-action-provider.mjs#L6)

**Local evidence references:** `tests/persistent-npc-actions.test.mjs` — ADR-034 and ADR-048: approved NPC schedule

**Still needed:** Schedule an NPC move then stop time before event in the installed module, through reachable GM/player UI and persistent world storage, observing Due schedule remains pending, not falsely marked completed

## ADR-035 — NPC agendas

**Scope:** Evaluate NPC personal agenda conditioned on private fact; expected: Agenda does not trigger from information the NPC has not learned

**Code present:** NPC agenda assessment resolves only selected durable receipts for that NPC, their canonical claims, disclosure availability and selected corrections. Canonical truth alone never supplies NPC knowledge. Prepared source revisions are rechecked at due admission; coverage remains explicitly scoped to supplied receipts/corrections.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Agenda assessment requires selected authored sources/receipts. A normal NPC agenda creation/inspection workflow is not established by the service tests.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/orchestration/persistent-npc-actions.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-npc-actions.mjs#L14)

**Local evidence references:** `tests/persistent-npc-actions.test.mjs` — ADR-035: canonical NPC graph records

**Still needed:** Evaluate NPC personal agenda conditioned on private fact in the installed module, through reachable GM/player UI and persistent world storage, observing Agenda does not trigger from information the NPC has not learned

## ADR-036 — Directional Actor relationships, favors and debts

**Scope:** Record favor owed by Actor A to Actor B; expected: Debt persists directionally and is not inferred reciprocal

**Code present:** Protected obligation operations preserve debtor/creditor direction and causal identity, reject repeats and never infer reciprocal obligations.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Obligation/debt effect records exist; a coherent relationship/debt management screen with ordinary entity selection is not established.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/identity.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/identity.mjs#L4), [src/domains/relationships.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/relationships.mjs#L4), [src/runtime/extended-providers.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/extended-providers.mjs#L21)

**Local evidence references:** `tests/domain-providers.test.mjs` — obligation is settled exactly once

**Still needed:** Record favor owed by Actor A to Actor B in the installed module, through reachable GM/player UI and persistent world storage, observing Debt persists directionally and is not inferred reciprocal

## ADR-037 — Fiction/execution/knowledge chronology

**Scope:** Compare fiction, execution and observer-knowledge chronologies; expected: Distinct timestamps and causality sort consistently

**Code present:** Separate indexed fiction, recorded acceptance and observer-knowledge axes sort with causal ties and revision-bound pages. Knowledge uses the later of recorded disclosure and authored availability. Legacy missing dates remain unknown; physical client reading is not asserted.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-chronology.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-chronology.mjs#L7), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/runtime/event-ledger.mjs:19](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/event-ledger.mjs#L19), [src/storage/chronology-index.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/chronology-index.mjs#L10), [src/ui/history-desk.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/history-desk.mjs#L7)

**Local evidence references:** `tests/persistent-chronology.test.mjs` — ADR-037:; `tests/persistent-chronology.test.mjs` — never backdates; `tests/persistent-chronology.test.mjs` — future or changed receipts

**Still needed:** Compare fiction, execution and observer-knowledge chronologies in the installed module, through reachable GM/player UI and persistent world storage, observing Distinct timestamps and causality sort consistently

## ADR-038 — Historical truth corrections and reconciliation

**Scope:** Correct a mistaken historical claim; expected: Original event retained; corrections and downstream review are appended

**Code present:** Old observer receipts now resolve their actual historical claim revision. Correction staging precedes immutable correction persistence and blocks dependent approval/execution even after acknowledgement loss. Exact registered dependencies produce durable source-specific review jobs; explicit retained conclusions release only the reviewed source digest, while follow-up decisions remain blocked. Original receipts/reasoning remain attributable and effects require their separate approval. Native Foundry qualification remains deferred.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/knowledge-reviews.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/knowledge-reviews.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18), [src/ui/knowledge-faction-desk.mjs:37](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/knowledge-faction-desk.mjs#L37)

**Local evidence references:** `tests/persistent-knowledge.test.mjs` — ADR-038:; `tests/durable-knowledge-reviews.test.mjs` — ADR-038:

**Still needed:** Correct a mistaken historical claim in the installed module, through reachable GM/player UI and persistent world storage, observing Original event retained; corrections and downstream review are appended

## ADR-039 — Branchable timelines with one canonical branch

**Scope:** Create hypothetical alternate timeline and commit nothing; expected: Only one branch remains canonical; previews cannot mutate it

**Code present:** Versioned isolated fact-state branches retain immutable lineage and source observations. Canonical selection requires same-identity actual world facts after separately approved graph effects; it never commits a hypothesis or fabricates chronology. Native Compendium reconstruction is adapter-tested, while actual Foundry acceptance remains final-phase work.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Branching is bounded fact-state what-if versioning, not general branching of an entire live campaign/execution history. Canonical selection cannot apply hypothetical changes; separate fact effects are required. Exact broader historical intent is unavailable.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-timelines.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-timelines.mjs#L12), [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113), [src/ui/timeline-branch-desk.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/timeline-branch-desk.mjs#L7)

**Local evidence references:** `tests/native-timeline-session.test.mjs` — preserves isolated branch lineage

**Still needed:** Create hypothetical alternate timeline and commit nothing in the installed module, through reachable GM/player UI and persistent world storage, observing Only one branch remains canonical; previews cannot mutate it

## ADR-040 — Reusable graph blueprints

**Scope:** Instantiate reusable plot blueprint twice; expected: Instances have distinct IDs while preserving source blueprint revision

**Code present:** A stored full-graph template instantiates twice with disjoint graph/node/edge IDs, remapped internal links, exact source blueprint revision and explicit external bindings. Publication/activation remain separate. Interrupted draft creation resumes the same reviewed identity, and local draft edits cannot be overwritten. Existing instances remain pinned when a new template revision is published; graph-level update adoption is still a separate explicit workflow.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/portable-template.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/portable-template.mjs#L21), [src/orchestration/graph-templates.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/graph-templates.mjs#L9), [src/ui/template-desk.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/template-desk.mjs#L5)

**Local evidence references:** `tests/graph-templates.test.mjs` — ADR-040: one stored reusable graph

**Still needed:** Instantiate reusable plot blueprint twice in the installed module, through reachable GM/player UI and persistent world storage, observing Instances have distinct IDs while preserving source blueprint revision

## ADR-041 — Encounter orchestration and outcomes

**Scope:** Finish native encounter with alternate outcomes; expected: Selected outcome generates one verified plot event, not every possible ending

**Code present:** One explicit GM choice links an observed native Combat deletion to an executed and journal-verified encounter outcome. A world-wide immutable selection per native Combat prevents replacement across scopes or GM succession. Its stable causal event is retained even without subscribers; repeated submission or lost ACK never re-evaluates an accepted event. Specialized closure triggers reject ordinary manual envelopes; matching consequences need independent approval. Node/native adapter and Chromium paths pass locally; real Foundry qualification remains deferred.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Canonical closure selects an observed deleted Combat and one already verified outcome; complete encounter preparation-to-native-combat-to-resolution user workflow remains unaccepted.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/trigger-contract.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/trigger-contract.mjs#L11), [src/orchestration/encounter-closures.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/encounter-closures.mjs#L14), [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/runtime/event-ledger.mjs:19](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/event-ledger.mjs#L19), [src/ui/encounter-closure-desk.mjs:2](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/encounter-closure-desk.mjs#L2)

**Local evidence references:** `tests/encounter-closures.test.mjs` — one verified native encounter outcome; `tests/native-reactive.test.mjs` — exact selected encounter closure

**Still needed:** Finish native encounter with alternate outcomes in the installed module, through reachable GM/player UI and persistent world storage, observing Selected outcome generates one verified plot event, not every possible ending

## ADR-042 — Evidence and deduction graphs

**Scope:** Link evidence into deduction graph with contradicting claim; expected: Inference displays evidence and uncertainty, not hidden canonical answer

**Code present:** Hypotheses persist evidence-linked arguments while protected GM truth/verdict fields are excluded from player projections.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14)

**Local evidence references:** `tests/investigation-workbench.test.mjs` — GM-reviewed hypothesis persists

**Still needed:** Link evidence into deduction graph with contradicting claim in the installed module, through reachable GM/player UI and persistent world storage, observing Inference displays evidence and uncertainty, not hidden canonical answer

## ADR-043 — GM-reviewed player investigation boards

**Scope:** Submit player investigation board edits for GM review; expected: Only approved edits enter canonical/public shared board

**Code present:** Authenticated native Actor requests cite public clue IDs and a visible-content token. The GM inbox retains private immutable mapped requests; an authored published handler proposes the edit and independent GM effect approval appends a reviewed theory. Own-theory revisions preserve prior canonical history. Hidden-only changes do not alter public tokens; private stale revisions fail closed. Forged sender/ownership, secret references, hidden boards and uncertain completion are tested. No live Foundry multiplayer acceptance is claimed.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Player board edits require a configured trusted observer mapping, a published handler and separate approvals. No installed sharing/discovery/setup flow; users enter IDs.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/player-board-edits.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/player-board-edits.mjs#L11), [src/platform/foundry-board-transport.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-board-transport.mjs#L16), [src/runtime/player-board-edit-provider.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/player-board-edit-provider.mjs#L4), [src/ui/board-edit-review.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/board-edit-review.mjs#L3), [src/ui/investigation-board.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/investigation-board.mjs#L5)

**Local evidence references:** `tests/player-board-edits.test.mjs` — ADR-043: structured public-evidence edits

**Still needed:** Submit player investigation board edits for GM review in the installed module, through reachable GM/player UI and persistent world storage, observing Only approved edits enter canonical/public shared board

## ADR-044 — Clue knowledge and provenance

**Scope:** Share a clue without publishing its hidden source; expected: Recipient gains allowed clue with preserved protected provenance

**Code present:** Disclosed knowledge uses independent public IDs and allowlisted text; protected claim/source lineage stays in GM storage.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14)

**Local evidence references:** `tests/persistent-knowledge.test.mjs` — explicit observer receipt publishes

**Still needed:** Share a clue without publishing its hidden source in the installed module, through reachable GM/player UI and persistent world storage, observing Recipient gains allowed clue with preserved protected provenance

## ADR-045 — Knowledge-aware chat/journals

**Scope:** Render chat/journal referencing private clue; expected: Unauthorized clients cannot inspect hidden entry or metadata

**Code present:** Knowledge-authorized Chat and Journal publications now follow separately approved graph effects. Native world data contains only a generic shell and fixed-size authenticated ciphertext; recipient keys require current Actor/observer authorization and targeted delivery. Chromium covers plan/editor/review, lost acknowledgement confirmation, reconciliation and inert authorized rendering. Real Foundry storage/transport qualification remains deferred.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Native Chat/Journal shells are encrypted, but their key/source records depend on the unverified GM storage boundary. Observer mappings and key transport setup are not provided through normal first-use UI.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/knowledge-publications.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/knowledge-publications.mjs#L14), [src/platform/protected-native-publications.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/protected-native-publications.mjs#L16), [src/platform/publication-key-transport.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/publication-key-transport.mjs#L11), [src/security/publication-envelope.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/security/publication-envelope.mjs#L16), [src/ui/knowledge-publication-desk.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/knowledge-publication-desk.mjs#L5), [src/ui/protected-publication-viewer.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/protected-publication-viewer.mjs#L7)

**Local evidence references:** `tests/protected-native-publications.test.mjs` — follows approved plan; `tests/publication-key-transport.test.mjs` — authenticated requesting recipient

**Still needed:** Render chat/journal referencing private clue in the installed module, through reachable GM/player UI and persistent world storage, observing Unauthorized clients cannot inspect hidden entry or metadata

## ADR-046 — Player voting

**Scope:** Conduct vote with scoped eligible Actors; expected: Each Actor vote validated and result follows authored rule

**Code present:** Voting services validate participant identities and preserve private ballots, authored choice rules and final GM adjudication.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** No player cast-vote UI or authenticated cast-vote submission path found. Shipped player portal retrieves finalized vote results only; GM APIs record ballots. That is not a finished party-voting feature.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Technical player/GM APIs and selected request forms; transport/setup required

**Unpublished work:** No player vote-submission fix in frozen working snapshot.

**Source:** [src/orchestration/decisions.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/decisions.mjs#L9), [src/orchestration/persistent-voting.mjs:13](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-voting.mjs#L13)

**Local evidence references:** `tests/persistent-voting.test.mjs` — durable quorum, late ballot

**Still needed:** Conduct vote with scoped eligible Actors in the installed module, through reachable GM/player UI and persistent world storage, observing Each Actor vote validated and result follows authored rule

## ADR-047 — Deadlines, quorum and offline policy

**Scope:** Expire quorum vote with offline participants; expected: Offline/deadline policies applied without inventing participant votes

**Code present:** Deadlines, quorum and no-consensus/tie policies prevent invented offline votes or arbitrary winners.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Deadline/quorum/tie evaluation exists; an explicit configurable offline participant policy and a completed follow-up runoff workflow are not established. runoff-required is an outcome, not a running runoff.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Technical player/GM APIs and selected request forms; transport/setup required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/decisions.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/decisions.mjs#L9), [src/orchestration/persistent-voting.mjs:13](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-voting.mjs#L13)

**Local evidence references:** `tests/persistent-voting.test.mjs` — GM must explicitly adjudicate

**Still needed:** Expire quorum vote with offline participants in the installed module, through reachable GM/player UI and persistent world storage, observing Offline/deadline policies applied without inventing participant votes

## ADR-048 — Delayed causal consequences

**Scope:** Schedule delayed consequence and restart world; expected: Due item persists and executes only when prerequisites/authority hold

**Code present:** Integrated regression reconstructs the temporal service/index, finds the approved NPC commitment, records one due event and executes its target only after a distinct GM effect approval. Retry remains deduplicated; interrupted index staging has a separate repair regression.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-npc-actions.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-npc-actions.mjs#L14), [src/orchestration/temporal-coordinator.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/temporal-coordinator.mjs#L10), [src/runtime/manual-event-gateway.mjs:13](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/manual-event-gateway.mjs#L13)

**Local evidence references:** `tests/persistent-npc-actions.test.mjs` — ADR-034 and ADR-048: approved NPC schedule

**Still needed:** Schedule delayed consequence and restart world in the installed module, through reachable GM/player UI and persistent world storage, observing Due item persists and executes only when prerequisites/authority hold

## ADR-049 — Threat and pressure clocks

**Scope:** Tick threat clock under authorized event; expected: Clock increases exactly as policy specifies and never duplicates on retry

**Code present:** Clock mutations are revision checked, monotonic and causal; provider/journal idempotency prevents repeat application.

**Assessment:** bounded implementation present; not complete-product certified; product: **api-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/npc-schedule-planner.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/npc-schedule-planner.mjs#L11), [src/orchestration/persistent-faction-agenda.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-faction-agenda.mjs#L18), [src/runtime/domain-providers.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/domain-providers.mjs#L14)

**Local evidence references:** `tests/narrative-capabilities.test.mjs` — updated clock respects revisions

**Still needed:** Tick threat clock under authorized event in the installed module, through reachable GM/player UI and persistent world storage, observing Clock increases exactly as policy specifies and never duplicates on retry

## ADR-050 — GM-committed emergent suggestions

**Scope:** Generate emergent plot suggestion; expected: Suggestion remains isolated until GM explicitly commits it

**Code present:** Saved emergent suggestions remain isolated until acknowledgement and explicit reviewed live-intent submission. An authored receiving graph maps the suggestion into new proposals with their own GM approvals. Native source revisions, interruption recovery, immutable reviewed plans and accepted-event no-replay are tested. Hypothetical native origins and diagnostic faults are never promoted to native evidence.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Saved-plan review/submission exists but uses a technical planning lab and an authored receiving graph. No complete ordinary session suggestion-to-reviewed-action product journey.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-plans.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-plans.mjs#L9), [src/runtime/reviewed-plan-gateway.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/reviewed-plan-gateway.mjs#L9), [src/ui/planning-lab.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/planning-lab.mjs#L45)

**Local evidence references:** `tests/reviewed-plan-gateway.test.mjs` — ADR-050: saved emergent suggestion

**Still needed:** Generate emergent plot suggestion in the installed module, through reachable GM/player UI and persistent world storage, observing Suggestion remains isolated until GM explicitly commits it

## ADR-051 — Adaptive session planner

**Scope:** Assemble next-session plan from pinned active plots; expected: Plan uses bounded references and remains an editable GM preparation artifact

**Code present:** Multiple pinned active graphs retain exact publication and activation revisions, bounded named domain references, and editable private owner-GM agenda/notes. Source status is checked explicitly across reconstruction without campaign scans. Preparation remains separate from reviewed Handoff, public projection and live effects.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Preparation uses at most eight explicitly pinned active plots and selected references, with GM notes/agenda. Automatic broader campaign adaptation and the proposed friendly campaign planner are not established.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-session-preparation.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-session-preparation.mjs#L12), [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113), [src/ui/session-preparation-desk.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/session-preparation-desk.mjs#L5)

**Local evidence references:** `tests/native-timeline-session.test.mjs` — preserves named active plot preparation

**Still needed:** Assemble next-session plan from pinned active plots in the installed module, through reachable GM/player UI and persistent world storage, observing Plan uses bounded references and remains an editable GM preparation artifact

## ADR-052 — GM cockpit

**Scope:** Open GM cockpit with multiple active plots; expected: Focused actionable information loads, secrets stay in GM-only projection

**Code present:** The GM cockpit loads only the selected graph and matching explicit event IDs; it does not enumerate unrelated plots or expose a player DTO.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** The cockpit is a focused graph/event inspector, not the proposed campaign home. It requires selected graph/event references and has no shipped launcher.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** GM console API; no installed navigation/settings launcher in shipped build

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/bootstrap/index.mjs:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/bootstrap/index.mjs#L1), [src/editor/model.mjs:53](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/editor/model.mjs#L53), [src/orchestration/narrative-health.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/narrative-health.mjs#L16), [src/orchestration/scoped-search.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/scoped-search.mjs#L15), [src/runtime/explainability.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/explainability.mjs#L11), [src/ui/gm-cockpit.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/gm-cockpit.mjs#L3), [src/ui/graph-editor.mjs:30](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/graph-editor.mjs#L30)

**Local evidence references:** `tests/gm-cockpit.test.mjs` — GM cockpit reads only

**Still needed:** Open GM cockpit with multiple active plots in the installed module, through reachable GM/player UI and persistent world storage, observing Focused actionable information loads, secrets stay in GM-only projection

## ADR-053 — GM-reviewed narrative closure

**Scope:** Attempt to close plot with unresolved required objective; expected: GM receives explainable closure conditions and alternate ending options

**Code present:** Arc closure considers authored facets, unresolved objectives and exclusive ending conflicts, and requires explicit revision-bound GM selection.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/continuity.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/continuity.mjs#L5), [src/orchestration/campaign-closure.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/campaign-closure.mjs#L10), [src/orchestration/persistent-arc-resolution.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-arc-resolution.mjs#L12)

**Local evidence references:** `tests/campaign-closure.test.mjs` — partial arc ending keeps

**Still needed:** Attempt to close plot with unresolved required objective in the installed module, through reachable GM/player UI and persistent world storage, observing GM receives explainable closure conditions and alternate ending options

## ADR-054 — Narrative health diagnostics

**Scope:** Run narrative health on a scoped investigation; expected: Detects intentional unreachable objective as warning not invented fix

**Code present:** Scoped viability/health reports preserve incomplete coverage and legitimate failure instead of inventing a successful path or automatic repair.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/narrative-health.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/narrative-health.mjs#L16), [src/orchestration/scoped-search.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/scoped-search.mjs#L15), [src/runtime/explainability.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/explainability.mjs#L11)

**Local evidence references:** `tests/campaign-planning-workflows.test.mjs` — analyzer reports uncertainty

**Still needed:** Run narrative health on a scoped investigation in the installed module, through reachable GM/player UI and persistent world storage, observing Detects intentional unreachable objective as warning not invented fix

## ADR-055 — Scoped search and traversal

**Scope:** Search a narrative term in one permitted domain; expected: Query bounded and results honor user access boundaries

**Code present:** Canonical, permission-scoped search uses bounded postings and rejects stale revisions without world-wide scans.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Search is scoped and explicitly indexed; it is not automatic complete discovery of arbitrary world/campaign content. Search coverage must remain visible.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Internal indexed services after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/narrative-health.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/narrative-health.mjs#L16), [src/orchestration/scoped-search.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/scoped-search.mjs#L15), [src/runtime/explainability.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/explainability.mjs#L11)

**Local evidence references:** `tests/canonical-search.test.mjs` — canonical record update invalidates

**Still needed:** Search a narrative term in one permitted domain in the installed module, through reachable GM/player UI and persistent world storage, observing Query bounded and results honor user access boundaries

## ADR-056 — Why/why-not causal explanation

**Scope:** Explain why a node did not trigger; expected: Report identifies failed permitted conditions to GM without public secret leaks

**Code present:** Persisted bounded traces distinguish blocked conditions from absent evaluations and are accessible only through GM authority.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/narrative-health.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/narrative-health.mjs#L16), [src/orchestration/scoped-search.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/scoped-search.mjs#L15), [src/runtime/explainability.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/explainability.mjs#L11)

**Local evidence references:** `tests/explainability.test.mjs` — condition-blocked trace explains

**Still needed:** Explain why a node did not trigger in the installed module, through reachable GM/player UI and persistent world storage, observing Report identifies failed permitted conditions to GM without public secret leaks

## ADR-057 — Integrity validation and repairs

**Scope:** Find broken binding and run reviewable repair; expected: Repair preserves stable IDs and changes only approved references

**Code present:** Guided rebinding requires an explicitly selected verified candidate and current revision; stable identity is preserved and no document is automatically deleted.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Inspection and safe rebind primitives exist, but no complete guided repair wizard is reachable in the shipped UI; the native resource inspector is read/audit only.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/resource-reconciliation.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/resource-reconciliation.mjs#L9), [src/platform/foundry-actor-item-provider.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actor-item-provider.mjs#L21), [src/platform/foundry-resource-binding.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-resource-binding.mjs#L18)

**Local evidence references:** `tests/resource-reconciliation.test.mjs` — chosen verified native candidate

**Still needed:** Find broken binding and run reviewable repair in the installed module, through reachable GM/player UI and persistent world storage, observing Repair preserves stable IDs and changes only approved references

## ADR-058 — Incremental lazy dependencies

**Scope:** Change a dependency required by only one cached graph; expected: Only impacted compiled partitions invalidated and reloaded

**Code present:** Compiled immutable graph indexes are reused under exact declared contract identities and only affected dependency partitions invalidate. Cosmetic overlays preserve executable identity; actual state and roll observations are read again for every event. No event values, mutable authorization or native outcomes are cached.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Internal indexed services after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/compiled-graph-cache.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/compiled-graph-cache.mjs#L7), [src/graph/graph-dependencies.mjs:19](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/graph-dependencies.mjs#L19), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25)

**Local evidence references:** `tests/graph-dependencies.test.mjs` — compiled graph indexes are reused; `tests/graph-dependencies.test.mjs` — cosmetic graph/node overlays; `tests/graph-preflight.test.mjs` — actual router cache reuse

**Still needed:** Change a dependency required by only one cached graph in the installed module, through reachable GM/player UI and persistent world storage, observing Only impacted compiled partitions invalidated and reloaded

## ADR-059 — Incremental archives

**Scope:** Archive a concluded arc then request its summary; expected: Summary resolves lazily; event history retained without preload

**Code present:** Reviewed concluded-arc archives retain selected exact historical revisions in resumable bounded pages, preserve event fingerprints, and publish a lazy summary without loading history. Selection coverage is explicit-members-only; sources and native resources are never deleted.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Archival is explicit-members-only and retains sources; automatic full-arc membership discovery/cleanup is not established. Resume and permission behavior in a real world remains unaccepted.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Repository/GM APIs after manual native configuration; not automatic first-use persistence

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/orchestration/persistent-arc-archives.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-arc-archives.mjs#L9), [src/ui/history-desk.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/history-desk.mjs#L7)

**Local evidence references:** `tests/persistent-arc-archives.test.mjs` — ADR-059:; `tests/persistent-arc-archives.test.mjs` — after service restart; `tests/persistent-arc-archives.test.mjs` — original durable event fingerprint

**Still needed:** Archive a concluded arc then request its summary in the installed module, through reachable GM/player UI and persistent world storage, observing Summary resolves lazily; event history retained without preload

## ADR-060 — Partitioned indices and bounded caches

**Scope:** Dispatch one hook in campaign with thousands dormant plots; expected: Only matched index hits and bounded graph shards accessed

**Code present:** Event-type indices select bounded active graph snapshots and leave unrelated/dormant graph bodies unread; large-scale performance remains deferred.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Bounded indices/caches exist; representative large-world sizes, latency, memory bounds and sustained native performance have not been measured.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Internal indexed services after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/storage/graph-chunks.mjs:19](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/graph-chunks.mjs#L19), [src/storage/native-pack.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-pack.mjs#L15)

**Local evidence references:** `tests/reactive-persistence.test.mjs` — unsubscribed events do not hydrate

**Still needed:** Dispatch one hook in campaign with thousands dormant plots in the installed module, through reachable GM/player UI and persistent world storage, observing Only matched index hits and bounded graph shards accessed

## ADR-061 — Native Foundry documents, world Compendiums, repository facade

**Scope:** Read protected narrative record from native Compendium; expected: Native permission and index visibility enforce defined confidentiality

**Code present:** Native storage fails closed for readable/unverified packs and incomplete indices; final actual-client permission certification is still required.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Native pack records store the logical key and payload in plaintext flags. Confidentiality depends on actual native access restrictions and caller-supplied attestation; there is no shipped encrypted repository fallback or setup workflow.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Repository/GM APIs after manual native configuration; not automatic first-use persistence

**Unpublished work:** Encrypted-native-pack is new, untested and unintegrated. It is not counted as confidential storage.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/platform/foundry-actors.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actors.mjs#L7), [src/platform/foundry-board-transport.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-board-transport.mjs#L16), [src/platform/foundry-socket.mjs:26](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-socket.mjs#L26), [src/storage/graph-chunks.mjs:19](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/graph-chunks.mjs#L19), [src/storage/native-pack.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-pack.mjs#L15)

**Local evidence references:** `tests/native-persistence.test.mjs` — Player-readable pack cannot be used

**Still needed:** Read protected narrative record from native Compendium in the installed module, through reachable GM/player UI and persistent world storage, observing Native permission and index visibility enforce defined confidentiality

## ADR-062 — Adaptive partitions

**Scope:** Grow graph beyond initial partition threshold; expected: Adaptive split preserves IDs, indexed traversal and all references

**Code present:** Adaptive native index leaves and ordered posting shards grow while preserving stable IDs, locators and bounded page reads. Staged migration retains the original complete view, prepared entries remain distinct from absence, and dense temporal catch-up resumes its exact posting cursor after acknowledgement loss without dropping schedules. Native load/performance qualification is separate.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Adaptive index/posting implementations and interruption tests exist. Native large-world density/migration performance and complete installed repair workflow remain unaccepted; finite shard/depth limits are explicit.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Internal indexed services after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/temporal-catchup.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/temporal-catchup.mjs#L11), [src/storage/native-pack.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-pack.mjs#L15), [src/storage/native-temporal-index.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-temporal-index.mjs#L15), [src/storage/partition-policy.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/partition-policy.mjs#L5), [src/storage/posting-pages.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/posting-pages.mjs#L10)

**Local evidence references:** `tests/adaptive-native-partitions.test.mjs` — native overflow splits multiple index leaves; `tests/adaptive-posting-pages.test.mjs` — prepared posting migration retains; `tests/temporal-catchup.test.mjs` — dense temporal catch-up retains each posting page

**Still needed:** Grow graph beyond initial partition threshold in the installed module, through reachable GM/player UI and persistent world storage, observing Adaptive split preserves IDs, indexed traversal and all references

## ADR-063 — Tiered persisted indices

**Scope:** Read top-level, shard and historical index tiers; expected: Tiered index lookup finds relevant data without complete hydration

**Code present:** Explicit top-level, shard and historical metadata tiers preserve lazy exact payload lookup. Native reconstruction and selected historical reads avoid loading every graph/domain record; known missing/altered pages remain unknown or corrupt instead of false absence. Storage tiers do not imply unlimited campaign-wide query coverage.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Top-level/shard/historical metadata tiers exist inside one pack. This does not prove native client confidentiality or unlimited historical queries; actual load and density behavior needs acceptance.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Internal indexed services after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/storage/native-pack.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-pack.mjs#L15), [src/storage/partition-policy.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/partition-policy.mjs#L5), [src/storage/posting-pages.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/posting-pages.mjs#L10)

**Local evidence references:** `tests/adaptive-native-partitions.test.mjs` — top-level and historical metadata reads hydrate; `tests/adaptive-posting-pages.test.mjs` — known missing or altered immutable posting pages

**Still needed:** Read top-level, shard and historical index tiers in the installed module, through reachable GM/player UI and persistent world storage, observing Tiered index lookup finds relevant data without complete hydration

## ADR-064 — Permission-aware player projections

**Scope:** Fetch same plot as GM and player; expected: Separate DTOs omit protected source details and hidden counts

**Code present:** Separate allowlisted audience projections and generic unauthorized receipts prevent private source identifiers and hidden counts from entering responses.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/platform/foundry-actors.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actors.mjs#L7), [src/platform/foundry-board-transport.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-board-transport.mjs#L16), [src/platform/foundry-socket.mjs:26](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-socket.mjs#L26)

**Local evidence references:** `tests/board-transport.test.mjs` — invalid ownership returns generic

**Still needed:** Fetch same plot as GM and player in the installed module, through reachable GM/player UI and persistent world storage, observing Separate DTOs omit protected source details and hidden counts

## ADR-065 — GM failover and uncertain effects

**Scope:** Lose current GM while operation result uncertain; expected: New GM verifies journal and target before marking completion

**Code present:** A successor GM can explicitly verify the original persisted operation and reconcile its journal/review to completion without applying effects or reevaluating an inactive graph. Provenance mismatch, missing/prepared journal, failed verification and revoked authority cannot be marked successful. Journal-completed/review-uncertain interruptions resume without reapplying or reverifying; native confirmation is a separate action. Explicit successor adoption of an unchanged unexecuted approval preserves the original GM history and requires a separate Execute action; any prepared journal/index or uncertain execution rejects adoption.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Successor reconciliation/adoption service exists; the user still needs to configure/connect the correct GM and locate original operations. Complete installed handover/recovery management is not established.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18), [src/storage/native-intents.mjs:13](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-intents.mjs#L13), [src/ui/event-review-window.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/event-review-window.mjs#L4)

**Local evidence references:** `tests/proposal-review.test.mjs` — successor GM explicitly reconciles; `tests/protected-native-publications.test.mjs` — reconciled after GM handover

**Still needed:** Lose current GM while operation result uncertain in the installed module, through reachable GM/player UI and persistent world storage, observing New GM verifies journal and target before marking completion

## ADR-066 — GM-only confidential storage boundary

**Scope:** Probe confidential store, flags, pack metadata as player; expected: GM-only record and its identity cannot be enumerated

**Code present:** Pack configuration, source visibility attestations and index gates deny unverified confidential storage; actual hostile-client enumeration testing is deferred.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** The verifier checks supplied proof booleans and configured ownership; it does not execute the required hostile-client tests. GM-private storage confidentiality is not established by shipped evidence. Plaintext repository storage makes this a critical boundary.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Vault code is unpublished/untested; verifier draft is8/9 local cases and does not support the vault confidentiality mode.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/platform/foundry-actors.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actors.mjs#L7), [src/platform/foundry-board-transport.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-board-transport.mjs#L16), [src/platform/foundry-socket.mjs:26](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-socket.mjs#L26), [src/storage/graph-chunks.mjs:19](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/graph-chunks.mjs#L19), [src/storage/native-pack.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-pack.mjs#L15)

**Local evidence references:** `tests/native-persistence.test.mjs` — Protected Compendium defaults to denied

**Still needed:** Probe confidential store, flags, pack metadata as player in the installed module, through reachable GM/player UI and persistent world storage, observing GM-only record and its identity cannot be enumerated

## ADR-067 — Contextual Actor ownership and delegation

**Scope:** Request Actor action with ownership/delegation mismatch; expected: Permission verified against actual current Actor context

**Code present:** Actor authorization uses actual current ownership and viewed-scene synthetic-token context, rather than caller-claimed identity.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Ownership checks exist in handlers, but world Actor to narrative observer/recipient mappings are developer callbacks; no shipped participant-binding setup or management UI.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** New WorldParticipants service/desk has11 focused passing cases, but is not composed in frozen bootstrap.

**Source:** [src/platform/foundry-actors.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actors.mjs#L7), [src/platform/foundry-board-transport.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-board-transport.mjs#L16), [src/platform/foundry-socket.mjs:26](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-socket.mjs#L26)

**Local evidence references:** `tests/scoped-actor-authorization.test.mjs` — remote scene tokens

**Still needed:** Request Actor action with ownership/delegation mismatch in the installed module, through reachable GM/player UI and persistent world storage, observing Permission verified against actual current Actor context

## ADR-068 — Stable narrative IDs vs Foundry UUID bindings

**Scope:** Rebind missing Actor document to new UUID; expected: Narrative ID and event lineage do not change

**Code present:** Rebind operations preserve narrative resource identity and protected provenance while requiring the exact previous native ID and revision.

**Assessment:** bounded implementation present; not complete-product certified; product: **api-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/resource-reconciliation.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/resource-reconciliation.mjs#L9), [src/platform/foundry-actor-item-provider.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actor-item-provider.mjs#L21), [src/platform/foundry-resource-binding.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-resource-binding.mjs#L18)

**Local evidence references:** `tests/native-resource-binding.test.mjs` — Rebind requires the expected old

**Still needed:** Rebind missing Actor document to new UUID in the installed module, through reachable GM/player UI and persistent world storage, observing Narrative ID and event lineage do not change

## ADR-069 — Reference lifecycle and rebinds

**Scope:** Delete original Foundry resource under reference; expected: Reference status reports missing and guided rebind offered

**Code present:** Scoped native reference inspection detects missing/drift candidates and supports explicit reviewed binding changes without silent adoption.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Binding/rebind providers exist. Native Resource Inspector only reads/audits known references; no guided replacement chooser and end-to-end recovery UI.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/resource-reconciliation.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/resource-reconciliation.mjs#L9), [src/platform/foundry-actor-item-provider.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actor-item-provider.mjs#L21), [src/platform/foundry-resource-binding.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-resource-binding.mjs#L18)

**Local evidence references:** `tests/native-reverse-references.test.mjs` — drift and orphan reports

**Still needed:** Delete original Foundry resource under reference in the installed module, through reachable GM/player UI and persistent world storage, observing Reference status reports missing and guided rebind offered

## ADR-070 — Typed versioned narrative events

**Scope:** Emit versioned canonical event and replay typed fixture; expected: Event schema validates and causal lineage remains stable

**Code present:** Native/manual/due producers emit eventVersion 1.0.0. The journal verifies a full canonical Event document against the proposed descriptor, keeps causal parents and typed payload stable through approval and deduplicated replay, and rejects unsupported versions. Legacy unversioned records retain their original identity; no implicit migration is claimed.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/contracts/canonical-event-schema.mjs:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/contracts/canonical-event-schema.mjs#L1), [src/contracts/canonical-event.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/contracts/canonical-event.mjs#L9), [src/platform/foundry-hook-ingress.mjs:32](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-hook-ingress.mjs#L32), [src/runtime/event-ledger.mjs:19](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/event-ledger.mjs#L19), [src/runtime/manual-event-gateway.mjs:13](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/manual-event-gateway.mjs#L13)

**Local evidence references:** `tests/versioned-canonical-events.test.mjs` — ADR-070:; `tests/versioned-canonical-events.test.mjs` — unknown event versions; `tests/versioned-canonical-events.test.mjs` — unversioned events

**Still needed:** Emit versioned canonical event and replay typed fixture in the installed module, through reachable GM/player UI and persistent world storage, observing Event schema validates and causal lineage remains stable

## ADR-071 — Integration diagnostics

**Scope:** Disable required integration provider during gameplay; expected: GM sees actionable diagnostic and unsafe effects do not execute

**Code present:** Unavailable capabilities and invalid providers fail closed before mutation and surface GM-local diagnostics; no fallback effect executes.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Diagnostics are mainly error codes, raw reports and API metrics. No complete actionable integration-management screen that discovers and repairs missing native capabilities.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/orchestration/narrative-health.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/narrative-health.mjs#L16), [src/orchestration/scoped-search.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/scoped-search.mjs#L15), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/explainability.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/explainability.mjs#L11), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18), [src/runtime/provider-registry.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/provider-registry.mjs#L5)

**Local evidence references:** `tests/proposal-review.test.mjs` — registry rejects duplicate provider; `tests/contracts.test.mjs` — graph rejects unverified required capabilities; `tests/node-extensions.test.mjs` — an unavailable provider version

**Still needed:** Disable required integration provider during gameplay in the installed module, through reachable GM/player UI and persistent world storage, observing GM sees actionable diagnostic and unsafe effects do not execute

## ADR-072 — Schema and data migrations

**Scope:** Migrate old data fixtures with deliberate interruption; expected: Source preserved and migration can resume or recover without identity loss

**Code present:** Migration previews/uncertain audits preserve identity; new reviewed legacy adoption retains the original record and rejects stale sources and collisions.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Migration registry has no built-in registered application schema migrations. Once an attempt exists, apply refuses replay and inspect classifies the result; no general resume/reconcile-to-completion method is provided.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Repository/GM APIs after manual native configuration; not automatic first-use persistence

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/runtime/canonical-domain-effects.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/canonical-domain-effects.mjs#L11), [src/storage/migrations.mjs:13](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/migrations.mjs#L13)

**Local evidence references:** `tests/legacy-canonical-adoption.test.mjs` — ADR-072: legacy hashed records

**Still needed:** Migrate old data fixtures with deliberate interruption in the installed module, through reachable GM/player UI and persistent world storage, observing Source preserved and migration can resume or recover without identity loss

## ADR-073 — Versioned node schemas and unknown placeholders

**Scope:** Load graph with unavailable node provider version; expected: Unknown placeholder preserves persisted data without executing invalid node

**Code present:** An older unavailable provider version loads with its ports/data intact. Local regression proves that republishing and execution fail closed without losing the stored node.

**Assessment:** bounded implementation present; not complete-product certified; product: **temporary-preview-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration

**Shipped access:** GM console API openEditor; temporary sandbox on default startup

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/node-extensions.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/node-extensions.mjs#L12), [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/runtime/provider-registry.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/provider-registry.mjs#L5)

**Local evidence references:** `tests/node-extensions.test.mjs` — ADR-073: an unavailable

**Still needed:** Load graph with unavailable node provider version in the installed module, through reachable GM/player UI and persistent world storage, observing Unknown placeholder preserves persisted data without executing invalid node

## ADR-074 — Capability-based validated action providers

**Scope:** Submit effect through undeclared capability; expected: Provider validation/authorization denies operation

**Code present:** Provider registration, declared ports and result allowlists reject undeclared effects; the effect coordinator refuses unavailable capabilities.

**Assessment:** bounded implementation present; not complete-product certified; product: **api-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Trusted developer registration API

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/graph/node-extensions.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/node-extensions.mjs#L12), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18), [src/runtime/provider-registry.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/provider-registry.mjs#L5)

**Local evidence references:** `tests/node-extensions.test.mjs` — extension contract enforces version

**Still needed:** Submit effect through undeclared capability in the installed module, through reachable GM/player UI and persistent world storage, observing Provider validation/authorization denies operation

## ADR-075 — Developer test lab

**Scope:** Run developer test lab on mock effect interruption; expected: Fault observable in journal and trace without altering real campaign

**Code present:** The planning lab runs the real published evaluator and effect coordinator with isolated apply-ack/verification faults. Outcomes show uncertainty and one attempt without invoking or qualifying native providers. Chromium exercises simulation and saving the protected plan.

**Assessment:** bounded implementation present; not complete-product certified; product: **developer-tool-only**.

**Missing / limits:** A developer planning/test lab exists. Its successful isolated evaluations do not establish product completeness or a functioning fresh-world installation.

**Shared blockers:** Product delivery/qualification remains unaccepted.

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/ui/planning-lab.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/planning-lab.mjs#L45)

**Local evidence references:** `tests/published-graph-simulation.test.mjs` — ADR-075: injectable apply

**Still needed:** Run developer test lab on mock effect interruption in the installed module, through reachable GM/player UI and persistent world storage, observing Fault observable in journal and trace without altering real campaign

## ADR-076 — Extension manifests with lazy registration

**Scope:** Register provider with lazy manifest and no relevant plots; expected: Provider implementation not eagerly loaded or globally scanned

**Code present:** Lazy loader registration is inert until explicit demand and does not hydrate unrelated providers or plots at module bootstrap.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Lazy registration APIs exist; no ordinary package discovery/configuration workflow. Provider restoration still relies on trusted developer registration.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Trusted developer registration API

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/node-extensions.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/node-extensions.mjs#L12), [src/runtime/provider-registry.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/provider-registry.mjs#L5)

**Local evidence references:** `tests/node-extensions.test.mjs` — lazy node provider is registered

**Still needed:** Register provider with lazy manifest and no relevant plots in the installed module, through reachable GM/player UI and persistent world storage, observing Provider implementation not eagerly loaded or globally scanned

## ADR-077 — Layered configuration and immutable published snapshots

**Scope:** Edit draft while published graph remains active; expected: Published snapshot and live runtime semantics stay immutable

**Code present:** Draft edits, immutable published revisions and activation pointers remain separate across persistence and subsystem reconstruction.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25)

**Local evidence references:** `tests/persistent-graphs.test.mjs` — published immutable snapshot survives

**Still needed:** Edit draft while published graph remains active in the installed module, through reachable GM/player UI and persistent world storage, observing Published snapshot and live runtime semantics stay immutable

## ADR-078 — Incremental config invalidation

**Scope:** Update one graph node contract; expected: Only dependent published-candidate validations become stale

**Code present:** Persisted exact dependency manifests and validation sidecars survive reload and selectively mark only affected publications stale. Untracked legacy snapshots remain readable and require explicit current-contract adoption without historical snapshot mutation. Mutable approval/execution guards remain authoritative; closed-over policy changes need explicit contract/version changes.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Selective dependency checks exist, but prior/current schema and closure-captured policy changes still need explicit version/fingerprint management; no blanket self-healing compatibility.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/graph-dependencies.mjs:19](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/graph-dependencies.mjs#L19), [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/persistent-validations.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-validations.mjs#L10), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/graph-preflight.test.mjs` — persisted validations selectively become stale; `tests/graph-preflight.test.mjs` — legacy publications remain readable

**Still needed:** Update one graph node contract in the installed module, through reachable GM/player UI and persistent world storage, observing Only dependent published-candidate validations become stale

## ADR-079 — Selective startup activation and bounded catch-up

**Scope:** Restart after long offline interval with many due events; expected: Startup stays bounded and catch-up queue persists incomplete work

**Code present:** A durable per-bucket job spans intervals beyond the normal window, retains verified immutable candidate pages before committing progress and resumes after service reconstruction or cursor interruption. Each explicit request reads at most eight bounded buckets and emits no events or effects. Coverage is the index as observed per retained bucket; later/backdated index repairs need another job. Canonical scopes cannot shadow each other; old non-world schedules require explicit exact-record reindexing.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Catch-up retains indexed observations only. Late/backdated repairs require a new job and old non-world schedules require explicit reindexing; no automatic complete history reconstruction.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Internal indexed services after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/temporal-catchup.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/temporal-catchup.mjs#L11), [src/storage/native-temporal-index.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-temporal-index.mjs#L15), [src/ui/causal-planning-inspector.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/causal-planning-inspector.mjs#L9)

**Local evidence references:** `tests/temporal-catchup.test.mjs` — ADR-079: offline catch-up

**Still needed:** Restart after long offline interval with many due events in the installed module, through reachable GM/player UI and persistent world storage, observing Startup stays bounded and catch-up queue persists incomplete work

## ADR-080 — Indexed dormant-trigger routing

**Scope:** Fire Foundry Hook while most plots dormant; expected: Indexed subscriptions dispatch only relevant eligible triggers

**Code present:** Only indexed matching active subscriptions dispatch; published-only and deactivated graphs do not react to native Hooks.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/storage/graph-chunks.mjs:19](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/graph-chunks.mjs#L19), [src/storage/native-pack.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-pack.mjs#L15)

**Local evidence references:** `tests/reactive-persistence.test.mjs` — unsubscribed events do not hydrate

**Still needed:** Fire Foundry Hook while most plots dormant in the installed module, through reachable GM/player UI and persistent world storage, observing Indexed subscriptions dispatch only relevant eligible triggers

## ADR-081 — Tiered event reliability and reconciliation

**Scope:** Drop noncritical event signal and a critical event signal; expected: Reliability tiers apply reconciliation for critical signals

**Code present:** Configured critical signals persist discoverable intake before admission; best-effort overload may drop. Restart recovery verifies the original ledger and never automatically replays accepted events. Bounded native-source checkpoints flag unobserved changes within configured coverage; they cannot reconstruct every missed occurrence.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Best-effort overload may drop signals. Watched-source coverage is explicit and bounded; missed occurrences cannot be reconstructed automatically. In default install the service is not initialized at all.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/signal-reliability.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/signal-reliability.mjs#L12), [src/platform/foundry-hook-ingress.mjs:32](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-hook-ingress.mjs#L32), [src/platform/foundry-source-stamps.mjs:6](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-source-stamps.mjs#L6), [src/storage/critical-signal-index.mjs:8](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/critical-signal-index.mjs#L8), [src/ui/signal-reliability-desk.mjs:8](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/signal-reliability-desk.mjs#L8)

**Local evidence references:** `tests/signal-reliability.test.mjs` — ADR-081:; `tests/signal-reliability.test.mjs` — missed native callback; `tests/signal-reliability.test.mjs` — existing accepted or uncertain

**Still needed:** Drop noncritical event signal and a critical event signal in the installed module, through reachable GM/player UI and persistent world storage, observing Reliability tiers apply reconciliation for critical signals

## ADR-082 — Causality, revisions, conflicts

**Scope:** Process event with stale input revision; expected: Effect blocked/reviewed rather than committing under wrong state

**Code present:** Payload and selected-branch source revisions are rechecked at approval and execution, including absent state and converging paths.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/data-guards.test.mjs` — ADR-082: a changed guard revision

**Still needed:** Process event with stale input revision in the installed module, through reachable GM/player UI and persistent world storage, observing Effect blocked/reviewed rather than committing under wrong state

## ADR-083 — Native batches when supported; journaled staged effects otherwise

**Scope:** Attempt native multi-document updates with interrupted batch; expected: Journal distinguishes confirmed writes from uncertain partial steps

**Code present:** One immutable graph-owned plan declares up to6 exact allowlisted versioned steps. A separately approved batch effect executes them in order through the existing effect coordinator, with independent child journals and a durable confirmed prefix. Unknown apply/ACK/verification stops later writes. Explicit reconciliation confirms exact original owned native proofs and journals without calling create/apply again; the original GM approval is preserved. Only a proven contiguous unstarted suffix may form a distinct plan with new approval and recovery provenance. Full step previews appear before approval. Node/native Compendium and Chromium paths pass locally; writes are not claimed atomic and final Foundry recovery qualification remains deferred.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Batches are ordered, bounded to six allowlisted steps and non-atomic. Recovery stages only a proven unstarted suffix with new approval; no rollback or generalized native transaction is implemented.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/ordered-native-batches.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/ordered-native-batches.mjs#L16), [src/platform/foundry-actor-item-provider.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actor-item-provider.mjs#L21), [src/platform/foundry-journal-provider.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-journal-provider.mjs#L15), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/native-batch-provider.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/native-batch-provider.mjs#L4), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18), [src/ui/native-batch-desk.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/native-batch-desk.mjs#L4)

**Local evidence references:** `tests/ordered-native-batches.test.mjs` — approved native batch verifies ordered Actor; `tests/ordered-native-batches.test.mjs` — successor reconciles an original final native-create; `tests/native-reactive.test.mjs` — batch reconstruction distinguishes confirmed

**Still needed:** Attempt native multi-document updates with interrupted batch in the installed module, through reachable GM/player UI and persistent world storage, observing Journal distinguishes confirmed writes from uncertain partial steps

## ADR-084 — Effect idempotency and verification

**Scope:** Send duplicate message after effect confirmed; expected: Effect provider verifies native state; one-time result not applied twice

**Code present:** Completed causal operations are not reapplied, and uncertain native outcomes are not automatically retried after lost acknowledgments. Verified completed operations can explicitly emit a fresh causally linked continuation, whose target effects need independent approval. Uncertain or mismatched journals cannot qualify.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/runtime/approved-operation-gateway.mjs:8](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/approved-operation-gateway.mjs#L8), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/proposal-review.test.mjs` — approval transitions to one-time; `tests/approved-operation-gateway.test.mjs` — completed-operation continuation starts fresh

**Still needed:** Send duplicate message after effect confirmed in the installed module, through reachable GM/player UI and persistent world storage, observing Effect provider verifies native state; one-time result not applied twice

## ADR-085 — Adaptive priority scheduler

**Scope:** Flood scheduler with mixed-priority tasks; expected: Bounded prioritization preserves required safety and avoids starvation

**Code present:** Bounded critical/interactive/background scheduler adjusts concurrency after expensive work and gives the oldest waiting task a turn after a bounded priority burst. Hooks and selected background inspections share it.

**Assessment:** bounded implementation present; not complete-product certified; product: **api-only**.

**Missing / limits:** Priority scheduling is implemented, but representative native-world performance and operational tuning have not been validated.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113), [src/runtime/priority-scheduler.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/priority-scheduler.mjs#L5)

**Local evidence references:** `tests/runtime-scheduling.test.mjs` — ADR-085:

**Still needed:** Flood scheduler with mixed-priority tasks in the installed module, through reachable GM/player UI and persistent world storage, observing Bounded prioritization preserves required safety and avoids starvation

## ADR-086 — Sampled diagnostics and safe tuning

**Scope:** Enable sampled diagnostics under representative load; expected: Instrumentation respects sampling, privacy and configurable budget

**Code present:** Configurable disabled-by-default sampled GM-local timings retain at most 128 anonymous observations and aggregate outcome counts. Private fields are rejected; full native representative-load qualification is deferred.

**Assessment:** bounded implementation present; not complete-product certified; product: **api-only**.

**Missing / limits:** Sampled diagnostics are disabled by default and available through APIs; no complete user-facing tuning/integration console is established.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113), [src/runtime/bounded-diagnostics.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/bounded-diagnostics.mjs#L5)

**Local evidence references:** `tests/runtime-scheduling.test.mjs` — ADR-086:

**Still needed:** Enable sampled diagnostics under representative load in the installed module, through reachable GM/player UI and persistent world storage, observing Instrumentation respects sampling, privacy and configurable budget

## ADR-087 — Cycle convergence and execution budgets

**Scope:** Run cyclical graph beyond budget; expected: Execution safely stops with explainable cycle/convergence diagnostic

**Code present:** An explicit built-in numeric clamped recurrence provides bounded cyclic execution with fresh event-local rounds and repeat/converged exits. Only declared repeat cycles are admitted; opaque/data/alternate cycles remain rejected. Exhaustion or repeated state discards pending proposals and records terminal diagnostics, while successful effects still require independent approval.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Cycles support a specific pure numeric clamped recurrence. General convergent domain/effect/data/subgraph cycles are not supported; opaque/data/alternate cycles are deliberately rejected.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/convergence.mjs:6](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/convergence.mjs#L6), [src/graph/logic-nodes.mjs:40](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/logic-nodes.mjs#L40), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/ui/convergence-diagnostics.mjs:2](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/convergence-diagnostics.mjs#L2)

**Local evidence references:** `tests/bounded-convergence.test.mjs` — published authored cycle converges; `tests/bounded-convergence.test.mjs` — exhausted cyclic execution discards; `tests/bounded-convergence.test.mjs` — publication keeps alternate

**Still needed:** Run cyclical graph beyond budget in the installed module, through reachable GM/player UI and persistent world storage, observing Execution safely stops with explainable cycle/convergence diagnostic

## ADR-088 — Evaluation records with inputs and roll provenance

**Scope:** Execute mechanical roll affecting condition; expected: Evaluation stores roll ID, relevant inputs, revisions and provenance

**Code present:** Typed core.roll.value reads a resolved native attempt at its exact revision. Conditions and payloads record selected mechanical inputs, original event, request fingerprint and record digest in protected evaluation/proposal evidence. Approval/execution, nested data calls, simulation and saved-plan submission revalidate that source; event payloads cannot substitute values and no read rerolls dice.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM services/API and authored graph effects after manual native configuration

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/typed-data.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/typed-data.mjs#L11), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/runtime/graph-data-frame.mjs:6](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/graph-data-frame.mjs#L6), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18), [src/runtime/reviewed-plan-gateway.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/reviewed-plan-gateway.mjs#L9), [src/runtime/roll-input.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/roll-input.mjs#L5)

**Local evidence references:** `tests/roll-input-graph.test.mjs` — ADR-088:; `tests/roll-input-graph.test.mjs` — saved-plan submission

**Still needed:** Execute mechanical roll affecting condition in the installed module, through reachable GM/player UI and persistent world storage, observing Evaluation stores roll ID, relevant inputs, revisions and provenance

## ADR-089 — Native rolls/chat with protected disclosures

**Scope:** Perform blind native roll with private narrative fact; expected: Roll visibility and narrative knowledge follow separate rules

**Code present:** Mechanical reports use explicit GM-only, all-player or named-observer policies, selected total/outcome fields and independently approved native publication. The generic native Chat shell contains fixed-size ciphertext and no raw Roll, hidden DC/modifier/opponent total or audience. Targeted authenticated grants check actual GM roles or owned Actor/observer identity. Public mechanical reports create no narrative knowledge receipts. Final native Foundry qualification remains deferred.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Mechanical disclosure services exist, but real roll/Chat/Journal/recipient workflows are blocked by missing Actor/observer mappings and native setup. Not certified against a game-system rules engine.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/contracts/private-publication.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/contracts/private-publication.mjs#L9), [src/orchestration/knowledge-publications.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/knowledge-publications.mjs#L14), [src/platform/protected-native-publications.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/protected-native-publications.mjs#L16), [src/platform/publication-key-transport.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/publication-key-transport.mjs#L11), [src/ui/knowledge-publication-desk.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/knowledge-publication-desk.mjs#L5), [src/ui/protected-publication-viewer.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/protected-publication-viewer.mjs#L7)

**Local evidence references:** `tests/protected-native-publications.test.mjs` — ADR-089:; `tests/publication-key-transport.test.mjs` — co-GM requests a blind report

**Still needed:** Perform blind native roll with private narrative fact in the installed module, through reachable GM/player UI and persistent world storage, observing Roll visibility and narrative knowledge follow separate rules

## ADR-090 — Typed player intents, GM execution

**Scope:** Player submits privileged narrative intent; expected: Intent becomes queued request; no independent player-side effect

**Code present:** Privileged player input is authenticated, queued durably and independently reviewed, with no direct player effect execution.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Authenticated generic intent intake/queue exists; no connected approved-intent-to-graph-execution product path. A player request must not be presented as a completed action.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Technical player/GM APIs and selected request forms; transport/setup required

**Unpublished work:** No generic request-execution integration fix in frozen working snapshot.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/platform/foundry-actors.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actors.mjs#L7), [src/platform/foundry-board-transport.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-board-transport.mjs#L16), [src/platform/foundry-socket.mjs:26](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-socket.mjs#L26), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/native-persistence.test.mjs` — Intent queue durable request

**Still needed:** Player submits privileged narrative intent in the installed module, through reachable GM/player UI and persistent world storage, observing Intent becomes queued request; no independent player-side effect

## ADR-091 — Durable request lifecycle, GM queue, revalidation

**Scope:** Restart during pending GM-approved player request; expected: Durable lifecycle persists and revalidates before resolution

**Code present:** Queue reconstruction and permission/opportunity rechecks preserve pending requests and prevent replay under changed context.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Native queue supports states and revalidation, but no shipped source consumer completes approved-to-processing/resolved handling. Review requires an exact compound request key instead of a discoverable queue.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Technical player/GM APIs and selected request forms; transport/setup required

**Unpublished work:** No generic request-execution integration fix in frozen working snapshot.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/platform/foundry-actors.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actors.mjs#L7), [src/platform/foundry-board-transport.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-board-transport.mjs#L16), [src/platform/foundry-socket.mjs:26](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-socket.mjs#L26), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18), [src/storage/native-pack.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-pack.mjs#L15)

**Local evidence references:** `tests/native-persistence.test.mjs` — Intent queue durable request

**Still needed:** Restart during pending GM-approved player request in the installed module, through reachable GM/player UI and persistent world storage, observing Durable lifecycle persists and revalidates before resolution

## ADR-092 — Contextual compact GM approval

**Scope:** GM reviews intent in compact context dialog; expected: Approver sees necessary provenance and explicit effect preview

**Code present:** Event Review now provides a collapsed effect/provenance preview with exact event, graph revision, node, provider, payload, call chain and source/guard observations. Opening the preview applies no effect; approval, execution and uncertain-result reconciliation remain separate actions. The combined preview-to-execution flow is exercised in Chromium; native Foundry window behavior remains deferred.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Event Review shows effect/provenance data. Generic Player Request Review only shows requester/Actor/opportunity/approach and approve/reject, without resolved consequence preview or full execution journey.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** GM console API; no installed navigation/settings launcher in shipped build

**Unpublished work:** New Home availability handling does not complete the player request review/execution flow.

**Source:** [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18), [src/ui/event-review-window.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/event-review-window.mjs#L4)

**Local evidence references:** `tests/roll-input-graph.test.mjs` — direct condition records native roll inputs

**Still needed:** GM reviews intent in compact context dialog in the installed module, through reachable GM/player UI and persistent world storage, observing Approver sees necessary provenance and explicit effect preview

## ADR-093 — Dock, inspector and full application

**Scope:** Use dock, inspector and full canvas on same active plot; expected: All views reflect same authoritative version without redundant writes

**Code present:** Shared GM controller coordinates dock, inspector and canvas without canonical writes. DOM coverage checks all three views and preserves unsaved editor changes; native window lifecycle remains deferred.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Dock/inspector/full-window classes exist but are API-launched and require manual integration; real native window lifecycle/usability is not accepted.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** GM console API; no installed navigation/settings launcher in shipped build

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113), [src/ui/gm-workspace.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/gm-workspace.mjs#L4)

**Local evidence references:** `tests/persistent-gm-focus.test.mjs` — ADR-093:

**Still needed:** Use dock, inspector and full canvas on same active plot in the installed module, through reachable GM/player UI and persistent world storage, observing All views reflect same authoritative version without redundant writes

## ADR-094 — Passive and explicit GM attention focus

**Scope:** Pin and unpin GM focus across scene changes; expected: Pinned focus persists and passive focus follows configured context

**Code present:** Per-GM protected pins survive restart and scene changes; configured passive scene focus resumes after unpinning. Scene callbacks read exact preferences and never enumerate plots.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Focus persistence needs protected integration and explicit scene mappings. No ordinary installed preferences/scene-binding setup flow; delegated status can misreport backend availability.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** GM console API; no installed navigation/settings launcher in shipped build

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-gm-focus.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-gm-focus.mjs#L10), [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113)

**Local evidence references:** `tests/persistent-gm-focus.test.mjs` — ADR-094:

**Still needed:** Pin and unpin GM focus across scene changes in the installed module, through reachable GM/player UI and persistent world storage, observing Pinned focus persists and passive focus follows configured context

## ADR-095 — Layered attention, pins and reviewed recaps

**Scope:** Age out ephemeral attention with one manually pinned event; expected: Transient signals decay; pinned narrative significance remains

**Code present:** Bounded persistent attention has explicit TTL; manually pinned significance survives decay/restart. Reviewed recap authorization remains separate from attention metadata.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Attention and recap primitives exist; the friendly session/campaign overview shown in the new designs is a proposal, not shipped implementation.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-gm-focus.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-gm-focus.mjs#L10), [src/platform/native-integration.mjs:113](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-integration.mjs#L113)

**Local evidence references:** `tests/persistent-gm-focus.test.mjs` — ADR-095:

**Still needed:** Age out ephemeral attention with one manually pinned event in the installed module, through reachable GM/player UI and persistent world storage, observing Transient signals decay; pinned narrative significance remains

## ADR-096 — GM-reviewed session continuity handoff

**Scope:** Create reviewed session handoff from unresolved plots; expected: Handoff links relevant events and pending work without copying histories

**Code present:** Reviewed handoffs retain bounded source references, revisions and safe recaps without copying histories or activating future hooks.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** GM Handoff prepares approved recaps, but players must know exact session/Actor IDs and have manually started continuity services. No discoverable player journal feed.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/session-planner.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/session-planner.mjs#L4), [src/domains/simulation.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/simulation.mjs#L7), [src/orchestration/persistent-plans.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-plans.mjs#L9), [src/orchestration/persistent-session-handoff.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-session-handoff.mjs#L9)

**Local evidence references:** `tests/persistent-session-handoff.test.mjs` — handoff survives service reconstruction

**Still needed:** Create reviewed session handoff from unresolved plots in the installed module, through reachable GM/player UI and persistent world storage, observing Handoff links relevant events and pending work without copying histories

## ADR-097 — Bounded explainable narrative foresight

**Scope:** Forecast plausible faction agenda outcome; expected: Prediction grounded in known conditions, not automatic canonical effect

**Code present:** Persistent GM-only authored hypotheses are grounded in current canonical agenda rules and the faction own explicit knowledge receipts, with explanations and no canonical future effect.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Foresight is bounded authored-rule/knowledge-based hypothesis generation, not an autonomous prediction engine. Its selected-source coverage and unknown outcomes must remain explicit.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/session-planner.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/session-planner.mjs#L4), [src/domains/simulation.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/simulation.mjs#L7), [src/orchestration/npc-schedule-planner.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/npc-schedule-planner.mjs#L11), [src/orchestration/persistent-faction-agenda.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-faction-agenda.mjs#L18), [src/orchestration/persistent-forecasts.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-forecasts.mjs#L10), [src/orchestration/persistent-plans.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-plans.mjs#L9), [src/orchestration/persistent-session-handoff.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-session-handoff.mjs#L9), [src/runtime/domain-providers.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/domain-providers.mjs#L14)

**Local evidence references:** `tests/persistent-forecasts.test.mjs` — ADR-097: forecast

**Still needed:** Forecast plausible faction agenda outcome in the installed module, through reachable GM/player UI and persistent world storage, observing Prediction grounded in known conditions, not automatic canonical effect

## ADR-098 — Incremental forecast invalidation

**Scope:** Change forecast dependency revision; expected: Only affected forecasts become stale; unaffected ones remain valid

**Code present:** Forecasts persist only their selected rule dependencies and revalidate them on inspection. Changing another rule in the same agenda leaves an unrelated forecast fresh; affected/expired predictions are withheld.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Forecast invalidation covers selected stored dependencies; it does not establish automatic whole-campaign dependency discovery or native-system semantic compatibility.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/session-planner.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/session-planner.mjs#L4), [src/domains/simulation.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/simulation.mjs#L7), [src/orchestration/persistent-forecasts.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-forecasts.mjs#L10), [src/orchestration/persistent-plans.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-plans.mjs#L9), [src/orchestration/persistent-session-handoff.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-session-handoff.mjs#L9)

**Local evidence references:** `tests/persistent-forecasts.test.mjs` — ADR-098: dependency

**Still needed:** Change forecast dependency revision in the installed module, through reachable GM/player UI and persistent world storage, observing Only affected forecasts become stale; unaffected ones remain valid

## ADR-099 — Staged GM-controlled Foundry resource preparation

**Scope:** Stage native resource preparation and defer activation; expected: Manifest tracks planned vs materialized vs active separately

**Code present:** The canonical resource manifest now distinguishes planned, verified materialized and separately approved active resources. Original native journals and exact graph activation proofs survive reconstruction; consumers recheck presence/ownership/publication before approval and execution. Deleted or reactivated resources block future consumers without erasing historical proofs or recreating borrowed documents.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Resource lifecycle services exist but need explicitly prepared batches/manifests, an authored activation branch and separate reviews. No normal initial native world/resource setup is shipped.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/editor/resource-activation-branch.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/editor/resource-activation-branch.mjs#L4), [src/orchestration/resource-manifests.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/resource-manifests.mjs#L15), [src/platform/native-source-preflight.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-source-preflight.mjs#L9), [src/runtime/resource-manifest-provider.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/resource-manifest-provider.mjs#L4), [src/ui/resource-manifest-desk.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/resource-manifest-desk.mjs#L3)

**Local evidence references:** `tests/resource-manifests.test.mjs` — planned resources require journaled materialization; `tests/resource-manifests.test.mjs` — resource guards block consumers; `tests/native-resource-lifecycle.test.mjs` — native resource phases and original activation journals

**Still needed:** Stage native resource preparation and defer activation in the installed module, through reachable GM/player UI and persistent world storage, observing Manifest tracks planned vs materialized vs active separately

## ADR-100 — Versioned blueprint inheritance and three-way merge

**Scope:** Edit blueprint and local instance divergent field; expected: Three-way merge identifies conflict and preserves local overrides

**Code present:** Three-way blueprint adoption preserves local overrides, pins source revisions and requires explicit conflict resolutions without native document mutation.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Three-way field adoption and graph templates exist; complete live propagation/update adoption for arbitrary graph/instance changes is not established. Conflicts require explicit resolution.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/blueprints.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/blueprints.mjs#L7), [src/orchestration/persistent-blueprints.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-blueprints.mjs#L10)

**Local evidence references:** `tests/persistent-blueprints.test.mjs` — conflicts require explicit

**Still needed:** Edit blueprint and local instance divergent field in the installed module, through reachable GM/player UI and persistent world storage, observing Three-way merge identifies conflict and preserves local overrides

## ADR-101 — Provenance-aware resource ownership and safe lifecycle

**Scope:** Archive exclusive generated resource with GM edits; expected: Ownership guard prevents accidental destructive deletion

**Code present:** Ownership/protected-edit/reverse-reference checks prevent destructive retirement, including borrowed/shared resources and edited exclusive documents.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Ownership and safe-retirement checks exist; a complete user-facing resource ownership/lifecycle management journey is not established. No general undo/deletion transaction is supplied.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/resource-reconciliation.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/resource-reconciliation.mjs#L9), [src/platform/foundry-actor-item-provider.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actor-item-provider.mjs#L21), [src/platform/foundry-resource-binding.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-resource-binding.mjs#L18)

**Local evidence references:** `tests/resource-reconciliation.test.mjs` — retirement never automatically deletes

**Still needed:** Archive exclusive generated resource with GM edits in the installed module, through reachable GM/player UI and persistent world storage, observing Ownership guard prevents accidental destructive deletion

## ADR-102 — Incremental provenance and reverse-reference audit

**Scope:** Run resource audit on only selected partition; expected: Find orphan/drift/duplicate without traversing all world documents

**Code present:** Native-UUID reverse lookups and bounded resource audits find drift/orphans without traversing all world documents.

**Assessment:** bounded implementation present; not complete-product certified; product: **api-only**.

**Missing / limits:** Reverse-reference auditing covers registered/indexed references, not all arbitrary external module/native references. Known-ID queries and real native drift handling need acceptance.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/resource-reconciliation.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/resource-reconciliation.mjs#L9), [src/platform/foundry-actor-item-provider.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actor-item-provider.mjs#L21), [src/platform/foundry-resource-binding.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-resource-binding.mjs#L18)

**Local evidence references:** `tests/native-reverse-references.test.mjs` — reverse lookup is scoped

**Still needed:** Run resource audit on only selected partition in the installed module, through reachable GM/player UI and persistent world storage, observing Find orphan/drift/duplicate without traversing all world documents

## ADR-103 — Guided reference reconciliation with lineage

**Scope:** Rebind missing NPC with ambiguous matches; expected: GM chooses reviewed candidate; historical narrative identity preserved

**Code present:** Guided rebind refuses ambiguous/unverified candidates and uses an explicit current-revision selection while preserving stable narrative identity.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Rebind validation primitives exist, but the claimed guided workflow has no complete shipped chooser/wizard. The visible inspector is read-only.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/resource-reconciliation.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/resource-reconciliation.mjs#L9), [src/platform/foundry-actor-item-provider.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actor-item-provider.mjs#L21), [src/platform/foundry-resource-binding.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-resource-binding.mjs#L18)

**Local evidence references:** `tests/resource-reconciliation.test.mjs` — unverified and ambiguous native

**Still needed:** Rebind missing NPC with ambiguous matches in the installed module, through reachable GM/player UI and persistent world storage, observing GM chooses reviewed candidate; historical narrative identity preserved

## ADR-104 — Identity aliases, personas and succession

**Scope:** Reveal persona secret or retire alias; expected: Underlying entity and persona lineages remain distinct

**Code present:** Canonical personas retain a separate immutable entity link and revisioned retirement. The integrated existing knowledge plan and approved-recipient effect disclose only authored text to the selected observer. Retirement preserves the original entity, secret link, historical receipt and persona revision; retired identities cannot reactivate or retarget another entity. Real Foundry qualification remains deferred.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Entity/persona/link/retirement logic exists; a cohesive identity/persona authoring and sharing interface is not established. Reveal services still require observer mappings.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-identities.mjs:8](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-identities.mjs#L8), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/platform/foundry-resource-binding.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-resource-binding.mjs#L18), [src/runtime/canonical-domain-effects.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/canonical-domain-effects.mjs#L11), [src/runtime/extended-providers.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/extended-providers.mjs#L21), [src/runtime/narrative-capabilities.mjs:62](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/narrative-capabilities.mjs#L62)

**Local evidence references:** `tests/domain-workflow-scenarios.test.mjs` — a reviewed persona reveal reaches only its selected observer

**Still needed:** Reveal persona secret or retire alias in the installed module, through reachable GM/player UI and persistent world storage, observing Underlying entity and persona lineages remain distinct

## ADR-105 — Identity-aware underlying/persona/observer relationships

**Scope:** Update persona reputation without entity-wide propagation; expected: Only explicitly authorized observer/relation scopes change

**Code present:** Integrated persisted persona reputation uses the persona identity, preserving the entity and other alias standing. One independently approved directional relationship changes while the other observer relation and underlying entity relation remain unchanged; no implicit propagation is performed. Real Foundry qualification remains deferred.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Distinct persona/entity/observer relationship records are supported; there is no completed ordinary relationship browser/editor and no native multi-observer acceptance.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/persistent-identities.mjs:8](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-identities.mjs#L8), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/platform/foundry-resource-binding.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-resource-binding.mjs#L18), [src/runtime/canonical-domain-effects.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/canonical-domain-effects.mjs#L11), [src/runtime/extended-providers.mjs:21](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/extended-providers.mjs#L21), [src/runtime/narrative-capabilities.mjs:62](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/narrative-capabilities.mjs#L62)

**Local evidence references:** `tests/domain-workflow-scenarios.test.mjs` — persona reputation and one selected directional relationship

**Still needed:** Update persona reputation without entity-wide propagation in the installed module, through reachable GM/player UI and persistent world storage, observing Only explicitly authorized observer/relation scopes change

## ADR-106 — Bounded provenance-aware information propagation

**Scope:** Propagate rumor through configured faction network; expected: Bounded depth, credibility, delay and secrecy rules respected

**Code present:** Persistent propagation plans enforce due times, provenance, recipient scope, bounded traversal and explicit approval without publishing automatically.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14)

**Local evidence references:** `tests/persistent-knowledge-propagation.test.mjs` — delays, out-of-scope users

**Still needed:** Propagate rumor through configured faction network in the installed module, through reachable GM/player UI and persistent world storage, observing Bounded depth, credibility, delay and secrecy rules respected

## ADR-107 — Evidence-linked observer-specific belief revision

**Scope:** Retract evidence source from an observer; expected: Belief revision preserves earlier reason and independently queues downstream review

**Code present:** Registered source-to-conclusion manifests now drive bounded persistent review pages and one review per dependent identity. Pages survive interruption/GM handover without replaying inference; another observer is excluded. Approval/execution consult exact dependent/source indexes and durable retention acknowledgements. Staged corrections can be explicitly reconciled, later review passes can close prior retention, and new source revisions require new review. Scope and known registered-index coverage are explicit; no whole-campaign discovery is implied.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/knowledge-reviews.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/knowledge-reviews.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18), [src/storage/native-pack.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-pack.mjs#L15), [src/ui/knowledge-faction-desk.mjs:37](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/knowledge-faction-desk.mjs#L37)

**Local evidence references:** `tests/durable-knowledge-reviews.test.mjs` — ADR-107:; `tests/durable-knowledge-reviews.test.mjs` — retained source page resumes; `tests/durable-knowledge-reviews.test.mjs` — later follow-up decision; `tests/native-reactive.test.mjs` — native Compendium knowledge guards

**Still needed:** Retract evidence source from an observer in the installed module, through reachable GM/player UI and persistent world storage, observing Belief revision preserves earlier reason and independently queues downstream review

## ADR-108 — Knowledge-safe player affordances

**Scope:** Present allowed action menu to player; expected: Hidden actions, entities, status/error and metadata are not leaked

**Code present:** Audience action/board DTOs are allowlisted and transport authorization returns generic failures without hidden-record metadata or criteria.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Allowlisted projection/intake primitives exist, but a discoverable player opportunity list and end-to-end generic intent execution flow are not implemented.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Technical player/GM APIs and selected request forms; transport/setup required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/platform/foundry-actors.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actors.mjs#L7), [src/platform/foundry-board-transport.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-board-transport.mjs#L16), [src/platform/foundry-socket.mjs:26](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-socket.mjs#L26)

**Local evidence references:** `tests/board-transport.test.mjs` — bad GM projection is rejected

**Still needed:** Present allowed action menu to player in the installed module, through reachable GM/player UI and persistent world storage, observing Hidden actions, entities, status/error and metadata are not leaked

## ADR-109 — Policy-driven native hidden/contested/passive checks

**Scope:** Resolve passive/contested/hidden roll with partial band; expected: Adapter policy and separate disclosure applied without correctness oracle

**Code present:** A protected explicit selection binds a registered policy version/fingerprint to the exact world system/version and Foundry build for the existing GM-authored d20 implementation. Unsupported or changed context and unregistered/changed declarations fail closed before new randomness. Completed and uncertain attempts retain original policy stamps and never reroll; opposed sides share one pinned policy. Active/passive/opposed partial/tie rules remain GM-authored, not claimed native system automation. Protected graph inputs retain adapter provenance; separate mechanical reports omit adapter metadata/DC/modifier/opponent information. Node/native persistence and Chromium paths pass locally; live Foundry acceptance remains deferred.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** The only supplied roll implementation is authored system-neutral d20/opposed-d20 with policy declarations. Registering a system ID/version does not implement that system rules engine. Broader passive/hidden/contested policies and advertised game-system support need explicit acceptance.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/knowledge-publications.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/knowledge-publications.mjs#L14), [src/orchestration/roll-system-policies.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/roll-system-policies.mjs#L12), [src/platform/foundry-opposed-rolls.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-opposed-rolls.mjs#L11), [src/platform/foundry-rolls.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-rolls.mjs#L11), [src/runtime/roll-input.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/roll-input.mjs#L5), [src/ui/roll-system-policy-desk.mjs:2](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/roll-system-policy-desk.mjs#L2)

**Local evidence references:** `tests/roll-system-policies.test.mjs` — pins exact world/system/build policy; `tests/roll-system-policies.test.mjs` — opposed checks pin one policy; `tests/roll-system-policies.test.mjs` — mechanical disclosure omits adapter metadata; `tests/native-reactive.test.mjs` — selected system roll policy and original mechanical result

**Still needed:** Resolve passive/contested/hidden roll with partial band in the installed module, through reachable GM/player UI and persistent world storage, observing Adapter policy and separate disclosure applied without correctness oracle

## ADR-110 — Attempt identity and retry/reattempt distinction

**Scope:** Resend same attempt with new transport retry nonce; expected: Recognized as delivery retry; meaningful reattempt requires changed context

**Code present:** Attempt fingerprints distinguish transport delivery retries from meaningful changes in approach/evidence/context rather than granting repeated opportunities.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **api-only**.

**Missing / limits:** Attempt identity/deduplication rules exist, but their full player retry/reattempt lifecycle is not reachable through a completed generic player-action workflow.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Technical player/GM APIs and selected request forms; transport/setup required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/platform/foundry-actors.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-actors.mjs#L7), [src/platform/foundry-board-transport.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-board-transport.mjs#L16), [src/platform/foundry-socket.mjs:26](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-socket.mjs#L26)

**Local evidence references:** `tests/expanded-domains.test.mjs` — attempt identity distinguishes

**Still needed:** Resend same attempt with new transport retry nonce in the installed module, through reachable GM/player UI and persistent world storage, observing Recognized as delivery retry; meaningful reattempt requires changed context

## ADR-111 — Shared objectives with scoped individual knowledge

**Scope:** Two party members independently uncover private evidence; expected: Individual knowledge retained; party objective avoids duplicate consequence

**Code present:** Separate observer knowledge can support shared milestones while one-time completion prevents duplicate consequence/reward.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Shared milestones and per-observer projections exist, but normal player discovery, sharing, contribution and completion UX remains incomplete.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/persistent-investigation-milestones.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-investigation-milestones.mjs#L12), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/orchestration/persistent-quest-projections.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-quest-projections.mjs#L12), [src/runtime/canonical-domain-effects.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/canonical-domain-effects.mjs#L11)

**Local evidence references:** `tests/investigation-milestones.test.mjs` — two observers may contribute

**Still needed:** Two party members independently uncover private evidence in the installed module, through reachable GM/player UI and persistent world storage, observing Individual knowledge retained; party objective avoids duplicate consequence

## ADR-112 — Bounded investigation viability analysis

**Scope:** Check investigation with no current discovery paths; expected: GM sees viability diagnostic, alternative authored paths, legitimate failure permitted

**Code present:** Scoped viability identifies no known path, incomplete coverage and legitimate failure separately without revealing a correct answer or auto-awarding completion.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Bounded viability analysis exists; it does not prove a complete solvability engine or automatically repair authored narrative dead ends.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/narrative-health.mjs:16](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/narrative-health.mjs#L16), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/orchestration/scoped-search.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/scoped-search.mjs#L15), [src/runtime/explainability.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/explainability.mjs#L11)

**Local evidence references:** `tests/campaign-planning-workflows.test.mjs` — analyzer reports uncertainty

**Still needed:** Check investigation with no current discovery paths in the installed module, through reachable GM/player UI and persistent world storage, observing GM sees viability diagnostic, alternative authored paths, legitimate failure permitted

## ADR-113 — Evidence-linked structured hypotheses and protected GM truth evaluation

**Scope:** Compare multiple theories against public evidence; expected: Players see authorized arguments only; GM truth evaluation remains protected

**Code present:** Structured theories cite only known evidence and authorized recipients; player records exclude protected verdict and truth fields.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **blocked-by-setup**.

**Missing / limits:** Evidence-linked theories exist, but ordinary player entry/sharing remains dependent on hand-entered IDs and manually configured handlers. Complete GM review UX and native audience acceptance remain open.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14)

**Local evidence references:** `tests/investigation-workbench.test.mjs` — sharing requires recipients

**Still needed:** Compare multiple theories against public evidence in the installed module, through reachable GM/player UI and persistent world storage, observing Players see authorized arguments only; GM truth evaluation remains protected

## ADR-114 — Typed event-linked milestones and independent investigation closure

**Scope:** Complete evidence milestone and submit unsupported correct guess; expected: Only qualifying event marks milestone; guessed truth yields no oracle/reward

**Code present:** Only canonical authorized evidence/verification events qualify milestones; correct guesses and unknown evidence cannot award completion.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually; G4: player/observer/recipient binding and discoverability are not a completed product flow

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/orchestration/investigation-workbench.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/investigation-workbench.mjs#L11), [src/orchestration/persistent-investigation-milestones.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-investigation-milestones.mjs#L12), [src/orchestration/persistent-knowledge-propagation.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge-propagation.mjs#L14), [src/orchestration/persistent-knowledge.mjs:14](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-knowledge.mjs#L14), [src/orchestration/persistent-quest-projections.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-quest-projections.mjs#L12), [src/runtime/canonical-domain-effects.mjs:11](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/canonical-domain-effects.mjs#L11)

**Local evidence references:** `tests/persistent-investigation-milestones.test.mjs` — unknown evidence and guessed identity

**Still needed:** Complete evidence milestone and submit unsupported correct guess in the installed module, through reachable GM/player UI and persistent world storage, observing Only qualifying event marks milestone; guessed truth yields no oracle/reward

## ADR-115 — Cross-plot dependencies and bounded causal fan-out

**Scope:** One event relevant to three plotted quests; expected: Independent target checks, bounded subscribers and one-time effects

**Code present:** The native Compendium integration registers three Actor-update quests and one unrelated Item-update quest. One normalized native Actor event visits exactly the three relevant active graph IDs and produces three proposals with no automatic effects. Independent approvals produce exactly three native state writes; duplicate ingress preserves evaluations and completed reviews reject another execution. No unrelated quest is loaded. This is adapter evidence; live Foundry load and multi-client qualification remain deferred.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Tests establish a bounded three-quest native event fan-out in an adapter fixture, not representative-world throughput or a completed installed cross-plot authoring workflow.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/platform/foundry-hook-ingress.mjs:32](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/foundry-hook-ingress.mjs#L32), [src/runtime/active-subscriptions.mjs:22](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/active-subscriptions.mjs#L22), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/native-reactive.test.mjs` — one native update visits only its three active quest subscribers

**Still needed:** One event relevant to three plotted quests in the installed module, through reachable GM/player UI and persistent world storage, observing Independent target checks, bounded subscribers and one-time effects

## ADR-116 — Multidimensional arc endings and GM-authorized finalization

**Scope:** Resolve arc with conflicting exclusive endings; expected: GM review blocks conflicts; secondary and partial outcomes preserved

**Code present:** Multidimensional closure rejects exclusive conflicts/unknown alternatives, preserves unresolved threads and uses staged revision-bound GM finalization.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/continuity.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/continuity.mjs#L5), [src/orchestration/campaign-closure.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/campaign-closure.mjs#L10), [src/orchestration/persistent-arc-resolution.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-arc-resolution.mjs#L12)

**Local evidence references:** `tests/persistent-arc-resolution.test.mjs` — exclusive ending conflicts

**Still needed:** Resolve arc with conflicting exclusive endings in the installed module, through reachable GM/player UI and persistent world storage, observing GM review blocks conflicts; secondary and partial outcomes preserved

## ADR-117 — Persistent living-world continuity manifests and dormant hooks

**Scope:** Create next arc from completed one; expected: Manifest uses live entity references and dormant hooks rather than duplication

**Code present:** Continuity manifests retain live references and dormant future hooks without copying source graphs or silently starting the next arc.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/continuity.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/continuity.mjs#L5), [src/domains/session-planner.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/session-planner.mjs#L4), [src/domains/simulation.mjs:7](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/simulation.mjs#L7), [src/orchestration/campaign-closure.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/campaign-closure.mjs#L10), [src/orchestration/persistent-arc-resolution.mjs:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-arc-resolution.mjs#L12), [src/orchestration/persistent-plans.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-plans.mjs#L9), [src/orchestration/persistent-session-handoff.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/persistent-session-handoff.mjs#L9)

**Local evidence references:** `tests/campaign-planning-workflows.test.mjs` — continuity handoff uses source references

**Still needed:** Create next arc from completed one in the installed module, through reachable GM/player UI and persistent world storage, observing Manifest uses live entity references and dormant hooks rather than duplication

## ADR-118 — GM-authoritative bounded time-jump reconciliation

**Scope:** Skip months and inspect due faction action; expected: Due is not assumed completed; uncertain off-screen events remain open

**Code present:** Large bounded world-time windows classify pending commitments; verified due-event submission rechecks time/index/revision and never assumes faction action succeeded.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/scheduler.mjs:5](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/scheduler.mjs#L5), [src/orchestration/temporal-coordinator.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/orchestration/temporal-coordinator.mjs#L10), [src/storage/native-temporal-index.mjs:15](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/native-temporal-index.mjs#L15)

**Local evidence references:** `tests/due-event-gateway.test.mjs` — stale index entries or changed

**Still needed:** Skip months and inspect due faction action in the installed module, through reachable GM/player UI and persistent world storage, observing Due is not assumed completed; uncertain off-screen events remain open

## ADR-119 — Severity-aware scoped publication preflight

**Scope:** Publish candidate containing secret disclosure path; expected: Severity gate blocks unsafe snapshot and reports required coverage

**Code present:** Publication preflight records actionable severity and required coverage across providers, secret disclosure paths and native source checks. Missing/unavailable contracts block publication; authenticated co-GM review is scoped to rights and private durable receipts. Acknowledgement uncertainty cannot repeat validation writes, and partial coverage never becomes a complete-publication claim.

**Assessment:** bounded implementation present; not complete-product certified; product: **blocked-by-setup**.

**Missing / limits:** Static severity/coverage preflight exists. It does not cover installation, first-run setup, usability, actual native authorization or all product workflows.

**Shared blockers:** G1: no shipped launcher/normal first-use setup; console access required; G2: default memory editor; no persisted native setup/restoration; G3: native integration/callbacks and service starts must be supplied manually

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/graph/persistent-validations.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-validations.mjs#L10), [src/graph/publication-preflight.mjs:10](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/publication-preflight.mjs#L10), [src/platform/native-source-preflight.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/platform/native-source-preflight.mjs#L9), [src/ui/graph-preflight-desk.mjs:4](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/ui/graph-preflight-desk.mjs#L4)

**Local evidence references:** `tests/graph-preflight.test.mjs` — publication preflight blocks secret disclosure; `tests/native-reactive.test.mjs` — native severity preflight persists blocker coverage

**Still needed:** Publish candidate containing secret disclosure path in the installed module, through reachable GM/player UI and persistent world storage, observing Severity gate blocks unsafe snapshot and reports required coverage

## ADR-120 — Architecture-complete core gates; full deliverable clarified

**Scope:** Qualify complete module against feature scope checklist; expected: All agreed domains, not just core MVP, must have integrated acceptance evidence

**Code present:** The qualification engine loads exactly all125 decisions, all28 requirement groups and all97 candidate contracts, validates individually fingerprinted closure reviews and actual completed-suite cases, and records every missing local/native acceptance independently. It refuses count-based completion and keeps full scope visible.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **developer-tool-only**.

**Missing / limits:** The functional gate accepted service reviews without requiring a fresh-world install-to-persistent-GM/player workflow. Its ready-for-final-native-qualification result is not a valid product-completion conclusion.

**Shared blockers:** Product delivery/qualification remains unaccepted.

**Shipped access:** Developer tools and generated reports, not a gameplay workflow

**Unpublished work:** New product-readiness findings contradict the old service-only completion conclusion; no replacement product gate is integrated.

**Source:** [tools/qualification/plan.json:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/plan.json#L1), [tools/qualification/qualification.py:24](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/qualification.py#L24), [tools/qualification/semantic-contracts.json:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/semantic-contracts.json#L1), [tools/qualify.py:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualify.py#L12)

**Local evidence references:** `tests/qualification-tools.test.mjs` — ADR-120: complete-scope evidence

**Still needed:** Qualify complete module against feature scope checklist in the installed module, through reachable GM/player UI and persistent world storage, observing All agreed domains, not just core MVP, must have integrated acceptance evidence

## ADR-121 — Versioned stable contracts, flexible internals

**Scope:** Modify stable event contract after publication; expected: Version bump/migration checks required, UI-only change may stay internal

**Code present:** Canonical Event v1 matches the proposed schema and its pinned version fingerprint; changed descriptors and unsupported event versions require explicit compatibility/migration handling. UI source is outside this contract descriptor. General dependency-cache invalidation remains separately partial under ADR-078.

**Assessment:** bounded implementation present; not complete-product certified; product: **developer-tool-only**.

**Missing / limits:** No additional feature-specific absence established in this review. The bounded implementation still needs a complete installed-world acceptance run; this row is not a completeness certification.

**Shared blockers:** Product delivery/qualification remains unaccepted.

**Shipped access:** Developer tools and generated reports, not a gameplay workflow

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/contracts/canonical-event-schema.mjs:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/contracts/canonical-event-schema.mjs#L1), [src/contracts/canonical-event.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/contracts/canonical-event.mjs#L9), [src/runtime/event-ledger.mjs:19](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/event-ledger.mjs#L19), [src/storage/migrations.mjs:13](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/storage/migrations.mjs#L13)

**Local evidence references:** `tests/versioned-canonical-events.test.mjs` — ADR-121:; `tests/versioned-canonical-events.test.mjs` — unknown event versions; `tests/node-extensions.test.mjs` — extension contract enforces version

**Still needed:** Modify stable event contract after publication in the installed module, through reachable GM/player UI and persistent world storage, observing Version bump/migration checks required, UI-only change may stay internal

## ADR-122 — Authoritative spec and bidirectional traceability

**Scope:** Review one decision against requirement, contract and test; expected: Bidirectional traceability exists and contradictions are explicitly logged

**Code present:** The trace engine links each authoritative decision, requirement, named contract, candidate contract, actual implementation and case in both directions. It checks missing inverse mappings, scenario-ID/domain contradictions, missing semantic descriptions, unavailable nodes/services, and records explicit service/interface deviations rather than candidate-ID equality.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **developer-tool-only**.

**Missing / limits:** Trace links and contradiction checks exist. Original Q1–112 answer wording is unavailable, and mapping-reviewed-with-explicit-limits is not semantic implementation equivalence. Exact historical scope cannot be certified from condensed summaries alone.

**Shared blockers:** Product delivery/qualification remains unaccepted.

**Shipped access:** Developer tools and generated reports, not a gameplay workflow

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [tools/qualification/plan.json:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/plan.json#L1), [tools/qualification/qualification.py:24](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/qualification.py#L24), [tools/qualification/semantic-contracts.json:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/semantic-contracts.json#L1), [tools/qualify.py:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualify.py#L12)

**Local evidence references:** `tests/qualification-tools.test.mjs` — ADR-122: normative traceability

**Still needed:** Review one decision against requirement, contract and test in the installed module, through reachable GM/player UI and persistent world storage, observing Bidirectional traceability exists and contradictions are explicitly logged

## ADR-123 — Dependency-ordered slices and parallel full-scope delivery

**Scope:** Merge concurrent batch implementing two dependent features; expected: Incremental integration gates run; shared contracts owned and versioned

**Code present:** Dependent changes are integrated in one checkout with failing-before/passing-after regressions; batch counts are not used as acceptance evidence.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **developer-tool-only**.

**Missing / limits:** Parallel service work and dependency ordering occurred, but end-to-end vertical product slices were not completed/accepted before the readiness claim. Delivery governance failed.

**Shared blockers:** Product delivery/qualification remains unaccepted.

**Shipped access:** Developer tools and generated reports, not a gameplay workflow

**Unpublished work:** Frozen working changes do not establish completion of this feature; see UNPUBLISHED.md.

**Source:** [src/domains/domain-store.mjs:34](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/domains/domain-store.mjs#L34), [src/graph/persistent-registry.mjs:45](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/persistent-registry.mjs#L45), [src/graph/validate.mjs:9](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/graph/validate.mjs#L9), [src/runtime/durable-router.mjs:25](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/durable-router.mjs#L25), [src/runtime/effects.mjs:3](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/effects.mjs#L3), [src/runtime/proposal-review.mjs:18](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/runtime/proposal-review.mjs#L18)

**Local evidence references:** `tests/canonical-domain-integration.test.mjs` — ADR-031: approved objective graph

**Still needed:** Merge concurrent batch implementing two dependent features in the installed module, through reachable GM/player UI and persistent world storage, observing Incremental integration gates run; shared contracts owned and versioned

## ADR-124 — Evidence-based compatible release qualification

**Scope:** Advertise Foundry compatibility for untested build; expected: Release matrix declines unsupported claim without passing evidence

**Code present:** The release matrix declines compatibility without current exact source/version, real native environment identity, artifact fingerprints, all125 executed scenarios, all required native dimensions and functional/semantic closure. It rejects mocks, future timestamps, stale artifacts, missing system versions and failed or blocked native evidence.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **developer-tool-only**.

**Missing / limits:** No real native run records exist. The module manifest verified14.369 is an author-requested declaration, not executed compatibility proof. Actual user evidence already includes failed launcher/setup/window usability.

**Shared blockers:** Product delivery/qualification remains unaccepted.

**Shipped access:** Protected GM desk/API and/or authored graph effect; native setup and selected stable IDs required

**Unpublished work:** No native passing release evidence added.

**Source:** [tools/qualification/plan.json:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/plan.json#L1), [tools/qualification/qualification.py:24](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/qualification.py#L24), [tools/qualification/semantic-contracts.json:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/semantic-contracts.json#L1), [tools/qualify.py:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualify.py#L12)

**Local evidence references:** `tests/qualification-tools.test.mjs` — ADR-124: native compatibility

**Still needed:** Advertise Foundry compatibility for untested build in the installed module, through reachable GM/player UI and persistent world storage, observing Release matrix declines unsupported claim without passing evidence

## ADR-125 — Controlled architecture closure; one complete module

**Scope:** Propose new external server after architecture closure; expected: Change rejected pending explicit amendment; full module single-deliverable scope retained

**Code present:** The native module bootstrap resolves its transitive runtime imports within installable src, declares no required external runtime packages, and contains no fetch/WebSocket/EventSource calls requiring a developer server. Qualification is local developer tooling; it adds no service or backend to the native module.

**Assessment:** partial / narrower contract or incomplete feature workflow; product: **developer-tool-only**.

**Missing / limits:** One native module package exists, but the agreed complete-module deliverable is not met: setup, persistent defaults, discoverable GM/player journeys and several feature paths are incomplete. Runtime package independence is not product completion.

**Shared blockers:** Product delivery/qualification remains unaccepted.

**Shipped access:** Developer tools and generated reports, not a gameplay workflow

**Unpublished work:** No completed replacement module has been released. Work is paused for this assessment.

**Source:** [src/bootstrap/index.mjs:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/src/bootstrap/index.mjs#L1), [tools/qualification/plan.json:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/plan.json#L1), [tools/qualification/qualification.py:24](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/qualification.py#L24), [tools/qualification/semantic-contracts.json:1](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualification/semantic-contracts.json#L1), [tools/qualify.py:12](https://github.com/Somel1978/easy-plots/blob/2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a/tools/qualify.py#L12)

**Local evidence references:** `tests/qualification-tools.test.mjs` — ADR-125: the installable module

**Still needed:** Propose new external server after architecture closure in the installed module, through reachable GM/player UI and persistent world storage, observing Change rejected pending explicit amendment; full module single-deliverable scope retained

