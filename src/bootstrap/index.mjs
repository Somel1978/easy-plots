/** Easy Plots development module: GM-reviewed narrative operations and expanded typed domains. */
import {createFoundrySafetyGates} from '../platform/foundry-gates.mjs';
import {makeStatusWindow} from '../ui/status-window.mjs';
import {makeGraphEditorWindow} from '../ui/graph-editor.mjs';
import {makeApprovalWindow} from '../ui/approval-window.mjs';
import {GraphEditorModel} from '../editor/model.mjs';
import {PersistentGraphRegistry} from '../graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../runtime/active-subscriptions.mjs';
import {MemoryPartitionRepository} from '../storage/memory.mjs';
import {createVerifiedGMStorageAndIntentSubsystem} from '../platform/native-integration.mjs';
import {EasyPlotsError} from '../contracts/errors.mjs';
import {makeEventReviewWindow} from '../ui/event-review-window.mjs';
import {makeGMCockpitWindow} from '../ui/gm-cockpit.mjs';
import {makeGMCausalPlanningWindow} from '../ui/causal-planning-inspector.mjs';
import {buildGMFocusSnapshot} from '../runtime/gm-cockpit.mjs';
import {makeGMWorkspaceWindow} from '../ui/gm-workspace.mjs';
import {makeGMHistoryDeskWindow} from '../ui/history-desk.mjs';
import {makeSignalReliabilityDeskWindow} from '../ui/signal-reliability-desk.mjs';
import {explainNarrativeEvent} from '../runtime/explainability.mjs';
import {makeInvestigationBoardWindow} from '../ui/investigation-board.mjs';
import {validatePlayerBoardProjection} from '../domains/investigation-board.mjs';
import {NativeFoundryBoardTransport} from '../platform/foundry-board-transport.mjs';
import {NarrativeNodeExtensions} from '../graph/node-extensions.mjs';
import {makeGMPlanningLabWindow,evaluatePlanningFixture} from '../ui/planning-lab.mjs';
import {makeGMTemplateDeskWindow} from '../ui/template-desk.mjs';
import {makeGMBoardEditReviewWindow} from '../ui/board-edit-review.mjs';
import {makeProtectedPublicationWindow,attachProtectedPublicationButton} from '../ui/protected-publication-viewer.mjs';
import {NativePublicationKeyTransport} from '../platform/publication-key-transport.mjs';
import {makeResourceManifestWindow} from '../ui/resource-manifest-desk.mjs';
import {configureResourceActivationBranch} from '../editor/resource-activation-branch.mjs';
import {RESOURCE_ACTIVATION_PROVIDER} from '../runtime/resource-manifest-provider.mjs';
import {makeGraphPreflightWindow} from '../ui/graph-preflight-desk.mjs';
import {makeStoragePartitionWindow} from '../ui/storage-partition-desk.mjs';
import {makeGMKnowledgePublicationWindow} from '../ui/knowledge-publication-desk.mjs';
import {preparePublicationHandlerDraft} from '../orchestration/publication-handler.mjs';
import {makeNativeResourceInspectorWindow} from '../ui/native-resource-inspector.mjs';
import {makeGMContinuityDeskWindow} from '../ui/continuity-desk.mjs';
import {makeGMKnowledgeFactionDeskWindow} from '../ui/knowledge-faction-desk.mjs';
import {makeGMSessionHandoffWindow} from '../ui/session-handoff-desk.mjs';
import {makeGMTimelineBranchWindow} from '../ui/timeline-branch-desk.mjs';
import {makeGMSessionPreparationWindow} from '../ui/session-preparation-desk.mjs';
import {makeGMNarrativeSearchWindow} from '../ui/narrative-search-desk.mjs';
import {makeGMNotificationWindow} from '../ui/notification-desk.mjs';
import {PlayerNoticeInbox} from '../ui/player-notification-inbox.mjs';
import {NativeFoundryNotificationTransport} from '../platform/foundry-notification-transport.mjs';
import {NativeFoundryContinuityTransport} from '../platform/foundry-continuity-transport.mjs';
import {makePlayerContinuityWindow} from '../ui/player-continuity.mjs';
import {makeGMQuestPublicationWindow} from '../ui/quest-publication-desk.mjs';
import {makePlayerNarrativePortalWindow} from '../ui/player-portal.mjs';
import {makeGMManualEventWindow} from '../ui/manual-event-desk.mjs';
import {makePlotAuthorityDeskWindow} from '../ui/plot-authority-desk.mjs';
import {GMPlotRegistryClient} from '../orchestration/gm-plot-authoring.mjs';
import {NativeGMAuthoringTransport} from '../platform/gm-authoring-transport.mjs';
import {makeEncounterClosureDeskWindow} from '../ui/encounter-closure-desk.mjs';
import {makeLiveAppearanceWindow} from '../ui/live-appearance-desk.mjs';
import {makeRollSystemPolicyWindow} from '../ui/roll-system-policy-desk.mjs';
import {makeNativeBatchWindow} from '../ui/native-batch-desk.mjs';
import {NATIVE_BATCH_PROVIDER} from '../runtime/native-batch-provider.mjs';
import {makeSpatialDeskWindow,makePlayerSpatialWindow} from '../ui/spatial-desk.mjs';
import {NativeFoundrySpatialTransport} from '../platform/foundry-spatial-transport.mjs';
import {registerFoundryLaunchers} from '../platform/foundry-launcher.mjs';
import {FoundryWorldSetup,registerWorldSetupSettings} from '../platform/world-setup.mjs';
import {makeWorldSetupWindow} from '../ui/world-setup-window.mjs';
import {makeGMCampaignWorkspace,makePlayerCampaignWorkspace,makeWorkspaceSection} from '../ui/campaign-workspaces.mjs';
import {createWorkspaceHost} from '../ui/workspace-shell.mjs';
import {isEncryptedNativePack} from '../storage/encrypted-native-pack.mjs';
const ID='easy-plots';const VERSION='1.14.0-dev';
if(typeof Hooks!=='undefined'){
  registerFoundryLaunchers({hooks:Hooks});
  registerWorldSetupSettings({hooks:Hooks});
  Hooks.once('ready',()=>{
    const gates=createFoundrySafetyGates(game);
    const NativeBase=globalThis.foundry?.applications?.api?.ApplicationV2;
    if(!NativeBase){console.error('[Easy Plots] ApplicationV2 missing; editor disabled');return;}
    const {PanelBase:Base}=createWorkspaceHost(NativeBase,{gameInstance:game,getState:()=>setupState(),onNavigate:route=>navigateWorkspace(route)});
    const gmOnly=()=>{if(!gates.isLocalGM())throw new EasyPlotsError('GM_REQUIRED','Easy Plots development tools require GM authority');};
    const gmProvider=()=>gates.gmContext();
    let integration=null;
    let worldSetup=null,gmWorkspace=null,playerWorkspace=null;
    const sharedViews=[];
    const rememberSharedView=(kind,id,actorId,projection)=>{const methods={'quest-board':'requestApprovedQuestBoard','session-recap':'requestApprovedSessionRecap','vote-result':'requestFinalizedVoteResult','investigation-board':'requestInvestigationBoard'};const method=methods[kind];if(!method)return;const index=sharedViews.findIndex(v=>v.kind===kind&&v.id===id&&v.actorId===actorId);if(index>=0)sharedViews.splice(index,1);sharedViews.unshift({kind,id,actorId,title:projection.title??({'session-recap':'Shared session recap','vote-result':'Approved decision'})[kind]??'Shared story',open:()=>api[method](id,actorId)});if(sharedViews.length>64)sharedViews.length=64;};
    const setupState=()=>integration?{state:'configured',message:'Private world storage connected.',tools:{publications:!!integration.nativePublications,boardReview:!!integration.playerBoardEdits,encounter:!!integration.encounterClosures}}:worldSetup?.state()??{state:'unconfigured',message:'Create or unlock private world storage to keep your plots.'};
    const openSetup=()=>{gmOnly();const Window=makeWorldSetupWindow(Base,{gameInstance:game,service:worldSetup,onConnected:()=>openCampaignWorkspace()});const app=new Window();void app.render(true);return app;};
    const unsavedPlot=()=>editorModel.state.dirty||editorWindow?.hasUnsavedChanges;
    const openCampaignWorkspace=()=>{gmOnly();if(!gmWorkspace){const Window=makeGMCampaignWorkspace(Base,{gameInstance:game,getState:setupState,listPlots:opts=>integration.graphRegistry.listDrafts(opts),openSetup,resumePlot:()=>editorModel.graph?{title:editorModel.graph.title,dirty:unsavedPlot(),open:openEditor}:null,newPlot:()=>{if(unsavedPlot())throw new EasyPlotsError('UNSAVED_CHANGES','Continue editing the open plot, then save or discard its changes before creating another.');editorModel.newGraph('Untitled plot');editorModel.setRootTriggerType('core.trigger.manual');return openEditor({reset:true});},openPlot:async id=>{if(editorModel.graph?.id===id)return openEditor();if(unsavedPlot())throw new EasyPlotsError('UNSAVED_CHANGES','Continue editing the open plot, then save or discard its changes before opening another.');await loadEditorGraph(id);return openEditor({reset:true});}});gmWorkspace=new Window();}void gmWorkspace.render(true);return gmWorkspace;};
    const openPlayerWorkspace=({tab=null}={})=>{if(game.user?.isGM)throw new EasyPlotsError('PLAYER_ONLY','Use the GM workspace');if(!playerWorkspace){const Window=makePlayerCampaignWorkspace(Base,{gameInstance:game,getViews:()=>sharedViews,inbox:playerNoticeInbox});playerWorkspace=new Window();}if(tab)playerWorkspace.selectTab(tab);void playerWorkspace.render(true);return playerWorkspace;};
    let nativeAttestation=null;
    const extensions=new NarrativeNodeExtensions();
    const memoryRepository=new MemoryPartitionRepository();
    const memoryBase=new PersistentGraphRegistry({repository:memoryRepository,gmProvider,extensions});
    const memorySubscriptions=new ActiveTriggerCatalog({repository:memoryRepository,gmProvider});
    let editorModel=new GraphEditorModel({registry:new IndexedGraphRegistry({registry:memoryBase,catalog:memorySubscriptions}),mode:'sandbox',extensions});
    let editorWindow=null;
    const loadEditorGraph=async graphId=>{if(editorModel.graph?.id===graphId)return;if(unsavedPlot())throw new EasyPlotsError('UNSAVED_CHANGES','Save or discard the open plot before switching plots.');await editorModel.load(graphId);if(editorWindow)await editorWindow.close();editorWindow=null;};
    let plotAuthoringRegistry=null,remoteAuthoringTransport=null;
    let approvalWindow=null;
    let eventReviewWindow=null;
    let cockpitWindow=null;
    const workspaceWindows=new Map();
    let playerBoardTransport=null;
    let playerPublicationKeys=null;
    let playerContinuityTransport=null;
    let playerSpatialTransport=null;
    let playerNotificationTransport=null;
    const playerNoticeInbox=new PlayerNoticeInbox();
    const openPlayerNoticeInbox=()=>openPlayerWorkspace({tab:'Notifications'});
    const openEditor=({reset=false}={})=>{
      gmOnly();
      if(!integration)return openSetup();
      if(editorWindow&&!reset){void editorWindow.render(true);return editorWindow;}
      if(editorWindow)void editorWindow.close?.();
      const Window=makeGraphEditorWindow(Base,{model:editorModel,isGM:gates.isLocalGM,focusController:integration?.focusController??null,openPlotAuthority,openLiveAppearance});
      editorWindow=new Window();void editorWindow.render(true);return editorWindow;
    };
    const openPlotAuthority=()=>{
      gmOnly();if(!plotAuthoringRegistry)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Connect verified native plot authoring first');
      const Window=makePlotAuthorityDeskWindow(Base,{gameInstance:game,registry:plotAuthoringRegistry,sourceGraphId:()=>editorModel.graph?.id??'',onChanged:async()=>{if(editorWindow?.rendered)await editorWindow.render();}});
      const app=new Window();void app.render(true);return app;
    };
    const openLiveAppearance=()=>{gmOnly();if(!plotAuthoringRegistry)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Verified active plot authoring required');const Window=makeLiveAppearanceWindow(Base,{gameInstance:game,registry:plotAuthoringRegistry,sourceGraphId:()=>editorModel.graph?.id??''});const app=new Window();void app.render(true);return app;};
    const openApprovals=()=>{
      gmOnly();
      if(!integration)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','A verified native integration is required for durable GM review');
      const Window=makeApprovalWindow(Base,{queue:integration.intents,gameInstance:game});
      approvalWindow=new Window();void approvalWindow.render(true);return approvalWindow;
    };
    const openEventReview=()=>{
      gmOnly();if(!integration)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Native event journal requires verified protected storage');
      const Window=makeEventReviewWindow(Base,{ledger:integration.eventLedger,reviews:integration.reviews,
        runtimeStatus:integration.runtimeStatus,gameInstance:game,continuations:integration.operationContinuations,effectPreview:async proposal=>{if(proposal.providerId===NATIVE_BATCH_PROVIDER){const detail=await integration.nativeBatches.preview(proposal.payload);return {...detail,canExecute:!detail.run};}if(proposal.providerId===RESOURCE_ACTIVATION_PROVIDER){const detail=await integration.resourceManifests.inspect({scope:proposal.payload.scope,id:proposal.payload.manifestId});return {...detail,canExecute:detail.manifest.revision===proposal.payload.expectedManifestRevision&&detail.effectiveState==='materialized'&&detail.integrityStatus==='verified'};}return null;}});
      eventReviewWindow=new Window();void eventReviewWindow.render(true);return eventReviewWindow;
    };
    const openCockpit=()=>{
      gmOnly();
      if(cockpitWindow)void cockpitWindow.close?.();
      const getSnapshot=(graphId,eventIds)=>buildGMFocusSnapshot({graphId,
        registry:integration?.graphRegistry??new IndexedGraphRegistry({registry:memoryBase,catalog:memorySubscriptions}),
        ledger:integration?.eventLedger??null,gmProvider,eventIds,appearanceReader:integration?graphId=>integration.graphAppearance.read(graphId):null});
      const getExplanation=(graphId,eventId)=>{
        if(!integration)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Native protected event ledger required');
        return explainNarrativeEvent({eventId,graphId,ledger:integration.eventLedger,gmProvider});
      };
      const Window=makeGMCockpitWindow(Base,{getSnapshot,getExplanation,gameInstance:game,openEditor,openEventReview,
        watchGraph:(graphId,onChange)=>integration?.changes?.subscribe({graphId,onChange})??(()=>{})});
      cockpitWindow=new Window();void cockpitWindow.render(true);return cockpitWindow;
    };
    const openGMWorkspace=(mode='dock')=>{
      gmOnly();if(!integration?.focusController)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected GM workspace required');
      workspaceWindows.get(mode)?.close?.();
      const Window=makeGMWorkspaceWindow(Base,{controller:integration.focusController,service:integration.gmFocus,gameInstance:game,mode,
        getGraphSnapshot:(graphId,eventIds)=>buildGMFocusSnapshot({graphId,eventIds,registry:integration.graphRegistry,ledger:integration.eventLedger,gmProvider}),
        openEditor:async graphId=>{await loadEditorGraph(graphId);return openEditor();},
        openInspector:()=>openGMWorkspace('inspector')});
      const app=new Window();workspaceWindows.set(mode,app);void app.render(true);return app;
    };
    const openInvestigationBoard=(projection)=>{
      validatePlayerBoardProjection(projection);
      const Window=makeInvestigationBoardWindow(Base,{projectionProvider:async()=>projection});
      const app=new Window();void app.render(true);return app;
    };
    const openPlayerInvestigationBoard=async(investigationId,actorId)=>{
      if(game.user?.isGM)throw new EasyPlotsError('PLAYER_ONLY','Players request their own disclosed board');
      if(!playerBoardTransport){playerBoardTransport=new NativeFoundryBoardTransport({gameInstance:game});playerBoardTransport.start();}
      const Window=makeInvestigationBoardWindow(Base,{projectionProvider:()=>playerBoardTransport.request({investigationId,actorId}),submitBoardEdit:(edit,options)=>playerBoardTransport.submitEdit({investigationId,actorId,edit},options)});
      const app=new Window();await app.render(true);return app;
    };
    const openProtectedPublication=({nativeKind,nativeId,actorId=''}={})=>{
      const Window=makeProtectedPublicationWindow(Base,{gameInstance:game,nativeKind,nativeId,actorId,
        gmView:game.user?.isGM&&integration?.nativePublications&&game.users?.activeGM?.id===game.user.id?reference=>{gmOnly();return integration.nativePublications.viewForGM(reference);}:null,
        requestKey:async spec=>{if(!playerPublicationKeys){playerPublicationKeys=new NativePublicationKeyTransport({gameInstance:game});playerPublicationKeys.start();}return playerPublicationKeys.request(spec);}
      });const app=new Window();void app.render(true);return app;
    };
    const openKnowledgePublications=()=>{gmOnly();if(!integration?.nativePublications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified native Actor/observer mapping required');
      const openDraft=async id=>{await loadEditorGraph(id);return openEditor();};
      const prepareHandler=()=>preparePublicationHandlerDraft({registry:integration.graphRegistry,mode:'native',extensions});
      const Window=makeGMKnowledgePublicationWindow(Base,{gameInstance:game,plans:integration.knowledgePublications,native:integration.nativePublications,prepareHandler,openDraft,openEvent:async id=>{const app=openEventReview();await app.loadEvent(id);},openPublication:openProtectedPublication});const app=new Window();void app.render(true);return app;
    };
    // Render hooks add a generic local button only. They never read private
    // storage, fetch a key, or change a native document automatically.
    if(typeof Hooks.on==='function'){
      Hooks.on('renderChatMessageHTML',(message,html)=>attachProtectedPublicationButton(message,html?.querySelector?html:html?.[0],openProtectedPublication));
      Hooks.on('renderJournalEntryPageTextSheet',(app,html)=>attachProtectedPublicationButton(app.document?.parent,html?.querySelector?html:html?.[0]??app.element,openProtectedPublication));
    }
    const openPlayerBoardReview=()=>{gmOnly();if(!integration?.playerBoardEdits)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified player Actor/observer mapping and board storage required');
      const openDraft=async id=>{await loadEditorGraph(id);return openEditor();};
      const prepareHandler=async()=>{
        const model=new GraphEditorModel({registry:integration.graphRegistry,mode:'native',extensions});model.newGraph('Review player investigation edits');model.setRootTriggerType('core.trigger.manual');model.updateSelected({eventType:'narrative.board-edit-reviewed'});
        const request=model.addNode('core.data.event');model.updateSelected({payloadJSON:'{"valueType":"entity","path":["payload","editRequestId"]}'});const revision=model.addNode('core.data.event');model.updateSelected({payloadJSON:'{"valueType":"number","path":["payload","expectedRequestRevision"]}'});
        const effect=model.addNode('core.investigation.apply-board-edit');model.bindSelectedInput({field:'requestId',sourceNodeId:request});model.bindSelectedInput({field:'expectedRequestRevision',sourceNodeId:revision});model.connect(model.graph.rootNodeId,effect);await model.save();return {graphId:model.graph.id,published:false,activated:false};
      };
      const Window=makeGMBoardEditReviewWindow(Base,{gameInstance:game,service:integration.playerBoardEdits,prepareHandler,openDraft,openEvent:async id=>{const app=openEventReview();await app.loadEvent(id);}});const app=new Window();void app.render(true);return app;
    };
    const openPlanningLab=()=>{gmOnly();
      const Window=makeGMPlanningLabWindow(Base,{gameInstance:game,planStoreProvider:()=>integration?.plans??null,simulatePublished:integration?spec=>integration.reactiveRouter.simulatePublished(spec):null,planSubmissions:integration?.planSubmissions});const app=new Window();void app.render(true);return app;
    };
    const openTemplateDesk=()=>{gmOnly();if(!integration?.graphTemplates)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected graph template services required');
      const Window=makeGMTemplateDeskWindow(Base,{gameInstance:game,service:integration.graphTemplates,sourceGraphId:()=>editorModel.graph?.id??'',openDraft:async graphId=>{
        if(editorModel.state.dirty)throw new EasyPlotsError('UNSAVED_GRAPH','Save the open plot before opening this instance');
        await loadEditorGraph(graphId);return openEditor();
      }});const app=new Window();void app.render(true);return app;
    };
    const openCausalPlanningInspector=()=>{gmOnly();
      if(!integration?.timeCoordinator||!integration?.crossPlotCoordinator)
        throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected temporal and cross-plot services required');
      const Window=makeGMCausalPlanningWindow(Base,{gameInstance:game,
        queryDue:spec=>integration.timeCoordinator.due(spec),
        queryCrossPlot:spec=>integration.crossPlotCoordinator.preview(spec),
        queryNPC:spec=>integration.npcActions.assess(spec),
        catchup:integration.temporalCatchup,
        queueDue:spec=>integration.manualEvents.emitDue(spec)});
      const app=new Window();void app.render(true);return app;
    };
    const openResourceInspector=()=>{gmOnly();
      if(!integration?.readNativeBinding||!integration?.reverseReferences)
        throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected native resource repository is required');
      const Window=makeNativeResourceInspectorWindow(Base,{gameInstance:game,
        readBinding:integration.readNativeBinding,
        auditReferences:spec=>integration.reverseReferences.auditNative(spec)});
      const app=new Window();void app.render(true);return app;
    };
    const openContinuityDesk=()=>{gmOnly();
      if(!integration?.arcResolutions||!integration?.blueprints||!integration?.knowledgeLedger)
        throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected continuity services required');
      const Window=makeGMContinuityDeskWindow(Base,{gameInstance:game,
        arcResolutions:integration.arcResolutions,blueprints:integration.blueprints,
        knowledgeLedger:integration.knowledgeLedger});
      const app=new Window();void app.render(true);return app;
    };
    const openHistoryDesk=()=>{gmOnly();if(!integration?.chronology||!integration?.arcArchives)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected narrative history services required');
      const Window=makeGMHistoryDeskWindow(Base,{gameInstance:game,chronology:integration.chronology,archives:integration.arcArchives});const app=new Window();void app.render(true);return app;
    };
    const openSignalReliabilityDesk=()=>{gmOnly();if(!integration?.signalReliability)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected signal reliability service required');
      const Window=makeSignalReliabilityDeskWindow(Base,{gameInstance:game,service:integration.signalReliability});const app=new Window();void app.render(true);return app;
    };
    const openKnowledgeFactionDesk=()=>{gmOnly();
      if(!integration?.knowledgePropagation||!integration?.factionAgendas)
        throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected society/knowledge services required');
      const Window=makeGMKnowledgeFactionDeskWindow(Base,{gameInstance:game,knowledgePropagation:integration.knowledgePropagation,factionAgendas:integration.factionAgendas,forecasts:integration.forecasts,knowledgeReviews:integration.knowledgeReviews,identities:integration.narrativeIdentities});
      const app=new Window();void app.render(true);return app;
    };
    const openManualEventDesk=()=>{gmOnly();
      if(!integration?.manualEvents)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected GM manual event gateway required');
      const Window=makeGMManualEventWindow(Base,{gameInstance:game,submitManual:spec=>integration.manualEvents.emit(spec)});
      const app=new Window();void app.render(true);return app;
    };
    const openQuestPublicationDesk=()=>{gmOnly();
      if(!integration?.questProjections)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected quest publication service required');
      const Window=makeGMQuestPublicationWindow(Base,{gameInstance:game,service:integration.questProjections});
      const app=new Window();void app.render(true);return app;
    };
    const openSessionHandoff=()=>{gmOnly();
      if(!integration?.sessionHandoffs)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected session handoff repository required');
      const Window=makeGMSessionHandoffWindow(Base,{gameInstance:game,service:integration.sessionHandoffs});
      const app=new Window();void app.render(true);return app;
    };
    const openNarrativeSearch=()=>{gmOnly();
      if(!integration?.narrativeSearch)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected narrative search index required');
      const Window=makeGMNarrativeSearchWindow(Base,{gameInstance:game,service:integration.narrativeSearch});
      const app=new Window();void app.render(true);return app;
    };
    const openNotificationDesk=()=>{gmOnly();
      if(!integration?.narrativeNotifications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected notification repository required');
      const Window=makeGMNotificationWindow(Base,{gameInstance:game,service:integration.narrativeNotifications,deliverNotice:spec=>integration.notificationTransport.deliver(spec)});
      const app=new Window();void app.render(true);return app;
    };
    const navigateWorkspace=route=>{
      if(!game.user?.isGM){const tab={notices:'Notifications','player-quests':'Quests','player-investigations':'Investigations','player-known-world':'Known world','player-journal':'Journal'}[route];return openPlayerWorkspace({tab});}
      gmOnly();if(route==='campaign')return openCampaignWorkspace();if(route==='editor')return openEditor();
      const task=(title,description,open,dependency=null)=>({title,description,open,reason:!integration?'Set up or unlock world storage first.':dependency&&!integration[dependency]?'This integration is not connected in this world.':null});
      const sections={
        session:{title:'Session',intro:'Prepare, run and hand over the current session.',advanced:true,tasks:[task('Prepare next session','Select plots and review what is ready.',()=>api.openSessionPreparation(),'sessionPreparation'),task('Session overview','Inspect the selected plot and recent activity.',openCockpit),task('Record a story event','Review a manual event before submitting it.',openManualEventDesk),task('Session handoff','Review the handover to the next session.',openSessionHandoff)]},
        review:{title:'Review',intro:'Review requests and proposed consequences before making changes.',advanced:true,tasks:[task('Player requests','Review requests awaiting GM attention.',openApprovals),task('Narrative events','Inspect events and their proposed effects.',openEventReview),task('Player board changes','Review proposed investigation board edits.',openPlayerBoardReview,'playerBoardEdits'),task('Publications','Review content before sharing it with players.',openKnowledgePublications,'nativePublications')]},
        world:{title:'World',intro:'Manage the campaign content used by your plots.',advanced:true,tasks:[task('Knowledge and factions','Manage disclosures, affiliations and narrative knowledge.',openKnowledgeFactionDesk),task('Quests','Prepare quest boards and their publication.',openQuestPublicationDesk),task('Places and routes','Manage known places and spatial views.',()=>api.openSpatialDesk(),'spatial'),task('Resources','Inspect campaign resources and their lifecycle.',()=>api.openResourceManifests(),'resourceManifests'),task('Timelines','Inspect alternate versions of campaign history.',()=>api.openTimelineBranches(),'timelineBranches'),task('Templates and planning','Reuse existing plot structures.',openTemplateDesk)]},
        settings:{title:'Settings',intro:'Manage this world’s storage and inspect available integrations.',tasks:[{title:'World storage',description:setupState().state==='configured'?'Your private world storage is connected.':'Create or unlock private storage to keep your plots.',open:openSetup,label:'World setup'}, {title:'Advanced tools',description:'Existing service desks, integration diagnostics and recovery tools. These technical forms are being migrated to guided tasks.',open:()=>api.openStatus(),label:'Open advanced tools'}]}
      };
      const config=sections[route];if(!config)return openCampaignWorkspace();const Window=makeWorkspaceSection(Base,{id:route,...config});const panel=new Window();void panel.render(true);return panel;
    };
    const Status=makeStatusWindow(Base,{openEditor,openSetup,getSetupState:setupState,openApprovals,openEventReview,openPlanningLab,openTemplateDesk,openPlayerBoardReview,openKnowledgePublications,openEncounterClosures:()=>api.openEncounterClosures(),openRollSystemPolicy:()=>api.openRollSystemPolicy(),openNativeBatches:()=>api.openNativeBatches(),
      openContinuityDesk,openHistoryDesk,openSignalReliabilityDesk,openSessionHandoff,openQuestPublicationDesk,openManualEventDesk,openNarrativeSearch,openNotificationDesk,openCockpit,extraActions:[['Resource lifecycle',()=>api.openResourceManifests()],['Alternate timelines',()=>api.openTimelineBranches()],['Prepare next session',()=>api.openSessionPreparation()],['Spatial atlas',()=>api.openSpatialDesk()],['Publication preflight',()=>api.openGraphPreflight()],['Storage partitions',()=>api.openStoragePartitions()]],runtimeStatus:()=>integration?.runtimeStatus()??{running:false},mode:()=>editorModel.mode});
    const api=Object.freeze({
      version:VERSION,
      openGMWorkspace:openCampaignWorkspace,
      openPlayerWorkspace,
      openWorldSetup:openSetup,
      openSpatialDesk(){gmOnly();if(!integration?.spatial)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected spatial atlas storage required');const Window=makeSpatialDeskWindow(Base,{gameInstance:game,service:integration.spatial});const app=new Window();void app.render(true);return app;},
      inspectSpatialRegion(spec){gmOnly();if(!integration?.spatial)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected spatial atlas storage required');return integration.spatial.inspectRegion(spec);},
      inspectSpatialAtlas(spec){gmOnly();if(!integration?.spatial)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected spatial atlas storage required');return integration.spatial.inspectView(spec);},
      saveSpatialRegion(spec){gmOnly();if(!integration?.spatial)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected spatial atlas storage required');return integration.spatial.saveRegion(spec);},
      saveSpatialAtlas(spec){gmOnly();if(!integration?.spatial)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected spatial atlas storage required');return integration.spatial.saveView(spec);},
      previewSpatialAtlas(spec){gmOnly();if(!integration?.spatial)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected spatial atlas storage required');return integration.spatial.projection(spec);},
      planKnownSpatialRoute(spec){gmOnly();if(!integration?.spatial)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected spatial atlas storage required');return integration.spatial.route(spec);},
      openPlayerSpatialAtlas(){if(game.user?.isGM)throw new EasyPlotsError('PLAYER_ONLY','Player atlas requires an audience context');if(!playerSpatialTransport?.started)throw new EasyPlotsError('SOCKET_UNVERIFIED','Start the player atlas transport with verified socket evidence first');const Window=makePlayerSpatialWindow(Base,{transport:playerSpatialTransport});const app=new Window();void app.render(true);return app;},
      requestSpatialAtlas(spec,options){if(game.user?.isGM)throw new EasyPlotsError('PLAYER_ONLY','Player atlas requires an audience context');if(!playerSpatialTransport?.started)throw new EasyPlotsError('SOCKET_UNVERIFIED','Verified player atlas transport required');return playerSpatialTransport.request(spec,options);},
      openTimelineBranches(){gmOnly();if(!integration?.timelineBranches)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected timeline storage required');const Window=makeGMTimelineBranchWindow(Base,{gameInstance:game,service:integration.timelineBranches});const app=new Window();void app.render(true);return app;},
      openSessionPreparation(){gmOnly();if(!integration?.sessionPreparation)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected session preparation required');const Window=makeGMSessionPreparationWindow(Base,{gameInstance:game,service:integration.sessionPreparation,openHandoff:openSessionHandoff});const app=new Window();void app.render(true);return app;},
      readTimelineBranches(spec){gmOnly();if(!integration?.timelineBranches)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected timeline storage required');return integration.timelineBranches.read(spec);},
      readTimelineBranchVersion(spec){gmOnly();if(!integration?.timelineBranches)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected timeline storage required');return integration.timelineBranches.version(spec);},
      createTimelineBranches(spec){gmOnly();if(!integration?.timelineBranches)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected timeline storage required');return integration.timelineBranches.create(spec);},
      saveTimelineBranchVersion(spec){gmOnly();if(!integration?.timelineBranches)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected timeline storage required');return integration.timelineBranches.branch(spec);},
      selectCanonicalTimelineBranch(spec){gmOnly();if(!integration?.timelineBranches)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected timeline storage required');return integration.timelineBranches.selectCanonical(spec);},
      readCanonicalTimelineBranch(spec){gmOnly();if(!integration?.timelineBranches)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected timeline storage required');return integration.timelineBranches.canonical(spec);},
      readSessionPreparationPins(){gmOnly();if(!integration?.sessionPreparation)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected session preparation required');return integration.sessionPreparation.pins();},
      pinSessionPreparationPlots(spec){gmOnly();if(!integration?.sessionPreparation)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected session preparation required');return integration.sessionPreparation.pinPlots(spec);},
      prepareNextSession(spec){gmOnly();if(!integration?.sessionPreparation)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected session preparation required');return integration.sessionPreparation.prepare(spec);},
      readSessionPreparation(spec){gmOnly();if(!integration?.sessionPreparation)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected session preparation required');return integration.sessionPreparation.read(spec);},
      editSessionPreparation(spec){gmOnly();if(!integration?.sessionPreparation)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected session preparation required');return integration.sessionPreparation.edit(spec);},
      inspectSessionPreparationSources(spec){gmOnly();if(!integration?.sessionPreparation)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected session preparation required');return integration.sessionPreparation.sourceStatus(spec);},
      openNativeBatches(){gmOnly();if(!integration?.nativeBatches)throw new EasyPlotsError('NATIVE_BATCH_DEPENDENCY','Verified native batch storage required');const Window=makeNativeBatchWindow(Base,{gameInstance:game,service:integration.nativeBatches,sourceGraphId:()=>editorModel.graph?.id??'',configureDraft:async plan=>{gmOnly();if(editorModel.graph?.id!==plan.data.graphId)throw new EasyPlotsError('NATIVE_BATCH_GRAPH','Open the owning draft before configuring this plan');const existing=editorModel.graph.nodes.find(n=>n.typeId==='core.resource.ordered-batch'&&n.data.payload?.batchId===plan.id),id=existing?.id??editorModel.addNode('core.resource.ordered-batch');editorModel.selectNode(id);editorModel.updateSelected({payloadJSON:JSON.stringify({scope:plan.scope,batchId:plan.id,expectedBatchRevision:plan.revision,batchFingerprint:plan.data.fingerprint})});if(!editorModel.graph.edges.some(e=>e.source.nodeId===editorModel.graph.rootNodeId&&e.target.nodeId===id))editorModel.connect(editorModel.graph.rootNodeId,id);openEditor();}});const app=new Window();void app.render(true);return app;},
      prepareNativeBatch(spec){gmOnly();if(!integration?.nativeBatches)throw new EasyPlotsError('NATIVE_BATCH_DEPENDENCY','Verified native batch storage required');return integration.nativeBatches.prepare(spec);},
      inspectNativeBatch(spec){gmOnly();if(!integration?.nativeBatches)throw new EasyPlotsError('NATIVE_BATCH_DEPENDENCY','Verified native batch storage required');return integration.nativeBatches.inspect(spec);},
      reconcileNativeBatch(spec,review){gmOnly();if(!integration?.nativeBatches)throw new EasyPlotsError('NATIVE_BATCH_DEPENDENCY','Verified native batch storage required');return integration.nativeBatches.reconcile(spec,review);},
      prepareNativeBatchRemainder(spec){gmOnly();if(!integration?.nativeBatches)throw new EasyPlotsError('NATIVE_BATCH_DEPENDENCY','Verified native batch storage required');return integration.nativeBatches.prepareRemainder(spec);},
      openResourceManifests(){gmOnly();if(!integration?.resourceManifests)throw new EasyPlotsError('RESOURCE_DEPENDENCY','Verified native resource storage required');const Window=makeResourceManifestWindow(Base,{gameInstance:game,service:integration.resourceManifests,targetGraphId:()=>editorModel.graph?.id??'',configureDraft:async manifest=>{configureResourceActivationBranch(editorModel,manifest);openEditor();}});const app=new Window();void app.render(true);return app;},
      openGraphPreflight({graphId=editorModel.graph?.id,publishedVersion=null}={}){gmOnly();if(!integration?.graphValidations||!plotAuthoringRegistry)throw new EasyPlotsError('PREFLIGHT_DEPENDENCY','Verified graph validation required');const validations=publishedVersion?{...integration.graphValidations,publishedManifest:s=>integration.graphValidations.publishedManifest(s),adoptPublished:(s,opts)=>plotAuthoringRegistry.adoptPublishedDependencies(s.id,s.publishedVersion,opts)}:{inspectCandidate:(g,opts)=>plotAuthoringRegistry.inspectValidation(g.id,opts),validateCandidate:(g,opts)=>plotAuthoringRegistry.validateCandidate(g.id,{...opts,expectedRevision:g.revision})};const Window=makeGraphPreflightWindow(Base,{gameInstance:game,validations,preflight:integration.publicationPreflight,published:publishedVersion!==null,graphProvider:()=>publishedVersion?plotAuthoringRegistry.getPublished(graphId,publishedVersion):plotAuthoringRegistry.getDraft(graphId)});const app=new Window();void app.render(true);return app;},
      openStoragePartitions(){gmOnly();if(!integration?.storagePartitions)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified native storage required');const Window=makeStoragePartitionWindow(Base,{gameInstance:game,service:integration.storagePartitions});const app=new Window();void app.render(true);return app;},
      inspectStoragePartition(spec){gmOnly();if(!integration?.storagePartitions)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified native storage required');return integration.storagePartitions.inspect(spec);},
      reconcileStoragePartition(spec){gmOnly();if(!integration?.storagePartitions)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified native storage required');return integration.storagePartitions.reconcile(spec);},
      queryStorageMetadata(spec){gmOnly();if(!integration?.storagePartitions)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified native storage required');return integration.storagePartitions.query(spec);},
      pageDueCommitments(spec){gmOnly();if(!integration?.timeCoordinator)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified temporal storage required');return integration.timeCoordinator.page(spec);},
      validateGraphCandidate(graphId,opts){gmOnly();if(!plotAuthoringRegistry)throw new EasyPlotsError('PREFLIGHT_DEPENDENCY','Verified authoring required');return plotAuthoringRegistry.validateCandidate(graphId,opts);},
      inspectGraphValidation(graphId,opts){gmOnly();if(!plotAuthoringRegistry)throw new EasyPlotsError('PREFLIGHT_DEPENDENCY','Verified authoring required');return plotAuthoringRegistry.inspectValidation(graphId,opts);},
      adoptPublishedGraphDependencies(graphId,version,review){gmOnly();if(!plotAuthoringRegistry)throw new EasyPlotsError('PREFLIGHT_DEPENDENCY','Verified authoring required');return plotAuthoringRegistry.adoptPublishedDependencies(graphId,version,review);},
      prepareResourceManifest(spec){gmOnly();if(!integration?.resourceManifests)throw new EasyPlotsError('RESOURCE_DEPENDENCY','Verified resources required');return integration.resourceManifests.prepare(spec);},
      inspectResourceManifest(spec){gmOnly();if(!integration?.resourceManifests)throw new EasyPlotsError('RESOURCE_DEPENDENCY','Verified resources required');return integration.resourceManifests.inspect(spec);},
      markResourcesMaterialized(spec,review){gmOnly();if(!integration?.resourceManifests)throw new EasyPlotsError('RESOURCE_DEPENDENCY','Verified resources required');return integration.resourceManifests.markMaterialized(spec,review);},
      requestResourceActivation(spec,review){gmOnly();if(!integration?.resourceManifests)throw new EasyPlotsError('RESOURCE_DEPENDENCY','Verified resources required');return integration.resourceManifests.requestActivation(spec,review);},
      openRollSystemPolicy(){gmOnly();if(!integration?.rollSystemPolicies)throw new EasyPlotsError('ROLL_POLICY_DEPENDENCY','Verified roll policy storage required');const Window=makeRollSystemPolicyWindow(Base,{gameInstance:game,service:integration.rollSystemPolicies});const app=new Window();void app.render(true);return app;},
      registerRollSystemPolicy(manifest){gmOnly();if(!integration?.rollSystemPolicies)throw new EasyPlotsError('ROLL_POLICY_DEPENDENCY','Verified roll policy storage required');return integration.rollSystemPolicies.register(manifest);},
      inspectRollSystemPolicy(){gmOnly();if(!integration?.rollSystemPolicies)throw new EasyPlotsError('ROLL_POLICY_DEPENDENCY','Verified roll policy storage required');return integration.rollSystemPolicies.inspect();},
      selectRollSystemPolicy(spec){gmOnly();if(!integration?.rollSystemPolicies)throw new EasyPlotsError('ROLL_POLICY_DEPENDENCY','Verified roll policy storage required');return integration.rollSystemPolicies.select(spec);},
      openLiveAppearance,
      async resolveNarrativeIdentity(spec){gmOnly();if(!integration?.narrativeIdentities)throw new EasyPlotsError('IDENTITY_UNAVAILABLE','Verified identity storage required');return integration.narrativeIdentities.resolve(spec);},
      openEncounterClosures(){gmOnly();if(!integration?.encounterClosures)throw new EasyPlotsError('ENCOUNTER_UNAVAILABLE','Verified native Combat integration required');const Window=makeEncounterClosureDeskWindow(Base,{gameInstance:game,service:integration.encounterClosures});const app=new Window();void app.render(true);return app;},
      async previewEncounterClosure(spec){gmOnly();if(!integration?.encounterClosures)throw new EasyPlotsError('ENCOUNTER_UNAVAILABLE','Verified native Combat integration required');return integration.encounterClosures.preview(spec);},
      async selectEncounterClosure(spec,review){gmOnly();if(!integration?.encounterClosures)throw new EasyPlotsError('ENCOUNTER_UNAVAILABLE','Verified native Combat integration required');return integration.encounterClosures.select(spec,review);},
      async submitEncounterClosure(spec,review){gmOnly();if(!integration?.encounterClosures)throw new EasyPlotsError('ENCOUNTER_UNAVAILABLE','Verified native Combat integration required');return integration.encounterClosures.emit(spec,review);},
      openPlotAuthority,
      async inspectPlotAuthority(graphId){gmOnly();if(!plotAuthoringRegistry)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Verified authoring required');return plotAuthoringRegistry.inspectAuthority(graphId);},
      async inspectGMPlotAuthoringRequest(requestId){gmOnly();if(!plotAuthoringRegistry)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Verified authoring required');return plotAuthoringRegistry.inspectCommand(requestId);},
      async updatePlotAuthority(spec){gmOnly();if(!plotAuthoringRegistry)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Verified authoring required');return plotAuthoringRegistry.updateAuthority(spec);},
      startVerifiedGMPlotAuthoring(){gmOnly();if(!integration)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Configure the designated GM native integration first');return integration.startGMAuthoring();},
      stopVerifiedGMPlotAuthoring(){gmOnly();return integration?.stopGMAuthoring()??{started:false};},
      connectGMPlotAuthoring({attestation}={}){
        gmOnly();if(integration||remoteAuthoringTransport)throw new EasyPlotsError('NATIVE_ALREADY_CONFIGURED','This client already has a native backend');
        if(editorModel.state.dirty)throw new EasyPlotsError('UNSAVED_SANDBOX_EDITS','Save or discard local work before connecting');
        if(game.users?.activeGM?.id===game.user.id)throw new EasyPlotsError('GM_COORDINATOR_SETUP','The coordinator configures protected storage directly');
        const transport=new NativeGMAuthoringTransport({gameInstance:game,attestation});transport.start();
        plotAuthoringRegistry=new GMPlotRegistryClient({invoke:(method,args)=>transport.request(method,args),isLocalGM:gates.isLocalGM});remoteAuthoringTransport=transport;
        editorModel=new GraphEditorModel({registry:plotAuthoringRegistry,mode:'native',extensions});if(editorWindow?.rendered)void editorWindow.close();editorWindow=null;return {connected:true,mode:'guarded-native-gm-client'};
      },
      disconnectGMPlotAuthoring(){gmOnly();remoteAuthoringTransport?.stop();return {connected:false};},
      reconnectGMPlotAuthoring(){gmOnly();if(!remoteAuthoringTransport)throw new EasyPlotsError('GM_COMMAND_UNAVAILABLE','Connect to a verified coordinator first');return remoteAuthoringTransport.start();},
      openTemplateDesk,
      openPlayerBoardReview,
      openProtectedPublication,
      openKnowledgePublications,
      openPlayerNoticeInbox,
      async registerKnowledgeDependencies(spec){gmOnly();if(!integration?.knowledgeReviews)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected dependency review service required');return integration.knowledgeReviews.register(spec);},
      async retireKnowledgeDependencies(spec){gmOnly();if(!integration?.knowledgeReviews)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected dependency review service required');return integration.knowledgeReviews.retire(spec);},
      async inspectStagedKnowledgeCorrection(spec){gmOnly();if(!integration?.knowledgeReviews)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected correction source index required');return integration.knowledgeReviews.inspectCorrectionStage(spec);},
      async reviewStagedKnowledgeCorrection(spec){gmOnly();if(!integration?.knowledgeReviews)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected correction source index required');return integration.knowledgeReviews.reviewCorrectionStage(spec);},
      async beginKnowledgeReview(spec){gmOnly();if(!integration?.knowledgeReviews)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected dependency review service required');return integration.knowledgeReviews.begin(spec);},
      async inspectKnowledgeReview(spec){gmOnly();if(!integration?.knowledgeReviews)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected dependency review service required');return integration.knowledgeReviews.readJob(spec);},
      async advanceKnowledgeReview(spec){gmOnly();if(!integration?.knowledgeReviews)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected dependency review service required');return integration.knowledgeReviews.advance(spec);},
      async listDependentKnowledgeReviews(spec){gmOnly();if(!integration?.knowledgeReviews)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected dependency review service required');return integration.knowledgeReviews.list(spec);},
      async decideDependentKnowledgeReview(spec){gmOnly();if(!integration?.knowledgeReviews)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected dependency review service required');return integration.knowledgeReviews.decide(spec);},
      async reconcileVerifiedOperation(eventId,operationId,review){gmOnly();if(!integration?.reviews)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected operation review required');return integration.reviews.reconcile(eventId,operationId,review);},
      async adoptUnexecutedOperationApproval(eventId,operationId,review){gmOnly();if(!integration?.reviews)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected operation review required');return integration.reviews.adoptApproval(eventId,operationId,review);},
      async proposeKnowledgePublication(spec){gmOnly();if(!integration?.knowledgePublications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge publication plans required');return integration.knowledgePublications.propose(spec);},
      async prepareKnowledgePublication(spec){gmOnly();if(!integration?.knowledgePublications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge publication plans required');return integration.knowledgePublications.prepare(spec);},
      async prepareRollPublication(spec){gmOnly();if(!integration?.knowledgePublications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected native roll publication plans required');return integration.knowledgePublications.prepareRoll(spec);},
      async inspectKnowledgePublication(spec){gmOnly();if(!integration?.knowledgePublications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge publication plans required');return integration.knowledgePublications.read(spec);},
      async approveKnowledgePublication(spec){gmOnly();if(!integration?.knowledgePublications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge publication plans required');return integration.knowledgePublications.approve(spec);},
      async retireKnowledgePublication(spec){gmOnly();if(!integration?.knowledgePublications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge publication plans required');return integration.knowledgePublications.retire(spec);},
      async inspectNativePublication(spec){gmOnly();if(!integration?.nativePublications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected native publication service required');return integration.nativePublications.inspect(spec);},
      async confirmNativePublication(spec){gmOnly();if(!integration?.nativePublications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected native publication service required');return integration.nativePublications.confirm(spec);},
      startVerifiedPublicationKeys(){gmOnly();if(!integration)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected native publication service required');
        if(!nativeAttestation?.socketSenderVerified||!nativeAttestation?.socketRecipientVerified||!nativeAttestation?.socketForgeryRejected||!nativeAttestation?.socketNoBroadcastVerified)throw new EasyPlotsError('SOCKET_UNVERIFIED','Authenticated targeted key delivery requires verified native sockets');
        return integration.startPublicationKeys();
      },
      stopVerifiedPublicationKeys(){gmOnly();return integration?.stopPublicationKeys()??{started:false};},
      async listPlayerBoardEdits(spec){gmOnly();if(!integration?.playerBoardEdits)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected board edit inbox required');return integration.playerBoardEdits.list(spec);},
      async inspectPlayerBoardEdit(spec){gmOnly();if(!integration?.playerBoardEdits)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected board edit inbox required');return integration.playerBoardEdits.read(spec);},
      async proposePlayerBoardEdit(spec){gmOnly();if(!integration?.playerBoardEdits)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected board edit inbox required');return integration.playerBoardEdits.queueForGMReview(spec);},
      async dismissPlayerBoardEdit(spec){gmOnly();if(!integration?.playerBoardEdits)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected board edit inbox required');return integration.playerBoardEdits.dismiss(spec);},
      async exportPlotTemplate(spec){gmOnly();if(!integration?.graphTemplates)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected graph template services required');return integration.graphTemplates.exportGraph(spec);},
      async storePlotTemplate(spec){gmOnly();if(!integration?.graphTemplates)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected graph template services required');return integration.graphTemplates.store(spec);},
      async exportStoredPlotTemplate(spec){gmOnly();if(!integration?.graphTemplates)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected graph template services required');return integration.graphTemplates.exportStored(spec);},
      async previewPlotTemplateInstance(spec){gmOnly();if(!integration?.graphTemplates)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected graph template services required');return integration.graphTemplates.previewInstance(spec);},
      async instantiatePlotTemplate(spec,review){gmOnly();if(!integration?.graphTemplates)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected graph template services required');return integration.graphTemplates.instantiate(spec,review);},
      async simulatePublishedGraph(spec){gmOnly();if(!integration?.reactiveRouter)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected published graph simulator required');return integration.taskScheduler.submit({priority:'background',run:()=>integration.reactiveRouter.simulatePublished(spec)});},
      async previewOperationContinuation(spec){gmOnly();if(!integration?.operationContinuations)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified operation continuation service required');return integration.operationContinuations.preview(spec);},
      async continueCompletedOperations(spec,review){gmOnly();if(!integration?.operationContinuations)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified operation continuation service required');return integration.operationContinuations.emit(spec,review);},
      async previewReviewedPlanSubmission(spec){gmOnly();if(!integration?.planSubmissions)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected reviewed plan submission service required');return integration.planSubmissions.preview(spec);},
      async inspectNPCAction(spec){gmOnly();if(!integration?.npcActions)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected NPC agenda and knowledge service required');return integration.npcActions.assess(spec);},
      async createTemporalCatchup(spec){gmOnly();if(!integration?.temporalCatchup)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected temporal catch-up service required');return integration.temporalCatchup.create(spec);},
      async inspectTemporalCatchup(spec){gmOnly();if(!integration?.temporalCatchup)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected temporal catch-up service required');return integration.temporalCatchup.read(spec);},
      async advanceTemporalCatchup(spec){gmOnly();if(!integration?.temporalCatchup)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected temporal catch-up service required');return integration.temporalCatchup.advance(spec);},
      async inspectTemporalCatchupPage(spec){gmOnly();if(!integration?.temporalCatchup)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected temporal catch-up service required');return integration.temporalCatchup.readPage(spec);},
      async submitReviewedPlan(spec,review){gmOnly();if(!integration?.planSubmissions)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected reviewed plan submission service required');return integration.planSubmissions.submit(spec,review);},
      openSignalReliabilityDesk,
      async configureSignalReliability(spec){gmOnly();if(!integration?.signalReliability)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected reliability service required');return integration.signalReliability.configure(spec);},
      async inspectPendingCriticalSignals(spec){gmOnly();if(!integration?.signalReliability)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected reliability service required');return integration.signalReliability.listPending(spec);},
      async inspectCriticalSignal(spec){gmOnly();if(!integration?.signalReliability)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected reliability service required');return integration.signalReliability.inspect(spec);},
      async reconcileCriticalSignal(spec){gmOnly();if(!integration?.signalReliability)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected reliability service required');return integration.signalReliability.reconcile(spec);},
      async resumeCriticalSignal(spec){gmOnly();if(!integration?.signalReliability)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected reliability service required');return integration.signalReliability.resume(spec);},
      async dismissCriticalSignal(spec){gmOnly();if(!integration?.signalReliability)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected reliability service required');return integration.signalReliability.dismiss(spec);},
      async checkWatchedSignalSources(spec){gmOnly();if(!integration?.signalReliability)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected reliability service required');return integration.signalReliability.checkSources(spec);},
      async acknowledgeSignalSource(spec){gmOnly();if(!integration?.signalReliability)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected reliability service required');return integration.signalReliability.acknowledgeSource(spec);},
      openHistoryDesk,
      async recordNarrativeChronology(spec){gmOnly();if(!integration?.chronology)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected chronology service required');return integration.chronology.recordEvent(spec);},
      async indexNarrativeDisclosure(spec){gmOnly();if(!integration?.chronology)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected chronology service required');return integration.chronology.indexDisclosure(spec);},
      async inspectNarrativeChronology(spec){gmOnly();if(!integration?.chronology)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected chronology service required');return integration.chronology.query(spec);},
      async prepareArcArchive(spec){gmOnly();if(!integration?.arcArchives)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc archive service required');return integration.arcArchives.prepare(spec);},
      async appendArcArchiveBatch(spec){gmOnly();if(!integration?.arcArchives)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc archive service required');return integration.arcArchives.appendBatch(spec);},
      async sealArcArchive(spec){gmOnly();if(!integration?.arcArchives)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc archive service required');return integration.arcArchives.seal(spec);},
      async advanceArcArchive(spec){gmOnly();if(!integration?.arcArchives)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc archive service required');return integration.arcArchives.advance(spec);},
      async finalizeArcArchive(spec){gmOnly();if(!integration?.arcArchives)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc archive service required');return integration.arcArchives.finalize(spec);},
      async inspectArcArchive(spec){gmOnly();if(!integration?.arcArchives)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc archive service required');return integration.arcArchives.inspect(spec);},
      async readArcArchiveSummary(spec){gmOnly();if(!integration?.arcArchives)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc archive service required');return integration.arcArchives.readSummary(spec);},
      async readArcArchivePage(spec){gmOnly();if(!integration?.arcArchives)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc archive service required');return integration.arcArchives.loadPage(spec);},
      configureRuntimeDiagnostics(spec){gmOnly();if(!integration?.diagnostics)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Native runtime required');return integration.diagnostics.configure(spec);},
      inspectRuntimeDiagnostics(){gmOnly();if(!integration?.diagnostics)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Native runtime required');return {diagnostics:integration.diagnostics.snapshot(),scheduler:integration.taskScheduler.status};},
      openNarrativeDock(){return openGMWorkspace('dock');},
      openNarrativeInspector(){return openGMWorkspace('inspector');},
      async inspectGMFocus(){gmOnly();if(!integration?.focusController)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected GM workspace required');return integration.focusController.snapshot();},
      get integrationState(){return integration?'guarded-native-manually-configured':'sandbox-only';},
      openStatus(){gmOnly();return new Status().render(true);},
      async inspectLegacyCanonicalDomain(providerId,payload){
        gmOnly();const provider=integration?.providers.get(providerId);
        if(typeof provider?.previewLegacyAdoption!=='function')throw new EasyPlotsError('LEGACY_ADOPTION_UNAVAILABLE','A supported configured canonical provider is required');
        return provider.previewLegacyAdoption(payload);
      },
      async adoptLegacyCanonicalDomain(providerId,payload,review){
        gmOnly();const provider=integration?.providers.get(providerId);
        if(typeof provider?.adoptLegacy!=='function')throw new EasyPlotsError('LEGACY_ADOPTION_UNAVAILABLE','A supported configured canonical provider is required');
        return provider.adoptLegacy(payload,review);
      },
      async inspectDomainRevision(type,scope,id,revision){gmOnly();if(!integration?.domains)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected domain store required');return integration.domains.readRevision(type,scope,id,revision);},
      async previewNarrativeCorrection(spec){gmOnly();if(!integration?.domains)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected domain store required');return integration.domains.previewCorrection(spec);},
      async prepareNarrativeForecast(spec){gmOnly();if(!integration?.forecasts)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected forecasting service required');return integration.forecasts.create(spec);},
      async inspectNarrativeForecast(spec){gmOnly();if(!integration?.forecasts)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected forecasting service required');return integration.taskScheduler.submit({priority:'background',run:()=>integration.forecasts.inspect(spec)});},
      openEditor,openApprovals,openEventReview,openCockpit,openInvestigationBoard,openPlanningLab,openResourceInspector,openCausalPlanningInspector,openContinuityDesk,openKnowledgeFactionDesk,openSessionHandoff,openQuestPublicationDesk,openManualEventDesk,openNarrativeSearch,openNotificationDesk,
      previewOrchestration(mode,scenario){gmOnly();return evaluatePlanningFixture(mode,scenario);},
      async inspectFocusedNarrativeHealth(spec){gmOnly();if(!integration?.focusedHealth)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected focused health service required');return integration.taskScheduler.submit({priority:'background',run:()=>integration.focusedHealth.inspect(spec)});},
      async queueNarrativeNotice(spec){gmOnly();if(!integration?.narrativeNotifications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected notifications required');return integration.narrativeNotifications.queue(spec);},
      async deliverApprovedNarrativeNotice(spec){gmOnly();if(!integration?.notificationTransport)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified notification delivery required');return integration.notificationTransport.deliver(spec);},
      async approveNarrativeNotice(spec){gmOnly();if(!integration?.narrativeNotifications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected notifications required');return integration.narrativeNotifications.approve(spec);},
      async listNarrativeNotices(spec){gmOnly();if(!integration?.narrativeNotifications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected notifications required');return integration.narrativeNotifications.listGM(spec);},
      async previewNarrativeNoticeProjection(spec){gmOnly();if(!integration?.narrativeNotifications)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected notifications required');return integration.narrativeNotifications.project(spec);},
      async indexVerifiedNarrativeRecord(spec){gmOnly();if(!integration?.narrativeSearch)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected search required');return integration.narrativeSearch.indexVerifiedDomain(spec);},
      async indexFocusedNarrativeReference(spec){gmOnly();if(!integration?.narrativeSearch)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected search index required');return integration.narrativeSearch.index(spec);},
      async searchNarrativeReferences(spec){gmOnly();if(!integration?.narrativeSearch)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected search index required');return integration.narrativeSearch.search(spec);},
      async recoverNarrativeSearchIndex(spec){gmOnly();if(!integration?.narrativeSearch)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected search index required');return integration.narrativeSearch.resume(spec);},
      async submitGMManualNarrativeEvent(spec){gmOnly();if(!integration?.manualEvents)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected manual event gateway required');return integration.manualEvents.emit(spec);},
      async prepareQuestPublication(spec){gmOnly();if(!integration?.questProjections)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected quest publication service required');return integration.questProjections.prepare(spec);},
      async approveQuestPublication(spec){gmOnly();if(!integration?.questProjections)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected quest publication service required');return integration.questProjections.approve(spec);},
      async previewQuestProjection(spec){gmOnly();if(!integration?.questProjections)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected quest publication service required');return integration.questProjections.project(spec);},
      async prepareSessionHandoff(spec){gmOnly();if(!integration?.sessionHandoffs)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected handoff service required');return integration.sessionHandoffs.prepare(spec);},
      async approveSessionHandoff(spec){gmOnly();if(!integration?.sessionHandoffs)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected handoff service required');return integration.sessionHandoffs.approve(spec);},
      async readSessionHandoff(spec){gmOnly();if(!integration?.sessionHandoffs)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected handoff service required');return integration.sessionHandoffs.read(spec);},
      async previewSessionRecap(spec){gmOnly();if(!integration?.sessionHandoffs)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected handoff service required');return integration.sessionHandoffs.project(spec);},
      async savePlanningPreview(spec){gmOnly();if(!integration?.plans)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Native GM planning repository is unavailable');return integration.plans.create(spec);},
      async reviewPlanningPreview(spec){gmOnly();if(!integration?.plans)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Native GM planning repository is unavailable');return integration.plans.acknowledge(spec);},
      async previewCrossPlotDependencies(spec){gmOnly();if(!integration?.crossPlotCoordinator)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected cross-plot index required');return integration.crossPlotCoordinator.preview(spec);},
      async scheduleNarrativeCommitment(spec){gmOnly();if(!integration?.timeCoordinator)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected schedule repository required');return integration.timeCoordinator.schedule(spec);},
      async inspectDueNarrativeCommitments(spec){gmOnly();if(!integration?.timeCoordinator)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected schedule repository required');return integration.timeCoordinator.due(spec);},
      async resolveNarrativeCommitment(spec){gmOnly();if(!integration?.timeCoordinator)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected schedule repository required');return integration.timeCoordinator.recordOutcome(spec);},
      async repairNarrativeCommitmentIndex(spec){gmOnly();if(!integration?.timeCoordinator)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected schedule repository required');return integration.timeCoordinator.repairIndex(spec);},
      async stageDueSchedule(spec){gmOnly();if(!integration?.temporalIndex)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected due index required');return integration.temporalIndex.stage(spec);},
      async inspectDueSchedule(spec){gmOnly();if(!integration?.temporalIndex)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected due index required');return integration.temporalIndex.due(spec);},
      async createNarrativeVote(spec){gmOnly();if(!integration?.votes)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected vote service required');return integration.votes.create(spec);},
      async recordVerifiedNarrativeBallot(spec){gmOnly();if(!integration?.votes)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected vote service required');return integration.votes.recordBallot(spec);},
      async assessNarrativeVote(spec){gmOnly();if(!integration?.votes)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected vote service required');return integration.votes.evaluate(spec);},
      async finalizeNarrativeVote(spec){gmOnly();if(!integration?.votes)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected vote service required');return integration.votes.finalize(spec);},
      async projectNarrativeVote(spec){gmOnly();if(!integration?.votes)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected vote service required');return integration.votes.project(spec);},
      async createInvestigationMilestone(spec){gmOnly();if(!integration?.investigationMilestones)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected milestone service required');return integration.investigationMilestones.createContract(spec);},
      async contributeInvestigationEvidence(spec){gmOnly();if(!integration?.investigationMilestones)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected milestone service required');return integration.investigationMilestones.recordEvidence(spec);},
      async assessInvestigationMilestone(spec){gmOnly();if(!integration?.investigationMilestones)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected milestone service required');return integration.investigationMilestones.assess(spec);},
      async approveInvestigationMilestone(spec){gmOnly();if(!integration?.investigationMilestones)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected milestone service required');return integration.investigationMilestones.complete(spec);},
      async projectInvestigationMilestones(spec){gmOnly();if(!integration?.investigationMilestones)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected milestone service required');return integration.investigationMilestones.project(spec);},
      async createPropagationPlan(spec){gmOnly();if(!integration?.knowledgePropagation)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge propagation required');return integration.knowledgePropagation.plan(spec);},
      async inspectPropagationPlan(spec){gmOnly();if(!integration?.knowledgePropagation)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge propagation required');return integration.knowledgePropagation.readPlan(spec);},
      async inspectPropagationRecipient(spec){gmOnly();if(!integration?.knowledgePropagation)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge propagation required');return integration.knowledgePropagation.readDecision(spec);},
      async publishFactionAgenda(spec){gmOnly();if(!integration?.factionAgendas)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected faction agenda service required');return integration.factionAgendas.publish(spec);},
      async assessFactionAgenda(spec){gmOnly();if(!integration?.factionAgendas)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected faction agenda service required');return integration.factionAgendas.assess(spec);},
      async emitGMDueNarrativeEvent(spec){gmOnly();if(!integration?.manualEvents)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected temporal event gateway required');return integration.manualEvents.emitDue(spec);},
      async emitGMManualNarrativeEvent(spec){gmOnly();if(!integration?.manualEvents)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','GM manual event gateway unavailable');return integration.manualEvents.emit(spec);},
      async inspectReviewedFactionSchedule(spec){gmOnly();if(!integration?.reviewedFactionScheduling)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Reviewed faction scheduler unavailable');return integration.reviewedFactionScheduling.verify(spec);},
      async createNarrativeClaim(spec){gmOnly();if(!integration?.knowledgeLedger)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge ledger required');return integration.knowledgeLedger.createClaim(spec);},
      async discloseNarrativeClaim(spec){gmOnly();if(!integration?.knowledgeLedger)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge ledger required');return integration.knowledgeLedger.recordDisclosure(spec);},
      async correctNarrativeDisclosure(spec){gmOnly();if(!integration?.knowledgeLedger)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge ledger required');return integration.knowledgeLedger.correctReceipt(spec);},
      async previewObserverKnowledge(spec){gmOnly();if(!integration?.knowledgeLedger)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected knowledge ledger required');return integration.knowledgeLedger.projection(spec);},
      async publishBlueprintRevision(spec){gmOnly();if(!integration?.blueprints)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected blueprint catalog required');return integration.blueprints.publish(spec);},
      async instantiateBlueprint(spec){gmOnly();if(!integration?.blueprints)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected blueprint catalog required');return integration.blueprints.instantiate(spec);},
      async previewBlueprintUpdate(spec){gmOnly();if(!integration?.blueprints)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected blueprint catalog required');return integration.blueprints.planAdoption(spec);},
      async adoptBlueprintUpdate(spec){gmOnly();if(!integration?.blueprints)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected blueprint catalog required');return integration.blueprints.adopt(spec);},
      async planCampaignFinalization(spec){gmOnly();if(!integration?.arcResolutions)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc resolution service required');return integration.arcResolutions.plan(spec);},
      async finalizeCampaignArc(spec){gmOnly();if(!integration?.arcResolutions)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc resolution service required');return integration.arcResolutions.finalize(spec);},
      async inspectCampaignFinalization(spec){gmOnly();if(!integration?.arcResolutions)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc resolution service required');return integration.arcResolutions.inspect(spec);},
      async reconcileCampaignFinalization(spec){gmOnly();if(!integration?.arcResolutions)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected arc resolution service required');return integration.arcResolutions.reconcile(spec);},
      async recordReviewedHypothesis(spec){gmOnly();if(!integration?.investigations)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected investigation records required');return integration.investigations.recordReviewedHypothesis(spec);},
      async readReviewedInvestigationBoard(spec){gmOnly();if(!integration?.investigations)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Protected investigation records required');return integration.investigations.boardForObserver(spec);},
      async readPlanningPreview(scope,id){gmOnly();if(!integration?.plans)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Native GM planning repository is unavailable');return integration.plans.read(scope,id);},
      previewMigration(spec){gmOnly();if(!integration?.migrations)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified native storage is required');return integration.migrations.preview(spec);},
      inspectMigration(spec){gmOnly();if(!integration?.migrations)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified native storage is required');return integration.migrations.inspect(spec);},
      applyMigration(spec){gmOnly();if(!integration?.migrations)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified native storage is required');return integration.migrations.apply(spec);},
      registerNativeMigration(step){gmOnly();if(!integration?.migrations)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Verified native storage is required');return integration.migrations.register(step);},
      registerNodeExtension(manifest){gmOnly();return extensions.register(manifest);},
      registerNarrativeAction(manifest){gmOnly();if(!integration?.narrativeActions)throw new EasyPlotsError('ACTION_DEPENDENCY','Configure the designated GM native integration first');return integration.narrativeActions.register(manifest);},
      describeNarrativeActions(){gmOnly();return integration?.narrativeActions.list()??[];},
      registerLazyNodeExtension(typeId,loader){gmOnly();return extensions.registerLazy(typeId,loader);},
      async loadNodeExtension(typeId){gmOnly();const result=await extensions.load(typeId);return {typeId:result.typeId,version:result.version};},
      openPlayerNarrativePortal(){
        if(game.user?.isGM)throw new EasyPlotsError('PLAYER_ONLY','Audience portal is for players');
        const requestProjection=async({kind,id,actorId})=>{
          if(kind==='investigation-board'){
            if(!playerBoardTransport){playerBoardTransport=new NativeFoundryBoardTransport({gameInstance:game});playerBoardTransport.start();}
            return playerBoardTransport.request({investigationId:id,actorId});
          }
          if(!playerContinuityTransport){playerContinuityTransport=new NativeFoundryContinuityTransport({gameInstance:game});playerContinuityTransport.start();}
          return playerContinuityTransport.request({kind,recordId:id,actorId});
        };
        const Window=makePlayerNarrativePortalWindow(Base,{gameInstance:game,requestProjection,openInvestigationBoard:openPlayerInvestigationBoard});
        const app=new Window();void app.render(true);return app;
      },
      async requestApprovedSessionRecap(sessionId,actorId){
        if(game.user?.isGM)throw new EasyPlotsError('PLAYER_ONLY','Player-approved recap requests only');
        if(!playerContinuityTransport){playerContinuityTransport=new NativeFoundryContinuityTransport({gameInstance:game});playerContinuityTransport.start();}
        const projection=await playerContinuityTransport.request({kind:'session-recap',recordId:sessionId,actorId});rememberSharedView('session-recap',sessionId,actorId,projection);
        const Window=makePlayerContinuityWindow(Base,{kind:'session-recap',projection});const app=new Window();void app.render(true);return app;
      },
      async requestApprovedQuestBoard(publicationId,actorId){
        if(game.user?.isGM)throw new EasyPlotsError('PLAYER_ONLY','Player-approved quest view requests only');
        if(!playerContinuityTransport){playerContinuityTransport=new NativeFoundryContinuityTransport({gameInstance:game});playerContinuityTransport.start();}
        const projection=await playerContinuityTransport.request({kind:'quest-board',recordId:publicationId,actorId});rememberSharedView('quest-board',publicationId,actorId,projection);
        const Window=makePlayerContinuityWindow(Base,{kind:'quest-board',projection});const app=new Window();void app.render(true);return app;
      },
      async requestFinalizedVoteResult(decisionId,actorId){
        if(game.user?.isGM)throw new EasyPlotsError('PLAYER_ONLY','Player-approved decision requests only');
        if(!playerContinuityTransport){playerContinuityTransport=new NativeFoundryContinuityTransport({gameInstance:game});playerContinuityTransport.start();}
        const projection=await playerContinuityTransport.request({kind:'vote-result',recordId:decisionId,actorId});rememberSharedView('vote-result',decisionId,actorId,projection);
        const Window=makePlayerContinuityWindow(Base,{kind:'vote-result',projection});const app=new Window();void app.render(true);return app;
      },
      async requestInvestigationBoard(investigationId,actorId){
        return openPlayerInvestigationBoard(investigationId,actorId);
      },
      get reactiveStatus(){gmOnly();return integration?.runtimeStatus()??{running:false,inflight:0,recentEventIds:[]};},
      async resolveGMCheck(spec){gmOnly();if(!integration?.rolls)throw new EasyPlotsError('ROLL_ADAPTER_UNAVAILABLE','Verified native Actor binding and Roll adapter required');
        return integration.rolls.resolve(spec);},
      async resolveGMContestedCheck(spec){gmOnly();if(!integration?.opposedRolls)throw new EasyPlotsError('ROLL_ADAPTER_UNAVAILABLE','Verified native Actor bindings and Roll adapter required');
        return integration.opposedRolls.resolve(spec);},
      async explainNarrativeEvent(graphId,eventId){gmOnly();if(!integration)throw new EasyPlotsError('STORAGE_NOT_CONFIGURED','Native protected event ledger required');
        return explainNarrativeEvent({eventId,graphId,ledger:integration.eventLedger,gmProvider});},
      async inspectNarrativeEvent(eventId){gmOnly();if(!integration)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Native event journal is unavailable');return integration.eventLedger.get(eventId);},
      /** Configure only after observed multi-client tests of the exact world/pack/build. */
      configureVerifiedNative({packId,vaultPack=null,attestation,coreBuild,checkOpportunity,resolveObserver,resolveNativeActor,resolveNotificationUser,authorizeNotificationRecipient}={}){
        gmOnly();
        if(integration||remoteAuthoringTransport)throw new EasyPlotsError('NATIVE_ALREADY_CONFIGURED','Native integration already initialized in this client');
        if(editorModel.state.dirty)throw new EasyPlotsError('UNSAVED_SANDBOX_EDITS','Discard unsaved sandbox work before switching storage');
        if(vaultPack&&(!isEncryptedNativePack(vaultPack)||vaultPack.collection!==packId))throw new EasyPlotsError('VAULT_PACK','An unlocked encrypted world vault is required');
        const pack=vaultPack??game.packs.get(packId);
        if(!pack)throw new EasyPlotsError('PACK_NOT_FOUND','Requested world pack was not found');
        const configured=createVerifiedGMStorageAndIntentSubsystem({gameInstance:game,pack,attestation,coreBuild,checkOpportunity,resolveObserver,resolveNativeActor,resolveNotificationUser,authorizeNotificationRecipient,extensions});
        const registry=configured.authoringRegistry;
        plotAuthoringRegistry=registry;
        integration=configured;
        nativeAttestation=attestation;
        editorModel=new GraphEditorModel({registry,mode:'native',extensions});
        if(editorWindow?.rendered)void editorWindow.close();
        editorWindow=null;
        if(typeof globalThis.Hooks?.on==='function'&&typeof globalThis.Hooks?.off==='function')void configured.watchSceneFocus().catch(()=>console.warn('[Easy Plots] Scene focus requires review'));
        return {configured:true,mode:'guarded-native',transportStarted:false};
      },
      startVerifiedPlayerIntents(){gmOnly();
        if(!integration)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Verified native subsystem not configured');
        if(!nativeAttestation?.socketSenderVerified || !nativeAttestation?.socketRecipientVerified ||
          !nativeAttestation?.socketForgeryRejected || !nativeAttestation?.socketNoBroadcastVerified)
          throw new EasyPlotsError('SOCKET_UNVERIFIED','Live authenticated sender, targeted recipient, and forged-payload tests required before enabling intents');
        return integration.startTransport();
      },
      stopVerifiedPlayerIntents(){gmOnly();if(integration)integration.stopTransport();},
      startVerifiedNotificationDelivery(){gmOnly();if(!integration)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Protected notification storage required');
        if(!nativeAttestation?.socketSenderVerified||!nativeAttestation?.socketRecipientVerified||!nativeAttestation?.socketForgeryRejected||!nativeAttestation?.socketNoBroadcastVerified)
         throw new EasyPlotsError('SOCKET_UNVERIFIED','Verified authenticated targeted sockets required');
        return integration.startNotificationTransport();
      },
      stopVerifiedNotificationDelivery(){gmOnly();return integration?.stopNotificationTransport()??{started:false};},
      startPlayerNarrativeNotifications(){
        if(game.user?.isGM)throw new EasyPlotsError('PLAYER_ONLY','Only players can register an audience-safe notice receiver');
        if(!playerNotificationTransport){playerNotificationTransport=new NativeFoundryNotificationTransport({gameInstance:game,
          onReceive:async item=>{playerNoticeInbox.receive(item);if(playerWorkspace?.rendered)await playerWorkspace.render();return true;}});}
        playerNotificationTransport.start();return {started:true};
      },
      stopPlayerNarrativeNotifications(){playerNotificationTransport?.stop();return {started:false};},
      startVerifiedContinuityRequests(){gmOnly();if(!integration)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Protected native repository required');
        if(!nativeAttestation?.socketSenderVerified||!nativeAttestation?.socketRecipientVerified||!nativeAttestation?.socketForgeryRejected||!nativeAttestation?.socketNoBroadcastVerified)
         throw new EasyPlotsError('SOCKET_UNVERIFIED','Authenticated targeted native replies require verified socket attestation');
        return integration.startContinuityTransport();
      },
      startSpatialTransport(){gmOnly();if(!integration)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Protected spatial atlas storage required');return integration.startSpatialTransport();},
      stopSpatialTransport(){gmOnly();return integration?.stopSpatialTransport()??{started:false};},
      startPlayerSpatialTransport({attestation}={}){if(game.user?.isGM)throw new EasyPlotsError('PLAYER_ONLY','Player atlas transport requires an audience context');if(playerSpatialTransport?.started)return {started:true};const client=new NativeFoundrySpatialTransport({gameInstance:game,attestation});client.start();playerSpatialTransport=client;return {started:true};},
      stopPlayerSpatialTransport(){playerSpatialTransport?.stop();return {started:false};},
      startVerifiedBoardRequests(){gmOnly();if(!integration)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Protected native repository required');
        if(!nativeAttestation?.socketSenderVerified||!nativeAttestation?.socketRecipientVerified||!nativeAttestation?.socketForgeryRejected||!nativeAttestation?.socketNoBroadcastVerified)
          throw new EasyPlotsError('SOCKET_UNVERIFIED','Native authenticated targeted reply checks required');
        return integration.startBoardTransport();
      },
      /** Explicitly enabled for real native Hook events. Never executes effects. */
      startVerifiedReactiveHooks(){
        gmOnly();
        if(!integration)throw new EasyPlotsError('STORAGE_NOT_VERIFIED','Verified native repository required');
        if(!nativeAttestation?.nativeHooksVerified || !nativeAttestation?.gmHookOriginVerified)
          throw new EasyPlotsError('HOOKS_UNVERIFIED','Live local-GM Hook origin tests required for the exact Foundry build');
        return integration.startReactiveHooks({onError:({code,eventId})=>{
          console.warn('[Easy Plots] GM-only event review required:',code,eventId??'');
        }});
      },
      stopVerifiedReactiveHooks(){gmOnly();return integration?.stopReactiveHooks()??{running:false};},
      safetyGates:gates
    });
    const pkg=game.modules.get(ID);if(pkg)pkg.api=api;
    if(game.user?.isGM&&typeof game.settings?.get==='function'){
      worldSetup=new FoundryWorldSetup({gameInstance:game,hooks:Hooks,connectNative:({pack,attestation,coreBuild})=>api.configureVerifiedNative({packId:pack.collection,vaultPack:pack,attestation,coreBuild,checkOpportunity:async()=>false})});
      void worldSetup.restore();
    }
    // A player only receives server-targeted, designated-GM-authenticated safe
    // projections. No player-side privileged repository or GM state is loaded.
    if(!game.user?.isGM&&pkg?.socket===true){
      try{api.startPlayerNarrativeNotifications();}
      catch(error){console.warn('[Easy Plots] Player notification receiver unavailable:',error?.code??'SOCKET_UNAVAILABLE');}
    }
    if(gates.isLocalGM())console.info(`[Easy Plots] v${VERSION} GM sandbox editor available: game.modules.get('${ID}').api.openEditor(); Native writes and player sockets are disabled by default.`);
  });
}
