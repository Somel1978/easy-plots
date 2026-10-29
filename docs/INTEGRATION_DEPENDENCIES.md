# ADR-058 / ADR-078 / ADR-119 integration

Implemented modules:

- `src/graph/graph-dependencies.mjs`: `GraphDependencyResolver`, `CoreNodeContractCatalog`, `executionFingerprint`.
- `src/graph/compiled-graph-cache.mjs`: bounded LRU of immutable static node/flow/incoming/data indexes. No evaluation, state, roll, visit, guard or join values are cached.
- `src/graph/publication-preflight.mjs`: blocker/warning/required-coverage report. Unavailable effect providers and secret execution disclosure paths block publication; warnings need acknowledgement.
- `src/graph/persistent-validations.mjs`: repository-backed candidate evidence, lazy selective drift checks and immutable sidecars for explicit legacy adoption.
- `src/ui/graph-preflight-desk.mjs`: GM report renderer and validation/adoption window.

## Native composition (root owns this wiring)

Use lazy closures because providers, actions, batches and resource manifests are constructed after the registry. All callbacks below are read-only and must keep the existing designated-GM fences. The native repository already provides fenced writes; also pass `writer` to validation service.

```js
import {assertSupported} from '../graph/persistent-registry.mjs';
import {GraphDependencyResolver} from '../graph/graph-dependencies.mjs';
import {CompiledGraphCache} from '../graph/compiled-graph-cache.mjs';
import {PublicationPreflight} from '../graph/publication-preflight.mjs';
import {PersistentGraphValidations} from '../graph/persistent-validations.mjs';

let graphPreflight,graphValidations;
// Add to the existing PersistentGraphRegistry constructor:
// preflight:()=>graphPreflight, validations:()=>graphValidations

const graphDependencies=new GraphDependencyResolver({
  providers:()=>providers, extensions:()=>extensions, actions:()=>actionAPI,
  readPublished:(id,version)=>graphRegistry.getPublished(id,version),
  readPublishedManifest:snapshot=>graphValidations.publishedManifest(snapshot),
  externalDependencies:async({node,graph,providerId,providers})=>{
    // See the source checks immediately below. Return null for other providers.
    return sourceDependencies(node,graph,providerId,providers);
  }
});
graphPreflight=new PublicationPreflight({
  dependencies:graphDependencies,
  validateSupported:(graph,{capabilities})=>assertSupported(graph,{
    capabilities,extensions,maxBytes:pageStore?850000:44000
  }),
  externalChecks:async({graph})=>{
    // Independently check each native batch/activation source in this candidate.
    // Return {issues:[],coverage:[{id:'native-source-contracts',
    // status:'passed',checked:count,total:count}]} on complete success.
    // Failures require actionable blocker issues; no effect/apply is called.
    return sourceCoverage(graph);
  }
});
graphValidations=new PersistentGraphValidations({
  repository,gmProvider,scope:graphRegistry.scope,writer,
  dependencies:graphDependencies,preflight:graphPreflight
});
const compiledCache=new CompiledGraphCache({dependencies:graphDependencies});
// Existing DurableReactiveRouter constructor gains:
// compiledCache,
// dependencyManifestReader:snapshot=>graphValidations.publishedManifest(snapshot)
```

`externalDependencies` returns `null` or `{dependencies:[],issues:[]}`. Each dependency is `{kind:'provider'|'external',id,version,fingerprint}` with a SHA-256 fingerprint. Provider dependencies should use `providers.contract(id)` (rename its returned `fingerprint` directly). Issues require `{severity:'blocker'|'warning',code,message,remediation,nodeId?}`. This callback runs on cache hits/current-validation checks as well as initial validation, so unavailable or changed immutable sources cannot reuse old validation.

For `narrative.execute-ordered-native-batch`, call `nativeBatches.preview(node.data.payload)` to verify its exact immutable pointer. Require `preview.plan.data.graphId===graph.id`; include the plan as `{kind:'external',id:'native-batch:'+scope+':'+plan.id,version:String(plan.revision),fingerprint:plan.data.fingerprint}`. For every `plan.data.steps` entry, require its exact available `providerVersion` and include the current provider contract. Preview validates the existing allowlist and typed payloads and does not apply native effects. Do not include mutable run/cursor/journal outcome in static dependency identities: these are checked by the existing batch execution/reconciliation service.

For `narrative.activate-resource-manifest`, call `resourceManifests.read({scope:payload.scope,id:payload.manifestId})`. Require schema version 1, exact `spec.graphId===payload.graphId`, and the payload's fixed manifest identity. Include immutable `{kind:'external',id:'resource-manifest:'+scope+':'+id,version:'1',fingerprint:row.data.specFingerprint}`. Read the immutable `row.data.spec.batch` through `nativeBatches.read`, verify revision/fingerprint and include its plan/step provider contracts as above. Dynamic `expectedManifestRevision`, `publishedVersion` and `expectedActivationRevision` can be typed event bindings; keep mutable lifecycle/active native verification in resource-manifest proposal/effect guards. This avoids a static manifest becoming stale because its own approved lifecycle advanced.

`externalChecks` returns `{issues,coverage}`. Coverage rows require `{id,status:'passed'|'blocked'|'unavailable'|'not-applicable',checked,total}`. When a candidate contains batch/manifest provider nodes, preflight requires `native-source-contracts` passed with checked/total exactly equal to that candidate's source-node count. Root can share one helper with `externalDependencies`; every failure must be represented as a blocker or thrown. Optional additional projection source checks can use extra coverage rows. These callbacks must neither create documents nor invoke native apply/evaluate.

Pass `capabilities` consistently to validation/publication/activation/cache when a deployment uses nonempty `requiredCapabilityIds`. The current router cache call supplies the default empty capability set.

## Registry and editor hooks already applied

`PersistentGraphRegistry` accepts optional lazy `preflight` and `validations` constructor options. With validations configured, publish requires durable current evidence and activation requires a current embedded/adopted manifest. `getPublished` remains readable for historical snapshots. Paged snapshots persist/reconstruct dependency metadata without changing old snapshot fingerprints.

Registry methods (also forwarded by `IndexedGraphRegistry`):

```js
await registry.inspectValidation(graphId,{capabilities:[]});
await registry.validateCandidate(graphId,{
  expectedRevision:draft.revision,
  expectedValidationRevision:previousEvidence?.revision??null,
  capabilities:[]
});
await registry.publish(graphId,{expectedRevision:draft.revision,acknowledgeWarnings:true});
await registry.adoptPublishedDependencies(graphId,publishedVersion,{
  approved:true,expectedExecutionFingerprint,reason:'Explicit GM review',
  capabilities:[],acknowledgeWarnings:true
});
await registry.publishedDependencyManifest(snapshot);
```

GM authoring RPC/client now allowlist and journal `validateCandidate` and `adoptPublishedDependencies`, and forward private `inspectValidation`. Requester contexts come only from authenticated GM transport; spoofed contexts/options are rejected. `GraphEditorModel.publish()` checks current evidence and performs optional persisted validation before publishing. Existing unconfigured memory-only registries return an unconfigured status and retain their existing sandbox behavior.

Legacy adoption requires current full successful preflight, exact executable fingerprint, explicit approval and reason. It records the GM identity and reviewed current contracts in a separate immutable sidecar. It does not infer historical semantics or rewrite snapshots. Drift after adoption requires a migrated draft; repeated adoption cannot silently change its contracts. Parent publications cannot adopt untracked/stale child semantics: each executable pinned child must already have its own current embedded/adopted manifest.

## Router hook (convergence agent owns the applied router changes)

The existing `#evaluate` node/edge/incoming construction becomes:

```js
const compiled=this.#compiledCache?await this.#compiledCache.get(graph,{
  manifest:graph.dependencyManifest??await this.#dependencyManifestReader?.(graph)
}):null;
const nodes=compiled?.nodes??new Map(graph.nodes.map(n=>[n.id,n]));
const edges=compiled?.edges??new Map(),incoming=compiled?.incoming??new Map();
if(!compiled)for(const edge of graph.edges) { /* existing static map loop */ }
```

The cache returns read-only indexes supporting `get`, `has`, `size`, keys/values/entries and iteration. Incoming predecessor values support `size`, `has` and iteration. Keep all runtime queues, convergence rounds, visited sets, data frames, state/roll readers and effect journals fresh. Compile checks exact node/provider/action/child/source contract dependencies before returning an existing artifact. `invalidate({kind:'node'|'provider'|'graph'|'external',id})` affects matching cached graphs only; lazy comparisons also detect drift without a global scan.

## GM window / API (root owns bootstrap wiring)

```js
import {makeGraphPreflightWindow} from '../ui/graph-preflight-desk.mjs';
const Window=makeGraphPreflightWindow(ApplicationV2,{
  gameInstance,validations:graphValidations,preflight:graphPreflight,
  graphProvider:()=>graphRegistry.getDraft(selectedGraphId())
});
// api.openGraphPreflight(): new Window().render({force:true})
```

For legacy review create the same factory with `published:true` and `graphProvider` returning an exact immutable snapshot. In a remote co-GM desk, adapt `validations.inspectCandidate/validateCandidate/adoptPublished` through the GM registry client so writes keep the authenticated coordinator journal. UI report rendering is exposed separately as `renderPublicationPreflight(report)` for embedding in the existing editor.

Core and extension contracts are explicit ABI declarations. Source-derived default SHA fingerprints bind the declared validators/evaluators; changed closed-over policies require an explicit provider/extension fingerprint or version bump. `CoreNodeContractCatalog.define(typeId,{version,descriptor|fingerprint})` replaces exactly one core contract, selectively invalidating dependent candidates/cache partitions. Cosmetic labels/layout/revision overlays are excluded from executable identity.

## Focused evidence

Executed using actual Node with `--test --test-isolation=none`: new dependency/preflight tests plus existing extension, persistent, paged and narrative-action tests: 42 PASS initially. Further focused checks are recorded in the agent's final handoff. No real Foundry world execution is claimed.
