# Qualification, traceability and compatibility integration

ADR-120, ADR-122 and ADR-124 are implemented by `tools/qualify.py` and the standard-library engine in `tools/qualification/qualification.py`. The tools execute no Foundry world, perform no network work, and add no runtime module dependency. They distinguish engineering implementation review, actual local regression execution, and final native acceptance.

The authoritative scope remains the **125 agreed decisions**, their **28 requirement groups**, and their acceptance scenarios. The **97 candidate node contracts are proposed interfaces**, not 97 extra user requirements. Every candidate retains its original signature and maps to actual nodes/services with an explicit semantic assessment and deviation. A reviewed alternate service/interface is not advertised as literal candidate-ID or port-signature equivalence.

## Commands

Run from the workspace root with the installed Node and Python executables:

```bash
node --test tests/qualification-tools.test.mjs
python tools/qualification/refresh_reviews.py
npm run check
python tools/qualify.py
python tools/qualify.py --check
python tools/qualify.py --trace ADR-033
python tools/qualify.py --gate functional
python tools/qualify.py --gate release
```

The focused file contains **4 actual Node cases**, including **20 internal Python integrity/regression checks**, plus the transitive native import/dependency invariant in its fourth Node case. Internal assertions are not added to the Node case count. `npm run check` remains the sole full-suite evidence producer. The qualification tool never overwrites `docs/local-test-evidence-*.jsonl`.

`--check` checks generated report freshness and input validity. A deliberately blocked native release is a reported result, not a failure of this tooling check. `--gate functional` returns 1 until every agreed decision has substantiated engineering closure and the current complete local suite passes. The agreed ADR-021 native-window-only remainder is allowed for entry into the final testing phase. It still requires its final native scenario. `--gate release` returns 1 until each advertised exact environment has full passing native evidence and the semantic mapping reviews remain current. Invalid inputs return 2.

Root may add these optional package scripts:

```json
{
  "qualification:report": "python tools/qualify.py",
  "qualification:check": "python tools/qualify.py --check",
  "qualification:functional": "python tools/qualify.py --gate functional",
  "qualification:release": "python tools/qualify.py --gate release"
}
```

## Engineering closure records

`tools/implementation-closure.json` contains **125 concrete decision reviews** and **97 candidate mapping dispositions**. Each decision review records a concrete rationale, selected test references, and SHA-256 snapshots of relevant runtime/tool and test files. Missing reviews, altered files, missing executed cases, or an individual observation still saying partial/gap are visible blockers. **`evidence-present` never becomes implementation closure automatically.** The pre-existing `tools/decision-review.json` remains root-owned; update its individual observation only after reviewing the corresponding integrated change.

Statuses for decisions are `implemented`, `open`, and `final-native-only`. The last is reserved for ADR-021. Candidate statuses are `equivalent`, `implemented-with-documented-interface`, `mapping-reviewed-with-explicit-limits`, or `open`. Current candidate dispositions use `mapping-reviewed-with-explicit-limits`: they substantiate the trace and explain alternate workflows, while explicitly withholding a claim that every proposed typed port exists. A partial proposed interface cannot be labeled equivalent. A missing arbitrary proposed port alone does not reopen an agreed decision whose functional semantics are implemented through the reviewed service.

Create an individual record after source review:

```bash
python tools/qualify.py --snapshot-review ADR-099 \
  --status implemented \
  --rationale 'Reviewed the exact planned/materialized/active resource lifecycle and the independent consumer guards.' \
  --source src/orchestration/resource-manifests.mjs \
  --test 'tests/resource-manifests.test.mjs::planned resources require journaled materialization'
```

This prints JSON; integrate it into `reviews`. The Python API is also available:

```python
from pathlib import Path
import sys
sys.path.insert(0, 'tools/qualification')
from qualification import make_review
record = make_review(Path.cwd(), decision_id, status, rationale, source_files, tests)
```

Use `contract=True` and `interface_resolution=...` for a candidate mapping record. The helper snapshots named implementation files plus every referenced test file. It makes no acceptance or native execution inference.

When root has reviewed the final integrated edits, inspect stale snapshots and deliberately refresh the existing records:

```bash
python tools/qualification/refresh_reviews.py
python tools/qualification/refresh_reviews.py --refresh --all-reviewed \
  --reason 'Reviewed final integrated runtime and focused native regressions before final whole-suite execution.'
```

Use repeated `--id ADR-099` or `--id easy-plots.resources.native-resource-plan` instead of `--all-reviewed` for a narrower refresh. This command changes fingerprints only after an explicit engineering selection and records the reason/time. It does not change statuses, rationales, test mappings, or native evidence. **Review changed sources first; refreshing hashes does not perform engineering review.** This is an engineering operation already authorized by the implementation task, not a user permission step.

After final runtime/test integration, run the complete suite again, then regenerate the existing review/coverage reports and the qualification reports. Tool/review data changes do not fabricate a new local execution: each normalized executed case still carries the original run's actual `sourceDigest`, file, name, line, deterministic case ID, and test-file SHA-256. A changed runtime/test/spec/package fingerprint invalidates that run's current-case use. Qualification configuration and tooling have a separate input fingerprint, avoiding a self-referential test-log digest.

## Reports

- `docs/QUALIFICATION_STATUS.json`: scope, independent gate states, exact current fingerprints, missing/open reviews, stale/current local evidence, selected native runs, and explicit absence of a completion percentage.
- `docs/FULL_SCOPE_QUALIFICATION.csv`: every TEST-ADR scenario and expected observation, linked requirements/candidates, engineering state, actual current local case IDs, and native status.
- `docs/SEMANTIC_CONTRACT_TRACE.csv`: all97 unchanged proposed signatures, actual default ports, concrete service entrypoints, semantic mapping, deviations, mapping disposition, and a separate signature-equivalence claim. Cases related only by source membership are explicitly labeled **not equivalence proof**.
- `docs/QUALIFICATION_EXECUTED_CASES.csv`: selected actual executed cases and their run/file fingerprints. No cases are synthesized from ADR labels, module counts or node counts.
- `docs/BIDIRECTIONAL_TRACEABILITY.csv`: forward and inverse links among decisions, requirements, proposed named contracts, candidate nodes, implementation services/nodes, scenario IDs, actual local cases and selected native runs. Named spec contracts and candidate node IDs remain distinct entities.
- `docs/TRACEABILITY_CONTRADICTIONS.json`: missing inverse requirements, mismatched acceptance IDs/domains, unknown/duplicate IDs, unavailable mapped nodes/services, missing semantic assessments, implementation-observation conflicts, and invalid imported native evidence.
- `docs/RELEASE_COMPATIBILITY_MATRIX.csv`: exact environment targets, selected current native runs, passed scenario/dimension counts and explicit blockers. These counts describe evidence, not completed product percentages.

The older coverage reports remain an inventory and are not relabeled as complete semantic equivalence. The new semantic supplement corrects obsolete service descriptions, including mixed subgraphs, verified operation continuation, source-proven alternate timelines, multi-plot preparation, spatial atlas, publication preflight and resource lifecycle.

## Final native evidence import

**Do not run final Foundry qualification until the functional gate passes.** This implementation has not executed any final real-world Foundry scenario. Node native adapters and Chromium DOM tests remain local tests. The manifest `minimum/verified: 14.369` fields are the author's requested declaration convention; they are never treated as actual executed compatibility proof.

`tools/qualification/plan.json` lists 12 explicit native cross-cutting dimensions and compatibility targets. The initial target records core14/build369 but leaves system/browser/platform unknown, so its compatibility claim must remain `not-established`. Before claiming compatibility, specify the exact core version/build, system ID/version, browser and platform that were actually tested. No wildcard or unspecified environment can qualify; testing one tuple never certifies another build/system/browser/platform.

After authorized final tests, add selected current native evidence JSON paths to `native_evidence_files`. A run uses this schema (illustrative fields only; this is **not** an executed evidence file):

```json
{
  "run_id": "unique-native-run-id",
  "environment_kind": "native-foundry",
  "release_version": "1.13.0-dev",
  "source_digest": "the actual current runtime/test/spec/package SHA-256",
  "executed_at": "an actual timezone-qualified execution timestamp",
  "operator": "the engineer who executed and reviewed the observations",
  "environment": {
    "core_version": "14",
    "core_build": "369",
    "system_id": "the exact tested system",
    "system_version": "the exact tested version",
    "browser": "the exact tested browser/version",
    "platform": "the tested host/client platform"
  },
  "scenarios": [
    {
      "id": "ADR-001",
      "outcome": "pass",
      "observed": "A concrete observed result describing the actual native behavior and relevant authorization boundary.",
      "artifacts": [
        {"file": "repository-relative retained observation/capture path", "sha256": "actual artifact SHA-256"}
      ]
    }
  ],
  "dimensions": [
    {
      "id": "observer-confidentiality",
      "outcome": "pass",
      "observed": "A concrete actual multi-client confidentiality observation supported by the retained capture.",
      "artifacts": [
        {"file": "repository-relative retained capture path", "sha256": "actual artifact SHA-256"}
      ]
    }
  ]
}
```

Retain substantive observation text and nonempty fingerprinted artifacts for **every** passed/failed/blocked case. Imported records are reviewed execution evidence supplied by the engineer; the tool does not independently attest that an arbitrary JSON file came from Foundry. Mock environment labels, future timestamps, stale source/version/artifact fingerprints, missing observations, unknown/duplicate cases and missing artifacts are refused. Retain prior runs for audit, and select the applicable current qualification runs explicitly in the plan.

A target can qualify only with every agreed125 decision scenario and every required native dimension passing in that **same exact environment**, current local execution, reviewed functional closure, current semantic mappings, and no contradictory or failed/blocked selected evidence. A pass in another environment or another run does not erase a selected failure. Initial absent evidence stays absent; do not manufacture native results to open the release gate.
