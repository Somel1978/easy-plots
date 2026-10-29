import test from 'node:test';
import assert from 'node:assert/strict';
import {PersistentQuestProjections} from '../src/orchestration/persistent-quest-projections.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gm={id:'gm-user-001',isGM:true,active:true};
const ids={id:'ep:quest-publication:harbor001',questId:'ep:quest:harbor001',publicId:'ep:quest-public:harbor001',actorId:'ep:actor:hero001',stranger:'ep:actor:other001',objectiveId:'ep:objective:harbor001',sourceEventId:'ep:event:quest001'};
function setup(){const repo=new MemoryPartitionRepository();const domains=new NarrativeDomainStore({repository:repo,gmProvider:()=>createLocalGMContext({user:gm,epoch:'test'},'test-world')});return {domains,service:new PersistentQuestProjections({domains})};}
const manifest=(revision=1)=>({id:ids.id,questId:ids.questId,publicId:ids.publicId,title:'Find the safe harbor',observerIds:[ids.actorId],objectives:[{objectiveId:ids.objectiveId,publicId:'ep:objective-public:harbor001',expectedRevision:revision,recipientIds:[ids.actorId],text:'Locate the harbor entrance',status:'active'}]});
async function create(s){return s.domains.save({type:'objective',scope:'world',id:ids.objectiveId,sourceEventId:ids.sourceEventId,data:{state:'active',gmDetail:'Secret traitor'}});}
test('draft and approval require canonical objective revision and state; projection reveals only authored values',async()=>{
 const s=setup();await create(s);
 const draft=await s.service.prepare({manifest:manifest(),sourceEventId:ids.sourceEventId});
 assert.equal((await s.service.project({publicationId:ids.id,observerId:ids.actorId})),null);
 await s.service.approve({publicationId:ids.id,expectedRevision:draft.revision,reviewEventId:'ep:event:review001'});
 assert.deepEqual(await s.service.project({publicationId:ids.id,observerId:ids.actorId}),{id:ids.publicId,title:'Find the safe harbor',objectives:[{id:'ep:objective-public:harbor001',text:'Locate the harbor entrance',status:'active'}]});
 assert.equal((await s.service.project({publicationId:ids.id,observerId:ids.stranger})),null);
 assert.equal(JSON.stringify(await s.service.project({publicationId:ids.id,observerId:ids.actorId})).includes('Secret traitor'),false);
});
test('stale canonical objective blocks projection instead of showing outdated status',async()=>{
 const s=setup();const row=await create(s);const draft=await s.service.prepare({manifest:manifest(),sourceEventId:ids.sourceEventId});
 await s.service.approve({publicationId:ids.id,expectedRevision:draft.revision,reviewEventId:'ep:event:review001'});
 await s.domains.save({type:'objective',scope:'world',id:ids.objectiveId,expectedRevision:row.revision,sourceEventId:'ep:event:changed001',data:{state:'completed'}});
 assert.equal((await s.service.project({publicationId:ids.id,observerId:ids.actorId})),null);
});
test('rejects illicit recipient lists and canonical IDs used as public identifiers',async()=>{
 const s=setup();await create(s);
 const bad=manifest();bad.objectives[0].recipientIds=[ids.stranger];
 await assert.rejects(s.service.prepare({manifest:bad,sourceEventId:ids.sourceEventId}),{code:'QUEST_PROJECTION_RECIPIENT'});
 const copy=manifest();copy.objectives[0].publicId=ids.objectiveId;
 await assert.rejects(s.service.prepare({manifest:copy,sourceEventId:ids.sourceEventId}),{code:'QUEST_PROJECTION_IDENTITY'});
});
test('an approval refuses a canonical objective changed between draft and review',async()=>{
 const s=setup();const row=await create(s);const draft=await s.service.prepare({manifest:manifest(),sourceEventId:ids.sourceEventId});
 await s.domains.save({type:'objective',scope:'world',id:ids.objectiveId,expectedRevision:row.revision,sourceEventId:'ep:event:changed001',data:{state:'active'}});
 await assert.rejects(s.service.approve({publicationId:ids.id,expectedRevision:draft.revision,reviewEventId:'ep:event:review001'}),{code:'QUEST_PROJECTION_STALE'});
});
