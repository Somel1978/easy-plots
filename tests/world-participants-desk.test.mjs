import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorldParticipantsDesk} from '../src/ui/world-participants-desk.mjs';
import {WorldParticipants} from '../src/orchestration/world-participants.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
function dom(){
 const all=node=>[node,...node.children.flatMap(all)];return {all,document:{createElement(tag){return {tag,children:[],dataset:{},listeners:{},value:'',textContent:'',disabled:false,append(...children){this.children.push(...children);},addEventListener(name,callback){this.listeners[name]=callback;},querySelector(selector){const match=/\[data-(field|action)="([^"]+)"\]/.exec(selector);return match?all(this).find(n=>n.dataset?.[match[1]]===match[2])??null:null;},closest(selector){return selector==='button[data-action]'&&this.tag==='button'?this:null;}};}}};
}
class Base{latest=null;done=null;async render(){this.latest=await this._renderHTML();this.done?.();return this;}}
async function rendered(app,action){let timer;try{await Promise.race([new Promise(resolve=>{app.done=resolve;action();}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Participant action did not render')),2000);})]);}finally{clearTimeout(timer);app.done=null;}}
const field=(app,key)=>app.latest.querySelector(`[data-field="${key}"]`);
async function click(app,key){const button=app.latest.querySelector(`[data-action="${key}"]`);assert.equal(button.disabled,false);await rendered(app,()=>app.latest.listeners.click({target:button}));}
function setup(){
 const user={id:'gm_participant_desk001',isGM:true,active:true},player={id:'player_participant_desk001',active:true,isGM:false},users=[user,player],actor={id:'DeskActor00000001',name:'Hero <img src=x>',testUserPermission:()=>true},game={user,world:{id:'desk-world'},users:{get:id=>users.find(u=>u.id===id),contents:users},actors:{get:id=>id===actor.id?actor:null,contents:[actor]}},gm=createLocalGMContext(game,'desk-world');
 const service=new WorldParticipants({repository:new MemoryPartitionRepository(),gmProvider:()=>gm,writer:{assertEligible:()=>true},gameInstance:game});return {user,player,actor,game,service};
}
test('world participant GM desk saves only explicitly entered identities and loaded revisions, then retires the same binding',async t=>{
 const previous=globalThis.document,{document,all}=dom();globalThis.document=document;t.after(()=>{globalThis.document=previous;});const s=setup(),Window=makeWorldParticipantsDesk(Base,{service:s.service,gameInstance:s.game}),app=new Window();await app.render();assert.equal(field(app,'narrative-actor').value,'');assert.equal(field(app,'observer').value,'');assert.ok(all(app.latest).some(n=>n.tag==='option'&&n.textContent===s.actor.name));assert.ok(!all(app.latest).some(n=>n.tag==='img'));
 let actor=field(app,'native-actor');actor.value=s.actor.id;await rendered(app,()=>actor.listeners.change());await click(app,'read');assert.equal(field(app,'narrative-actor').value,'');field(app,'narrative-actor').value='ep:actor:desk_explicit001';field(app,'observer').value='ep:actor:desk_observer001';await click(app,'save');const saved=await s.service.read({nativeActorId:s.actor.id});assert.equal(saved.revision,2);assert.equal(saved.narrativeActorId,'ep:actor:desk_explicit001');assert.equal(await s.service.resolveObserver({actorId:s.actor.id,verifiedUserId:s.player.id}),'ep:actor:desk_observer001');
 field(app,'status').value='retired';await click(app,'save');assert.equal((await s.service.read({nativeActorId:s.actor.id})).status,'retired');await assert.rejects(()=>s.service.resolveObserver({actorId:s.actor.id,verifiedUserId:s.player.id}),{code:'PARTICIPANT_UNAVAILABLE'});
});
test('world participant desk displays no private identity inputs or metadata for a player',async t=>{
 const previous=globalThis.document,{document,all}=dom();globalThis.document=document;t.after(()=>{globalThis.document=previous;});const s=setup();s.game.user=s.player;const Window=makeWorldParticipantsDesk(Base,{service:s.service,gameInstance:s.game}),app=new Window();await app.render();assert.equal(field(app,'native-actor'),null);assert.equal(all(app.latest).length,2);assert.equal(app.latest.children[0].textContent,'GM authority required');
});
