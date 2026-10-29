/** Guided authoring surface; all mutations still pass through GraphEditorModel. */
import {ALL_EFFECT_NODE_PROVIDER} from '../graph/node-catalog.mjs';
import {DATA_NODE_TYPES} from '../graph/typed-data.mjs';
import {LOGIC_NODE_TYPES} from '../graph/logic-nodes.mjs';
import {renderStepLibrary} from './step-library.mjs';

const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=String(text);n.className=cls;return n;};
const button=(action,text,id=null)=>{const n=el('button',text);n.type='button';n.dataset.action=action;if(id)n.dataset.id=id;return n;};
const label=(text,input,help='')=>{const n=el('label',text);n.append(input);if(help)n.append(el('small',help,'ep-form-help'));return n;};
const input=(key,value,type='text')=>{const n=el('input');n.type=type;n.dataset.field=key;if(type==='checkbox')n.checked=!!value;else n.value=String(value??'');return n;};
const select=(key,choices,value)=>{const n=el('select');n.dataset.field=key;for(const [id,text] of choices){const o=el('option',text);o.value=id;n.append(o);}n.value=value;return n;};
const human=value=>String(value).replace(/^core\./,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_.]/g,' ').replace(/\bId\b/g,'reference').replace(/\bIds\b/g,'references').replace(/^./,c=>c.toUpperCase());
export const nodeName=node=>node?.label??({'core.trigger.manual':'GM starts the plot','core.trigger.event':'Story event','core.trigger.document-event':'Document changes','core.trigger.schedule-due':'Scheduled commitment','core.condition':'Check a condition','core.branch.condition':'Choose between two paths','core.effect.proposal':'Propose a consequence','core.flow.join':'Join story paths','core.milestone.qualify':'Reach a milestone'})[node?.typeId]??human(node?.typeId??'Missing step');
const portName=value=>({in:'Input',out:'Continue',true:'When true',false:'When false',match:'When matched',mismatch:'When different',absent:'When missing'})[value]??human(value);
const events=[['narrative.manual','When the GM starts this plot'],['evidence.discovered','When evidence is discovered'],['narrative.schedule-due','When a scheduled commitment is due'],['foundry.actor.updated','When a character is updated'],['narrative.reviewed-plan','When a plan is reviewed'],['narrative.encounter-closed','When an encounter is closed']];

export function renderPlotEditor({model,canvas,error,info,preview,published,active,list,zoom,busy,ackWarnings=false,values,onInput,onAction,libraryState={},outline=false}){
  const state=model.state,graph=state.graph,rights=state.authoringRights??{edit:true,publish:true,activate:true};
  const root=el('section','',`ep-plot-builder${outline?' is-outline':''}`);
  const heading=el('header','','ep-plot-heading'),intro=el('div');intro.append(el('h2','Plot editor'),el('p','Build a story flow, check it, then decide when it becomes active.','ep-dim'));
  const tools=el('div','','ep-plot-actions');tools.append(button('browse','Browse plots'),button('advanced','Advanced editor'));heading.append(intro,tools);root.append(heading);
  if(error){const box=el('div','','ep-error');box.setAttribute('role','alert');box.append(el('strong','The action could not be completed.'),el('p',error.replace(/^[A-Z_]+:\s*/,'')));const details=el('details'),summary=el('summary','Technical details');details.append(summary,el('p',error));box.append(details);root.append(box);}
  if(info){const notice=el('p',info,'ep-notice');notice.setAttribute('role','status');root.append(notice);}
  if(list){const browser=el('section','','ep-plot-section');browser.append(el('h3','Saved plots'));if(!list.items.length)browser.append(el('p','No saved plots on this page.'));for(const row of list.items)browser.append(button('load',row.title??'Untitled plot',row.id));if(list.nextCursor)browser.append(button('browse-next','Next page'));browser.append(button('close-browser','Close plot list'));root.append(browser);}
  if(!graph){const empty=el('section','','ep-plot-section');empty.append(el('h3','Create your first plot'),el('p','Start with a name and choose how the story begins. You can save a draft at any time.'));const create=button('new','New plot');create.className='ep-primary';empty.append(create);root.append(empty);bind();return root;}
  const progress=el('ol','','ep-plot-progress');for(const [text,current] of [['1 · Draft',!published&&!active?.active],['2 · Published',!!published&&!active?.active],['3 · Active',!!active?.active]]){const li=el('li',text,current?'is-current':'');progress.append(li);}root.append(progress);
  const identity=el('div','','ep-plot-identity');const title=label('Plot name',input('title',graph.title));title.className='ep-plot-title';intro.replaceChildren(el('small','Plots / '+graph.title,'ep-plot-breadcrumb'),title,el('p','Follow the story. Let the players choose the route.','ep-dim'));
  const bar=el('div','','ep-plot-actions'),save=button('save','Save draft');save.className='ep-primary';save.disabled=!rights.edit;
  const check=button('preview','Validate'),publish=button('publish','Publish inactive'),activate=button('activate','Activate'),deactivate=button('deactivate','Deactivate');publish.disabled=!rights.publish||state.dirty;publish.title=state.dirty?'Save your changes before publishing.':'Create an immutable version of this draft.';activate.disabled=!rights.activate||!published;activate.title=published?'Use this published version for new events.':'Publish this draft before activating it.';deactivate.disabled=!rights.activate||!active?.active;
  bar.append(save,check);const saved=el('span',state.dirty||values.size?'Changes pending…':graph.revision>0?'Saved to this world':'Not saved yet','ep-dim');saved.dataset.saveState='';saved.setAttribute('role','status');saved.setAttribute('aria-live','polite');bar.append(saved,publish,activate);identity.append(bar);root.append(identity);
  if(!rights.edit)root.append(el('p','You can inspect this plot. Editing has not been delegated to your GM account.','ep-workspace-banner'));
  const grid=el('div','','ep-plot-grid'),flow=el('section','','ep-plot-section ep-editor-map');const flowHead=el('nav','','ep-editor-tabs');flowHead.setAttribute('aria-label','Plot layers');for(const [id,text] of [['all','Narrative'],['execution','Execution'],['knowledge','Knowledge']]){const tab=button('view-layer',text,id);tab.setAttribute('aria-current',state.view.layer===id?'page':'false');flowHead.append(tab);}flowHead.append(el('small',`${graph.nodes.length} ${graph.nodes.length===1?'step':'steps'}`),button('show-library','＋ Add step'));flow.append(flowHead);
  const trigger=graph.nodes.find(n=>n.id===graph.rootNodeId);
  const start=el('div','','ep-plot-start');start.append(label('How does this plot start?',select('root-trigger',[
    ['core.trigger.manual','The GM starts it'],['core.trigger.event','A story event happens'],['core.trigger.document-event','A Foundry document changes'],['core.trigger.schedule-due','A scheduled commitment is due'],['core.trigger.reviewed-plan','A plan is reviewed'],['core.trigger.encounter-closed','An encounter is closed'],['core.trigger.operations-completed','Earlier operations are completed'],['core.trigger.resource-activation','Resources are reviewed for activation']
  ],trigger.typeId)),button('change-root-trigger','Set start'));
  flow.append(canvas(model.viewGraph,state.selectedNodeId,zoom,{...state.view,friendly:true}));
  const nodes=el('div','','ep-nodes');for(const node of graph.nodes){const b=button('select',nodeName(node),node.id);b.className=`ep-node${node.id===state.selectedNodeId?' is-selected':''}`;b.setAttribute('aria-pressed',String(node.id===state.selectedNodeId));nodes.append(b);}flow.append(nodes);
  flow.append(renderStepLibrary({types:model.availableNodeTypes(),selectedNode:graph.nodes.find(n=>n.id===state.selectedNodeId),state:libraryState,canEdit:rights.edit}));
  const connect=el('details');connect.append(el('summary','Connect story steps'));const from=graph.nodes.flatMap(n=>n.ports.filter(p=>p.direction==='output').map(p=>[`${n.id}|${p.id}`,`${nodeName(n)} · ${portName(p.id)}`]));const to=graph.nodes.flatMap(n=>n.ports.filter(p=>p.direction==='input').map(p=>[`${n.id}|${p.id}`,`${nodeName(n)} · ${portName(p.id)}`]));connect.append(label('From step and output',select('edge-output',from,from[0]?.[0])),label('To step and input',select('edge-input',to,to[0]?.[0])));const connectButton=button('connect','Connect steps');connectButton.disabled=!from.length||!to.length;connect.append(connectButton);flow.append(connect);
  const connections=el('div','','ep-edges');for(const edge of graph.edges){const a=graph.nodes.find(n=>n.id===edge.source.nodeId),b=graph.nodes.find(n=>n.id===edge.target.nodeId),row=el('div','','ep-edge');row.append(el('span',`${nodeName(a)} → ${nodeName(b)}`),button('disconnect','Remove connection',edge.id));connections.append(row);}if(graph.edges.length)connect.append(connections);
  const inspector=el('section','','ep-plot-section ep-step-inspector');const selected=model.viewGraph.nodes.find(n=>n.id===state.selectedNodeId);
  inspector.append(el('small','Step inspector','ep-kicker'),el('h3',selected?nodeName(selected):'Step details'));
  if(selected){inspector.append(label('Step name',input('node-label',selected.label??nodeName(selected)),'Use a name that describes this step’s place in your story.'));if(selected.id===graph.rootNodeId)inspector.append(start);const form=nodeForm(selected,values);inspector.append(form.element);root.readNodeChanges=form.read;const apply=button('update-node','Apply step changes');apply.disabled=!rights.edit;inspector.append(apply);if(selected.id!==graph.rootNodeId)inspector.append(button('remove-node','Remove step'));}
  else inspector.append(el('p','Select a story step to edit its details.'));
  if(preview){const report=el('section','','ep-validation');report.setAttribute('role','status');report.append(el('strong',preview.ok?'Plot check passed':'Plot needs attention'),el('p',`${preview.nodeCount} steps · ${preview.edgeCount} connections`));for(const warning of preview.warnings??[]){const n=graph.nodes.find(n=>n.id===warning.nodeId);report.append(el('p',`${human(warning.code)}${n?` · ${nodeName(n)}`:''}`));}inspector.append(report);if(preview.warnings?.length){const ack=label('I have reviewed the warnings for this draft.',input('ack-warnings',ackWarnings,'checkbox'));ack.className='ep-warning-ack';inspector.append(ack);}}
  if(published)inspector.append(el('p',`Published version ${published.publishedVersion}. ${active?.active?'This plot is active.':'Activate when you are ready.'}`,'ep-notice'));
  grid.append(flow,inspector);root.append(grid);
  const more=el('details','','ep-plot-options');more.append(el('summary','Plot options'),el('p','Publishing preserves a version. Activation makes it available to events. Proposed effects still need their own review.','ep-form-help'),button('discard','Discard unsaved changes'),button('plot-permissions','Plot permissions'),button('live-appearance','Active plot appearance'),deactivate);root.append(more);
  const summary=el('header','','ep-plot-summary');summary.append(heading,identity);for(const message of [...root.children].filter(n=>n.classList.contains('ep-error')||n.classList.contains('ep-notice')))summary.append(message);root.prepend(summary);const footer=el('footer','','ep-plot-footer');footer.append(el('small',`Draft ${graph.revision} · ${active?.active?`Active version ${active.publishedVersion}`:'No active version'} · Proposed effects remain unapplied`),progress);root.append(footer);
  bind();return root;

  function bind(){
    for(const control of root.querySelectorAll('[data-field]')){if(values.has(control.dataset.field)){if(control.type==='checkbox')control.checked=values.get(control.dataset.field);else control.value=values.get(control.dataset.field);}}
    root.addEventListener('input',event=>{const control=event.target;if(!control.dataset.field||['node-search','node-type','edge-input','edge-output'].includes(control.dataset.field))return;onInput(control.dataset.field,control.type==='checkbox'?control.checked:control.value);const status=root.querySelector('[data-save-state]');if(status)status.textContent='Unsaved changes';});
    root.addEventListener('click',event=>{const b=event.target.closest('button[data-action]');if(b&&root.contains(b)&&!b.disabled)void onAction(b.dataset.action,b.dataset.id,root);});
    if(busy)for(const b of root.querySelectorAll('button'))b.disabled=true;
    if(!rights.edit){for(const field of root.querySelectorAll('input,select,textarea'))field.disabled=true;for(const b of root.querySelectorAll('button[data-action]'))if(['new','discard','change-root-trigger','add-node','connect','disconnect','update-node','remove-node'].includes(b.dataset.action))b.disabled=true;}
  }
}

/** Typed controls edit plain values; complex structures remain intact until explicitly edited. */
function nodeForm(node,values){
  const root=el('div','','ep-form-grid'),readers=[];
  const editable=(data,prefix)=>{
    const copy=structuredClone(data);
    const walk=(object,parent,path=[],depth=0)=>{for(const [key,value] of Object.entries(object)){const next=[...path,key],name=`config.${prefix}.${next.join('.')}`;
      if(value&&typeof value==='object'&&!Array.isArray(value)&&depth<4){const group=el('fieldset');group.append(el('legend',human(key)));walk(value,group,next,depth+1);parent.append(group);continue;}
      if(value!==null&&typeof value==='object'&&!Array.isArray(value)||Array.isArray(value)&&value.some(v=>v!==null&&typeof v==='object')){parent.append(el('p',`${human(key)} uses a structured configuration. Open Advanced editor to change it.`,'ep-form-help'));continue;}
      let control;if(typeof value==='boolean')control=select(name,[['true','Yes'],['false','No']],String(value));else if(Array.isArray(value)){control=el('textarea');control.dataset.field=name;control.value=value.join('\n');}else control=input(name,value,typeof value==='number'?'number':'text');
      if(typeof value==='number')control.step='any';
      const help=Array.isArray(value)?'One value per line.':/Id(s)?$/.test(key)?'Use an existing campaign reference. Guided record selection is still being integrated.':'';
      const initial=control.value;parent.append(label(human(key),control,help));readers.push(()=>{let result=control.value;if(result===initial)return;if(typeof value==='boolean')result=result==='true';else if(typeof value==='number'){if(!result.trim()||!Number.isFinite(Number(result)))throw Error(`${human(key)} must be a number.`);result=Number(result);}else if(Array.isArray(value)){result=result.split('\n').map(v=>v.trim()).filter(Boolean);if(value.length&&value.every(v=>typeof v==='number')){if(result.some(v=>!Number.isFinite(Number(v))))throw Error(`${human(key)} requires numeric values.`);result=result.map(Number);}}else if(value===null&&!result)result=null;let target=copy;for(const part of path)target=target[part];target[key]=result;});
    }};walk(data,root);return ()=>{for(const reader of readers)reader();return copy;};
  };
  if(node.typeId.startsWith('core.trigger.')&&node.typeId!=='core.trigger.operations-completed'){
    const choices=events.some(([v])=>v===node.data.eventType)?events:[...events,[node.data.eventType,'Custom event (configured in Advanced editor)']];
    if(node.typeId==='core.trigger.manual')root.append(el('p','This plot starts from a GM-reviewed manual event. It does not run merely because you open or save it.'));
    const event=select('config.event-type',choices,node.data.eventType);if(node.typeId==='core.trigger.event')root.append(label('Story event',event));
    else root.append(el('p',`Start: ${choices.find(([v])=>v===node.data.eventType)?.[1]??'Configured story event'}`,'ep-form-help'));
    return {element:root,read:()=>({eventType:event.value,sourceKindsJSON:JSON.stringify(node.data.sourceKinds??[])})};
  }
  if(['core.condition','core.branch.condition'].includes(node.typeId)){
    const condition=node.data.condition;
    if(condition?.op!=='compare'||condition.left?.type!=='reference'||condition.right?.type!=='literal'||!['boolean','number','string'].includes(typeof condition.right.value)){root.append(el('p','This step uses a compound condition. Open Advanced editor to inspect or change its expression.'));return {element:root,read:()=>({conditionJSON:JSON.stringify(condition)})};}
    const path=condition.left.path.join('.'),paths=[['event.verified','The event has been verified'],['event.type','The story event type'],['event.actorId','The character in the event']];if(!paths.some(([id])=>id===path))paths.push([path,'Custom value (set in Advanced editor)']);
    const left=select('config.condition-left',paths,path),op=select('config.condition-op',[['eq','Is equal to'],['neq','Is different from'],['gt','Is greater than'],['gte','Is at least'],['lt','Is less than'],['lte','Is at most'],['contains','Contains text']],condition.operator),value=condition.right.value;
    const valueType=select('config.condition-type',[['boolean','Yes / no'],['number','Number'],['string','Text']],values.get('config.condition-type')??typeof value);
    const makeRight=()=>valueType.value==='boolean'?select('config.condition-value',[['true','Yes'],['false','No']],typeof value==='boolean'?String(value):'true'):input('config.condition-value',typeof value===valueType.value?value:'',valueType.value==='number'?'number':'text');
    let right=makeRight();const slot=el('div');slot.append(label('Compare with',right));valueType.addEventListener('input',()=>{right=makeRight();slot.replaceChildren(label('Compare with',right));right.dispatchEvent(new Event('input',{bubbles:true}));});
    root.append(label('Value to check',left),label('Comparison',op),label('Comparison value type',valueType),slot);return {element:root,read:()=>{if(valueType.value==='number'&&(!right.value.trim()||!Number.isFinite(Number(right.value))))throw Error('Compare with must contain a number.');return {conditionJSON:JSON.stringify({...condition,operator:op.value,left:{...condition.left,path:left.value.split('.')},right:{type:'literal',value:valueType.value==='boolean'?right.value==='true':valueType.value==='number'?Number(right.value):right.value}})};}};
  }
  if(node.typeId==='core.milestone.qualify'){const milestone=input('config.milestone',node.data.milestoneId);root.append(label('Milestone reference',milestone,'Choose an existing milestone reference. The milestone browser is still being integrated.'));return {element:root,read:()=>({milestoneId:milestone.value})};}
  const effect=node.typeId==='core.effect.proposal'||Object.hasOwn(ALL_EFFECT_NODE_PROVIDER,node.typeId);
  if(effect)root.append(el('p','This step proposes a consequence for review. It does not execute changes while you edit.','ep-form-help'));
  const allData=DATA_NODE_TYPES.includes(node.typeId)||LOGIC_NODE_TYPES.includes(node.typeId)||['core.state.read','core.subgraph.call','core.flow.join','core.trigger.operations-completed'].includes(node.typeId)||node.providerVersion;
  const read=editable(allData?node.data:node.data.payload??{},'data');
  return {element:root,read:()=>({payloadJSON:JSON.stringify(read()),...(node.typeId==='core.effect.proposal'?{providerId:node.data.providerId}:{})})};
}
