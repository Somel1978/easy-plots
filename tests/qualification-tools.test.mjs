import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,relative} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
function checkPython(group){
 const result=spawnSync('python',['tools/qualification/test_qualification.py',group],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);
}
test('ADR-120: complete-scope evidence refuses stale, fabricated, file-only, skipped and unreviewed scenario claims',()=>checkPython('EvidenceTests'));
test('ADR-122: normative traceability is bidirectional and reports contradictory requirements, scenarios and semantic aliases',()=>checkPython('TraceTests'));
test('ADR-124: native compatibility requires exact executed build/system evidence and declines unsupported release claims',()=>checkPython('NativeMatrixTests'));
test('ADR-125: the installable module resolves every runtime import locally without required external service packages',()=>{
 const manifest=JSON.parse(readFileSync(resolve(root,'module.json'),'utf8'));
 const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
 assert.deepEqual(Object.keys(pkg.dependencies??{}),[]);
 const visited=new Set(),pending=[...manifest.esmodules];
 assert(pending.length>0);
 while(pending.length){
  const file=pending.pop(),path=resolve(root,file);
  assert(path.startsWith(resolve(root,'src')+'/'),`Runtime file must belong to installable src: ${file}`);
  if(visited.has(path))continue;visited.add(path);
  const text=readFileSync(path,'utf8');
  const imports=[...text.matchAll(/^\s*import\s+(?:[\w\s{},*$]+\s+from\s*)?(['"])([^'"\n]+)\1/gm),
   ...text.matchAll(/\bimport\s*\(\s*(['"])([^'"\n]+)\1/g)].map(match=>match[2]);
  for(const specifier of imports){
   assert(specifier.startsWith('.'),`Runtime import requires an external package/service: ${file}: ${specifier}`);
   pending.push(relative(root,resolve(dirname(path),specifier)));
  }
 }
 const allModules=folder=>readdirSync(folder,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?allModules(resolve(folder,entry.name)):entry.name.endsWith('.mjs')?[resolve(folder,entry.name)]:[]);
 assert(visited.size>10,'The actual bootstrap composition and its transitive dependencies must be inspected');
 // Native adapters use supplied Foundry APIs. A mandatory developer-server fetch
 // must never enter the installable runtime dependency graph.
 for(const path of allModules(resolve(root,'src')))assert.doesNotMatch(readFileSync(path,'utf8'),/\b(?:fetch|WebSocket|EventSource)\s*\(/,relative(root,path));
});
