import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentNarrativeNotifications} from '../src/orchestration/persistent-notifications.mjs';
import {NativeFoundryNotificationTransport,validateNotificationPacket} from '../src/platform/foundry-notification-transport.mjs';
import {PlayerNoticeInbox} from '../src/ui/player-notification-inbox.mjs';
import {createNotificationQueueProvider} from '../src/runtime/notification-queue-provider.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {GMManualEventGateway} from '../src/runtime/manual-event-gateway.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {MemoryOperationJournal} from '../src/storage/memory.mjs';
function setup(){
 const repository=new MemoryPartitionRepository(),gm={id:'GM_GroupedNotices001',isGM:true,active:true},context=createLocalGMContext({user:gm,epoch:'grouping'},'world'),gmProvider=()=>context,domains=new NarrativeDomainStore({repository,gmProvider}),service=new PersistentNarrativeNotifications({domains});
 const users=new Map([[gm.id,gm],['PlayerNoticeOne01',{id:'PlayerNoticeOne01',isGM:false,active:true}],['PlayerNoticeTwo01',{id:'PlayerNoticeTwo01',isGM:false,active:true}]]),recipients=new Map([['ep:actor:notice_hero001','PlayerNoticeOne01'],['ep:actor:notice_hero002','PlayerNoticeTwo01']]),listeners=new Map(),traffic=[],inboxes=new Map();
 const game=userId=>({user:users.get(userId),users:{get:id=>users.get(id),activeGM:gm},modules:{get:()=>({socket:true})},socket:{on:(channel,fn)=>listeners.set(userId,fn),off:()=>listeners.delete(userId),emit:(channel,packet,{recipients:targets})=>{assert.equal(targets.length,1);traffic.push({from:userId,to:targets[0],packet:structuredClone(packet)});for(const target of targets)queueMicrotask(()=>listeners.get(target)?.(structuredClone(packet),userId));}}});
 const server=new NativeFoundryNotificationTransport({gameInstance:game(gm.id),service,resolveRecipientUser:async({recipientId})=>recipients.get(recipientId),authorizeRecipient:async(userId,recipientId)=>recipients.get(recipientId)===userId,checkGM:()=>assert.equal(gm.isGM,true)});server.start();const clients=[];
 for(const userId of recipients.values()){const inbox=new PlayerNoticeInbox();inboxes.set(userId,inbox);const client=new NativeFoundryNotificationTransport({gameInstance:game(userId),onReceive:async item=>{inbox.receive(item);return true;}});client.start();clients.push(client);}
 const queue=async(index,recipientId='ep:actor:notice_hero001',overrides={})=>{const noticeId=`ep:notice:grouped_${index}`,row=await service.queue({noticeId,recipientId,sourceEventId:`ep:event:grouped_${index}`,groupKey:'private-harbor-case',publicGroup:'Harbor updates',gmDetail:'PRIVATE-CANONICAL-CULPRIT',safeText:`Authorized report ${index}`,level:'info',...overrides});return row;};
 const approve=async row=>service.approve({noticeId:row.id,expectedRevision:row.revision,approvalEventId:`ep:event:approve_${row.id.split(':').at(-1)}`});
 return {repository,domains,gmProvider,service,queue,approve,server,inboxes,traffic,stop(){server.stop();for(const client of clients)client.stop();}};
}
test('ADR-029: multiple recipients receive independently grouped approved notices with no cross-recipient counts or private group keys',async()=>{
 const s=setup();try{
  const one=await s.queue('one'),two=await s.queue('two'),other=await s.queue('other','ep:actor:notice_hero002',{level:'urgent'});
  assert.equal(one.data.publicGroup.id,two.data.publicGroup.id);assert.notEqual(one.data.publicGroup.id,other.data.publicGroup.id);
  await assert.rejects(s.server.deliver({noticeId:one.id}),{code:'NOTICE_NOT_APPROVED'});
  for(const row of [one,two,other]){await s.approve(row);assert.equal((await s.server.deliver({noticeId:row.id})).status,'acknowledged');}
  const first=s.inboxes.get('PlayerNoticeOne01').groups,second=s.inboxes.get('PlayerNoticeTwo01').groups;assert.equal(first.length,1);assert.equal(first[0].items.length,2);assert.equal(second.length,1);assert.equal(second[0].items.length,1);assert.equal(second[0].level,'urgent');
  for(const secret of ['PRIVATE-CANONICAL','private-harbor-case','ep:actor:notice_hero','recipientId','groupKey','sourceEventId'])assert.equal(JSON.stringify(s.traffic).includes(secret),false,secret);
  for(const packet of s.traffic.filter(t=>t.packet.kind==='notice.deliver'))assert.equal(packet.packet.version,2);
  assert.equal((await s.server.deliver({noticeId:one.id})).status,'acknowledged');assert.equal(s.inboxes.get('PlayerNoticeOne01').groups[0].items.length,2);
 }finally{s.stop();}
});
test('group public identities survive service recreation and do not silently adopt a renamed group',async()=>{
 const s=setup();try{const first=await s.queue('first'),recreated=new PersistentNarrativeNotifications({domains:new NarrativeDomainStore({repository:s.repository,gmProvider:s.gmProvider})});
  const second=await recreated.queue({noticeId:'ep:notice:grouped_restart001',recipientId:'ep:actor:notice_hero001',sourceEventId:'ep:event:grouped_restart001',groupKey:'private-harbor-case',publicGroup:'Harbor updates',safeText:'Later approved report'});assert.equal(second.data.publicGroup.id,first.data.publicGroup.id);
  await assert.rejects(s.queue('rename','ep:actor:notice_hero001',{publicGroup:'A different public title'}),{code:'NOTIFICATION_GROUP_CONFLICT'});
  await assert.rejects(s.queue('oversized','ep:actor:notice_hero001',{publicGroup:'x'.repeat(81)}),{code:'NOTIFICATION_GROUP'});
 }finally{s.stop();}
});
test('a failed public group confirmation cannot produce a sendable notification',async()=>{
 const s=setup(),save=s.domains.save.bind(s.domains);try{s.domains.save=async input=>{const row=await save(input);if(input.type==='notification-group')throw Error('group acknowledgement interrupted');return row;};await assert.rejects(s.queue('interrupted'),/interrupted/);assert.equal(await s.service.read({noticeId:'ep:notice:grouped_interrupted'}),null);assert.equal(s.traffic.length,0);
  s.domains.save=save;const recovered=await s.queue('interrupted');assert.equal(recovered.data.state,'pending-review');assert.equal(s.traffic.length,0);
 }finally{s.stop();}
});
test('inbox grouping is bounded, urgency-aware, duplicate-safe and dismisses only locally received messages',async()=>{
 const s=setup();try{const row=await s.queue('display'),base={id:row.id,text:'Safe <img src=x>',level:'info',group:row.data.publicGroup},inbox=new PlayerNoticeInbox();assert.equal(inbox.receive(base),true);assert.equal(inbox.receive(base),false);assert.throws(()=>inbox.receive({...base,text:'Changed text'}),{code:'NOTICE_REUSE_CONFLICT'});
  inbox.receive({id:'ep:notice:urgent_separate001',text:'An urgent public message',level:'urgent'});assert.equal(inbox.groups[0].level,'urgent');inbox.dismiss(row.data.publicGroup.id);assert.equal(inbox.groups.length,1);assert.equal((await s.service.read({noticeId:row.id})).data.state,'pending-review');
  for(let i=0;i<70;i++)inbox.receive({id:`ep:notice:bounded_inbox_${i}`,text:`Notice ${i}`,level:'info'});assert.equal(inbox.groups.reduce((n,g)=>n+g.items.length,0),64);
 }finally{s.stop();}
});
test('v2 public groups cannot smuggle recipient/provenance fields and ungrouped v1 remains supported',async()=>{
 const s=setup();try{const row=await s.queue('wire'),base={kind:'notice.deliver',version:2,deliveryId:'notice-group-wire001',noticeId:row.id,text:'Approved wording',level:'attention',group:row.data.publicGroup};assert.equal(validateNotificationPacket(base).group.title,'Harbor updates');
  for(const packet of [{...base,version:1},{...base,group:{...base.group,recipientId:'ep:actor:secret001'}},{...base,group:{...base.group,id:'ep:group:canonical_private001'}},{...base,sourceEventId:'ep:event:secret_event001'}])assert.throws(()=>validateNotificationPacket(packet),{code:'INVALID_NOTIFICATION'});
  const {group,...old}=base;assert.deepEqual(validateNotificationPacket({...old,version:1}),{id:row.id,text:base.text,level:base.level});
 }finally{s.stop();}
});
test('a published notification node only queues a private draft after effect approval; recipient publication and targeted delivery stay separate',async()=>{
 const s=setup();try{
  const catalog=new ActiveTriggerCatalog({repository:s.repository,gmProvider:s.gmProvider}),registry=new IndexedGraphRegistry({registry:new PersistentGraphRegistry({repository:s.repository,gmProvider:s.gmProvider}),catalog}),ledger=new DurableEventLedger({repository:s.repository,gmProvider:s.gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider:s.gmProvider}),providers=new EffectProviderRegistry();providers.register(createNotificationQueueProvider({service:s.service,gmProvider:s.gmProvider}));const journal=new MemoryOperationJournal(),reviews=new DurableProposalReview({repository:s.repository,registry,ledger,providers,journal,gmProvider:s.gmProvider});
  const model=new GraphEditorModel({registry});model.newGraph('Prepare grouped player notice');const node=model.addNode('core.notification.queue'),payload={scope:'world',noticeId:'ep:notice:graph_grouped001',recipientId:'ep:actor:notice_hero001',groupKey:'graph-case-notice',publicGroup:'Approved case updates',level:'attention',safeText:'A newly disclosed lead is available',gmDetail:'SECRET-GM-ONLY-CONTEXT',expiresAt:null};model.updateSelected({payloadJSON:JSON.stringify(payload)});model.connect(model.graph.rootNodeId,node);await model.save();const graph=await model.publish();await model.activate(graph.publishedVersion);
  const gateway=new GMManualEventGateway({router,ledger,gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},worldId:'world'}),event=await gateway.emit({requestId:'ep:request:grouped_graph001',eventType:'evidence.discovered',payload:{}}),p=(await ledger.get(event.eventId)).proposals[0];assert.equal(await s.service.read({noticeId:payload.noticeId}),null);
  await reviews.decide(event.eventId,p.operationId,{approve:true});assert.equal((await reviews.execute(event.eventId,p.operationId)).status,'completed');const row=await s.service.read({noticeId:payload.noticeId});assert.equal(row.data.state,'pending-review');assert.equal(row.data.queueOperationId,p.operationId);assert.equal(s.traffic.length,0);await assert.rejects(s.server.deliver({noticeId:row.id}),{code:'NOTICE_NOT_APPROVED'});
  await s.approve(row);assert.equal((await s.server.deliver({noticeId:row.id})).status,'acknowledged');assert.equal(s.inboxes.get('PlayerNoticeOne01').groups[0].items[0].text,payload.safeText);assert.equal(JSON.stringify(s.traffic).includes('SECRET-GM-ONLY'),false);
  await assert.rejects(s.service.queue({...payload,operationId:p.operationId,sourceEventId:event.eventId,safeText:'Changed after approval'}),{code:'NOTIFICATION_COLLISION'});
 }finally{s.stop();}
});
