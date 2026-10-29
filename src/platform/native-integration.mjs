/**
 * Manual, explicit Foundry v14 integration composition; never auto-bootstrapped.
 * Live security evidence must be supplied for the exact environment.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {createLocalGMContext} from '../security/authority.mjs';
import {DesignatedGMWriter} from '../security/gm-writer.mjs';
import {PlotAuthoringAuthority} from '../security/plot-authority.mjs';
import {GMPlotAuthoring,GMPlotRegistryClient} from '../orchestration/gm-plot-authoring.mjs';
import {NativeGMAuthoringTransport} from './gm-authoring-transport.mjs';
import {PersistentEncounterClosures} from '../orchestration/encounter-closures.mjs';
import {PersistentNarrativeIdentities} from '../orchestration/persistent-identities.mjs';
import {LiveGraphAppearance} from '../orchestration/live-graph-appearance.mjs';
import {NarrativeActionAPI} from '../runtime/narrative-action-api.mjs';
import {RollSystemPolicies} from '../orchestration/roll-system-policies.mjs';
import {OrderedNativeBatches} from '../orchestration/ordered-native-batches.mjs';
import {createNativeBatchProvider} from '../runtime/native-batch-provider.mjs';
import {verifyProtectedPackConfiguration,NativePackRepository} from '../storage/native-pack.mjs';
import {NativeIntentQueue,NativeEffectJournal} from '../storage/native-intents.mjs';
import {NativeFoundryIntentTransport} from './foundry-socket.mjs';
import {createScopedActorAuthorizer} from './foundry-actors.mjs';
import {PersistentGraphRegistry} from '../graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../runtime/durable-router.mjs';
import {VerifiedFoundryHookIngress} from './foundry-hook-ingress.mjs';
import {EffectProviderRegistry} from '../runtime/provider-registry.mjs';
import {createNarrativeStateProvider} from '../runtime/native-state-provider.mjs';
import {FoundryOpposedRollCoordinator} from './foundry-opposed-rolls.mjs';
import {createMilestoneProvider} from '../runtime/milestone-provider.mjs';
import {DurableProposalReview} from '../runtime/proposal-review.mjs';
import {NarrativeDomainStore} from '../domains/domain-store.mjs';
import {GMInvestigationWorkbench} from '../orchestration/investigation-workbench.mjs';
import {PersistentArcResolutions} from '../orchestration/persistent-arc-resolution.mjs';
import {PersistentBlueprintCatalog} from '../orchestration/persistent-blueprints.mjs';
import {PersistentKnowledgeLedger} from '../orchestration/persistent-knowledge.mjs';
import {PersistentKnowledgePropagation} from '../orchestration/persistent-knowledge-propagation.mjs';
import {PersistentFactionAgenda} from '../orchestration/persistent-faction-agenda.mjs';
import {PersistentInvestigationMilestones} from '../orchestration/persistent-investigation-milestones.mjs';
import {PersistentNarrativeVotes} from '../orchestration/persistent-voting.mjs';
import {createReviewedMilestoneProvider} from '../runtime/reviewed-milestone-provider.mjs';
import {createReviewedHypothesisProvider} from '../runtime/reviewed-hypothesis-provider.mjs';
import {createReviewedKnowledgeProvider} from '../runtime/reviewed-knowledge-provider.mjs';
import {createReviewedFactionAgendaProvider} from '../runtime/reviewed-faction-agenda-provider.mjs';
import {createReviewedFactionScheduleProvider} from '../runtime/reviewed-faction-schedule-provider.mjs';
import {ReviewedFactionActionScheduler} from '../orchestration/reviewed-faction-scheduling.mjs';
import {GMManualEventGateway} from '../runtime/manual-event-gateway.mjs';
import {createFactionStandingProvider,createObligationProvider,createEvidenceAttestationProvider} from '../runtime/domain-providers.mjs';
import {createExtendedDomainProviders} from '../runtime/extended-providers.mjs';
import {createDomainCorrectionProvider} from '../runtime/domain-correction-provider.mjs';
import {ScopedGMChanges} from '../runtime/scoped-gm-changes.mjs';
import {PersistentNarrativeForecasts} from '../orchestration/persistent-forecasts.mjs';
import {PersistentGMFocus,GMFocusController} from '../orchestration/persistent-gm-focus.mjs';
import {BoundedDiagnostics} from '../runtime/bounded-diagnostics.mjs';
import {BoundedPriorityScheduler} from '../runtime/priority-scheduler.mjs';
import {NativeChronologyIndex} from '../storage/chronology-index.mjs';
import {PersistentNarrativeChronology} from '../orchestration/persistent-chronology.mjs';
import {PersistentArcArchives} from '../orchestration/persistent-arc-archives.mjs';
import {NativeCriticalSignalIndex} from '../storage/critical-signal-index.mjs';
import {NativeSignalReliability} from '../orchestration/signal-reliability.mjs';
import {createNativeSourceStampReader} from './foundry-source-stamps.mjs';
import {ApprovedOperationEventGateway} from '../runtime/approved-operation-gateway.mjs';
import {ReviewedPlanEventGateway} from '../runtime/reviewed-plan-gateway.mjs';
import {PersistentNPCActions} from '../orchestration/persistent-npc-actions.mjs';
import {createNPCActionProvider} from '../runtime/npc-action-provider.mjs';
import {PersistentTemporalCatchup} from '../orchestration/temporal-catchup.mjs';
import {PortableGraphTemplates} from '../orchestration/graph-templates.mjs';
import {PlayerBoardEdits} from '../orchestration/player-board-edits.mjs';
import {createPlayerBoardEditProvider} from '../runtime/player-board-edit-provider.mjs';
import {KnowledgePublications} from '../orchestration/knowledge-publications.mjs';
import {ProtectedNativePublications,createProtectedPublicationProvider} from './protected-native-publications.mjs';
import {NativePublicationKeyTransport} from './publication-key-transport.mjs';
import {createNotificationQueueProvider} from '../runtime/notification-queue-provider.mjs';
import {PersistentKnowledgeReviews} from '../orchestration/knowledge-reviews.mjs';
import {createNarrativeCapabilityProviders} from '../runtime/narrative-capabilities.mjs';
import {NativeFoundryBoardTransport} from './foundry-board-transport.mjs';
import {FoundryD20RollCoordinator} from './foundry-rolls.mjs';
import {ImmutableGraphPageStore} from '../storage/graph-chunks.mjs';
import {NativeCrossPlotDependencyCatalog} from '../domains/crossplot-index.mjs';
import {PersistentGMPlans} from '../orchestration/persistent-plans.mjs';
import {PersistentSessionHandoff} from '../orchestration/persistent-session-handoff.mjs';
import {ScopedNarrativeSearch} from '../orchestration/scoped-search.mjs';
import {PersistentNarrativeNotifications} from '../orchestration/persistent-notifications.mjs';
import {NativeFoundryNotificationTransport} from './foundry-notification-transport.mjs';
import {NativeFoundryContinuityTransport} from './foundry-continuity-transport.mjs';
import {PersistentQuestProjections} from '../orchestration/persistent-quest-projections.mjs';
import {GMFocusedHealthService} from '../orchestration/focused-health-service.mjs';
import {NativeRecordMigrationRegistry} from '../storage/migrations.mjs';
import {createFoundryJournalMaterializationProvider} from './foundry-journal-provider.mjs';
import {createFoundryActorItemShellProvider} from './foundry-actor-item-provider.mjs';
import {createFoundryResourceBindingProvider} from './foundry-resource-binding.mjs';
import {NativeReverseReferenceLedger} from '../storage/native-reverse-references.mjs';
import {NativeTemporalIndex} from '../storage/native-temporal-index.mjs';
import {GMTemporalCoordinator} from '../orchestration/temporal-coordinator.mjs';
import {GMCrossPlotCoordinator} from '../orchestration/crossplot-coordinator.mjs';
import {createNativeReferenceEffectProvider} from '../runtime/reverse-reference-provider.mjs';
import {nativeBindingLookupLocator} from './foundry-resource-binding.mjs';
import {ResourceManifests} from '../orchestration/resource-manifests.mjs';
import {createResourceManifestProvider} from '../runtime/resource-manifest-provider.mjs';
import {BoundedEventCascades} from '../runtime/event-cascades.mjs';
import {PersistentTimelineBranches} from '../orchestration/persistent-timelines.mjs';
import {PersistentSessionPreparation} from '../orchestration/persistent-session-preparation.mjs';
import {PersistentSpatialAtlas} from '../orchestration/persistent-spatial.mjs';
import {createSpatialRegionProvider} from '../runtime/spatial-region-provider.mjs';
import {NativeFoundrySpatialTransport} from './foundry-spatial-transport.mjs';
import {GraphDependencyResolver} from '../graph/graph-dependencies.mjs';
import {CompiledGraphCache} from '../graph/compiled-graph-cache.mjs';
import {PublicationPreflight} from '../graph/publication-preflight.mjs';
import {PersistentGraphValidations} from '../graph/persistent-validations.mjs';
import {assertSupported} from '../graph/persistent-registry.mjs';
import {createNativeSourcePreflight} from './native-source-preflight.mjs';

export function createVerifiedGMStorageAndIntentSubsystem({
  gameInstance,pack,attestation,coreBuild,checkOpportunity,resolveObserver=null,resolveNativeActor=null,resolveNotificationUser=null,authorizeNotificationRecipient=null,RollClass=globalThis.Roll,extensions=null
}={}) {
  if(typeof checkOpportunity!=='function')throw new EasyPlotsError('OPPORTUNITY_POLICY_REQUIRED',
    'A GM-authoritative knowledge-safe opportunity verifier is required');
  verifyProtectedPackConfiguration({gameInstance,pack,attestation,coreBuild});
  const context=createLocalGMContext({user:gameInstance.user,epoch:`${gameInstance.world.id}:manual-init`},gameInstance.world.id);
  const writer=new DesignatedGMWriter({gameInstance});
  writer.assertEligible(context);
  // Observe ephemeral co-GM designation changes, including changes that later
  // revert. Never claim this makes native document writes globally atomic.
  if(typeof globalThis.Hooks?.on==='function'&&typeof globalThis.Hooks?.off==='function')
    writer.watchHooks(globalThis.Hooks);
  const repository=new NativePackRepository({gameInstance,pack,attestation,coreBuild,writer});
  // Shared bounded subscription index: graph activation stages its entries first.
  // The published snapshot remains independently authoritative on dispatch.
  const gmProvider=()=>createLocalGMContext({user:gameInstance.user,
    epoch:`${gameInstance.world.id}:runtime`},gameInstance.world.id);
  const graphPages=new ImmutableGraphPageStore({repository,gmProvider});
  const diagnostics=new BoundedDiagnostics({gmProvider});
  const taskScheduler=new BoundedPriorityScheduler({diagnostics});
  const domains=new NarrativeDomainStore({repository,gmProvider});
  const rollSystemPolicies=new RollSystemPolicies({domains,gmProvider,writer,gameInstance,coreBuild});
  const plotAuthority=new PlotAuthoringAuthority({domains,gmProvider,writer,gameInstance,readGraph:id=>graphRegistry.getDraft(id)});
  const graphRegistry=new PersistentGraphRegistry({repository,gmProvider,extensions,pageStore:graphPages,authoring:plotAuthority,preflight:()=>publicationPreflight,validations:()=>graphValidations});
  const subscriptions=new ActiveTriggerCatalog({repository,gmProvider});
  const crossPlotCatalog=new NativeCrossPlotDependencyCatalog({repository,gmProvider});
  const temporalIndex=new NativeTemporalIndex({repository,gmProvider});
  const indexedGraphs=new IndexedGraphRegistry({registry:graphRegistry,catalog:subscriptions});
  const graphAppearance=new LiveGraphAppearance({domains,registry:indexedGraphs,gmProvider,writer});
  const plotAuthoring=new GMPlotAuthoring({registry:indexedGraphs,authority:plotAuthority,domains,gameInstance,writer,gmProvider,appearance:graphAppearance});
  const authoringRegistry=new GMPlotRegistryClient({invoke:(method,args)=>plotAuthoring.executeLocal(method,args),isLocalGM:()=>gameInstance.user?.isGM===true});
  const authoringTransport=new NativeGMAuthoringTransport({gameInstance,service:plotAuthoring,attestation});
  const eventLedger=new DurableEventLedger({repository,gmProvider,worldTimeProvider:()=>gameInstance.time?.worldTime});
  const cascades=new BoundedEventCascades({repository,ledger:eventLedger,gmProvider});
  const nativeSourceChecks=createNativeSourcePreflight({batches:()=>nativeBatches,manifests:()=>resourceManifests,providers:()=>providers});
  const graphDependencies=new GraphDependencyResolver({providers:()=>providers,extensions,actions:()=>narrativeActions,readPublished:(id,version)=>indexedGraphs.getPublished(id,version),readPublishedManifest:graph=>graphValidations.publishedManifest(graph),externalDependencies:nativeSourceChecks.externalDependencies});
  const publicationPreflight=new PublicationPreflight({dependencies:graphDependencies,validateSupported:(graph,options)=>assertSupported(graph,{...options,extensions,maxBytes:850000}),externalChecks:nativeSourceChecks.externalChecks});
  const graphValidations=new PersistentGraphValidations({repository,gmProvider,scope:indexedGraphs.scope,preflight:publicationPreflight,dependencies:graphDependencies,writer});
  const compiledGraphs=new CompiledGraphCache({dependencies:graphDependencies});
  const changes=new ScopedGMChanges({gmProvider});
  const readRoll=(kind,id)=>{const source=kind==='d20'?rolls:opposedRolls;if(!source)throw new EasyPlotsError('ROLL_UNAVAILABLE','Native roll source is unavailable');return source.get(id);};
  const reactiveRouter=new DurableReactiveRouter({registry:indexedGraphs,catalog:subscriptions,ledger:eventLedger,gmProvider,extensions,changes,cascades,compiledCache:compiledGraphs,dependencyManifestReader:graph=>graphValidations.publishedManifest(graph),rollReader:readRoll,
    stateReader:async({scope,key})=>providers.get('narrative.set-state').get({scope,key,value:null})});
  let hooks=null,hookStartGeneration=0;
  const actorAuthorizer=createScopedActorAuthorizer(gameInstance);
  const intents=new NativeIntentQueue({repository,gmContext:context,
    actorAuthorizer,checkOpportunity});
  const journal=new NativeEffectJournal({repository,gmContext:context});
  const knowledgeReviews=new PersistentKnowledgeReviews({domains,repository,gmProvider,writer,readGraph:(id,version)=>indexedGraphs.getPublished(id,version)});
  const criticalSignalIndex=new NativeCriticalSignalIndex({repository,gmProvider});
  const signalReliability=new NativeSignalReliability({domains,index:criticalSignalIndex,ledger:eventLedger,router:reactiveRouter,gmProvider,
    readSourceStamp:createNativeSourceStampReader({gameInstance,gmProvider,writer})});
  const chronologyIndex=new NativeChronologyIndex({repository,gmProvider});
  const chronology=new PersistentNarrativeChronology({domains,ledger:eventLedger,index:chronologyIndex,worldTimeProvider:()=>gameInstance.time?.worldTime});
  const gmFocus=new PersistentGMFocus({domains,gmProvider});
  const timelineBranches=new PersistentTimelineBranches({domains});
  const sessionPreparation=new PersistentSessionPreparation({domains,focus:gmFocus,registry:indexedGraphs,gmProvider});
  const focusController=new GMFocusController({service:gmFocus,gmProvider});
  let stopFocusEvents=null,sceneHook=null,focusHooks=null;
  focusController.subscribe(snapshot=>{
    stopFocusEvents?.();stopFocusEvents=null;
    if(snapshot.graphId)stopFocusEvents=changes.subscribe({graphId:snapshot.graphId,onChange:async change=>{
      const state=await gmFocus.read();
      await gmFocus.observe({eventId:change.eventId,graphId:change.graphId,observedAt:Date.now()/1000,
        expectedRevision:state.revision,sourceEventId:change.eventId});
      await focusController.refresh();
    }});
  });
  const providers=new EffectProviderRegistry();
  providers.register(createNarrativeStateProvider({repository,gmProvider}));
  providers.register(createMilestoneProvider({repository,gmProvider}));
  providers.register(createFactionStandingProvider({repository,gmProvider}));
  providers.register(createObligationProvider({repository,gmProvider}));
  providers.register(createEvidenceAttestationProvider({repository,gmProvider}));
  for(const provider of createExtendedDomainProviders({repository,gmProvider,domains}))providers.register(provider);
  providers.register(createDomainCorrectionProvider({domains,gmProvider}));
  for(const provider of createNarrativeCapabilityProviders({repository,gmProvider,domains}))providers.register(provider);
  // A system-neutral Foundry integration may be composed without a world Journal
  // collection (e.g. test harness). Do not fabricate a materialization provider.
  // When unavailable, the effect provider registry must fail closed at review.
  if(typeof gameInstance?.journal?.documentClass?.createDocuments==='function'&&
     typeof gameInstance.journal.get==='function')
    providers.register(createFoundryJournalMaterializationProvider({repository,gmProvider,gameInstance,writer}));
  // System-specific Actor/Item document subtypes are validated at execution.
  // The capability remains unavailable if the native world collection is missing.
  for(const [kind,collection] of [['Actor',gameInstance?.actors],['Item',gameInstance?.items]]){
    if(typeof collection?.get==='function'&&typeof collection?.documentClass?.createDocuments==='function')
      providers.register(createFoundryActorItemShellProvider({kind,repository,gmProvider,gameInstance,writer}));
  }
  providers.register(createFoundryResourceBindingProvider({repository,gmProvider,gameInstance,writer}));
  const reverseReferences=new NativeReverseReferenceLedger({repository,gmProvider,
    resolveBinding:async({scope,resourceId})=>{
      const loc=await nativeBindingLookupLocator({scope,resourceId});
      return repository.read(loc.id,{partitionId:loc.partitionId,gm:gmProvider()});
    }});
  const plans=new PersistentGMPlans({domainStore:domains,simulatePublished:spec=>reactiveRouter.simulatePublished(spec)});
  const sessionHandoffs=new PersistentSessionHandoff({domains});
  const narrativeSearch=new ScopedNarrativeSearch({repository,gmProvider,domains});
  domains.setCommittedIndexer(async ({type,scope,id,revision})=>{
    // Stage a bounded private review job only; scanning and decisions remain
    // explicit. Source guards block stale effects even if this hook fails.
    if(type==='knowledge-correction')await knowledgeReviews.begin({scope,change:{kind:'receipt-correction',correctionId:id,revision}});
    else if(type==='knowledge-claim'&&revision>1)await knowledgeReviews.begin({scope,change:{kind:'claim-revision',claimId:id,fromRevision:revision-1,toRevision:revision}});
    // Only named, supported domain records are eligible. No all-world scan.
    if(!narrativeSearch.supportsCanonicalType(type))return;
    const record=await domains.read(type,scope,id);
    const title=record?.data?.title??record?.data?.name??record?.data?.label;
    if(typeof title!=='string'||!title.trim())return;
    await narrativeSearch.indexVerifiedDomain({type,scope,entityId:id});
  });
  const narrativeNotifications=new PersistentNarrativeNotifications({domains});
  providers.register(createNotificationQueueProvider({service:narrativeNotifications,gmProvider}));
  const notificationTransport=new NativeFoundryNotificationTransport({gameInstance,service:narrativeNotifications,
    resolveRecipientUser:resolveNotificationUser,authorizeRecipient:authorizeNotificationRecipient,
    checkGM:()=>writer.assertEligible(gmProvider())});
  const focusedHealth=new GMFocusedHealthService({domains,resourceReader:spec=>resourceManifests.inspect(spec)});
  const investigations=new GMInvestigationWorkbench({domains});
  const arcResolutions=new PersistentArcResolutions({domains});
  const arcArchives=new PersistentArcArchives({domains});
  const blueprints=new PersistentBlueprintCatalog({domains});
  const graphTemplates=new PortableGraphTemplates({catalog:blueprints,pages:new ImmutableGraphPageStore({repository,gmProvider,scope:'templates'}),registry:indexedGraphs,domains,gmProvider,writer});
  const knowledgeLedger=new PersistentKnowledgeLedger({domains,worldTimeProvider:()=>gameInstance.time?.worldTime,beforeCorrectionPersist:spec=>knowledgeReviews.stageCorrection(spec)});
  const spatial=new PersistentSpatialAtlas({domains,knowledge:knowledgeLedger,gmProvider,writer,worldTimeProvider:()=>gameInstance.time?.worldTime??0});
  providers.register(createSpatialRegionProvider({service:spatial,domains,gmProvider}));
  const spatialTransport=typeof resolveObserver==='function'?new NativeFoundrySpatialTransport({gameInstance,attestation,service:spatial,actorAuthorization:actorAuthorizer,resolveObserver}):null;
  const knowledgePublications=new KnowledgePublications({domains,knowledgeLedger,gmProvider,writer,router:reactiveRouter,ledger:eventLedger,worldId:gameInstance.world.id,readRoll});
  const nativePublications=typeof resolveObserver==='function'?new ProtectedNativePublications({domains,plans:knowledgePublications,gmProvider,writer,gameInstance,actorAuthorization:actorAuthorizer,resolveObserver}):null;
  if(nativePublications?.availableKinds.length)providers.register(createProtectedPublicationProvider({service:nativePublications,gmProvider}));
  const publicationKeyTransport=nativePublications?new NativePublicationKeyTransport({gameInstance,keyProvider:spec=>nativePublications.keyForUser(spec)}):null;
  const knowledgePropagation=new PersistentKnowledgePropagation({domains,knowledge:knowledgeLedger});
  const factionAgendas=new PersistentFactionAgenda({domains});
  const forecasts=new PersistentNarrativeForecasts({domains,factionAgendas});
  const investigationMilestones=new PersistentInvestigationMilestones({domains});
  const votes=new PersistentNarrativeVotes({domains});
  const questProjections=new PersistentQuestProjections({domains});
  providers.register(createReviewedMilestoneProvider({service:investigationMilestones,gmProvider}));
  providers.register(createReviewedHypothesisProvider({workbench:investigations,gmProvider}));
  providers.register(createReviewedKnowledgeProvider({service:knowledgePropagation,gmProvider}));
  providers.register(createReviewedFactionAgendaProvider({service:factionAgendas,gmProvider}));
  const timeCoordinator=new GMTemporalCoordinator({domains,index:temporalIndex});
  const temporalCatchup=new PersistentTemporalCatchup({domains,timeCoordinator});
  const npcActions=new PersistentNPCActions({domains,timeCoordinator});
  providers.register(createNPCActionProvider({service:npcActions,gmProvider}));
  const manualEvents=new GMManualEventGateway({router:reactiveRouter,gmProvider,writer,worldId:gameInstance.world.id,timeCoordinator,ledger:eventLedger,verifyDueSource:spec=>npcActions.verifyDue(spec)});
  const reviewedFactionScheduling=new ReviewedFactionActionScheduler({domains,timeCoordinator});
  providers.register(createReviewedFactionScheduleProvider({service:reviewedFactionScheduling,gmProvider}));
  const crossPlotCoordinator=new GMCrossPlotCoordinator({catalog:crossPlotCatalog,gmProvider,
    resolveCurrentTarget:async(targetId,scope)=>{
      if(targetId.startsWith('ep:graph:')){
        const active=await indexedGraphs.getActive(targetId);
        return active?{revision:active.publishedVersion}:null;
      }
      const domainType=targetId.startsWith('ep:arc:')?'arc':
        targetId.startsWith('ep:objective:')?'objective':
        targetId.startsWith('ep:investigation:')?'investigation':null;
      if(!domainType)return null;
      const row=await domains.read(domainType,scope,targetId);
      return row?{revision:row.revision}:null;
    }});
  const migrations=new NativeRecordMigrationRegistry({repository,gmProvider});
  const continuityTransport=typeof resolveObserver==='function'?new NativeFoundryContinuityTransport({gameInstance,
    actorAuthorization:actorAuthorizer,resolveObserver,handoffs:sessionHandoffs,votes,quests:questProjections}):null;
  const playerBoardEdits=typeof resolveObserver==='function'?new PlayerBoardEdits({domains,workbench:investigations,actorAuthorization:actorAuthorizer,resolveObserver,gmProvider,writer,manualEvents}):null;
  if(playerBoardEdits)providers.register(createPlayerBoardEditProvider({service:playerBoardEdits,gmProvider}));
  const boardTransport=playerBoardEdits?new NativeFoundryBoardTransport({gameInstance,
    actorAuthorization:actorAuthorizer,loadBoard:spec=>playerBoardEdits.projectionForPlayer(spec),onSubmitEdit:spec=>playerBoardEdits.capture(spec)}):null;
  const rolls=typeof resolveNativeActor==='function'&&typeof RollClass==='function'?
    new FoundryD20RollCoordinator({repository,gmProvider,RollClass,resolvePolicy:()=>rollSystemPolicies.stamp(),authorizeActor:async(id,gm)=>{
      writer.assertEligible(gm);const actor=await resolveNativeActor({narrativeActorId:id,gmUserId:gm.userId});
      return Boolean(actor&&typeof actor.testUserPermission==='function'&&
        actor.testUserPermission(gameInstance.user,'OWNER')===true);
    }}):null;
  const reviews=new DurableProposalReview({repository,ledger:eventLedger,registry:indexedGraphs,
    providers,journal,gmProvider,readRoll,dependencyGuard:async spec=>{await knowledgeReviews.guardProposal(spec);await resourceManifests.guardProposal(spec);const p=spec.proposal,refs=[{graphId:p.graphId,publishedVersion:p.publishedVersion},...(p.callChain??[]).map(c=>({graphId:c.parentGraphId,publishedVersion:c.parentVersion}))];for(const ref of refs){if(!ref.graphId||!ref.publishedVersion)continue;const graph=await indexedGraphs.getPublished(ref.graphId,ref.publishedVersion);await graphValidations.assertPublishedCurrent(graph);}return true;}});
  const encounterClosures=typeof gameInstance.combats?.get==='function'?new PersistentEncounterClosures({domains,reviews,ledger:eventLedger,router:reactiveRouter,gmProvider,writer,gameInstance}):null;
  const operationContinuations=new ApprovedOperationEventGateway({reviews,router:reactiveRouter,gmProvider,writer,worldId:gameInstance.world.id});
  const planSubmissions=new ReviewedPlanEventGateway({plans,router:reactiveRouter,ledger:eventLedger,
    readState:({scope,key})=>providers.get('narrative.set-state').get({scope,key,value:null}),readRoll,gmProvider,writer,worldId:gameInstance.world.id});
  const opposedRolls=typeof resolveNativeActor==='function'&&typeof RollClass==='function'?
    new FoundryOpposedRollCoordinator({repository,gmProvider,RollClass,resolvePolicy:()=>rollSystemPolicies.stamp(),authorizeActor:async(id,gm)=>{
      writer.assertEligible(gm);const actor=await resolveNativeActor({narrativeActorId:id,gmUserId:gm.userId});
      return Boolean(actor&&typeof actor.testUserPermission==='function'&&actor.testUserPermission(gameInstance.user,'OWNER')===true);
    }}):null;
  const transport=new NativeFoundryIntentTransport({gameInstance,
    actorAuthorization:actorAuthorizer,
    onAcceptedIntent:({verifiedUserId,intent})=>intents.enqueueOnce(`${verifiedUserId}:${intent.requestId}`,{
      intent,verifiedUserId
    })});
  providers.register(createNativeReferenceEffectProvider({ledger:reverseReferences,gmProvider}));
  const readNativeBinding=async({scope,resourceId})=>{
    writer.assertEligible(gmProvider());
    const loc=await nativeBindingLookupLocator({scope,resourceId});
    const row=await repository.read(loc.id,{partitionId:loc.partitionId,gm:gmProvider()});
    if(row&&(row.kind!=='native-resource-binding'||row.resourceId!==resourceId||row.scope!==scope))
      throw new EasyPlotsError('NATIVE_BINDING_CORRUPT','Binding identity mismatch');
    if(row&&typeof repository.hasReadyIndex==='function'&&
      !await repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:gmProvider()}))
      throw new EasyPlotsError('INDEX_UNCERTAIN','Native binding index is incomplete');
    return row;
  };
  const narrativeIdentities=new PersistentNarrativeIdentities({domains,gmProvider,writer,gameInstance,readBinding:readNativeBinding});
  const narrativeActions=new NarrativeActionAPI({providers,gmProvider,writer});
  const nativeBatches=new OrderedNativeBatches({domains,providers,journal,gmProvider,writer});
  providers.register(createNativeBatchProvider({service:nativeBatches}));
  const resourceManifests=new ResourceManifests({domains,batches:nativeBatches,providers,registry:indexedGraphs,gmProvider,writer,gameInstance,router:reactiveRouter,ledger:eventLedger});
  providers.register(createResourceManifestProvider({service:resourceManifests}));
  return Object.freeze({writer,repository,graphPages,readNativeBinding,reverseReferences,intents,journal,transport,boardTransport,continuityTransport,rolls,opposedRolls,reviews,operationContinuations,planSubmissions,providers,domains,chronology,arcArchives,signalReliability,changes,forecasts,gmFocus,focusController,diagnostics,taskScheduler,investigations,arcResolutions,blueprints,knowledgeLedger,knowledgePropagation,factionAgendas,reviewedFactionScheduling,npcActions,investigationMilestones,votes,questProjections,timeCoordinator,crossPlotCoordinator,plans,sessionHandoffs,narrativeSearch,narrativeNotifications,notificationTransport,focusedHealth,migrations,
    graphRegistry:indexedGraphs,authoringRegistry,plotAuthority,plotAuthoring,authoringTransport,graphAppearance,narrativeActions,rollSystemPolicies,nativeBatches,resourceManifests,encounterClosures,narrativeIdentities,graphTemplates,playerBoardEdits,knowledgePublications,nativePublications,publicationKeyTransport,knowledgeReviews,manualEvents,subscriptions,crossPlotCatalog,temporalIndex,temporalCatchup,eventLedger,reactiveRouter,cascades,timelineBranches,sessionPreparation,spatial,spatialTransport,
    graphDependencies,publicationPreflight,graphValidations,compiledGraphs,
    storagePartitions:Object.freeze({inspect:spec=>repository.inspectPartition({...spec,gm:gmProvider()}),reconcile:spec=>repository.reconcilePartition({...spec,gm:gmProvider()}),query:spec=>repository.queryIndex({...spec,gm:gmProvider()})}),
    startGMAuthoring:()=>{writer.assertEligible(gmProvider());return authoringTransport.start();},
    stopGMAuthoring:()=>authoringTransport.stop(),
    runtimeStatus:()=>hooks?.status??{running:false,inflight:0,recentEventIds:[]},
    watchSceneFocus:({HooksInstance=globalThis.Hooks,sceneId=globalThis.canvas?.scene?.id??null}={})=>{
      writer.assertEligible(gmProvider());
      if(typeof HooksInstance?.on!=='function'||typeof HooksInstance?.off!=='function')throw new EasyPlotsError('FOCUS_DEPENDENCY','Native scene lifecycle hooks required');
      if(!sceneHook){focusHooks=HooksInstance;sceneHook=canvas=>{void focusController.sceneChanged(canvas?.scene?.id??null).catch(()=>console.warn('[Easy Plots] Scene focus requires review'));};HooksInstance.on('canvasReady',sceneHook);}
      return focusController.sceneChanged(sceneId);
    },
    startReactiveHooks:async({HooksInstance=globalThis.Hooks,onError}={})=>{
      const generation=++hookStartGeneration;
      writer.assertEligible(gmProvider());
      await signalReliability.load();writer.assertEligible(gmProvider());
      if(generation!==hookStartGeneration)throw new EasyPlotsError('HOOK_STOPPED','Hook startup was cancelled while loading protected reliability policy');
      if(!hooks)hooks=new VerifiedFoundryHookIngress({hooks:HooksInstance,router:reactiveRouter,
        gameInstance,gmProvider,writer,onError,scheduler:taskScheduler,reliability:signalReliability,protectedPackId:pack.collection});
      hooks.start();return hooks.status;
    },
    stopReactiveHooks:()=>{hookStartGeneration++;hooks?.stop();return {running:false};},
    startNotificationTransport:()=>{writer.assertEligible(gmProvider());return notificationTransport.start();},
    stopNotificationTransport:()=>{notificationTransport.stop();return {started:false};},
    stopTransport:()=>{transport.stop();return {started:false};},
    startTransport:()=>{writer.assertEligible(context);return transport.start();},
    startBoardTransport:()=>{writer.assertEligible(gmProvider());if(!boardTransport)throw new EasyPlotsError('BOARD_UNAVAILABLE','Trusted observer binding required');return boardTransport.start();},
    startSpatialTransport:()=>{writer.assertEligible(gmProvider());if(!spatialTransport)throw new EasyPlotsError('SPATIAL_UNAVAILABLE','Trusted observer binding required');spatialTransport.start();return {started:true};},
    stopSpatialTransport:()=>{spatialTransport?.stop();return {started:false};},
    startPublicationKeys:()=>{writer.assertEligible(gmProvider());if(!publicationKeyTransport)throw new EasyPlotsError('PUBLICATION_UNAVAILABLE','Trusted observer binding required');return publicationKeyTransport.start();},
    stopPublicationKeys:()=>{publicationKeyTransport?.stop();return {started:false};},
    startContinuityTransport:()=>{writer.assertEligible(gmProvider());if(!continuityTransport)throw new EasyPlotsError('CONTINUITY_UNAVAILABLE','Trusted observer binding required');return continuityTransport.start();},
    stop:()=>{hookStartGeneration++;stopFocusEvents?.();taskScheduler.close();if(sceneHook)focusHooks.off('canvasReady',sceneHook);sceneHook=null;hooks?.stop();transport.stop();authoringTransport.stop();boardTransport?.stop();spatialTransport?.stop();continuityTransport?.stop();publicationKeyTransport?.stop();notificationTransport.stop();writer.stopWatching();writer.suspend('MANUAL_RESTART_AND_RECONCILIATION_REQUIRED');}
  });
}
