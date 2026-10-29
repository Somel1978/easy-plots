"""Headless Chromium DOM smoke; local assets, no external network or Foundry world."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
def local_asset(route):
    url=urlparse(route.request.url)
    path=(ROOT/unquote(url.path).lstrip('/')).resolve()
    if url.hostname!='easy-plots.test' or not path.is_relative_to(ROOT):
        route.abort()
        return
    if not path.is_file():
        route.fulfill(status=404,body='Not found')
        return
    mime={'.mjs':'text/javascript','.css':'text/css','.html':'text/html'}.get(path.suffix,'application/octet-stream')
    route.fulfill(status=200,content_type=mime,body=path.read_bytes())

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1120,'height':840})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    # All requests are fulfilled locally. This secure origin exercises actual
    # WebCrypto without contacting a host, TLS peer or server.
    page.route('**/*',local_asset)
    page.goto('https://easy-plots.test/tests/browser/editor-harness.html',wait_until='load')
    page.wait_for_function('window.__ready === true', timeout=15000)
    assert page.evaluate('isSecureContext && typeof crypto.subtle.encrypt === "function"')
    page.locator('button[data-action="new"]').click()
    assert page.locator('.ep-graph-canvas').count()==1
    assert page.locator('select[data-field="node-type"] option').count()==page.evaluate('window.__easyPlotsTest.model.availableNodeTypes().length'), 'All integrated built-in node contracts must be authorable'
    size_before=page.locator('.ep-graph-canvas').evaluate('(el) => el.getBoundingClientRect().width')
    page.locator('button[data-action="zoom-in"]').click()
    size_after=page.locator('.ep-graph-canvas').evaluate('(el) => el.getBoundingClientRect().width')
    assert size_after>size_before,'Editor zoom must enlarge the scrollable graph canvas'
    page.locator('button[data-action="zoom-out"]').click()
    assert page.locator('.ep-svg-node').count()==1
    page.locator('select[data-field="root-trigger"]').select_option('core.trigger.manual')
    page.locator('button[data-action="change-root-trigger"]').click()
    assert page.evaluate('window.__easyPlotsTest.model.graph.nodes[0].typeId')=='core.trigger.manual'
    page.locator('select[data-field="root-trigger"]').select_option('core.trigger.event')
    page.locator('button[data-action="change-root-trigger"]').click()
    page.locator('select[data-field="node-type"]').select_option('core.condition')
    page.locator('button[data-action="add-node"]').click()
    page.locator('select[data-field="node-type"]').select_option('core.effect.proposal')
    page.locator('button[data-action="add-node"]').click()
    assert page.locator('.ep-svg-node').count()==3
    ids=page.evaluate('window.__easyPlotsTest.model.graph.nodes.map(n=>n.id)')
    page.locator('select[data-field="edge-output"]').select_option(ids[0]+'|out')
    page.locator('select[data-field="edge-target"]').select_option(ids[1])
    page.locator('button[data-action="connect"]').click()
    page.locator('select[data-field="edge-output"]').select_option(ids[1]+'|out')
    page.locator('select[data-field="edge-target"]').select_option(ids[2])
    page.locator('button[data-action="connect"]').click()
    assert page.locator('.ep-graph-canvas path[stroke="#60a5fa"]').count()==2
    page.locator('button[data-action="preview"]').click()
    assert page.locator('.ep-validation').count()==1
    page.locator('button[data-action="save"]').click()
    page.locator('button[data-action="publish"]').click()
    assert page.locator('.ep-notice').count()>=1
    page.locator('button[data-action="activate"]').click()
    activated=page.evaluate('window.__easyPlotsTest.model.activation()')
    assert activated['active'] is True
    subscriptions=page.evaluate('window.__easyPlotsTest.catalog.lookup("evidence.discovered")')
    assert len(subscriptions)==1 and subscriptions[0]['publishedVersion']==1
    page.locator('input[data-field="title"]').fill('<img src=x onerror=alert(1)>')
    page.locator('button[data-action="rename"]').click()
    assert page.locator('img').count()==0,'Untrusted graph title must not become HTML'
    page.locator('button[data-action="save"]').click()
    page.evaluate("""async () => {
      const {RenderStub,makeApprovalWindow}=window.__easyPlotsTest;
      const queue={
        row:{state:'pending',verifiedUserId:'player_123',intent:{actorId:'actor_xyz',opportunityId:'opp_123',approach:'Read book'}},
        async get(key){return key==='player_123:req_456'?this.row:null;},
        async transition(key,from,to,options){
          if(key!=='player_123:req_456'||from!=='pending'||options.gmUserId!=='gm_123')throw Error('Unauthorized');
          this.row={...this.row,state:to};return this.row;
        }
      };
      const Window=makeApprovalWindow(RenderStub,{queue,gameInstance:{user:{id:'gm_123',isGM:true}}});
      window.__approval=new Window();await window.__approval.render();
    }""")
    page.locator('input[data-field="intent-key"]').fill('player_123:req_456')
    page.locator('button[data-action="find"]').click()
    page.locator('button[data-action="approve"]').click()
    assert 'approved' in page.locator('.ep-approvals').inner_text()
    page.evaluate("""async () => {
      const {RenderStub,makeEventReviewWindow}=window.__easyPlotsTest;
      const ledger={get:async id=> id==='ep:event:review_001'?{
        id:'ep:ledger:test',sourceEventId:id,state:'review-required',
        event:{eventType:'foundry.actor.updated',source:{hook:'updateActor'}},
        evaluations:[{graphId:'ep:graph:test'}],proposals:[{providerId:'narrative.set-state',operationId:'ep:operation:review_001'}]
      }:null};
      const reviews={
        row:null,
        async get(){return this.row;},
        async decide(eventId,operationId,{approve}){this.row={state:approve?'approved':'rejected'};return this.row;},
        async execute(){this.row={state:'completed'};return {status:'completed'};}
      };
      const Window=makeEventReviewWindow(RenderStub,{ledger,reviews,runtimeStatus:()=>({running:false,inflight:0,recentEventIds:['ep:event:review_001']}),gameInstance:{user:{isGM:true}}});
      window.__review=new Window();await window.__review.render();
    }""")
    page.locator('input[data-field="event-id"]').fill('ep:event:review_001')
    page.locator('button[data-action="find"]').click()
    assert 'Proposed effects: 1' in page.locator('.ep-approvals').inner_text()
    page.locator('button[data-action="approve-effect"]').click()
    page.locator('button[data-action="execute-effect"]').click()
    assert 'completed' in page.locator('.ep-approvals').inner_text()
    # New GM-only planning UI; preview is deterministic and writes nothing.
    page.evaluate("""async () => {
      const {RenderStub,makeGMPlanningLabWindow}=window.__easyPlotsTest;
      const Window=makeGMPlanningLabWindow(RenderStub,{gameInstance:{user:{isGM:true}}});
      await new Window().render();
    }""")
    assert page.locator('.ep-planning-lab').count()==1
    page.locator('button[data-action="run"]').click()
    page.wait_for_selector('.ep-lab-output')
    assert 'hypotheticalFacts' in page.locator('.ep-lab-output').inner_text()
    page.locator('select[data-field="mode"]').select_option('knowledge')
    page.locator('button[data-action="run"]').click()
    page.wait_for_function("document.querySelector('.ep-lab-output')?.textContent?.includes('proposals')")
    assert 'sourceEventId' in page.locator('.ep-lab-output').inner_text()
    page.locator('select[data-field="mode"]').select_option('vote')
    page.locator('button[data-action="run"]').click()
    page.wait_for_function("document.querySelector('.ep-lab-output')?.textContent?.includes('quorumMet')")
    page.locator('select[data-field="mode"]').select_option('npc-turn')
    page.locator('button[data-action="run"]').click()
    page.wait_for_function("document.querySelector('.ep-lab-output')?.textContent?.includes('proposals')")
    page.locator('select[data-field="mode"]').select_option('viability')
    page.locator('button[data-action="run"]').click()
    page.wait_for_function("document.querySelector('.ep-lab-output')?.textContent?.includes('results')")
    page.locator('select[data-field="mode"]').select_option('continuity')
    page.locator('button[data-action="run"]').click()
    page.wait_for_function("document.querySelector('.ep-lab-output')?.textContent?.includes('dormantHooks')")
    # Native-compatible GM-only planning records: save and acknowledge are
    # distinct from authoring and never execute narrative effects.
    page.evaluate("""async () => {
      const {RenderStub,makeGMPlanningLabWindow}=window.__easyPlotsTest;
      const store={row:null,async create({id,mode,scenario,sourceEventId}){
        this.row={id,revision:1,data:{mode,scenario,sourceEventId,state:'draft-preview'}};return this.row;
      },async acknowledge({id,expectedRevision,approvalEventId}){
        if(!this.row||this.row.id!==id||expectedRevision!==this.row.revision)throw Error('Stale plan');
        this.row={...this.row,revision:2,data:{...this.row.data,state:'acknowledged-for-manual-followup',approvalEventId}};
        return this.row;
      }};
      window.__gmPlanStore=store;
      const Window=makeGMPlanningLabWindow(RenderStub,{gameInstance:{user:{isGM:true}},planStoreProvider:()=>store});
      await new Window().render();
    }""")
    page.locator('button[data-action="save-plan"]').click()
    page.wait_for_function("document.querySelector('.ep-planning-lab')?.textContent?.includes('GM-only plan saved')")
    page.locator('button[data-action="acknowledge-plan"]').click()
    page.wait_for_function("document.querySelector('.ep-planning-lab')?.textContent?.includes('Review acknowledgement recorded')")
    assert page.evaluate("window.__gmPlanStore.row.data.state")=='acknowledged-for-manual-followup'
    page.evaluate("""async () => {
      const {RenderStub,makeInvestigationBoardWindow}=window.__easyPlotsTest;
      const board={kind:'easy-plots-player-board',version:1,investigationId:'ep:investigation:shipment_001',
        title:'Shipping clues',evidence:[{id:'ep:evidence:manifest_001',title:'<img src=x onerror=alert(1)>',description:'A manifest'}],
        theories:[],actions:[]};
      const Window=makeInvestigationBoardWindow(RenderStub,{projectionProvider:async()=>board});
      await new Window().render();
    }""")
    assert page.locator('.ep-investigation-board').count()==1
    assert page.locator('.ep-investigation-board img').count()==0
    page.evaluate("""async () => {
      const {RenderStub,makeGMCockpitWindow}=window.__easyPlotsTest;
      const Window=makeGMCockpitWindow(RenderStub,{gameInstance:{user:{isGM:true}},
        getSnapshot:async id=>({title:'GM Focus',draftRevision:2,active:false,nodeCount:3,events:[],requiresReview:0})});
      await new Window().render();
    }""")
    page.locator('[data-field="graph-id"]').fill('ep:graph:focused_001')
    page.locator('button[data-action="load"]').click()
    page.wait_for_function("document.querySelector('.ep-gm-cockpit')?.textContent?.includes('GM Focus')")
    page.evaluate("""async () => {
      const {RenderStub,makeGMCockpitWindow}=window.__easyPlotsTest;
      window.__liveFocusReads=[];window.__liveFocusStopped=false;
      const Window=makeGMCockpitWindow(RenderStub,{gameInstance:{user:{isGM:true}},
        watchGraph:(graphId,callback)=>{window.__liveFocusGraph=graphId;window.__liveFocusChange=callback;return ()=>{window.__liveFocusStopped=true;};},
        getSnapshot:async(graphId,ids)=>{window.__liveFocusReads.push({graphId,ids});return {title:'Live focus',draftRevision:1,active:true,publishedVersion:1,nodeCount:3,
          events:ids.map(id=>({id,eventType:'evidence.discovered',state:'review-required',proposalCount:1})),requiresReview:ids.length};}});
      window.__liveFocusApp=new Window();await window.__liveFocusApp.render();
    }""")
    page.locator('.ep-gm-cockpit [data-field="graph-id"]').fill('ep:graph:live_focus001')
    page.locator('.ep-gm-cockpit button[data-action="load"]').click()
    page.wait_for_function("window.__liveFocusGraph==='ep:graph:live_focus001'")
    page.evaluate("window.__liveFocusChange({graphId:'ep:graph:live_focus001',eventId:'ep:event:live_focus001',state:'review-required'})")
    page.wait_for_function("document.querySelector('.ep-gm-cockpit')?.textContent?.includes('ep:event:live_focus001')")
    assert page.evaluate("window.__liveFocusReads.every(r=>r.graphId==='ep:graph:live_focus001')")
    page.evaluate("window.__liveFocusApp.close()")
    assert page.evaluate('window.__liveFocusStopped')
    # A GM must save a canonical-verified quest draft and explicitly approve it.
    page.evaluate("""async () => {
      const {RenderStub,makeGMQuestPublicationWindow}=window.__easyPlotsTest;
      const service={row:null,async read(){return this.row;},async prepare(spec){
        this.row={id:spec.manifest.id,revision:1,data:{...spec.manifest,state:'draft'}};return this.row;
      },async approve({expectedRevision}){if(this.row.revision!==expectedRevision)throw Error('stale quest');
        this.row={...this.row,revision:2,data:{...this.row.data,state:'approved'}};return this.row;
      },async project(){return {id:'ep:quest-public:safe001',title:'<img src=x onerror=alert(1)>',objectives:[{id:'ep:objective-public:safe001',text:'Safe passage',status:'active'}]};}};
      window.__questPublication=service;
      const Window=makeGMQuestPublicationWindow(RenderStub,{gameInstance:{user:{isGM:true}},service});
      await new Window().render();
    }""")
    page.locator('.ep-quest-publication button[data-action="prepare"]').click()
    page.wait_for_function("document.querySelector('.ep-quest-publication')?.textContent?.includes('Protected publication saved or loaded')")
    page.locator('.ep-quest-publication input[data-field="reviewed"]').check()
    page.locator('.ep-quest-publication button[data-action="approve"]').click()
    page.wait_for_function("document.querySelector('.ep-quest-publication')?.textContent?.includes('Approved. Recipient-safe projection available')")
    page.locator('.ep-quest-publication input[data-field="observer"]').fill('ep:actor:hero001')
    page.locator('.ep-quest-publication button[data-action="preview"]').click()
    page.wait_for_selector('.ep-projection-output')
    assert page.locator('.ep-quest-publication img').count()==0
    assert page.evaluate('window.__questPublication.row.data.state')=='approved'
    # Player presentation only receives a previously allowlisted projection.
    page.evaluate("""async () => {
      const {RenderStub,makePlayerContinuityWindow}=window.__easyPlotsTest;
      const Window=makePlayerContinuityWindow(RenderStub,{kind:'quest-board',projection:{id:'ep:quest-public:safe001',
        title:'<img src=x onerror=alert(1)>',objectives:[{id:'ep:objective-public:safe001',text:'Safe passage',status:'active'}]}});
      await new Window().render();
    }""")
    assert page.locator('.ep-player-continuity').count()==1
    assert page.locator('.ep-player-continuity img').count()==0
    # The player portal uses only explicitly requested audience projections.
    page.evaluate("""async () => {
      const {RenderStub,makePlayerNarrativePortalWindow}=window.__easyPlotsTest;
      window.__portalRequests=[];
      const Window=makePlayerNarrativePortalWindow(RenderStub,{gameInstance:{user:{isGM:false},actors:{contents:[{id:'nativeActor001',isOwner:true,name:'Player Character'}]}},
       requestProjection:async request=>{window.__portalRequests.push(request);
        return {id:'ep:quest-public:harbor001',title:'<img src=x onerror=alert(1)>',objectives:[{id:'ep:objective-public:harbor001',status:'active',text:'Meet the harbor pilot'}]};}});
      await new Window().render();
    }""")
    page.locator('.ep-player-portal input[data-field="record"]').fill('ep:quest-publication:harbor001')
    page.locator('.ep-player-portal button[data-action="load"]').click()
    page.wait_for_function("document.querySelector('.ep-player-portal')?.textContent?.includes('Meet the harbor pilot')")
    assert page.locator('.ep-player-portal img').count()==0
    assert page.evaluate('window.__portalRequests[0].actorId')=='nativeActor001'
    assert page.evaluate('window.__portalRequests[0].kind')=='quest-board'
    # GM manual ingress previews before submission; no effect can run from UI.
    page.evaluate("""async () => {
      const {RenderStub,makeGMManualEventWindow}=window.__easyPlotsTest;
      window.__manualEvents=[];
      const Window=makeGMManualEventWindow(RenderStub,{gameInstance:{user:{isGM:true}},
        submitManual:async spec=>{window.__manualEvents.push(spec);return {eventId:'ep:event:manual_test001',status:'review-required'};}});
      await new Window().render();
    }""")
    assert page.locator('.ep-manual-event button[data-action="submit"]').is_disabled()
    page.locator('.ep-manual-event button[data-action="preview"]').click()
    page.wait_for_function("document.querySelector('.ep-manual-event')?.textContent?.includes('Exact manual event preview prepared')")
    assert page.locator('.ep-manual-event button[data-action="submit"]').is_disabled()
    page.locator('.ep-manual-event input[data-field="acknowledged"]').check()
    page.locator('.ep-manual-event button[data-action="submit"]').click()
    page.wait_for_function("document.querySelector('.ep-manual-event')?.textContent?.includes('Consequences remain pending separate GM review')")
    assert page.evaluate('window.__manualEvents.length')==1
    assert page.evaluate('window.__manualEvents[0].eventType')=='narrative.manual'
    # Typed values can be bound through the GM editor, not only the model API.
    page.evaluate("""async () => {
      const {model,editor}=window.__easyPlotsTest;
      model.discardUnsaved();model.newGraph('Typed data authoring');await editor.render();
    }""")
    page.locator('select[data-field="node-type"]').select_option('core.data.literal')
    page.locator('button[data-action="add-node"]').click()
    page.locator('textarea[data-field="payload-json"]').fill('{"valueType":"number","value":42}')
    page.locator('button[data-action="update-node"]').click()
    page.locator('select[data-field="node-type"]').select_option('core.effect.proposal')
    page.locator('button[data-action="add-node"]').click()
    page.locator('select[data-field="binding-field"]').select_option('value')
    page.locator('button[data-action="bind-data"]').click()
    page.wait_for_function("window.__easyPlotsTest.model.graph.edges.some(e => e.kind === 'data')")
    assert page.locator('.ep-error').count()==0
    assert page.evaluate("window.__easyPlotsTest.model.selectedNode.ports.find(p=>p.id==='data-value').valueType")=='number'
    page.locator('button[data-action="unbind-data"]').click()
    page.wait_for_function("!window.__easyPlotsTest.model.graph.edges.some(e => e.kind === 'data')")
    first_value=page.evaluate("window.__easyPlotsTest.model.graph.nodes.find(n=>n.typeId==='core.data.literal').id")
    effect_id=page.evaluate("window.__easyPlotsTest.model.selectedNode.id")
    page.locator('select[data-field="node-type"]').select_option('core.data.literal')
    page.locator('button[data-action="add-node"]').click()
    second_value=page.evaluate("window.__easyPlotsTest.model.selectedNode.id")
    page.locator('textarea[data-field="payload-json"]').fill('{"valueType":"number","value":8}')
    page.locator('button[data-action="update-node"]').click()
    page.locator('select[data-field="node-type"]').select_option('core.data.compare')
    page.locator('button[data-action="add-node"]').click()
    compare_id=page.evaluate("window.__easyPlotsTest.model.selectedNode.id")
    page.locator('select[data-field="node-type"]').select_option('core.branch.data')
    page.locator('button[data-action="add-node"]').click()
    branch_id=page.evaluate("window.__easyPlotsTest.model.selectedNode.id")
    root_id=page.evaluate("window.__easyPlotsTest.model.graph.rootNodeId")
    for source,output,target,input_port in [(first_value,'value',compare_id,'left'),(second_value,'value',compare_id,'right'),
      (compare_id,'value',branch_id,'predicate'),(root_id,'out',branch_id,'in'),(branch_id,'true',effect_id,'in')]:
        page.locator('select[data-field="edge-output"]').select_option(source+'|'+output)
        page.locator('select[data-field="edge-input"]').select_option(target+'|'+input_port)
        page.locator('button[data-action="connect"]').click()
        assert page.locator('.ep-error').count()==0
    page.locator('button[data-action="preview"]').click()
    assert 'passed' in page.locator('.ep-validation').inner_text()
    page.locator('button[data-action="save"]').click()
    page.locator('button[data-action="publish"]').click()
    assert page.locator('.ep-error').count()==0
    original_graph=page.evaluate('JSON.stringify(window.__easyPlotsTest.model.graph)')
    page.locator('select[data-field="view-layer"]').select_option('narrative')
    page.locator('button[data-action="set-view-layer"]').click()
    assert page.locator('.ep-svg-node').count()==1
    assert page.evaluate('JSON.stringify(window.__easyPlotsTest.model.graph)')==original_graph
    page.locator('select[data-field="view-layer"]').select_option('all')
    page.locator('button[data-action="set-view-layer"]').click()
    page.locator('select[data-field="view-density"]').select_option('expanded')
    page.locator('button[data-action="set-view-density"]').click()
    assert page.locator('.ep-svg-node rect').first.get_attribute('height')=='96'
    page.locator('button[data-action="toggle-node-density"]').click()
    assert page.locator('.ep-svg-node rect[height="60"]').count()==1
    page.locator('button[data-action="toggle-node-density"]').click()
    assert page.locator('.ep-svg-node rect[height="60"]').count()==0
    page.locator('select[data-field="view-density"]').select_option('compact')
    page.locator('button[data-action="set-view-density"]').click()
    assert page.locator('.ep-svg-node rect').first.get_attribute('height')=='40'
    assert page.evaluate('JSON.stringify(window.__easyPlotsTest.model.graph)')==original_graph
    assert not page.evaluate('window.__easyPlotsTest.model.state.dirty')
    page.evaluate("""async () => {
      window.__oldLanguageGame=globalThis.game;
      globalThis.game={i18n:{localize:key=>key==='EasyPlots.Graph.Actions.save'?'Guardar rascunho':key}};
      await window.__easyPlotsTest.editor.render();
    }""")
    assert page.locator('button[data-action="save"]').inner_text()=='Guardar rascunho'
    page.evaluate("if(window.__oldLanguageGame===undefined)delete globalThis.game;else globalThis.game=window.__oldLanguageGame")
    assert not errors,errors
    # GM resource inspection must be read-only and must escape untrusted labels.
    page.evaluate("""async () => {
      const {RenderStub,makeNativeResourceInspectorWindow}=window.__easyPlotsTest;
      const Window=makeNativeResourceInspectorWindow(RenderStub,{
        gameInstance:{user:{isGM:true}},
        readBinding:async ({resourceId})=>({resourceId,status:'bound',
          nativeId:'abcdefghijklmnop',documentKind:'Actor',ownership:'borrowed',
          revision:1,lastOperationId:'ep:operation:approved_001'}),
        auditReferences:async () =>({items:[{dependentId:'<img src=x onerror=alert(1)>',
          resourceId:'ep:resource:existing_001',status:'active',assessment:'current'}],
          unresolved:[],nextCursor:null})
      });
      window.__resource=new Window();await window.__resource.render();
    }""")
    page.locator('input[data-field="resource-id"]').fill('ep:resource:existing_001')
    page.locator('button[data-action="read"]').click()
    page.wait_for_function("document.querySelector('.ep-resource-inspector')?.textContent?.includes('Binding record loaded')")
    page.locator('input[data-field="native-uuid"]').fill('Actor.abcdefghijklmnop')
    page.locator('button[data-action="audit"]').click()
    page.wait_for_function("document.querySelector('.ep-resource-inspector')?.textContent?.includes('Read-only audit completed')")
    assert page.locator('img').count()==0, 'Untrusted native resource labels must not execute HTML'
    # New GM continuity interface, including explicit review before an arc is
    # finalized; the mocked service never mutates a Foundry document.
    page.evaluate("""async () => {
      const {RenderStub,makeGMContinuityDeskWindow}=window.__easyPlotsTest;
      const arcResolutions={last:null,
        async plan(){return {arcId:'ep:arc:waterdeep001',arcRevision:2,
          eligible:[{endingId:'ep:ending:partial001'}],unknown:[],conflicts:[]};},
        async finalize(input){this.last=input;return {state:'committed',effectsExecuted:0,epiloguePublished:false};}
      };
      window.__arcResolutionStub=arcResolutions;
      const Window=makeGMContinuityDeskWindow(RenderStub,{gameInstance:{user:{isGM:true}},
        arcResolutions,
        blueprints:{planAdoption:async()=>({instanceRevision:1,conflicts:[]}),adopt:async()=>({committed:true})},
        knowledgeLedger:{projection:async()=>({observerId:'ep:actor:hero001',claims:[]})}});
      await new Window().render();
    }""")
    assert page.locator('.ep-continuity-desk').count()==1
    assert page.locator('button[data-action="commit"]').count()==0
    page.locator('button[data-action="preview"]').click()
    page.wait_for_function("document.querySelector('.ep-continuity-desk button[data-action=commit]') !== null")
    assert page.locator('button[data-action="commit"]').is_disabled()
    page.locator('input[data-field="confirmed"]').check()
    page.locator('button[data-action="commit"]').click()
    page.wait_for_function("document.querySelector('.ep-continuity-desk')?.textContent?.includes('Reviewed transition saved')")
    assert page.evaluate('window.__arcResolutionStub.last.endingId')=='ep:ending:partial001'
    assert page.evaluate('window.__arcResolutionStub.last.expectedArcRevision')==2
    # A GM must save a canonical-verified quest draft and explicitly approve it.
    page.evaluate("""async () => {
      const {RenderStub,makeGMQuestPublicationWindow}=window.__easyPlotsTest;
      const service={row:null,async read(){return this.row;},async prepare(spec){
        this.row={id:spec.manifest.id,revision:1,data:{...spec.manifest,state:'draft'}};return this.row;
      },async approve({expectedRevision}){if(this.row.revision!==expectedRevision)throw Error('stale quest');
        this.row={...this.row,revision:2,data:{...this.row.data,state:'approved'}};return this.row;
      },async project(){return {id:'ep:quest-public:safe001',title:'<img src=x onerror=alert(1)>',objectives:[{id:'ep:objective-public:safe001',text:'Safe passage',status:'active'}]};}};
      window.__questPublication=service;
      const Window=makeGMQuestPublicationWindow(RenderStub,{gameInstance:{user:{isGM:true}},service});
      await new Window().render();
    }""")
    page.locator('.ep-quest-publication button[data-action="prepare"]').click()
    page.wait_for_function("document.querySelector('.ep-quest-publication')?.textContent?.includes('Protected publication saved or loaded')")
    page.locator('.ep-quest-publication input[data-field="reviewed"]').check()
    page.locator('.ep-quest-publication button[data-action="approve"]').click()
    page.wait_for_function("document.querySelector('.ep-quest-publication')?.textContent?.includes('Approved. Recipient-safe projection available')")
    page.locator('.ep-quest-publication input[data-field="observer"]').fill('ep:actor:hero001')
    page.locator('.ep-quest-publication button[data-action="preview"]').click()
    page.wait_for_selector('.ep-projection-output')
    assert page.locator('.ep-quest-publication img').count()==0
    assert page.evaluate('window.__questPublication.row.data.state')=='approved'
    # Player presentation only receives a previously allowlisted projection.
    page.evaluate("""async () => {
      const {RenderStub,makePlayerContinuityWindow}=window.__easyPlotsTest;
      const Window=makePlayerContinuityWindow(RenderStub,{kind:'quest-board',projection:{id:'ep:quest-public:safe001',
        title:'<img src=x onerror=alert(1)>',objectives:[{id:'ep:objective-public:safe001',text:'Safe passage',status:'active'}]}});
      await new Window().render();
    }""")
    assert page.locator('.ep-player-continuity').count()==1
    assert page.locator('.ep-player-continuity img').count()==0
    # The player portal uses only explicitly requested audience projections.
    page.evaluate("""async () => {
      const {RenderStub,makePlayerNarrativePortalWindow}=window.__easyPlotsTest;
      window.__portalRequests=[];
      const Window=makePlayerNarrativePortalWindow(RenderStub,{gameInstance:{user:{isGM:false},actors:{contents:[{id:'nativeActor001',isOwner:true,name:'Player Character'}]}},
       requestProjection:async request=>{window.__portalRequests.push(request);
        return {id:'ep:quest-public:harbor001',title:'<img src=x onerror=alert(1)>',objectives:[{id:'ep:objective-public:harbor001',status:'active',text:'Meet the harbor pilot'}]};}});
      await new Window().render();
    }""")
    page.locator('.ep-player-portal input[data-field="record"]').fill('ep:quest-publication:harbor001')
    page.locator('.ep-player-portal button[data-action="load"]').click()
    page.wait_for_function("document.querySelector('.ep-player-portal')?.textContent?.includes('Meet the harbor pilot')")
    assert page.locator('.ep-player-portal img').count()==0
    assert page.evaluate('window.__portalRequests[0].actorId')=='nativeActor001'
    assert page.evaluate('window.__portalRequests[0].kind')=='quest-board'
    # GM manual ingress previews before submission; no effect can run from UI.
    page.evaluate("""async () => {
      const {RenderStub,makeGMManualEventWindow}=window.__easyPlotsTest;
      window.__manualEvents=[];
      const Window=makeGMManualEventWindow(RenderStub,{gameInstance:{user:{isGM:true}},
        submitManual:async spec=>{window.__manualEvents.push(spec);return {eventId:'ep:event:manual_test001',status:'review-required'};}});
      await new Window().render();
    }""")
    assert page.locator('.ep-manual-event button[data-action="submit"]').is_disabled()
    page.locator('.ep-manual-event button[data-action="preview"]').click()
    page.wait_for_function("document.querySelector('.ep-manual-event')?.textContent?.includes('Exact manual event preview prepared')")
    assert page.locator('.ep-manual-event button[data-action="submit"]').is_disabled()
    page.locator('.ep-manual-event input[data-field="acknowledged"]').check()
    page.locator('.ep-manual-event button[data-action="submit"]').click()
    page.wait_for_function("document.querySelector('.ep-manual-event')?.textContent?.includes('Consequences remain pending separate GM review')")
    assert page.evaluate('window.__manualEvents.length')==1
    assert page.evaluate('window.__manualEvents[0].eventType')=='narrative.manual'
    assert not errors,errors
    # Protected society/knowledge desk only authors GM config and previews.
    page.evaluate("""async () => {
      const {RenderStub,makeGMKnowledgeFactionDeskWindow}=window.__easyPlotsTest;
      const calls=[];
      const Window=makeGMKnowledgeFactionDeskWindow(RenderStub,{
        gameInstance:{user:{isGM:true}},
        knowledgePropagation:{
          async plan(spec){calls.push({kind:'plan',spec});return {id:spec.planId,revision:1,status:'pending-gm-review'};},
          async readPlan(spec){return {id:spec.planId,revision:1,status:'pending-gm-review'};}
        },
        factionAgendas:{
          async publish(spec){calls.push({kind:'publish',spec});return {id:spec.agendaId,revision:1,status:'published'};},
          async assess(spec){return {agendaId:spec.agendaId,proposals:[],effectsExecuted:0};}
        },
        forecasts:{
          async preview(spec){return {forecastId:spec.forecastId,predictions:[{summary:'<img src=x onerror=alert(1)>'}],state:'hypothesis',effectsExecuted:0};},
          async create(spec){calls.push({kind:'forecast',spec});return {id:spec.forecastId,state:'hypothesis',effectsExecuted:0};},
          async inspect(spec){return {forecastId:spec.forecastId,status:'stale',predictions:[],effectsExecuted:0};}
        }
      });
      window.__societyStub={calls};await new Window().render();
    }""")
    assert page.locator('.ep-society-desk').count()==1
    assert page.locator('button[data-action="commit"]').count()==0
    page.locator('button[data-action="preview"]').click()
    page.wait_for_function("document.querySelector('.ep-society-desk button[data-action=commit]') !== null")
    assert page.locator('button[data-action="commit"]').is_disabled()
    page.locator('input[data-field="confirm"]').check()
    page.locator('button[data-action="commit"]').click()
    page.wait_for_function("document.querySelector('.ep-society-desk')?.textContent?.includes('GM-only record saved')")
    assert page.evaluate('window.__societyStub.calls.length')==1
    page.locator('select[data-field="mode"]').select_option('agenda-assess')
    page.locator('button[data-action="preview"]').click()
    page.wait_for_function("document.querySelector('.ep-society-desk')?.textContent?.includes('effectsExecuted')")
    assert page.locator('.ep-society-desk button[data-action="commit"]').count()==0
    page.locator('select[data-field="mode"]').select_option('forecast-create')
    page.locator('button[data-action="preview"]').click()
    page.wait_for_function("document.querySelector('.ep-society-desk')?.textContent?.includes('hypothesis')")
    assert page.locator('.ep-society-desk img').count()==0
    assert page.locator('button[data-action="commit"]').is_disabled()
    page.locator('input[data-field="confirm"]').check()
    page.locator('button[data-action="commit"]').click()
    page.wait_for_function("window.__societyStub.calls.some(x=>x.kind==='forecast')")
    page.locator('select[data-field="mode"]').select_option('forecast-inspect')
    page.locator('button[data-action="preview"]').click()
    page.wait_for_function("document.querySelector('.ep-society-desk')?.textContent?.includes('stale')")
    # Session handoff must separate GM draft and explicit approval.
    page.evaluate("""async () => {
      const {RenderStub,makeGMSessionHandoffWindow}=window.__easyPlotsTest;
      const service={row:null,async read(){return this.row;},async prepare(spec){
        this.row={id:spec.sessionId,revision:1,data:{state:'draft',sourceArcRevision:spec.sourceArcRevision,references:spec.references}};return this.row;
      },async approve(spec){if(!this.row||spec.expectedRevision!==this.row.revision)throw Error('stale handoff');
        this.row={...this.row,revision:2,data:{...this.row.data,state:'approved'}};return this.row;
      }};
      window.__handoffService=service;
      const Window=makeGMSessionHandoffWindow(RenderStub,{gameInstance:{user:{isGM:true}},service});
      await new Window().render();
    }""")
    page.locator('button[data-action="prepare"]').click()
    page.wait_for_function("document.querySelector('.ep-session-handoff')?.textContent?.includes('Handoff record loaded or saved')")
    page.locator('input[data-field="reviewed"]').check()
    page.locator('button[data-action="approve"]').click()
    page.wait_for_function("document.querySelector('.ep-session-handoff')?.textContent?.includes('Approved handoff recorded')")
    assert page.evaluate("window.__handoffService.row.data.state")=='approved'
    # GM search must escape untrusted titles, without loading arbitrary plots.
    page.evaluate("""async () => {
      const {RenderStub,makeGMNarrativeSearchWindow}=window.__easyPlotsTest;
      const service={async search(){return {results:[{id:'ep:npc:captain001',domain:'npc',title:'<img src=x onerror=alert(1)>'}],incomplete:false,hasMore:false};},async index(){},async indexVerifiedDomain({entityId}){if(entityId!=='ep:location:harbor001')throw Error('Wrong source ID');return {revision:5};}};
      const Window=makeGMNarrativeSearchWindow(RenderStub,{gameInstance:{user:{isGM:true}},service});
      await new Window().render();
    }""")
    page.locator('button[data-action="search"]').click()
    page.wait_for_function("document.querySelector('.ep-search-desk')?.textContent?.includes('Protected scoped index consulted')")
    assert page.locator('.ep-search-desk img').count()==0
    page.locator('.ep-search-desk input[data-field="entity"]').fill('ep:location:harbor001')
    page.locator('button[data-action="repair"]').click()
    page.wait_for_function("document.querySelector('.ep-search-desk')?.textContent?.includes('index revision 5')")
    # GM notification requires explicit review before its recipient-safe message
    # can be published; secret title is rendered as text, never HTML.
    page.evaluate("""async () => {
      const {RenderStub,makeGMNotificationWindow}=window.__easyPlotsTest;
      const service={row:{id:'ep:notice:harbor001',revision:1,data:{state:'pending-review',gmDetail:'<img src=x onerror=alert(1)>',safeText:'Harbor news'}},
        async listGM(){return {items:[{id:this.row.id,revision:this.row.revision,state:this.row.data.state,groupKey:'harbor-news',level:'info'}],nextCursor:null};},
        async read(){return this.row;},
        async approve({expectedRevision}){if(expectedRevision!==this.row.revision)throw Error('stale');
          this.row={...this.row,revision:2,data:{...this.row.data,state:'published'}};return this.row;}
      };
      window.__noticeService=service;
      const Window=makeGMNotificationWindow(RenderStub,{gameInstance:{user:{isGM:true}},service,deliverNotice:async()=>({status:'acknowledged'})});await new Window().render();
    }""")
    page.locator('button[data-action="list"]').click()
    page.wait_for_function("document.querySelector('.ep-notification-desk')?.textContent?.includes('harbor-news')")
    page.locator('input[data-field="notice-id"]').fill('ep:notice:harbor001')
    page.locator('button[data-action="read"]').click()
    page.wait_for_function("document.querySelector('.ep-notification-desk')?.textContent?.includes('GM-only notification loaded')")
    assert page.locator('.ep-notification-desk img').count()==0
    page.locator('input[data-field="reviewed"]').check()
    page.locator('button[data-action="approve"]').click()
    page.wait_for_function("document.querySelector('.ep-notification-desk')?.textContent?.includes('Recipient-safe notification approved')")
    assert page.evaluate('window.__noticeService.row.data.state')=='published'
    page.locator('button[data-action="deliver"]').click()
    page.wait_for_function("document.querySelector('.ep-notification-desk')?.textContent?.includes('Authenticated client receipt: acknowledged')")
    # A GM must save a canonical-verified quest draft and explicitly approve it.
    page.evaluate("""async () => {
      const {RenderStub,makeGMQuestPublicationWindow}=window.__easyPlotsTest;
      const service={row:null,async read(){return this.row;},async prepare(spec){
        this.row={id:spec.manifest.id,revision:1,data:{...spec.manifest,state:'draft'}};return this.row;
      },async approve({expectedRevision}){if(this.row.revision!==expectedRevision)throw Error('stale quest');
        this.row={...this.row,revision:2,data:{...this.row.data,state:'approved'}};return this.row;
      },async project(){return {id:'ep:quest-public:safe001',title:'<img src=x onerror=alert(1)>',objectives:[{id:'ep:objective-public:safe001',text:'Safe passage',status:'active'}]};}};
      window.__questPublication=service;
      const Window=makeGMQuestPublicationWindow(RenderStub,{gameInstance:{user:{isGM:true}},service});
      await new Window().render();
    }""")
    page.locator('.ep-quest-publication button[data-action="prepare"]').click()
    page.wait_for_function("document.querySelector('.ep-quest-publication')?.textContent?.includes('Protected publication saved or loaded')")
    page.locator('.ep-quest-publication input[data-field="reviewed"]').check()
    page.locator('.ep-quest-publication button[data-action="approve"]').click()
    page.wait_for_function("document.querySelector('.ep-quest-publication')?.textContent?.includes('Approved. Recipient-safe projection available')")
    page.locator('.ep-quest-publication input[data-field="observer"]').fill('ep:actor:hero001')
    page.locator('.ep-quest-publication button[data-action="preview"]').click()
    page.wait_for_selector('.ep-projection-output')
    assert page.locator('.ep-quest-publication img').count()==0
    assert page.evaluate('window.__questPublication.row.data.state')=='approved'
    # Player presentation only receives a previously allowlisted projection.
    page.evaluate("""async () => {
      const {RenderStub,makePlayerContinuityWindow}=window.__easyPlotsTest;
      const Window=makePlayerContinuityWindow(RenderStub,{kind:'quest-board',projection:{id:'ep:quest-public:safe001',
        title:'<img src=x onerror=alert(1)>',objectives:[{id:'ep:objective-public:safe001',text:'Safe passage',status:'active'}]}});
      await new Window().render();
    }""")
    assert page.locator('.ep-player-continuity').count()==1
    assert page.locator('.ep-player-continuity img').count()==0
    # The player portal uses only explicitly requested audience projections.
    page.evaluate("""async () => {
      const {RenderStub,makePlayerNarrativePortalWindow}=window.__easyPlotsTest;
      window.__portalRequests=[];
      const Window=makePlayerNarrativePortalWindow(RenderStub,{gameInstance:{user:{isGM:false},actors:{contents:[{id:'nativeActor001',isOwner:true,name:'Player Character'}]}},
       requestProjection:async request=>{window.__portalRequests.push(request);
        return {id:'ep:quest-public:harbor001',title:'<img src=x onerror=alert(1)>',objectives:[{id:'ep:objective-public:harbor001',status:'active',text:'Meet the harbor pilot'}]};}});
      await new Window().render();
    }""")
    page.locator('.ep-player-portal input[data-field="record"]').fill('ep:quest-publication:harbor001')
    page.locator('.ep-player-portal button[data-action="load"]').click()
    page.wait_for_function("document.querySelector('.ep-player-portal')?.textContent?.includes('Meet the harbor pilot')")
    assert page.locator('.ep-player-portal img').count()==0
    assert page.evaluate('window.__portalRequests[0].actorId')=='nativeActor001'
    assert page.evaluate('window.__portalRequests[0].kind')=='quest-board'
    # GM manual ingress previews before submission; no effect can run from UI.
    page.evaluate("""async () => {
      const {RenderStub,makeGMManualEventWindow}=window.__easyPlotsTest;
      window.__manualEvents=[];
      const Window=makeGMManualEventWindow(RenderStub,{gameInstance:{user:{isGM:true}},
        submitManual:async spec=>{window.__manualEvents.push(spec);return {eventId:'ep:event:manual_test001',status:'review-required'};}});
      await new Window().render();
    }""")
    assert page.locator('.ep-manual-event button[data-action="submit"]').is_disabled()
    page.locator('.ep-manual-event button[data-action="preview"]').click()
    page.wait_for_function("document.querySelector('.ep-manual-event')?.textContent?.includes('Exact manual event preview prepared')")
    assert page.locator('.ep-manual-event button[data-action="submit"]').is_disabled()
    page.locator('.ep-manual-event input[data-field="acknowledged"]').check()
    page.locator('.ep-manual-event button[data-action="submit"]').click()
    page.wait_for_function("document.querySelector('.ep-manual-event')?.textContent?.includes('Consequences remain pending separate GM review')")
    assert page.evaluate('window.__manualEvents.length')==1
    assert page.evaluate('window.__manualEvents[0].eventType')=='narrative.manual'
    # Actual protected focus service coordinates three independent DOM windows.
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest;
      document.getElementById('test-app').replaceChildren();
      class MultiViewStub {
        constructor(target){this.target=document.createElement('div');this.target.id=target;document.getElementById('test-app').append(this.target);}
        async render(){this.target.replaceChildren(await this._renderHTML());return this;}
        async close(){this.target.remove();return this;}
      }
      const first=t.makeEditableGraph({title:'Focus A'}),second=t.makeEditableGraph({title:'Focus B'});
      await t.registry.saveDraft(first);await t.registry.saveDraft(second);
      const gameInstance={user:{isGM:true}},getGraphSnapshot=async graphId=>{
        const row=await t.registry.getDraft(graphId);return {title:row.title,draftRevision:row.revision,active:false,events:[]};
      };
      const common={controller:t.focusController,service:t.focusService,getGraphSnapshot,gameInstance,openEditor:async()=>{}};
      const Dock=t.makeGMWorkspaceWindow(MultiViewStub,{...common,mode:'dock'});
      const Inspector=t.makeGMWorkspaceWindow(MultiViewStub,{...common,mode:'inspector'});
      const focusModel=new t.GraphEditorModel({registry:t.registry});
      const Canvas=t.makeGraphEditorWindow(MultiViewStub,{model:focusModel,isGM:()=>gameInstance.user.isGM,focusController:t.focusController});
      const dock=new Dock('focus-dock'),inspector=new Inspector('focus-inspector'),canvas=new Canvas('focus-canvas');
      await t.focusController.select(first.id);await dock.render();await inspector.render();await canvas.render();
      window.__focusTest={first:first.id,second:second.id,focusModel,dock,inspector,canvas,gameInstance};
    }""")
    assert 'Focus A' in page.locator('#focus-dock').inner_text()
    assert 'Focus A' in page.locator('#focus-inspector').inner_text()
    page.locator('#focus-dock [data-field="graph-id"]').fill(page.evaluate('window.__focusTest.second'))
    page.locator('#focus-dock [data-action="select"]').click()
    try:
        page.wait_for_function("document.querySelector('#focus-inspector')?.textContent.includes('Focus B')",timeout=5000)
    except Exception:
        print('Workspace DOM failure:',page.locator('#focus-dock').inner_text(),errors)
        raise
    assert page.evaluate('window.__focusTest.focusModel.graph.id === window.__focusTest.second')
    assert not page.evaluate('window.__focusTest.focusModel.state.dirty')
    page.locator('#focus-dock [data-action="pin"]').click()
    page.wait_for_function("document.querySelector('#focus-dock')?.textContent.includes('pinned')")
    page.evaluate("window.__easyPlotsTest.focusController.sceneChanged('sceneUnbound')")
    assert page.evaluate('window.__focusTest.focusModel.graph.id === window.__focusTest.second')
    page.evaluate("window.__focusTest.focusModel.rename('Unsaved B')")
    page.locator('#focus-dock [data-action="unpin"]').click()
    page.wait_for_function("!document.querySelector('#focus-dock')?.textContent.includes('· pinned')")
    page.locator('#focus-dock [data-field="graph-id"]').fill(page.evaluate('window.__focusTest.first'))
    page.locator('#focus-dock [data-action="select"]').click()
    page.wait_for_function("document.querySelector('#focus-canvas')?.textContent.includes('UNSAVED_CHANGES')")
    assert page.evaluate('window.__focusTest.focusModel.graph.title')=='Unsaved B'
    page.evaluate("""async () => {
      await window.__focusTest.dock.close();await window.__focusTest.inspector.close();await window.__focusTest.canvas.close();
    }""")
    # History desk uses the actual chronology and resumable archive services.
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,domains=new t.NarrativeDomainStore({repository:t.repo,gmProvider:t.gmProvider});
      const ledger=new t.DurableEventLedger({repository:t.repo,gmProvider:t.gmProvider,now:()=>200});
      const chronology=new t.PersistentNarrativeChronology({domains,ledger,index:new t.NativeChronologyIndex({repository:t.repo,gmProvider:t.gmProvider}),worldTimeProvider:()=>1000});
      const archives=new t.PersistentArcArchives({domains}),resolutions=new t.PersistentArcResolutions({domains});
      const arcId='ep:arc:browser_history001',eventId='ep:event:browser_history001',receiptId='ep:receipt:browser_history001';
      await domains.save({type:'arc',scope:'world',id:arcId,sourceEventId:eventId,data:{status:'active',worldTime:100,worldFacets:{leader:'captured'},objectives:[],unresolvedThreads:[],endingContracts:[{id:'ep:ending:browser_history001',requiredFacets:{leader:'captured'}}]}});
      await ledger.accept({id:eventId,eventType:'history.observed',source:{kind:'test-fixture'},payload:{secret:'NEVER_COPY_CANONICAL_TRUTH'}});
      await domains.save({type:'knowledge-claim',scope:'world',id:'ep:claim:browser_history001',sourceEventId:eventId,data:{publicText:'A report',canonicalTruth:'NEVER_COPY_CANONICAL_TRUTH'}});
      await domains.save({type:'knowledge-receipt',scope:'world',id:receiptId,sourceEventId:'ep:event:browser_disclosure001',data:{observerId:'ep:actor:browser_history001',claimId:'ep:claim:browser_history001',availableAt:30,disclosedAt:30,knowledgeAt:30,state:'published'}});
      const gameInstance={user:{isGM:true}},Window=t.makeGMHistoryDeskWindow(t.RenderStub,{gameInstance,chronology,archives});
      const app=new Window();window.__historyTest={domains,chronology,archives,resolutions,arcId,eventId,receiptId,app,gameInstance};await app.render();
    }""")
    page.locator('.ep-history-desk [data-field="arcId"]').fill('ep:arc:browser_history001')
    page.locator('.ep-history-desk [data-field="eventId"]').fill('ep:event:browser_history001')
    page.locator('.ep-history-desk [data-field="fictionAt"]').fill('10')
    assert page.locator('.ep-history-desk [data-action="record"]').is_disabled()
    page.locator('.ep-history-desk [data-field="reviewed"]').check()
    page.locator('.ep-history-desk [data-action="record"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk pre')?.textContent.includes('fictionAt')")
    page.locator('.ep-history-desk [data-field="mode"]').select_option('execution')
    page.locator('.ep-history-desk [data-action="query"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk pre')?.textContent.includes('executionAt')")
    assert 'NEVER_COPY_CANONICAL_TRUTH' not in page.locator('.ep-history-desk').inner_text()
    page.locator('.ep-history-desk [data-field="mode"]').select_option('knowledge')
    page.locator('.ep-history-desk [data-field="observerId"]').fill('ep:actor:browser_history001')
    page.locator('.ep-history-desk [data-field="receiptId"]').fill('ep:receipt:browser_history001')
    page.locator('.ep-history-desk [data-field="reviewed"]').check()
    page.locator('.ep-history-desk [data-action="record"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk pre')?.textContent.includes('knowledgeAt')")
    page.locator('.ep-history-desk [data-action="query"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk pre')?.textContent.includes('browser_disclosure001')")
    assert 'NEVER_COPY_CANONICAL_TRUTH' not in page.locator('.ep-history-desk').inner_text()
    page.evaluate("""async () => {
      const s=window.__historyTest;await s.resolutions.finalize({arcId:s.arcId,resolutionId:'ep:resolution:browser_history001',endingId:'ep:ending:browser_history001',approvalEventId:s.eventId,expectedArcRevision:1});
      s.entryId=(await s.chronology.query({arcId:s.arcId,timeline:'fiction',from:0,to:100})).items[0].entryId;
    }""")
    page.locator('.ep-history-desk [data-field="mode"]').select_option('archive')
    page.locator('.ep-history-desk [data-field="arcRevision"]').fill('2')
    page.locator('.ep-history-desk [data-field="title"]').fill('<img src=x onerror=alert(1)>')
    page.locator('.ep-history-desk [data-field="text"]').fill('Protected ending summary')
    page.locator('.ep-history-desk [data-field="reviewed"]').check()
    page.locator('.ep-history-desk [data-action="prepare"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk')?.textContent.includes('collecting')")
    page.locator('.ep-history-desk [data-field="memberType"]').select_option('chronology-event')
    page.locator('.ep-history-desk [data-field="memberId"]').fill(page.evaluate('window.__historyTest.entryId'))
    page.locator('.ep-history-desk [data-field="memberRevision"]').fill('1')
    page.locator('.ep-history-desk [data-field="reviewed"]').check()
    page.locator('.ep-history-desk [data-action="append"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk pre')?.textContent.includes('\"memberCount\": 3')")
    page.locator('.ep-history-desk [data-field="reviewed"]').check()
    page.locator('.ep-history-desk [data-action="seal"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk')?.textContent.includes('archiving')")
    assert page.locator('.ep-history-desk [data-action="finalize"]').is_disabled()
    page.locator('.ep-history-desk [data-action="advance"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk')?.textContent.includes('1/2')")
    page.locator('.ep-history-desk [data-action="advance"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk')?.textContent.includes('2/2')")
    page.locator('.ep-history-desk [data-field="reviewed"]').check()
    page.locator('.ep-history-desk [data-action="finalize"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk')?.textContent.includes('archived')")
    page.locator('.ep-history-desk [data-action="summary"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk pre')?.textContent.includes('Protected ending summary')")
    assert page.locator('.ep-history-desk img').count()==0
    page.locator('.ep-history-desk [data-field="page"]').fill('1')
    page.locator('.ep-history-desk [data-action="page"]').click()
    page.wait_for_function("document.querySelector('.ep-history-desk pre')?.textContent.includes('chronology-event')")
    page.evaluate("""async () => {window.__historyTest.gameInstance.user.isGM=false;await window.__historyTest.app.render();}""")
    assert page.locator('.ep-history-desk pre').count()==0
    assert page.locator('.ep-history-desk [data-action="finalize"]').count()==0
    # Real critical-intake recovery controls never silently replay an event.
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,domains=new t.NarrativeDomainStore({repository:t.repo,gmProvider:t.gmProvider}),ledger=new t.DurableEventLedger({repository:t.repo,gmProvider:t.gmProvider});
      const graph=t.makeEditableGraph({title:'Signal review plot'});graph.nodes[0].data.eventType='foundry.actor.updated';
      const saved=await t.registry.saveDraft(graph);await t.registry.publish(graph.id,{expectedRevision:saved.revision});await t.registry.activate(graph.id,1,{expectedActivationRevision:null});
      const engine=new t.DurableReactiveRouter({registry:t.registry,catalog:t.catalog,ledger,gmProvider:t.gmProvider});
      const state={stamp:{exists:true,modifiedTime:1000},calls:0,ledger,gameInstance:{user:{isGM:true}}};
      const router={ingest:async event=>{state.calls++;return engine.ingest(event);}};
      state.service=new t.NativeSignalReliability({domains,index:new t.NativeCriticalSignalIndex({repository:t.repo,gmProvider:t.gmProvider}),ledger,router,gmProvider:t.gmProvider,readSourceStamp:async uuid=>{if(uuid!=='Actor.browser_signal001')throw Error('Unexpected source');return structuredClone(state.stamp);}});
      const Window=t.makeSignalReliabilityDeskWindow(t.RenderStub,{gameInstance:state.gameInstance,service:state.service});state.app=new Window();window.__signalTest=state;await state.app.render();
    }""")
    page.locator('.ep-signal-reliability select[data-event-type="foundry.actor.updated"]').select_option('critical')
    page.locator('.ep-signal-reliability [data-field="sources"]').fill('Actor.browser_signal001')
    assert page.locator('.ep-signal-reliability [data-action="save-policy"]').is_disabled()
    page.locator('.ep-signal-reliability [data-field="reviewed"]').check()
    page.locator('.ep-signal-reliability [data-action="save-policy"]').click()
    page.wait_for_function("window.__signalTest.service.ready && document.querySelector('.ep-signal-reliability')?.textContent.includes('Protected reliability review updated')")
    page.evaluate("""async () => {
      const s=window.__signalTest,t=window.__easyPlotsTest;
      for(const id of ['browser_signal001','browser_signal002']){
        const event=t.normalizeFoundryHook('updateActor',[{uuid:'Actor.browser_signal001',documentName:'Actor'}, {system:{secret:'NEVER_PERSIST_SOURCE_CONTENT'}},{},'browser_GM'],{randomId:()=>id});
        await s.service.capture(event,{sourceStamp:{exists:true,modifiedTime:2000}});
      }
    }""")
    page.locator('.ep-signal-reliability [data-action="pending"]').click()
    page.wait_for_function("document.querySelectorAll('.ep-signal-reliability [data-action=inspect]').length===2")
    page.locator('.ep-signal-reliability [data-action="inspect"][data-id="ep:event:browser_signal001"]').click()
    page.wait_for_function("document.querySelector('.ep-signal-reliability [data-action=resume]')!==null")
    assert page.locator('.ep-signal-reliability [data-action="resume"]').is_disabled()
    assert 'NEVER_PERSIST_SOURCE_CONTENT' not in page.locator('.ep-signal-reliability').inner_text()
    page.locator('.ep-signal-reliability [data-field="reviewed"]').check()
    page.locator('.ep-signal-reliability [data-action="resume"]').click()
    page.wait_for_function("document.querySelector('.ep-signal-reliability')?.textContent.includes('confirmed')")
    assert page.evaluate('window.__signalTest.calls')==1
    assert page.evaluate("window.__signalTest.ledger.get('ep:event:browser_signal001').then(row=>row.state)")=='evaluated'
    assert page.locator('.ep-signal-reliability [data-action="resume"]').is_disabled()
    page.locator('.ep-signal-reliability [data-action="inspect"][data-id="ep:event:browser_signal002"]').click()
    page.locator('.ep-signal-reliability [data-field="reason"]').fill('<img src=x onerror=alert(1)>')
    page.locator('.ep-signal-reliability [data-field="reviewed"]').check()
    page.locator('.ep-signal-reliability [data-action="dismiss"]').click()
    page.wait_for_function("document.querySelector('.ep-signal-reliability')?.textContent.includes('dismissed')")
    assert page.evaluate('window.__signalTest.calls')==1
    assert page.locator('.ep-signal-reliability img').count()==0
    page.evaluate("window.__signalTest.stamp={exists:true,modifiedTime:3000}")
    page.locator('.ep-signal-reliability [data-action="sources"]').click()
    page.wait_for_function("document.querySelector('.ep-signal-reliability [data-action=select-source]')!==null")
    page.locator('.ep-signal-reliability [data-action="select-source"]').click()
    page.locator('.ep-signal-reliability [data-field="reviewed"]').check()
    page.evaluate("window.__signalTest.stamp={exists:true,modifiedTime:4000}")
    page.locator('.ep-signal-reliability [data-action="ack-source"]').click()
    page.wait_for_function("document.querySelector('.ep-signal-reliability')?.textContent.includes('SIGNAL_SOURCE_CHANGED')")
    page.locator('.ep-signal-reliability [data-action="sources"]').click()
    page.locator('.ep-signal-reliability [data-action="select-source"]').click()
    page.locator('.ep-signal-reliability [data-field="reviewed"]').check()
    page.locator('.ep-signal-reliability [data-action="ack-source"]').click()
    page.wait_for_function("document.querySelector('.ep-signal-reliability')?.textContent.includes('Checkpoint current')")
    assert page.evaluate('window.__signalTest.calls')==1
    page.evaluate("""async () => {window.__signalTest.gameInstance.user.isGM=false;await window.__signalTest.app.render();}""")
    assert page.locator('.ep-signal-reliability [data-action="resume"]').count()==0
    assert 'Actor.browser_signal001' not in page.locator('.ep-signal-reliability').inner_text()
    # One mixed call is authored in the editor, then each real proposal is
    # separately approved and executed through the event-review interface.
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,repository=new t.MemoryPartitionRepository(),gmProvider=t.gmProvider;
      const catalog=new t.ActiveTriggerCatalog({repository,gmProvider}),registry=new t.IndexedGraphRegistry({catalog,registry:new t.PersistentGraphRegistry({repository,gmProvider})});
      const child=new t.GraphEditorModel({registry});child.newGraph('Mixed child');
      const parameter=child.addNode('core.data.parameter');child.updateSelected({payloadJSON:'{"name":"argument","valueType":"number"}'});
      const exported=child.addNode('core.data.export');child.updateSelected({payloadJSON:'{"name":"answer","valueType":"number"}'});child.connect(parameter,exported,{sourcePortId:'value',targetPortId:'input'});
      const effect=child.addNode('core.effect.proposal');child.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"browser-mixed-child","value":null}'});child.bindSelectedInput({field:'value',sourceNodeId:parameter});child.connect(child.graph.rootNodeId,effect);
      await child.save();const childGraph=await child.publish(),model=new t.GraphEditorModel({registry});
      const state=t.createNarrativeStateProvider({repository,gmProvider}),ledger=new t.DurableEventLedger({repository,gmProvider}),providers=new t.EffectProviderRegistry();providers.register(state);
      const router=new t.DurableReactiveRouter({registry,catalog,ledger,gmProvider,stateReader:({scope,key})=>state.get({scope,key,value:null})});
      const reviews=new t.DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal:new t.MemoryOperationJournal()});
      const Window=t.makeGraphEditorWindow(t.RenderStub,{initialView:'advanced',model,isGM:()=>true});
      window.__mixedTest={model,childGraph,state,ledger,router,reviews,registry,catalog,gmProvider,repository,app:new Window()};await window.__mixedTest.app.render();
    }""")
    page.locator('[data-action="new"]').click()
    page.locator('[data-field="node-type"]').select_option('core.data.literal')
    page.locator('[data-action="add-node"]').click()
    page.locator('[data-field="payload-json"]').fill('{"valueType":"number","value":11}')
    page.locator('[data-action="update-node"]').click()
    literal_id=page.evaluate('window.__mixedTest.model.selectedNode.id')
    page.locator('[data-field="node-type"]').select_option('core.subgraph.mixed')
    page.locator('[data-action="add-node"]').click()
    mixed_id=page.evaluate('window.__mixedTest.model.selectedNode.id')
    call_config=page.evaluate("JSON.stringify({graphId:window.__mixedTest.childGraph.id,publishedVersion:1,inputs:[{name:'argument',valueType:'number'}],outputs:[{name:'answer',valueType:'number'}]})")
    page.locator('[data-field="payload-json"]').fill(call_config)
    page.locator('[data-action="update-node"]').click()
    page.locator('[data-field="node-type"]').select_option('core.effect.proposal')
    page.locator('[data-action="add-node"]').click()
    parent_effect=page.evaluate('window.__mixedTest.model.selectedNode.id')
    page.locator('[data-field="provider-id"]').fill('narrative.set-state')
    page.locator('[data-field="payload-json"]').fill('{"key":"browser-mixed-parent","value":null}')
    page.locator('[data-action="update-node"]').click()
    page.locator('[data-field="binding-field"]').select_option('value')
    page.locator('[data-field="binding-source"]').select_option(mixed_id+'|result-answer')
    page.locator('[data-action="bind-data"]').click()
    root=page.evaluate('window.__mixedTest.model.graph.rootNodeId')
    for source,out,target,inp in [(literal_id,'value',mixed_id,'param-argument'),(root,'out',mixed_id,'in'),(mixed_id,'out',parent_effect,'in')]:
        page.locator('[data-field="edge-output"]').select_option(source+'|'+out)
        page.locator('[data-field="edge-input"]').select_option(target+'|'+inp)
        page.locator('[data-action="connect"]').click()
    page.locator('[data-action="save"]').click()
    page.locator('[data-action="publish"]').click()
    page.locator('[data-action="activate"]').click()
    assert page.locator('.ep-error').count()==0
    page.evaluate("""async () => {
      const s=window.__mixedTest;s.eventId='ep:event:browser_mixed001';
      await s.router.ingest({id:s.eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}});
      const Window=window.__easyPlotsTest.makeEventReviewWindow(window.__easyPlotsTest.RenderStub,{ledger:s.ledger,reviews:s.reviews,runtimeStatus:()=>({running:false}),gameInstance:{user:{isGM:true}}});
      await new Window().render();
    }""")
    page.locator('[data-field="event-id"]').fill('ep:event:browser_mixed001')
    page.locator('[data-action="find"]').click()
    page.wait_for_function("document.querySelector('.ep-approvals')?.textContent.includes('Proposed effects: 2')")
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-mixed-child',value:null})")==None
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-mixed-parent',value:null})")==None
    for index in [0,1]:
        page.locator('[data-action="approve-effect"][data-index="'+str(index)+'"]').click()
        page.locator('[data-action="execute-effect"][data-index="'+str(index)+'"]').click()
        page.wait_for_function("document.querySelectorAll('.ep-approvals article').length>=0 && window.__mixedTest.state.get({key:'"+('browser-mixed-child' if index==0 else 'browser-mixed-parent')+"',value:null}).then(row=>row?.value===11)")
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-mixed-child',value:null}).then(row=>row.value)")==11
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-mixed-parent',value:null}).then(row=>row.value)")==11
    page.evaluate("""async () => {
      const s=window.__mixedTest,t=window.__easyPlotsTest,active=await s.registry.getActive(s.model.graph.id);
      const requiredNodeIds=s.model.graph.nodes.filter(n=>['core.subgraph.mixed','core.effect.proposal'].includes(n.typeId)).map(n=>n.id);
      const target=new t.GraphEditorModel({registry:s.registry});target.newGraph('After mixed completion');target.setRootTriggerType('core.trigger.operations-completed');
      target.updateSelected({payloadJSON:JSON.stringify({eventType:'narrative.operations-completed',sourceKinds:['gm-approved-intent'],sourceGraphId:active.id,sourcePublishedVersion:active.publishedVersion,requiredNodeIds})});
      const effect=target.addNode('core.effect.proposal');target.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"browser-after-mixed","value":true}'});target.connect(target.graph.rootNodeId,effect);
      await target.save();const published=await target.publish();await target.activate(published.publishedVersion);
      s.continuations=new t.ApprovedOperationEventGateway({reviews:s.reviews,router:s.router,gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},worldId:'browser-world'});
      const Window=t.makeEventReviewWindow(t.RenderStub,{ledger:s.ledger,reviews:s.reviews,continuations:s.continuations,runtimeStatus:()=>({running:false}),gameInstance:{user:{isGM:true}}});await new Window().render();
    }""")
    page.locator('[data-field="event-id"]').fill('ep:event:browser_mixed001')
    page.locator('[data-action="find"]').click()
    page.wait_for_function("document.querySelectorAll('[data-operation-index]').length===2")
    for index in [0,1]:
        page.locator('[data-operation-index="'+str(index)+'"]').check()
    page.locator('[data-action="preview-followup"]').click()
    page.wait_for_function("document.querySelector('[data-action=submit-followup]')!==null")
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-after-mixed',value:null})")==None
    page.locator('[data-action="submit-followup"]').click()
    page.wait_for_function("document.querySelector('.ep-approvals')?.textContent.includes('Proposed effects: 1')")
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-after-mixed',value:null})")==None
    page.locator('[data-action="approve-effect"]').click()
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_function("window.__mixedTest.state.get({key:'browser-after-mixed',value:null}).then(row=>row?.value===true)")
    page.locator('[data-action="return-source"]').click()
    page.wait_for_function("document.querySelector('.ep-approvals')?.textContent.includes('Proposed effects: 2')")
    page.evaluate("""async () => {
      const s=window.__mixedTest,t=window.__easyPlotsTest;
      s.plans=new t.PersistentGMPlans({domainStore:new t.NarrativeDomainStore({repository:s.repository,gmProvider:s.gmProvider}),simulatePublished:spec=>s.router.simulatePublished(spec)});
      const target=new t.GraphEditorModel({registry:s.registry});target.newGraph('Reviewed live planning intent');target.setRootTriggerType('core.trigger.reviewed-plan');
      const value=target.addNode('core.data.event');target.updateSelected({payloadJSON:'{"valueType":"number","path":["payload","suggestion","plannedEffects","0","payload","value"]}'});
      const effect=target.addNode('core.effect.proposal');target.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"browser-committed-plan","value":null}'});target.bindSelectedInput({field:'value',sourceNodeId:value});target.connect(target.graph.rootNodeId,effect);
      await target.save();const published=await target.publish();await target.activate(published.publishedVersion);
      s.planSubmissions=new t.ReviewedPlanEventGateway({plans:s.plans,router:s.router,ledger:s.ledger,readState:({scope,key})=>s.state.get({scope,key,value:null}),gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},worldId:'browser-world'});
      s.simulationSpec={graphId:s.model.graph.id,publishedVersion:s.model.graph.revision,event:{id:'ep:event:browser_published_sim001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}},faults:[{nodeId:s.childGraph.nodes.find(n=>n.typeId==='core.effect.proposal').id,stage:'apply-ack'}]};
      const Window=t.makeGMPlanningLabWindow(t.RenderStub,{gameInstance:{user:{isGM:true}},planStoreProvider:()=>s.plans,simulatePublished:spec=>s.router.simulatePublished(spec),planSubmissions:s.planSubmissions});s.planningWindow=new Window();await s.planningWindow.render();
    }""")
    page.locator('.ep-planning-lab [data-field="mode"]').select_option('published-graph')
    page.locator('.ep-planning-lab [data-field="scenario"]').fill(page.evaluate('JSON.stringify(window.__mixedTest.simulationSpec)'))
    page.locator('.ep-planning-lab [data-action="run"]').click()
    page.wait_for_function("document.querySelector('.ep-planning-lab pre')?.textContent.includes('simulated-uncertain')")
    assert 'APPLY_OR_ACK_FAILED' in page.locator('.ep-planning-lab pre').inner_text()
    assert page.evaluate("window.__mixedTest.ledger.get('ep:event:browser_published_sim001')")==None
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-mixed-parent',value:null}).then(row=>row.value)")==11
    page.locator('.ep-planning-lab [data-action="save-plan"]').click()
    page.wait_for_function("document.querySelector('.ep-planning-lab')?.textContent.includes('GM-only plan saved')")
    assert page.evaluate("window.__mixedTest.ledger.get('ep:event:browser_published_sim001')")==None
    assert page.locator('.ep-planning-lab [data-action="submit-plan"]').is_disabled()
    page.locator('.ep-planning-lab [data-action="acknowledge-plan"]').click()
    page.wait_for_function("document.querySelector('.ep-planning-lab')?.textContent.includes('Review acknowledgement recorded')")
    page.locator('.ep-planning-lab [data-action="preview-submission"]').click()
    page.wait_for_selector('.ep-plan-intent')
    plan_event_id=page.evaluate("JSON.parse(document.querySelector('.ep-plan-intent').textContent).id")
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-committed-plan',value:null})")==None
    page.locator('.ep-planning-lab [data-action="submit-plan"]').click()
    page.wait_for_function("document.querySelector('.ep-planning-lab')?.textContent.includes('Open Event Review')")
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-committed-plan',value:null})")==None
    page.evaluate("""async () => {
      const s=window.__mixedTest,t=window.__easyPlotsTest;
      const Window=t.makeEventReviewWindow(t.RenderStub,{ledger:s.ledger,reviews:s.reviews,runtimeStatus:()=>({running:false}),gameInstance:{user:{isGM:true}}});await new Window().render();
    }""")
    page.locator('[data-field="event-id"]').fill(plan_event_id)
    page.locator('[data-action="find"]').click()
    page.wait_for_function("document.querySelector('.ep-approvals')?.textContent.includes('Proposed effects: 1')")
    page.locator('[data-action="approve-effect"]').click()
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_function("window.__mixedTest.state.get({key:'browser-committed-plan',value:null}).then(row=>row?.value===11)")
    # Editing a reviewed scenario invalidates the saved review in this window.
    # It must not submit the old plan under the appearance of the new input.
    page.evaluate("window.__mixedTest.planningWindow.render()")
    page.locator('.ep-planning-lab [data-field="scenario"]').fill('{"initialFacts":{},"hypotheses":[],"rules":[]}')
    assert page.locator('.ep-planning-lab [data-action="acknowledge-plan"]').is_disabled()
    assert page.locator('.ep-planning-lab [data-action="preview-submission"]').is_disabled()
    assert page.locator('.ep-planning-lab [data-action="submit-plan"]').is_disabled()
    assert page.locator('.ep-saved-plan').count()==0
    assert page.evaluate("window.__mixedTest.ledger.get('ep:event:browser_published_sim001')")==None
    page.evaluate("""async () => {
      const s=window.__mixedTest,t=window.__easyPlotsTest,domains=new t.NarrativeDomainStore({repository:s.repository,gmProvider:s.gmProvider});
      const npcId='ep:npc:browser_schedule001',agendaId='ep:agenda:browser_npc001',scheduleId='ep:schedule:browser_npc001',commitmentId='ep:scheduled:browser_npc001',claimId='ep:claim:browser_npc001';
      const knowledge=new t.PersistentKnowledgeLedger({domains,worldTimeProvider:()=>60});
      await knowledge.createClaim({claimId,publicId:'ep:public:browser_npc001',publicText:'The harbor is open',canonicalTruth:'A protected fact',sourceEventId:'ep:event:browser_npc_truth001'});
      const receipt=await knowledge.recordDisclosure({claimId,observerId:npcId,sourceId:'ep:npc:browser_informant001',sourceEventId:'ep:event:browser_npc_disclosure001'});
      await domains.save({type:'npc-agenda',scope:'world',id:agendaId,sourceEventId:'ep:event:browser_npc_agenda001',data:{agendaId,npcId,status:'active',requiredKnowledgeIds:[claimId]}});
      await domains.save({type:'npc-schedule',scope:'world',id:scheduleId,sourceEventId:'ep:event:browser_npc_schedule001',data:{scheduleId,npcId,agendaId,locationId:'ep:location:browser_harbor001',status:'planned',dueWorldTime:100}});
      const time=new t.GMTemporalCoordinator({domains,index:new t.NativeTemporalIndex({repository:s.repository,gmProvider:s.gmProvider})}),actions=new t.PersistentNPCActions({domains,timeCoordinator:time});
      s.npc={scheduleId,receipt,actions,time,commitmentId};
      await actions.prepare({scheduleId,commitmentId,knowledgeReceiptIds:[receipt.id],worldTime:70,expectedScheduleRevision:1,expectedAgendaRevision:1,sourceEventId:'ep:event:browser_npc_prepare001',operationId:'ep:operation:browser_npc_prepare001',approved:true});
      const target=new t.GraphEditorModel({registry:s.registry});target.newGraph('Reviewed NPC due intent');target.setRootTriggerType('core.trigger.schedule-due');
      const effect=target.addNode('core.effect.proposal');target.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"browser-npc-action","value":"GM-approved"}'});target.connect(target.graph.rootNodeId,effect);await target.save();const published=await target.publish();await target.activate(published.publishedVersion);
      const gateway=new t.GMManualEventGateway({router:s.router,ledger:s.ledger,gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},worldId:'browser-world',timeCoordinator:time,verifyDueSource:spec=>actions.verifyDue(spec)});
      const Window=t.makeGMCausalPlanningWindow(t.RenderStub,{gameInstance:{user:{isGM:true}},queryDue:spec=>time.due(spec),queryCrossPlot:async()=>({}),queryNPC:spec=>actions.assess(spec),queueDue:async spec=>{const r=await gateway.emitDue(spec);s.npc.eventId=r.eventId;return r;}});await new Window().render();
    }""")
    page.locator('.ep-causal-planning [data-field="mode"]').select_option('npc')
    page.locator('[data-field="npcSchedule"]').fill('ep:schedule:browser_npc001')
    page.locator('[data-field="npcTime"]').fill('70')
    page.locator('[data-action="inspect"]').click()
    page.wait_for_function("document.querySelector('.ep-causal-planning pre')?.textContent.includes('npc-does-not-know-prerequisites')")
    page.locator('[data-field="npcReceipts"]').fill(page.evaluate('window.__mixedTest.npc.receipt.id'))
    page.locator('[data-action="inspect"]').click()
    page.wait_for_function("document.querySelector('.ep-causal-planning pre') && JSON.parse(document.querySelector('.ep-causal-planning pre').textContent).eligible===true")
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-npc-action',value:null})")==None
    page.locator('.ep-causal-planning [data-field="mode"]').select_option('due')
    page.locator('[data-action="inspect"]').click()
    page.wait_for_selector('[data-field="dueScheduleId"]')
    page.locator('[data-field="dueScheduleId"]').select_option('ep:scheduled:browser_npc001')
    page.locator('[data-field="ackDue"]').check()
    page.locator('[data-action="queue-due"]').click()
    page.wait_for_function("document.querySelector('.ep-causal-planning')?.textContent.includes('GM review event recorded')")
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-npc-action',value:null})")==None
    page.evaluate("""async () => {
      const s=window.__mixedTest,t=window.__easyPlotsTest;
      const Window=t.makeEventReviewWindow(t.RenderStub,{ledger:s.ledger,reviews:s.reviews,runtimeStatus:()=>({running:false}),gameInstance:{user:{isGM:true}}});await new Window().render();
    }""")
    page.locator('[data-field="event-id"]').fill(page.evaluate('window.__mixedTest.npc.eventId'))
    page.locator('[data-action="find"]').click()
    page.wait_for_function("document.querySelector('.ep-approvals')?.textContent.includes('Proposed effects: 1')")
    page.locator('[data-action="approve-effect"]').click()
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_function("window.__mixedTest.state.get({key:'browser-npc-action',value:null}).then(row=>row?.value==='GM-approved')")
    page.evaluate("""async () => {
      const s=window.__mixedTest,t=window.__easyPlotsTest,domains=new t.NarrativeDomainStore({repository:s.repository,gmProvider:s.gmProvider});
      s.catchup=new t.PersistentTemporalCatchup({domains,timeCoordinator:s.npc.time});
      s.openCatchup=async()=>{const Window=t.makeGMCausalPlanningWindow(t.RenderStub,{gameInstance:{user:{isGM:true}},queryDue:spec=>s.npc.time.due(spec),queryCrossPlot:async()=>({}),catchup:s.catchup});await new Window().render();};await s.openCatchup();
    }""")
    page.locator('.ep-causal-planning [data-field="mode"]').select_option('catchup')
    page.locator('[data-field="catchupId"]').fill('ep:catchup:browser_offline001')
    page.locator('[data-field="from"]').fill('-1')
    page.locator('[data-field="to"]').fill('800')
    page.locator('[data-action="create-catchup"]').click()
    page.wait_for_function("document.querySelector('.ep-causal-planning pre') && JSON.parse(document.querySelector('.ep-causal-planning pre').textContent).job.data.cursorBucket===0")
    page.locator('[data-action="advance-catchup"]').click()
    page.wait_for_function("JSON.parse(document.querySelector('.ep-causal-planning pre').textContent).job.data.cursorBucket===1")
    # A new window reads the durable cursor and the retained page without replay.
    page.evaluate('window.__mixedTest.openCatchup()')
    page.locator('.ep-causal-planning [data-field="mode"]').select_option('catchup')
    page.locator('[data-field="catchupId"]').fill('ep:catchup:browser_offline001')
    page.locator('[data-action="inspect"]').click()
    page.wait_for_function("document.querySelector('.ep-causal-planning pre') && JSON.parse(document.querySelector('.ep-causal-planning pre').textContent).job.data.cursorBucket===1")
    page.locator('[data-field="catchupBucket"]').fill('0')
    page.locator('[data-action="read-catchup-page"]').click()
    page.wait_for_function("JSON.parse(document.querySelector('.ep-causal-planning pre').textContent).page?.coveredByCursor===true")
    for cursor in [2,3,4]:
        page.locator('[data-action="advance-catchup"]').click()
        page.wait_for_function("JSON.parse(document.querySelector('.ep-causal-planning pre').textContent).job.data.cursorBucket==="+str(cursor))
    assert page.evaluate("JSON.parse(document.querySelector('.ep-causal-planning pre').textContent).candidates[0].id")=='ep:scheduled:browser_npc001'
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-npc-action',value:null}).then(row=>row.revision)")==1
    page.evaluate("""async () => {
      const s=window.__mixedTest,t=window.__easyPlotsTest,domains=new t.NarrativeDomainStore({repository:s.repository,gmProvider:s.gmProvider});
      s.templates=new t.PortableGraphTemplates({catalog:new t.PersistentBlueprintCatalog({domains}),pages:new t.ImmutableGraphPageStore({repository:s.repository,gmProvider:s.gmProvider,scope:'templates'}),registry:s.registry,domains,gmProvider:s.gmProvider,writer:{assertEligible:()=>{}}});
      const Window=t.makeGMTemplateDeskWindow(t.RenderStub,{gameInstance:{user:{isGM:true}},service:s.templates,sourceGraphId:()=>s.model.graph.id});await new Window().render();
    }""")
    page.locator('.ep-template-desk [data-field="blueprintId"]').fill('ep:blueprint:browser_template001')
    page.locator('.ep-template-desk [data-field="sourceVersion"]').fill(page.evaluate('String(window.__mixedTest.model.graph.revision)'))
    page.locator('.ep-template-desk [data-action="export"]').click()
    page.wait_for_function("document.querySelector('.ep-template-desk [data-field=template]')?.value.includes('easy-plots-graph-template')")
    assert page.evaluate("document.querySelector('.ep-template-desk [data-field=template]').value.includes(window.__mixedTest.model.graph.id)")==False
    page.locator('.ep-template-desk [data-action="store"]').click()
    page.wait_for_function("document.querySelector('.ep-template-message')?.textContent.includes('Immutable template stored')")
    template_slots=page.evaluate("JSON.parse(document.querySelector('.ep-template-desk [data-field=template]').value).slots")
    for slot in template_slots:
        if slot['kind']=='published-graph':
            page.locator('[data-slot="'+slot['id']+'"]').fill(page.evaluate('window.__mixedTest.childGraph.id'))
            page.locator('[data-slot-version="'+slot['id']+'"]').fill(page.evaluate('String(window.__mixedTest.childGraph.publishedVersion)'))
        elif slot['kind']=='scope':
            page.locator('[data-slot="'+slot['id']+'"]').fill('world')
        elif slot['kind']=='state-key':
            page.locator('[data-slot="'+slot['id']+'"]').fill('browser-template-parent' if 'payload.key' in slot['label'] else 'browser-mixed-input')
        else:
            raise AssertionError('Unexpected template slot '+str(slot))
    page.locator('.ep-template-desk [data-action="preview"]').click()
    page.wait_for_selector('.ep-template-preview')
    page.locator('[data-field="instanceTitle"]').fill('Copied harbor plot')
    assert page.locator('.ep-template-desk [data-action="create"]').is_disabled()
    page.locator('.ep-template-desk [data-action="preview"]').click()
    page.wait_for_selector('.ep-template-preview')
    template_instance_id=page.evaluate("JSON.parse(document.querySelector('.ep-template-preview').textContent).graphId")
    page.locator('.ep-template-desk [data-action="create"]').click()
    page.wait_for_selector('.ep-template-created')
    assert page.evaluate("window.__mixedTest.registry.getActive('"+template_instance_id+"')")==None
    assert page.evaluate("window.__mixedTest.registry.getDraft('"+template_instance_id+"').then(g=>g.templateSource.revision)")==1
    assert page.evaluate("window.__mixedTest.registry.getDraft('"+template_instance_id+"').then(g=>g.title)")=='Copied harbor plot'
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-template-parent',value:null})")==None
    page.evaluate("""async () => {
      const s=window.__mixedTest,t=window.__easyPlotsTest,domains=new t.NarrativeDomainStore({repository:s.repository,gmProvider:s.gmProvider}),workbench=new t.GMInvestigationWorkbench({domains});
      const investigationId='ep:investigation:browser_edit001',observerId='ep:actor:browser_edit_author001',identity={verifiedUserId:'PLAYER-browser-edit001',actorId:'native-browser-edit001',investigationId};
      await domains.save({type:'investigation',scope:'world',id:investigationId,sourceEventId:'ep:event:browser_edit_setup001',data:{title:'Player cargo mystery',canonicalTruth:'SECRET-BOARD-EDIT-CULPRIT',evidence:[{id:'ep:evidence:browser_private_edit001',publicId:'ep:clue-public:browser_edit001',publicTitle:'Cargo note',publicSummary:'A disclosed clue',disclosedTo:[observerId]},{id:'ep:evidence:browser_hidden_edit001',title:'SECRET-BOARD-EDIT-CLUE',disclosedTo:[]}],theories:[],opportunities:[]}});
      const manualEvents=new t.GMManualEventGateway({router:s.router,gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},worldId:'browser-world'}),service=new t.PlayerBoardEdits({domains,workbench,gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},actorAuthorization:async(user,actor)=>user===identity.verifiedUserId&&actor===identity.actorId,resolveObserver:async()=>observerId,manualEvents});
      const providers=new t.EffectProviderRegistry();providers.register(s.state);providers.register(t.createPlayerBoardEditProvider({service,gmProvider:s.gmProvider}));
      const reviews=new t.DurableProposalReview({repository:s.repository,registry:s.registry,ledger:s.ledger,providers,journal:new t.MemoryOperationJournal(),gmProvider:s.gmProvider});
      const prepareHandler=async()=>{const model=new t.GraphEditorModel({registry:s.registry});model.newGraph('Player edit review handler');model.setRootTriggerType('core.trigger.manual');model.updateSelected({eventType:'narrative.board-edit-reviewed'});
        const request=model.addNode('core.data.event');model.updateSelected({payloadJSON:'{"valueType":"entity","path":["payload","editRequestId"]}'});const revision=model.addNode('core.data.event');model.updateSelected({payloadJSON:'{"valueType":"number","path":["payload","expectedRequestRevision"]}'});
        const effect=model.addNode('core.investigation.apply-board-edit');model.bindSelectedInput({field:'requestId',sourceNodeId:request});model.bindSelectedInput({field:'expectedRequestRevision',sourceNodeId:revision});model.connect(model.graph.rootNodeId,effect);await model.save();s.boardEditHandler=model;return {graphId:model.graph.id};};
      const queue=service.queueForGMReview.bind(service);service.queueForGMReview=async spec=>{const result=await queue(spec);s.boardEditEventId=result.eventId;return result;};
      s.playerBoard={service,reviews,identity,workbench};
      s.openEditableBoard=async()=>{const Window=t.makeInvestigationBoardWindow(t.RenderStub,{projectionProvider:()=>service.projectionForPlayer(identity),submitBoardEdit:(edit,options)=>service.capture({...identity,edit,requestId:options.requestId})});await new Window().render();};
      const Window=t.makeGMBoardEditReviewWindow(t.RenderStub,{gameInstance:{user:{isGM:true}},service,prepareHandler});s.boardEditDesk=new Window();await s.boardEditDesk.render();
    }""")
    page.locator('.ep-board-edit-review [data-action="prepare-handler"]').click()
    page.wait_for_function("document.querySelector('.ep-board-edit-message')?.textContent.includes('Prepared review graph draft')")
    assert page.evaluate('window.__mixedTest.registry.getActive(window.__mixedTest.boardEditHandler.graph.id)')==None
    page.evaluate("""async () => {const s=window.__mixedTest,t=window.__easyPlotsTest;const Window=t.makeGraphEditorWindow(t.RenderStub,{initialView:'advanced',model:s.boardEditHandler,isGM:()=>true});await new Window().render();}""")
    page.locator('[data-action="publish"]').click()
    page.wait_for_function("document.querySelector('.ep-editor')?.textContent.includes('Published immutable snapshot')")
    page.locator('[data-action="activate"]').click()
    page.wait_for_function('window.__mixedTest.registry.getActive(window.__mixedTest.boardEditHandler.graph.id).then(Boolean)')
    page.evaluate('window.__mixedTest.openEditableBoard()')
    assert 'SECRET-BOARD-EDIT' not in page.locator('.ep-investigation-board').inner_text()
    assert 'browser_private_edit001' not in page.locator('.ep-investigation-board').inner_html()
    page.locator('[data-field="editTitle"]').fill('The cargo was diverted')
    page.locator('[data-field="editReasoning"]').fill('The note names another destination')
    page.locator('[data-edit-evidence="ep:clue-public:browser_edit001"]').select_option('support')
    page.locator('[data-action="submit-board-edit"]').click()
    page.wait_for_function("document.querySelector('.ep-investigation-board')?.textContent.includes('Proposal received for GM review')")
    assert page.evaluate("window.__mixedTest.playerBoard.workbench.read({investigationId:'ep:investigation:browser_edit001'}).then(r=>r.data.theories.length)")==0
    page.evaluate('window.__mixedTest.boardEditDesk.render()')
    page.locator('.ep-board-edit-review [data-action="list"]').click()
    page.wait_for_selector('.ep-board-edit-review [data-action="select"]')
    page.locator('.ep-board-edit-review [data-action="select"]').first.click()
    page.wait_for_selector('.ep-board-request')
    assert 'The cargo was diverted' in page.locator('.ep-board-request').inner_text()
    page.locator('.ep-board-edit-review [data-action="propose"]').click()
    page.wait_for_function("document.querySelector('.ep-board-edit-message')?.textContent.includes('review-required')")
    assert page.evaluate("window.__mixedTest.playerBoard.workbench.read({investigationId:'ep:investigation:browser_edit001'}).then(r=>r.data.theories.length)")==0
    page.evaluate("""async () => {const s=window.__mixedTest,t=window.__easyPlotsTest;const Window=t.makeEventReviewWindow(t.RenderStub,{ledger:s.ledger,reviews:s.playerBoard.reviews,runtimeStatus:()=>({running:false}),gameInstance:{user:{isGM:true}}});await new Window().loadEvent(s.boardEditEventId);}""")
    page.locator('[data-action="approve-effect"]').click()
    assert page.evaluate("window.__mixedTest.playerBoard.workbench.read({investigationId:'ep:investigation:browser_edit001'}).then(r=>r.data.theories.length)")==0
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_function("window.__mixedTest.playerBoard.workbench.read({investigationId:'ep:investigation:browser_edit001'}).then(r=>r.data.theories.length===1)")
    page.evaluate('window.__mixedTest.openEditableBoard()')
    assert 'The cargo was diverted' in page.locator('.ep-investigation-board').inner_text()
    assert 'SECRET-BOARD-EDIT' not in page.locator('.ep-investigation-board').inner_text()
    assert page.locator('[data-field="editTheory"] option').count()==2
    assert not errors,errors
    # Actual WebCrypto and targeted key transport, with explicit native-result
    # confirmation and operation reconciliation after a lost acknowledgement.
    page.evaluate("""async () => {
      const s=window.__mixedTest,t=window.__easyPlotsTest,domains=new t.NarrativeDomainStore({repository:s.repository,gmProvider:s.gmProvider}),gm=s.gmProvider().session.user;
      gm.active=true;const player={id:'PlayerNativeBrowser01',isGM:false,active:true},users=new Map([[gm.id,gm],[player.id,player]]),listeners=new Map(),traffic=[],fault={lostAck:true};
      const collection=kind=>{const docs=new Map(),writes=[];return {get:id=>docs.get(id),writes,documentClass:{createDocuments:async rows=>{writes.push(structuredClone(rows));const result=rows.map(raw=>{const source=structuredClone(raw),doc={id:raw._id,documentName:kind,toObject:()=>structuredClone(source),getFlag:(module,key)=>source.flags?.[module]?.[key]};docs.set(doc.id,doc);return doc;});if(fault.lostAck)throw Error('Native acknowledgement lost');return result;}}};};
      const messages=collection('ChatMessage'),journal=collection('JournalEntry');
      const gameFor=user=>({user,world:{id:'browser-world'},messages,journal,users:{get:id=>users.get(id),get activeGM(){return gm;}},modules:{get:()=>({socket:true})},socket:{on:(name,fn)=>listeners.set(user.id,fn),off:()=>listeners.delete(user.id),emit:(name,packet,{recipients})=>{if(recipients.length!==1)throw Error('Broadcast forbidden');traffic.push({from:user.id,to:recipients,packet:structuredClone(packet)});for(const id of recipients)queueMicrotask(()=>listeners.get(id)?.(structuredClone(packet),user.id));}}});
      const game=gameFor(gm),playerGame=gameFor(player),writer={assertEligible:()=>{}},observerId='ep:actor:browser_publication001',knowledge=new t.PersistentKnowledgeLedger({domains,worldTimeProvider:()=>5}),claimId='ep:claim:browser_publication001';
      await knowledge.createClaim({claimId,publicId:'ep:public:browser_publication001',publicText:'Authorized <img src=x onerror="window.__injected=true"> @UUID[Actor.secret] [[1d20]]',canonicalTruth:'GM-TRUTH-NEVER-PUBLISHED',sourceEventId:'ep:event:browser_publication_truth001'});
      class RollFixture{constructor(formula,data){this.total=13+data.modifier;}async evaluate(){return this;}}
      const rolls=new t.FoundryD20RollCoordinator({repository:s.repository,gmProvider:s.gmProvider,RollClass:RollFixture,authorizeActor:async()=>true});
      const receipt=await knowledge.recordDisclosure({claimId,observerId,sourceId:'ep:npc:browser_publication_source001',sourceEventId:'ep:event:browser_publication_disclosure001'}),plans=new t.KnowledgePublications({domains,knowledgeLedger:knowledge,gmProvider:s.gmProvider,writer,router:s.router,ledger:s.ledger,worldId:'browser-world',readRoll:(kind,id)=>rolls.get(id)});
      const native=new t.ProtectedNativePublications({domains,plans,gmProvider:s.gmProvider,writer,gameInstance:game,actorAuthorization:async(user,actor)=>user===player.id&&actor==='OwnedNativeActor01',resolveObserver:async()=>observerId}),providers=new t.EffectProviderRegistry();providers.register(t.createProtectedPublicationProvider({service:native,gmProvider:s.gmProvider}));
      const reviews=new t.DurableProposalReview({repository:s.repository,registry:s.registry,ledger:s.ledger,gmProvider:s.gmProvider,providers,journal:new t.MemoryOperationJournal()}),serverKeys=new t.NativePublicationKeyTransport({gameInstance:game,keyProvider:spec=>native.keyForUser(spec)}),playerKeys=new t.NativePublicationKeyTransport({gameInstance:playerGame});serverKeys.start();playerKeys.start();
      const publication={plans,native,reviews,game,playerGame,receipt,observerId,messages,traffic,serverKeys,playerKeys,rolls,fault,knowledge};s.publication=publication;
      const prepareHandler=async()=>{const result=await t.preparePublicationHandlerDraft({registry:s.registry,mode:'sandbox'});publication.handlerId=result.graphId;return result;};
      const openDraft=async id=>{const model=new t.GraphEditorModel({registry:s.registry});await model.load(id);const Window=t.makeGraphEditorWindow(t.RenderStub,{initialView:'advanced',model,isGM:()=>true});await new Window().render();};
      publication.openEvent=async eventId=>{const Window=t.makeEventReviewWindow(t.RenderStub,{ledger:s.ledger,reviews,runtimeStatus:()=>({running:false}),gameInstance:game});await new Window().loadEvent(eventId);};
      publication.openPlayer=async reference=>{const Window=t.makeProtectedPublicationWindow(t.RenderStub,{gameInstance:playerGame,...reference,actorId:'OwnedNativeActor01',requestKey:spec=>playerKeys.request(spec)});await new Window().render();};
      const Window=t.makeGMKnowledgePublicationWindow(t.RenderStub,{gameInstance:game,plans,native,prepareHandler,openDraft,openEvent:publication.openEvent,openPublication:publication.openPlayer});publication.desk=new Window();await publication.desk.render();
    }""")
    publication_id='ep:publication:browser_known_report001'
    for field,value in [('id',publication_id),('observerId','ep:actor:browser_publication001'),('title','Authorized report'),('receiptIds',page.evaluate('window.__mixedTest.publication.receipt.id')),('worldTime','10')]:
        page.locator('.ep-knowledge-publications [data-field="'+field+'"]').fill(value)
    page.locator('.ep-knowledge-publications [data-action="prepare"]').click()
    page.wait_for_selector('.ep-publication-plan')
    page.locator('.ep-knowledge-publications [data-action="approve"]').click()
    page.wait_for_function("JSON.parse(document.querySelector('.ep-publication-plan').textContent).state==='approved'")
    assert page.evaluate('window.__mixedTest.publication.messages.writes.length')==0
    page.locator('[data-action="prepare-handler"]').click()
    page.wait_for_selector('[data-action="open-handler"]')
    assert page.evaluate('window.__mixedTest.registry.getActive(window.__mixedTest.publication.handlerId)')==None
    page.locator('[data-action="open-handler"]').click()
    page.wait_for_selector('[data-action="publish"]')
    page.locator('[data-action="publish"]').click()
    page.wait_for_function("document.querySelector('.ep-editor')?.textContent.includes('Published immutable snapshot')")
    page.locator('[data-action="activate"]').click()
    page.wait_for_function('window.__mixedTest.registry.getActive(window.__mixedTest.publication.handlerId).then(Boolean)')
    page.evaluate('window.__mixedTest.publication.desk.render()')
    page.locator('.ep-knowledge-publications [data-action="propose"]').click()
    page.wait_for_selector('[data-action="open-event"]')
    page.locator('[data-action="open-event"]').click()
    page.wait_for_selector('[data-action="approve-effect"]')
    assert page.evaluate('window.__mixedTest.publication.messages.writes.length')==0
    page.locator('[data-action="approve-effect"]').click()
    page.wait_for_selector('[data-action="execute-effect"]')
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_selector('[data-action="reconcile-effect"]')
    assert page.evaluate('window.__mixedTest.publication.messages.writes.length')==1
    page.evaluate('window.__mixedTest.publication.desk.render()')
    page.locator('[data-action="inspect-native"]').click()
    page.wait_for_function("JSON.parse(document.querySelector('.ep-publication-native').textContent).nativeConfirmed===true")
    page.locator('[data-action="confirm-native"]').click()
    page.wait_for_function("JSON.parse(document.querySelector('.ep-publication-native').textContent).state==='ready'")
    native_ref=page.evaluate("({nativeKind:JSON.parse(document.querySelector('.ep-publication-native').textContent).nativeKind,nativeId:JSON.parse(document.querySelector('.ep-publication-native').textContent).nativeId})")
    page.locator('[data-action="open-event"]').click()
    page.wait_for_selector('[data-action="reconcile-effect"]')
    page.locator('[data-action="reconcile-effect"]').click()
    page.wait_for_function("document.querySelector('.ep-approvals')?.textContent.includes('Reconciliation: completed')")
    assert page.evaluate('window.__mixedTest.publication.messages.writes.length')==1
    native_json=page.evaluate('JSON.stringify(window.__mixedTest.publication.messages.writes)')
    for secret in ['Authorized','GM-TRUTH','ep:actor:browser_publication','ep:claim:',publication_id,'PlayerNativeBrowser01']:
        assert secret not in native_json,secret
    # The native render hook adds only a generic opener and fetches no key.
    page.evaluate("""reference => {const s=window.__mixedTest.publication,t=window.__easyPlotsTest,html=document.createElement('div');html.id='native-chat-test';document.getElementById('test-app').replaceChildren(html);const doc=s.game.messages.get(reference.nativeId);t.attachProtectedPublicationButton(doc,html,ref=>s.openPlayer(ref));t.attachProtectedPublicationButton(doc,html,ref=>s.openPlayer(ref));}""",native_ref)
    assert page.locator('[data-action="open-protected-publication"]').count()==1
    assert page.evaluate('window.__mixedTest.publication.traffic.length')==0
    page.locator('[data-action="open-protected-publication"]').click()
    page.wait_for_selector('[data-action="open-protected"]')
    assert page.locator('.ep-publication-plaintext').count()==0
    page.locator('[data-action="open-protected"]').click()
    page.wait_for_selector('.ep-publication-plaintext')
    assert 'Authorized <img' in page.locator('.ep-publication-plaintext').inner_text()
    assert '@UUID[Actor.secret] [[1d20]]' in page.locator('.ep-publication-plaintext').inner_text()
    assert page.locator('.ep-publication-plaintext img,.ep-publication-plaintext a').count()==0
    assert page.evaluate('window.__injected===true')==False
    assert page.evaluate('window.__mixedTest.publication.traffic.every(t=>t.to.length===1)')
    page.locator('[data-field="publicationActor"]').fill('UnownedNativeActor01')
    assert page.locator('.ep-publication-plaintext').count()==0
    page.locator('[data-action="open-protected"]').click()
    page.wait_for_selector('.ep-publication-message')
    assert 'unavailable' in page.locator('.ep-publication-message').inner_text()
    assert page.locator('.ep-publication-plaintext').count()==0
    page.evaluate("""async () => {const s=window.__mixedTest.publication;s.fault.lostAck=false;s.roll=await s.rolls.resolve({attemptId:'ep:attempt:browser_mechanical001',sourceEventId:'ep:event:browser_mechanical001',actorId:s.observerId,mode:'active',modifier:2,dc:20,partialMargin:5,visibility:'gm-only'});await s.desk.render();}""")
    for audience in ['gm-only','all-players','observers']:
        page.locator('.ep-knowledge-publications [data-action="new-plan"]').click()
        page.locator('.ep-knowledge-publications [data-field="publicationKind"]').select_option('roll')
        page.wait_for_selector('[data-field="attemptId"]')
        page.locator('[data-field="id"]').fill('ep:publication:browser_roll_'+audience.replace('-','_'))
        page.locator('[data-field="attemptId"]').fill('ep:attempt:browser_mechanical001')
        page.locator('[data-field="expectedRollRevision"]').fill(page.evaluate('String(window.__mixedTest.publication.roll.record.revision)'))
        page.locator('[data-field="title"]').fill('Mechanical report')
        page.locator('[data-field="audience"]').select_option(audience)
        page.locator('[data-field="observerIds"]').fill('ep:actor:browser_publication001' if audience=='observers' else '')
        page.locator('[data-field="disclosure"]').select_option('total-only')
        page.locator('[data-action="prepare"]').click()
        page.wait_for_function("JSON.parse(document.querySelector('.ep-publication-plan').textContent).view.kind==='roll-publication'")
        saved_view=page.evaluate("JSON.parse(document.querySelector('.ep-publication-plan').textContent).view")
        assert saved_view['total']==15 and 'outcome' not in saved_view and 'dc' not in saved_view
        page.locator('[data-action="approve"]').click()
        page.wait_for_function("JSON.parse(document.querySelector('.ep-publication-plan').textContent).state==='approved'")
        page.locator('[data-action="propose"]').click()
        page.wait_for_selector('[data-action="open-event"]')
        page.locator('[data-action="open-event"]').click()
        page.wait_for_selector('[data-action="approve-effect"]')
        page.locator('[data-action="approve-effect"]').click()
        page.wait_for_selector('[data-action="execute-effect"]')
        page.locator('[data-action="execute-effect"]').click()
        page.wait_for_function("document.querySelector('.ep-approvals')?.textContent.includes('Execution: completed')")
        page.evaluate('window.__mixedTest.publication.desk.render()')
        page.locator('[data-action="inspect-native"]').click()
        page.wait_for_selector('.ep-publication-native')
        page.locator('[data-action="open-content"]').click()
        page.wait_for_selector('[data-action="open-protected"]')
        if audience=='all-players':
            page.locator('[data-field="publicationActor"]').fill('')
        page.locator('[data-action="open-protected"]').click()
        if audience=='gm-only':
            page.wait_for_selector('.ep-publication-message')
            assert page.locator('.ep-publication-plaintext').count()==0
        else:
            page.wait_for_selector('.ep-roll-total')
            assert page.locator('.ep-roll-total').inner_text()=='Total: 15'
            assert page.locator('.ep-roll-outcome').count()==0
            assert 'Mechanical report. Narrative knowledge is disclosed separately.' in page.locator('.ep-publication-plaintext').inner_text()
        assert page.evaluate("window.__mixedTest.publication.knowledge.projection({observerId:'ep:actor:other_uninformed001',receiptIds:[],worldTime:10}).then(v=>v.claims.length)")==0
        page.evaluate('window.__mixedTest.publication.desk.render()')
    assert page.evaluate('window.__mixedTest.publication.messages.writes.length')==4
    page.evaluate("""async () => {
      const s=window.__mixedTest,t=window.__easyPlotsTest,p=s.publication,model=new t.GraphEditorModel({registry:s.registry});model.newGraph('Condition from verified native roll');model.setRootTriggerType('core.trigger.manual');model.updateSelected({eventType:'mechanical.checked'});
      const roll=model.addNode('core.roll.value');model.updateSelected({payloadJSON:JSON.stringify({rollKind:'d20',attemptId:p.roll.record.attemptId,expectedRevision:p.roll.record.revision,side:'self',field:'total',valueType:'number'})});
      const threshold=model.addNode('core.data.literal');model.updateSelected({payloadJSON:'{"valueType":"number","value":12}'});const compare=model.addNode('core.data.compare');model.connect(roll,compare,{sourcePortId:'value',targetPortId:'left'});model.connect(threshold,compare,{sourcePortId:'value',targetPortId:'right'});
      const branch=model.addNode('core.branch.data');model.connect(compare,branch,{sourcePortId:'value',targetPortId:'predicate'});model.connect(model.graph.rootNodeId,branch);
      const effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"browser-verified-mechanical","value":null}'});model.bindSelectedInput({field:'value',sourceNodeId:roll});model.connect(branch,effect,{sourcePortId:'true',targetPortId:'in'});await model.save();
      const readRoll=(kind,id)=>p.rolls.get(id),router=new t.DurableReactiveRouter({registry:s.registry,catalog:s.catalog,ledger:s.ledger,gmProvider:s.gmProvider,rollReader:readRoll}),providers=new t.EffectProviderRegistry();providers.register(s.state);
      p.mechanical={model,router,reviews:new t.DurableProposalReview({repository:s.repository,registry:s.registry,ledger:s.ledger,gmProvider:s.gmProvider,providers,journal:new t.MemoryOperationJournal(),readRoll})};
      const Window=t.makeGraphEditorWindow(t.RenderStub,{initialView:'advanced',model,isGM:()=>true});await new Window().render();
    }""")
    page.locator('[data-action="publish"]').click()
    page.wait_for_function("document.querySelector('.ep-editor')?.textContent.includes('Published immutable snapshot')")
    page.locator('[data-action="activate"]').click()
    page.wait_for_function('window.__mixedTest.registry.getActive(window.__mixedTest.publication.mechanical.model.graph.id).then(Boolean)')
    page.evaluate("""async () => {const s=window.__mixedTest,t=window.__easyPlotsTest,p=s.publication,gateway=new t.GMManualEventGateway({router:p.mechanical.router,gmProvider:s.gmProvider,writer:{assertEligible:()=>{}},worldId:'browser-world'});const result=await gateway.emit({requestId:'ep:request:browser_verified_mechanical001',eventType:'mechanical.checked',payload:{total:999}});if(result.status!=='review-required')throw Error(JSON.stringify(result));p.mechanical.eventId=result.eventId;const Window=t.makeEventReviewWindow(t.RenderStub,{ledger:s.ledger,reviews:p.mechanical.reviews,gameInstance:p.game});await new Window().loadEvent(result.eventId);}""")
    page.locator('.ep-effect-preview summary').click()
    mechanical_preview=page.locator('.ep-effect-provenance').inner_text()
    assert 'ep:attempt:browser_mechanical001' in mechanical_preview
    assert 'ep:event:browser_mechanical001' in mechanical_preview
    assert '"dc": 20' in mechanical_preview
    assert page.evaluate("window.__mixedTest.state.get({key:'browser-verified-mechanical',value:null})")==None
    page.locator('[data-action="approve-effect"]').click()
    page.wait_for_selector('[data-action="execute-effect"]')
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_function("window.__mixedTest.state.get({key:'browser-verified-mechanical',value:null}).then(row=>row?.value===15)")
    assert page.evaluate("window.__mixedTest.ledger.get(window.__mixedTest.publication.mechanical.eventId).then(e=>e.evaluations[0].inputObservations[0].value)")==15
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,repository=new t.MemoryPartitionRepository(),gm=t.gmProvider().session.user,domains=new t.NarrativeDomainStore({repository,gmProvider:t.gmProvider}),service=new t.PersistentNarrativeNotifications({domains}),players=[{id:'BrowserNoticePlayer01',isGM:false,active:true},{id:'BrowserNoticePlayer02',isGM:false,active:true}],users=new Map([[gm.id,gm],...players.map(p=>[p.id,p])]),listeners=new Map(),inboxes=players.map(()=>new t.PlayerNoticeInbox()),traffic=[];
      const game=user=>({user,users:{get:id=>users.get(id),activeGM:gm},modules:{get:()=>({socket:true})},socket:{on:(channel,fn)=>listeners.set(user.id,fn),off:()=>listeners.delete(user.id),emit:(channel,packet,{recipients})=>{if(recipients.length!==1)throw Error('Broadcast forbidden');traffic.push(structuredClone(packet));for(const id of recipients)queueMicrotask(()=>listeners.get(id)?.(structuredClone(packet),user.id));}}});
      const gmGame=game(gm),recipientIds=['ep:actor:browser_notice001','ep:actor:browser_notice002'];const server=new t.NativeFoundryNotificationTransport({gameInstance:gmGame,service,resolveRecipientUser:async({recipientId})=>players[recipientIds.indexOf(recipientId)]?.id,authorizeRecipient:async(id,recipientId)=>players[recipientIds.indexOf(recipientId)]?.id===id,checkGM:()=>{if(!gm.isGM)throw Error('GM revoked');}});server.start();
      const clients=players.map((player,i)=>{const client=new t.NativeFoundryNotificationTransport({gameInstance:game(player),onReceive:async item=>{inboxes[i].receive(item);return true;}});client.start();return client;});
      for(const [i,recipient] of [0,0,1].entries())await service.queue({noticeId:`ep:notice:browser_grouped_${i}`,recipientId:recipientIds[recipient],sourceEventId:`ep:event:browser_grouped_${i}`,groupKey:'secret-campaign-group',publicGroup:'Harbor updates',safeText:`Approved report ${i} <img src=x onerror=alert(1)>`,gmDetail:'HIDDEN-NOTIFICATION-TRUTH',level:i===2?'urgent':'info'});
      const show=async index=>{const Window=t.makePlayerNotificationInboxWindow(t.RenderStub,{inbox:inboxes[index]});await new Window().render();};
      window.__groupedNotices={service,server,clients,inboxes,traffic,show};const Window=t.makeGMNotificationWindow(t.RenderStub,{gameInstance:gmGame,service,deliverNotice:spec=>server.deliver(spec)});await new Window().render();
    }""")
    page.locator('.ep-notification-desk [data-action="list"]').click()
    page.wait_for_selector('.ep-gm-notice-group')
    assert page.locator('.ep-gm-notice-group').count()==2
    for i in range(3):
        page.locator('.ep-notification-desk [data-field="notice-id"]').fill('ep:notice:browser_grouped_'+str(i))
        page.locator('.ep-notification-desk [data-action="read"]').click()
        page.wait_for_selector('.ep-notification-desk [data-field="reviewed"]')
        page.locator('.ep-notification-desk [data-field="reviewed"]').check()
        page.locator('.ep-notification-desk [data-action="approve"]').click()
        page.wait_for_selector('.ep-notification-desk [data-action="deliver"]')
        page.locator('.ep-notification-desk [data-action="deliver"]').click()
        page.wait_for_function("document.querySelector('.ep-notification-desk')?.textContent.includes('Authenticated client receipt: acknowledged')")
    page.evaluate('window.__groupedNotices.show(0)')
    assert page.locator('.ep-notice-group').count()==1
    assert page.locator('.ep-notice-text').count()==2
    assert 'Harbor updates' in page.locator('.ep-player-notices').inner_text()
    assert 'HIDDEN-NOTIFICATION' not in page.locator('.ep-player-notices').inner_text()
    assert 'secret-campaign-group' not in page.locator('.ep-player-notices').inner_text()
    assert page.locator('.ep-player-notices img').count()==0
    page.evaluate('window.__groupedNotices.show(1)')
    assert page.locator('.ep-notice-text').count()==1
    assert 'urgent' in page.locator('.ep-notice-group').inner_text()
    page.evaluate('window.__groupedNotices.show(0)')
    page.locator('[data-action="dismiss-notice-group"]').click()
    page.wait_for_function("document.querySelector('.ep-player-notices')?.textContent.includes('No received updates')")
    assert page.evaluate("window.__groupedNotices.service.read({noticeId:'ep:notice:browser_grouped_0'}).then(row=>row.data.state)")=='published'
    assert page.evaluate("JSON.stringify(window.__groupedNotices.traffic).includes('HIDDEN-NOTIFICATION')")==False
    page.evaluate('window.__groupedNotices.server.stop();window.__groupedNotices.clients.forEach(c=>c.stop())')
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,repository=new t.MemoryPartitionRepository(),gmProvider=t.gmProvider,domains=new t.NarrativeDomainStore({repository,gmProvider}),catalog=new t.ActiveTriggerCatalog({repository,gmProvider}),registry=new t.IndexedGraphRegistry({catalog,registry:new t.PersistentGraphRegistry({repository,gmProvider})}),writer={assertEligible:()=>{}},service=new t.PersistentKnowledgeReviews({domains,repository,gmProvider,writer,readGraph:(id,v)=>registry.getPublished(id,v)}),knowledge=new t.PersistentKnowledgeLedger({domains,worldTimeProvider:()=>10,beforeCorrectionPersist:spec=>service.stageCorrection(spec)});
      const claimId='ep:claim:browser_review001',observerId='ep:actor:browser_review001';await knowledge.createClaim({claimId,publicId:'ep:public:browser_review001',publicText:'The witness saw a wagon',canonicalTruth:'PRIVATE-REVIEW-TRUTH',sourceEventId:'ep:event:browser_review_truth001'});const receipt=await knowledge.recordDisclosure({claimId,observerId,sourceId:'ep:npc:browser_review_source001',sourceEventId:'ep:event:browser_review_disclosure001'});
      const model=new t.GraphEditorModel({registry});model.newGraph('Retained knowledge inference');model.setRootTriggerType('core.trigger.manual');model.updateSelected({eventType:'knowledge.review-test'});const nodeId=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"browser-reviewed-inference","value":true}'});model.connect(model.graph.rootNodeId,nodeId);await model.save();const graph=await model.publish();await model.activate(graph.publishedVersion);
      const ledger=new t.DurableEventLedger({repository,gmProvider}),router=new t.DurableReactiveRouter({registry,catalog,ledger,gmProvider}),state=t.createNarrativeStateProvider({repository,gmProvider}),providers=new t.EffectProviderRegistry();providers.register(state);const reviews=new t.DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal:new t.MemoryOperationJournal(),dependencyGuard:spec=>service.guardProposal(spec)}),gateway=new t.GMManualEventGateway({router,ledger,gmProvider,writer,worldId:'browser-world'}),event=await gateway.emit({requestId:'ep:request:browser_reviewed_inference001',eventType:'knowledge.review-test',payload:{}}),game={user:gmProvider().session.user};
      const Window=t.makeGMKnowledgeFactionDeskWindow(t.RenderStub,{gameInstance:game,knowledgePropagation:new t.PersistentKnowledgePropagation({domains,knowledge}),factionAgendas:new t.PersistentFactionAgenda({domains}),knowledgeReviews:service}),desk=new Window();
      const openEvent=async()=>{const Review=t.makeEventReviewWindow(t.RenderStub,{ledger,reviews,gameInstance:game});await new Review().loadEvent(event.eventId);};window.__knowledgeReview={service,knowledge,domains,receipt,graph,nodeId,game,desk,state,event,ledger,openEvent};await desk.render();
    }""")
    page.locator('.ep-society-desk [data-field="mode"]').select_option('dependency-register')
    dependency_input=page.evaluate("({id:'ep:dependency:browser_inference001',dependent:{kind:'graph-node',graphId:window.__knowledgeReview.graph.id,publishedVersion:window.__knowledgeReview.graph.publishedVersion,nodeId:window.__knowledgeReview.nodeId},sources:[{type:'knowledge-receipt',id:window.__knowledgeReview.receipt.id,revision:1}],sourceEventId:'ep:event:browser_inference_dependency001'})")
    import json
    page.locator('.ep-society-desk [data-field="scenario"]').fill(json.dumps(dependency_input))
    page.locator('.ep-society-desk [data-action="preview"]').click()
    page.wait_for_selector('.ep-society-desk [data-field="confirm"]')
    page.locator('.ep-society-desk [data-field="confirm"]').check()
    page.locator('.ep-society-desk [data-action="commit"]').click()
    page.wait_for_function("JSON.parse(document.querySelector('.ep-society-desk pre').textContent).data?.state==='active'")
    page.evaluate("""async () => {const s=window.__knowledgeReview;s.correction=await s.knowledge.correctReceipt({correctionId:'ep:correction:browser_review001',receiptId:s.receipt.id,sourceEventId:'ep:event:browser_review_retraction001',sourceId:'ep:npc:browser_review_source001',kind:'retracted',revisedStance:'retracted',reason:'The witness withdrew the report'});await s.openEvent();}""")
    page.locator('[data-action="approve-effect"]').click()
    page.wait_for_function("document.querySelector('.ep-approvals')?.textContent.includes('KNOWLEDGE_DEPENDENCY_REVIEW_REQUIRED')")
    assert page.evaluate("window.__knowledgeReview.state.get({key:'browser-reviewed-inference',value:null})")==None
    page.evaluate('window.__knowledgeReview.desk.render()')
    page.locator('.ep-society-desk [data-field="mode"]').select_option('review-begin')
    page.locator('.ep-society-desk [data-field="scenario"]').fill(json.dumps({'change':{'kind':'receipt-correction','correctionId':'ep:correction:browser_review001','revision':1}}))
    page.locator('.ep-society-desk [data-action="preview"]').click()
    page.wait_for_selector('.ep-society-desk [data-field="confirm"]')
    page.locator('.ep-society-desk [data-field="confirm"]').check()
    page.locator('.ep-society-desk [data-action="commit"]').click()
    page.wait_for_function("JSON.parse(document.querySelector('.ep-society-desk pre').textContent).kind==='knowledge-review-job'")
    review_job=page.evaluate("JSON.parse(document.querySelector('.ep-society-desk pre').textContent)")
    page.locator('.ep-society-desk [data-field="mode"]').select_option('review-advance')
    page.locator('.ep-society-desk [data-field="scenario"]').fill(json.dumps({'id':review_job['id'],'expectedRevision':review_job['revision']}))
    page.locator('.ep-society-desk [data-action="preview"]').click()
    page.wait_for_selector('.ep-society-desk [data-field="confirm"]')
    page.locator('.ep-society-desk [data-field="confirm"]').check()
    page.locator('.ep-society-desk [data-action="commit"]').click()
    page.wait_for_function("JSON.parse(document.querySelector('.ep-society-desk pre').textContent).data?.state==='completed'")
    page.locator('.ep-society-desk [data-field="mode"]').select_option('review-list')
    page.locator('.ep-society-desk [data-field="scenario"]').fill(json.dumps({'jobId':review_job['id']}))
    page.locator('.ep-society-desk [data-action="preview"]').click()
    page.wait_for_function("JSON.parse(document.querySelector('.ep-society-desk pre').textContent).items?.length===1")
    dependent_review=page.evaluate("JSON.parse(document.querySelector('.ep-society-desk pre').textContent).items[0]")
    page.locator('.ep-society-desk [data-field="mode"]').select_option('review-decide')
    page.locator('.ep-society-desk [data-field="scenario"]').fill(json.dumps({'jobId':review_job['id'],'id':dependent_review['id'],'expectedRevision':dependent_review['revision'],'decision':'retain-recorded-conclusion','reason':'The GM explicitly retains this conclusion after reviewing the withdrawn account'}))
    page.locator('.ep-society-desk [data-action="preview"]').click()
    page.wait_for_selector('.ep-society-desk [data-field="confirm"]')
    page.locator('.ep-society-desk [data-field="confirm"]').check()
    page.locator('.ep-society-desk [data-action="commit"]').click()
    page.wait_for_function("JSON.parse(document.querySelector('.ep-society-desk pre').textContent).data?.state==='reviewed'")
    assert page.evaluate("window.__knowledgeReview.state.get({key:'browser-reviewed-inference',value:null})")==None
    page.evaluate('window.__knowledgeReview.openEvent()')
    page.locator('[data-action="approve-effect"]').click()
    page.wait_for_selector('[data-action="execute-effect"]')
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_function("window.__knowledgeReview.state.get({key:'browser-reviewed-inference',value:null}).then(row=>row?.value===true)")
    assert page.evaluate("window.__knowledgeReview.domains.read('knowledge-receipt','world',window.__knowledgeReview.receipt.id).then(row=>row.revision)")==1
    assert page.evaluate("window.__knowledgeReview.ledger.get(window.__knowledgeReview.event.eventId).then(row=>row.evaluations.length)")==1
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,repository=new t.MemoryPartitionRepository(),first={id:'BrowserOriginalGM01',isGM:true},successor={id:'BrowserSuccessorGM1',isGM:true};let context=t.createLocalGMContext({user:first,epoch:'original'},'handover-world');const gmProvider=()=>context,catalog=new t.ActiveTriggerCatalog({repository,gmProvider}),registry=new t.IndexedGraphRegistry({catalog,registry:new t.PersistentGraphRegistry({repository,gmProvider})}),ledger=new t.DurableEventLedger({repository,gmProvider}),router=new t.DurableReactiveRouter({registry,catalog,ledger,gmProvider}),providers=new t.EffectProviderRegistry(),state=t.createNarrativeStateProvider({repository,gmProvider});providers.register(state);
      const reviews=new t.DurableProposalReview({repository,registry,ledger,gmProvider,providers,journal:new t.MemoryOperationJournal()}),model=new t.GraphEditorModel({registry});model.newGraph('Unexecuted approval handover');const effect=model.addNode('core.effect.proposal');model.updateSelected({providerId:'narrative.set-state',payloadJSON:'{"key":"successor-adoption","value":true}'});model.connect(model.graph.rootNodeId,effect);await model.save();const graph=await model.publish();await model.activate(graph.publishedVersion);
      const eventId='ep:event:browser_successor_adoption001';await router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}});const p=(await ledger.get(eventId)).proposals[0];await reviews.decide(eventId,p.operationId,{approve:true,reason:'The original GM approved this unchanged effect'});first.isGM=false;context=t.createLocalGMContext({user:successor,epoch:'successor'},'handover-world');
      window.__approvalHandover={reviews,state,eventId,p,ledger};const Window=t.makeEventReviewWindow(t.RenderStub,{ledger,reviews,gameInstance:{user:successor}});await new Window().loadEvent(eventId);
    }""")
    assert page.locator('[data-action="execute-effect"]').count()==0
    assert page.locator('[data-action="adopt-effect"]').is_disabled()
    page.locator('[data-adoption-reason="0"]').fill('The successor independently reviewed the unchanged proposal and its original provenance')
    page.locator('[data-action="adopt-effect"]').click()
    page.wait_for_function("document.querySelector('.ep-approvals')?.textContent.includes('Successor approval recorded')")
    assert page.evaluate("window.__approvalHandover.state.get({key:'successor-adoption',value:null})")==None
    assert page.evaluate('window.__approvalHandover.ledger.get(window.__approvalHandover.eventId).then(e=>e.evaluations.length)')==1
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_function("window.__approvalHandover.state.get({key:'successor-adoption',value:null}).then(row=>row?.value===true)")
    assert page.evaluate('window.__approvalHandover.reviews.get(window.__approvalHandover.eventId,window.__approvalHandover.p.operationId).then(r=>r.approvalHistory[0].approvedBy)')=='BrowserOriginalGM01'
    # Distinct GM principals, native sender/recipient routing, policy service and
    # both windows. No effects or private packets are sent to a player.
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,one={id:'BrowserOwnerGM001',name:'First GM',isGM:true,active:true},two={id:'BrowserOwnerGM002',name:'Second GM',isGM:true,active:true},player={id:'BrowserPlayer003',isGM:false,active:true},users=new Map([one,two,player].map(u=>[u.id,u])),listeners=new Map(),sent=[];
      const games=[one,two].map(user=>({user,world:{id:'browser-plot-world'},users:{activeGM:one,contents:[...users.values()],get:id=>users.get(id)},modules:new Map([['easy-plots',{socket:true}]]),socket:{on:(_c,f)=>listeners.set(user.id,f),off:()=>listeners.delete(user.id),emit:(_c,packet,opts)=>{sent.push({sender:user.id,recipients:opts.recipients});for(const id of opts.recipients)queueMicrotask(()=>listeners.get(id)?.(structuredClone(packet),user.id));}}}));
      const gmProvider=()=>t.createLocalGMContext({user:one,epoch:'browser-plot'},games[0].world.id),writer={state:{generation:0},assertEligible:gm=>{if(gm.userId!==one.id)throw Error('wrong writer');}},repo=new t.MemoryPartitionRepository(),domains=new t.NarrativeDomainStore({repository:repo,gmProvider});let base;
      const authority=new t.PlotAuthoringAuthority({domains,gmProvider,writer,gameInstance:games[0],readGraph:id=>base.getDraft(id)});base=new t.PersistentGraphRegistry({repository:repo,gmProvider,authoring:authority});const catalog=new t.ActiveTriggerCatalog({repository:repo,gmProvider}),registry=new t.IndexedGraphRegistry({registry:base,catalog}),appearance=new t.LiveGraphAppearance({domains,registry,gmProvider,writer}),service=new t.GMPlotAuthoring({registry,authority,domains,gameInstance:games[0],writer,gmProvider,appearance});
      const proof={worldId:games[0].world.id,socketSenderVerified:true,socketRecipientVerified:true,socketForgeryRejected:true,socketNoBroadcastVerified:true},server=new t.NativeGMAuthoringTransport({gameInstance:games[0],service,attestation:proof}),remote=new t.NativeGMAuthoringTransport({gameInstance:games[1],attestation:proof});server.start();remote.start();
      const owner=new t.GMPlotRegistryClient({invoke:(m,a)=>service.executeLocal(m,a)}),client=new t.GMPlotRegistryClient({invoke:(m,a)=>remote.request(m,a)}),g=t.makeEditableGraph({title:'First owner plot'}),other=t.makeEditableGraph({title:'Second owner plot'});await owner.saveDraft(g);await client.saveDraft(other);
      const model=new t.GraphEditorModel({registry:client,mode:'native'});await model.load(g.id);const Window=t.makeGraphEditorWindow(t.RenderStub,{initialView:'advanced',model,isGM:()=>two.isGM,openPlotAuthority:()=>{}}),editor=new Window();await editor.render();window.__plotAuthority={t,one,two,player,g,games,owner,client,base,catalog,authority,model,editor,server,remote,sent};
    }""")
    assert page.locator('[data-action="rename"]').is_disabled()
    assert page.locator('[data-action="publish"]').is_disabled()
    assert page.locator('[data-action="activate"]').is_disabled()
    page.evaluate("""async () => {const s=window.__plotAuthority,Window=s.t.makePlotAuthorityDeskWindow(s.t.RenderStub,{gameInstance:s.games[0],registry:s.owner,sourceGraphId:()=>s.g.id});s.desk=new Window();await s.desk.render();}""")
    page.locator('[data-action="inspect"]').click()
    page.wait_for_selector('[data-delegate="BrowserOwnerGM002"][data-right="edit"]')
    page.locator('[data-delegate="BrowserOwnerGM002"][data-right="edit"]').check()
    page.locator('[data-field="reason"]').fill('Second GM can edit this plot, with publication held by its owner')
    page.locator('[data-action="delegate"]').click()
    page.wait_for_function("document.querySelector('.ep-plot-authority')?.textContent.includes('Plot permissions saved')")
    page.evaluate("""async () => {const s=window.__plotAuthority;await s.client.inspectAuthority(s.g.id);await s.editor.render();}""")
    assert page.locator('[data-action="rename"]').is_enabled()
    assert page.locator('[data-action="publish"]').is_disabled()
    page.locator('[data-field="title"]').fill('Revised by the second GM')
    page.locator('[data-action="rename"]').click()
    page.locator('[data-action="save"]').click()
    page.wait_for_function("window.__plotAuthority.base.getDraft(window.__plotAuthority.g.id).then(g=>g.revision===2)")
    page.evaluate('window.__plotAuthority.desk.render()')
    page.locator('[data-action="inspect"]').click()
    page.wait_for_selector('[data-delegate="BrowserOwnerGM002"][data-right="publish"]')
    page.locator('[data-delegate="BrowserOwnerGM002"][data-right="publish"]').check()
    page.locator('[data-delegate="BrowserOwnerGM002"][data-right="activate"]').check()
    page.locator('[data-field="reason"]').fill('Delegate publication and activation after reviewing the revised plot')
    page.locator('[data-action="delegate"]').click()
    page.wait_for_function("document.querySelector('.ep-plot-authority')?.textContent.includes('Plot permissions saved')")
    page.evaluate("""async () => {const s=window.__plotAuthority;await s.client.inspectAuthority(s.g.id);await s.editor.render();}""")
    page.locator('[data-action="publish"]').click()
    page.wait_for_selector('.ep-notice')
    assert page.evaluate('window.__plotAuthority.base.getActivation(window.__plotAuthority.g.id)') is None
    page.locator('[data-action="activate"]').click()
    page.wait_for_function("window.__plotAuthority.base.getActivation(window.__plotAuthority.g.id).then(a=>a?.active===true)")
    assert page.evaluate('window.__plotAuthority.sent.every(p=>p.recipients.length===1&&!p.recipients.includes(window.__plotAuthority.player.id))')
    page.evaluate("""async () => {const s=window.__plotAuthority;s.canonicalBefore=await s.base.getPublished(s.g.id,2);const Window=s.t.makeLiveAppearanceWindow(s.t.RenderStub,{gameInstance:s.games[1],registry:s.client,sourceGraphId:()=>s.g.id});await new Window().render();}""")
    page.locator('[data-action="load-appearance"]').click()
    page.wait_for_selector('[data-field="nodes"]')
    page.locator('[data-field="title"]').fill('Live appearance title')
    page.locator('[data-field="nodes"]').fill(page.evaluate('JSON.stringify([{nodeId:window.__plotAuthority.g.rootNodeId,label:"<img src=x onerror=alert(1)>",layout:{x:240,y:80}}])'))
    page.locator('[data-action="save-appearance"]').click()
    page.wait_for_function("document.querySelector('.ep-live-appearance')?.textContent.includes('Live appearance saved')")
    assert page.locator('.ep-svg-node text').first.text_content()=='<img src=x onerror=alert(1)>'
    assert page.locator('img').count()==0
    assert page.evaluate('window.__plotAuthority.base.getPublished(window.__plotAuthority.g.id,2).then(g=>JSON.stringify(g)===JSON.stringify(window.__plotAuthority.canonicalBefore))')
    page.locator('[data-action="reset-appearance"]').click()
    page.wait_for_function("document.querySelector('.ep-svg-node text')?.textContent!=='<img src=x onerror=alert(1)>'")
    page.evaluate('window.__plotAuthority.server.stop();window.__plotAuthority.remote.stop()')
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,user={id:'BrowserEncounterGM',isGM:true,active:true},game={user,world:{id:'browser-encounter'},combats:new Map()},gmProvider=()=>t.createLocalGMContext({user,epoch:'encounter'},game.world.id),writer={assertEligible:()=>true},repo=new t.MemoryPartitionRepository(),domains=new t.NarrativeDomainStore({repository:repo,gmProvider}),base=new t.PersistentGraphRegistry({repository:repo,gmProvider}),catalog=new t.ActiveTriggerCatalog({repository:repo,gmProvider}),registry=new t.IndexedGraphRegistry({registry:base,catalog}),ledger=new t.DurableEventLedger({repository:repo,gmProvider}),router=new t.DurableReactiveRouter({registry,catalog,ledger,gmProvider}),providers=new t.EffectProviderRegistry(),journal=new t.MemoryOperationJournal();for(const p of t.createNarrativeCapabilityProviders({repository:repo,gmProvider}))providers.register(p);const state=t.createNarrativeStateProvider({repository:repo,gmProvider});providers.register(state);const reviews=new t.DurableProposalReview({repository:repo,ledger,registry,providers,journal,gmProvider}),service=new t.PersistentEncounterClosures({domains,reviews,ledger,router,gmProvider,writer,gameInstance:game});
      const source=new t.GraphEditorModel({registry});source.newGraph('Native encounter outcomes');source.setRootTriggerType('core.trigger.document-event');source.updateSelected({eventType:'foundry.combat.deleted',sourceKindsJSON:'["native-hook"]'});for(const outcome of ['victory','escape']){const id=source.addNode('core.encounter.outcome');source.updateSelected({payloadJSON:JSON.stringify({scope:'world',encounterId:'ep:encounter:browser_harbor001',resolutionId:`ep:resolution:browser_${outcome}001`,plotId:source.graph.id,outcome,expectedRevision:null})});source.connect(source.graph.rootNodeId,id);}await source.save();await source.publish();await source.activate(1);
      const target=new t.GraphEditorModel({registry});target.newGraph('Selected closure consequences');target.setRootTriggerType('core.trigger.encounter-closed');const effect=target.addNode('core.effect.proposal');target.updateSelected({providerId:state.id,payloadJSON:JSON.stringify({key:'selected-encounter-closed',value:true})});target.connect(target.graph.rootNodeId,effect);await target.save();await target.publish();await target.activate(1);
      const event=t.normalizeFoundryHook('deleteCombat',[{documentName:'Combat',uuid:'Combat.abcdefghijklmnop'},{},user.id],{randomId:()=> 'browser_combat_delete001'});await router.ingest(event);const entry=await ledger.get(event.id),p=entry.proposals.find(p=>p.payload.outcome==='victory');await reviews.decide(event.id,p.operationId,{approve:true});await reviews.execute(event.id,p.operationId);const Window=t.makeEncounterClosureDeskWindow(t.RenderStub,{gameInstance:game,service});await new Window().render();window.__encounterClosure={event,p,ledger,reviews,state,service,user,registry,router,providers,gmProvider,writer,game,journal,domains,repo};
    }""")
    page.locator('[data-field="event"]').fill(page.evaluate('window.__encounterClosure.event.id'))
    page.locator('[data-field="operation"]').fill(page.evaluate('window.__encounterClosure.p.operationId'))
    page.locator('[data-action="preview"]').click()
    page.wait_for_selector('.ep-encounter-closure pre')
    assert page.locator('[data-action="select"]').is_disabled()
    page.locator('[data-field="confirm"]').check()
    page.locator('[data-action="select"]').click()
    page.wait_for_function("document.querySelector('.ep-encounter-closure')?.textContent.includes('Canonical outcome selected')")
    assert page.evaluate("window.__encounterClosure.state.get({key:'selected-encounter-closed',value:true})") is None
    page.locator('[data-action="emit"]').click()
    page.wait_for_function("document.querySelector('.ep-encounter-closure')?.textContent.includes('review-required')")
    page.evaluate("""async () => {const s=window.__encounterClosure,selection=await s.service.read({nativeCombatUuid:'Combat.abcdefghijklmnop'});s.closureEventId=selection.data.eventId;const entry=await s.ledger.get(s.closureEventId);if(entry.proposals.length!==1||entry.event.payload.outcome!=='victory')throw Error('Wrong closure outcome');const Window=window.__easyPlotsTest.makeEventReviewWindow(window.__easyPlotsTest.RenderStub,{ledger:s.ledger,reviews:s.reviews,gameInstance:{user:s.user}});await new Window().loadEvent(s.closureEventId);}""")
    page.locator('[data-action="approve-effect"]').click()
    page.wait_for_selector('[data-action="execute-effect"]')
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_function("window.__encounterClosure.state.get({key:'selected-encounter-closed',value:true}).then(r=>r?.value===true)")
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,user={id:'BrowserIdentityGM',isGM:true},game={user,world:{id:'browser-identities'}},gmProvider=()=>t.createLocalGMContext({user,epoch:'identity'},game.world.id),repository=new t.MemoryPartitionRepository(),domains=new t.NarrativeDomainStore({repository,gmProvider}),writer={assertEligible:()=>true};
      await domains.save({type:'narrative-entity',scope:'world',id:'ep:entity:browser_contact001',sourceEventId:'ep:event:browser_identity001',data:{entityId:'ep:entity:browser_contact001',name:'Mara Voss',kind:'character',status:'active'}});await domains.save({type:'persona',scope:'world',id:'ep:persona:browser_mask001',sourceEventId:'ep:event:browser_identity002',data:{personaId:'ep:persona:browser_mask001',entityId:'ep:entity:browser_contact001',name:'<img src=x onerror=alert(1)>',status:'retired'}});
      const identities=new t.PersistentNarrativeIdentities({domains,gmProvider,writer,gameInstance:game,readBinding:async()=>null}),knowledge=new t.PersistentKnowledgeLedger({domains}),knowledgePropagation=new t.PersistentKnowledgePropagation({domains,knowledge}),factionAgendas=new t.PersistentFactionAgenda({domains}),Window=t.makeGMKnowledgeFactionDeskWindow(t.RenderStub,{gameInstance:game,knowledgePropagation,factionAgendas,identities});await new Window().render();
    }""")
    page.locator('[data-field="mode"]').select_option('identity-inspect')
    page.locator('[data-field="scenario"]').fill('{"scope":"world","personaId":"ep:persona:browser_mask001"}')
    page.locator('[data-action="preview"]').click()
    page.wait_for_function("document.querySelector('.ep-society-desk .ep-lab-output')?.textContent.includes('retired')")
    assert page.locator('.ep-society-desk .ep-lab-output').inner_text().find('Mara Voss')>=0
    assert page.locator('img').count()==0
    assert page.locator('[data-action="commit"]').count()==0
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,s=window.__encounterClosure,actions=new t.NarrativeActionAPI({providers:s.providers,gmProvider:s.gmProvider,writer:s.writer}),contract=await actions.register({id:'example.browser.mark',version:'1.0.0',label:'Mark browser action',targetProviderId:'narrative.set-state',targetVersion:'1.0.0',constants:{scope:'browser-actions',key:'approved-mark'},inputs:{value:{type:'boolean',default:true}}}),model=new t.GraphEditorModel({registry:s.registry});model.newGraph('Declared third-party action');model.setRootTriggerType('core.trigger.manual');model.updateSelected({eventType:'narrative.browser-action'});const node=model.addNode('core.effect.proposal');model.updateSelected({providerId:contract.id,payloadJSON:JSON.stringify(contract.defaultPayload)});model.connect(model.graph.rootNodeId,node);await model.save();await model.publish();await model.activate(1);const gateway=new t.GMManualEventGateway({router:s.router,ledger:s.ledger,gmProvider:s.gmProvider,writer:s.writer,worldId:s.game.world.id}),submitted=await gateway.emit({requestId:'ep:request:browser_action001',eventType:'narrative.browser-action',payload:{}});s.actionContract=contract;s.actionEventId=submitted.eventId;const Window=t.makeEventReviewWindow(t.RenderStub,{ledger:s.ledger,reviews:s.reviews,gameInstance:{user:s.user}});await new Window().loadEvent(submitted.eventId);
    }""")
    assert page.evaluate("window.__encounterClosure.state.get({scope:'browser-actions',key:'approved-mark',value:true})") is None
    page.locator('[data-action="approve-effect"]').click()
    page.wait_for_selector('[data-action="execute-effect"]')
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_function("window.__encounterClosure.state.get({scope:'browser-actions',key:'approved-mark',value:true}).then(r=>r?.value===true)")
    assert page.evaluate("window.__encounterClosure.state.get({scope:'world',key:'approved-mark',value:true})") is None
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,user={id:'BrowserRollPolicyGM',isGM:true},game={user,world:{id:'browser-roll-policy'},system:{id:'browser-system',version:'1.0.0'}},gmProvider=()=>t.createLocalGMContext({user,epoch:'roll-policy'},game.world.id),domains=new t.NarrativeDomainStore({repository:new t.MemoryPartitionRepository(),gmProvider}),service=new t.RollSystemPolicies({domains,gmProvider,writer:{assertEligible:()=>true},gameInstance:game,coreBuild:'14.369'}),Window=t.makeRollSystemPolicyWindow(t.RenderStub,{gameInstance:game,service});window.__rollPolicy={game,service};await new Window().render();
    }""")
    page.locator('[data-action="register-policy"]').click()
    page.wait_for_function("document.querySelector('.ep-roll-policy')?.textContent.includes('Declaration registered')")
    page.locator('[data-field="reason"]').fill('Reviewed this exact system and build for authored d20 adjudication')
    page.locator('[data-action="select-policy"]').click()
    page.wait_for_function("document.querySelector('.ep-roll-policy')?.textContent.includes('Roll policy selection saved')")
    assert page.evaluate('window.__rollPolicy.service.stamp().then(s=>s.adapterId)')=='example.system-d20'
    page.evaluate("window.__rollPolicy.game.system.version='2.0.0'")
    assert page.evaluate("window.__rollPolicy.service.stamp().then(()=>false,e=>e.code==='ROLL_SYSTEM_CHANGED')")
    page.locator('[data-action="refresh-policy"]').click()
    page.wait_for_function("document.querySelector('.ep-roll-policy')?.textContent.includes('browser-system 2.0.0')")
    page.locator('[data-field="policy"]').select_option('easy-plots.authored-d20')
    page.locator('[data-field="reason"]').fill('Explicitly select system-neutral authored checks after the system update')
    page.locator('[data-action="select-policy"]').click()
    page.wait_for_function("document.querySelector('.ep-roll-policy')?.textContent.includes('Roll policy selection saved')")
    assert page.evaluate('window.__rollPolicy.service.stamp().then(s=>s.adapterId)')=='easy-plots.authored-d20'
    page.evaluate("""async () => {
      const t=window.__easyPlotsTest,s=window.__encounterClosure,created=[],maps={Actor:new Map(),Item:new Map()};s.game.system={documentTypes:{Actor:['npc'],Item:['loot']}};
      for(const kind of ['Actor','Item']){s.game[kind==='Actor'?'actors':'items']={get:id=>maps[kind].get(id),documentClass:{createDocuments:async rows=>rows.map(row=>{const d=structuredClone(row),doc={id:d._id,type:d.type,name:d.name,ownership:d.ownership,flags:d.flags,getFlag:(scope,key)=>d.flags?.[scope]?.[key]};maps[kind].set(doc.id,doc);created.push(kind);return doc;})}};s.providers.register(t.createFoundryActorItemShellProvider({kind,repository:s.repo,gmProvider:s.gmProvider,gameInstance:s.game,writer:s.writer}));}
      const service=new t.OrderedNativeBatches({domains:s.domains,providers:s.providers,journal:s.journal,gmProvider:s.gmProvider,writer:s.writer});s.providers.register(t.createNativeBatchProvider({service}));const model=new t.GraphEditorModel({registry:s.registry});model.newGraph('Ordered native resource batch');model.setRootTriggerType('core.trigger.manual');model.updateSelected({eventType:'narrative.browser-native-batch'});const node=model.addNode('core.resource.ordered-batch'),id='ep:batch:browser_native_resources001',plan={scope:'world',id,graphId:model.graph.id,sourceEventId:'ep:event:browser_batch_prepare001',steps:['Actor','Item'].map(kind=>({providerId:`narrative.materialize-${kind.toLowerCase()}-shell`,providerVersion:'1.0.0',payload:{scope:'world',resourceId:`ep:resource:browser_batch_${kind.toLowerCase()}001`,sourceGraphId:model.graph.id,documentType:kind==='Actor'?'npc':'loot',visibility:'gm-only',expectedRevision:null}}))};
      const Window=t.makeNativeBatchWindow(t.RenderStub,{gameInstance:s.game,service,sourceGraphId:()=>model.graph.id,configureDraft:async saved=>{model.selectNode(node);model.updateSelected({payloadJSON:JSON.stringify({scope:saved.scope,batchId:saved.id,expectedBatchRevision:saved.revision,batchFingerprint:saved.data.fingerprint})});model.connect(model.graph.rootNodeId,node);}});window.__nativeBatch={service,model,node,created,maps,plan,t,s};await new Window().render();
    }""")
    page.locator('[data-field="batch-id"]').fill('ep:batch:browser_native_resources001')
    page.locator('[data-field="plan"]').fill(page.evaluate('JSON.stringify(window.__nativeBatch.plan)'))
    page.locator('[data-action="prepare-batch"]').click()
    page.wait_for_function("document.querySelector('.ep-native-batch')?.textContent.includes('Plan saved')")
    assert page.evaluate('window.__nativeBatch.created.length')==0
    page.locator('[data-action="configure-batch"]').click()
    page.wait_for_function("document.querySelector('.ep-native-batch')?.textContent.includes('Batch node configured')")
    page.evaluate("""async () => {const b=window.__nativeBatch,Window=b.t.makeGraphEditorWindow(b.t.RenderStub,{initialView:'advanced',model:b.model,isGM:()=>true});await new Window().render();}""")
    page.locator('[data-action="save"]').click()
    page.wait_for_function('window.__nativeBatch.model.graph.revision===1&&!window.__nativeBatch.model.state.dirty')
    page.locator('[data-action="publish"]').click()
    page.wait_for_function("document.querySelector('.ep-notice')?.textContent.includes('Published immutable snapshot')")
    page.locator('[data-action="activate"]').click()
    page.wait_for_function('window.__nativeBatch.model.activation().then(a=>a?.active===true)')
    assert page.evaluate('window.__nativeBatch.created.length')==0
    page.evaluate("""async () => {const b=window.__nativeBatch,s=b.s,gateway=new b.t.GMManualEventGateway({router:s.router,ledger:s.ledger,gmProvider:s.gmProvider,writer:s.writer,worldId:s.game.world.id}),submitted=await gateway.emit({requestId:'ep:request:browser_native_batch001',eventType:'narrative.browser-native-batch',payload:{}});b.eventId=submitted.eventId;const Window=b.t.makeEventReviewWindow(b.t.RenderStub,{ledger:s.ledger,reviews:s.reviews,gameInstance:s.game,effectPreview:async proposal=>{const detail=await b.service.preview(proposal.payload);return {...detail,canExecute:!detail.run};}});await new Window().loadEvent(submitted.eventId);}""")
    page.locator('.ep-effect-preview summary').click()
    assert 'narrative.materialize-actor-shell' in page.locator('.ep-batch-plan-preview').inner_text()
    assert 'narrative.materialize-item-shell' in page.locator('.ep-batch-plan-preview').inner_text()
    page.locator('[data-action="approve-effect"]').click()
    page.wait_for_selector('[data-action="execute-effect"]')
    assert page.evaluate('window.__nativeBatch.created.length')==0
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_function("window.__nativeBatch.service.inspect({id:window.__nativeBatch.plan.id}).then(d=>d.run?.data.state==='completed')")
    assert page.evaluate('window.__nativeBatch.created')==['Actor','Item']
    assert page.evaluate('window.__nativeBatch.service.inspect({id:window.__nativeBatch.plan.id}).then(d=>d.steps.every(s=>s.state==="completed"&&s.verification==="confirmed"))')
    page.evaluate("""async () => {
      const b=window.__nativeBatch,s=b.s,{ResourceManifests}=await import('/src/orchestration/resource-manifests.mjs'),{createResourceManifestProvider}=await import('/src/runtime/resource-manifest-provider.mjs'),{makeResourceManifestWindow}=await import('/src/ui/resource-manifest-desk.mjs'),{configureResourceActivationBranch}=await import('/src/editor/resource-activation-branch.mjs');
      b.manifests=new ResourceManifests({domains:s.domains,batches:b.service,providers:s.providers,registry:s.registry,gmProvider:s.gmProvider,writer:s.writer,gameInstance:s.game,router:s.router,ledger:s.ledger});s.providers.register(createResourceManifestProvider({service:b.manifests}));
      const Window=makeResourceManifestWindow(b.t.RenderStub,{gameInstance:s.game,service:b.manifests,targetGraphId:()=>b.model.graph.id,configureDraft:manifest=>configureResourceActivationBranch(b.model,manifest)});b.lifecycleDesk=new Window();await b.lifecycleDesk.render();
    }""")
    page.locator('[data-field="id"]').fill('ep:manifest:browser_native_resources001')
    page.locator('[data-field="batchId"]').fill('ep:batch:browser_native_resources001')
    page.locator('[data-action="prepare"]').click()
    page.wait_for_function("document.querySelector('#test-app')?.textContent.includes('State: planned; integrity: verified')")
    assert page.evaluate('window.__nativeBatch.created.length')==2
    page.locator('[data-action="materialized"]').click()
    page.wait_for_function("document.querySelector('#test-app')?.textContent.includes('State: materialized')")
    page.locator('[data-action="configure"]').click()
    page.wait_for_function("window.__nativeBatch.model.graph.nodes.some(n=>n.typeId==='core.resource.activate-manifest')")
    page.evaluate("""async()=>{const b=window.__nativeBatch;await b.model.save();await b.model.publish({acknowledgeWarnings:true});await b.model.activate(2);await b.lifecycleDesk.render();}""")
    page.locator('[data-action="request"]').click()
    page.wait_for_function("document.querySelector('#test-app')?.textContent.includes('open Event Review')")
    assert page.evaluate("window.__nativeBatch.manifests.inspect({id:'ep:manifest:browser_native_resources001'}).then(r=>r.effectiveState)")=='materialized'
    page.evaluate("""async()=>{const b=window.__nativeBatch,s=b.s,row=await b.manifests.read({id:'ep:manifest:browser_native_resources001'}),sent=await b.manifests.requestActivation({id:row.id,expectedRevision:row.revision},{approved:true});const Window=b.t.makeEventReviewWindow(b.t.RenderStub,{ledger:s.ledger,reviews:s.reviews,gameInstance:s.game});await new Window().loadEvent(sent.eventId);}""")
    page.locator('[data-action="approve-effect"]').click()
    page.wait_for_selector('[data-action="execute-effect"]')
    page.locator('[data-action="execute-effect"]').click()
    page.wait_for_function("window.__nativeBatch.manifests.inspect({id:'ep:manifest:browser_native_resources001'}).then(r=>r.effectiveState==='active')")
    assert page.evaluate('window.__nativeBatch.created.length')==2
    page.evaluate('window.__mixedTest.publication.serverKeys.stop();window.__mixedTest.publication.playerKeys.stop()')
    assert not errors,errors
    print('PASS: Chromium DOM harness — full ordered native batch plan preview, separate publication/approval and Actor/Item writes; system policy, action API, live appearance, identities, closure, co-GM grants; all prior workflows')
    browser.close()
