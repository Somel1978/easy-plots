import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGMCausalPlanningWindow} from '../src/ui/causal-planning-inspector.mjs';
const scheduleId='ep:scheduled:harper001';
function fakeDOM(){
 return {createElement(tag){return {
   tag,children:[],events:{},dataset:{},value:'',textContent:'',disabled:false,checked:false,
   append(...nodes){this.children.push(...nodes);},addEventListener(name,fn){this.events[name]=fn;},
   querySelector(selector){const wanted=selector.match(/^\[data-field="([^"]+)"\]$/)?.[1];
    const visit=node=>node.dataset?.field===wanted?node:node.children?.map(visit).find(Boolean);
    return visit(this);},
  };}};
}
function find(root,filter){if(filter(root))return root;for(const child of root.children??[]){const result=find(child,filter);if(result)return result;}return null;}
const advance=()=>new Promise(resolve=>setTimeout(resolve,12));
test('GM temporal inspector requires explicit selection and acknowledgement before queuing a due event',async()=>{
 const oldDoc=globalThis.document;globalThis.document=fakeDOM();
 let submitted=[];
 try{
  const Base=class {async render(){this.root=await this._renderHTML();return this;}};
  const Window=makeGMCausalPlanningWindow(Base,{
   gameInstance:{user:{isGM:true}},
   queryDue:async()=>({candidates:[{id:scheduleId,dueAt:90,sourceRevision:1}]}),
   queryCrossPlot:async()=>({}),
   queueDue:async payload=>{submitted.push(payload);return {status:'review-required'};}
  });
  const app=await new Window().render();
  app.root.events.click({target:find(app.root,e=>e.dataset?.action==='inspect')});
  await advance();
  assert.equal(find(app.root,e=>e.dataset?.action==='queue-due')?.disabled,true);
  // A forged programmatic click while unacknowledged is rejected.
  app.root.events.click({target:{dataset:{action:'queue-due'}}});
  await advance();assert.equal(submitted.length,0);
  const selection=find(app.root,e=>e.dataset?.field==='dueScheduleId');
  selection.value=scheduleId;app.root.events.change({target:selection});
  await advance();
  const ack=find(app.root,e=>e.dataset?.field==='ackDue');ack.checked=true;
  app.root.events.change({target:ack});await advance();
  assert.equal(find(app.root,e=>e.dataset?.action==='queue-due').disabled,false);
  app.root.events.click({target:{dataset:{action:'queue-due'}}});await advance();
  assert.deepEqual(submitted,[{scheduleId,worldTime:180}]);
  assert.equal(find(app.root,e=>e.dataset?.action==='queue-due')?.disabled,true);
 }finally{globalThis.document=oldDoc;}
});
