import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGMTimelineBranchWindow} from '../src/ui/timeline-branch-desk.mjs';
import {makeGMSessionPreparationWindow} from '../src/ui/session-preparation-desk.mjs';
import {PersistentTimelineBranches} from '../src/orchestration/persistent-timelines.mjs';
import {PersistentSessionPreparation} from '../src/orchestration/persistent-session-preparation.mjs';
import {PersistentGMFocus} from '../src/orchestration/persistent-gm-focus.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
function dom(){
 const all=node=>[node,...node.children.flatMap(all)];
 const document={createElement(tag){return {tag,children:[],dataset:{},listeners:{},value:'',textContent:'',disabled:false,checked:false,
  append(...children){this.children.push(...children);},addEventListener(name,callback){this.listeners[name]=callback;},
  querySelector(selector){const found=/\[data-(field|action)="([^"]+)"\]/.exec(selector);return found?all(this).find(n=>n.dataset?.[found[1]]===found[2])??null:null;},
  closest(selector){return selector==='button[data-action]'&&this.tag==='button'&&this.dataset.action?this:null;}};}};
 return {document,all};
}
class Base {
 latest=null;done=null;
 async render(){this.latest=await this._renderHTML();this.done?.();return this;}
}
const set=(app,key,value)=>{const input=app.latest.querySelector(`[data-field="${key}"]`);assert(input);input.value=value;app.latest.listeners.input({target:input});};
async function click(app,action){
 const button=app.latest.querySelector(`[data-action="${action}"]`);assert(button,action);assert.equal(button.disabled,false,`${action} enabled`);
 let timer;try{await Promise.race([new Promise(resolve=>{app.done=resolve;app.latest.listeners.click({target:button});}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`Action ${action} did not render`)),2000);})]);}
 finally{clearTimeout(timer);app.done=null;}
}
async function setup(){
 const user={id:'PlanningDeskGM001',isGM:true},gameInstance={user},gm=createLocalGMContext(gameInstance,'world'),gmProvider=()=>gm,repository=new MemoryPartitionRepository(),domains=new NarrativeDomainStore({repository,gmProvider});
 const focus=new PersistentGMFocus({domains,gmProvider}),registry={getActivation:async graphId=>({graphId,active:true,revision:1,publishedVersion:1}),getPublished:async(id,publishedVersion)=>({id,publishedVersion,title:`Plot ${id}`,nodes:[]})};
 const timeline=new PersistentTimelineBranches({domains}),sessions=new PersistentSessionPreparation({domains,focus,registry,gmProvider});
 const sourceEventId='ep:event:planning_desk_seed001',factId='ep:fact:planning_desk001';await domains.save({type:'world-fact',scope:'world',id:factId,data:{status:'asserted',value:'open'},sourceEventId});
 return {user,gameInstance,domains,timeline,sessions,factId,sourceEventId};
}
test('timeline GM desk creates isolated versions and requires reviewed canonical fact observations before changing the selection',async t=>{
 const previous=globalThis.document,{document,all}=dom();globalThis.document=document;t.after(()=>{globalThis.document=previous;});
 const s=await setup(),Window=makeGMTimelineBranchWindow(Base,{service:s.timeline,gameInstance:s.gameInstance}),app=new Window();await app.render();
 set(app,'sourceRefs',JSON.stringify([{id:s.factId,key:'harbor',revision:1}]));await click(app,'create');
 set(app,'branchId','ep:branch:desk_alternate001');set(app,'label','Closed harbor');set(app,'hypotheses','[{"key":"harbor","value":"closed"}]');await click(app,'branch');
 assert.equal(app.latest.querySelector('[data-action="select"]').disabled,true);
 const review=app.latest.querySelector('[data-field="reviewed"]');review.checked=true;app.latest.listeners.change({target:review});await click(app,'select');
 assert(all(app.latest).some(n=>n.textContent.includes('TIMELINE_NOT_CANONICAL')));assert.equal((await s.timeline.canonical({timelineId:'ep:timeline:next_session001'})).facts.harbor,'open');
 await s.domains.save({type:'world-fact',scope:'world',id:s.factId,data:{status:'asserted',value:'closed'},expectedRevision:1,sourceEventId:s.sourceEventId});
 set(app,'sourceRefs',JSON.stringify([{id:s.factId,key:'harbor',revision:2}]));const checked=app.latest.querySelector('[data-field="reviewed"]');checked.checked=true;app.latest.listeners.change({target:checked});await click(app,'select');
 assert.equal((await s.timeline.canonical({timelineId:'ep:timeline:next_session001'})).branchId,'ep:branch:desk_alternate001');assert.equal((await s.domains.read('world-fact','world',s.factId)).revision,2);
});
test('next-session desk loads explicit pins, saves private editable notes and preserves unsaved inputs after rejected assembly',async t=>{
 const previous=globalThis.document,{document,all}=dom();globalThis.document=document;t.after(()=>{globalThis.document=previous;});
 const s=await setup();let handoffs=0;const Window=makeGMSessionPreparationWindow(Base,{service:s.sessions,gameInstance:s.gameInstance,openHandoff:()=>{handoffs++;}}),app=new Window();await app.render();
 await click(app,'load-pins');set(app,'plots','ep:graph:desk_plotA001\nep:graph:desk_plotB001');await click(app,'pin');
 set(app,'sourceRefs',JSON.stringify([{plotId:'ep:graph:desk_plotA001',type:'world-fact',id:s.factId,revision:1}]));await click(app,'prepare');
 set(app,'notes','<script>GM secret</script>');set(app,'agenda',JSON.stringify([{id:'ep:agenda:desk001',text:'Ask about the harbor',referenceIds:[s.factId]}]));await click(app,'edit');
 const row=await s.sessions.read({sessionId:'ep:session:preparation001'});assert.equal(row.data.notes,'<script>GM secret</script>');assert.equal(row.data.plots.length,2);assert.equal(row.data.published,false);
 set(app,'notes','Unsaved new opening');set(app,'sourceRefs','{');await click(app,'prepare');assert.equal(app.latest.querySelector('[data-field="notes"]').value,'Unsaved new opening');assert.equal((await s.sessions.read({sessionId:row.id})).revision,row.revision);
 await click(app,'handoff');assert.equal(handoffs,1);assert.equal((await s.sessions.read({sessionId:row.id})).data.published,false);
 set(app,'sessionId','ep:session:wrong_desk001');await click(app,'edit');assert(all(app.latest).some(n=>n.textContent.includes('Load this exact saved preparation first')));assert.equal(await s.sessions.read({sessionId:'ep:session:wrong_desk001'}),null);
});
test('planning desks refuse player rendering and revoked authority at the action boundary',async t=>{
 const previous=globalThis.document,{document,all}=dom();globalThis.document=document;t.after(()=>{globalThis.document=previous;});
 const s=await setup(),Window=makeGMSessionPreparationWindow(Base,{service:s.sessions,gameInstance:s.gameInstance}),app=new Window();await app.render();s.user.isGM=false;
 await click(app,'load-pins');assert.equal(all(app.latest).some(n=>n.dataset.action),false);assert.equal(app.latest.children[0].textContent,'GM authority required');
 const Timeline=makeGMTimelineBranchWindow(Base,{service:s.timeline,gameInstance:s.gameInstance}),tree=await new Timeline()._renderHTML();assert.equal(all(tree).some(n=>n.dataset.action),false);
 assert.throws(()=>makeGMTimelineBranchWindow(Base,{service:{}}),{code:'TIMELINE_DESK_DEPENDENCY'});assert.throws(()=>makeGMSessionPreparationWindow(Base,{service:{}}),{code:'SESSION_PREPARATION_DESK_DEPENDENCY'});
});
