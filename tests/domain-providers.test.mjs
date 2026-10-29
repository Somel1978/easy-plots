import test from 'node:test';import assert from 'node:assert/strict';
import {createFactionStandingProvider,createObligationProvider,createEvidenceAttestationProvider} from '../src/runtime/domain-providers.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {EffectCoordinator} from '../src/runtime/effects.mjs';
import {MemoryOperationJournal} from '../src/storage/memory.mjs';
const gm=createLocalGMContext({user:{id:'gm1',isGM:true}},'world1');
const repository=new MemoryPartitionRepository();const gmProvider=()=>gm;
const providers=new EffectProviderRegistry();
providers.register(createFactionStandingProvider({repository,gmProvider}));
providers.register(createObligationProvider({repository,gmProvider}));
providers.register(createEvidenceAttestationProvider({repository,gmProvider}));
const journal=new MemoryOperationJournal();const coordinator=new EffectCoordinator({journal,providers});
const base={operationId:'ep:operation:abc12345',idempotencyKey:'unique-one',sourceEventId:'ep:event:abc12345',graphId:'ep:graph:abc',nodeId:'ep:node:abc'};
test('native faction standing provider writes verified attributed delta',async()=>{
  const spec={...base,providerId:'narrative.change-faction-standing',payload:{factionId:'ep:faction:harpers',actorId:'ep:actor:hero',dimension:'renown',delta:3}};
  assert.equal((await coordinator.execute(spec,gm)).status,'completed');
  assert.equal((await coordinator.execute(spec,gm)).status,'already-completed');
  assert.equal((await providers.get(spec.providerId).get(spec.payload)).value,3);
  await assert.rejects(()=>providers.get(spec.providerId).apply(spec.payload,{operationId:'ep:operation:new12345',sourceEventId:'ep:event:abc12346'}),{code:'REVISION_CONFLICT'});
});
test('rank is not a generic faction numeric change',()=>{
  assert.throws(()=>providers.get('narrative.change-faction-standing').validate({factionId:'ep:faction:harpers',actorId:'ep:actor:hero',dimension:'rank',delta:1}),{code:'FACTION_PAYLOAD'});
});
test('obligation is settled exactly once and direction preserved',async()=>{
  const spec={...base,idempotencyKey:'unique-two',operationId:'ep:operation:obligat1',providerId:'narrative.resolve-obligation',payload:{obligationId:'ep:obligation:favor',debtorId:'ep:faction:harpers',creditorId:'ep:actor:hero',outcome:'fulfilled'}};
  assert.equal((await coordinator.execute(spec,gm)).status,'completed');
  assert.equal((await coordinator.execute({...spec,idempotencyKey:'new-key',operationId:'ep:operation:obligat2'},gm)).status,'uncertain');
  assert.equal((await providers.get(spec.providerId).get(spec.payload)).outcome,'fulfilled');
});
test('canonical evidence attestation stays protected and durable',async()=>{
  const spec={...base,idempotencyKey:'unique-three',operationId:'ep:operation:evidenc1',providerId:'narrative.attest-evidence',payload:{evidenceId:'ep:evidence:manifest',investigationId:'ep:investigation:shipment',factId:'shipment-fraud'}};
  assert.equal((await coordinator.execute(spec,gm)).status,'completed');
  const evidence=await providers.get(spec.providerId).get(spec.payload);
  assert.equal(evidence.visibility,'gm-only');assert.equal(evidence.factId,'shipment-fraud');
});
