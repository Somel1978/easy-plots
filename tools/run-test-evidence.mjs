/** Run the real suite once, preserve its exit status and keep case-level evidence. */
import {openSync,closeSync,readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),version=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version;
const suffix=version.replace(/\.0-dev$/,''),target=join(root,`docs/local-test-evidence-v${suffix}.jsonl`);
mkdirSync(join(root,'docs'),{recursive:true});
const files=readdirSync(join(root,'tests')).filter(n=>n.endsWith('.test.mjs')).sort().map(n=>`tests/${n}`);
const fd=openSync(target,'w');let result;
try{result=spawnSync(process.execPath,['--test','--test-reporter=./tools/test-evidence-reporter.mjs',...files],{cwd:root,stdio:['ignore',fd,'inherit']});}
finally{closeSync(fd);}
const events=readFileSync(target,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const summary=events.findLast(e=>e.event==='test:summary'&&e.file===null);
for(const e of events.filter(e=>e.event==='test:fail'))console.error(`FAIL: ${e.file}:${e.line} — ${e.name}\n${e.failure}`);
const fileOnly=events.some(e=>e.event==='test:pass'&&/^tests\/.*\.test\.mjs$/.test(e.name));
if(result.status!==0||!summary?.success||fileOnly){
 console.error(fileOnly?'FAIL: file-only reporting does not prove individual cases executed':`FAIL: suite did not complete successfully; evidence: ${target}`);
 process.exitCode=result.status||1;
}else console.log(`PASS: ${summary.counts.passed} tests; ${summary.counts.failed} failed; ${summary.counts.skipped} skipped. Evidence: ${target}`);
