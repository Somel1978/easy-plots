import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=String(text);return n;};
const eventId=()=>`ep:event:preparation_${secureUUID().replaceAll('-','_')}`;
export function makeGMSessionPreparationWindow(Base,{service,gameInstance,openHandoff=null}={}){
 if(!['pins','pinPlots','prepare','read','edit','sourceStatus'].every(k=>typeof service?.[k]==='function'))throw new EasyPlotsError('SESSION_PREPARATION_DESK_DEPENDENCY','Protected session preparation service required');
 return class EasyPlotsSessionPreparationDesk extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-session-preparation',window:{title:'Easy Plots — Next session',resizable:true},position:{width:820,height:820}};
  #fields={scope:'world',sessionId:'ep:session:preparation001',title:'Next session',plots:'',sourceRefs:'[]',notes:'',agenda:'[]'};
  #pins=null;#row=null;#status=null;#message='';#busy=false;
  async _renderHTML(){
   const root=el('section');root.className='ep-editor ep-session-preparation';if(!gameInstance?.user?.isGM){root.append(el('p','GM authority required'));return root;}
   root.append(el('h2','Next-session preparation'),el('p','Pin named active plots and assemble selected narrative references. Notes and agenda remain editable and private to this GM.'));
   const field=(key,label,area=false)=>{const wrap=el('label',label),input=el(area?'textarea':'input');wrap.className='ep-field';input.className='ep-input';input.dataset.field=key;input.value=this.#fields[key];if(area)input.rows=3;wrap.append(input);root.append(wrap);};
   const button=(action,label,disabled=false)=>{const b=el('button',label);b.type='button';b.dataset.action=action;b.disabled=disabled||this.#busy;root.append(b);};
   field('plots','Named active plot IDs (one per line)',true);button('load-pins','Load my preparation pins');button('pin','Pin these active plots',!this.#pins);
   field('scope','Narrative scope');field('sessionId','Session preparation ID');field('title','Preparation title');field('sourceRefs','Selected narrative sources (JSON: plotId, type, id, revision)',true);
   button('load','Load saved preparation');button('prepare','Assemble or refresh selected sources',!this.#pins);
   field('notes','Private GM notes',true);field('agenda','Editable agenda (JSON: id, text, referenceIds)',true);button('edit','Save private notes and agenda',!this.#row);button('sources','Check source changes',!this.#row);
   if(openHandoff)button('handoff','Open separate Session Handoff');
   root.append(el('p','Player recap publication, plot activation and narrative effects use their separate reviewed workflows.'));
   if(this.#message)root.append(el('p',this.#message));if(this.#pins)root.append(el('pre',JSON.stringify({pinsRevision:this.#pins.revision,plots:this.#pins.plotRefs},null,2)));
   if(this.#status)root.append(el('pre',JSON.stringify(this.#status,null,2)));if(this.#row)root.append(el('pre',JSON.stringify({revision:this.#row.revision,plots:this.#row.data.plots,sources:this.#row.data.sources,brief:this.#row.data.brief},null,2)));
   root.addEventListener('input',event=>{const key=event.target?.dataset?.field;if(Object.hasOwn(this.#fields,key))this.#fields[key]=event.target.value;});
   root.addEventListener('click',event=>{const b=event.target.closest?.('button[data-action]');if(!b||b.disabled||this.#busy)return;void(async()=>{
    this.#busy=true;try{
     if(!gameInstance?.user?.isGM)throw new EasyPlotsError('GM_REQUIRED','GM authority required');
     const data={...this.#fields};for(const value of Object.values(data))if(value.length>16000)throw Error('Preparation input exceeds its budget');
     const base={scope:data.scope.trim(),sessionId:data.sessionId.trim()},action=b.dataset.action;
     if(action==='load-pins'){this.#pins=await service.pins();this.#fields.plots=this.#pins.plotRefs.map(p=>p.graphId).join('\n');}
     else if(action==='pin'){
      if(!this.#pins)throw Error('Load your current preparation pins before editing');
      await service.pinPlots({graphIds:data.plots.split(/\s+/).filter(Boolean),expectedFocusRevision:this.#pins.revision,sourceEventId:eventId()});this.#pins=await service.pins();
     }else if(action==='load'){
      this.#row=await service.read(base);if(this.#row){this.#fields.title=this.#row.data.title;this.#fields.notes=this.#row.data.notes;this.#fields.agenda=JSON.stringify(this.#row.data.agenda,null,2);this.#fields.sourceRefs=JSON.stringify(this.#row.data.sources.map(({type,id,revision,plotId})=>({type,id,revision,plotId})),null,2);}
     }else if(action==='prepare'){
      if(!this.#pins)throw Error('Load or pin the named active plots before assembly');
      if(this.#row&&(this.#row.id!==base.sessionId||this.#row.scope!==base.scope))throw Error('Load this exact preparation before refreshing sources');
      this.#row=await service.prepare({...base,title:data.title,sourceRefs:JSON.parse(data.sourceRefs),expectedRevision:this.#row?.revision??null,expectedFocusRevision:this.#pins.revision,sourceEventId:eventId()});
     }else if(action==='handoff'){await openHandoff();}
     else{
      if(!this.#row||this.#row.id!==base.sessionId||this.#row.scope!==base.scope)throw Error('Load this exact saved preparation first');
      if(action==='edit')this.#row=await service.edit({...base,expectedRevision:this.#row.revision,notes:data.notes,agenda:JSON.parse(data.agenda),sourceEventId:eventId()});
      if(action==='sources')this.#status=await service.sourceStatus(base);
     }
     this.#message='Private preparation saved or loaded. No publication or world effects performed.';
    }catch(error){this.#message=`Preparation action rejected: ${error.code??error.message}`;}
    finally{this.#busy=false;await this.render();}
   })();});return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
