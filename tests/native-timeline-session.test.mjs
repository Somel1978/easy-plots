import test from 'node:test';
import assert from 'node:assert/strict';
import {syntheticNativeWorld} from './helpers/native-world.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
const sourceEventId='ep:event:native_timeline_session_seed001';
function forbidCampaignScans(api){
 api.repository.query=async()=>{throw Error('Campaign record enumeration forbidden');};
 api.graphRegistry.listDrafts=async()=>{throw Error('All-plot discovery forbidden');};
 api.graphRegistry.listActive=async()=>{throw Error('All-active discovery forbidden');};
}
async function publishPlot(api,title,payload=null){
 const model=new GraphEditorModel({registry:api.graphRegistry});model.newGraph(title);
 if(payload){const node=model.addNode('core.world.fact');model.updateSelected({payloadJSON:JSON.stringify(payload)});model.connect(model.graph.rootNodeId,node);}
 await model.save();const published=await model.publish();await model.activate(published.publishedVersion);return {model,published};
}
test('ADR-039: native Compendium preserves isolated branch lineage and source-proven canonical selection across reconstruction',async()=>{
 const world=syntheticNativeWorld(),timelineId='ep:timeline:native_harbor001',live='ep:branch:native_live001',alternate='ep:branch:native_alternate001',factId='ep:fact:native_harbor001';let api=world.instantiate();
 await api.domains.save({type:'world-fact',scope:'world',id:factId,data:{status:'asserted',value:'open'},sourceEventId});
 const sourceRefs=revision=>[{id:factId,key:'harbor',revision}],actualBefore=await api.domains.read('world-fact','world',factId);
 await api.timelineBranches.create({timelineId,branchId:live,sourceRefs:sourceRefs(1),sourceEventId});
 const fork=await api.timelineBranches.branch({timelineId,branchId:alternate,parentBranchId:live,parentVersion:1,label:'Closed harbor alternate',hypotheses:[{key:'harbor',value:'closed'}],expectedRevision:1,sourceEventId});
 assert.deepEqual(await api.domains.read('world-fact','world',factId),actualBefore);assert.equal(fork.visibility,'gm-only');
 api=world.instantiate();forbidCampaignScans(api);
 const version=await api.timelineBranches.version({timelineId,branchId:alternate,version:1});assert.deepEqual(version.data.parent,{branchId:live,version:1});assert.equal(version.data.sourceRefs[0].revision,1);assert.equal(version.data.preview.hypotheticalFacts.harbor,'closed');assert.equal(version.data.preview.effectsExecuted,0);
 assert.equal((await api.timelineBranches.canonical({timelineId})).branchId,live);
 const selection={timelineId,branchId:alternate,version:1,sourceRefs:sourceRefs(1),expectedRevision:fork.revision,reviewEventId:'ep:event:native_timeline_select001'};
 await assert.rejects(api.timelineBranches.selectCanonical(selection),{code:'TIMELINE_NOT_CANONICAL'});
 const {published}=await publishPlot(api,'Establish actual harbor closure',{scope:'world',factId,value:'closed',status:'asserted',expectedRevision:1});
 const eventId='ep:event:native_timeline_fact_change001';await api.reactiveRouter.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true}});
 const proposal=(await api.eventLedger.get(eventId)).proposals.find(p=>p.graphId===published.id);assert(proposal);
 await api.reviews.decide(eventId,proposal.operationId,{approve:true});assert.equal((await api.reviews.execute(eventId,proposal.operationId)).status,'completed');
 api=world.instantiate();forbidCampaignScans(api);const established=await api.domains.read('world-fact','world',factId);assert.equal(established.data.value,'closed');assert.equal(established.effectReceipt.operationId,proposal.operationId);assert.equal(established.revision,2);
 const selected=await api.timelineBranches.selectCanonical({...selection,sourceRefs:sourceRefs(2)});assert.equal(selected.data.canonical.branchId,alternate);assert.deepEqual(await api.domains.read('world-fact','world',factId),established);assert.equal(await api.eventLedger.get(selection.reviewEventId),null);
 api=world.instantiate();forbidCampaignScans(api);const canonical=await api.timelineBranches.canonical({timelineId});assert.equal(canonical.status,'current-canonical-sources');assert.deepEqual(canonical.facts,{harbor:'closed'});assert.equal(canonical.branchId,alternate);
 assert.equal((await api.timelineBranches.version({timelineId,branchId:live,version:1})).data.preview.hypotheticalFacts.harbor,'open');assert.equal((await api.domains.readRevision('world-fact','world',factId,1)).data.value,'open');
 await assert.rejects(api.timelineBranches.selectCanonical({...selection,sourceRefs:sourceRefs(2)}),{code:'REVISION_CONFLICT'});
 assert(world.observations.fetches.length>0);assert.equal(api.runtimeStatus().running,false);
});
test('ADR-051: native Compendium preserves named active plot preparation, exact sources and GM ownership without campaign scans',async()=>{
 const world=syntheticNativeWorld(),sessionId='ep:session:native_preparation001',objectiveId='ep:objective:native_preparation001';let api=world.instantiate();const plots=[];
 for(const title of ['Harbor session','Guild session','Unrelated active plot'])plots.push((await publishPlot(api,title)).published.id);
 await api.domains.save({type:'objective',scope:'world',id:objectiveId,data:{title:'Meet the harbor pilot',state:'active'},sourceEventId});
 const pins=await api.sessionPreparation.pinPlots({graphIds:plots.slice(0,2),sourceEventId});
 forbidCampaignScans(api);const getPublished=api.graphRegistry.getPublished.bind(api.graphRegistry),getActivation=api.graphRegistry.getActivation.bind(api.graphRegistry),visited=[];
 api.graphRegistry.getPublished=async(id,version)=>{assert.notEqual(id,plots[2]);visited.push(id);return getPublished(id,version);};api.graphRegistry.getActivation=async id=>{assert.notEqual(id,plots[2]);return getActivation(id);};
 const sourceRefs=[{plotId:plots[0],type:'objective',id:objectiveId,revision:1}];let prepared=await api.sessionPreparation.prepare({sessionId,sourceRefs,expectedFocusRevision:pins.revision,sourceEventId});
 prepared=await api.sessionPreparation.edit({sessionId,expectedRevision:prepared.revision,sourceEventId,notes:'The pilot is secretly compromised.',agenda:[{id:'ep:agenda:native_preparation001',text:'Start with the pilot',referenceIds:[objectiveId]}]});
 assert(visited.length>0);assert(visited.every(id=>plots.slice(0,2).includes(id)));assert.equal(prepared.visibility,'gm-only');assert.equal(prepared.data.ownerUserId,world.game.user.id);
 api=world.instantiate();forbidCampaignScans(api);const restored=await api.sessionPreparation.read({sessionId});assert.equal(restored.data.notes,prepared.data.notes);assert.deepEqual(restored.data.plots.map(p=>p.graphId),plots.slice(0,2));assert.equal(restored.data.sources[0].revision,1);assert.equal((await api.sessionPreparation.pins()).revision,pins.revision);
 await api.domains.save({type:'objective',scope:'world',id:objectiveId,data:{title:'Pilot disappeared',state:'failed'},expectedRevision:1,sourceEventId:'ep:event:native_preparation_source_change001'});
 assert.equal((await api.sessionPreparation.sourceStatus({sessionId})).status,'sources-changed');assert.equal((await api.sessionPreparation.read({sessionId})).data.sources[0].label,'Meet the harbor pilot');
 const refreshed=await api.sessionPreparation.prepare({sessionId,sourceRefs:[{...sourceRefs[0],revision:2}],expectedRevision:restored.revision,expectedFocusRevision:pins.revision,sourceEventId:'ep:event:native_preparation_refresh001'});
 assert.equal(refreshed.data.notes,prepared.data.notes);assert.deepEqual(refreshed.data.agenda,prepared.data.agenda);assert.equal(refreshed.data.sources[0].revision,2);assert.equal(refreshed.data.effectsExecuted,0);assert.equal(refreshed.data.gameEventsCreated,0);assert.equal(refreshed.data.published,false);
 api=world.instantiate();forbidCampaignScans(api);assert.equal((await api.sessionPreparation.read({sessionId})).revision,refreshed.revision);assert.equal((await api.domains.readRevision('objective','world',objectiveId,1)).data.title,'Meet the harbor pilot');
 assert.deepEqual(await api.sessionHandoffs.project({sessionId,observerId:'ep:actor:native_session_player001'}),{recap:[]});await assert.rejects(api.plans.acknowledge({id:sessionId,expectedRevision:refreshed.revision,approvalEventId:sourceEventId}),{code:'PLAN_STATE'});
 const successor={id:'GM_SESSION_SUCCESSOR002',isGM:true,active:true};world.addUser(successor);world.game.user=successor;world.game.users.activeGM=successor;api=world.instantiate();forbidCampaignScans(api);
 await assert.rejects(api.sessionPreparation.read({sessionId}),{code:'SESSION_PREPARATION_OWNER'});assert.deepEqual((await api.sessionPreparation.pins()).plotRefs,[]);
 successor.isGM=false;await assert.rejects(api.sessionPreparation.pins(),{code:'GM_REQUIRED'});
});
