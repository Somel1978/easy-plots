# v0.8 implementation inventory

Implemented and exercised in local tests: versioned graph draft/publication/activation storage, bounded subscriptions, event inbox, GM authority contexts, durable player intents, effect journal, bounded narrative state provider, evidence-linked milestone provider, independent GM proposal review and execution, true/false branching, GM editor and review windows, limited Foundry Hook ingress.

The current executable node subset: `core.trigger.event`, `core.condition`, `core.branch.condition`, `core.effect.proposal`, `core.milestone.qualify`.

The complete approved design includes many more domains and providers. This file records code coverage rather than certification or delivery-scope reduction.
