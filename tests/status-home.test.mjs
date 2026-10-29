import test from 'node:test';
import assert from 'node:assert/strict';
import {makeStatusWindow} from '../src/ui/status-window.mjs';
function documentStub(){return {createElement(tag){return {tag,children:[],events:{},dataset:{},attributes:{},textContent:'',disabled:false,append(...nodes){this.children.push(...nodes);},addEventListener(type,handler){this.events[type]=handler;},setAttribute(name,value){this.attributes[name]=value;}};}};}
function find(root,predicate){if(predicate(root))return root;for(const child of root.children??[]){const found=find(child,predicate);if(found)return found;}return null;}
const contents=root=>[root.textContent,...(root.children??[]).map(contents)].join(' ');
const action=(root,id)=>find(root,node=>node.dataset?.action===id);
const turn=()=>new Promise(resolve=>setTimeout(resolve,0));
class Base {async render(){this.root=await this._renderHTML();return this;}}
test('home prioritizes setup and prevents unconfigured native buttons from calling unavailable services',async t=>{
 const before=globalThis.document;globalThis.document=documentStub();t.after(()=>globalThis.document=before);let setupCalls=0,editorCalls=0,cockpitCalls=0;
 const Window=makeStatusWindow(Base,{openSetup:()=>setupCalls++,openEditor:()=>editorCalls++,openCockpit:()=>cockpitCalls++,getSetupState:()=>({state:'unconfigured'}),mode:()=>'sandbox'}),home=await new Window().render();assert.match(contents(home.root),/Start with world storage/);assert.equal(action(home.root,'setup').textContent,'Set up world storage');assert.equal(action(home.root,'editor').disabled,true);assert.equal(action(home.root,'cockpit').disabled,true);assert.match(action(home.root,'editor').title,/Set up world storage/);
 action(home.root,'editor').events.click();action(home.root,'cockpit').events.click();await turn();assert.deepEqual([editorCalls,cockpitCalls],[0,0]);action(home.root,'setup').events.click();await turn();assert.equal(setupCalls,1);assert.equal(action(home.root,'preview-editor').textContent,'Preview graph editor');action(home.root,'preview-editor').events.click();await turn();assert.equal(editorCalls,1);assert.match(contents(home.root),/Preview drafts are lost/);
});
test('configured home enables available tools and displays a reason for missing connections',async t=>{
 const before=globalThis.document;globalThis.document=documentStub();t.after(()=>globalThis.document=before);let opened=0;
 const Window=makeStatusWindow(Base,{openEditor:()=>opened++,getSetupState:()=>({state:'configured',tools:{cockpit:false,publications:{available:false,reason:'Connect an Actor and observer to publish for players.'}}}),mode:()=>'native'}),home=await new Window().render();assert.equal(action(home.root,'editor').disabled,false);assert.equal(action(home.root,'cockpit').disabled,true);assert.equal(action(home.root,'publications').disabled,true);assert.equal(action(home.root,'preview-editor'),null);assert.match(contents(home.root),/Connect an Actor and observer/);action(home.root,'editor').events.click();await turn();assert.equal(opened,1);assert.equal(action(home.root,'setup').disabled,true);
});
test('home rechecks setup before opening a tool and fails closed when setup inspection fails',async t=>{
 const before=globalThis.document;globalThis.document=documentStub();t.after(()=>globalThis.document=before);let state={state:'configured'},opened=0;const Window=makeStatusWindow(Base,{getSetupState:()=>state,openEditor:()=>opened++,mode:()=>'native'}),home=await new Window().render();state={state:'blocked',message:'World permissions changed. Review setup.'};action(home.root,'editor').events.click();await turn();assert.equal(opened,0);assert.equal(action(home.root,'editor').disabled,true);assert.match(contents(home.root),/World permissions changed/);
 const Failed=makeStatusWindow(Base,{getSetupState:()=>{throw Error('PRIVATE INTERNAL DETAILS');}}),failed=await new Failed().render();assert.match(contents(failed.root),/World setup is unavailable/);assert.equal(contents(failed.root).includes('PRIVATE INTERNAL DETAILS'),false);
});
test('existing callers default to native availability only when their storage mode is native',async t=>{
 const before=globalThis.document;globalThis.document=documentStub();t.after(()=>globalThis.document=before);const Native=makeStatusWindow(Base,{mode:()=>'native'}),Preview=makeStatusWindow(Base);assert.equal(action((await new Native().render()).root,'editor').disabled,false);assert.equal(action((await new Preview().render()).root,'editor').disabled,true);
});
