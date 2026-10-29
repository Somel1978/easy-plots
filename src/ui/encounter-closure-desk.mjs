const el=(tag,text='')=>{const e=document.createElement(tag);e.textContent=String(text);return e;};
export function makeEncounterClosureDeskWindow(Base,{gameInstance,service}={}){
 return class EasyPlotsEncounterClosures extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-encounter-closure',window:{title:'Easy Plots — Encounter closure',resizable:true},position:{width:740,height:640}};
  #event='';#operation='';#preview=null;#selected=null;#confirmed=false;#message='';#busy=false;
  async _renderHTML(){
   const root=el('section');root.className='ep-editor ep-encounter-closure';if(!gameInstance.user?.isGM){root.append(el('p','GM authority required'));return root;}
   root.append(el('h2','Encounter closure'),el('p','Select one executed and verified outcome from a native Combat deletion. The selected outcome is permanent for that Combat. Submitting its event creates proposals for separate GM approval.'));
   for(const [key,label,value] of [['event','Native deletion event ID',this.#event],['operation','Completed outcome operation ID',this.#operation]]){const l=el('label',label),input=el('input');input.className='ep-input';input.dataset.field=key;input.value=value;l.append(input);root.append(l);}
   const button=(action,label,disabled=false)=>{const b=el('button',label);b.type='button';b.dataset.action=action;b.disabled=disabled;root.append(b);};button('preview','Review completed outcome');
   const label=el('label','I have reviewed this exact outcome and its native source.'),check=el('input');check.type='checkbox';check.dataset.field='confirm';check.checked=this.#confirmed;label.prepend(check);root.append(label);
   button('select','Select canonical outcome',!this.#preview||!this.#confirmed||Boolean(this.#selected));button('emit','Submit selected closure event',!this.#selected||!this.#confirmed);
   if(this.#preview)root.append(el('pre',JSON.stringify(this.#preview,null,2)));if(this.#message)root.append(el('p',this.#message));
   root.addEventListener('input',event=>{if(['event','operation'].includes(event.target.dataset.field)){this.#preview=null;this.#selected=null;this.#confirmed=false;root.querySelectorAll('[data-action="select"],[data-action="emit"]').forEach(b=>{b.disabled=true;});}});
   root.addEventListener('change',event=>{if(event.target===check){this.#confirmed=check.checked;root.querySelector('[data-action="select"]').disabled=!this.#preview||!this.#confirmed||Boolean(this.#selected);root.querySelector('[data-action="emit"]').disabled=!this.#selected||!this.#confirmed;}});
   root.addEventListener('click',event=>{const b=event.target.closest?.('button[data-action]');if(!b||b.disabled||this.#busy)return;void(async()=>{
    this.#busy=true;root.querySelectorAll('button').forEach(x=>{x.disabled=true;});try{
     if(!gameInstance.user?.isGM)throw Error('GM authority required');const spec={sourceEventId:root.querySelector('[data-field="event"]').value.trim(),operationId:root.querySelector('[data-field="operation"]').value.trim()};
     if(b.dataset.action==='preview'){this.#event=spec.sourceEventId;this.#operation=spec.operationId;this.#preview=await service.preview(spec);this.#selected=null;this.#confirmed=false;this.#message='Preview only. No canonical choice or event has been recorded.';}
     else{if(!this.#confirmed||!this.#preview||spec.sourceEventId!==this.#event||spec.operationId!==this.#operation)throw Error('Review the exact source before submission');
      if(b.dataset.action==='select'){this.#selected=await service.select(spec,{approved:true,expectedFingerprint:this.#preview.selectionDigest});this.#message='Canonical outcome selected. Submit its event separately.';}
      else{const result=await service.emit({nativeCombatUuid:this.#selected.data.nativeCombatUuid,expectedRevision:this.#selected.revision},{approved:true});this.#message=`Closure event ${result.eventId}: ${result.status}. Its proposed effects require separate review.`;}
     }
    }catch(error){this.#message=`Encounter action rejected: ${error.code??error.message}`;}finally{this.#busy=false;await this.render();}
   })();});return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
