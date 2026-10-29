# Easy Plots — Assumptions, Architecture Risks, and Verification Spikes

**Status:** Open; none of these are considered verified merely because their proposed design appears in the specification.

## SPIKE-SEC-001 — Player identity and private response transport

**Priority:** CRITICAL  
**Uncertainty:** Module.socket relays packets; client supplied userId is spoofable. Need authenticated sender and private target verified in v14.  
**Verification:** Prototype hostile player browser, two players, GM, co-GM. Confirm provenance independently of payload and recipient visibility.  
**Fallback consistent with accepted constraints:** Use Foundry permission-enforced native document operations + GM review, or another verified core pathway; never privilege raw module sockets.  
**Owning workstream:** W2

## SPIKE-STO-001 — Protected document storage and indices

**Priority:** CRITICAL  
**Uncertainty:** World Compendium access/index/flags and player metadata visibility may leak private records.  
**Verification:** Provision pack and GM-only world documents on target build; probe from player client via every exposed API.  
**Fallback consistent with accepted constraints:** Use alternate GM-restricted world document records and separately published sanitized projection index.  
**Owning workstream:** W1/W2

## SPIKE-COORD-001 — Co-GM coordinator and write fencing

**Priority:** HIGH  
**Uncertainty:** No documented native arbitrary cross-document transaction or server-side custom CAS.  
**Verification:** Concurrent GM clients, disconnect after write, rejoin, stale lease, document mutate and verify.  
**Fallback consistent with accepted constraints:** Best-effort GM coordinator with version checks and uncertain/manual-recovery queue; no exactly-once claims.  
**Owning workstream:** W2

## SPIKE-V14-001 — Exact Foundry v14 target build and hooks

**Priority:** HIGH  
**Uncertainty:** Published docs vary across patch releases; internal APIs should be avoided.  
**Verification:** Pin and test exact build; inspect Hooks, native Events, AppV2 form lifecycle and compendium behavior.  
**Fallback consistent with accepted constraints:** Adapter with feature detection; unsupported builds excluded from verified matrix.  
**Owning workstream:** W1/W4

## SPIKE-SYS-001 — Game system rolls/activities

**Priority:** HIGH  
**Uncertainty:** Core Foundry can support some rolls but system activities vary across dnd5e releases.  
**Verification:** Test adapter against exact target dnd5e and any additionally selected systems; capture blind/GM/private rolls.  
**Fallback consistent with accepted constraints:** System-neutral core, disable unsupported capabilities with GM-only diagnostics.  
**Owning workstream:** W4

## SPIKE-PERF-001 — Performance limits and partition granularity

**Priority:** HIGH  
**Uncertainty:** Numerical cache/graph fan-out thresholds cannot be justified without representative world sizes.  
**Verification:** Benchmark 1/10/100 active plots with thousands dormant; memory and startup traces; calibrated budgets.  
**Fallback consistent with accepted constraints:** Conservative configurable budgets and review queue for exceeded work.  
**Owning workstream:** W1/W9

## SPIKE-MIG-001 — Native compendium migrations and consistency

**Priority:** HIGH  
**Uncertainty:** Pack creation, lock, partial failures and journal/index updates may be non-atomic.  
**Verification:** Rehearse staging and failed upgrades from backed up world clones, verify all records.  
**Fallback consistent with accepted constraints:** Copy-on-write migrations with recovery manifest, GM review and backup restoration.  
**Owning workstream:** W1/W9

## SPIKE-RULE-001 — Expression/rule authoring library

**Priority:** MEDIUM  
**Uncertainty:** Exact AST syntax, functions and editor controls not yet frozen.  
**Verification:** Specify supported operators, typecheck, fuzz eval, reject code injection and cycles.  
**Fallback consistent with accepted constraints:** Minimal self-contained typed AST with provider predicates.  
**Owning workstream:** W3

## SPIKE-CALENDAR-001 — World time/calendar semantics

**Priority:** MEDIUM  
**Uncertainty:** Foundry world-time clock does not by itself define every fictional calendar.  
**Verification:** Verify configured calendar module integration and date conversions/rounding.  
**Fallback consistent with accepted constraints:** Use numeric world seconds with GM-authored calendar translation and explicit uncertainty.  
**Owning workstream:** W6

## SPIKE-BLUEPRINT-001 — Blueprint merge and conflict ownership

**Priority:** MEDIUM  
**Uncertainty:** Three-way merge for port schema/permissions needs semantic merge rules.  
**Verification:** Test inherited graph versions, local overrides, secret field merges and GM protected edits.  
**Fallback consistent with accepted constraints:** Require manual GM reconciliation for ambiguous structural merges.  
**Owning workstream:** W7

## SPIKE-UI-001 — Graph renderer and dock integration

**Priority:** MEDIUM  
**Uncertainty:** Foundry ApplicationV2 supports windows but some docking/UI interactions are host-specific.  
**Verification:** Prototype resize, performance, accessibility, modal nesting and mobile behavior.  
**Fallback consistent with accepted constraints:** Use standalone AppV2 inspector/windows and optional dock as UI enhancement.  
**Owning workstream:** W8

## SPIKE-ADR-001 — Historical decision source audit

**Priority:** HIGH  
**Uncertainty:** Initial 112 choices presently represented by condensed summaries rather than verbatim full questions/answers.  
**Verification:** Compare decision register against complete chat transcript or exported history; approve corrections.  
**Fallback consistent with accepted constraints:** Mark unverified exact wording and retain source-summary provenance until reconciled.  
**Owning workstream:** W0

## General decisions still to formalize

- Exact initial supported Foundry **14.x build(s)**, installed game-system versions, browser matrix and compatibility declaration.
- Canonical module package ID, source distribution and license.
- Explicit per-domain node-provider manifests; each remains in complete-module scope.
- Partition thresholds, cycle budgets, startup time and memory acceptance limits: choose from measurements.
- Event payload allowlists, JSON schemas, error codes, schema migration support window.
- Which provider actions are native system-neutral vs dnd5e-specific vs unsupported.
- Build orchestrator for parallel agents and precise repository ownership/merge controls.
- Change-control approvers and release evidence owner.

**Hard rule:** no open spike may be silently resolved by introducing an external server, trusting client-supplied user identities, broadcasting protected data or loading the entire campaign.
