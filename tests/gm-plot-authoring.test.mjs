import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PlotAuthoringAuthority} from '../src/security/plot-authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {makeEditableGraph,GraphEditorModel} from '../src/editor/model.mjs';
import {GMPlotAuthoring,GMPlotRegistryClient,normalizeGMAuthoringCommand} from '../src/orchestration/gm-plot-authoring.mjs';
import {NativeGMAuthoringTransport} from '../src/platform/gm-authoring-transport.mjs';
import {GraphDependencyResolver,executionFingerprint} from '../src/graph/graph-dependencies.mjs';
import {PublicationPreflight} from '../src/graph/publication-preflight.mjs';
import {PersistentGraphValidations} from '../src/graph/persistent-validations.mjs';
function setup({validation=false}={}){
 const owner={id:'GM_OWNER_001',isGM:true,active:true},other={id:'GM_OWNER_002',isGM:true,active:true},player={id:'PLAYER_003',isGM:false,active:true},users=new Map([owner,other,player].map(u=>[u.id,u])),listeners=new Map(),sent=[];
 const world={id:'authoring-world'},proof={worldId:world.id,socketSenderVerified:true,socketRecipientVerified:true,socketForgeryRejected:true,socketNoBroadcastVerified:true};
 const games=[owner,other,player].map(user=>({user,world,users:{get:id=>users.get(id),activeGM:owner,contents:[...users.values()]},modules:new Map([['easy-plots',{socket:true}]]),socket:{on:(_c,f)=>listeners.set(user.id,f),off:()=>listeners.delete(user.id),emit:(_c,p,options)=>{sent.push({sender:user.id,packet:structuredClone(p),recipients:options?.recipients});assert.equal(options.recipients.length,1);for(const id of options.recipients)queueMicrotask(()=>listeners.get(id)?.(structuredClone(p),user.id));}}}));
 const game=games[0],gmProvider=()=>createLocalGMContext({user:game.user,epoch:'authoring-test'},world.id),writer={state:{generation:0},assertEligible:gm=>assert.equal(gm.userId,game.users.activeGM.id)},repository=new MemoryPartitionRepository(),domains=new NarrativeDomainStore({repository,gmProvider});let base;
 let validations;const authority=new PlotAuthoringAuthority({domains,gmProvider,writer,gameInstance:game,readGraph:id=>base.getDraft(id)});base=new PersistentGraphRegistry({repository,gmProvider,authoring:authority,...(validation?{validations:()=>validations}:{})});const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({registry:base,catalog}),makeService=()=>new GMPlotAuthoring({registry,authority,domains,gameInstance:game,writer,gmProvider}),service=makeService();
 if(validation){const dependencies=new GraphDependencyResolver(),preflight=new PublicationPreflight({dependencies});validations=new PersistentGraphValidations({repository,gmProvider,writer,preflight,dependencies});}
 const server=new NativeGMAuthoringTransport({gameInstance:game,service,attestation:proof}),remote=new NativeGMAuthoringTransport({gameInstance:games[1],attestation:proof}),local=new GMPlotRegistryClient({invoke:(m,a)=>service.executeLocal(m,a)}),client=new GMPlotRegistryClient({invoke:(m,a)=>remote.request(m,a),isLocalGM:()=>other.isGM});server.start();remote.start();
 return {owner,other,player,users,games,game,world,proof,listeners,sent,writer,gmProvider,repository,domains,authority,base,catalog,registry,service,makeService,server,remote,local,client,stop(){server.stop();remote.stop();}};
}
test('ADR-018: native targeted co-GM editing, publication and activation each require the plot owner grant',async()=>{
 const s=setup();try{
  const g=makeEditableGraph({title:'Delegated native plot'});await s.local.saveDraft(g);const model=new GraphEditorModel({registry:s.client,mode:'native'});await model.load(g.id);assert.equal(model.state.authoringRights.edit,false);assert.throws(()=>model.rename('Not authorized'),{code:'PLOT_AUTHORING_DENIED'});
  let policy=await s.local.inspectAuthority(g.id);await s.local.updateAuthority({graphId:g.id,expectedRevision:policy.revision,delegates:[{userId:s.other.id,actions:['edit']}],reason:'Second GM drafts this plot'});await s.client.inspectAuthority(g.id);model.rename('Draft by the second GM');await model.save();assert.equal((await s.base.getDraft(g.id)).title,'Draft by the second GM');await assert.rejects(model.publish(),{code:'PLOT_AUTHORING_DENIED'});
  policy=await s.local.inspectAuthority(g.id);await s.local.updateAuthority({graphId:g.id,expectedRevision:policy.revision,delegates:[{userId:s.other.id,actions:['edit','publish','activate']}],reason:'Approve control of this plot'});const published=await model.publish();assert.equal(published.publishedVersion,2);assert.equal(await s.base.getActivation(g.id),null);await model.activate(2);assert.equal((await s.registry.getActive(g.id)).publishedVersion,2);assert.equal((await s.catalog.lookup('evidence.discovered')).length,1);
  policy=await s.local.inspectAuthority(g.id);await s.local.updateAuthority({graphId:g.id,expectedRevision:policy.revision,delegates:[],reason:'Revoke delegated control'});await assert.rejects(s.client.saveDraft({...model.graph,title:'Cached permissions are insufficient'},{expectedRevision:2}),{code:'PLOT_AUTHORING_DENIED'});assert.equal((await s.base.getDraft(g.id)).revision,2);
  assert(s.sent.every(p=>p.recipients.length===1&&!p.recipients.includes(s.player.id)));assert(s.sent.filter(p=>p.packet.kind==='gm.authoring-reply'&&p.packet.state==='ready').length>0);
 }finally{s.stop();}
});
test('a co-GM can create and own a distinct plot without granting the physical coordinator editing rights',async()=>{
 const s=setup();try{const g=makeEditableGraph({title:'Second owner'}),saved=await s.client.saveDraft(g);assert.equal(saved.revision,1);assert.equal((await s.client.inspectAuthority(g.id)).ownerUserId,s.other.id);await assert.rejects(s.local.publish(g.id,{expectedRevision:1}),{code:'PLOT_AUTHORING_DENIED'});await s.client.publish(g.id,{expectedRevision:1});assert.equal(await s.base.getActivation(g.id),null);assert.equal((await s.authority.read(g.id)).data.lastDecision.byUserId,s.other.id);}finally{s.stop();}
});
test('socket proofs, current GM role and appended sender reject player or forged authoring requests',async()=>{
 const s=setup();try{
  assert.throws(()=>new NativeGMAuthoringTransport({gameInstance:s.games[1],attestation:{...s.proof,socketNoBroadcastVerified:false}}).start(),{code:'SOCKET_UNVERIFIED'});assert.throws(()=>new NativeGMAuthoringTransport({gameInstance:s.games[2],attestation:s.proof}).start(),{code:'GM_REQUIRED'});
  const before=s.sent.length,packet={kind:'gm.authoring-request',version:1,worldId:s.world.id,scope:'main',requestId:'forged-request-001',method:'listDrafts',args:[{}],verifiedUserId:s.owner.id};s.listeners.get(s.owner.id)(packet,s.player.id);await new Promise(resolve=>setImmediate(resolve));assert.equal(s.sent.length,before);
  s.listeners.get(s.owner.id)(packet,s.other.id);await new Promise(resolve=>setImmediate(resolve));const reply=s.sent.at(-1);assert.deepEqual(reply.recipients,[s.other.id]);assert.equal(reply.packet.code,'GM_COMMAND_INVALID');assert.equal(reply.packet.result,undefined);
  assert.throws(()=>normalizeGMAuthoringCommand('saveDraft',[makeEditableGraph(),{requesterContext:{userId:s.owner.id}}]),{code:'GM_COMMAND_INVALID'});
 }finally{s.stop();}
});
test('a completed mutation with a lost reply returns its receipt after service reconstruction without another graph write',async()=>{
 const s=setup();try{const g=makeEditableGraph({title:'Lost acknowledgment'}),input={method:'saveDraft',args:[g,{}],requestId:'lost-reply-command-001',verifiedUserId:s.other.id};let calls=0;const save=s.registry.saveDraft.bind(s.registry);s.registry.saveDraft=async(...a)=>{calls++;return save(...a);};await s.service.execute(input);const replay=await s.makeService().execute(input);assert.equal(replay.replayed,true);assert.equal(replay.receipt.state,'completed');assert.equal(calls,1);assert.equal((await s.base.getDraft(g.id)).revision,1);await assert.rejects(s.service.execute({...input,args:[{...g,title:'A changed request'},{}]}),{code:'GM_COMMAND_CONFLICT'});}finally{s.stop();}
});
test('a mutation interrupted after the graph write remains uncertain across reconstruction and cannot replay',async()=>{
 const s=setup();try{const g=makeEditableGraph({title:'Unknown command outcome'}),input={method:'saveDraft',args:[g,{}],requestId:'uncertain-command-001',verifiedUserId:s.other.id};let calls=0;const save=s.registry.saveDraft.bind(s.registry);s.registry.saveDraft=async(...a)=>{calls++;await save(...a);throw Object.assign(Error('ACK lost'),{code:'WRITE_UNCERTAIN'});};await assert.rejects(s.service.execute(input),{code:'WRITE_UNCERTAIN'});s.registry.saveDraft=save;await assert.rejects(s.makeService().execute(input),{code:'GM_COMMAND_UNCERTAIN'});assert.equal(calls,1);assert.equal((await s.base.getDraft(g.id)).revision,1);}finally{s.stop();}
});
test('prepared native request index without its payload blocks a mutation before graph creation',async()=>{
 const s=setup();try{const has=s.domains.hasRecordOrIndex.bind(s.domains);s.domains.hasRecordOrIndex=async(type,...a)=>type==='gm-authoring-request'?true:has(type,...a);const g=makeEditableGraph();await assert.rejects(s.service.execute({method:'saveDraft',args:[g,{}],requestId:'native-index-command-001',verifiedUserId:s.other.id}),{code:'GM_COMMAND_UNCERTAIN'});assert.equal(await s.base.getDraft(g.id),null);assert.equal(await s.authority.read(g.id),null);}finally{s.stop();}
});
test('queued concurrent edits retain revision conflicts and command payloads are isolated from later caller mutation',async()=>{
 const s=setup();try{const g=makeEditableGraph(),saved=await s.client.saveDraft(g);const args=[{...saved,title:'Retained command'},{expectedRevision:1}],one=s.service.execute({method:'saveDraft',args,requestId:'concurrent-command-001',verifiedUserId:s.other.id});args[0].title='Mutated after dispatch';const two=s.service.execute({method:'saveDraft',args:[{...saved,title:'Conflicting edit'},{expectedRevision:1}],requestId:'concurrent-command-002',verifiedUserId:s.other.id});await one;await assert.rejects(two,{code:'REVISION_CONFLICT'});assert.equal((await s.base.getDraft(g.id)).title,'Retained command');assert.equal((await s.base.getDraft(g.id)).revision,2);}finally{s.stop();}
});
test('GM role loss while a private read is pending prevents a private response',async()=>{
 const s=setup();try{const g=makeEditableGraph();await s.local.saveDraft(g);let release,entered;const gate=new Promise(resolve=>{entered=resolve;}),get=s.registry.getDraft.bind(s.registry);s.registry.getDraft=async id=>{entered();await new Promise(resolve=>{release=resolve;});return get(id);};const pending=s.remote.request('getDraft',[g.id],{timeoutMs:30,requestId:'role-loss-read-001'});await gate;s.other.isGM=false;release();await assert.rejects(pending,{code:'GM_COMMAND_TIMEOUT'});assert(!s.sent.some(p=>p.packet.kind==='gm.authoring-reply'&&p.packet.requestId==='role-loss-read-001'));}finally{s.stop();}
});
test('command nesting, oversized data and unsupported methods are rejected before dispatch',()=>{
 assert.throws(()=>normalizeGMAuthoringCommand('executeEffects',[{}]),{code:'GM_COMMAND_INVALID'});assert.throws(()=>normalizeGMAuthoringCommand('saveDraft',[{id:'x',text:'x'.repeat(890_000)},{}]),{code:'GM_COMMAND_BUDGET'});assert.throws(()=>normalizeGMAuthoringCommand('saveDraft',[{circular:()=>true},{}]),{code:'GM_COMMAND_INVALID'});
});
test('a GM inspects its own original command receipt without repeating it or reading another requester receipt',async()=>{
 const s=setup();try{const g=makeEditableGraph({title:'Original request inspection'}),requestId='inspect-original-command-001';await s.service.execute({method:'saveDraft',args:[g,{}],requestId,verifiedUserId:s.other.id});const receipt=await s.client.inspectCommand(requestId);assert.equal(receipt.data.state,'completed');assert.equal(receipt.data.requesterUserId,s.other.id);assert.equal(receipt.data.result.revision,1);assert.equal(await s.local.inspectCommand(requestId),null);assert.equal((await s.base.getDraft(g.id)).revision,1);}finally{s.stop();}
});
test('co-GM publication validation is authenticated, scoped to publish rights, durable and privately inspectable',async()=>{
 const s=setup({validation:true});try{const g=makeEditableGraph({title:'Protected validation'});await s.local.saveDraft(g);
  await assert.rejects(s.client.validateCandidate(g.id,{expectedRevision:1}),{code:'PLOT_AUTHORING_DENIED'});
  let authority=await s.local.inspectAuthority(g.id);await s.local.updateAuthority({graphId:g.id,expectedRevision:authority.revision,delegates:[{userId:s.other.id,actions:['publish']}],reason:'Review publication contracts'});
  const saved=await s.client.validateCandidate(g.id,{expectedRevision:1});assert.equal(saved.revision,1);assert.equal(saved.report.kind,'graph-publication-preflight');assert.equal((await s.client.inspectValidation(g.id)).status,'current');
  const snapshot=await s.client.publish(g.id,{expectedRevision:1});assert.equal(snapshot.dependencyManifest.kind,'graph-dependency-manifest');assert.equal(await s.base.getActivation(g.id),null);assert(s.sent.every(row=>!row.recipients.includes(s.player.id)));
  assert.throws(()=>normalizeGMAuthoringCommand('validateCandidate',[g.id,{expectedRevision:1,requesterContext:{userId:s.owner.id}}]),{code:'GM_COMMAND_INVALID'});
  assert.throws(()=>normalizeGMAuthoringCommand('adoptPublishedDependencies',[g.id,1,{approved:true,unsafe:true}]),{code:'GM_COMMAND_INVALID'});
 }finally{s.stop();}
});
test('explicit co-GM legacy dependency adoption uses publication rights and never replaces the snapshot',async()=>{
 const s=setup({validation:true});try{const g=makeEditableGraph({title:'Legacy RPC adoption'});await s.local.saveDraft(g);const legacy=new PersistentGraphRegistry({repository:s.repository,gmProvider:s.gmProvider,authoring:s.authority}),snapshot=await legacy.publish(g.id,{expectedRevision:1});
  const options={approved:true,reason:'Reviewed installed legacy contracts',expectedExecutionFingerprint:executionFingerprint(snapshot)};
  await assert.rejects(s.client.adoptPublishedDependencies(g.id,1,options),{code:'PLOT_AUTHORING_DENIED'});const adopted=await s.local.adoptPublishedDependencies(g.id,1,options);assert.equal(adopted.created,true);assert.deepEqual(await s.client.getPublished(g.id,1),snapshot);
 }finally{s.stop();}
});
test('a lost validation reply remains uncertain and cannot repeat its evidence write after coordinator reload',async()=>{
 const s=setup({validation:true});try{const g=makeEditableGraph();await s.local.saveDraft(g);const validate=s.registry.validateCandidate.bind(s.registry);let calls=0;s.registry.validateCandidate=async(...args)=>{calls++;await validate(...args);throw Object.assign(Error('Acknowledgement lost'),{code:'WRITE_UNCERTAIN'});};
  const command={method:'validateCandidate',args:[g.id,{expectedRevision:1}],requestId:'validation-lost-reply-001',verifiedUserId:s.owner.id};await assert.rejects(s.service.execute(command),{code:'WRITE_UNCERTAIN'});s.registry.validateCandidate=validate;await assert.rejects(s.makeService().execute(command),{code:'GM_COMMAND_UNCERTAIN'});assert.equal(calls,1);assert.equal((await s.local.inspectValidation(g.id)).revision,1);
 }finally{s.stop();}
});
