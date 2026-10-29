# Easy Plots — Complete-Module Technical Specification, Draft v0.2

**Architecture status:** All 125 choices accepted; discovery closed. **Implementation status:** No executable Easy Plots module created, and no native Foundry installation test has passed. V1 contracts remain proposed pending listed security and platform verification.

**Binding delivery requirement:** ONE complete Foundry VTT v14+ module with the entire approved feature set. Development may use multiple coordinated agents and batches, each incrementally integrated/tested for easier debugging. Internal checkpoints are NOT feature-limited releases. No standalone server, backend, remote database or independent background service.

## Suggested reading order

1. `Easy_Plots_Technical_Spec_v0.2.md` — main consolidated normative draft, with revision-0.2 elaborations in Sections 15–16.
2. `Foundry_Trust_Boundaries_v0.2.md` — essential native client/GМ trust model, protected storage, transport blockers, and explicit adversarial Foundry verification exercises.
3. `Contract_Operations_and_State_Machines_v0.2.md` — logical API catalog, causal execution pipeline, request/effect state transitions, split activation, error policy and dedup scopes.
4. `Contracts_V1_Proposed.ts` + `Domain_Contracts_V1_Proposed.ts` — compile-checked cross-subsystem TS contracts, *not runtime implementations*.
5. `Proposed_Core_Schemas_V1.json` + `Additional_Domain_Schemas_V1.json` — Draft 2020-12 syntactic validators (some core semantic cross-record invariants still require domain/runtime validation).
6. `Domain_Node_Provider_Catalog.csv` / `.json` — 97 candidate versioned typed provider definitions covering all planned domains.
7. `Document_and_Index_Storage_Map.csv` — 50 proposed logical records, confidentiality classes and index ownership boundaries.
8. `Decision_Register_125.csv` — the 125 accepted decisions, grouped requirement IDs and newly attached decision-specific test IDs.
9. `Traceability_Matrix.csv` and `Full_125_Decision_Acceptance_Matrix.csv` — 28 grouped requirement types and 125 individual **proposed** test scenarios, not pass evidence.
10. `Parallel_Batches_and_Agent_Contracts_v0.2.md` — domain ownership, contract DAG, parallel coding rules, batches B0–B6 and one-complete-module integration gates.
11. `Assumptions_and_Spikes.md` — technical assumptions and unresolved platform verification.
12. `Validation_Report_v0.2.md` — completed syntactic checks, known audit limitations and actual vs proposed status.

Legacy v0.1 companions retained for continuity: `Acceptance_Test_Catalog.csv`, `Workstreams_and_Tests.csv`, `Agent_Handoff_and_Integration.md`, and `Example_Canonical_Event_V1.json`.

## High-priority blockers requiring direct Foundry v14 verification

1. Authenticate the origin of a player's request independently of client-provided `userId`; verify any intended private result channel. Ordinary module sockets are broadcast, not a trusted confidential RPC service.
2. Verify restricted world document and Compendium source/index visibility as an unauthorized player; GM-only flags or names alone do not guarantee confidentiality.
3. Verify co-GM conflicting native writes, authority epochs, restart/reconnect and uncertain-effect recovery.
4. Pin exact tested Foundry v14 build(s) and game-system adapter versions; independently verify native APIs.
5. Benchmark partition/cache budgets and rehearse backup-backed migration on representative worlds.

**Do not resolve these blockers by inventing a separate server or pretending Foundry provides universal transactions or authenticated private module sockets.**

## Reproducible syntactic checks

```bash
python tools/validate_spec_v02.py
```

Python packages: `jsonschema` required; TypeScript compiler `tsc` required on PATH. The check validates mapping counts/uniqueness, schemas, example fixture and TypeScript compilation. It does **not** run Foundry or establish runtime correctness.

## Version and provenance

Draft 0.2 is based on v0.1 and 125 confirmed architecture decisions. Exact verbatim Q1–112 discussion text was not available for audit; their existing condensed summaries remain marked as such. New typed schemas and 125 scenario tests are **proposal artifacts** pending approval and real implementation. `Change_Log_v0.2.md` identifies changes.
