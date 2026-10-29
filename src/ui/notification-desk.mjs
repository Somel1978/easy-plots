/** GM-only, bounded inbox with explicit notification approval. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
const el=(tag,cls='',text='')=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=String(text);return n;};
export function makeGMNotificationWindow(Base,{gameInstance,service,deliverNotice=null}={}){
 if(!service||typeof service.listGM!=='function'||typeof service.read!=='function'||typeof service.approve!=='function')
  throw new EasyPlotsError('NOTIFICATION_DEPENDENCY','Protected notification queue required');
 return class EasyPlotsGMNotificationDesk extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-notification-desk',window:{title:'Easy Plots — Notification Review',resizable:true},position:{width:710,height:610}};
  #cursor='0:0';#results=[];#nextCursor=null;#row=null;#noticeId='';#message='';#busy=false;#reviewed=false;
  async _renderHTML(){const root=el('section','ep-editor ep-notification-desk');
   if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM authority required'));return root;}
   root.append(el('h2','','Narrative Notification Review'),el('p','ep-banner','Bounded GM-only inbox. Publishing a notification is separate from recording its source event.'));
   for(const [action,label] of [['list','Load one index page'],['next','Next page']]){
    const b=el('button','ep-button',label);b.type='button';b.dataset.action=action;if(action==='next'&&!this.#nextCursor)b.disabled=true;root.append(b);
   }
   const groups=new Map();for(const item of this.#results){const key=`${item.recipientId}|${item.groupKey}`,group=groups.get(key)??[];group.push(item);groups.set(key,group);}
   for(const items of groups.values()){const group=el('section','ep-panel ep-gm-notice-group');group.append(el('h3','',`${items[0].groupKey} · ${items[0].recipientId}`),el('small','ep-dim',`${items.length} records on this index page`));for(const item of items){const row=el('article','ep-board-item');row.append(el('strong','',`${item.level} · ${item.state}`),el('p','',item.id));group.append(row);}root.append(group);}
   const field=el('label','ep-field');field.append(el('span','ep-label','Exact notification ID for review'));
   const input=el('input','ep-input');input.dataset.field='notice-id';input.value=this.#noticeId;field.append(input);root.append(field);
   const read=el('button','ep-button','Inspect notification');read.type='button';read.dataset.action='read';root.append(read);
   if(this.#row){const panel=el('section','ep-panel');panel.append(el('h3','','GM-only notification'),el('pre','ep-lab-output',JSON.stringify(this.#row,null,2)));root.append(panel);
    const ack=el('label','ep-field');const checked=el('input');checked.type='checkbox';checked.dataset.field='reviewed';checked.checked=this.#reviewed;
    ack.append(checked,el('span','ep-label','I approve the audience-safe message after reviewing this record'));root.append(ack);
    const b=el('button','ep-button','Publish reviewed message');b.type='button';b.dataset.action='approve';b.disabled=!this.#reviewed||this.#row.data.state!=='pending-review';root.append(b);
   }
   if(this.#row?.data?.state==='published'&&typeof deliverNotice==='function'){
    const deliver=el('button','ep-button','Deliver approved notice to verified recipient');deliver.type='button';deliver.dataset.action='deliver';
    root.append(deliver);
   }
   if(this.#message)root.append(el('p','ep-notice',this.#message));
   root.addEventListener('change',ev=>{if(ev.target?.dataset?.field==='reviewed'){
    this.#reviewed=ev.target.checked;const button=root.querySelector('button[data-action="approve"]');if(button)button.disabled=!this.#reviewed||this.#row?.data?.state!=='pending-review';
   }});
   root.addEventListener('input',ev=>{if(ev.target?.dataset?.field==='notice-id'){
    this.#row=null;this.#reviewed=false;root.querySelector('button[data-action="approve"]')?.setAttribute('disabled','');
   }});
   root.addEventListener('click',ev=>{const action=ev.target?.closest?.('button[data-action]')?.dataset?.action;if(!action||this.#busy)return;
    void(async()=>{this.#busy=true;try{
      if(!gameInstance?.user?.isGM)throw new EasyPlotsError('GM_REQUIRED','GM authority required');
      if(action==='list'||action==='next'){
       const result=await service.listGM({scope:'world',cursor:action==='list'?'0:0':this.#nextCursor,limit:12});
       this.#results=result.items;this.#nextCursor=result.nextCursor;this.#message='Only a bounded notification index page was read.';
      }else if(action==='read'){
       this.#noticeId=input.value.trim();this.#row=await service.read({noticeId:this.#noticeId});this.#reviewed=false;
       this.#message='GM-only notification loaded. No message delivered.';
      }else if(action==='deliver'){
       if(!this.#row||this.#row.data.state!=='published'||input.value.trim()!==this.#noticeId)
        throw new Error('Fresh approved notice required');
       const result=await deliverNotice({noticeId:this.#noticeId});
       this.#message=`Authenticated client receipt: ${result.status}. This is not proof the person read the notice.`;
       this.#row=await service.read({noticeId:this.#noticeId});
      }else{
       if(!this.#reviewed||!this.#row||this.#row.data.state!=='pending-review'||input.value.trim()!==this.#noticeId)
        throw new Error('Fresh reviewed notification required');
       this.#row=await service.approve({noticeId:this.#noticeId,expectedRevision:this.#row.revision,
        approvalEventId:`ep:event:notification_review_${secureUUID().replaceAll('-','_')}`});
       this.#reviewed=false;this.#message='Recipient-safe notification approved. No socket message has been sent.';
      }
    }catch(error){this.#message=`${error.code??'NOTIFICATION_ERROR'}: ${error.message}`;this.#reviewed=false;}
    finally{this.#busy=false;await this.render();}})();
   });return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
