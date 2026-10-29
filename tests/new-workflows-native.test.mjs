import test from 'node:test';import assert from 'node:assert/strict';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {DesignatedGMWriter} from '../src/security/gm-writer.mjs';
import {NativePackRepository} from '../src/storage/native-pack.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentSessionHandoff} from '../src/orchestration/persistent-session-handoff.mjs';
import {PersistentNarrativeNotifications} from '../src/orchestration/persistent-notifications.mjs';
import {ScopedNarrativeSearch} from '../src/orchestration/scoped-search.mjs';
import {GMFocusedHealthService} from '../src/orchestration/focused-health-service.mjs';
function makeNative(){
 const gm={id:'gm_main',isGM:true,active:true},player={id:'player_one',isGM:false,active:true};
 const game={user:gm,world:{id:'integration-world'},users:{contents:[gm,player],get activeGM(){return gm;}}};
 const stored=new Map();const pack={
  collection:'world.easy-plots-private',documentName:'JournalEntry',locked:false,metadata:{packageType:'world'},getUserLevel:()=>0,
  getDocuments:async({_id})=>{const item=stored.get(_id);if(!item)return [];
   return [{id:_id,getFlag:()=>structuredClone(item.flags['easy-plots'].storage),update:async data=>{
     item.flags['easy-plots'].storage=structuredClone(data['flags.easy-plots.storage']);
   }}];},
  documentClass:{createDocuments:async docs=>{for(const doc of docs){if(stored.has(doc._id))throw Error('Duplicate');stored.set(doc._id,structuredClone(doc));}return docs;}}
 };
 const attestation={level:'live-multiplayer',worldId:'integration-world',packId:pack.collection,coreBuild:'14.369',playerIndexDenied:true,playerDocumentDenied:true,playerBootstrapDenied:true};
 // TEST FIXTURE: attestation fields simulate a verified world, not live evidence.
 const gmProvider=()=>createLocalGMContext({user:gm,epoch:'native-suite'},game.world.id);
 const repo=new NativePackRepository({gameInstance:game,pack,attestation,coreBuild:'14.369',writer:new DesignatedGMWriter({gameInstance:game})});
 return {repo,gmProvider,stored};
}
test('scoped GM search, session handoff, and private notices persist across service reconstruction',async()=>{
 const {repo,gmProvider,stored}=makeNative();
 const domain=()=>new NarrativeDomainStore({repository:repo,gmProvider});
 const handoffs=new PersistentSessionHandoff({domains:domain()});
 const notifications=new PersistentNarrativeNotifications({domains:domain()});
 const search=new ScopedNarrativeSearch({repository:repo,gmProvider});
 const ids={sessionId:'ep:session:third001',sourceArcId:'ep:arc:waterdeep001',sourceEventId:'ep:event:archive001',reviewEventId:'ep:event:approval001',
  recipient:'ep:actor:hero001',notice:'ep:notice:harbor001'};
 const draft=await handoffs.prepare({sessionId:ids.sessionId,sourceArcId:ids.sourceArcId,sourceArcRevision:2,sourceEventId:ids.sourceEventId,worldTime:100,
  references:[{id:'ep:hook:officer001',kind:'story-hook',status:'dormant',note:'GM secret'}],
  recap:[{id:'ep:public:recap001',sourceEventId:ids.sourceEventId,text:'The harbor is safe',recipientIds:[ids.recipient]}]});
 await new PersistentSessionHandoff({domains:domain()}).approve({sessionId:ids.sessionId,expectedRevision:draft.revision,sourceArcRevision:2,reviewEventId:ids.reviewEventId});
 const queued=await notifications.queue({noticeId:ids.notice,recipientId:ids.recipient,sourceEventId:ids.sourceEventId,groupKey:'harbor-news',safeText:'The harbor is safe.',gmDetail:'Viper is Marrek'});
 await notifications.approve({noticeId:ids.notice,expectedRevision:queued.revision,approvalEventId:ids.reviewEventId});
 await search.index({entityId:'ep:npc:marrek001',title:'Captain Marrek',domain:'npc',keywords:['harbor','captain'],sourceEventId:ids.sourceEventId});
 const recap=await new PersistentSessionHandoff({domains:domain()}).project({sessionId:ids.sessionId,observerId:ids.recipient});
 const notice=await new PersistentNarrativeNotifications({domains:domain()}).project({noticeIds:[ids.notice],recipientId:ids.recipient,worldTime:1});
 const found=await new ScopedNarrativeSearch({repository:repo,gmProvider}).search({term:'captain'});
 assert.equal(recap.recap[0].text,'The harbor is safe');assert.equal(notice.notifications.length,1);assert.equal(found.results.length,1);
 assert.equal(JSON.stringify({recap,notice}).includes('Viper'),false);
 assert.equal(stored.size>=8,true,'Native index and record documents persisted');
});
test('focused native health reads exact records and cannot certify unindexed world completeness',async()=>{
 const {repo,gmProvider}=makeNative(),domains=new NarrativeDomainStore({repository:repo,gmProvider});
 await domains.save({type:'objective',scope:'world',id:'ep:objective:harbor001',data:{state:'unresolved'},sourceEventId:'ep:event:focus001'});
 const health=new GMFocusedHealthService({domains});
 const report=await health.inspect({arcId:'ep:arc:waterdeep001',worldTime:50,objectiveIds:['ep:objective:harbor001']});
 assert.equal(report.coverage,'partial');assert.equal(report.findings[0].kind,'unresolved-objective');
});
