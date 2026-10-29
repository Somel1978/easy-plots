import {graphCanvas} from './graph-editor.mjs';
const el=(tag,text='')=>{const e=document.createElement(tag);e.textContent=String(text);return e;};
export function makeLiveAppearanceWindow(Base,{gameInstance,registry,sourceGraphId=()=>''}={}){
 return class EasyPlotsLiveAppearance extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-live-appearance',window:{title:'Easy Plots — Live appearance',resizable:true},position:{width:960,height:740}};
  #id='';#view=null;#message='';#busy=false;#zoom=0.75;#title='';#nodes='[]';
  async _renderHTML(){
   const root=el('section');root.className='ep-editor ep-live-appearance';if(!gameInstance.user?.isGM){root.append(el('p','GM authority required'));return root;}root.append(el('h2','Live plot appearance'),el('p','Update the title, node labels and positions on the active view. Structural changes use the graph editor and a new publication.'));
   const field=(key,label,value,area=false)=>{const l=el('label',label),input=el(area?'textarea':'input');l.className='ep-field';input.className='ep-input';input.dataset.field=key;input.value=String(value);if(area)input.rows=7;l.append(input);root.append(l);};
   field('graph-id','Active plot ID',this.#id||sourceGraphId());const button=(action,label)=>{const b=el('button',label);b.type='button';b.dataset.action=action;root.append(b);};button('load-appearance','Load active appearance');
   if(this.#view){field('title','Live title (empty uses the published title)',this.#title);field('nodes','Node labels and positions (JSON; at most64 selected nodes)',this.#nodes,true);button('save-appearance','Save live appearance');button('reset-appearance','Restore published appearance');root.append(el('p',`Published v${this.#view.publishedVersion} · appearance r${this.#view.revision??0}`),graphCanvas(this.#view.graph,null,this.#zoom,{density:'comfortable',expandedNodeIds:[],collapsedNodeIds:[],readOnly:true}));}
   if(this.#view&&registry.authoringRights?.(this.#id)?.edit===false)root.querySelectorAll('[data-action="save-appearance"],[data-action="reset-appearance"]').forEach(b=>{b.disabled=true;});
   if(this.#message)root.append(el('p',this.#message));root.addEventListener('click',event=>{const b=event.target.closest?.('button[data-action]');if(!b||b.disabled||this.#busy)return;void(async()=>{
    this.#busy=true;try{if(!gameInstance.user?.isGM)throw Error('GM authority required');const action=b.dataset.action,id=root.querySelector('[data-field="graph-id"]').value.trim();if(this.#view){this.#title=root.querySelector('[data-field="title"]').value;this.#nodes=root.querySelector('[data-field="nodes"]').value;}if(action==='zoom-in'||action==='zoom-out'){this.#zoom=Math.max(0.25,Math.min(1.5,this.#zoom+(action==='zoom-in'?0.25:-0.25)));}
     else if(action==='load-appearance'){this.#id=id;this.#view=await registry.getAppearance(id);this.#title=this.#view.appearance.title??'';this.#nodes=JSON.stringify(this.#view.appearance.nodes,null,2);this.#message='Active appearance loaded.';}
     else if(['save-appearance','reset-appearance'].includes(action)){if(!this.#view||id!==this.#id)throw Error('Load this exact active plot before editing');if(this.#nodes.length>20000)throw Error('Appearance input exceeds its budget');const title=this.#title.trim();await registry.saveAppearance({graphId:id,publishedVersion:this.#view.publishedVersion,expectedActivationRevision:this.#view.activationRevision,expectedRevision:this.#view.revision,title:action==='reset-appearance'?null:title||null,nodes:action==='reset-appearance'?[]:JSON.parse(this.#nodes)});this.#view=await registry.getAppearance(id);this.#title=this.#view.appearance.title??'';this.#nodes=JSON.stringify(this.#view.appearance.nodes,null,2);this.#message='Live appearance saved. The executable snapshot is unchanged.';}
    }catch(error){this.#message=`Appearance action rejected: ${error.code??error.message}`;}finally{this.#busy=false;await this.render();}
   })();});return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
