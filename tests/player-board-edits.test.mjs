import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {GMInvestigationWorkbench} from '../src/orchestration/investigation-workbench.mjs';
import {PlayerBoardEdits} from '../src/orchestration/player-board-edits.mjs';
import {createPlayerBoardEditProvider} from '../src/runtime/player-board-edit-provider.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {GMManualEventGateway} from '../src/runtime/manual-event-gateway.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {NativeFoundryBoardTransport} from '../src/platform/foundry-board-transport.mjs';
import {MODULE_SOCKET} from '../src/platform/foundry-socket.mjs';
const investigationId='ep:investigation:player_edits001',observerId='ep:actor:board_author001',clueId='ep:evidence:private_clue001',publicClue='ep:clue-public:visible_clue001';
const verifiedUserId='PLAYER-author001',actorId='nativeActor-author001';
async function setup(){
 const repository=new MemoryPartitionRepository(),user={id:'GM-board-edits001',isGM:true,active:true},context=createLocalGMContext({user,epoch:'board-edits'},'world'),gmProvider=()=>context,writer={assertEligible:()=>{}},access={allowed:true};
 const domains=new NarrativeDomainStore({repository,gmProvider}),workbench=new GMInvestigationWorkbench({domains}),catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})}),ledger=new DurableEventLedger({repository,gmProvider}),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 const manualEvents=new GMManualEventGateway({router,gmProvider,writer,worldId:'world'}),actorAuthorization=async(user,id)=>access.allowed&&user===verifiedUserId&&id===actorId,resolveObserver=async()=>observerId;
 const compose=()=>new PlayerBoardEdits({domains,workbench,actorAuthorization,resolveObserver,gmProvider,writer,manualEvents}),service=compose(),providers=new EffectProviderRegistry();providers.register(createPlayerBoardEditProvider({service,gmProvider}));
 const journal=new MemoryOperationJournal(),reviews=new DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal});
 await domains.save({type:'investigation',scope:'world',id:investigationId,sourceEventId:'ep:event:board_edit_setup001',data:{title:'The harbor mystery',canonicalTruth:'SECRET-CULPRIT-UNEXPOSED',evidence:[{id:clueId,publicId:publicClue,publicTitle:'Cargo note',publicSummary:'A shipping clue',canonicalSecret:'SECRET-CARGO-DETAIL',disclosedTo:[observerId]},{id:'ep:evidence:entirely_hidden001',title:'HIDDEN-ITEM-DO-NOT-LEAK',disclosedTo:[]}],theories:[],opportunities:[]}});
 const model=new GraphEditorModel({registry});model.newGraph('Review player board edits');model.setRootTriggerType('core.trigger.manual');model.updateSelected({eventType:'narrative.board-edit-reviewed'});
 const request=model.addNode('core.data.event');model.updateSelected({payloadJSON:'{"valueType":"entity","path":["payload","editRequestId"]}'});const revision=model.addNode('core.data.event');model.updateSelected({payloadJSON:'{"valueType":"number","path":["payload","expectedRequestRevision"]}'});
 const effect=model.addNode('core.investigation.apply-board-edit');model.bindSelectedInput({field:'requestId',sourceNodeId:request});model.bindSelectedInput({field:'expectedRequestRevision',sourceNodeId:revision});model.connect(model.graph.rootNodeId,effect);await model.save();const graph=await model.publish();await model.activate(graph.publishedVersion);
 const identity={verifiedUserId,actorId,investigationId},board=await service.projectionForPlayer(identity),edit={editToken:board.editToken,title:'The cargo was diverted',reasoning:'The note names another destination',arguments:[{evidenceId:publicClue,direction:'support'}]};
 const capture=async(editValue=edit,requestId='client-board-edit001')=>{const receipt=await service.capture({...identity,requestId,edit:editValue});const rows=await service.list();return {receipt,row:rows.items.find(r=>r.data.clientRequestId===requestId)};};
 const approve=async row=>{const event=await service.queueForGMReview({id:row.id,expectedRevision:row.revision}),proposal=(await ledger.get(event.eventId)).proposals[0];await reviews.decide(event.eventId,proposal.operationId,{approve:true});return {event,proposal,execute:()=>reviews.execute(event.eventId,proposal.operationId)};};
 return {repository,user,gmProvider,writer,domains,workbench,catalog,registry,ledger,router,manualEvents,service,compose,providers,journal,reviews,access,actorAuthorization,identity,board,edit,capture,approve};
}
test('ADR-043: structured public-evidence edits persist privately and enter the board only through separately approved graph effects',async()=>{
 const s=await setup(),{receipt,row}=await s.capture();assert.deepEqual(receipt,{state:'pending',requestId:'client-board-edit001'});assert.equal((await s.workbench.read({investigationId})).data.theories.length,0);assert.equal(row.data.canonicalArguments[0].evidenceId,clueId);
 const review=await s.approve(row);assert.equal((await s.workbench.read({investigationId})).data.theories.length,0);assert.equal((await review.execute()).status,'completed');
 const board=await s.compose().projectionForPlayer(s.identity);assert.equal(board.theories.length,1);assert.equal(board.theories[0].canEdit,true);assert.deepEqual(board.theories[0].supportEvidenceIds,[publicClue]);
 for(const secret of ['SECRET-','HIDDEN-ITEM',clueId,row.id,row.data.hypothesisId,verifiedUserId,actorId])assert.equal(JSON.stringify(board).includes(secret),false,secret);
 const completed=await s.service.read({id:row.id});assert.equal(completed.data.state,'completed');assert.equal(await s.service.verify({scope:'world',requestId:row.id,expectedRequestRevision:1,shareWith:[]},{sourceEventId:review.event.eventId,operationId:review.proposal.operationId}),true);
 assert.equal((await s.service.capture({...s.identity,requestId:'client-board-edit001',edit:s.edit})).state,'pending');assert.equal((await s.workbench.read({investigationId})).data.theories.length,1);
 await assert.rejects(()=>s.service.queueForGMReview({id:row.id,expectedRevision:completed.revision}),{code:'BOARD_EDIT_FINAL'});
});
test('an approved revision supersedes only the author own theory while preserving its earlier canonical history',async()=>{
 const s=await setup(),first=await s.capture();await (await s.approve(first.row)).execute();const board=await s.service.projectionForPlayer(s.identity);
 const revised={...s.edit,editToken:board.editToken,title:'Revised cargo theory',replacesPublicTheoryId:board.theories[0].id,arguments:[{evidenceId:publicClue,direction:'contradict'}]},second=await s.capture(revised,'client-board-edit002');assert.equal((await s.service.projectionForPlayer(s.identity)).theories[0].title,s.edit.title);
 await (await s.approve(second.row)).execute();const current=await s.service.projectionForPlayer(s.identity);assert.equal(current.theories.length,1);assert.equal(current.theories[0].title,revised.title);assert.deepEqual(current.theories[0].contradictionEvidenceIds,[publicClue]);
 const canonical=await s.workbench.read({investigationId});assert.equal(canonical.data.theories.length,2);assert.equal(canonical.data.theories[0].reviewStatus,'superseded');assert.equal((await s.domains.readRevision('investigation','world',investigationId,2)).data.theories[0].reviewStatus,'gm-reviewed');assert.equal(canonical.data.canonicalTruth,'SECRET-CULPRIT-UNEXPOSED');
});
test('hidden changes do not alter the public token, but private revision changes block stale GM application',async()=>{
 const s=await setup(),pending=await s.capture(),record=await s.workbench.read({investigationId});await s.domains.save({type:'investigation',scope:'world',id:investigationId,expectedRevision:record.revision,sourceEventId:'ep:event:hidden_board_change001',data:{...record.data,canonicalTruth:'A different secret'}});
 const board=await s.service.projectionForPlayer(s.identity);assert.equal(board.editToken,s.board.editToken);await assert.rejects(()=>s.service.queueForGMReview({id:pending.row.id,expectedRevision:pending.row.revision}),{code:'BOARD_EDIT_STALE'});assert.equal((await s.workbench.read({investigationId})).data.theories.length,0);
 const dismissed=await s.service.dismiss({id:pending.row.id,expectedRevision:1,reason:'Investigation changed; request a new reviewed submission',reviewEventId:'ep:event:board_dismiss001'});assert.equal(dismissed.data.state,'dismissed');assert.equal((await s.service.capture({...s.identity,requestId:'client-board-edit001',edit:s.edit})).state,'pending');
});
test('ownership, hidden evidence, changed public snapshots, reused request IDs and truth-oracle fields fail closed',async()=>{
 const s=await setup();await assert.rejects(()=>s.capture({...s.edit,canonicalTruth:'guess'}),{code:'BOARD_EDIT_CONTRACT'});await assert.rejects(()=>s.capture({...s.edit,arguments:[{evidenceId:clueId,direction:'support'}]}),{code:'BOARD_EDIT_EVIDENCE'});await assert.rejects(()=>s.capture({...s.edit,editToken:'0'.repeat(64)}),{code:'BOARD_EDIT_STALE'});
 await s.capture();await assert.rejects(()=>s.capture({...s.edit,title:'Changed same request'}),{code:'BOARD_EDIT_REUSE'});
 s.access.allowed=false;await assert.rejects(()=>s.service.projectionForPlayer(s.identity),{code:'BOARD_EDIT_DENIED'});await assert.rejects(()=>s.service.capture({...s.identity,requestId:'another-client-edit001',edit:s.edit}),{code:'BOARD_EDIT_DENIED'});
 s.user.isGM=false;await assert.rejects(()=>s.service.list(),{code:'GM_AUTHORITY_REVOKED'});
});
test('private boards with no disclosed membership or content are unavailable to guessed investigation requests',async()=>{
 const s=await setup(),hidden='ep:investigation:unknown_hidden001';await s.domains.save({type:'investigation',scope:'world',id:hidden,sourceEventId:'ep:event:hidden_board_setup001',data:{title:'HIDDEN-BOARD-TITLE',evidence:[],theories:[],opportunities:[]}});
 await assert.rejects(()=>s.service.projectionForPlayer({...s.identity,investigationId:hidden}),{code:'BOARD_EDIT_DENIED'});
});
test('Actor ownership revocation while the protected board is loading prevents delivery',async()=>{
 const s=await setup(),snapshot=s.workbench.boardSnapshotForObserver.bind(s.workbench);s.workbench.boardSnapshotForObserver=async spec=>{const result=await snapshot(spec);s.access.allowed=false;return result;};
 await assert.rejects(()=>s.service.projectionForPlayer(s.identity),{code:'BOARD_EDIT_DENIED'});
});
test('captured request content is fingerprinted independently of later approval status changes',async()=>{
 const s=await setup(),pending=await s.capture();await s.domains.save({type:'board-edit-request',scope:'world',id:pending.row.id,expectedRevision:pending.row.revision,sourceEventId:'ep:event:corrupted_player_edit001',data:{...pending.row.data,edit:{...pending.row.data.edit,title:'Altered after capture'}}});
 await assert.rejects(()=>s.service.read({id:pending.row.id}),{code:'BOARD_EDIT_CORRUPT'});await assert.rejects(()=>s.service.list(),{code:'BOARD_EDIT_CORRUPT'});assert.equal((await s.workbench.read({investigationId})).data.theories.length,0);
});
test('interruption after canonical theory write preserves uncertainty and prevents dismissal or automatic duplicate application',async()=>{
 const s=await setup(),pending=await s.capture(),review=await s.approve(pending.row),save=s.domains.save.bind(s.domains);
 s.domains.save=async spec=>{if(spec.type==='board-edit-request'&&spec.data.state==='completed')throw Error('request completion interrupted');return save(spec);};
 assert.equal((await review.execute()).status,'uncertain');assert.equal((await s.workbench.read({investigationId})).data.theories.length,1);assert.equal((await s.service.read({id:pending.row.id})).data.state,'pending');
 await assert.rejects(()=>s.service.dismiss({id:pending.row.id,expectedRevision:1,reason:'Do not erase evidence of the uncertain operation',reviewEventId:'ep:event:board_uncertain_dismiss001'}),{code:'BOARD_EDIT_RECONCILIATION_REQUIRED'});
 await assert.rejects(()=>review.execute(),{code:'APPROVAL_REQUIRED'});assert.equal((await s.workbench.read({investigationId})).data.theories.length,1);
});
test('native board edit transport authenticates the socket sender and returns only a generic targeted receipt',async()=>{
 const s=await setup(),users=new Map([[s.user.id,s.user],[verifiedUserId,{id:verifiedUserId,isGM:false,active:true}],['PLAYER-stranger001',{id:'PLAYER-stranger001',isGM:false,active:true}]]),listeners=new Map(),traffic=[];
 const game=id=>({user:users.get(id),users:{get:id=>users.get(id),get activeGM(){return s.user;}},modules:{get:()=>({socket:true})},socket:{on:(name,fn)=>{assert.equal(name,MODULE_SOCKET);listeners.set(id,fn);},off:()=>listeners.delete(id),emit:(name,packet,{recipients})=>{assert.ok(recipients.length===1);traffic.push({from:id,to:recipients,packet:structuredClone(packet)});for(const target of recipients)queueMicrotask(()=>listeners.get(target)?.(structuredClone(packet),id));}}});
 const gmGame=game(s.user.id),playerGame=game(verifiedUserId),strangerGame=game('PLAYER-stranger001'),gm=new NativeFoundryBoardTransport({gameInstance:gmGame,actorAuthorization:s.actorAuthorization,loadBoard:spec=>s.service.projectionForPlayer(spec),onSubmitEdit:spec=>s.service.capture(spec)}),player=new NativeFoundryBoardTransport({gameInstance:playerGame});gm.start();player.start();
 try{
  const board=await player.request({investigationId,actorId});assert.equal(board.version,2);const receipt=await player.submitEdit({investigationId,actorId,edit:{...s.edit,editToken:board.editToken}},{requestId:'native-client-edit001'});assert.deepEqual(receipt,{state:'pending',requestId:'native-client-edit001'});
  assert.deepEqual(Object.keys(traffic.at(-1).packet).sort(),['kind','requestId','state','version']);assert.equal((await s.workbench.read({investigationId})).data.theories.length,0);assert.equal((await s.service.list()).items.length,1);
  strangerGame.socket.emit(MODULE_SOCKET,{kind:'board.edit',version:1,requestId:'forged-board-edit001',investigationId,actorId,claimedUserId:verifiedUserId,edit:s.edit},{recipients:[s.user.id]});await new Promise(r=>setTimeout(r,10));assert.deepEqual(traffic.at(-1).to,['PLAYER-stranger001']);assert.equal(traffic.at(-1).packet.state,'unavailable');assert.equal((await s.service.list()).items.length,1);
  for(const secret of ['SECRET-CULPRIT','SECRET-CARGO','HIDDEN-ITEM',clueId])assert.equal(JSON.stringify(traffic).includes(secret),false,secret);
 }finally{gm.stop();player.stop();}
});
