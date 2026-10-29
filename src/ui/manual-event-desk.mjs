/** GM manual event ingress. Submitting writes a canonical event and proposals;
 * it NEVER approves or executes a resulting native effect automatically. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
const el=(tag,cls='',text='')=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=String(text);return n;};
export function makeGMManualEventWindow(Base,{gameInstance,submitManual}={}){
 if(typeof submitManual!=='function')throw new EasyPlotsError('MANUAL_EVENT_DEPENDENCY','Designated GM event gateway required');
 return class EasyPlotsGMManualEventDesk extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-gm-manual-event',window:{title:'Easy Plots — Manual Narrative Event',resizable:true},position:{width:700,height:560}};
  #type='narrative.manual';#payload='{\n  "verified": true\n}';#requestId=`ep:request:manual_${secureUUID().replaceAll('-','_')}`;
  #prepared=null;#confirmed=false;#sent=null;#message='';#busy=false;
  async _renderHTML(){
   const root=el('section','ep-editor ep-manual-event');
   if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','Designated GM required'));return root;}
   root.append(el('h2','','Manual Narrative Event'),el('p','ep-banner','Explicit GM ingress only. Accepted events are evaluated against active published triggers; any proposed effects still require separate review and execution.'));
   for(const [key,label,value] of [['type','Event type',this.#type],['request','Stable request ID',this.#requestId]]){
    const field=el('label','ep-field');field.append(el('span','ep-label',label));const input=el('input','ep-input');input.dataset.field=key;input.maxLength=160;input.value=value;field.append(input);root.append(field);
   }
   const label=el('label','ep-field');label.append(el('span','ep-label','Safe bounded event payload (JSON)'));
   const payload=el('textarea','ep-input');payload.dataset.field='payload';payload.rows=9;payload.value=this.#payload;label.append(payload);root.append(label);
   for(const [action,text] of [['preview','Validate and preview'],['submit','Record event for GM review'],['new','Prepare new distinct request']]){
    const button=el('button','ep-button',text);button.dataset.action=action;button.type='button';
    if(action==='submit')button.disabled=!this.#prepared||!this.#confirmed||this.#sent!==null;root.append(button);
   }
   const acknowledgement=el('label','ep-field');const check=el('input');check.type='checkbox';check.dataset.field='acknowledged';check.checked=this.#confirmed;
   acknowledgement.append(check,el('span','ep-label','I have reviewed this exact event and understand it does not execute consequences.'));root.append(acknowledgement);
   if(this.#prepared){const section=el('section','ep-panel');section.append(el('h3','','Protected event preview'),el('pre','ep-lab-output',JSON.stringify(this.#prepared,null,2)));root.append(section);}
   if(this.#sent){root.append(el('p','ep-notice',`Event ${this.#sent.eventId}: ${this.#sent.status}. Open GM Event Review to approve any proposed consequences.`));}
   if(this.#message)root.append(el('p','ep-notice',this.#message));
   root.addEventListener('input',ev=>{if(!['type','request','payload'].includes(ev.target?.dataset?.field))return;
    this.#confirmed=false;this.#prepared=null;root.querySelector('button[data-action="submit"]')?.setAttribute('disabled','');});
   root.addEventListener('change',ev=>{if(ev.target?.dataset?.field==='acknowledged'){
    this.#confirmed=check.checked;root.querySelector('button[data-action="submit"]').disabled=!this.#confirmed||!this.#prepared||this.#sent!==null;
   }});
   root.addEventListener('click',ev=>{const action=ev.target?.closest?.('button[data-action]')?.dataset?.action;if(!action||this.#busy)return;
    void(async()=>{this.#busy=true;try{
     if(!gameInstance?.user?.isGM)throw new EasyPlotsError('GM_REQUIRED','GM required');
     if(action==='new'){
      this.#requestId=`ep:request:manual_${secureUUID().replaceAll('-','_')}`;this.#prepared=null;this.#sent=null;this.#confirmed=false;this.#message='New request identity prepared.';
     }else{
      const eventType=root.querySelector('[data-field="type"]').value.trim();
      const requestId=root.querySelector('[data-field="request"]').value.trim();
      const data=root.querySelector('[data-field="payload"]').value;
      if(data.length>2048||!/^[a-z][a-z0-9.-]{1,100}$/.test(eventType)||!/^ep:request:[A-Za-z0-9_:-]{6,140}$/.test(requestId))
       throw new EasyPlotsError('MANUAL_EVENT_CONTRACT','Bounded event type, request identity and payload required');
      const parsed=JSON.parse(data);
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new EasyPlotsError('MANUAL_EVENT_CONTRACT','Plain JSON payload required');
      this.#type=eventType;this.#requestId=requestId;this.#payload=data;
      if(action==='preview'){
       this.#prepared={requestId,eventType,payload:parsed};this.#confirmed=false;this.#sent=null;this.#message='Exact manual event preview prepared. No event recorded.';
      }else{
       if(!this.#confirmed||!this.#prepared||JSON.stringify(this.#prepared)!==JSON.stringify({requestId,eventType,payload:parsed})||this.#sent)
        throw new EasyPlotsError('MANUAL_EVENT_REVIEW','Preview and approve the unchanged event first');
       this.#sent=await submitManual(this.#prepared);this.#confirmed=false;this.#message='Event accepted or existing event identity recovered. Consequences remain pending separate GM review.';
      }
     }
    }catch(error){this.#message=`${error.code??'MANUAL_EVENT_ERROR'}: ${error.message}`;this.#confirmed=false;}
    finally{this.#busy=false;await this.render();}})();
   });return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
