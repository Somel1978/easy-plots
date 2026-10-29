import test from 'node:test';import assert from 'node:assert/strict';
import {evaluatePlanningFixture} from '../src/ui/planning-lab.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {PersistentGMPlans} from '../src/orchestration/persistent-plans.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
test('GM planning lab evaluates health using only supplied scoped records',()=>{
 const r=evaluatePlanningFixture('health',{arcId:'ep:arc:harbor001',worldTime:100,coverage:'unknown',objectives:[],requests:[],deadlines:[],unresolvedLinks:[]});
 assert.equal(r.status,'incomplete-coverage');assert.equal(r.visibility,'gm-only');
});
test('health report can be saved as GM-private plan without creating effects',async()=>{
 const store=new PersistentGMPlans({domainStore:new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider})});
 const id='ep:plan:health001';const row=await store.create({id,scope:'world',mode:'health',scenario:{arcId:'ep:arc:harbor001',worldTime:100,coverage:'partial'},sourceEventId:'ep:event:health001'});
 assert.equal(row.data.effectsExecuted,0);assert.equal(row.data.preview.kind,'gm-narrative-health');
});
