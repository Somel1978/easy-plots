# Easy Plots — Implementation Delta v0.29–v0.41

These thirteen versions are **incremental coding checkpoints**, not separate releases. The project target is one complete 125-decision Foundry v14+ module. Tests are internal debugging aids. The user will perform complete Foundry/world end-to-end testing once implementation is finished.

## Implemented and connected

| Versions | Source | Capability | Integration |
| --- | --- | --- | --- |
| 0.29 | `src/orchestration/knowledge-propagation.mjs` | GM-only bounded communication graph, delayed claim propagation, recipient visibility, explicit distortion provenance, no automatic truth merging | GM planning lab + GM-only preview API |
| 0.30 | `src/orchestration/faction-orchestration.mjs` | Indexed faction agenda eligibility, faction knowledge prerequisites, causal pressure-clock advancement | GM planning lab + GM-only preview API |
| 0.31 | `src/orchestration/campaign-closure.mjs` | Multidimensional arc-ending eligibility, exclusive conflict/unknown coverage, unresolved-thread preservation | GM planning lab + GM-only preview API |
| 0.32 | `src/orchestration/resource-reconciliation.mjs` | Resource/reference integrity classification, verified candidate rebinding proposals, nondestructive retirement proposals | GM planning lab + GM-only preview API |
| 0.33 | `src/ui/planning-lab.mjs` | Four new interactively editable JSON preview modes | ApplicationV2 DOM + Node integration tests |
| 0.34 | `src/orchestration/decisions.mjs` | Quorum/deadline vote planning, deduplicated ballots, tie review, final disclosure projection | GM planning lab + GM-only preview API |
| 0.35 | `src/orchestration/investigation-milestones.mjs` | Evidence-linked shared milestone qualification, participant contribution attribution, one-time completion and approved disclosure | GM planning lab + GM-only preview API |
| 0.36 | `src/orchestration/persistent-plans.mjs`, `src/domains/domain-store.mjs` | Native-compatible revisioned GM-only planning records and distinct acknowledgement | Revisioned repository / contract tests |
| 0.37 | `src/platform/native-integration.mjs`, `src/bootstrap/index.mjs` | Planning records wired to protected native integration and GM-only API | Native-compatible mocked repository regression tests |
| 0.38 | `src/ui/planning-lab.mjs` | Save / acknowledge planning previews in the GM interface | Chromium DOM save/review test |
| 0.39 | `src/graph/logic-nodes.mjs` | Ten additional versioned, bounded logic nodes: faction claim, NPC agenda, deadline, route, continuity, hypothesis, causal provenance, faction standing, milestone branch, disclosure branch | Editor + publication validation + router + Chromium authoring |
| 0.40 | `src/orchestration/knowledge-revisions.mjs` | Observer-specific claim corrections, historical provenance retention, scoped dependency invalidation and review-only effects | GM planning lab + persistence preview mode |
| 0.41 | Milestone/closure bug fixes | Verification events must be explicitly authorized; unknown competing endings block closure | Targeted regression tests |

## Validation results

- **372 Node tests passed** in v0.41; none failed.
- `npm run check` completed including syntax checks.
- Chromium DOM editor, GM approval/event review, investigation board, GM cockpit, and planning laboratory tests passed, including save/acknowledge of a GM-private planning record.
- `npm run spec:check` passed for 125 decision-specific *proposed* acceptance scenarios, 97 *candidate* node provider descriptions, and 50 logical record groups.

## Important coverage distinctions

- The graph editor has **61 built-in authorable node types** with typed runtime contracts, up from 51 in v0.28. They do **not** imply all 97 conceptually cataloged specialized node behaviors are implemented.
- The orchestration functions above are predominantly **GM-review planners**, not effects; their output can be persisted but must not be treated as authoritative world mutations without the previously established journaled execution path.
- Native Foundry v14 live runtime, all game-system adapters, full cross-domain orchestration, extensive specialized UIs, migration testing and multi-GM correctness remain to be implemented or verified in the final completed module.
- No Foundry proprietary source is included in these packages.
