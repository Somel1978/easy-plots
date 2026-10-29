/** Machine-readable actual Node results, separate from decision assessments. */
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {relative,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=dir=>readdirSync(join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?(e.name==='__pycache__'?[]:files(`${dir}/${e.name}`)):[`${dir}/${e.name}`]);
export default async function* report(events){
 const sourceFiles=[...files('src'),...files('tests'),...files('lang'),...files('spec'),'package.json','module.json'].sort();
 const hash=createHash('sha256');for(const file of sourceFiles)hash.update(file).update('\0').update(readFileSync(join(root,file))).update('\0');
 yield JSON.stringify({event:'run:start',version:JSON.parse(readFileSync(join(root,'package.json'),'utf8')).version,
  sourceDigest:hash.digest('hex'),testFiles:files('tests').filter(p=>/^tests\/[^/]+\.test\.mjs$/.test(p)).sort()})+'\n';
 for await(const event of events){
  if(['test:pass','test:fail'].includes(event.type)){
   const d=event.data;
   yield JSON.stringify({event:event.type,name:d.name,file:d.file?relative(root,d.file):null,line:d.line??null,
    nesting:d.nesting??0,duration_ms:d.details?.duration_ms??null,...(event.type==='test:fail'?{failure:d.details?.error?.message??'Test failed'}:{})})+'\n';
  }else if(event.type==='test:summary')yield JSON.stringify({event:event.type,...event.data,file:event.data.file?relative(root,event.data.file):null})+'\n';
 }
}
