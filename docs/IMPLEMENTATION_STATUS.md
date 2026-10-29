# Easy Plots — integrated development status v1.13

All 125 architectural decisions remain required. Implementation is incomplete; this checkpoint does not initiate the final Foundry test phase.

- Typed event/state values, comparisons, boolean branches and immutable pure data-subgraph interfaces are integrated with editor, publication, routing and GM review. State-dependent branch evidence is revalidated before effect execution.
- Protected opposed native d20 checks and Combat/Chat observations are integrated with the verified native subsystem. System-specific mechanics and real Foundry behavior are not certified.
- 834 actual Node cases pass, specification/traceability and evidence checks pass, and Chromium UI workflows pass. See current v1.13 logs and `IMPLEMENTATION_DELTA_v1.13.md`.
- Critical native intake now persists before admission loss. Explicit recovery reconciles existing journals, retains uncertainty and never automatically repeats accepted events. Configured native-source checkpoints detect metadata drift without inventing missing occurrences.
- The GM reliability window integrates policy and recovery review; critical intake and pending-index capacity are bounded. Startup is asynchronous and cancellable while loading policy.
- Own protected-storage Journal Hooks are excluded before intake, preventing storage feedback. Cross-event convergence for arbitrary mutually reactive narrative rules remains incomplete.
- New native/manual/due events declare version 1.0.0 and verified canonical documents. Parent events must already exist; unknown versions are rejected. The proposed schema and its version fingerprint are pinned independently of UI source. Unversioned historical records remain unmodified.
- Fiction, recorded execution and observer-knowledge timelines now have separate bounded arc/time/observer indexes, causal ordering and revision-bound pages. Legacy dates are not inferred.
- Native disclosure timestamps prevent retroactively treating recently disclosed information as already known; player projections and faction rules enforce the same boundary.
- Reviewed concluded-arc archives retain exact historical revisions incrementally, resume after interruption and serve a lazy GM summary. History selection is explicit and bounded; sources remain retained.
- A translated GM history window integrates chronology authoring/query and the complete archive job lifecycle. Chromium exercises it with the real local services.
- Canonical domain effects now feed quests/faction agendas/relationship history; exact immutable revisions support reviewed narrative corrections. Conflicting old effect records require explicit adoption.
- Graph layers and density are view preferences. Grounded persistent forecasts withhold stale hypotheses. Local committed-event updates refresh focused GM views.
- Shared dock/inspector/canvas focus supports protected persistent GM pins, configured passive scene focus and expiring attention distinct from pinned significance. Unsaved canvas work is preserved during focus changes.
- Mixed-priority task admission is bounded and fair; expensive tasks lower concurrency. Anonymous sampled diagnostics are disabled by default and bounded when enabled.
- The 97-contract audit lists 7 locally tested contract mappings and 90 candidate contracts awaiting individual semantic review. Existing domain services remain available; these figures are not a count of implemented decisions or missing end-user features.
- All 125 decisions have individual source observations in `DECISION_SCENARIO_REVIEW.csv`, checked against 834 actual case results and a fingerprint including normative specification inputs. 79 observations have related demonstrated evidence and 46 remain partial. These categories do not measure complete decisions or total absent functionality. The original Foundry acceptance scenarios remain proposed, never executed.
- Remaining work includes mixed effect/data subgraphs, approval/budget/operation graph contracts, domain typed read/output providers, complete GM/player workflows, system adapters, remaining UI localization, migration/repair/qualification and the deferred real-world test suite.

Historical status v0.7 is preserved as `IMPLEMENTATION_STATUS_v0.7.md`. Historical specifications/deltas must not override the current code or imply completed implementation.
