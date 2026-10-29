import test from 'node:test';
import assert from 'node:assert/strict';
import {registerFoundryLaunchers} from '../src/platform/foundry-launcher.mjs';
function fixture(){
 const events=new Map(),hooks={on:(name,fn)=>{const list=events.get(name)??[];list.push(fn);events.set(name,list);},once:(name,fn)=>{hooks.on(name,fn);}},menus=[],opened=[],warnings=[];
 class Base {async render(){opened.push(this.constructor.DEFAULT_OPTIONS?.id??this.constructor.name);return this;}}
 const pkg={},game={user:{id:'launcher-GM',isGM:true},world:{id:'launcher-world'},modules:new Map([['easy-plots',pkg]]),settings:{registerMenu:(...args)=>menus.push(args)}};
 return {events,hooks,menus,opened,warnings,Base,pkg,game,register:()=>registerFoundryLaunchers({hooks,gameProvider:()=>game,baseProvider:()=>Base,notify:m=>warnings.push(m)})};
}
test('ADR-021: actual bootstrap installs pre-ready v14 controls and a role-aware settings menu that open the public control window',async t=>{
 const s=fixture(),previous={Hooks:globalThis.Hooks,game:globalThis.game,foundry:globalThis.foundry};Object.assign(globalThis,{Hooks:s.hooks,game:s.game,foundry:{applications:{api:{ApplicationV2:s.Base}}}});t.after(()=>Object.assign(globalThis,previous));t.mock.method(console,'info',()=>{});
 await import('../src/bootstrap/index.mjs?launcher-bootstrap-test');assert.equal(s.pkg.api,undefined);assert.equal(s.events.get('getSceneControlButtons').length,1);s.events.get('init')[0]();assert.equal(s.menus[0][0],'easy-plots');assert.equal(s.menus[0][2].restricted,false);assert(s.menus[0][2].type.prototype instanceof s.Base);
 const controls={tokens:{name:'tokens',order:1,tools:{}}};s.events.get('getSceneControlButtons')[0](controls);assert(controls['easy-plots'].tools.editor.button);assert.deepEqual(s.opened,[]);s.events.get('ready')[0]();assert.equal(s.pkg.api.version,'1.14.0-dev');await controls['easy-plots'].onChange(null,true);assert.deepEqual(s.opened,['easy-plots-workspace']);await controls['easy-plots'].tools.editor.onChange();assert(s.opened.includes('easy-plots-workspace'));await new s.menus[0][2].type().render({force:true});assert.equal(s.opened.at(-1),'easy-plots-workspace');assert.equal(s.pkg.api.reactiveStatus.running,false);
});
test('launcher callbacks use the current API and report a pre-ready or rejected open without starting native services',async()=>{
 const s=fixture();s.register();const controls={};s.events.get('getSceneControlButtons')[0](controls);await controls['easy-plots'].tools.workspace.onChange();assert.match(s.warnings[0],/not ready/);let writes=0;s.pkg.api={openGMWorkspace:async()=>{writes++;throw Error('native test failure');}};await controls['easy-plots'].tools.workspace.onChange();assert.equal(s.warnings.at(-1),'native test failure');assert.equal(writes,1);
});
test('GM launchers and the settings entry recheck role loss after controls were prepared',async()=>{
 const s=fixture();let opened=0;s.pkg.api={openGMWorkspace:()=>{opened++;}};s.register();s.events.get('init')[0]();const controls={};s.events.get('getSceneControlButtons')[0](controls);s.game.user.isGM=false;await controls['easy-plots'].onChange(null,true);await controls['easy-plots'].tools.workspace.onChange();await new s.menus[0][2].type().render();assert.equal(opened,0);assert(s.warnings.slice(0,2).every(m=>m==='GM authority required'));
});
test('player controls contain only audience tools and repeated registration does not duplicate hooks or menus',async()=>{
 const s=fixture();s.game.user.isGM=false;const calls=[];s.pkg.api={openPlayerWorkspace:()=>calls.push('portal'),openPlayerNoticeInbox:()=>calls.push('inbox'),openGMWorkspace:()=>assert.fail('GM window exposed')};const first=s.register();assert.equal(s.register(),first);assert.equal(s.events.get('getSceneControlButtons').length,1);const controls={};s.events.get('getSceneControlButtons')[0](controls);assert.deepEqual(Object.keys(controls['easy-plots'].tools),['portal','inbox']);await controls['easy-plots'].tools.portal.onChange();await controls['easy-plots'].tools.inbox.onChange();assert.deepEqual(calls,['portal','inbox']);
});
