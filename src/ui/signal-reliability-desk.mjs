/** GM reliability controls. No Hook startup, automatic replay or player DTO. */
import {SUPPORTED_NATIVE_EVENT_TYPES} from '../platform/foundry-hook-ingress.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {localize} from './localization.mjs';
const t=(key,fallback)=>localize(`EasyPlots.Reliability.${key}`,fallback);
const el=(tag,text='')=>{const node=document.createElement(tag);node.textContent=String(text);return node;};
const eventLabels={'foundry.actor.updated':'Actor updated','foundry.item.updated':'Item updated','foundry.journal.created':'Journal created','foundry.journal.updated':'Journal updated','foundry.combat.created':'Combat created','foundry.combat.updated':'Combat updated','foundry.combat.deleted':'Combat deleted','foundry.chat.created':'Chat message created'};
export function makeSignalReliabilityDeskWindow(Base,{gameInstance,service}={}){
 if(['load','configure','listPending','inspect','reconcile','resume','dismiss','checkSources','acknowledgeSource'].some(k=>typeof service?.[k]!=='function'))throw Error('Protected signal reliability service required');
 return class EasyPlotsSignalReliabilityDesk extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-signal-reliability',window:{title:'Easy Plots — Signal Reliability',resizable:true},position:{width:820,height:740}};
  #policy=null;#rules={};#sourceText='';#pending=null;#selected=null;#sources=null;#source=null;#reviewed=false;#reason='';#message='';#busy=false;#closed=false;
  async close(options){this.#closed=true;return typeof super.close==='function'?super.close(options):this;}
  #setPolicy(row){this.#policy=row;this.#rules=Object.fromEntries(row.data.rules.map(r=>[r.eventType,r.tier]));this.#sourceText=row.data.sources.join('\n');}
  async _renderHTML(){
   const root=el('section');root.className='ep-editor ep-signal-reliability';
   if(!gameInstance?.user?.isGM){root.append(el('p',t('GMRequired','GM authority required')));return root;}
   if(!this.#policy){try{this.#setPolicy(await service.load());}catch(error){this.#message=`${error.code??'SIGNAL_LOAD_FAILED'}: ${error.message}`;}}
   root.append(el('h2',t('Title','Signal reliability')));
   const button=(action,label,parent=root,enabled=true,id=null)=>{const b=el('button',label);b.type='button';b.className='ep-button';b.dataset.action=action;if(id!==null)b.dataset.id=id;b.disabled=this.#busy||!enabled;parent.append(b);};
   root.append(el('h3',t('Policy','Native event policy')));
   for(const eventType of SUPPORTED_NATIVE_EVENT_TYPES){
    const field=el('label',t(`Event_${eventType.replaceAll('.','_')}`,eventLabels[eventType]));field.className='ep-field';const select=el('select');select.className='ep-input';select.dataset.eventType=eventType;
    for(const [value,label] of [['best-effort',t('BestEffort','Best effort')],['critical',t('Critical','Critical — durable intake')]]){const option=el('option',label);option.value=value;select.append(option);}
    select.value=this.#rules[eventType]??'best-effort';field.append(select);root.append(field);
   }
   const watches=el('label',t('Watches','Watch native document UUIDs (one per line)')),sourceText=el('textarea');sourceText.className='ep-input';sourceText.dataset.field='sources';sourceText.value=this.#sourceText;watches.append(sourceText);root.append(watches);
   root.append(el('small',t('WatchHistory','Previously watched sources remain available for recovery review.')));
   button('load-policy',t('Reload','Reload policy'));button('save-policy',t('Save','Save reviewed policy'),root,this.#reviewed&&Boolean(this.#policy));
   root.append(el('h3',t('Pending','Pending critical signals')));
   button('pending',t('LoadPending','Load pending signals'));button('pending-next',t('NextPending','Next pending page'),root,Boolean(this.#pending?.nextCursor));
   for(const item of this.#pending?.items??[]){const article=el('article',`${item.eventId} · ${item.status}`);article.className='ep-board-item';button('inspect',t('Inspect','Inspect signal'),article,true,item.eventId);root.append(article);}
   if(this.#selected){const item=this.#selected;const panel=el('section');panel.className='ep-panel';panel.append(el('h4',item.eventId),el('p',`${t('Status','Status')}: ${item.status} · ${t('EventJournal','Event journal')}: ${item.ledgerState??t('NotAccepted','Not accepted')}`));
    const recoverable=item.status==='pending-intake'&&item.ledgerState===null,discardable=['pending-intake','incomplete-intake'].includes(item.status)&&item.ledgerState===null;
    button('reconcile',t('Reconcile','Reconcile existing journal'),panel,true);
    button('resume',t('Resume','Submit reviewed original signal'),panel,this.#reviewed&&recoverable);
    button('dismiss',t('Dismiss','Dismiss with review reason'),panel,this.#reviewed&&discardable&&Boolean(this.#reason.trim()));root.append(panel);
   }
   root.append(el('h3',t('Sources','Watched native sources')));button('sources',t('CheckSources','Check watched sources'));button('sources-next',t('NextSources','Next source page'),root,this.#sources?.nextOffset!==null&&this.#sources?.nextOffset!==undefined);
   for(const item of this.#sources?.items??[]){const article=el('article',`${item.documentUuid} · ${item.requiresReview?t('NeedsReview','Review required'):t('Current','Checkpoint current')}`);article.className='ep-board-item';
    if(item.requiresReview)button('select-source',t('ReviewSource','Review source checkpoint'),article,true,item.documentUuid);root.append(article);
   }
   if(this.#source){root.append(el('h4',this.#source.documentUuid),el('p',t('CheckpointScope','Source acknowledgement updates this checkpoint. Pending original signals retain their own review.')));button('ack-source',t('Acknowledge','Acknowledge reviewed source change'),root,this.#reviewed&&Boolean(this.#reason.trim()));}
   const reason=el('label',t('Reason','Review reason')),input=el('input');input.className='ep-input';input.dataset.field='reason';input.value=this.#reason;input.maxLength=500;reason.append(input);root.append(reason);
   const review=el('label',t('Review','I have reviewed these selections and authorize the chosen action.')),checkbox=el('input');checkbox.type='checkbox';checkbox.dataset.field='reviewed';checkbox.checked=this.#reviewed;review.prepend(checkbox);root.append(review);
   if(this.#message)root.append(el('p',this.#message));
   root.addEventListener('input',event=>{
    if(this.#busy)return;const target=event.target;if(target.dataset.field==='reviewed')return;
    if(target.dataset.field==='sources')this.#sourceText=target.value;else if(target.dataset.field==='reason')this.#reason=target.value;else if(target.dataset.eventType)this.#rules[target.dataset.eventType]=target.value;else return;
    this.#reviewed=false;checkbox.checked=false;for(const b of root.querySelectorAll('[data-action="save-policy"],[data-action="resume"],[data-action="dismiss"],[data-action="ack-source"]'))b.disabled=true;
   });
   root.addEventListener('change',event=>{if(!this.#busy&&event.target.dataset.field==='reviewed'){this.#reviewed=event.target.checked;void this.render();}});
   root.addEventListener('click',event=>{const b=event.target.closest?.('button[data-action]');if(!b||b.disabled||this.#busy)return;
    void(async()=>{this.#busy=true;for(const node of root.querySelectorAll('input,textarea,select,button'))node.disabled=true;
     try{
      if(!gameInstance?.user?.isGM)throw Error(t('GMRequired','GM authority required'));
      const action=b.dataset.action,reviewEventId=`ep:event:signal_review_${secureUUID().replaceAll('-','')}`;
      if(['save-policy','resume','dismiss','ack-source'].includes(action)&&!this.#reviewed)throw Error(t('Approval','Fresh GM review is required'));
      if(action==='load-policy')this.#setPolicy(await service.load());
      else if(action==='save-policy')this.#setPolicy(await service.configure({rules:SUPPORTED_NATIVE_EVENT_TYPES.map(eventType=>({eventType,tier:this.#rules[eventType]??'best-effort'})),sourceUuids:this.#sourceText.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),expectedRevision:this.#policy.revision,reviewEventId}));
      else if(action==='pending'||action==='pending-next')this.#pending=await service.listPending({limit:16,cursor:action==='pending-next'?this.#pending.nextCursor:null});
      else if(action==='inspect'){this.#selected=await service.inspect({eventId:b.dataset.id});this.#source=null;}
      else if(action==='reconcile'){this.#selected=await service.reconcile({eventId:this.#selected.eventId});this.#pending=await service.listPending({limit:16});}
      else if(action==='resume'||action==='dismiss'){
       const spec={eventId:this.#selected.eventId,expectedRevision:this.#selected.revision,approved:true};
       if(action==='resume')await service.resume(spec);else await service.dismiss({...spec,reviewEventId,reason:this.#reason});
       this.#selected=await service.inspect({eventId:spec.eventId});this.#pending=await service.listPending({limit:16});
      }else if(action==='sources'||action==='sources-next'){this.#sources=await service.checkSources({offset:action==='sources-next'?this.#sources.nextOffset:0,limit:8,reviewEventId});this.#source=null;}
      else if(action==='select-source'){this.#source=this.#sources.items.find(s=>s.documentUuid===b.dataset.id);this.#selected=null;}
      else if(action==='ack-source'){await service.acknowledgeSource({documentUuid:this.#source.documentUuid,expectedRevision:this.#source.revision,expectedStamp:this.#source.current,reviewEventId,reason:this.#reason,approved:true});this.#source=null;this.#sources=await service.checkSources({reviewEventId});}
      this.#message=t('Updated','Protected reliability review updated.');
     }catch(error){this.#message=`${error.code??'SIGNAL_REVIEW_FAILED'}: ${error.message}`;}
     finally{this.#busy=false;this.#reviewed=false;if(!this.#closed)await this.render();}
    })();
   });
   if(!gameInstance?.user?.isGM)root.replaceChildren(el('p',t('GMRequired','GM authority required')));
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
