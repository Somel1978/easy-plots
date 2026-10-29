import test from 'node:test';import assert from 'node:assert/strict';
import {PersistentGMPlans} from '../src/orchestration/persistent-plans.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const id=s=>`ep:plan:${s}`;
const gm=createLocalGMContext({user:{id:'gm1',isGM:true}},'world1');
function service(){const repository=new MemoryPartitionRepository();const domainStore=new NarrativeDomainStore({repository,gmProvider:()=>gm});return new PersistentGMPlans({domainStore});}
test('GM-only plan persists and can be read without running an effect',async()=>{
 const s=service(),record=await s.create({id:id('review001'),sourceEventId:'ep:event:fixture001',mode:'resources',scenario:{resources:[],bindings:[],knownNarrativeIds:[]}});
 assert.equal(record.revision,1);assert.equal(record.data.effectsExecuted,0);assert.equal(record.visibility,'gm-only');
 const read=await s.read('world',id('review001'));assert.equal(read.data.mode,'resources');
});
test('plan approvals are version-checked, a separate event and not world execution',async()=>{
 const s=service();await s.create({id:id('review001'),sourceEventId:'ep:event:fixture001',mode:'resources',scenario:{resources:[],bindings:[],knownNarrativeIds:[]}});
 const r=await s.acknowledge({id:id('review001'),scope:'world',expectedRevision:1,approvalEventId:'ep:event:approval001'});
 assert.equal(r.revision,2);assert.equal(r.data.state,'acknowledged-for-manual-followup');assert.equal(r.data.effectsExecuted,0);
 await assert.rejects(()=>s.acknowledge({id:id('review001'),expectedRevision:1,approvalEventId:'ep:event:approval002'}),{code:'REVISION_CONFLICT'});
});
test('unknown planner is rejected and no record written',async()=>{
 const s=service();await assert.rejects(()=>s.create({id:id('review001'),sourceEventId:'ep:event:fixture001',mode:'unspecified',scenario:{}}),{code:'PLAN_MODE'});
 assert.equal(await s.read('world',id('review001')),null);
});
test('plan cannot be saved with privileged fake GM context',async()=>{
 const fakeStore=new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider:()=>({kind:'ep-gm-context-v1',userId:'gm1'})});
 const s=new PersistentGMPlans({domainStore:fakeStore});
 await assert.rejects(()=>s.create({id:id('review001'),sourceEventId:'ep:event:fixture001',mode:'resources',scenario:{resources:[],bindings:[],knownNarrativeIds:[]}}),{code:'GM_REQUIRED'});
});
test('new GM planning modes are available through shared preview engine',async()=>{
 const s=service();const r=await s.create({id:id('vote001'),sourceEventId:'ep:event:vote0001',mode:'vote',scenario:{decision:{id:'ep:decision:vote001',participantIds:['ep:actor:player001'],choiceIds:['yes','no'],quorum:1,deadline:20,tiePolicy:'gm-decides',visibility:'gm-only'},ballots:[],worldTime:10}});
 assert.equal(r.data.preview.status,'collecting');
});
