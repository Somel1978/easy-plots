import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PlotAuthoringAuthority} from '../src/security/plot-authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {makeEditableGraph,GraphEditorModel} from '../src/editor/model.mjs';
function setup(){
 const first={id:'GM_OWNER_001',isGM:true,active:true},second={id:'GM_OWNER_002',isGM:true,active:true},third={id:'GM_EDITOR_003',isGM:true,active:true},player={id:'PLAYER_004',isGM:false,active:true},users=new Map([first,second,third,player].map(u=>[u.id,u])),game={user:first,world:{id:'authority-world'},users:{get:id=>users.get(id),activeGM:first}},context=createLocalGMContext({user:first,epoch:'authority'},game.world.id),gmProvider=()=>context,writer={state:{generation:0},assertEligible:gm=>assert.equal(gm.userId,first.id)},repository=new MemoryPartitionRepository(),domains=new NarrativeDomainStore({repository,gmProvider});let base;
 const authority=new PlotAuthoringAuthority({domains,gmProvider,writer,gameInstance:game,readGraph:id=>base.getDraft(id)});base=new PersistentGraphRegistry({repository,gmProvider,authoring:authority});const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({registry:base,catalog});let requests=0;const requester=user=>authority.issueRequester({verifiedUserId:user.id,requestId:`authority-request-${++requests}`});
 return {first,second,third,player,users,game,context,gmProvider,writer,repository,domains,authority,base,catalog,registry,requester};
}
test('ADR-018: two GMs own different plots; another GM cannot edit, publish or activate the other plot',async()=>{
 const s=setup(),one=makeEditableGraph({title:'First GM plot'}),two=makeEditableGraph({title:'Second GM plot'}),second=s.requester(s.second);await s.registry.saveDraft(one);await s.registry.saveDraft(two,{requesterContext:second});
 assert.equal((await s.authority.inspect(one.id)).ownerUserId,s.first.id);assert.equal((await s.authority.inspect(two.id,{requesterContext:second})).ownerUserId,s.second.id);
 await assert.rejects(s.registry.saveDraft({...one,title:'Unauthorized change'},{expectedRevision:1,requesterContext:second}),{code:'PLOT_AUTHORING_DENIED'});await assert.rejects(s.registry.publish(one.id,{expectedRevision:1,requesterContext:second}),{code:'PLOT_AUTHORING_DENIED'});await s.registry.publish(one.id,{expectedRevision:1});
 let stages=0;const stage=s.catalog.stage.bind(s.catalog);s.catalog.stage=async graph=>{stages++;return stage(graph);};await assert.rejects(s.registry.activate(one.id,1,{requesterContext:second}),{code:'PLOT_AUTHORING_DENIED'});assert.equal(stages,0);assert.equal(await s.registry.getActive(one.id),null);
 assert.equal((await s.registry.publish(two.id,{expectedRevision:1,requesterContext:second})).publishedVersion,1);await assert.rejects(s.registry.publish(two.id,{expectedRevision:1}),{code:'PLOT_AUTHORING_DENIED'});assert.equal((await s.registry.getDraft(one.id)).title,'First GM plot');
});
test('delegated edit rights do not imply publication or activation and revocation takes effect before a later write',async()=>{
 const s=setup(),g=makeEditableGraph({title:'Delegated editing'});await s.registry.saveDraft(g);let policy=await s.authority.read(g.id);await s.authority.update({graphId:g.id,expectedRevision:policy.revision,delegates:[{userId:s.second.id,actions:['edit']}],reason:'Delegate drafting only'});const second=s.requester(s.second),changed=await s.registry.saveDraft({...g,title:'Second GM draft'},{expectedRevision:1,requesterContext:second});assert.equal(changed.revision,2);
 await assert.rejects(s.registry.publish(g.id,{expectedRevision:2,requesterContext:second}),{code:'PLOT_AUTHORING_DENIED'});policy=await s.authority.read(g.id);await s.authority.update({graphId:g.id,expectedRevision:policy.revision,delegates:[],reason:'Revoke delegated drafting'});await assert.rejects(s.registry.saveDraft({...changed,title:'Revoked change'},{expectedRevision:2,requesterContext:second}),{code:'PLOT_AUTHORING_DENIED'});assert.equal((await s.registry.getDraft(g.id)).revision,2);
});
test('only the plot owner can delegate or transfer; transfer preserves prior authority without merging privileges',async()=>{
 const s=setup(),g=makeEditableGraph({title:'Transfer ownership'});await s.registry.saveDraft(g);const old=await s.authority.read(g.id),second=s.requester(s.second);await assert.rejects(s.authority.update({graphId:g.id,expectedRevision:old.revision,delegates:[{userId:s.third.id,actions:['edit']}],reason:'Not the owner',requesterContext:second}),{code:'PLOT_AUTHORITY_OWNER'});
 await s.authority.update({graphId:g.id,expectedRevision:old.revision,ownerUserId:s.second.id,reason:'Transfer this plot to the second GM'});assert.equal((await s.authority.inspect(g.id,{requesterContext:second})).rights.publish,true);assert.equal((await s.authority.inspect(g.id)).rights.edit,false);const current=await s.authority.read(g.id);assert.deepEqual(current.data.delegates,[]);assert.equal(current.data.history[0].ownerUserId,s.first.id);assert.equal((await s.domains.readRevision('plot-authority','main',old.id,1)).data.ownerUserId,s.first.id);
});
test('forged requester fields, player senders, coordinator generation changes and GM role loss cannot confer authoring rights',async()=>{
 const s=setup(),g=makeEditableGraph({title:'Verified requester'});await s.registry.saveDraft(g);await assert.rejects(s.authority.authorize(g.id,'edit',{requesterContext:{userId:s.first.id,worldId:s.game.world.id}}),{code:'PLOT_REQUEST_UNVERIFIED'});assert.throws(()=>s.requester(s.player),{code:'PLOT_AUTHOR_REQUIRED'});
 const second=s.requester(s.second);s.second.isGM=false;await assert.rejects(s.authority.inspect(g.id,{requesterContext:second}),{code:'PLOT_AUTHOR_REQUIRED'});s.second.isGM=true;s.writer.state.generation++;await assert.rejects(s.authority.inspect(g.id,{requesterContext:second}),{code:'PLOT_REQUEST_UNVERIFIED'});
});
test('revoked GM delegates can be removed; an unavailable owner requires explicit coordinator recovery',async()=>{
 const s=setup(),g=makeEditableGraph({title:'Owner recovery'});await s.registry.saveDraft(g);let row=await s.authority.read(g.id);await s.authority.update({graphId:g.id,expectedRevision:row.revision,delegates:[{userId:s.third.id,actions:['edit']}],reason:'A temporary editor'});s.third.isGM=false;row=await s.authority.read(g.id);await s.authority.update({graphId:g.id,expectedRevision:row.revision,delegates:[],reason:'Remove revoked GM grant'});row=await s.authority.read(g.id);await s.authority.update({graphId:g.id,expectedRevision:row.revision,ownerUserId:s.second.id,reason:'Second GM owns this session plot'});row=await s.authority.read(g.id);
 await assert.rejects(s.authority.update({graphId:g.id,expectedRevision:row.revision,ownerUserId:s.first.id,recover:true,reason:'Owner is still available'}),{code:'PLOT_AUTHORITY_OWNER'});s.second.active=false;assert.equal((await s.authority.inspect(g.id)).canRecover,true);await s.authority.update({graphId:g.id,expectedRevision:row.revision,ownerUserId:s.first.id,recover:true,reason:'The owner disconnected; coordinator reviewed takeover'});assert.equal((await s.authority.inspect(g.id)).rights.edit,true);
});
test('existing legacy drafts require reviewed adoption of their exact revision before ownership enforcement permits writes',async()=>{
 const s=setup(),legacy=new PersistentGraphRegistry({repository:s.repository,gmProvider:s.gmProvider}),g=makeEditableGraph({title:'Imported legacy plot'});await legacy.saveDraft(g);await assert.rejects(s.registry.saveDraft(g,{expectedRevision:1}),{code:'PLOT_OWNER_UNASSIGNED'});await assert.rejects(s.authority.adoptLegacy({graphId:g.id,expectedDraftRevision:99,ownerUserId:s.first.id,reason:'Wrong legacy revision'}),{code:'PLOT_LEGACY_SOURCE_STALE'});
 await s.authority.adoptLegacy({graphId:g.id,expectedDraftRevision:1,ownerUserId:s.first.id,reason:'Reviewed imported draft ownership'});assert.equal((await s.registry.publish(g.id,{expectedRevision:1})).publishedVersion,1);await assert.rejects(s.authority.adoptLegacy({graphId:g.id,expectedDraftRevision:1,ownerUserId:s.second.id,reason:'Cannot overwrite established ownership'}),{code:'REVISION_CONFLICT'});
});
test('the local editor does not mutate a loaded plot owned by another GM',async()=>{
 const s=setup(),g=makeEditableGraph({title:'Read-only local view'});await s.registry.saveDraft(g,{requesterContext:s.requester(s.second)});const model=new GraphEditorModel({registry:s.registry});await model.load(g.id);await assert.rejects(async()=>model.rename('Unauthorized local rename'),{code:'PLOT_AUTHORING_DENIED'});assert.equal(model.graph.title,'Read-only local view');assert.equal(model.state.dirty,false);
});
test('a known authority index without its payload cannot be mistaken for an unowned new plot',async()=>{
 const s=setup(),g=makeEditableGraph();s.domains.hasRecordOrIndex=async type=>type==='plot-authority';await assert.rejects(s.registry.saveDraft(g),{code:'PLOT_AUTHORITY_UNCERTAIN'});assert.equal(await s.base.getDraft(g.id),null);
});
