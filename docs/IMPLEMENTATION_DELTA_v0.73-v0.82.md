# Easy Plots implementation delta — v0.73–v0.82

This is one integrated implementation sequence, not a series of product releases. All source remains inside the Foundry VTT v14+ module. Full live Foundry end-to-end testing is reserved for the completion of the entire implementation.

| Batch | Integrated work | Verification |
|---|---|---|
| v0.73 | Persistent GM-reviewed knowledge propagation: claim provenance, recipient decisions, bounded delay and irreversible disclosure history | Domain and retry tests |
| v0.74 | Published faction agenda contracts with world-fact and faction-specific knowledge prerequisites | Agenda tests |
| v0.75 | `core.knowledge.approve-recipient` graph effect with journaled, recipient-safe knowledge receipts | Graph→approval→journal→projection integration |
| v0.76 | `core.faction.review-agenda` graph effect with independent precondition validation | Published graph and review tests |
| v0.77 | `core.flow.join` all/any conjunction semantics, tracked incoming flow and strict publication checks | Duplicate, blocked, invalid join tests |
| v0.78 | GM Knowledge & Faction Desk ApplicationV2 interface for preparing knowledge and faction plans | Chromium interaction test |
| v0.79 | `core.faction.schedule-reviewed-action` effect stages GM-reviewed faction decisions as durable pending commitments in the world-time index | Graph scheduling and idempotency tests |
| v0.80 | GM-only manual narrative event ingress with stable IDs, dedupe and trigger source-kind restrictions | Authority, replay and source-kind tests |
| v0.81 | Bounded GM due-event gateway verifies canonical schedule and temporal index before sending `narrative.schedule-due` to the event router | Due, stale and retry tests |
| v0.82 | GM causal planning inspector queues verified due events only after explicit acknowledgement; does not execute scheduled actions | UI acknowledgement and invalid-request tests |

## Invariants retained

- GM-only event and effect authority; authorization is rechecked in native handlers, not trusted from client UI.
- Recipient knowledge projections and source payloads remain separate; no unconditional disclosure to clients.
- Schedules are **pending commitments**; being due does not establish an outcome.
- Event IDs are deterministic where retry correlation is required; loss of acknowledgement does not authorize blind effect replay.
- Temporal lookups and graph traversals have explicit budgets, indexed candidate reads, and canonical revision validation.
- No external service, standalone backend, or redistribution of Foundry source code.

## Not yet established

This batch does not prove the complete 125-decision module has been implemented, nor does the local test suite constitute live Foundry multiplayer verification. The original 97 proposed specialized provider contracts still need exact one-for-one semantic traceability, and advanced system-specific adapter and UI coverage remain incomplete.
