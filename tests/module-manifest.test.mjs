import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {localize} from '../src/ui/localization.mjs';
const root=new URL('../',import.meta.url),read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const manifest=read('module.json');
const keys=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?keys(v,`${p}${k}.`):[`${p}${k}`]).sort();
test('module manifest follows Somel metadata and actual installable entrypoints',()=>{
  assert.equal(manifest.id,'easy-plots');assert.equal(manifest.title,'Easy Plots');assert.equal(manifest.authors[0].name,'Somel');
  assert.equal(manifest.compatibility.minimum,'14.369');assert.equal(manifest.compatibility.verified,'14.369');
  assert.equal(manifest.socket,true);
  for(const path of [...manifest.esmodules,...manifest.styles,...manifest.languages.map(l=>l.path)])assert.ok(existsSync(new URL(path,root)),path);
  const base='https://modulesfvttai.pedrolemos.com/p/easy-plots';
  assert.equal(manifest.url,base);assert.equal(manifest.manifest,`${base}/module.json`);
  assert.equal(manifest.download,`${base}/releases/${manifest.version}/module.zip`);
  assert.equal(manifest.bugs,`${base}/issues`);assert.equal(manifest.changelog,`${base}/releases#${manifest.version}`);
});
test('English and Portuguese (Portugal) language files have matching translation keys',()=>{
  assert.deepEqual(manifest.languages.map(l=>l.lang),['en','pt-PT']);
  const en=read('lang/en.json'),pt=read('lang/pt-PT.json');assert.deepEqual(keys(en),keys(pt));
  assert.equal(pt.EasyPlots.Graph.Actions.save,'Guardar rascunho');
});
test('graph localization uses Foundry selected language and readable fallback labels',()=>{
  const old=globalThis.game;
  try{
    globalThis.game={i18n:{localize:key=>key==='test'?'Guardar':key}};
    assert.equal(localize('test','Save'),'Guardar');assert.equal(localize('unknown','Save'),'Save');
    delete globalThis.game;assert.equal(localize('test','Save'),'Save');
  }finally{if(old===undefined)delete globalThis.game;else globalThis.game=old;}
});
