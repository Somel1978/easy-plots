import test from 'node:test';import assert from 'node:assert/strict';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentGMPlans} from '../src/orchestration/persistent-plans.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
const id=s=>`ep:plan:${s}`;
test('plans share a revisioned native-compatible repository and persist after service reconstruction',async()=>{
 const repo=new MemoryPartitionRepository(),gm=createLocalGMContext({user:{id:'gm1',isGM:true}},'world');
 const create=()=>new PersistentGMPlans({domainStore:new NarrativeDomainStore({repository:repo,gmProvider:()=>gm})});
 const first=create();await first.create({id:id('scenario001'),mode:'resources',sourceEventId:'ep:event:review001',scenario:{resources:[],bindings:[],knownNarrativeIds:[]}});
 const second=create();const fromSecond=await second.read('world',id('scenario001'));
 assert.equal(fromSecond.data.preview.inspectedResources,0);
 const reviewed=await second.acknowledge({id:id('scenario001'),scope:'world',expectedRevision:1,approvalEventId:'ep:event:approval001'});
 assert.equal(reviewed.revision,2);assert.equal((await first.read('world',id('scenario001'))).data.state,'acknowledged-for-manual-followup');
});
