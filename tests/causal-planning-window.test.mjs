import test from 'node:test';import assert from 'node:assert/strict';
import {makeGMCausalPlanningWindow} from '../src/ui/causal-planning-inspector.mjs';
function stubDoc(){return {createElement(tag){return {tag,className:'',textContent:'',value:'',dataset:{},children:[],
 append(...parts){this.children.push(...parts);},addEventListener(){},querySelector(){return null;}};}};}
test('GM-only causal planning inspector renders safe element content, not innerHTML',async()=>{
 const previous=globalThis.document;globalThis.document=stubDoc();
 try{
  const Window=makeGMCausalPlanningWindow(class {},{gameInstance:{user:{isGM:true}},queryDue:async()=>({}),queryCrossPlot:async()=>({})});
  const root=await new Window()._renderHTML();
  assert.equal(root.tag,'section');
  assert.equal(root.children.some(x=>x.textContent==='Scoped Timeline & Cross-Plot Inspector'),true);
  assert.equal(root.children.some(x=>x.dataset?.action==='inspect'),true);
 }finally{globalThis.document=previous;}
});
test('player cannot render protected planning inspector controls',async()=>{
 const previous=globalThis.document;globalThis.document=stubDoc();
 try{
  const Window=makeGMCausalPlanningWindow(class {},{gameInstance:{user:{isGM:false}},queryDue:async()=>({}),queryCrossPlot:async()=>({})});
  const root=await new Window()._renderHTML();
  assert.equal(root.children[0].textContent,'GM authority required');
  assert.equal(root.children.some(x=>x.dataset?.action==='inspect'),false);
 }finally{globalThis.document=previous;}
});
