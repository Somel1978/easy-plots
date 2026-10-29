"""Focused Chromium ADR-033 workflow; all assets are local, no Foundry world."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

def local_asset(route):
    url = urlparse(route.request.url)
    path = (ROOT / unquote(url.path).lstrip('/')).resolve()
    if url.hostname != 'easy-plots.test' or not path.is_relative_to(ROOT):
        route.abort()
        return
    if not path.is_file():
        route.fulfill(status=404, body='Not found')
        return
    mime = {'.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html'}.get(path.suffix, 'application/octet-stream')
    route.fulfill(status=200, content_type=mime, body=path.read_bytes())

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1120, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/*', local_asset)
    page.goto('https://easy-plots.test/tests/browser/spatial-harness.html', wait_until='load')
    page.wait_for_function('window.__ready === true', timeout=15000)
    assert page.evaluate('isSecureContext && typeof crypto.subtle.digest === "function"')
    ids = page.evaluate('window.__spatialTest.ids')
    atlas_id = 'ep:atlas:chromium_selected_region'
    page.locator('.ep-spatial-desk input[data-field="region"]').fill(ids['region'])
    page.locator('button[data-action="inspect"]').click()
    page.wait_for_function('document.querySelector(".ep-spatial-desk")?.textContent.includes("3 direct children")')
    assert page.locator('textarea[data-field="region-manifest"]').input_value().find(ids['secret']) >= 0
    page.locator('input[data-field="atlas"]').fill(atlas_id)
    page.locator('textarea[data-field="observer-view"]').fill(page.evaluate('JSON.stringify(window.__spatialTest.draft)'))
    page.locator('button[data-action="save-view"]').click()
    page.wait_for_function('document.querySelector(".ep-spatial-desk")?.textContent.includes("Current observer projection loaded.")')
    stored = page.evaluate('(id) => window.__spatialTest.readAtlas(id)', atlas_id)
    assert stored['revision'] == 1 and stored['data']['observerId'] == ids['observer']
    gm_map = page.locator('.ep-spatial-map')
    assert 'Public harbor' in gm_map.text_content() and 'SECRET LAIR' not in gm_map.text_content()
    assert gm_map.locator('img').count() == 0
    assert page.evaluate('window.__spatialInjected === undefined')
    page.evaluate('window.__spatialTest.showPlayer()')
    assert page.locator('.ep-spatial-desk').count() == 0
    page.locator('.ep-player-atlas input[data-field="atlas"]').fill(atlas_id)
    page.locator('.ep-player-atlas input[data-field="actor"]').fill('spatial-browser-Actor-001')
    page.get_by_role('button', name='Open known places', exact=True).click()
    page.wait_for_selector('.ep-player-atlas .ep-spatial-map')
    player_map = page.locator('.ep-player-atlas .ep-spatial-map')
    visible = player_map.text_content()
    assert 'Public harbor' in visible and 'Coastal road' in visible
    assert '<img src=x onerror=' in visible and player_map.locator('img').count() == 0
    for protected in [ids['region'], ids['dock'], ids['tower'], ids['secret'], ids['secretRoad'], ids['observer'], 'SECRET LAIR', 'Rumored passage', 'Private truth']:
        assert protected not in visible, protected
    player_map.locator('select').nth(0).select_option('ep:known:spatial_dock')
    player_map.locator('select').nth(1).select_option('ep:known:spatial_chromium_hostile')
    player_map.get_by_role('button', name='Find known route', exact=True).click()
    assert player_map.locator('p').last.text_content() == 'Coastal road'
    denied = page.evaluate('''async id => {
      try { await window.__spatialTest.stranger.request({atlasId:id, actorId:'spatial-browser-Actor-001'}); return 'unexpected'; }
      catch(error) { return error.code; }
    }''', atlas_id)
    assert denied == 'SPATIAL_UNAVAILABLE'
    traffic = page.evaluate('window.__spatialTest.traffic')
    assert all(len(item['to']) == 1 for item in traffic)
    public = [item for item in traffic if item['packet'].get('state') == 'ready']
    assert len(public) == 1 and public[0]['to'] == ['spatial-browser-player-001']
    response = str(public[0]['packet']['value'])
    for protected in [ids['region'], ids['secret'], ids['observer'], 'SECRET LAIR', 'Rumored passage', 'receiptId', 'revision']:
        assert protected not in response, protected
    assert not errors, errors
    browser.close()
    print('PASS: Chromium spatial GM publication → persisted observer preview → authenticated player map/known route; hidden neighbors absent; hostile label inert')
