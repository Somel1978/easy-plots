"""Actual Chromium dimensions and actions for the bounded Easy Plots home."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

def asset(route):
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

def dimensions(page):
    return page.evaluate('''() => {
      const root=document.querySelector('.easy-plots-status'),content=document.querySelector('.window-content');
      return {height:root.clientHeight,scroll:root.scrollHeight,width:root.clientWidth,scrollWidth:root.scrollWidth,
        top:root.scrollTop,bottom:root.getBoundingClientRect().bottom,contentBottom:content.getBoundingClientRect().bottom,
        overflow:getComputedStyle(root).overflowY,body:document.body.scrollHeight,viewport:innerHeight};
    }''')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 900, 'height': 600})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/*', asset)
    page.goto('https://easy-plots.test/tests/browser/status-home-harness.html', wait_until='load')
    page.wait_for_function('window.__ready === true')
    root = page.locator('.easy-plots-status')
    assert root.get_by_role('heading', name='Easy Plots', exact=True).count() == 1
    assert root.locator('button[data-action="editor"]').is_disabled()
    assert root.locator('button[data-action="cockpit"]').is_disabled()
    assert 'Set up world storage' in root.locator('#ep-home-reason-editor').text_content()
    root.get_by_role('button', name='Set up world storage', exact=True).click()
    assert page.evaluate('window.__homeTest.calls.setup') == 1
    box = dimensions(page)
    assert box['overflow'] == 'auto' and 0 < box['height'] <= 380, box
    assert box['scroll'] > box['height'] + 300, box
    assert box['bottom'] <= box['contentBottom'] + 1, box
    assert box['scrollWidth'] <= box['width'] + 1 and box['body'] <= box['viewport'], box
    root.hover()
    page.mouse.wheel(0, 520)
    page.wait_for_function('document.querySelector(".easy-plots-status").scrollTop > 100')
    root.locator('.ep-home-footnote').scroll_into_view_if_needed()
    assert page.evaluate('''() => {const r=document.querySelector('.easy-plots-status').getBoundingClientRect(),f=document.querySelector('.ep-home-footnote').getBoundingClientRect();return f.top>=r.top&&f.bottom<=r.bottom+1&&window.scrollY===0;}''')
    root.locator('details summary').click()
    root.get_by_role('button', name='Preview graph editor', exact=True).click()
    assert page.evaluate('window.__homeTest.calls.editor') == 1
    page.evaluate("window.__homeTest.setState({state:'configured',tools:{cockpit:false,publications:{available:false,reason:'Connect an Actor and observer to publish for players.'}}})")
    assert root.locator('[data-setup-state="configured"]').count() == 1
    assert root.locator('button[data-action="editor"]').is_enabled()
    assert root.locator('button[data-action="cockpit"]').is_disabled()
    assert root.locator('button[data-action="publications"]').is_disabled()
    assert root.locator('[data-action="preview-editor"]').count() == 0
    root.locator('button[data-action="editor"]').click()
    assert page.evaluate('window.__homeTest.calls.editor') == 2
    page.evaluate('window.__homeTest.resize(370,280)')
    small = dimensions(page)
    assert 0 < small['height'] <= 240 and small['scroll'] > small['height'], small
    assert small['scrollWidth'] <= small['width'] + 1 and small['bottom'] <= small['contentBottom'] + 1, small
    root.locator('.ep-home-footnote').scroll_into_view_if_needed()
    assert page.evaluate('document.querySelector(".easy-plots-status").scrollTop > 0')
    assert not errors, errors
    browser.close()
    print('PASS: Chromium home setup/availability, actual420px and280px window bounds, wheel scrolling, reachable footer, no outer/horizontal overflow')
