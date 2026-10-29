# v0.13 implementation status and traceability note

## Source increments during uninterrupted implementation pass

- v0.9: `domains/domain-store.mjs`, `factions.mjs`, `relationships.mjs`, `investigations.mjs`; 10 new domain regression tests.
- v0.10: `crossplot.mjs`, `continuity.mjs`, `blueprints.mjs`, `simulation.mjs`; 8 more tests.
- v0.11: `runtime/domain-providers.mjs`, native integration registration, provider registry access controlled by provider; 4 integration/provider tests.
- v0.12: `scheduler.mjs`, `identity.mjs`, `locations.mjs`, `session-planner.mjs`; 6 new regression tests.
- v0.13: typed authorable faction/obligation/evidence nodes, router mapping, approval identity checks; 3 end-to-end integration tests.

## Engineering claims

All 125 architectural decisions remain the target; 125 spec scenarios are **not** 125 passing Foundry acceptance tests. New domains contain real pure evaluators and/or native-backed effect capabilities but not every feature's final UI or complete automation. The integrated native path retains GM approval and prevents accidental cross-faction truth disclosure. No automatic effect executes merely because a story node becomes eligible.

## Still missing, material

- Complete implementation of the 97 proposed node-provider catalog and equivalent authoring/inspector affordances.
- Expanded full narrative document models/indices for many-domain instances and knowledge partitions.
- Dedicated GM/player experiences for faction management, investigation boards, quest planner, world map, campaign arc closure, forecaster, blueprint composer, and simulation UI.
- System-specific adapters for D&D roll activities and other supported game systems.
- Full historical reconciliation, migration flows, protection proof, co-GM distributed conflict handling.
- Complete Foundry world-level integration and end-to-end test plan, to be performed after implementation is complete.

Do not mark these items complete based only on specification entries or the presence of helper functions.
