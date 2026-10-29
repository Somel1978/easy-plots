"""Composed UX regression: real bootstrap/services, synthetic Foundry documents.
This is local Chromium evidence, not a native Foundry acceptance claim.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=ROOT.parent/'artifacts'/'easy-plots-ui-system'
OUTPUT.mkdir(parents=True,exist_ok=True)

def asset(route):
    url=urlparse(route.request.url);path=(ROOT/unquote(url.path).lstrip('/')).resolve()
    if url.hostname!='easy-plots.test' or not path.is_relative_to(ROOT) or not path.is_file():
        route.abort();return
    route.fulfill(content_type={'.mjs':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css'}.get(path.suffix,'application/octet-stream'),body=path.read_bytes())

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1200,'height':920});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',asset)
    page.goto('https://easy-plots.test/tests/browser/launcher-harness.html')
    page.wait_for_function('window.__ready===true')
    page.locator('[data-launcher="main"]').click()
    page.locator('[data-route="settings"]').click()
    page.get_by_role('button',name='World setup',exact=True).click()
    page.locator('input[name="vault-passphrase"]').fill('UX campaign password 123')
    page.locator('input[name="vault-confirmation"]').fill('UX campaign password 123')
    page.get_by_role('button',name='Create private world storage',exact=True).click()
    page.wait_for_function('document.querySelector(".ep-campaign-workspace")?.textContent.includes("World storage connected")',timeout=30000)
    page.locator('.ep-shell').screenshot(path=str(OUTPUT/'gm-campaign.png'))
    page.locator('[data-action="new-plot"]').click()
    page.wait_for_selector('.ep-plot-builder')

    def action(name):
        page.locator(f'[data-action="{name}"]').click()
        page.wait_for_function('!document.querySelector(".ep-plot-builder")?.hasAttribute("aria-busy")',timeout=30000)
        assert page.locator('.ep-error').count()==0,page.locator('.ep-error').all_text_contents()

    page.locator('[data-field="title"]').fill('A usable story flow')
    action('save') # Saving includes the title: no separate Rename action.
    action('browse') # Reproduces the reported strict-JSON command failure.
    assert 'A usable story flow' in page.locator('.ep-plot-builder').inner_text()
    action('close-browser')
    action('show-library')
    page.locator('[data-step-category="flow"]').click()
    page.locator('[data-step-type="core.condition"]').click()
    action('add-node')
    page.locator('[data-field="config.condition-left"]').select_option('event.type')
    page.locator('[data-field="config.condition-type"]').select_option('string')
    page.locator('[data-field="config.condition-value"]').fill('narrative')
    page.locator('[data-field="config.condition-op"]').select_option('contains')
    action('save') # Structured, typed node fields are saved without JSON.
    page.get_by_text('Connect story steps',exact=True).click()
    action('connect')
    action('save');action('preview');action('publish');action('activate')
    assert 'Plot activated' in page.locator('.ep-notice').all_text_contents()[0]
    assert 'core.trigger' not in page.locator('.ep-plot-builder').inner_text()
    assert 'GM_COMMAND_INVALID' not in page.locator('.ep-plot-builder').inner_text()
    assert page.locator('textarea').count()==0
    assert page.evaluate('Array.from(document.querySelectorAll(".ep-plot-builder input,.ep-plot-builder select")).every(n=>n.closest("label")||n.getAttribute("aria-label"))')
    page.locator('.ep-shell').screenshot(path=str(OUTPUT/'gm-plot-editor.png'))
    assert page.locator('.ep-app-header').count()==1
    assert page.locator('.ep-step-inspector').bounding_box()['x']>page.locator('.ep-canvas-frame').bounding_box()['x']
    action('show-library')
    page.locator('[data-step-category="knowledge"]').click()
    assert 0<page.locator('[data-step-type]').count()<=8
    page.locator('.ep-shell').screenshot(path=str(OUTPUT/'step-discovery.png'))
    page.locator('[data-library] > summary').click()
    page.locator('[data-route="campaign"]').click()
    page.get_by_role('button',name='Open plot',exact=True).wait_for()
    assert 'A usable story flow' in page.locator('.ep-plot-featured').inner_text()
    page.locator('.ep-shell').screenshot(path=str(OUTPUT/'gm-workspace-saved.png'))
    page.get_by_role('button',name='Open plot',exact=True).click()

    # Preserve uncommitted form input through navigation and Back.
    page.locator('[data-field="title"]').fill('Pending across navigation')
    page.locator('[data-route="campaign"]').click()
    page.locator('[data-route="world"]').click()
    page.wait_for_selector('[data-panel="easy-plots-world"]')
    page.locator('[data-action="workspace-back"]').click()
    page.get_by_role('button',name='Continue editing',exact=True).click()
    page.wait_for_selector('.ep-plot-builder')
    assert page.locator('[data-field="title"]').input_value()=='Pending across navigation'
    page.locator('[data-route="campaign"]').click()
    page.get_by_role('button',name='Continue editing',exact=True).click()
    page.wait_for_selector('.ep-plot-builder')
    assert page.locator('[data-field="title"]').input_value()=='Pending across navigation'
    action('save')
    page.get_by_text('Plot options',exact=True).click()
    action('discard') # Clears the model; the next open must read persisted storage.
    page.locator('[data-route="campaign"]').click()
    page.get_by_role('button',name='Open plot',exact=True).click()
    page.wait_for_selector('.ep-plot-builder')
    assert page.locator('[data-field="title"]').input_value()=='Pending across navigation'
    assert page.locator('.ep-svg-node').count()==2
    page.locator('.ep-shell-outline button').filter(has_text='Check a condition').click()
    page.wait_for_selector('[data-field="config.condition-value"]')
    assert page.locator('[data-field="config.condition-value"]').input_value()=='narrative'
    assert page.locator('[data-field="config.condition-type"]').input_value()=='string'
    assert page.locator('[data-field="config.condition-op"]').input_value()=='contains'

    # Small native-window scrolling, independent of viewport height.
    page.set_viewport_size({'width':560,'height':780})
    page.evaluate('document.querySelector("#apps").style.height="360px"')
    assert page.evaluate('(()=>{const n=document.querySelector(".ep-shell-content");return n.scrollHeight>n.clientHeight&&getComputedStyle(n).overflowY==="auto"})()')
    assert page.evaluate('(()=>{const n=document.querySelector(".ep-shell");return n.scrollWidth<=n.clientWidth+1})()')
    page.locator('.ep-shell').screenshot(path=str(OUTPUT/'gm-narrow-window.png'))

    # The same native host becomes a player workspace with only audience navigation.
    page.set_viewport_size({'width':1200,'height':920})
    page.evaluate('document.querySelector("#apps").style.height="780px"')
    page.evaluate("""async()=>{game.user={id:'ux-player',isGM:false};game.actors.contents=[{id:'OwnedActor001',name:'Mira',isOwner:true},{id:'HiddenActor001',name:'GM character',isOwner:false}];await game.modules.get('easy-plots').api.openPlayerWorkspace();}""")
    page.wait_for_selector('select[data-field="character"]')
    assert page.locator('[data-field="character"] option').all_text_contents()==['Mira']
    assert page.locator('[data-route="editor"]').count()==0
    assert 'Pending across navigation' not in page.locator('.ep-shell').inner_text()
    page.locator('[data-route="player-investigations"]').click()
    page.wait_for_function('document.querySelector(".ep-campaign-workspace h3")?.textContent==="Investigations"')
    assert 'Nothing has been shared' in page.locator('.ep-campaign-workspace').inner_text()
    page.locator('[data-route="notices"]').first.click()
    page.wait_for_function('document.querySelector(".ep-campaign-workspace h3")?.textContent==="Notifications"')
    assert 'No received updates' in page.locator('.ep-campaign-workspace').inner_text()
    page.locator('.ep-shell').screenshot(path=str(OUTPUT/'player-workspace.png'))
    assert page.evaluate('window.__launcherTest.nativeRendered.size')==1
    assert page.locator('.ep-shell').count()==1
    assert errors==[],errors
    assert page.evaluate('window.__launcherTest.errors')==[],page.evaluate('window.__launcherTest.errors')
    browser.close()
    print('PASS: one native window; setup; title save; strict draft browsing; typed condition and connection; publish/activate; Back and edit retention; persisted reopen; 360px scrolling; player ownership/navigation/inline notices; no GM leakage or browser errors')
