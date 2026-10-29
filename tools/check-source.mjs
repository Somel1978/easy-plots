import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):(e.name.endsWith('.mjs')?[join(dir,e.name)]:[]));}
let count=0;
for(const file of files('src')){
  const child=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(child.status!==0){process.stderr.write(child.stderr||`Syntax failed: ${file}\n`);process.exit(1);}
  count++;
}
console.log(`PASS: syntax check for ${count} module files`);
