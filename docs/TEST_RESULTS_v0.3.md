# Automated Test Evidence — Easy Plots v0.3

**Executed in this workspace:** 2026-10-27; Node.js 22.16.0 using `node --experimental-test-coverage --test tests/*.test.mjs`.

**Result:** 30 passed, 0 failed. (See `node-test-run-v0.3.txt` for the complete TAP output and coverage details.)

**Actual tested behaviors:** typed graph/port validation, scoped memory repository, draft isolation vs published graphs, local GM context guard, fail-closed player request path, allowlisted projections, denied conditions, bounded evaluation, event-to-proposed-effect flow, in-memory journal transitions, uncertain failure verification, evidence milestones, time-window classification, observer-scoped claims and conflicting arc endings.

**Not tested in Foundry:** real document permissions, native persistence, player identity attestation, private delivery, co-GM fencing, in-world ApplicationV2 rendering, Foundry hooks/sockets, actual native effects, migrations and performance at campaign scale.

**Important security caveat:** In-browser local GM client identity checks are not equivalent to an independently authenticated remote player request or server-enforced transaction. Tests do not create those guarantees. Native interfaces remain disabled until the live security probes pass.

**Specification consistency:** `python spec/tools/validate_spec_v02.py` reports 125 decision/test scenario mappings, 97 proposed node types, 50 logical record groups, 28 grouped requirements, and syntactically valid schemas/TypeScript proposals; these are design artifacts, not implemented feature counts.
