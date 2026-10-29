# Easy Plots — scope and code assessment

**Assessment date:29 October2026. Conclusion: the delivered module is incomplete.** The earlier statement that it was ready for a normal Foundry test flight was incorrect. Missing setup/navigation/persistence and unfinished feature paths are implementation work, not merely final compatibility testing.

## What was assessed

The shipped baseline is **v1.13.0-dev, commit2388b62cc0bcb58f3f3a5b8b1feb50be073dc84a**. It is the version the user installed. A separately frozen working snapshot contains unpublished1.13.1-dev changes. BASELINES.json records both inventories and source hashes. No unfinished code was published for this assessment.

The complete matrix is [FEATURE_ASSESSMENT_125.md](FEATURE_ASSESSMENT_125.md), with [CSV](FEATURE_ASSESSMENT_125.csv) and [JSON](FEATURE_ASSESSMENT_125.json) versions. **All125 registered decisions have an individual row**: requested scope, code present, engine/product assessment, missing behavior, shared blockers, access path, immutable source links, local case references, unpublished changes and acceptance still needed.

## Project scope

The explicit user deliverable is one complete Easy Plots module for Foundry v14+, continuing the supplied project, implementing all125 agreed decisions. It must work natively without a required external backend/server. Automated checks belong throughout development; final real Foundry acceptance follows functional completion. The normal GM/player product journey is part of that delivery.

The feature families are graph/rule authoring; publication/activation; GM-approved narrative execution; durable storage and recovery; identities/NPCs; factions/renown/agendas; relationships/debts; truth/beliefs/rumors/disclosures; investigations/deductions; quests/milestones; player contributions/voting; spatial discovery/routes; timelines/time jumps/clocks; encounters/rolls; arc endings/continuity; resources/rebinding/blueprints; planning/forecasts/recaps; GM workspace/attention; player-facing views; diagnostics/search/performance; extensions/migrations; and release qualification.

The125-entry register and28 requirement groups reconstruct that scope from the transfer. **The original full Q1–112 answer wording is not available**: the technical specification itself acknowledges this at line48. Exact historical wording cannot be certified. Proposed97 node signatures are interface proposals, not97 additional user requirements. The assessment does not silently add them to scope or treat an alternate interface as automatically equivalent.

## Main findings

| Area | Code actually present | Missing or incomplete delivery |
|---|---|---|
| Installed entry | API exposes Status, editor and many desks | No shipped toolbar/settings entry; developer console required. Status scrolling fails in the user's native window. |
| Persistent world data | Native repository, graph pages, revisions, indices, journals | Default startup always creates a new memory repository. No first-run native setup or restored configuration; saved sandbox drafts disappear on reload. |
| GM workspace | Focused cockpit, dock/inspector, graph editor and domain desks | No integrated campaign home; many buttons expose services which were never initialized. Ordinary entity/record selection and capability guidance are incomplete. |
| Rules/graphs | Typed edges, branch/join, subgraphs, AST validation, separate publication/activation | Rules are authored through JSON rather than a completed validated user-facing builder. Cyclic support is a specific bounded numeric recurrence, not arbitrary domain cycles. |
| Player actions | Authenticated intake, durable queue, ownership checks, approval transitions | Generic approved requests are not connected through processing/resolution to graph execution. No discoverable queue and complete player action journey. Board edits are a distinct implemented path. |
| Voting | GM ballot records, quorum/deadline/tie calculation and finalized-result views | No player cast-vote UI/submission path; no complete runoff journey; configurable offline policy is not established. |
| Player portal/sharing | Allowlisted quest/recap/vote-result/board projections and transports | Players must supply exact publication and Actor IDs. No normal discoverable journal/opportunity feed. Trusted observer/recipient mappings and service starts require developer setup. |
| World/narrative domains | Substantial bounded services for identities, factions, knowledge, investigations, time, spatial regions, arcs and forecasts | Presence of those services does not supply integrated creation/editing/sharing screens. Feature-specific constraints and unimplemented paths are listed per decision. |
| Resources | Shell creation, bindings, provenance, batches, lifecycle checks and reverse references | Inspector is read/audit only; guided rebind/recovery authoring is not complete. Batches are bounded/non-atomic and do not implement general rollback. |
| Storage confidentiality | Ownership checks and a caller-supplied exact-world attestation gate | Repository flags contain plaintext logical keys/payloads. Actual hostile-client confidentiality is not established. Existing encrypted Chat/Journal publication shells do not encrypt the entire repository. No shipped encrypted vault exists. |
| Migration/recovery | Revision history, original-effect reconciliation and a migration registry/audits | Registry has no built-in application migrations or general reconciliation-to-completion path after an uncertain migration. Installed recovery management remains incomplete. |
| Native rules/performance | Authored d20/opposed rolls, system policy declarations, bounded caches/scheduler | Declaring a system/version does not implement that game's rules. Native compatibility, concurrency and representative large-world performance are unaccepted. |
| Completion reporting |125 review records, traceability tooling and1,147 historical passing local cases | Functional gate checked declared service closure, not complete installed user workflows. It returned ready while major product paths were missing. That conclusion is withdrawn. |

## Why the earlier assessment was wrong

Most native tests construct services directly with a prepared mock Compendium, trusted callbacks and synthetic attestation. They validate behavior **after** setup is already supplied. They do not prove that an installed user can obtain setup, persist a plot, reload it, receive a player request and finish the review/effect journey through the interface.

Likewise, matching an ADR to code/test references does not establish its full behavioral requirement. Several review rationales equated narrower services with broader user-facing features. The player voting and generic intent-execution gaps demonstrate this. There was also no acceptance requirement in the old functional gate for a fresh-world, console-free product journey.

The earlier engineering reports remain historical evidence of particular local cases. They must not be used as a product-completion certificate. No completion percentage or batch/hour estimate is supportable from these counts.

## Evidence and confidence

This is a static code/entry-path assessment across the125 registered items, supported by prior case-level records and narrow rechecks. It is not a new successful execution of125 real Foundry scenarios or a line-by-line security certification of every source file. Source citations are immutable links to the shipped commit. All matrix test references were checked against the shipped1,147-case evidence file. The full shipped suite was not rerun for this read-only review.

Direct user observations establish the missing launcher, unusable scrolling and uninitialized-service warning. The unpublished focused recheck produced27 passes and1 failure across28 cases; that failure is retained. Untested code and standalone sample-data mockups are not counted as completed features. See [UNPUBLISHED.md](UNPUBLISHED.md).

Where the matrix says no additional feature-specific absence was established, it means precisely that; it does not mark the feature complete. Shared product integration and native acceptance remain separately recorded.

## Required completion sequence

1. Establish a truthful, usable first-run native storage and permission workflow; restore it after reload and never silently substitute temporary memory storage.
2. Integrate GM navigation, ordinary entity/record selection, capability states and player discovery/sharing. Finish missing rule/voting/intent/rebind/migration workflows identified in the matrix.
3. Demonstrate one complete installed journey: GM opens the module without the console, creates and saves a plot, reloads it, publishes/activates it, shares a permitted player view, receives a player action, reviews and executes it once, and observes the durable result after reload.
4. Complete each feature-specific acceptance case with positive and failure/recovery paths. Then perform native multiplayer/privacy/handover/migration/load qualification for the exact advertised environment.

The proposed GM workspace/editor/player screenshots are [design previews](../../design/gm-player-preview.html) with sample data. They are not finished screens hidden in the distributed module.
