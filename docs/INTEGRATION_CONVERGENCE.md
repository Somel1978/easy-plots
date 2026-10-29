# ADR-014 and ADR-087 integration

`core.flow.converge` is registered via `LOGIC_NODE_CONFIG`, so the existing node
catalog and editor acquire its name, default JSON and repeat/converged ports.
No descriptor or competing effect provider is required. Its explicit pure
contract is `numeric-clamped-step-v1`: finite authored initialValue/step/
targetValue, 1–16 maxPasses. It repeats through the authored flow loop until the
target is reached, an exact numeric state repeats, or its budget is exhausted.
Only its repeat output can close a cycle. Data cycles, converged-path cycles,
unbounded alternate paths, and opaque subgraph/extension/join loop bodies fail
publication. No world state, canonical truth or observer knowledge is updated.

## Root-owned durable-router.mjs hooks (merge with static compile cache)

Imports:

```js
import {CONVERGENCE_NODE_TYPE,BoundedConvergenceRun} from '../graph/convergence.mjs';
```

Add optional constructor `cascades=null`, private `#cascades`, assign it. Add:

```js
async previewCascade(event){this.#context();return this.#cascades?.inspect(event)??null;}
```

After durable acceptance and prepared→evaluating, inside the existing `try`,
before any published graph evaluation:

```js
const cascade=await this.#cascades?.reserve(event);
if(cascade&&!cascade.allowed){
 const evaluations=[{graphId:null,publishedVersion:null,triggerNodeId:null,
  evaluatedNodeIds:[],trace:[{status:'cascade-stopped',diagnostic:cascade}]}];
 await this.#ledger.transition(event.id,'evaluating','evaluated',{
  evaluations,proposals:[],reason:cascade.code});
 return {status:'evaluated',eventId:event.id,graphCount:0,proposals:0,cascade};
}
```

Keep duplicate acceptance return **before** reserve; an accepted or uncertain
event is never replayed after restart. Admission failures remain uncertain via
the existing catch. A refusal is a terminal evaluated event with no proposals,
so the GM can inspect the exact diagnostic. No rescan or native provider runs.

At `#evaluate` invocation scope instantiate `const convergence=new
BoundedConvergenceRun(graph);`. Only nodes in an actual cyclic flow component
receive round-specific visit keys; side exits and opaque downstream callbacks
retain once-per-invocation visited behavior. Queue records carry `round=0`. Destructure
`round=0`, use `seen.has(convergence.visitKey(id,round))` and
`seen.add(convergence.visitKey(id,round))` in place of id-only seen tracking.
Keep `round` when enqueuing normal successors. Initialize `let nextRound=round`.
Before condition/generic logic dispatch:

```js
if(node.typeId===CONVERGENCE_NODE_TYPE){
 const outcome=convergence.step(node);
 trace.push({graphId:graph.id,nodeId:id,status:outcome.status,
  diagnostic:outcome.diagnostic,selectedPorts:outcome.allowedPorts});
 if(outcome.stopped){proposals.length=0;queue.length=0;break;}
 allowedPorts=outcome.allowedPorts;nextRound=outcome.round;
 // skip generic trace, or set disposition=outcome.status and include diagnostic
}
```

Enqueue successor `round:nextRound`. Gate state remains invocation-local,
including in simulation, and must never enter CompiledGraphCache. On proposal
construction use `convergence.claimOperation(operationId)` to push at most once
per node/event. The operation seed remains unchanged. Re-entering an effect
node still follows its outgoing flow without creating a second effect.
For child results deduplicate proposals by operationId too. If a nested child
halts convergence, clear its pending proposals; no child effects were executed.
Depth/node/subgraph limits remain the existing hard ceiling over all rounds.

## Native composition and GM diagnostics

```js
const cascades=new BoundedEventCascades({repository,ledger,gmProvider});
const router=new DurableReactiveRouter({...existing,cascades});
```

Import from `src/runtime/event-cascades.mjs`. Scope defaults to main, matching
the default ledger scope; pass the same explicit scope for nondefault ledgers.
Reservations use the bounded `event-cascades:<scope>:<hash-prefix>` partition,
kind event-cascade. Root update storage map/traceability if required. No native
document capabilities beyond the existing protected repository are needed.
Default policy: depth8,32 total reserved events/root,8 siblings/parent,
3 occurrences/reaction,64 ancestor reads. Constructor overrides are bounded
and pinned in each durable root row; a policy change fails closed on old rows.
The native per-root record has a conservative 44KB ceiling; exceeding it also
produces a terminal budget diagnostic before any proposed effect.
Merged roots reserve every original root, so joins cannot reset the budget.
Interrupted multi-root reservations consume budget conservatively. Same-event
reservation is idempotent; concurrent CAS writers cannot overrun a root budget.

Completed-operation and reviewed-plan previews already call router.previewCascade
if present. Preview never reserves budget or admits events. Reactions are
fingerprinted by event type/origin capability plus each original published
graph/version/node set, excluding changing occurrence IDs. Grouping a repeated
rule with another completion cannot reset the original rule's budget. Authenticated native Hook
producers retain their existing causal envelopes; unrelated root events begin
new budgets. Own-storage Hooks remain excluded by the existing adapter.

Import `appendConvergenceDiagnostics` from the new UI module and call in the
Event Review event box with `{event:this.#event}`; call again for continuation
preview `{cascade:this.#continuationPreview.cascade}`. Disable Submit when
`cascade?.allowed===false` (server admission still checks). The renderer uses
textContent and only the GM desk receives these private trace details.

The real integrated tests are in `tests/bounded-convergence.test.mjs` and
`tests/event-cascades.test.mjs`. Do not count module loading as test evidence;
run the exact files with the root router/native hooks integrated.
The focused local browser proof is `python tests/browser/convergence-smoke.py`.
It authors a real cyclic published graph, observes its budget exit, and checks
the private diagnostic renderer uses text rather than interpreting HTML.
