import test from 'node:test';import assert from 'node:assert/strict';
import {PersistentNarrativeNotifications} from '../src/orchestration/persistent-notifications.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'test'},'world');
const ids={noticeId:'ep:notice:harbor001',recipientId:'ep:actor:hero001',sourceEventId:'ep:event:clue001',approvalEventId:'ep:event:approve001'};
const spec={...ids,groupKey:'harbor-alert',safeText:'A new clue was disclosed.',gmDetail:'Secret true identity: Captain Marrek',level:'attention',expiresAt:100};
function service(repo=new MemoryPartitionRepository()){
 return new PersistentNarrativeNotifications({domains:new NarrativeDomainStore({repository:repo,gmProvider})});
}
test('notification is inert until separately approved and never exposes GM detail',async()=>{
 const svc=service();const draft=await svc.queue(spec);
 assert.deepEqual(await svc.project({noticeIds:[ids.noticeId],recipientId:ids.recipientId,worldTime:50}),{notifications:[]});
 await svc.approve({noticeId:ids.noticeId,expectedRevision:draft.revision,approvalEventId:ids.approvalEventId});
 const projection=await svc.project({noticeIds:[ids.noticeId],recipientId:ids.recipientId,worldTime:50});
 assert.deepEqual(projection,{notifications:[{id:ids.noticeId,text:'A new clue was disclosed.',level:'attention'}]});
 assert.equal(JSON.stringify(projection).includes('Captain Marrek'),false);
 assert.deepEqual(await svc.project({noticeIds:[ids.noticeId],recipientId:'ep:actor:other001',worldTime:50}),{notifications:[]});
 assert.deepEqual(await svc.project({noticeIds:[ids.noticeId],recipientId:ids.recipientId,worldTime:100}),{notifications:[]});
});
test('duplicate event is idempotent, foreign source and stale approval rejected',async()=>{
 const svc=service();const row=await svc.queue(spec),again=await svc.queue({...spec,gmDetail:'different safe private context'});
 assert.equal(row.revision,again.revision);
 await assert.rejects(svc.queue({...spec,sourceEventId:'ep:event:wrong001'}),{code:'NOTIFICATION_COLLISION'});
 await assert.rejects(svc.approve({noticeId:ids.noticeId,expectedRevision:3,approvalEventId:ids.approvalEventId}),{code:'REVISION_CONFLICT'});
});
test('indexed GM list is bounded, projected clients never see group metadata',async()=>{
 const repo=new MemoryPartitionRepository(),svc=service(repo);await svc.queue(spec);
 const page=await service(repo).listGM({limit:4});assert.equal(page.items.length,1);
 assert.equal(page.items[0].groupKey,'harbor-alert');
 await assert.rejects(svc.listGM({limit:100}),{code:'DOMAIN_BUDGET'});
});
test('recipient-safe text is mandatory before release and unauthorized store fails closed',async()=>{
 const svc=service();const row=await svc.queue({...spec,safeText:''});
 await assert.rejects(svc.approve({noticeId:ids.noticeId,expectedRevision:row.revision,approvalEventId:ids.approvalEventId}),{code:'NOTIFICATION_PUBLIC_TEXT'});
 const player=new PersistentNarrativeNotifications({domains:new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider:()=>createLocalGMContext({user:{id:'P',isGM:false},epoch:'test'},'world')})});
 await assert.rejects(player.queue(spec),{code:'GM_REQUIRED'});
});
