/** Foundry v14 ApplicationV2 GM-only graph authoring. Untrusted values are rendered with textContent. */
import {EDITABLE_NODE_TYPES} from '../editor/model.mjs';
import {ALL_EFFECT_NODE_PROVIDER} from '../graph/node-catalog.mjs';
import {LOGIC_NODE_TYPES} from '../graph/logic-nodes.mjs';
import {DATA_NODE_TYPES} from '../graph/typed-data.mjs';
import {localize} from './localization.mjs';
import {renderPlotEditor,nodeName} from './plot-editor-view.mjs';
import {EasyPlotsError} from '../contracts/errors.mjs';

const elem=(tag,cls='',text=null)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==null)el.textContent=String(text);
  return el;
};
const button=(action,text,id=null,cls='ep-button')=>{
  const b=elem('button',cls,localize(`EasyPlots.Graph.Actions.${action}`,text));b.type='button';b.dataset.action=action;if(id)b.dataset.id=id;return b;
};
const field=(key,value='',tag='input')=>{
  const e=elem(tag,'ep-input');e.dataset.field=key;
  if(tag==='input'){e.type='text';e.value=String(value);}else e.value=String(value);
  return e;
};
const selection=(key,options,initial=null)=>{
  const select=elem('select','ep-input');select.dataset.field=key;
  for(const option of options){const opt=elem('option','',option.label);opt.value=option.id;select.append(opt);}
  if(initial!==null)select.value=initial;
  return select;
};
const svgNS='http://www.w3.org/2000/svg';
const svgElem=(tag,attrs={},text=null)=>{const e=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==null)e.textContent=String(text);return e;};
export function graphCanvas(graph,selectedId,zoom=0.75,presentation={density:'comfortable',expandedNodeIds:[],collapsedNodeIds:[]}){
  const frame=elem('div','ep-canvas-frame');
  const coords=new Map(graph.nodes.map((n,i)=>[n.id,{x:n.layout?.x??(60+(i%4)*215),y:n.layout?.y??(95+Math.floor(i/4)*115)}]));
  const dimensions=n=>presentation.expandedNodeIds.includes(n.id)||presentation.density==='expanded'&&!presentation.collapsedNodeIds.includes(n.id)?{width:205,height:96}:presentation.density==='compact'?{width:165,height:40}:{width:165,height:60};
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  const extent={width:Math.max(940,...graph.nodes.map(n=>coords.get(n.id).x+dimensions(n).width+40)),height:Math.max(450,...graph.nodes.map(n=>coords.get(n.id).y+dimensions(n).height+30))};
  const view=svgElem('svg',{class:'ep-graph-canvas',viewBox:`0 0 ${extent.width} ${extent.height}`,role:'img','aria-label':'Narrative graph nodes and directional edges'});
  view.style.width=`${Math.ceil(extent.width*zoom)}px`;
  view.style.height=`${Math.ceil(extent.height*zoom)}px`;
  view.dataset.viewBoxWidth=String(extent.width);
  view.dataset.viewBoxHeight=String(extent.height);
  const defs=svgElem('defs');const marker=svgElem('marker',{id:'ep-arrow',markerWidth:8,markerHeight:8,refX:7,refY:4,orient:'auto'});marker.append(svgElem('path',{d:'M 0 0 L 8 4 L 0 8 Z',fill:'#60a5fa'}));defs.append(marker);view.append(defs);
  for(const edge of graph.edges){
    const start=coords.get(edge.source.nodeId),end=coords.get(edge.target.nodeId);if(!start||!end)continue;
    const from=dimensions(byId.get(edge.source.nodeId)),to=dimensions(byId.get(edge.target.nodeId));
    const x1=start.x+from.width,y1=start.y+from.height/2,x2=end.x,y2=end.y+to.height/2;
    const bend=Math.max(30,Math.abs(x2-x1)/2);
    view.append(svgElem('path',{d:`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`,'stroke':'#60a5fa','stroke-width':2,'fill':'none','marker-end':'url(#ep-arrow)'}));
  }
  for(const n of graph.nodes){
    const size=dimensions(n);
    const p=coords.get(n.id),selected=n.id===selectedId;const group=svgElem('g',{'data-node-id':n.id,transform:`translate(${p.x} ${p.y})`,class:`ep-svg-node${selected?' is-selected':''}`,tabindex:'0',role:'button','aria-label':presentation.friendly?nodeName(n):`${n.typeId} node`});
    group.append(svgElem('rect',{width:size.width,height:size.height,rx:9,fill:selected?'#294269':'#2f374a',stroke:selected?'#93c5fd':'#64748b','stroke-width':selected?2:1}));
    const label=presentation.friendly?nodeName(n):n.label??EDITABLE_NODE_TYPES.find(t=>t.id===n.typeId)?.label??n.typeId;
    group.append(svgElem('text',{x:12,y:25,fill:'#f8fafc','font-size':13,'font-weight':600},label));
    if(size.height>=60)group.append(svgElem('text',{x:12,y:43,fill:'#aeb8ca','font-size':10},presentation.friendly?(n.id===graph.rootNodeId?'START':'STORY STEP'):n.id===graph.rootNodeId?'ROOT TRIGGER':n.typeId.replace('core.','')));
    if(size.height>60){
      group.append(svgElem('text',{x:12,y:62,fill:'#aeb8ca','font-size':10},`${n.ports.filter(p=>p.direction==='input').length} inputs · ${n.ports.filter(p=>p.direction==='output').length} outputs`));
      if(!presentation.friendly)group.append(svgElem('text',{x:12,y:80,fill:'#aeb8ca','font-size':10},n.data?.providerId??n.data?.valueType??n.data?.eventType??n.accessClass));
    }
    view.append(group);
  }
  const toolbar=elem('div','ep-canvas-toolbar');
  toolbar.append(button('zoom-out','−',null,'ep-mini'),elem('span','ep-dim',`${Math.round(zoom*100)}%`),button('zoom-in','+',null,'ep-mini'));
  frame.append(toolbar,view,elem('small','ep-dim',presentation.readOnly?'Active published graph with its separate GM appearance. Change labels and positions in the appearance form.':'Scroll the canvas to navigate. Select or drag a node to reposition it; changes are saved with the draft.'));
  return frame;
}
const labeled=(label,input)=>{const group=elem('label','ep-field');group.append(elem('span','ep-label',label),input);return group;};

export function makeGraphEditorWindow(BaseApplicationV2,{model,isGM=()=>globalThis.game?.user?.isGM===true,focusController=null,openPlotAuthority=null,openLiveAppearance=null,initialView='guided'}={}){
  if(!model)throw new Error('GraphEditorModel required');
  return class EasyPlotsGraphEditor extends BaseApplicationV2 {
    static DEFAULT_OPTIONS={id:'easy-plots-graph-editor',window:{title:'Easy Plots — Graph Editor',resizable:true},position:{width:1040,height:700},classes:['easy-plots-graph-app']};
    #error='';#info='';#preview=null;#published=null;#list=null;#busy=false;#ackWarnings=false;#zoom=0.75;
    #unsubscribe=null;#closed=false;
    #advanced=initialView==='advanced';#formValues=new Map();#active=null;#activationGraph=null;
    get hasUnsavedChanges(){return model.state.dirty||this.#formValues.size>0;}
    constructor(...args){super(...args);if(focusController)this.#unsubscribe=focusController.subscribe(async focus=>{
      if(this.#closed||!isGM()||!focus.graphId||focus.graphId===model.graph?.id)return;
      try{if(this.hasUnsavedChanges)throw new EasyPlotsError('UNSAVED_CHANGES','Save or discard your open plot before following a different scene plot.');await model.load(focus.graphId);this.#preview=null;this.#published=null;this.#error='';}
      catch(error){this.#error=`${error.code??'FOCUS_ERROR'}: ${error.message}`;}
      if(!this.#closed&&isGM())await this.render();
    });}
    async close(options){this.#closed=true;this.#unsubscribe?.();return typeof super.close==='function'?super.close(options):this;}
    async _renderHTML(){
      const root=elem('div','ep-editor');
      if(!isGM()){
        root.append(elem('p','ep-danger','This editor requires GM authority.'));
        return root;
      }
      const state=model.state;
      if(!this.#advanced){
        const key=state.graph?`${state.graph.id}:${state.graph.revision}`:null;
        if(state.graph?.revision>0&&key!==this.#activationGraph){try{this.#active=await model.activation();this.#activationGraph=key;if(this.#active?.active&&!this.#published)this.#published={publishedVersion:this.#active.publishedVersion};}catch(error){this.#error=error.message;}}
        const guided=renderPlotEditor({model,canvas:graphCanvas,error:this.#error,info:this.#info,preview:this.#preview,published:this.#published,active:this.#active,list:this.#list,zoom:this.#zoom,busy:this.#busy,ackWarnings:this.#ackWarnings,values:this.#formValues,onInput:(key,value)=>{if(key==='ack-warnings')this.#ackWarnings=value;else this.#formValues.set(key,value);},onAction:(action,id,root)=>this.#action(action,id,root)});
        guided.addEventListener('keydown',event=>{const node=event.target.closest?.('.ep-svg-node');if(node&&['Enter',' '].includes(event.key)){event.preventDefault();void this.#action('select',node.dataset.nodeId,guided);}});
        let drag=null;
        guided.addEventListener('pointerdown',event=>{const node=event.target.closest?.('.ep-svg-node');if(!node)return;drag={id:node.dataset.nodeId,x:event.clientX,y:event.clientY};node.setPointerCapture?.(event.pointerId);});
        guided.addEventListener('pointerup',event=>{if(!drag)return;const start=drag;drag=null;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)<4||!state.authoringRights?.edit){void this.#action('select',start.id,guided);return;}const node=model.graph.nodes.find(n=>n.id===start.id),svg=guided.querySelector('.ep-graph-canvas'),scale=Number(svg.dataset.viewBoxWidth)/svg.getBoundingClientRect().width;guided.nodeMove={x:Math.min(15000,Math.max(0,(node.layout?.x??0)+dx*scale)),y:Math.min(30000,Math.max(0,(node.layout?.y??0)+dy*scale))};void this.#action('move-node',start.id,guided);});
        guided.addEventListener('pointercancel',()=>{drag=null;});
        return guided;
      }
      const authoringRights=state.authoringRights??{edit:true,publish:true,activate:true};
      const top=elem('header','ep-header');
      const brand=elem('div','ep-brand');brand.append(elem('strong','', 'Easy Plots'),elem('small','',`Graph Editor · ${state.mode==='native'?'Guarded native storage':'Memory-only sandbox'}`));
      const actions=elem('div','ep-actions');
      actions.append(button('guided','Return to guided editor'),button('new','New Plot'),button('discard','Discard Local Edits','', 'ep-button ep-muted'),button('browse','Browse Drafts'));
      if(openPlotAuthority&&state.mode==='native')actions.append(button('plot-permissions','Plot permissions'));
      if(openLiveAppearance&&state.mode==='native')actions.append(button('live-appearance','Live appearance'));
      top.append(brand,actions);root.append(top);
      const banner=elem('div','ep-banner',state.mode==='native'
        ?'Verified native adapter selected; all writes still require current GM authority and repository security checks.'
        :'Sandbox only: drafts and activation are in memory and will disappear after the client session. Nothing is written to the world.');
      root.append(banner);
      if(state.graph&&Object.values(authoringRights).some(v=>v===false))root.append(elem('p','ep-warning',`Plot rights for this GM: edit ${authoringRights.edit?'allowed':'read-only'} · publish ${authoringRights.publish?'allowed':'not delegated'} · activate ${authoringRights.activate?'allowed':'not delegated'}`));
      if(this.#error)root.append(elem('div','ep-error',this.#error));
      if(this.#info)root.append(elem('div','ep-notice',this.#info));
      if(this.#list){
        const list=elem('section','ep-draft-browser');list.append(elem('strong','', 'Drafts in selected scope'));
        for(const g of this.#list.items)list.append(button('load',`${g.title} · r${g.revision}`,g.id,'ep-button ep-draft-entry'));
        if(this.#list.nextCursor)list.append(button('browse-next','More drafts'));
        root.append(list);
      }
      if(!state.graph){
        const empty=elem('section','ep-empty');empty.append(elem('h3','', 'No plot selected'),elem('p','', 'Create a graph, or browse an indexed draft partition. You can also open a known graph ID.'));
        empty.append(labeled('Known graph ID',field('open-id','ep:graph:')));
        empty.append(button('open-id','Open Existing Draft'));
        root.append(empty);
      } else {
        const graph=state.graph;
        const displayed=model.viewGraph;
        const bar=elem('section','ep-graph-bar');
        bar.append(labeled('Plot title',field('title',graph.title??'')));
        bar.append(button('rename','Rename'),button('save','Save Draft'),button('preview','Validate'));
        bar.append(button('publish','Publish Inactive'),button('activate','Activate Last Published'),button('deactivate','Deactivate'));
        bar.append(elem('small','ep-revision',`Draft r${graph.revision} · ${state.dirty?'Unsaved changes':'Saved'} · ${graph.nodes.length} nodes · ${graph.edges.length} edges`));
        root.append(bar);
        const layout=elem('section','ep-columns');
        const left=elem('div','ep-panel ep-map');left.append(elem('h3','', 'Narrative Graph'));
        const viewOptions=elem('div','ep-inline');
        viewOptions.append(labeled('View layer',selection('view-layer',[{id:'all',label:'All layers'},{id:'narrative',label:'Narrative'},{id:'execution',label:'Execution'},{id:'knowledge',label:'Knowledge'}],state.view.layer)),button('set-view-layer','Show layer'));
        viewOptions.append(labeled('Node density',selection('view-density',[{id:'compact',label:'Compact'},{id:'comfortable',label:'Comfortable'},{id:'expanded',label:'Expanded'}],state.view.density)),button('set-view-density','Apply density'));
        left.append(viewOptions);
        if(displayed.hiddenNodeCount)left.append(elem('small','ep-dim',`${displayed.hiddenNodeCount} nodes in other layers · ${displayed.boundaryEdgeCount} connections cross this view`));
        left.append(graphCanvas(displayed,state.selectedNodeId,this.#zoom,state.view));
        const nodes=elem('div','ep-nodes');
        for(const n of displayed.nodes){
          const chosen=n.id===state.selectedNodeId;
          const label=EDITABLE_NODE_TYPES.find(t=>t.id===n.typeId)?.label??n.typeId;
          const box=button('select',label,n.id,`ep-node ${chosen?'is-selected':''}`);
          box.append(elem('small','',`${n.id===graph.rootNodeId?'ROOT · ':''}${n.typeId}`));
          nodes.append(box);
        }
        left.append(nodes);
        const rootTrigger=elem('div','ep-inline');
        rootTrigger.append(labeled('Root event source',selection('root-trigger',[
          {id:'core.trigger.event',label:'Generic event'},
          {id:'core.trigger.manual',label:'GM manual'},
          {id:'core.trigger.schedule-due',label:'Verified due commitment'},
          {id:'core.trigger.document-event',label:'Native document Hook'},
          {id:'core.trigger.operations-completed',label:'After verified completed operations'},
          {id:'core.trigger.reviewed-plan',label:'Reviewed planning intent'},
          {id:'core.trigger.encounter-closed',label:'Selected verified encounter closure'}
        ],graph.nodes.find(n=>n.id===graph.rootNodeId)?.typeId)),button('change-root-trigger','Apply root source'));
        left.append(rootTrigger);
        const add=elem('div','ep-inline');
        add.append(selection('node-type',model.availableNodeTypes()),button('add-node','Add Node'));
        left.append(add);
        left.append(elem('h4','', 'Connections'));
        const connections=elem('div','ep-edges');
        for(const edge of displayed.edges){
          const n1=graph.nodes.find(n=>n.id===edge.source.nodeId),n2=graph.nodes.find(n=>n.id===edge.target.nodeId);
          const line=elem('div','ep-edge');
          line.append(elem('span','',`${edge.kind}: ${n1?.typeId??'?'} [${edge.source.portId}] → ${n2?.typeId??'?'} [${edge.target.portId}]`),button('disconnect','×',edge.id,'ep-mini'));
          connections.append(line);
        }
        if(!displayed.edges.length)connections.append(elem('small','ep-dim','No connections in this view'));
        left.append(connections);
        const connectionBuilder=elem('div','ep-connect');
        connectionBuilder.append(labeled('From output',selection('edge-output',displayed.nodes.flatMap(n=>n.ports.filter(p=>p.direction==='output').map(p=>({id:`${n.id}|${p.id}`,label:`${n.typeId} / ${p.id}`}))))));
        connectionBuilder.append(labeled('To',selection('edge-target',displayed.nodes.filter(n=>n.ports.some(p=>p.direction==='input')).map(n=>({id:n.id,label:n.typeId})))));
        connectionBuilder.append(labeled('Exact input (optional)',selection('edge-input',[{id:'',label:'Automatic matching input'},...displayed.nodes.flatMap(n=>n.ports.filter(p=>p.direction==='input').map(p=>({id:`${n.id}|${p.id}`,label:`${n.typeId} / ${p.id} / ${p.valueType}`})))],'')));
        connectionBuilder.append(button('connect','Connect Nodes'));
        left.append(connectionBuilder);
        const right=elem('div','ep-panel ep-inspector');right.append(elem('h3','', 'Inspector'));
        const selected=displayed.nodes.find(n=>n.id===state.selectedNodeId);
        if(selected){
          right.append(elem('div','ep-type',selected.typeId));
          right.append(elem('small','ep-dim',selected.id));
          right.append(labeled('Node view layer',selection('node-view-layer',[{id:'narrative',label:'Narrative'},{id:'execution',label:'Execution'},{id:'knowledge',label:'Knowledge'}],model.nodeLayer(selected))),button('set-node-view-layer','Assign view layer'),button('toggle-node-density',model.isNodeExpanded(selected.id)?'Collapse node':'Expand node'));
          if(['core.trigger.event','core.trigger.manual','core.trigger.schedule-due','core.trigger.document-event'].includes(selected.typeId)){right.append(labeled('Foundry/narrative event type',field('event-type',selected.data.eventType)));
            right.append(labeled('Allowed source kinds (JSON, empty = any)',field('trigger-kinds',JSON.stringify(selected.data.sourceKinds??[]),'textarea')));}
          if(['core.condition','core.branch.condition'].includes(selected.typeId))right.append(labeled('Structured condition (JSON)',field('condition-json',JSON.stringify(selected.data.condition,null,2),'textarea')));
          if(DATA_NODE_TYPES.includes(selected.typeId)||LOGIC_NODE_TYPES.includes(selected.typeId)||selected.typeId==='core.state.read'||selected.typeId==='core.subgraph.call'||selected.typeId==='core.flow.join'||selected.typeId==='core.trigger.operations-completed')right.append(labeled('Node configuration (JSON)',field('payload-json',JSON.stringify(selected.data,null,2),'textarea')));
          if(selected.typeId==='core.milestone.qualify')right.append(labeled('Milestone ID',field('milestone-id',selected.data.milestoneId)));
          if((selected.typeId==='core.effect.proposal'||Object.hasOwn(ALL_EFFECT_NODE_PROVIDER,selected.typeId)||selected.providerVersion)){
            if(selected.typeId==='core.effect.proposal'){
            right.append(labeled('Capability provider',field('provider-id',selected.data.providerId)));
            }
            right.append(labeled('Proposed payload (JSON)',field('payload-json',JSON.stringify(selected.data.payload??{},null,2),'textarea')));
            if(!selected.providerVersion){
              right.append(labeled('Payload field to bind',selection('binding-field',Object.keys(selected.data.payload??{}).map(id=>({id,label:id})))));
              right.append(labeled('Value source',selection('binding-source',graph.nodes.flatMap(n=>DATA_NODE_TYPES.includes(n.typeId)?n.ports.filter(p=>p.direction==='output'&&p.valueType!=='event').map(p=>({id:`${n.id}|${p.id}`,label:`${n.typeId} / ${p.valueType} / ${n.id}`})):[]))));
              right.append(button('bind-data','Bind Value'));
              for(const field of Object.keys(selected.data.inputBindings??{}))right.append(button('unbind-data',`Unbind ${field}`,field,'ep-mini'));
            }
            right.append(elem('p','ep-warning','Effect nodes propose operations only. Publishing a graph does not execute them.'));
          }
          const na=elem('div','ep-actions');na.append(button('update-node','Apply Node Changes'));
          if(selected.id!==graph.rootNodeId)na.append(button('remove-node','Remove Node','', 'ep-button ep-danger-btn'));
          right.append(na);
        } else right.append(elem('p','ep-dim','Select a node to inspect it.'));
        if(this.#preview){
          const pre=elem('div','ep-validation');pre.append(elem('strong','',`Validation: ${this.#preview.ok?'passed':'failed'}`));
          pre.append(elem('p','',`${this.#preview.nodeCount} nodes · ${this.#preview.edgeCount} edges`));
          for(const warning of this.#preview.warnings??[])pre.append(elem('small','ep-warning',`${warning.code}: ${warning.nodeId}`));
          right.append(pre);
        }
        if(this.#preview?.warnings?.length){
          const label=elem('label','ep-warning-ack');const check=elem('input');check.type='checkbox';check.dataset.field='ack-warnings';check.checked=this.#ackWarnings;
          label.append(check,elem('span','', 'I have reviewed the reachability warnings for this revision.'));right.append(label);
        }
        if(this.#published)right.append(elem('div','ep-notice',`Latest published snapshot v${this.#published.publishedVersion}; activation requires a separate action.`));
        layout.append(left,right);root.append(layout);
      }
      let drag=null;
      for(const button of root.querySelectorAll('button[data-action]')){const action=button.dataset.action;if(!authoringRights.edit&&['rename','save','change-root-trigger','add-node','remove-node','update-node','connect','disconnect','bind-data','unbind-data'].includes(action)||!authoringRights.publish&&action==='publish'||!authoringRights.activate&&['activate','deactivate'].includes(action))button.disabled=true;}
      root.addEventListener('pointerdown',event=>{const nodeEl=event.target.closest?.('.ep-svg-node');if(!nodeEl)return;if(!authoringRights.edit){model.selectNode(nodeEl.dataset.nodeId);void this.render();return;}drag={id:nodeEl.dataset.nodeId,x:event.clientX,y:event.clientY};nodeEl.setPointerCapture?.(event.pointerId);});
      root.addEventListener('pointerup',event=>{
        if(!drag)return;const start=drag;drag=null;const graph=model.state.graph;const node=graph?.nodes.find(n=>n.id===start.id);if(!node)return;
        const dx=event.clientX-start.x,dy=event.clientY-start.y;
        if(Math.abs(dx)+Math.abs(dy)<4){model.selectNode(start.id);void this.render();return;}
        const svg=root.querySelector('.ep-graph-canvas');
        const width=svg?.getBoundingClientRect?.().width||940;
        const scale=Number(svg?.dataset.viewBoxWidth??940)/width;
        try{model.moveNode(start.id,{x:Math.min(15000,Math.max(0,(node.layout?.x??0)+dx*scale)),y:Math.min(30000,Math.max(0,(node.layout?.y??0)+dy*scale))});this.#info='Node moved; save the draft to persist the layout.';}
        catch(err){this.#error=`${err.code??'POSITION_ERROR'}: ${err.message}`;}
        void this.render();
      });
      root.addEventListener('click',event=>{
        const b=event.target.closest('button[data-action]');if(b&&root.contains(b))void this.#action(b.dataset.action,b.dataset.id,root);
      });
      return root;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
    async #action(action,id,root){
      if(this.#busy)return;
      if(!isGM()){this.#error='GM authority is required';await this.render();return;}
      const v=key=>root.querySelector(`[data-field="${key}"]`)?.value;
      this.#busy=true;this.#error='';this.#info='';
      root.setAttribute('aria-busy','true');for(const b of root.querySelectorAll('button'))b.disabled=true;
      const progress={save:'Saving…',publish:'Publishing…',activate:'Activating…',deactivate:'Deactivating…',browse:'Loading plots…'}[action];if(progress&&!this.#advanced){const activeButton=root.querySelector(`[data-action="${action}"]`);if(activeButton)activeButton.textContent=progress;}
      try{
        if(!this.#advanced&&this.#formValues.size&&!['discard','new','load','browse','browse-next','close-browser'].includes(action)){
          if(this.#formValues.has('title')&&v('title')!==model.graph?.title)model.rename(v('title'));
          if([...this.#formValues.keys()].some(key=>key.startsWith('config.')))model.updateSelected(root.readNodeChanges?.()??{});
          if(this.#formValues.has('root-trigger')&&action!=='change-root-trigger')model.setRootTriggerType(v('root-trigger'));
          this.#formValues.clear();
        }
        switch(action){
          case 'advanced':this.#advanced=true;break;
          case 'guided':this.#advanced=false;break;
          case 'close-browser':this.#list=null;break;
          case 'plot-permissions':await openPlotAuthority?.();break;
          case 'live-appearance':await openLiveAppearance?.();break;
          case 'zoom-in':this.#zoom=Math.min(1.5,Math.round((this.#zoom+0.25)*100)/100);break;
          case 'zoom-out':this.#zoom=Math.max(0.25,Math.round((this.#zoom-0.25)*100)/100);break;
          case 'set-view-layer':model.setViewLayer(v('view-layer'));break;
          case 'set-view-density':model.setViewDensity(v('view-density'));break;
          case 'set-node-view-layer':model.setNodeViewLayer(model.state.selectedNodeId,v('node-view-layer'));break;
          case 'toggle-node-density':model.toggleNodeExpansion(model.state.selectedNodeId);break;
          case 'new':{
            if(this.hasUnsavedChanges)throw Error('Unsaved edits exist. Save or explicitly discard before opening another plot.');
            model.newGraph('Untitled Plot');if(!this.#advanced)model.setRootTriggerType('core.trigger.manual');this.#preview=null;this.#published=null;this.#active=null;this.#activationGraph=null;break;
          }
          case 'discard':model.discardUnsaved();this.#formValues.clear();this.#preview=null;this.#published=null;this.#active=null;this.#activationGraph=null;break;
          case 'rename':model.rename(v('title'));break;
          case 'change-root-trigger':model.setRootTriggerType(v('root-trigger'));this.#preview=null;break;
          case 'add-node':model.addNode(v('node-type'));break;
          case 'select':model.selectNode(id);break;
          case 'move-node':model.moveNode(id,root.nodeMove);break;
          case 'remove-node':model.removeNode(model.state.selectedNodeId);break;
          case 'update-node':model.updateSelected(!this.#advanced?root.readNodeChanges?.()??{}:{eventType:v('event-type'),sourceKindsJSON:v('trigger-kinds'),conditionJSON:v('condition-json'),providerId:v('provider-id'),payloadJSON:v('payload-json'),milestoneId:v('milestone-id')});break;
          case 'connect':{const [sourceId,sourcePortId]=(v('edge-output')??'').split('|');const [targetId,targetPortId]=(v('edge-input')??'').split('|');model.connect(sourceId,targetId||v('edge-target'),{sourcePortId,targetPortId:targetPortId??null});break;}
          case 'bind-data':{const [sourceNodeId,sourcePortId]=(v('binding-source')??'').split('|');model.bindSelectedInput({field:v('binding-field'),sourceNodeId,sourcePortId});break;}
          case 'unbind-data':model.unbindSelectedInput(id);break;
          case 'disconnect':model.disconnect(id);break;
          case 'preview':this.#preview=model.preview();this.#ackWarnings=false;break;
          case 'save':await model.save();this.#info='Draft saved successfully.';break;
          case 'publish':this.#ackWarnings=Boolean(root.querySelector('[data-field="ack-warnings"]')?.checked);this.#published=await model.publish({acknowledgeWarnings:this.#ackWarnings});this.#info=this.#advanced?'Published immutable snapshot. Activation remains separate.':'Version published. Activate it when you are ready to use it for new events.';break;
          case 'activate':{
            if(!this.#published)throw Error('Publish a validated snapshot first.');
            const activation=await model.activate(this.#published.publishedVersion);this.#active=activation;this.#info=activation.cleanupWarning
              ?`Activation succeeded; stale subscription cleanup needs GM reconciliation: ${activation.cleanupWarning}.`
              :this.#advanced?'Activation and event-type subscriptions updated. Native Hooks still require separate GM verification and explicit opt-in; effects are review-only.':'Plot activated. New matching events can use this version; proposed consequences still require review.';break;
          }
          case 'deactivate':{const result=await model.deactivate();this.#active=result;this.#info=result?.cleanupWarning
            ?`Graph deactivated; stale subscription cleanup needs review: ${result.cleanupWarning}.`
            :'Activation record updated; no graph effects are running.';break;}
          case 'browse':this.#list=await model.listDrafts({limit:12});break;
          case 'browse-next':this.#list=await model.listDrafts({limit:12,cursor:this.#list?.nextCursor});break;
          case 'load':if(this.#formValues.size)throw Error('Save or discard your form changes before opening another plot.');await model.load(id);this.#list=null;this.#preview=null;this.#published=null;this.#active=null;this.#activationGraph=null;break;
          case 'open-id':await model.load(v('open-id'));this.#list=null;this.#preview=null;this.#published=null;break;
          default:throw Error('Unknown editor action');
        }
      }catch(err){this.#error=`${err.code??'EDITOR_ERROR'}: ${err.message}`;}
      finally{this.#busy=false;await this.render();}
    }
  };
}
