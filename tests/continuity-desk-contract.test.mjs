import test from 'node:test';import assert from 'node:assert/strict';
import {makeGMContinuityDeskWindow} from '../src/ui/continuity-desk.mjs';
class Stub {}
const api={arcResolutions:{plan:async()=>({arcRevision:1,eligible:[]}),finalize:async()=>{}},blueprints:{planAdoption:async()=>({}),adopt:async()=>{}},knowledgeLedger:{projection:async()=>({})}};
test('continuity desk refuses missing protected domain providers',()=>{
 assert.throws(()=>makeGMContinuityDeskWindow(Stub,{gameInstance:{user:{isGM:true}},arcResolutions:{},blueprints:api.blueprints,knowledgeLedger:api.knowledgeLedger}),{code:'CONTINUITY_DESK_DEPENDENCY'});
});
test('continuity desk is an ApplicationV2-class-compatible GM-only constructor',()=>{
 const Window=makeGMContinuityDeskWindow(Stub,{gameInstance:{user:{isGM:true}},...api});
 const window=new Window();assert.equal(typeof window._renderHTML,'function');
 assert.equal(Window.DEFAULT_OPTIONS.window.resizable,true);
});
