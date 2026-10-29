import test from 'node:test';import assert from 'node:assert/strict';
import {PersistentSessionHandoff} from '../src/orchestration/persistent-session-handoff.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
const ids={sessionId:'ep:session:handoff001',sourceArcId:'ep:arc:waterdeep001',sourceEventId:'ep:event:last001',observer:'ep:actor:hero001',outsider:'ep:actor:outsider001',reviewEventId:'ep:event:review001'};
const spec={...ids,worldTime:200,sourceArcRevision:4,
 references:[{id:'ep:story-hook:officer001',kind:'story-hook',status:'dormant',note:'Secret villain detail'}],
 recap:[{id:'ep:public:recap001',sourceEventId:ids.sourceEventId,text:'The harbor was secured.',recipientIds:[ids.observer]}]};
function setup(repo=new MemoryPartitionRepository()){
 const domains=new NarrativeDomainStore({repository:repo,gmProvider});return new PersistentSessionHandoff({domains});
}
test('handoff cannot expose GM notes or draft recaps, and approval is revision checked',async()=>{
 const handoff=setup(),draft=await handoff.prepare(spec);
 assert.deepEqual(await handoff.project({sessionId:ids.sessionId,observerId:ids.observer}),{recap:[]});
 await assert.rejects(handoff.approve({sessionId:ids.sessionId,expectedRevision:draft.revision,reviewEventId:ids.reviewEventId,sourceArcRevision:5}),{code:'HANDOFF_STALE'});
 const approved=await handoff.approve({sessionId:ids.sessionId,expectedRevision:draft.revision,reviewEventId:ids.reviewEventId,sourceArcRevision:4});
 assert.equal(approved.data.state,'approved');
 const view=await handoff.project({sessionId:ids.sessionId,observerId:ids.observer});
 assert.deepEqual(view,{recap:[{id:'ep:public:recap001',text:'The harbor was secured.'}]});
 assert.equal(JSON.stringify(view).includes('Secret villain'),false);
 assert.deepEqual(await handoff.project({sessionId:ids.sessionId,observerId:ids.outsider}),{recap:[]});
 await assert.rejects(handoff.prepare({...spec,expectedRevision:approved.revision}),{code:'HANDOFF_FINAL'});
});
test('handoff survives service reconstruction and never activates dormant hooks',async()=>{
 const repo=new MemoryPartitionRepository(),a=setup(repo);await a.prepare(spec);
 const b=setup(repo),record=await b.read({sessionId:ids.sessionId});
 assert.equal(record.data.references[0].status,'dormant');assert.equal(record.data.effectsExecuted,0);assert.equal(record.data.gameEventsCreated,0);
});
test('handoff detects stale revision and rejects unscoped duplicated references',async()=>{
 const h=setup();const row=await h.prepare(spec);
 await assert.rejects(h.approve({sessionId:ids.sessionId,expectedRevision:9,reviewEventId:ids.reviewEventId,sourceArcRevision:4}),{code:'REVISION_CONFLICT'});
 await assert.rejects(h.prepare({...spec,expectedRevision:row.revision,references:[...spec.references,...spec.references]}),{code:'HANDOFF_DUPLICATE'});
});
test('player context cannot write protected handoff records',async()=>{
 const handoff=new PersistentSessionHandoff({domains:new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider:()=>createLocalGMContext({user:{id:'P',isGM:false},epoch:'x'},'world')})});
 await assert.rejects(handoff.prepare(spec),{code:'GM_REQUIRED'});
});
