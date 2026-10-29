/** GM-only continuity handoff editor; no native world effects or broadcasts. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
const el=(tag,cls='',text='')=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=String(text);return n;};
const sample={scope:'world',sessionId:'ep:session:next001',sourceArcId:'ep:arc:waterdeep001',sourceArcRevision:1,worldTime:120,
 references:[{id:'ep:story-hook:officer001',kind:'story-hook',status:'dormant',note:'GM-only hook'}],
 recap:[{id:'ep:public:summary001',sourceEventId:'ep:event:known001',text:'The harbor is secure.',recipientIds:['ep:actor:hero001']}]};
export function makeGMSessionHandoffWindow(Base,{service,gameInstance}={}){
 if(!service||typeof service.prepare!=='function'||typeof service.approve!=='function'||typeof service.read!=='function')
  throw new EasyPlotsError('HANDOFF_DEPENDENCY','Protected GM session handoff service required');
 return class EasyPlotsSessionHandoffDesk extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-session-handoff',window:{title:'Easy Plots — Session Handoff',resizable:true},position:{width:760,height:650}};
  #text=JSON.stringify(sample,null,2);#record=null;#message='';#busy=false;#confirmed=false;
  async _renderHTML(){
   const root=el('section','ep-editor ep-session-handoff');
   if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM required'));return root;}
   root.append(el('h2','','Session Handoff'),el('p','ep-banner','Explicit narrative references only. Saved handoffs never activate dormant story hooks or execute narrative effects.'));
   const input=el('textarea','ep-input');input.dataset.field='handoff';input.rows=15;input.value=this.#text;root.append(input);
   for(const [name,label] of [['prepare','Save proposed handoff'],['read','Reload handoff'],['approve','Approve reviewed handoff']]){
    const button=el('button','ep-button',label);button.type='button';button.dataset.action=name;
    if(name==='approve')button.disabled=!this.#confirmed||!this.#record||this.#record.data?.state!=='draft';root.append(button);
   }
   const field=el('label','ep-field');const checked=el('input');checked.type='checkbox';checked.dataset.field='reviewed';checked.checked=this.#confirmed;field.append(checked,el('span','ep-label','I have reviewed the references and audience-specific recap before approval'));root.append(field);
   if(this.#message)root.append(el('p','ep-notice',this.#message));
   if(this.#record){const section=el('section','ep-panel');section.append(el('h3','','Protected handoff record'),el('pre','ep-lab-output',JSON.stringify(this.#record,null,2)));root.append(section);}
   root.addEventListener('input',ev=>{if(ev.target?.dataset?.field==='handoff'){
    this.#confirmed=false;this.#record=null;this.#message='Edited draft must be saved and reviewed again';
    root.querySelector('button[data-action="approve"]')?.setAttribute('disabled','');
   }});
   root.addEventListener('change',ev=>{if(ev.target?.dataset?.field==='reviewed'){
    this.#confirmed=ev.target.checked;root.querySelector('button[data-action="approve"]').disabled=!this.#confirmed||!this.#record||this.#record.data?.state!=='draft';
   }});
   root.addEventListener('click',ev=>{const action=ev.target?.closest?.('button[data-action]')?.dataset?.action;if(!action||this.#busy)return;
    void(async()=>{this.#busy=true;try{
      if(!gameInstance?.user?.isGM)throw new EasyPlotsError('GM_REQUIRED','GM required');
      if(input.value.length>20_000)throw new Error('Handoff payload exceeds budget');
      const data=JSON.parse(input.value);this.#text=input.value;
      if(action==='read'){this.#record=await service.read({scope:data.scope??'world',sessionId:data.sessionId});}
      else if(action==='prepare'){
       const prior=await service.read({scope:data.scope??'world',sessionId:data.sessionId});
       const stamp=secureUUID().replaceAll('-','_');
       this.#record=await service.prepare({...data,sourceEventId:`ep:event:handoff_${stamp}`,expectedRevision:prior?.revision??null});
       this.#confirmed=false;
      }else{
       if(!this.#confirmed||!this.#record||this.#record.data.state!=='draft')throw Error('Saved draft and review acknowledgement required');
       const expectedRevision=this.#record.revision;
       if(data.sessionId!==this.#record.id||data.sourceArcRevision!==this.#record.data.sourceArcRevision)throw Error('Reviewed handoff does not match current input');
       this.#record=await service.approve({scope:data.scope??'world',sessionId:data.sessionId,expectedRevision,
         sourceArcRevision:data.sourceArcRevision,reviewEventId:`ep:event:handoff_review_${secureUUID().replaceAll('-','_')}`});
       this.#confirmed=false;
      }
      this.#message=action==='approve'?'Approved handoff recorded. No world actions executed.': 'Handoff record loaded or saved; no world effects performed.';
    }catch(error){this.#message=`${error.code??'HANDOFF_ERROR'}: ${error.message}`;this.#confirmed=false;}
    finally{this.#busy=false;await this.render();}})();
   });
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
