# Development batches v0.49 and v0.50

- **v0.49:** Introduced an explicit GM-reviewed `narrative.materialize-journal-shell` effect provider and `core.resource.materialize-journal` editor node. It stages a protected provenance manifest, uses deterministic native identifiers, creates a zero-default-ownership JournalEntry shell with no GM-secret text or embedded pages, performs read-back checks, and fails closed on native ID collisions or uncertain acknowledgements. Native provider registration is optional and requires a valid world Journal collection.
- **v0.50:** Added a multi-component Node integration test covering editor → published graph → indexed event → pending effect → GM approval → native shell creation → protected verification.

**Limits:** This does not implement general Foundry Actor/Item materialization, protected compendium lifecycle management, or all original resource-node contract semantics. Full real-world Foundry testing is deferred until the agreed complete-module implementation.
