/** Full local composition of durable quest publication, authenticated GM
 * permission checks, targeted transport, and stale canonical suppression.
 * Uses fake module sockets, NOT a live Foundry installation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeFoundryContinuityTransport} from '../src/platform/foundry-continuity-transport.mjs';
import {PersistentQuestProjections} from '../src/orchestration/persistent-quest-projections.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {MODULE_SOCKET} from '../src/platform/foundry-socket.mjs';
function setup(){
 const gm={id:'gm-user-001',isGM:true,active:true};const hero={id:'player-user-001',isGM:false,active:true};const stranger={id:'player-user-002',isGM:false,active:true};
 const users=new Map([[gm.id,gm],[hero.id,hero],[stranger.id,stranger]]),events=new Map(),traffic=[];
 const repository=new MemoryPartitionRepository(),domains=new NarrativeDomainStore({repository,gmProvider:()=>createLocalGMContext({user:gm,epoch:'test'},'world')});
 const service=new PersistentQuestProjections({domains});
 function game(id){const callbacks=new Set();events.set(id,callbacks);return {user:users.get(id),users:{get:key=>users.get(key),get activeGM(){return gm;}},modules:{get:()=>({socket:true})},socket:{on:(name,cb)=>{assert.equal(name,MODULE_SOCKET);callbacks.add(cb);},off:(_n,cb)=>callbacks.delete(cb),emit:(_channel,packet,{recipients})=>{traffic.push({sender:id,recipients,packet:structuredClone(packet)});for(const to of recipients)for(const fn of events.get(to)??[])queueMicrotask(()=>fn(structuredClone(packet),id));}}};}
 const gmTransport=new NativeFoundryContinuityTransport({gameInstance:game(gm.id),actorAuthorization:async(userId,actorId)=>userId===hero.id&&actorId==='nativeActor001',resolveObserver:async()=> 'ep:actor:hero001',handoffs:{project:async()=>({recap:[]})},votes:{project:async()=>null},quests:service}).start();
 const playerTransport=new NativeFoundryContinuityTransport({gameInstance:game(hero.id)}).start();
 const strangerTransport=new NativeFoundryContinuityTransport({gameInstance:game(stranger.id)}).start();
 return {domains,service,playerTransport,strangerTransport,traffic,stop(){gmTransport.stop();playerTransport.stop();strangerTransport.stop();}};
}
async function publish(s){
 const old=await s.domains.save({type:'objective',scope:'world',id:'ep:objective:harbor001',sourceEventId:'ep:event:created001',data:{state:'active',gmNotes:'Only the GM knows who stole the manifest'}});
 const manifest={id:'ep:quest-publication:harbor001',questId:'ep:quest:harbor001',publicId:'ep:quest-public:harbor001',title:'A harbour lead',observerIds:['ep:actor:hero001'],objectives:[{objectiveId:old.id,publicId:'ep:objective-public:harbor001',expectedRevision:old.revision,status:'active',recipientIds:['ep:actor:hero001'],text:'Interview the watch captain'}]};
 const draft=await s.service.prepare({manifest,sourceEventId:'ep:event:draft001'});
 await s.service.approve({publicationId:manifest.id,expectedRevision:draft.revision,reviewEventId:'ep:event:review001'});
 return old;
}
test('native-targeted quest board is canonical, authorized and omits private notes',async()=>{
 const s=setup();await publish(s);
 const safe=await s.playerTransport.request({kind:'quest-board',recordId:'ep:quest-publication:harbor001',actorId:'nativeActor001'});
 assert.equal(safe.objectives.length,1);
 assert.equal(JSON.stringify(safe).includes('gmNotes'),false);
 assert.equal(JSON.stringify(s.traffic).includes('stole the manifest'),false);
 assert.deepEqual(s.traffic.map(t=>t.recipients),[['gm-user-001'],['player-user-001']]);
 s.stop();
});
test('recipient authorization and stale canonical changes fail closed on the transport',async()=>{
 const s=setup();const objective=await publish(s);
 await assert.rejects(s.strangerTransport.request({kind:'quest-board',recordId:'ep:quest-publication:harbor001',actorId:'nativeActor001'}),{code:'CONTINUITY_UNAVAILABLE'});
 await s.domains.save({type:'objective',scope:'world',id:objective.id,expectedRevision:objective.revision,sourceEventId:'ep:event:changed001',data:{state:'completed',gmNotes:'still secret'}});
 await assert.rejects(s.playerTransport.request({kind:'quest-board',recordId:'ep:quest-publication:harbor001',actorId:'nativeActor001'}),{code:'CONTINUITY_UNAVAILABLE'});
 assert.ok(s.traffic.filter(x=>x.packet.state==='unavailable').every(x=>!Object.hasOwn(x.packet,'value')));
 s.stop();
});
