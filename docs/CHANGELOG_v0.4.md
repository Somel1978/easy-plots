# Easy Plots v0.4 — Native source integration checkpoint

- Reviewed the user-supplied Foundry v14.369 client/common and server distribution source without redistributing it.
- Replaced the oversimplified v0.3 module-socket assumption: server-attested callback sender IDs and targeted recipients are available in the examined server implementation.
- Added manifest `socket: true` and optional `NativeFoundryIntentTransport` using server sender identity rather than payload claims. It is **not auto-enabled**.
- Added a minimal world Actor ownership adapter; scene-unlinked tokens and delegated ownership need additional validated adapters.
- Added a fail-closed durable-queue integration interface. **No actual native queue/storage is implemented**, so player intent acceptance remains disabled by default.
- Added synthetic targeted-socket manual probes and a reproducible source audit script.
- Added adversarial Node transport simulations. These are local mock tests and not certification of live Foundry transport or pack secrecy.
- The original 125-decision full-module scope remains unchanged; build batches are integration/debugging checkpoints only.
