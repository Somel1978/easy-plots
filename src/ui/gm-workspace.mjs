/** Three coordinated local views share one protected focus controller. */
import {secureUUID} from '../contracts/digest.mjs';
const el=(tag,text='')=>{const node=document.createElement(tag);node.textContent=String(text);return node;};
export function makeGMWorkspaceWindow(Base,{controller,service,getGraphSnapshot,gameInstance,mode='dock',openEditor,openInspector}={}){
 if(!['dock','inspector'].includes(mode)||typeof controller?.subscribe!=='function'||typeof service?.pin!=='function'||typeof getGraphSnapshot!=='function')throw Error('Shared GM focus services required');
 return class EasyPlotsWorkspace extends Base {
  static DEFAULT_OPTIONS={id:`easy-plots-workspace-${mode}`,window:{title:`Easy Plots — ${mode}`,resizable:true},position:{width:mode==='dock'?360:650,height:500}};
  #unsubscribe=null;#closed=false;#busy=false;#message='';
  constructor(...args){super(...args);this.#unsubscribe=controller.subscribe(async()=>{if(!this.#closed&&gameInstance?.user?.isGM)await this.render();});}
  async close(options){this.#closed=true;this.#unsubscribe?.();return typeof super.close==='function'?super.close(options):this;}
  async _renderHTML(){
   const root=el('section');root.className=`ep-editor ep-workspace ep-workspace-${mode}`;
   if(!gameInstance?.user?.isGM){root.append(el('p','GM authority required'));return root;}
   const focus=await controller.snapshot(),token=focus.graphId;
   root.append(el('h2',mode==='dock'?'Narrative dock':'Narrative inspector'),el('p',`Focus: ${token??'None'} · ${focus.focusSource}`));
   const input=(key,label,value='')=>{const field=el('label',label),node=el('input');node.dataset.field=key;node.value=value;field.append(node);root.append(field);};
   input('graph-id','Graph',token??'');input('scene-id','Scene');
   for(const [action,label] of [['select','Focus graph'],['pin','Pin focus'],['unpin','Unpin focus'],['bind-scene','Bind scene'],['editor','Full canvas'],...(mode==='dock'?[['inspector','Inspector']]:[])]){
    const b=el('button',label);b.type='button';b.dataset.action=action;root.append(b);
   }
   if(token){const snapshot=await getGraphSnapshot(token,focus.attention.filter(a=>a.graphId===token).map(a=>a.eventId).slice(-12));
    if(gameInstance?.user?.isGM){root.append(el('h3',snapshot.title),el('p',`Publication: ${snapshot.active?snapshot.publishedVersion:'inactive'} · Draft: ${snapshot.draftRevision??'none'}`));
     if(mode==='inspector')for(const event of snapshot.events)root.append(el('p',`${event.id} · ${event.state} · ${event.proposalCount} proposals`));}
   }
   for(const item of focus.attention){const article=el('article',`${item.eventId} · ${item.pinned?'Pinned significance':'Transient attention'}`),b=el('button',item.pinned?'Unpin event':'Pin event');b.type='button';b.dataset.action='pin-event';b.dataset.eventId=item.eventId;b.dataset.pinned=String(!item.pinned);article.append(b);root.append(article);}
   if(this.#message)root.append(el('p',this.#message));
   root.addEventListener('click',event=>{const b=event.target.closest?.('button[data-action]');if(!b||this.#busy)return;
    void(async()=>{this.#busy=true;this.#message='';try{
     if(!gameInstance?.user?.isGM)throw Error('GM authority required');
     const graphId=root.querySelector('[data-field="graph-id"]').value.trim(),sceneId=root.querySelector('[data-field="scene-id"]').value.trim();
     const sourceEventId=`ep:event:focus_${secureUUID().replaceAll('-','')}`,expectedRevision=focus.revision;
     switch(b.dataset.action){
      case 'select':await controller.select(graphId);break;
      case 'pin':await service.pin({graphId,expectedRevision,sourceEventId});await controller.refresh();break;
      case 'unpin':await service.pin({graphId:null,expectedRevision,sourceEventId});await controller.refresh();break;
      case 'bind-scene':await service.bindScene({sceneId,graphId,expectedRevision,sourceEventId});await controller.refresh();break;
      case 'pin-event':await service.pinAttention({eventId:b.dataset.eventId,pinned:b.dataset.pinned==='true',expectedRevision,sourceEventId});await controller.refresh();break;
      case 'editor':if(token)await openEditor(token);break;
      case 'inspector':await openInspector();break;
     }
    }catch(error){this.#message=`${error.code??'FOCUS_ERROR'}: ${error.message}`;}finally{this.#busy=false;if(!this.#closed)await this.render();}})();
   });
   if(!gameInstance?.user?.isGM)root.replaceChildren(el('p','GM authority required'));
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
