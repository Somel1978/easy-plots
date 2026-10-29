"""Focused local Chromium authoring/convergence/diagnostic proof; no Foundry."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


def local_asset(route):
    url = urlparse(route.request.url)
    path = (ROOT / unquote(url.path).lstrip('/')).resolve()
    if url.hostname != 'easy-plots.test' or not path.is_relative_to(ROOT):
        route.abort()
    elif not path.is_file():
        route.fulfill(status=404, body='Not found')
    else:
        route.fulfill(status=200, content_type='text/javascript' if path.suffix == '.mjs' else 'text/html', body=path.read_bytes())


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/*', local_asset)
    page.goto('https://easy-plots.test/tests/browser/editor-harness.html')
    result = page.evaluate("""async () => {
      const [{MemoryPartitionRepository},{createLocalGMContext},{PersistentGraphRegistry},
        {ActiveTriggerCatalog,IndexedGraphRegistry},{GraphEditorModel},{DurableEventLedger},
        {DurableReactiveRouter},{appendConvergenceDiagnostics}] = await Promise.all([
        import('/src/storage/memory.mjs'),import('/src/security/authority.mjs'),
        import('/src/graph/persistent-registry.mjs'),import('/src/runtime/active-subscriptions.mjs'),
        import('/src/editor/model.mjs'),import('/src/runtime/event-ledger.mjs'),
        import('/src/runtime/durable-router.mjs'),import('/src/ui/convergence-diagnostics.mjs')]);
      const repository=new MemoryPartitionRepository(),gm=createLocalGMContext({user:{id:'gm_browser_cycle001',isGM:true}},'world'),gmProvider=()=>gm;
      const catalog=new ActiveTriggerCatalog({repository,gmProvider}),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry({repository,gmProvider})}),ledger=new DurableEventLedger({repository,gmProvider});
      const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider}),editor=new GraphEditorModel({registry});
      editor.newGraph('Browser bounded convergence');const gate=editor.addNode('core.flow.converge');
      editor.updateSelected({payloadJSON:JSON.stringify({initialValue:0,step:1,targetValue:5,maxPasses:2})});
      const body=editor.addNode('core.branch.parallel'),effect=editor.addNode('core.effect.proposal');
      editor.connect(editor.graph.rootNodeId,gate);editor.connect(gate,body,{sourcePortId:'repeat'});editor.connect(body,gate);editor.connect(body,effect);editor.connect(gate,effect,{sourcePortId:'converged'});
      await editor.save();const published=await editor.publish();await editor.activate(published.publishedVersion);
      const event={id:'ep:event:browser_bounded001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}};
      const accepted=await router.ingest(event),row=await ledger.get(event.id);
      const box=document.createElement('section');document.body.append(box);appendConvergenceDiagnostics(box,{event:row,cascade:{allowed:false,code:'CASCADE_DEPTH_BUDGET',eventId:'<img src=x onerror="window.__injected=true">',effectsExecuted:0}});
      return {status:accepted.status,proposals:row.proposals.length,diagnostic:row.evaluations[0].trace.find(t=>t.status==='convergence-budget-exhausted')?.diagnostic,rendered:box.textContent,images:box.querySelectorAll('img').length,injected:window.__injected===true};
    }""")
    assert result['status'] == 'evaluated', result
    assert result['proposals'] == 0, result
    assert result['diagnostic']['passes'] == 2, result
    assert 'Convergence and causal budgets' in result['rendered'], result
    assert 'CASCADE_DEPTH_BUDGET' in result['rendered'], result
    assert result['images'] == 0 and not result['injected'], result
    assert not errors, errors
    browser.close()
    print('Chromium convergence authoring, published budget exit and safe GM diagnostics PASS')
