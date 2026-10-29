import {secureUUID} from '../contracts/digest.mjs';
import {validatePortableTemplate} from '../graph/portable-template.mjs';
const el=(tag,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=String(text);return e;};
const uid=kind=>`ep:${kind}:${secureUUID().replaceAll('-','_')}`;
export function makeGMTemplateDeskWindow(Base,{gameInstance,service,sourceGraphId=()=>'',openDraft=null}={}){
 return class EasyPlotsTemplateDesk extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-templates',window:{title:'Easy Plots — Reusable Plot Templates',resizable:true},position:{width:820,height:730}};
  #sourceId='';#sourceVersion='1';#blueprintId=uid('blueprint');#revision='1';#text='';#template=null;#stored=null;#bindings={};#title='New plot instance';#instanceId=uid('graph');#preview=null;#spec=null;#created=null;#message='';#busy=false;
  #invalidate(){this.#preview=null;this.#spec=null;}
  #load(template,stored=false){this.#template=template;this.#text=JSON.stringify(template,null,2);this.#blueprintId=template.blueprintId;this.#revision=String(template.revision);this.#stored=stored?template.fingerprint:null;this.#bindings={};this.#instanceId=uid('graph');this.#created=null;this.#invalidate();}
  async _renderHTML(){
   const root=el('section','ep-editor ep-template-desk');
   if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM authority required'));return root;}
   root.append(el('h2','','Reusable plot templates'),el('p','ep-banner','Export an immutable plot structure, bind its external references, then create a new draft. Publication, activation and effect approval remain separate.'));
   const field=(key,label,value,textarea=false)=>{const l=el('label','ep-field');l.append(el('span','ep-label',label));const input=el(textarea?'textarea':'input','ep-input');input.dataset.field=key;input.value=value;if(textarea)input.rows=7;l.append(input);root.append(l);return input;};
   field('sourceGraph','Published source plot ID',this.#sourceId||sourceGraphId()||'');field('sourceVersion','Source published version',this.#sourceVersion);
   field('blueprintId','Blueprint ID',this.#blueprintId);field('revision','Blueprint revision',this.#revision);
   const button=(action,label,disabled=false)=>{const b=el('button','ep-button',label);b.type='button';b.dataset.action=action;b.disabled=disabled;root.append(b);};
   button('export','Export source structure');button('load-stored','Load stored revision');
   field('template','Portable template JSON',this.#text,true);button('read','Read portable template');button('store','Store immutable template',!this.#template);button('download','Download portable template',!this.#template);
   if(this.#template){
    root.append(el('h3','','Explicit instance bindings'));
    for(const slot of this.#template.slots){
     const l=el('label','ep-field');l.append(el('span','ep-label',`${slot.label} (${slot.kind}${slot.documentKind?` · ${slot.documentKind}`:''})`));
     const input=el('input','ep-input');input.dataset.slot=slot.id;input.value=this.#bindings[slot.id]?.graphId??this.#bindings[slot.id]??'';l.append(input);
     if(slot.kind==='published-graph'){const version=el('input','ep-input');version.type='number';version.min='1';version.dataset.slotVersion=slot.id;version.value=String(this.#bindings[slot.id]?.publishedVersion??1);l.append(el('span','ep-label','Local published version'),version);}root.append(l);
    }
    field('instanceTitle','Instance title',this.#title);button('new-instance','New instance');button('preview','Review new instance',this.#stored!==this.#template.fingerprint);button('create','Create reviewed draft',!this.#preview);
   }
   if(this.#preview){const pre=el('pre','ep-template-preview',JSON.stringify({source:this.#preview.graph.templateSource,graphId:this.#preview.graph.id,title:this.#preview.graph.title,nodes:this.#preview.graph.nodes.length,edges:this.#preview.graph.edges.length,activated:false,nativeResourcesCreated:0},null,2));root.append(pre);}
   if(this.#created){root.append(el('p','ep-template-created',`Created draft ${this.#created.graphId}; blueprint revision ${this.#created.blueprintRevision}. Publish and activate it from the editor.`));if(openDraft)button('open-draft','Open created draft');}
   if(this.#message)root.append(el('p','ep-template-message',this.#message));
   const read=key=>root.querySelector(`[data-field="${key}"]`)?.value??'';
   root.addEventListener('input',event=>{
    if(this.#busy)return;
    if(event.target.dataset.slot&&this.#template){const id=event.target.dataset.slot,slot=this.#template.slots.find(s=>s.id===id);this.#bindings[id]=slot.kind==='published-graph'?{graphId:event.target.value,publishedVersion:Number(root.querySelector(`[data-slot-version="${id}"]`).value)}:event.target.value;}
    if(event.target.dataset.slotVersion&&this.#template){const id=event.target.dataset.slotVersion;this.#bindings[id]={graphId:root.querySelector(`[data-slot="${id}"]`).value,publishedVersion:Number(event.target.value)};}
    if(event.target.dataset.field==='instanceTitle')this.#title=event.target.value;
    if(event.target.dataset.field==='template'){this.#text=event.target.value;this.#template=null;this.#stored=null;root.querySelectorAll('[data-action="store"],[data-action="download"],[data-action="preview"]').forEach(b=>{b.disabled=true;});}
    this.#invalidate();root.querySelector('.ep-template-preview')?.remove();const create=root.querySelector('[data-action="create"]');if(create)create.disabled=true;
   });
   root.addEventListener('click',event=>{
    const b=event.target.closest?.('button[data-action]');if(!b||b.disabled||this.#busy)return;
    void(async()=>{this.#busy=true;this.#message='';root.querySelectorAll('button,input,textarea').forEach(e=>{e.disabled=true;});try{
     if(!gameInstance?.user?.isGM)throw Error('GM authority required');
     const action=b.dataset.action;
     if(['export','load-stored'].includes(action)){
      this.#sourceId=read('sourceGraph').trim();this.#sourceVersion=read('sourceVersion');this.#blueprintId=read('blueprintId').trim();this.#revision=read('revision');
      const template=action==='export'?await service.exportGraph({graphId:this.#sourceId,publishedVersion:Number(this.#sourceVersion),blueprintId:this.#blueprintId,revision:Number(this.#revision)}):await service.exportStored({blueprintId:this.#blueprintId,revision:Number(this.#revision)});
      this.#load(template,action==='load-stored');this.#message=action==='export'?'Portable structure exported. External references require explicit local bindings.':'Stored template loaded.';
     }else if(action==='read'){if(read('template').length>850000)throw Error('Template exceeds input budget');this.#load(await validatePortableTemplate(JSON.parse(read('template'))));}
     else if(action==='store'){await service.store({template:this.#template,sourceEventId:uid('event')});this.#stored=this.#template.fingerprint;this.#message='Immutable template stored. Bind references and review a new instance.';}
     else if(action==='new-instance'){this.#instanceId=uid('graph');this.#bindings={};this.#created=null;this.#invalidate();}
     else if(action==='preview'){
      if(this.#stored!==this.#template.fingerprint)throw Error('Store this exact template before reviewing an instance');
      const bindings={};for(const slot of this.#template.slots){const value=root.querySelector(`[data-slot="${slot.id}"]`).value.trim();bindings[slot.id]=slot.kind==='published-graph'?{graphId:value,publishedVersion:Number(root.querySelector(`[data-slot-version="${slot.id}"]`).value)}:value;}
      this.#bindings=bindings;this.#title=read('instanceTitle');this.#spec={blueprintId:this.#template.blueprintId,revision:this.#template.revision,instanceId:this.#instanceId,bindings,title:this.#title};this.#preview=await service.previewInstance(this.#spec);
     }else if(action==='create'){
      if(!this.#preview||!this.#spec)throw Error('Review the exact instance bindings first');
      this.#created=await service.instantiate({...this.#spec,sourceEventId:uid('event')},{approved:true,expectedFingerprint:this.#preview.instanceSpecDigest});this.#invalidate();
     }else if(action==='open-draft'){await openDraft(this.#created.graphId);}
     else if(action==='download'){
      const url=URL.createObjectURL(new Blob([JSON.stringify(this.#template,null,2)],{type:'application/json'})),a=el('a');a.href=url;a.download=`${this.#template.blueprintId.replaceAll(':','_')}_v${this.#template.revision}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
     }
    }catch(error){this.#invalidate();this.#message=`Template action rejected: ${error.code??error.message}`;}
    finally{this.#busy=false;await this.render();}})();
   });
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
