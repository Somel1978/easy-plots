import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {PersistentGMFocus} from '../src/orchestration/persistent-gm-focus.mjs';
import {PersistentSessionPreparation} from '../src/orchestration/persistent-session-preparation.mjs';
import {PersistentGMPlans} from '../src/orchestration/persistent-plans.mjs';
import {PersistentSessionHandoff} from '../src/orchestration/persistent-session-handoff.mjs';
const sourceEventId='ep:event:session_preparation001',sessionId='ep:session:preparation001',objectiveId='ep:objective:session_preparation001',scheduleId='ep:schedule:session_preparation001';
async function setup(){
 const repository=new MemoryPartitionRepository(),user={id:'PreparationGM001',isGM:true},gm=createLocalGMContext({user,epoch:'preparation'},'world'),gmProvider=()=>gm;
 const domains=new NarrativeDomainStore({repository,gmProvider}),registry=new PersistentGraphRegistry({repository,gmProvider}),focus=new PersistentGMFocus({domains,gmProvider});
 const s={repository,user,gmProvider,domains,registry,focus},service=new PersistentSessionPreparation(s),models=[];
 for(const name of ['Harbor','Guild','Unrelated']){const model=new GraphEditorModel({registry});model.newGraph(name);await model.save();const graph=await model.publish();await model.activate(graph.publishedVersion);models.push(model);}
 const plots=models.map(m=>m.graph.id);await domains.save({type:'objective',scope:'world',id:objectiveId,data:{title:'Meet the pilot',state:'active'},sourceEventId});
 await domains.save({type:'scheduled-commitment',scope:'world',id:scheduleId,data:{title:'Guild meeting',status:'pending',dueWorldTime:100},sourceEventId});
 const pins=await service.pinPlots({graphIds:plots.slice(0,2),sourceEventId});
 const sourceRefs=[{plotId:plots[0],type:'objective',id:objectiveId,revision:1},{plotId:plots[1],type:'scheduled-commitment',id:scheduleId,revision:1}];
 return {...s,service,models,plots,pins,sourceRefs};
}
const prepare=(s,extra={})=>s.service.prepare({sessionId,sourceRefs:s.sourceRefs,expectedFocusRevision:s.pins.revision,sourceEventId,...extra});
test('ADR-051: next-session preparation loads only explicitly pinned active plots and named revisioned sources',async()=>{
 const s=await setup(),getActivation=s.registry.getActivation.bind(s.registry),getPublished=s.registry.getPublished.bind(s.registry),loads=[];
 s.registry.getActivation=async id=>{assert.notEqual(id,s.plots[2]);loads.push(id);return getActivation(id);};s.registry.getPublished=async(id,version)=>{assert.notEqual(id,s.plots[2]);return getPublished(id,version);};
 s.repository.query=async()=>{throw Error('Preparation cannot enumerate world records');};
 const row=await prepare(s);assert.equal(row.visibility,'gm-only');assert.deepEqual(row.data.plots.map(p=>p.graphId),s.plots.slice(0,2));assert.equal(row.data.sources.length,2);
 assert.equal(row.data.brief.sections.dueEvents[0].referenceId,scheduleId);assert.equal(row.data.brief.sections.unresolved[0].referenceId,objectiveId);assert.equal(row.data.effectsExecuted,0);assert.equal(row.data.gameEventsCreated,0);
 assert(loads.every(id=>s.plots.slice(0,2).includes(id)));assert.equal(row.data.published,false);assert.equal((await s.service.sourceStatus({sessionId})).status,'current');
 const handoffs=new PersistentSessionHandoff(s);assert.deepEqual(await handoffs.project({sessionId,observerId:'ep:actor:preparation_player001'}),{recap:[]});
 await assert.rejects(new PersistentGMPlans({domainStore:s.domains}).acknowledge({id:sessionId,expectedRevision:row.revision,approvalEventId:sourceEventId}),{code:'PLAN_STATE'});
});
test('preparation stays editable and preserves GM-authored agenda, private notes and historical source revisions after restart',async()=>{
 const s=await setup();let row=await prepare(s);row=await s.service.edit({sessionId,expectedRevision:row.revision,sourceEventId,notes:'The pilot is secretly compromised.',agenda:[{id:'ep:agenda:preparation001',text:'Open with the pilot meeting',referenceIds:[objectiveId]}]});
 const restarted=new PersistentSessionPreparation(s);assert.equal((await restarted.read({sessionId})).data.notes,row.data.notes);
 await s.domains.save({type:'objective',scope:'world',id:objectiveId,data:{title:'Pilot missing',state:'failed'},expectedRevision:1,sourceEventId:'ep:event:preparation_change001'});
 assert.equal((await restarted.sourceStatus({sessionId})).status,'sources-changed');
 const edited=await restarted.edit({sessionId,expectedRevision:row.revision,sourceEventId,notes:'Reconsider the opening',agenda:row.data.agenda});assert.equal(edited.data.sources[0].revision,1);assert.equal(edited.data.sources[0].label,'Meet the pilot');
 const refreshed=await restarted.prepare({sessionId,sourceEventId,expectedRevision:edited.revision,expectedFocusRevision:s.pins.revision,sourceRefs:[{...s.sourceRefs[0],revision:2},s.sourceRefs[1]]});
 assert.equal(refreshed.data.sources[0].revision,2);assert.equal(refreshed.data.notes,'Reconsider the opening');assert.deepEqual(refreshed.data.agenda,row.data.agenda);
 assert.equal((await s.domains.readRevision('objective','world',objectiveId,1)).data.title,'Meet the pilot');assert.equal((await s.domains.readRevision('review-plan','world',sessionId,1)).data.sources[0].revision,1);
 await assert.rejects(restarted.edit({sessionId,expectedRevision:1,sourceEventId,notes:'stale',agenda:[]}),{code:'REVISION_CONFLICT'});
});
test('pinned publication and activation revisions are exact; draft edits cannot silently rebase a preparation',async()=>{
 const s=await setup(),row=await prepare(s),model=s.models[0];model.rename('Changed draft');await model.save();await model.publish();
 assert.equal((await s.service.sourceStatus({sessionId})).status,'current');assert.equal(row.data.plots[0].publishedVersion,1);
 await model.activate(model.graph.revision);await assert.rejects(prepare(s,{sessionId:'ep:session:new_preparation001'}),{code:'SESSION_PREPARATION_STALE'});
 assert.equal((await s.service.sourceStatus({sessionId})).stale.some(x=>x.kind==='plot'),true);
 const newPins=await s.service.pinPlots({graphIds:s.plots.slice(0,2),expectedFocusRevision:s.pins.revision,sourceEventId});
 assert.notEqual(newPins.data.sessionPlotRefs[0].publishedVersion,1);assert.equal((await s.service.read({sessionId})).data.plots[0].publishedVersion,1);
 await assert.rejects(s.service.prepare({sessionId:'ep:session:stale_focus001',sourceRefs:[],expectedFocusRevision:s.pins.revision,sourceEventId}),{code:'REVISION_CONFLICT'});
});
test('session preparation rejects unpinned references, guessed revisions, oversized pins and inactive named plots',async()=>{
 const s=await setup();await assert.rejects(prepare(s,{sourceRefs:[{...s.sourceRefs[0],plotId:s.plots[2]}]}),{code:'SESSION_PREPARATION_REFERENCE'});
 await assert.rejects(prepare(s,{sourceRefs:[{...s.sourceRefs[0],revision:9}]}),{code:'SESSION_PREPARATION_STALE'});
 await assert.rejects(s.service.pinPlots({graphIds:new Array(9).fill(s.plots[0]),expectedFocusRevision:s.pins.revision,sourceEventId}),{code:'SESSION_PREPARATION_PINS'});
 const active=await s.registry.getActivation(s.plots[1]);await s.registry.deactivate(s.plots[1],{expectedActivationRevision:active.revision});
 await assert.rejects(s.service.pinPlots({graphIds:s.plots.slice(0,2),expectedFocusRevision:s.pins.revision,sourceEventId}),{code:'SESSION_PREPARATION_INACTIVE'});
 assert.equal(await s.service.read({sessionId}),null);
});
test('GM ownership and authority are rechecked after asynchronous graph loads before saving private preparation',async()=>{
 const s=await setup(),get=s.registry.getPublished.bind(s.registry);s.registry.getPublished=async(...args)=>{const result=await get(...args);s.user.isGM=false;return result;};
 await assert.rejects(prepare(s),{code:'GM_AUTHORITY_REVOKED'});s.user.isGM=true;assert.equal(await s.service.read({sessionId}),null);
 s.registry.getPublished=get;await prepare(s);const gm2=createLocalGMContext({user:{id:'OtherPreparationGM001',isGM:true}},'world'),other=new PersistentSessionPreparation({...s,gmProvider:()=>gm2});
 await assert.rejects(other.read({sessionId}),{code:'SESSION_PREPARATION_OWNER'});
});
