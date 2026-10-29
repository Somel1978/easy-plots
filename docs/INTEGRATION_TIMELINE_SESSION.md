# ADR-039 and ADR-051 integration

The new services use existing `timeline`, `review-plan`, and `gm-focus` domain
types. No domain-store catalog change, effect provider, trigger, player DTO, or
new storage partition protocol is required. Existing `PersistentGMPlans`, graph
simulation, chronology, and `PersistentSessionHandoff` remain intact.

## Central wiring

Bootstrap imports, the two GM UI launchers and the twelve API wrappers below are
implemented in `src/bootstrap/index.mjs`. Native construction/return and launcher
consolidation belong to the integration agent; do not duplicate the bootstrap API
entries. The following snippets specify that composition precisely.

In `src/platform/native-integration.mjs`, import:

```js
import {PersistentTimelineBranches} from '../orchestration/persistent-timelines.mjs';
import {PersistentSessionPreparation} from '../orchestration/persistent-session-preparation.mjs';
```

After constructing `gmFocus` (the existing `indexedGraphs`, `domains`, and
`gmProvider` are already in scope), construct:

```js
const timelineBranches = new PersistentTimelineBranches({domains});
const sessionPreparation = new PersistentSessionPreparation({
  domains, focus: gmFocus, registry: indexedGraphs, gmProvider
});
```

Add `timelineBranches` and `sessionPreparation` to the returned frozen integration
object beside `plans,sessionHandoffs`. There are no bootstrap writes or hooks.

In `src/bootstrap/index.mjs`, import:

```js
import {makeGMTimelineBranchWindow} from '../ui/timeline-branch-desk.mjs';
import {makeGMSessionPreparationWindow} from '../ui/session-preparation-desk.mjs';
```

Create normal GM-gated window functions alongside `openSessionHandoff`:

```js
const openTimelineBranches = () => {
  gmOnly();
  if (!integration?.timelineBranches) throw new EasyPlotsError(
    'STORAGE_NOT_CONFIGURED', 'Protected timeline storage required');
  const Window = makeGMTimelineBranchWindow(Base, {
    gameInstance: game, service: integration.timelineBranches
  });
  const app = new Window(); void app.render(true); return app;
};
const openSessionPreparation = () => {
  gmOnly();
  if (!integration?.sessionPreparation) throw new EasyPlotsError(
    'STORAGE_NOT_CONFIGURED', 'Protected session preparation required');
  const Window = makeGMSessionPreparationWindow(Base, {
    gameInstance: game, service: integration.sessionPreparation,
    openHandoff: openSessionHandoff
  });
  const app = new Window(); void app.render(true); return app;
};
```

Export both functions through the existing module API and expose their launch
buttons through the status/cockpit launcher in the same manner as the existing
Session Handoff and Planning Lab. The callback only opens Handoff; it never copies
private notes or approves a recap.

The implemented GM-only API wrappers use the established `gmOnly()` and
integration-presence guard pattern, forwarding the argument object unchanged:

| API name | Exact service method |
| --- | --- |
| `readTimelineBranches(spec)` | `timelineBranches.read(spec)` |
| `readTimelineBranchVersion(spec)` | `timelineBranches.version(spec)` |
| `createTimelineBranches(spec)` | `timelineBranches.create(spec)` |
| `saveTimelineBranchVersion(spec)` | `timelineBranches.branch(spec)` |
| `selectCanonicalTimelineBranch(spec)` | `timelineBranches.selectCanonical(spec)` |
| `readCanonicalTimelineBranch(spec)` | `timelineBranches.canonical(spec)` |
| `readSessionPreparationPins()` | `sessionPreparation.pins()` |
| `pinSessionPreparationPlots(spec)` | `sessionPreparation.pinPlots(spec)` |
| `prepareNextSession(spec)` | `sessionPreparation.prepare(spec)` |
| `readSessionPreparation(spec)` | `sessionPreparation.read(spec)` |
| `editSessionPreparation(spec)` | `sessionPreparation.edit(spec)` |
| `inspectSessionPreparationSources(spec)` | `sessionPreparation.sourceStatus(spec)` |

## Timeline contract

`create({scope,timelineId,branchId,label,sourceRefs,sourceEventId})` reads only
explicit `{id,revision,key}` canonical `world-fact` refs whose status is asserted,
active, or established and whose `value` exists. It retains those exact revisions.
The initial branch observes actual truth and is the single canonical selection.

`branch({scope,timelineId,branchId,parentBranchId,parentVersion,label,hypotheses,
rules,maxPasses,expectedRevision,sourceEventId})` reuses `runIsolatedWhatIf` over
the exact immutable parent outcome. A fresh ID forks; the same branch ID must
extend its current head. Every version has an exact parent, source revisions,
causal preview, and independent immutable identity. The canonical pointer stays
on its selected version when that branch gains another version. Bounds: 12
branches, 32 versions per branch, eight fork levels, 24 fact keys, and the existing
what-if rule/pass budgets. Saving a branch never applies facts or creates events.

`selectCanonical({scope,timelineId,branchId,version,sourceRefs,expectedRevision,
reviewEventId})` observes current canonical sources. Every projected fact must
already equal the selected branch outcome. Existing keys cannot be remapped to
different fact IDs. New derived keys need their own actual canonical fact refs.
Selection only changes one versioned pointer; it cannot establish facts. The
ordinary authored graph/effect approval/journal pipeline must establish changed
truth first. The integration test executes that real pipeline before selection.
Budget-exhausted simulations cannot be selected.

`canonical({scope,timelineId})` verifies the selected source revisions again.
Changed truth yields `status: 'canonical-sources-changed', facts: null`; the service
does not present a cached hypothetical result as live truth. Canonical selection
and world-fact updates are distinct documents, with no invented cross-document
transaction guarantee. Historical branch sources remain attributable.

An interrupted version save can leave a harmless unattached immutable version.
Retry the original request; changed content under that identity fails closed.
An acknowledgement lost after the root save requires reloading the root; callers
must not replay with a new expectation without reviewing the saved result.

## Session contract

`pinPlots({graphIds,expectedFocusRevision,sourceEventId})` loads only the named
active graph IDs (maximum eight), recording exact publication and activation
revisions in the current GM's existing focus record. It does not change the one
current editor/canvas focus pin. `pins()` returns its preference revision and refs.

`prepare({scope,sessionId,title,sourceRefs,expectedRevision,expectedFocusRevision,
sourceEventId})` requires saved pins. Every optional source is an explicit
`{plotId,type,id,revision}` associated by the GM with one pinned plot. Maximum 24
refs; no campaign scan, dependency expansion, all-active query or automatic graph
activation. Active publications and exact narrative source revisions are checked,
retained, and rechecked before saving. `createSessionBrief` supplies the familiar
sections. Narrative source types are explicitly allowlisted in the service.

The saved `review-plan` has `kind: 'session-preparation-v1'`,
`state: 'editable-gm-preparation'`, exact source observations and the GM owner.
It cannot enter `PersistentGMPlans.acknowledge/stageSubmission`. A preparation
never grants the effects or publication approval of other workflows.

`edit({scope,sessionId,expectedRevision,sourceEventId,notes,agenda})` saves bounded
GM notes and up to 16 agenda entries `{id,text,referenceIds}`. References must name
selected sources, plots, or previously authored agenda refs retained across an
explicit source refresh. Stale preparations remain editable. Refresh requires the
GM to select current source revisions explicitly and preserves notes/agenda.
`sourceStatus({scope,sessionId})` reports changed pins, plots and narrative sources
without silently refreshing the saved observations or changing any world record.

No player projection is added. To publish a recap the GM uses the existing
separate Handoff editor, explicit recipients and approval. The preparation's
notes and source IDs are never automatically included.

## Focused evidence and remaining qualification

Actual focused Node run before UI additions: 32 PASS, 0 fail/skip, using
`node --test --test-isolation=none` with these exact files:
`tests/persistent-timeline-branches.test.mjs`,
`tests/persistent-session-preparation.test.mjs`,
`tests/persistent-gm-focus.test.mjs`, `tests/advanced-domains.test.mjs`,
`tests/persistent-plans.test.mjs`.

Final focused Node run after UI additions: **59 PASS, 0 fail/skip**, with all the
above exact files plus `tests/timeline-session-desks.test.mjs`,
`tests/published-graph-simulation.test.mjs`,
`tests/persistent-session-handoff.test.mjs`, and
`tests/persistent-chronology.test.mjs`. The UI cases exercise both windows against
the actual new services and protected memory domain store, including canonical
selection rejection, explicit pins, note editing, source parse errors, separate
Handoff launch and authority revocation. `node --check src/bootstrap/index.mjs`
also passed after adding the two launchers and API methods.

After native composition, `tests/native-timeline-session.test.mjs` added two
synthetic Compendium regressions using the reusable exact-ID fixture in
`tests/helpers/native-world.mjs`. Both passed, with **17 PASS, 0 fail/skip** across
that native file plus the three new focused service/UI test files. The native
cases retain branch lineage and source-proven selection through full integration
reconstruction, run an actual approved graph fact effect, preserve session pins
and editable notes across restart/explicit refresh, reject another GM's
preparation, and prohibit campaign query/list enumeration. This is Node adapter
evidence; the fixture's supplied permission attestation is synthetic.

Coverage includes real published graph -> proposal -> explicit GM approval ->
journaled canonical fact update -> canonical selection, hypothesis isolation,
restart/version history, immutable interrupted version recovery, branch/depth/
version budgets, source substitution/staleness, exact pinned active publications,
no enumeration, editable preparation after drift, private ownership and authority
loss during awaited graph reads. Native composition, consolidated launchers and
actual Chromium/Foundry-world execution are owned by the integrating agent; no
claim of real Foundry qualification is made here. Branches are versioned isolated
fact-state alternatives. The existing chronology service retains its distinct
fiction/execution/observer-learning axes; no branch invents timestamps, native
events, or changes to that canonical chronology. Published-graph what-if remains
available through the existing separate simulator and Planning Lab.
