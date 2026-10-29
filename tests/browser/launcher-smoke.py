"""Actual bootstrap -> Foundry v14 control/settings contract -> visible windows.
Uses local Chromium and an ApplicationV2 DOM adapter; no live Foundry claim.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
def local_asset(route):
    url=urlparse(route.request.url)
    path=(ROOT/unquote(url.path).lstrip('/')).resolve()
    if url.hostname!='easy-plots.test' or not path.is_relative_to(ROOT) or not path.is_file():
        route.abort();return
    route.fulfill(content_type={'.mjs':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css'}.get(path.suffix,'application/octet-stream'),body=path.read_bytes())
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',local_asset)
    page.goto('https://easy-plots.test/tests/browser/launcher-harness.html')
    page.wait_for_function('window.__ready===true')
    assert page.evaluate('window.__launcherTest.existedBeforeReady')
    page.locator('[data-launcher="main"]').click()
    page.wait_for_selector('.ep-campaign-workspace')
    assert page.locator('[data-action="new-plot"]').is_disabled()
    page.get_by_role('button',name='World setup',exact=True).click()
    page.wait_for_selector('input[name="vault-passphrase"]')
    page.locator('input[name="vault-passphrase"]').fill('Browser campaign password 123')
    page.locator('input[name="vault-confirmation"]').fill('Browser campaign password 123')
    page.get_by_role('button',name='Create private world storage',exact=True).click()
    page.wait_for_function('document.querySelector(".ep-campaign-workspace")?.textContent.includes("World storage connected")',timeout=30000)
    page.locator('[data-action="new-plot"]').click()
    page.wait_for_selector('.ep-graph-canvas')
    page.locator('[data-field="title"]').fill('Browser persistent plot')
    page.locator('[data-action="rename"]').click()
    page.locator('[data-action="save"]').click()
    page.wait_for_function('document.querySelector(".ep-notice")?.textContent.includes("saved successfully")',timeout=30000)
    page.locator('[data-launcher="settings"]').click()
    page.wait_for_selector('.ep-workspace-card')
    assert 'Browser persistent plot' in page.locator('.ep-campaign-workspace').inner_text()
    page.get_by_role('button',name='Open plot',exact=True).click()
    page.wait_for_selector('.ep-graph-canvas')
    assert page.locator('[data-field="title"]').input_value()=='Browser persistent plot'
    page.evaluate("""async()=>{game.user={id:'player-browser',isGM:false};game.actors.contents=[{id:'OwnedActor001',name:'Mira',isOwner:true}];const controls={};for(const fn of window.__launcherTest.events.get('getSceneControlButtons'))fn(controls);await controls['easy-plots'].onChange(null,true);}""")
    page.wait_for_selector('select[data-field="character"]')
    assert page.locator('select[data-field="character"] option').inner_text()=='Mira'
    page.locator('[data-tab="Investigations"]').click()
    assert 'Nothing has been shared' in page.locator('.ep-campaign-workspace').inner_text()
    assert 'Browser persistent plot' not in page.locator('.ep-campaign-workspace').inner_text()
    assert not page.evaluate('window.__launcherTest.menus[0].restricted')
    assert errors==[],errors
    browser.close()
    print('PASS: actual bootstrap→toolbar/setup→encrypted native draft save→GM list/reopen→player workspace with owned Actor and no GM plot leakage')
