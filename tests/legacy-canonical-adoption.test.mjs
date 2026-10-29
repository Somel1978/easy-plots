import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {createExtendedDomainProviders} from '../src/runtime/extended-providers.mjs';
import {sha256Hex} from '../src/contracts/digest.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
async function suite(){
 const repository=new MemoryPartitionRepository(),user={id:'gm_legacy001',isGM:true},context=createLocalGMContext({user,epoch:'legacy'},'world'),gmProvider=()=>context;
 const domains=new NarrativeDomainStore({repository,gmProvider}),provider=createExtendedDomainProviders({repository,gmProvider,domains}).find(p=>p.id==='narrative.transition-objective');
 const payload={scope:'world',objectiveId:'ep:objective:legacy001',state:'active',previousState:null,expectedRevision:null};
 const hash=await sha256Hex(`objective|world|${payload.objectiveId}`),loc={id:`ep:objective:${hash.slice(0,24)}`,partitionId:`effect-objective-world-${hash.slice(0,2)}`};
 await repository.put({...loc,kind:'domain-effect-objective',scope:'world',data:payload,visibility:'gm-only',lastOperationId:'ep:operation:legacy_original001',lastSourceEventId:'ep:event:legacy_original001'},{expectedRevision:null});
 const preview=await provider.previewLegacyAdoption(payload);
 const review={approved:true,expectedLegacyRevision:preview.legacyRevision,expectedLegacyFingerprint:preview.legacyFingerprint,reviewEventId:'ep:event:legacy_adoption001'};
 return {repository,user,domains,provider,payload,loc,preview,review};
}
test('ADR-072: legacy hashed records require explicit reviewed adoption and keep the original source untouched',async()=>{
 const s=await suite();await assert.rejects(s.provider.get(s.payload),{code:'LEGACY_DOMAIN_MIGRATION_REQUIRED'});
 const original=await s.repository.read(s.loc.id,{partitionId:s.loc.partitionId});
 await s.provider.adoptLegacy(s.payload,s.review);const canonical=await s.domains.read('objective','world',s.payload.objectiveId);
 assert.equal(canonical.data.state,'active');assert.equal(canonical.importReceipt.id,s.loc.id);
 assert.deepEqual(await s.repository.read(s.loc.id,{partitionId:s.loc.partitionId}),original);
 assert.equal(await s.provider.verify(s.payload,{operationId:original.lastOperationId,sourceEventId:original.lastSourceEventId}),true);
});
test('adoption rejects absent approval, stale preview and unreviewed collisions',async()=>{
 const s=await suite();await assert.rejects(s.provider.adoptLegacy(s.payload,{...s.review,approved:false}),{code:'LEGACY_ADOPTION_REVIEW'});
 await assert.rejects(s.provider.adoptLegacy(s.payload,{...s.review,expectedLegacyRevision:2}),{code:'LEGACY_ADOPTION_STALE'});
 await s.domains.save({type:'objective',scope:'world',id:s.payload.objectiveId,data:{state:'completed'},sourceEventId:'ep:event:existing_canonical001'});
 await assert.rejects(s.provider.adoptLegacy(s.payload,s.review),{code:'CANONICAL_LEGACY_CONFLICT'});
 assert.equal((await s.domains.read('objective','world',s.payload.objectiveId)).data.state,'completed');
});
test('legacy updates after adoption cannot silently replace the canonical source',async()=>{
 const s=await suite();await s.provider.adoptLegacy(s.payload,s.review);
 const old=await s.repository.read(s.loc.id,{partitionId:s.loc.partitionId});await s.repository.put({...old,data:{...old.data,state:'completed'}},{expectedRevision:old.revision});
 await assert.rejects(s.provider.get(s.payload),{code:'CANONICAL_LEGACY_CONFLICT'});
});
test('new canonical mutations preserve import provenance and enforce the new canonical revision',async()=>{
 const s=await suite();await s.provider.adoptLegacy(s.payload,s.review);
 const payload={...s.payload,state:'completed',previousState:'active',expectedRevision:1};
 await s.provider.apply(payload,{operationId:'ep:operation:post_adoption001',sourceEventId:'ep:event:post_adoption001'});
 const row=await s.provider.get(payload);assert.equal(row.revision,2);assert.equal(row.importReceipt.id,s.loc.id);assert.equal(row.data.state,'completed');
 assert.equal((await s.domains.readRevision('objective','world',s.payload.objectiveId,1)).data.state,'active');
});
test('GM revocation and incomplete legacy indices block adoption before writes',async()=>{
 const s=await suite();s.repository.hasReadyIndex=async()=>false;
 await assert.rejects(s.provider.adoptLegacy(s.payload,s.review),{code:'INDEX_UNCERTAIN'});
 s.user.isGM=false;await assert.rejects(s.provider.adoptLegacy(s.payload,s.review),{code:'GM_AUTHORITY_REVOKED'});
});
test('registered native providers preserve their explicitly declared migration capabilities',async()=>{
 const s=await suite(),registry=new EffectProviderRegistry();registry.register(s.provider);
 const registered=registry.get(s.provider.id);assert.equal((await registered.previewLegacyAdoption(s.payload)).state,'review-required');
 await registered.adoptLegacy(s.payload,s.review);assert.equal((await registered.get(s.payload)).data.state,'active');
});
