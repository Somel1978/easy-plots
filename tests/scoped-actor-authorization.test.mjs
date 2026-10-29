import test from 'node:test';import assert from 'node:assert/strict';
import {createScopedActorAuthorizer} from '../src/platform/foundry-actors.mjs';
const sceneId='abcdefghijklmnop',tokenId='ponmlkjihgfedcba';
const ref=`Scene.${sceneId}.Token.${tokenId}`;
const user={id:'player-A',isGM:false,active:true,viewedScene:sceneId};
function fixture(){
 const users=new Map([[user.id,{...user}]]);
 const synthetic={isToken:true,testUserPermission:(u,level)=>u.id===user.id&&level==='OWNER'};
 const token={actorLink:false,actor:synthetic};
 const scenes=new Map([[sceneId,{tokens:new Map([[tokenId,token]])}]]);
 const actors=new Map([['world-actor',{testUserPermission:()=>true}]]);
 const game={users:{get:id=>users.get(id)},actors:{get:id=>actors.get(id)},scenes:{get:id=>scenes.get(id)}};
 return {game,users,token,scenes,actors};
}
test('player may use owned unlinked synthetic Actor in currently viewed scene',async()=>{
 const f=fixture();assert.equal(await createScopedActorAuthorizer(f.game)(user.id,ref),true);
});
test('viewing a token does not imply ownership',async()=>{
 const f=fixture();f.token.actor.testUserPermission=()=>false;
 assert.equal(await createScopedActorAuthorizer(f.game)(user.id,ref),false);
});
test('remote scene tokens, other viewers and invalid token refs fail closed',async()=>{
 const f=fixture();const check=createScopedActorAuthorizer(f.game);
 f.users.get(user.id).viewedScene='different';assert.equal(await check(user.id,ref),false);
 f.users.get(user.id).viewedScene=sceneId;
 assert.equal(await check(user.id,`Scene.${sceneId}.Token.not-valid`),false);
 assert.equal(await check('missing',ref),false);
});
test('linked tokens do not bypass the world Actor permission path',async()=>{
 const f=fixture(),check=createScopedActorAuthorizer(f.game);
 f.token.actorLink=true;assert.equal(await check(user.id,ref),false);
 assert.equal(await check(user.id,'world-actor'),true);
});
test('GM or inactive player cannot impersonate synthetic token owner',async()=>{
 const f=fixture(),check=createScopedActorAuthorizer(f.game);
 f.users.get(user.id).isGM=true;assert.equal(await check(user.id,ref),false);
 f.users.get(user.id).isGM=false;f.users.get(user.id).active=false;
 assert.equal(await check(user.id,ref),false);
});
