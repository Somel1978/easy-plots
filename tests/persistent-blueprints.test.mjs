import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentBlueprintCatalog} from '../src/orchestration/persistent-blueprints.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const id=s=>`ep:${s}`;const blueprintId=id('blueprint:harbor001');const instanceId=id('instance:harbor001');
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'local'},'world');
async function setup(){const domains=new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider});const b=new PersistentBlueprintCatalog({domains});
 await b.publish({blueprintId,revision:1,fields:{name:'Old Route',difficulty:2,status:'hidden'},sourceEventId:id('event:publish001')});return {b,domains};}
test('published blueprint snapshots are immutable and retain stable source identity',async()=>{
 const {b}=await setup();const r=await b.getRevision({blueprintId,revision:1});assert.equal(r.data.fields.difficulty,2);
 await assert.rejects(b.publish({blueprintId,revision:1,fields:{name:'Replaced'},sourceEventId:id('event:replace001')}),{code:'BLUEPRINT_IMMUTABLE'});
 await assert.rejects(b.publish({blueprintId,revision:3,fields:{name:'Third'},sourceEventId:id('event:publish003'),expectedPreviousRevision:2}),{code:'BLUEPRINT_PREDECESSOR'});
});
test('instance update adopts unchanged fields, preserves overrides and does not change native docs',async()=>{
 const {b}=await setup();await b.instantiate({instanceId,blueprintId,blueprintRevision:1,sourceEventId:id('event:create001'),overrides:{difficulty:5}});
 await b.publish({blueprintId,revision:2,fields:{name:'New Route',difficulty:2,status:'published'},sourceEventId:id('event:publish002'),expectedPreviousRevision:1});
 const plan=await b.planAdoption({instanceId,targetRevision:2});assert.equal(plan.conflicts.length,0);
 assert.equal(plan.merged.name,'New Route');assert.equal(plan.merged.difficulty,5);
 const res=await b.adopt({instanceId,targetRevision:2,expectedInstanceRevision:1,reviewEventId:id('event:adopt001')});
 assert.equal(res.nativeResourcesModified,false);const updated=await b.planAdoption({instanceId,targetRevision:2}).catch(e=>e);
 assert.equal(updated.code,'BLUEPRINT_ADOPTION');
});
test('conflicts require explicit field-by-field GM review',async()=>{
 const {b,domains}=await setup();await b.instantiate({instanceId,blueprintId,blueprintRevision:1,sourceEventId:id('event:create001'),overrides:{difficulty:5}});
 await b.publish({blueprintId,revision:2,fields:{name:'Old Route',difficulty:3,status:'hidden'},sourceEventId:id('event:publish002'),expectedPreviousRevision:1});
 const plan=await b.planAdoption({instanceId,targetRevision:2});assert.deepEqual(plan.conflicts.map(x=>x.field),['difficulty']);
 await assert.rejects(b.adopt({instanceId,targetRevision:2,expectedInstanceRevision:1,reviewEventId:id('event:adopt001')}),{code:'BLUEPRINT_CONFLICT_REVIEW'});
 const result=await b.adopt({instanceId,targetRevision:2,expectedInstanceRevision:1,reviewEventId:id('event:adopt001'),conflictResolutions:{difficulty:'source'}});
 assert.equal(result.committed,true);const row=await domains.read('blueprint-instance','world',instanceId);
 assert.equal(row.data.fields.difficulty,3);assert.equal(row.data.overrides.difficulty,undefined);
});
test('unknown fields and stale instance revisions fail closed',async()=>{
 const {b}=await setup();
 await assert.rejects(b.instantiate({instanceId,blueprintId,blueprintRevision:1,sourceEventId:id('event:create001'),overrides:{unknown:'secret'}}),{code:'BLUEPRINT_OVERRIDE'});
 await b.instantiate({instanceId,blueprintId,blueprintRevision:1,sourceEventId:id('event:create001')});
 await b.publish({blueprintId,revision:2,fields:{name:'New Route',difficulty:3,status:'hidden'},sourceEventId:id('event:publish002'),expectedPreviousRevision:1});
 await assert.rejects(b.adopt({instanceId,targetRevision:2,expectedInstanceRevision:2,reviewEventId:id('event:adopt001')}),{code:'REVISION_CONFLICT'});
});
