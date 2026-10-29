"""Actual page refresh: bootstrap, encrypted writes, reload, unlock, discover, reopen.
Synthetic Foundry database lives in Python, outside the browser JavaScript realm.
"""
import json
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
settings={};packs={};documents={};fault={'reject_updates':False}

def serve(route):
    url=urlparse(route.request.url)
    if url.hostname!='easy-plots.test':route.abort();return
    if url.path=='/__foundry-test-storage__':
        data=route.request.post_data_json;action=data['action'];value=None
        if action=='update' and fault['reject_updates']:
            route.fulfill(status=503,content_type='application/json',body='{"error":"synthetic server write unavailable"}');return
        if action=='load':value={'settings':list(settings.items()),'packs':list(packs.values())}
        elif action=='setting':settings[data['key']]=data['value'];value=True
        elif action=='pack':
            key='world.'+data['metadata']['name'];assert key not in packs
            packs[key]=data['metadata'];documents[key]={};value=True
        elif action=='read':value=documents[data['collection']].get(data['id'])
        elif action in ['create','update']:
            rows=documents[data['collection']];row=data['document']
            assert (row['_id'] in rows)==(action=='update')
            rows[row['_id']]=row;value=True
        else:raise AssertionError(action)
        route.fulfill(content_type='application/json',body=json.dumps(value));return
    path=(ROOT/unquote(url.path).lstrip('/')).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():route.abort();return
    route.fulfill(content_type={'.mjs':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css'}.get(path.suffix,'application/octet-stream'),body=path.read_bytes())

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',serve)
    page.goto('https://easy-plots.test/tests/browser/launcher-harness.html?persistent')
    page.wait_for_function('window.__ready===true');page.locator('[data-launcher="main"]').click()
    page.get_by_role('button',name='World setup',exact=True).click()
    password='World refresh regression password'
    page.locator('input[name="vault-passphrase"]').fill(password)
    page.locator('input[name="vault-confirmation"]').fill(password)
    page.get_by_role('button',name='Create private world storage',exact=True).click()
    page.wait_for_function('document.querySelector(".ep-campaign-workspace")?.textContent.includes("World storage connected")',timeout=30000)
    page.locator('[data-action="new-plot"]').click()
    page.wait_for_selector('[data-save-state]')
    assert page.locator('[data-save-state]').inner_text()=='Saved to this world'
    page.locator('[data-field="title"]').fill('Saved before a full world refresh')
    page.wait_for_function('document.querySelector("[data-save-state]")?.textContent==="Saved to this world"',timeout=30000)
    page.locator('[data-field="node-label"]').fill('A lead reaches the docks')
    page.wait_for_function('document.querySelector("[data-save-state]")?.textContent==="Saved to this world"',timeout=30000)
    assert page.locator('[data-field="node-label"]').evaluate('(n)=>document.activeElement===n'),'Autosave must retain typing focus'
    # Inspect server bytes, not a model or client cache.
    assert len(packs)==1 and len(next(iter(documents.values())))>1
    assert 'Saved before a full world refresh' not in json.dumps(documents)
    snapshot=json.dumps(documents,sort_keys=True);pack_id=settings['worldStorage']['packId']
    page.reload();page.wait_for_function('window.__ready===true')
    page.locator('[data-launcher="main"]').click()
    assert page.locator('[data-action="new-plot"]').is_disabled()
    page.get_by_role('button',name='World setup',exact=True).click()
    page.locator('input[name="vault-passphrase"]').fill(password)
    page.get_by_role('button',name='Unlock world vault',exact=True).click()
    page.get_by_role('button',name='Open plot',exact=True).wait_for(timeout=30000)
    assert 'Saved before a full world refresh' in page.locator('.ep-campaign-workspace').inner_text()
    page.get_by_role('button',name='Open plot',exact=True).click()
    assert page.locator('[data-field="title"]').input_value()=='Saved before a full world refresh'
    assert page.locator('[data-field="node-label"]').input_value()=='A lead reaches the docks'
    assert len(packs)==1 and settings['worldStorage']['packId']==pack_id
    assert json.dumps(documents,sort_keys=True)==snapshot,'Reload/unlock/open must not rewrite the saved data'
    assert page.locator('[data-action="activate"]').is_disabled()
    assert not page.evaluate('game.modules.get("easy-plots").api.reactiveStatus.running')
    fault['reject_updates']=True
    page.locator('[data-field="title"]').fill('Server failed while saving this edit')
    page.wait_for_function('document.querySelector(".ep-error")?.textContent.includes("Autosave could not confirm")',timeout=30000)
    assert page.locator('[data-field="title"]').input_value()=='Server failed while saving this edit'
    assert page.locator('[data-save-state]').inner_text()!='Saved to this world'
    fault['reject_updates']=False
    page.locator('[data-field="title"]').fill('Saved after the server became available')
    page.wait_for_function('document.querySelector("[data-save-state]")?.textContent==="Saved to this world"',timeout=30000)
    # Unsaved/invalid text cannot silently vanish on refresh. The browser warns;
    # dismissing the warning keeps the editor and its exact text.
    page.locator('[data-field="title"]').fill('X')
    page.wait_for_function('document.querySelector(".ep-error")?.textContent.includes("Autosave could not confirm")',timeout=30000)
    assert page.locator('[data-field="title"]').input_value()=='X'
    with page.expect_event('dialog') as dialog:
        page.evaluate('setTimeout(()=>location.reload(),0)')
    assert dialog.value.type=='beforeunload';dialog.value.dismiss()
    assert page.locator('[data-field="title"]').input_value()=='X'
    page.locator('[data-field="title"]').fill('Recovered valid autosaved draft')
    page.wait_for_function('document.querySelector("[data-save-state]")?.textContent==="Saved to this world"',timeout=30000)
    assert page.locator('.ep-error').count()==0
    assert errors==[],errors
    assert page.evaluate('window.__launcherTest.errors')==[],page.evaluate('window.__launcherTest.errors')
    browser.close()
    print('PASS: new plot is stored immediately; edit and authored step name autosave without Save; independent synthetic database → full browser reload → unlock → find/reopen; typing focus retained; server write failure and invalid edits preserve inputs with visible error; beforeunload warning; recovery; no auto publication/activation; unchanged encrypted server bytes on read')
