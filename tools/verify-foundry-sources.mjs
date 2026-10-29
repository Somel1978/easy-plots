/**
 * Inspect user-supplied Foundry source trees. Read-only. No source code is copied.
 * Usage: node tools/verify-foundry-sources.mjs /path/to/Foundry /path/to/dist
 */
import fs from 'node:fs';
import path from 'node:path';

const [clientRoot,serverRoot]=process.argv.slice(2);
if (!clientRoot || !serverRoot){
  console.error('Usage: node tools/verify-foundry-sources.mjs /path/to/Foundry /path/to/dist');
  process.exitCode=2;
} else {
  const read=(root,relative)=>fs.readFileSync(path.join(root,relative),'utf8');
  const checks=[];
  function check(name,source,tests){
    const outcome=tests.every(test=>test.test(source));
    checks.push({name,status:outcome?'source-confirmed':'source-not-confirmed'});
  }
  try{
    const version=JSON.parse(read(clientRoot,'package.json')).release;
    check('Foundry core v14 baseline',String(version?.generation),[/^14$/]);
    check('Manifest socket declaration supported',read(clientRoot,'common/packages/base-package.mjs'),[/socket:\s*new\s+fields\.BooleanField/]);
    check('Server registers module socket channels',read(serverRoot,'packages/package.mjs'),[/registerCustomSocket/,/handleCustomSocket\.bind/]);
    check('Native server passes authenticated userId',read(serverRoot,'server/sockets.mjs'),[/handleCustomSocket/,/this\.user\.id/]);
    check('Native server handles recipient routing',read(serverRoot,'server/sockets.mjs'),[/Array\.isArray\(o\)/,/o\.sockets/,/\.emit\(e,t,this\.user\.id\)/]);
    check('Client documents expose Actor ownership check',read(clientRoot,'common/abstract/document.mjs'),[/testUserPermission\(/,/getUserLevel\(/]);
    check('Player queries are permission gated',read(clientRoot,'client/documents/user.mjs'),[/QUERY_USER/,/CONFIG\.queries/]);
    check('Compendium index fields can be requested',read(clientRoot,'client/documents/collections/compendium-collection.mjs'),[/async getIndex\(/,/indexFields/]);
    check('Server document read visibility requires live verification',read(serverRoot,'database/backend/server-document.mjs'),[/static async _preGetOperation/]);
    check('ApplicationV2 available',read(clientRoot,'client/applications/api/application.mjs'),[/ApplicationV2/]);
    check('Combat document lifecycle signatures',read(clientRoot,'client/documents/combat.mjs'),[/_onCreate\(data, options, userId\)/,/_onUpdate\(changed, options, userId\)/,/_onDelete\(options, userId\)/]);
    check('ChatMessage creation lifecycle signature',read(clientRoot,'client/documents/chat-message.mjs'),[/_onCreate\(data, options, userId\)/]);
    check('Native asynchronous noninteractive Roll evaluation',read(clientRoot,'client/dice/roll.mjs'),[/async evaluate\(/,/allowInteractive=true/]);
    console.log(JSON.stringify({foundry:{generation:version.generation,build:version.build,channel:version.channel},checks,qualifier:'Static source signatures only: not a live permission/security certification'},null,2));
    if(checks.some(c=>c.status!=='source-confirmed'))process.exitCode=1;
  }catch(err){console.error('Source audit could not run:',err.message);process.exitCode=2;}
}
