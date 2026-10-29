import test from 'node:test';
import assert from 'node:assert/strict';
import {createVerifiedGMStorageAndIntentSubsystem} from '../src/platform/native-integration.mjs';
import {graph} from './fixtures.mjs';
import {stateLocator} from '../src/runtime/native-state-provider.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {normalizeFoundryHook} from '../src/platform/foundry-hook-ingress.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';

async function publishValidated(api,id,options){
 const view=await api.graphRegistry.inspectValidation(id,{capabilities:options.capabilities??[]});
 if(view.status!=='current')await api.graphRegistry.validateCandidate(id,{expectedRevision:options.expectedRevision,expectedValidationRevision:view.revision,capabilities:options.capabilities??[]});
 return api.graphRegistry.publish(id,options);
}

function syntheticNativeWorld(){
  const gm={id:'GM_001',active:true,isGM:true};const player={id:'player_001',active:true,isGM:false};
  const game={user:gm,world:{id:'ep-testing'},users:{contents:[gm,player],activeGM:gm,get:id=>id===gm.id?gm:player}};
  const docs=new Map();
  const pack={collection:'world.ep-secret',metadata:{packageType:'world'},documentName:'JournalEntry',locked:false,
    getUserLevel:user=>user.isGM?3:0,
    getDocuments:async({_id})=>{
      const doc=docs.get(_id);
      if(!doc)return [];
      return [{id:_id,getFlag:()=>structuredClone(doc.flags['easy-plots'].storage),
        update:async change=>{doc.flags['easy-plots'].storage=structuredClone(change['flags.easy-plots.storage']);}}];
    },documentClass:{createDocuments:async(row)=>{for(const item of row){if(docs.has(item._id))throw Error('duplicate');docs.set(item._id,structuredClone(item));}return row;}}
  };
  const attestation={level:'live-multiplayer',worldId:game.world.id,coreBuild:'14.369',packId:pack.collection,
    playerIndexDenied:true,playerDocumentDenied:true,playerBootstrapDenied:true};
  const instantiate=(options={})=>createVerifiedGMStorageAndIntentSubsystem({gameInstance:game,pack,attestation,coreBuild:'14.369',checkOpportunity:async()=>true,...options});
  return {docs,game,pack,instantiate};
}

test('native severity preflight persists blocker coverage and cannot publish a secret disclosure or unavailable provider',async()=>{
 const world=syntheticNativeWorld();let api=world.instantiate();const g=graph();g.nodes[1].accessClass='published';for(const port of g.nodes[1].ports)port.accessClass='published';
 await api.graphRegistry.saveDraft(g);let evidence=await api.graphRegistry.validateCandidate(g.id,{expectedRevision:1});assert.equal(evidence.report.ok,false);assert.ok(evidence.report.blockers.some(x=>x.code==='SECRET_DISCLOSURE_PATH'));await assert.rejects(api.graphRegistry.publish(g.id,{expectedRevision:1,acknowledgeWarnings:true}),{code:'PUBLICATION_BLOCKED'});assert.equal(await api.graphRegistry.getPublished(g.id,1),null);
 api=world.instantiate();assert.equal((await api.graphRegistry.inspectValidation(g.id)).status,'blocked');g.nodes[1].accessClass='gm';for(const port of g.nodes[1].ports)port.accessClass='gm';g.nodes[2].data.providerId='example.unavailable-provider';await api.graphRegistry.saveDraft(g,{expectedRevision:1});evidence=await api.graphRegistry.validateCandidate(g.id,{expectedRevision:2,expectedValidationRevision:1});assert.ok(evidence.report.blockers.some(x=>x.code==='EFFECT_PROVIDER_UNAVAILABLE'));assert.equal(evidence.report.coverage.checks.find(x=>x.id==='effect-providers').status,'blocked');await assert.rejects(api.graphRegistry.publish(g.id,{expectedRevision:2}),{code:'PUBLICATION_BLOCKED'});
});

test('ADR-018: native Compendium retains co-GM plot ownership, grants and authenticated command receipts across reconstruction',async()=>{
 const world=syntheticNativeWorld(),other={id:'GM_COGM_002',active:true,isGM:true},first=world.game.user,users=new Map([...world.game.users.contents,other].map(u=>[u.id,u]));world.game.users.contents=[...users.values()];world.game.users.get=id=>users.get(id);
 let api=world.instantiate();const g=graph(),run=(method,args,requestId)=>api.plotAuthoring.execute({method,args,requestId,verifiedUserId:other.id});await run('saveDraft',[g,{}],'native-author-command-001');assert.equal((await api.plotAuthority.inspect(g.id)).ownerUserId,other.id);await assert.rejects(api.graphRegistry.publish(g.id,{expectedRevision:1}),{code:'PLOT_AUTHORING_DENIED'});
 api=world.instantiate();const repeat=await run('saveDraft',[g,{}],'native-author-command-001');assert.equal(repeat.replayed,true);assert.equal((await api.graphRegistry.getDraft(g.id)).revision,1);await run('validateCandidate',[g.id,{expectedRevision:1}],'native-author-validation-001');await run('publish',[g.id,{expectedRevision:1}],'native-author-command-002');assert.equal(await api.graphRegistry.getActivation(g.id),null);await run('activate',[g.id,1,{}],'native-author-command-003');assert.equal((await api.graphRegistry.getActive(g.id)).publishedVersion,1);
 const policy=await api.plotAuthority.inspect(g.id);await run('updateAuthority',[{graphId:g.id,expectedRevision:policy.revision,delegates:[{userId:first.id,actions:['edit']}],reason:'Coordinator may draft only'}],'native-author-command-004');api=world.instantiate();assert.equal((await api.plotAuthority.inspect(g.id)).rights.edit,true);assert.equal((await api.plotAuthority.inspect(g.id)).rights.publish,false);assert.equal(api.authoringTransport.started,false);
});
test('ADR-041: native Compendium retains the exact selected encounter closure and never re-evaluates an acknowledged event after reconstruction',async()=>{
 const world=syntheticNativeWorld();world.game.combats=new Map();let api=world.instantiate();const g=graph();g.nodes[0].typeId='core.trigger.document-event';g.nodes[0].data={eventType:'foundry.combat.deleted',sourceKinds:['native-hook']};g.nodes[1].data.condition.left.path=['event','documentType'];g.nodes[1].data.condition.right.value='Combat';g.nodes[2].typeId='core.encounter.outcome';g.nodes[2].data={payload:{scope:'world',encounterId:'ep:encounter:native_harbor001',resolutionId:'ep:resolution:native_victory001',plotId:g.id,outcome:'victory',expectedRevision:null}};await api.graphRegistry.saveDraft(g);await publishValidated(api,g.id,{expectedRevision:1});await api.graphRegistry.activate(g.id,1);
 const event=normalizeFoundryHook('deleteCombat',[{documentName:'Combat',uuid:'Combat.abcdefghijklmnop'},{},world.game.user.id],{randomId:()=> 'native_combat_delete001'});await api.reactiveRouter.ingest(event);const p=(await api.eventLedger.get(event.id)).proposals[0];await api.reviews.decide(event.id,p.operationId,{approve:true});await api.reviews.execute(event.id,p.operationId);const spec={sourceEventId:event.id,operationId:p.operationId},preview=await api.encounterClosures.preview(spec),selected=await api.encounterClosures.select(spec,{approved:true,expectedFingerprint:preview.selectionDigest});
 api=world.instantiate();assert.equal((await api.encounterClosures.read({nativeCombatUuid:preview.nativeCombatUuid})).data.selectionDigest,selected.data.selectionDigest);const submitted=await api.encounterClosures.emit({nativeCombatUuid:preview.nativeCombatUuid,expectedRevision:1},{approved:true});assert.equal(submitted.status,'evaluated');assert.deepEqual((await api.eventLedger.get(submitted.eventId)).evaluations,[]);api=world.instantiate();const repeat=await api.encounterClosures.emit({nativeCombatUuid:preview.nativeCombatUuid,expectedRevision:1},{approved:true});assert.equal(repeat.eventId,submitted.eventId);assert.equal(repeat.status,'duplicate-or-recovery-required');assert.equal((await api.eventLedger.get(submitted.eventId)).event.payload.outcome,'victory');
});
test('canonical lightweight entity and retired persona lineage survive native Compendium reconstruction without creating an Actor',async()=>{
 const world=syntheticNativeWorld(),actors=new Map();world.game.actors={get:id=>actors.get(id)};let api=world.instantiate();const entity={scope:'world',entityId:'ep:entity:native_lightweight001',name:'Mara Voss',kind:'character',status:'active',expectedRevision:null},persona={scope:'world',personaId:'ep:persona:native_mask001',entityId:entity.entityId,name:'The Silver Mask',status:'active',expectedRevision:null},g=graph();
 for(const [index,[typeId,payload]] of [['core.identity.entity',entity],['core.identity.persona',persona],['core.identity.persona',{...persona,status:'retired',expectedRevision:1}]].entries()){
  g.nodes[2].typeId=typeId;g.nodes[2].data={payload};await api.graphRegistry.saveDraft(g,{expectedRevision:index||null});await publishValidated(api,g.id,{expectedRevision:index+1});await api.graphRegistry.activate(g.id,index+1,{expectedActivationRevision:index||null});const eventId=`ep:event:native_identity_phase00${index}`;await api.reactiveRouter.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true}});const p=(await api.eventLedger.get(eventId)).proposals[0];await api.reviews.decide(eventId,p.operationId,{approve:true});assert.equal((await api.reviews.execute(eventId,p.operationId)).status,'completed');api=world.instantiate();
 }
 const resolved=await api.narrativeIdentities.resolve({personaId:persona.personaId});assert.equal(resolved.status,'retired');assert.equal(resolved.entity.id,entity.entityId);assert.equal(resolved.native.status,'not-attached');assert.equal((await api.domains.readRevision('persona','world',persona.personaId,1)).data.status,'active');assert.equal(actors.size,0);
});
test('native Compendium retains live appearance separately from the unchanged immutable executable graph',async()=>{
 const world=syntheticNativeWorld();let api=world.instantiate();const g=graph();await api.graphRegistry.saveDraft(g);const original=await publishValidated(api,g.id,{expectedRevision:1});await api.graphRegistry.activate(g.id,1);const view=await api.graphAppearance.read(g.id);await api.graphAppearance.save({graphId:g.id,publishedVersion:1,expectedActivationRevision:view.activationRevision,expectedRevision:null,title:'GM live title',nodes:[{nodeId:g.rootNodeId,label:'Live root',layout:{x:100,y:80}}]});api=world.instantiate();const restored=await api.graphAppearance.read(g.id);assert.equal(restored.graph.title,'GM live title');assert.equal(restored.graph.nodes[0].label,'Live root');assert.deepEqual(await api.graphRegistry.getPublished(g.id,1),original);assert.equal((await api.graphRegistry.getDraft(g.id)).revision,1);
});
test('ADR-115: one native update visits only its three active quest subscribers and duplicate ingress cannot repeat approved effects',async()=>{
 const world=syntheticNativeWorld(),api=world.instantiate(),ids=[];for(let i=0;i<4;i++){
  const model=new GraphEditorModel({registry:api.graphRegistry});model.newGraph(`Native quest ${i}`);model.setRootTriggerType('core.trigger.document-event');model.updateSelected({eventType:i===3?'foundry.item.updated':'foundry.actor.updated',sourceKindsJSON:'["native-hook"]'});const effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:JSON.stringify({key:`native-quest-${i}`,value:true})});model.connect(model.graph.rootNodeId,effect);await model.save();await model.publish();await model.activate(1);ids.push(model.graph.id);
 }
 const get=api.graphRegistry.getActive.bind(api.graphRegistry),visited=[];api.graphRegistry.getActive=async id=>{visited.push(id);return get(id);};let effects=0;const put=api.repository.put.bind(api.repository);api.repository.put=async(record,options)=>{if(record.kind==='narrative-state')effects++;return put(record,options);};
 const event=normalizeFoundryHook('updateActor',[{documentName:'Actor',uuid:'Actor.abcdefghijklmnop'},{system:{}},{},'player_001'],{randomId:()=> 'native_three_quest_event001'});assert.equal((await api.reactiveRouter.ingest(event)).status,'review-required');assert.deepEqual(visited.sort(),ids.slice(0,3).sort());const entry=await api.eventLedger.get(event.id);assert.equal(entry.proposals.length,3);assert.equal(effects,0);
 for(const p of entry.proposals){await api.reviews.decide(event.id,p.operationId,{approve:true});assert.equal((await api.reviews.execute(event.id,p.operationId)).status,'completed');}assert.equal(effects,3);const count=entry.evaluations.length;assert.equal((await api.reactiveRouter.ingest(event)).status,'duplicate-or-recovery-required');for(const p of entry.proposals)await assert.rejects(api.reviews.execute(event.id,p.operationId),{code:'APPROVAL_REQUIRED'});assert.equal(effects,3);assert.equal((await api.eventLedger.get(event.id)).evaluations.length,count);assert.equal((await api.providers.get('narrative.set-state').get({key:'native-quest-3',value:true})),null);
});
test('declared third-party action re-registers its exact contract after native reconstruction before an approved effect can execute',async()=>{
 const world=syntheticNativeWorld();let api=world.instantiate();const manifest={id:'example.quest.mark',version:'1.0.0',label:'Mark quest',targetProviderId:'narrative.set-state',targetVersion:'1.0.0',constants:{scope:'example-integration',key:'native-action-mark'},inputs:{value:{type:'boolean',default:true}}},contract=await api.narrativeActions.register(manifest),g=graph();g.nodes[2].data={providerId:contract.id,payload:contract.defaultPayload};await api.graphRegistry.saveDraft(g);await publishValidated(api,g.id,{expectedRevision:1});await api.graphRegistry.activate(g.id,1);const eventId='ep:event:native_action_contract001';await api.reactiveRouter.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true}});const p=(await api.eventLedger.get(eventId)).proposals[0];api=world.instantiate();assert.equal(api.providers.has(contract.id),false);const restored=await api.narrativeActions.register(manifest);assert.equal(restored.contractFingerprint,contract.contractFingerprint);await api.reviews.decide(eventId,p.operationId,{approve:true});assert.equal((await api.reviews.execute(eventId,p.operationId)).status,'completed');assert.equal((await api.providers.get('narrative.set-state').get({scope:'example-integration',key:'native-action-mark',value:true})).value,true);assert.equal((await api.journal.get(p.idempotencyKey)).providerId,contract.id);
});
test('selected system roll policy and original mechanical result survive native reconstruction without requiring a reroll or silent adapter fallback',async()=>{
 const world=syntheticNativeWorld();world.game.system={id:'example-system',version:'1.2.3'};let calls=0;class Roll{constructor(_formula,data){this.modifier=data.modifier;}async evaluate(){calls++;this.total=12+this.modifier;}}const options={RollClass:Roll,resolveNativeActor:async()=>({testUserPermission:()=>true})};let api=world.instantiate(options);const manifest={id:'example.system-d20',version:'1.0.0',label:'Authored d20 policy',systemId:'example-system',systemVersions:['1.2.3'],coreBuilds:['14.369'],implementation:'foundry-authored-d20-v1'},d=await api.rollSystemPolicies.register(manifest);await api.rollSystemPolicies.select({policyId:d.id,policyVersion:d.version,expectedRevision:null,reason:'Reviewed native fixture policy'});const input={attemptId:'ep:attempt:native_system_policy001',sourceEventId:'ep:event:native_system_policy001',actorId:'ep:actor:native_system_actor001',mode:'active',modifier:2,dc:14,partialMargin:3},result=await api.rolls.resolve(input);assert.equal(result.record.request.adapterStamp.adapterId,d.id);api=world.instantiate(options);assert.equal((await api.rolls.resolve(input)).status,'already-resolved');assert.equal(calls,1);await assert.rejects(api.rolls.resolve({...input,attemptId:'ep:attempt:native_system_new001'}),{code:'ROLL_POLICY_UNAVAILABLE'});assert.equal(calls,1);await api.rollSystemPolicies.register(manifest);assert.equal((await api.rolls.resolve({...input,attemptId:'ep:attempt:native_system_new001'})).status,'resolved');assert.equal(calls,2);world.game.system.version='2.0.0';await assert.rejects(api.rolls.resolve({...input,attemptId:'ep:attempt:native_system_changed001'}),{code:'ROLL_SYSTEM_CHANGED'});assert.equal(calls,2);
});
test('ADR-083: native Compendium batch reconstruction distinguishes confirmed, uncertain and unstarted writes and stages only a verified remainder',async()=>{
 const world=syntheticNativeWorld();let api=world.instantiate();const g=graph(),steps=['one','two','three'].map(name=>({providerId:'narrative.set-state',providerVersion:'1.0.0',payload:{scope:'world',key:`native-ordered-${name}`,value:true}})),plan=await api.nativeBatches.prepare({id:'ep:batch:native_ordered001',graphId:g.id,steps,sourceEventId:'ep:event:native_ordered_prepare001'});g.nodes[2].typeId='core.resource.ordered-batch';g.nodes[2].data={payload:{scope:'world',batchId:plan.id,expectedBatchRevision:plan.revision,batchFingerprint:plan.data.fingerprint}};await api.graphRegistry.saveDraft(g);await publishValidated(api,g.id,{expectedRevision:1});await api.graphRegistry.activate(g.id,1);let writes=0,lose=true;const put=api.repository.put.bind(api.repository);api.repository.put=async(record,opts)=>{const saved=await put(record,opts);if(record.kind==='narrative-state'){writes++;if(lose&&record.stateKey==='native-ordered-two'){lose=false;throw Error('Second native document ACK lost');}}return saved;};const eventId='ep:event:native_ordered_execute001';await api.reactiveRouter.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true}});const p=(await api.eventLedger.get(eventId)).proposals[0];await api.reviews.decide(eventId,p.operationId,{approve:true});assert.equal((await api.reviews.execute(eventId,p.operationId)).status,'uncertain');assert.equal(writes,2);
 api=world.instantiate();let detail=await api.nativeBatches.inspect({id:plan.id});assert.deepEqual(detail.steps.map(s=>s.state),['completed','uncertain','unstarted']);await api.nativeBatches.reconcile({id:plan.id,expectedRunRevision:detail.run.revision},{approved:true});detail=await api.nativeBatches.inspect({id:plan.id});assert.equal(detail.run.data.state,'partial');assert.deepEqual(detail.steps.map(s=>s.state),['completed','completed','unstarted']);assert.equal(await api.providers.get('narrative.set-state').get({scope:'world',key:'native-ordered-three',value:true}),null);const next=await api.nativeBatches.prepareRemainder({id:plan.id,expectedRunRevision:detail.run.revision,nextBatchId:'ep:batch:native_ordered_remainder001',sourceEventId:'ep:event:native_ordered_remainder001'});assert.equal(next.data.steps.length,1);assert.equal(next.data.steps[0].payload.key,'native-ordered-three');assert.equal(next.data.recoveryOf.originalOperationId,p.operationId);assert.equal((await api.nativeBatches.inspect({id:next.id})).run,null);assert.equal((await api.journal.get(p.idempotencyKey)).state,'uncertain');
});

test('mock native Compendium sustains indexed publication and event review across integration re-creation',async()=>{
  const world=syntheticNativeWorld();let api=world.instantiate();const g=graph();
  g.nodes[0].data.eventType='foundry.actor.updated';
  g.nodes[1].data.condition.left.path=['event','documentType'];g.nodes[1].data.condition.right.value='Actor';
  await api.graphRegistry.saveDraft(g);
  await publishValidated(api,g.id,{expectedRevision:1});
  await api.graphRegistry.activate(g.id,1,{expectedActivationRevision:null});
  assert.equal((await api.subscriptions.lookup('foundry.actor.updated')).length,1);
  api=world.instantiate();
  assert.equal((await api.graphRegistry.getActive(g.id)).publishedVersion,1);
  assert.equal((await api.subscriptions.lookup('foundry.actor.updated')).length,1);
  const event={id:'ep:event:persistent_case_001',eventType:'foundry.actor.updated',
    source:{kind:'native-hook',documentUuid:'Actor.someone',hook:'updateActor',requestingUserId:'player_001'},
    payload:{documentType:'Actor',documentUuid:'Actor.someone',changeKeys:['system']}};
  const result=await api.reactiveRouter.ingest(event);
  assert.equal(result.status,'review-required');
  assert.equal((await api.eventLedger.get(event.id)).proposals.length,1);
  api=world.instantiate();
  const persisted=await api.eventLedger.get(event.id);
  assert.equal(persisted.state,'review-required');
  assert.equal((await api.reactiveRouter.ingest(event)).status,'duplicate-or-recovery-required');
});

test('native protected pack index gate still fails closed in reactive composition',async()=>{
  const world=syntheticNativeWorld();
  world.pack.getUserLevel=()=>1;
  assert.throws(world.instantiate,{code:'PACK_PUBLIC'});
});

test('native Hooks are never enabled just by configuring storage or activating a graph',async()=>{
  const world=syntheticNativeWorld();const api=world.instantiate();
  await api.graphRegistry.saveDraft(graph());await publishValidated(api,graph().id,{expectedRevision:1});
  await api.graphRegistry.activate(graph().id,1,{expectedActivationRevision:null});
  assert.equal(api.runtimeStatus().running,false);
});

test('mock native Compendium persists GM decision and verified effect across subsystem reconstruction',async()=>{
  const world=syntheticNativeWorld();let api=world.instantiate();const g=graph();
  await api.graphRegistry.saveDraft(g);
  await publishValidated(api,g.id,{expectedRevision:1});
  await api.graphRegistry.activate(g.id,1,{expectedActivationRevision:null});
  const event={id:'ep:event:native_effect_001',eventType:'evidence.discovered',
    source:{kind:'test-fixture',testId:'native-recovery'},payload:{verified:true}};
  assert.equal((await api.reactiveRouter.ingest(event)).status,'review-required');
  const proposal=(await api.eventLedger.get(event.id)).proposals[0];
  await api.reviews.decide(event.id,proposal.operationId,{approve:true});
  api=world.instantiate();
  assert.equal((await api.reviews.get(event.id,proposal.operationId)).state,'approved');
  assert.equal((await api.reviews.execute(event.id,proposal.operationId)).status,'completed');
  api=world.instantiate();
  assert.equal((await api.reviews.get(event.id,proposal.operationId)).state,'completed');
  const loc=await stateLocator(proposal.payload);
  const authority=createLocalGMContext({user:world.game.user,epoch:'native-test'},world.game.world.id);
  assert.equal((await api.repository.read(loc.id,{partitionId:loc.partitionId,gm:authority})).value,true);
  assert.equal((await api.journal.get(proposal.idempotencyKey)).state,'completed');
  await assert.rejects(api.reviews.execute(event.id,proposal.operationId),{code:'APPROVAL_REQUIRED'});
});
test('native Compendium knowledge guards traverse sparse index pages and preserve explicit review across reconstruction',async()=>{
 const world=syntheticNativeWorld();world.game.time={worldTime:10};let api=world.instantiate();const g=graph();await api.graphRegistry.saveDraft(g);await publishValidated(api,g.id,{expectedRevision:1});await api.graphRegistry.activate(g.id,1,{expectedActivationRevision:null});
 const claimId='ep:claim:native_review001',observerId='ep:actor:native_review001';await api.knowledgeLedger.createClaim({claimId,publicId:'ep:public:native_review001',publicText:'A wagon was reported',canonicalTruth:'Private native review truth',sourceEventId:'ep:event:native_review_truth001'});const receipt=await api.knowledgeLedger.recordDisclosure({claimId,observerId,sourceId:'ep:npc:native_review001',sourceEventId:'ep:event:native_review_disclosure001'}),effect=g.nodes.find(n=>n.typeId==='core.effect.proposal');
 await api.knowledgeReviews.register({id:'ep:dependency:native_review001',dependent:{kind:'graph-node',graphId:g.id,publishedVersion:1,nodeId:effect.id},sources:[{type:'knowledge-receipt',id:receipt.id,revision:1}],sourceEventId:'ep:event:native_review_dependency001'});
 const event={id:'ep:event:native_review_effect001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true}};assert.equal((await api.reactiveRouter.ingest(event)).status,'review-required');const p=(await api.eventLedger.get(event.id)).proposals[0];await api.reviews.decide(event.id,p.operationId,{approve:true});
 const correction=await api.knowledgeLedger.correctReceipt({correctionId:'ep:correction:native_review001',receiptId:receipt.id,sourceEventId:'ep:event:native_review_correction001',sourceId:'ep:npc:native_review001',kind:'retracted',revisedStance:'retracted',reason:'Explicit native correction'});api=world.instantiate();await assert.rejects(api.reviews.execute(event.id,p.operationId),{code:'KNOWLEDGE_DEPENDENCY_REVIEW_REQUIRED'});
 let job=await api.knowledgeReviews.begin({change:{kind:'receipt-correction',correctionId:correction.id,revision:1}}),steps=0;while(job.data.state==='pending'&&steps++<16)job=await api.knowledgeReviews.advance({id:job.id,expectedRevision:job.revision});assert.equal(job.data.state,'completed');assert.equal(job.data.page,8,'All native hash pages must be covered, including empty ones');
 let cursor='0:0',rows=[],reads=0;do{const page=await api.knowledgeReviews.list({jobId:job.id,cursor});rows.push(...page.items);cursor=page.nextCursor;}while(cursor&&reads++<16);assert.equal(rows.length,1);const row=rows[0];await api.knowledgeReviews.decide({jobId:job.id,id:row.id,expectedRevision:row.revision,decision:'retain-recorded-conclusion',reason:'The GM explicitly retains this known consequence after review'});
 api=world.instantiate();assert.equal((await api.reviews.execute(event.id,p.operationId)).status,'completed');assert.equal((await api.eventLedger.get(event.id)).evaluations.length,1);assert.equal((await api.domains.read('knowledge-receipt','world',receipt.id)).revision,1);
});
test('a native dependent lookup payload missing behind its ready index cannot be mistaken for absence of dependencies',async()=>{
 const world=syntheticNativeWorld();world.game.time={worldTime:10};const api=world.instantiate(),g=graph();await api.graphRegistry.saveDraft(g);await publishValidated(api,g.id,{expectedRevision:1});
 const claimId='ep:claim:missing_dependent_payload001';await api.knowledgeLedger.createClaim({claimId,publicId:'ep:public:missing_dependent_payload001',publicText:'A disclosed report',canonicalTruth:'Private explanation',sourceEventId:'ep:event:missing_payload_truth001'});const receipt=await api.knowledgeLedger.recordDisclosure({claimId,observerId:'ep:actor:missing_payload001',sourceId:'ep:npc:missing_payload001',sourceEventId:'ep:event:missing_payload_disclosure001'}),dependent={kind:'graph-node',graphId:g.id,publishedVersion:1,nodeId:g.nodes.find(n=>n.typeId==='core.effect.proposal').id};await api.knowledgeReviews.register({id:'ep:dependency:missing_payload001',dependent,sources:[{type:'knowledge-receipt',id:receipt.id,revision:1}],sourceEventId:'ep:event:missing_payload_dependency001'});
 const victim=[...world.docs].find(([,doc])=>doc.flags['easy-plots'].storage.payload.kind==='knowledge-dependent-ref');assert.ok(victim);world.docs.delete(victim[0]);await assert.rejects(api.knowledgeReviews.guardDependent({dependent}),{code:'INDEX_UNCERTAIN'});
});
