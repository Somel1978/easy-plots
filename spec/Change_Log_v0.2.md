# Specification change log — Draft v0.2

- **Scope unchanged:** all 125 accepted architectural decisions; one complete Foundry VTT module; coordinated parallel development and incremental integration; no separate backend.
- **Security expanded:** new threat zones, origin authentication requirements, confidential transport restrictions, GM-only storage/index verification and adversarial native Foundry test instructions.
- **Core API elaborated:** lifecycle and logical command contracts, explicit public-safe errors, causal journals, independent attempt/event/effect IDs, GM operation verification.
- **Published graph correction:** immutable `PublishedSnapshotV1` should not use a mutable active boolean as the authoritative state; a proposed separate `GraphActivationV1` is introduced for explicit activation.
- **Domain types expanded:** standalone TypeScript proposal file for people/personas, factions, obligations, evidence, observer-specific beliefs, investigations, milestones, voting, spatial and temporal systems, resource provenance, blueprints, arcs and simulation.
- **Provider catalog:** 97 proposed node types across 14 domains, all versioned and mapped to source decisions. No node implementation or Foundry registration has occurred.
- **Storage proposal map:** 50 logical record groups mapped to proposed confidentiality and index boundaries. Native physical substrate and access controls remain pending security spike.
- **Traceability expanded:** each ADR now has a unique `TEST-ADR-xxx` scenario; the original 28 grouped requirements and 30 representative tests remain. All new tests are status `Proposed; never executed`.
- **Parallel delivery plan:** exact W0–W9 ownership, dependency graph and batches B0–B6 while preserving single complete-module delivery.
- **Validation:** syntax and consistency tests pass; native Foundry, privacy, cross-document recovery, game-system effects, migration and performance tests remain unexecuted.
