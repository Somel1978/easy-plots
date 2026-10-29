/** GM history authoring and lazy archival. All authored strings stay inert. */
import {secureUUID,sha256Hex} from '../contracts/digest.mjs';
import {localize} from './localization.mjs';
const t=(key,fallback)=>localize(`EasyPlots.History.${key}`,fallback);
const el=(tag,text='')=>{const node=document.createElement(tag);node.textContent=String(text);return node;};
const memberTypes=['objective','obligation','story-hook','world-fact','relationship','observer-belief','evidence','investigation','chronology-event','chronology-knowledge','knowledge-claim','knowledge-receipt','knowledge-correction','scheduled-commitment','session-handoff'];
export function makeGMHistoryDeskWindow(Base,{gameInstance,chronology,archives}={}){
 if(typeof chronology?.query!=='function'||typeof chronology?.recordEvent!=='function'||typeof archives?.prepare!=='function'||typeof archives?.readSummary!=='function')throw Error('Protected chronology and archive services required');
 return class EasyPlotsHistoryDesk extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-history-desk',window:{title:'Easy Plots — Narrative History',resizable:true},position:{width:800,height:740}};
  #values={scope:'world',arcId:'',mode:'fiction',observerId:'',from:'0',to:'3600',eventId:'',fictionAt:'',causeEntryIds:'',receiptId:'',archiveId:`ep:archive:history_${secureUUID().replaceAll('-','')}`,arcRevision:'',title:'',text:'',memberType:'objective',memberId:'',memberRevision:'',page:'0'};
  #result=null;#job=null;#cursor=null;#reviewed=false;#busy=false;#closed=false;#message='';
  async close(options){this.#closed=true;return typeof super.close==='function'?super.close(options):this;}
  async _renderHTML(){
   const root=el('section');root.className='ep-editor ep-history-desk';
   if(!gameInstance?.user?.isGM){root.append(el('p',t('GMRequired','GM authority required')));return root;}
   root.append(el('h2',t('Title','Narrative History')));
   const field=(key,label,{type='text',options=null,area=false}={})=>{
    const wrapper=el('label',label);wrapper.className='ep-field';const input=el(options?'select':area?'textarea':'input');input.className='ep-input';input.dataset.field=key;
    if(options)for(const [value,name] of options){const option=el('option',name);option.value=value;input.append(option);}
    else if(!area)input.type=type;
    input.value=this.#values[key];wrapper.append(input);root.append(wrapper);
   };
   const action=(key,label,enabled=true)=>{const b=el('button',label);b.type='button';b.className='ep-button';b.dataset.action=key;b.disabled=this.#busy||!enabled;root.append(b);};
   field('scope',t('Scope','Scope'));field('arcId',t('Arc','Arc ID'));
   field('mode',t('View','View'),{options:[['fiction',t('Fiction','Fiction time')],['execution',t('Execution','Execution time')],['knowledge',t('Knowledge','Observer knowledge')],['archive',t('Archive','Concluded arc archive')]]});
   if(this.#values.mode!=='archive'){
    field('from',t('From','From'),{type:'number'});field('to',t('To','To'),{type:'number'});
    if(this.#values.mode==='knowledge')field('observerId',t('Observer','Observer ID'));
    action('query',t('Query','Load chronology'));action('next',t('Next','Next page'),Boolean(this.#cursor));
    if(this.#values.mode==='knowledge'){field('receiptId',t('Receipt','Disclosure receipt ID'));}
    else{field('eventId',t('Event','Recorded event ID'));field('fictionAt',t('FictionAt','Fiction time (optional)'),{type:'number'});field('causeEntryIds',t('Causes','Preceding entry IDs (comma-separated)'));}
   }else{
    action('summary',t('Summary','Load arc summary'));field('archiveId',t('ArchiveId','Archive job ID'));action('inspect',t('Inspect','Resume archive job'));
    field('arcRevision',t('ArcRevision','Concluded arc revision'),{type:'number'});field('title',t('SummaryTitle','Summary title'));field('text',t('SummaryText','GM summary'),{area:true});
    if(this.#job){root.append(el('p',`${t('Progress','Archive progress')}: ${this.#job.data.state} · ${this.#job.data.completedPages}/${this.#job.data.pageIds.length}`));}
    field('memberType',t('MemberType','Historical record type'),{options:memberTypes.map(value=>[value,value])});field('memberId',t('MemberId','Historical record ID'));field('memberRevision',t('MemberRevision','Historical revision'),{type:'number'});
    field('page',t('Page','History page'),{type:'number'});action('page',t('LoadPage','Load selected history page'),this.#job?.data.state==='archived');
   }
   const review=el('label',t('Review','I have reviewed these selections and authorize this action.')),checkbox=el('input');checkbox.type='checkbox';checkbox.dataset.field='reviewed';checkbox.checked=this.#reviewed;review.prepend(checkbox);root.append(review);
   if(this.#values.mode!=='archive')action('record',this.#values.mode==='knowledge'?t('IndexDisclosure','Add disclosed knowledge'):t('Record','Add recorded event'),this.#reviewed);
   else{
    action('prepare',t('Prepare','Prepare archive'),this.#reviewed&&!this.#job);
    action('append',t('Append','Add selected historical revision'),this.#reviewed&&this.#job?.data.state==='collecting');
    action('seal',t('Seal','Approve selected archive'),this.#reviewed&&this.#job?.data.state==='collecting');
    action('advance',t('Advance','Retain next history page'),this.#job?.data.state==='archiving'&&this.#job.data.completedPages<this.#job.data.pageIds.length);
    action('finalize',t('Finalize','Finish archive'),this.#reviewed&&Boolean(this.#job)&&['archiving','archived'].includes(this.#job.data.state)&&this.#job.data.completedPages===this.#job.data.pageIds.length);
   }
   if(this.#message)root.append(el('p',this.#message));
   if(this.#result){const panel=el('pre',JSON.stringify(this.#result,null,2));panel.className='ep-lab-output';root.append(panel);}
   root.addEventListener('input',event=>{
    const key=event.target?.dataset?.field;if(!key||key==='reviewed'||this.#busy)return;
    this.#values[key]=event.target.value;this.#reviewed=false;this.#cursor=null;this.#result=null;
    if(['scope','arcId','archiveId'].includes(key)){this.#job=null;for(const b of root.querySelectorAll('[data-action="advance"],[data-action="page"]'))b.disabled=true;}
    root.querySelector('[data-field="reviewed"]').checked=false;
    for(const b of root.querySelectorAll('[data-action="record"],[data-action="prepare"],[data-action="append"],[data-action="seal"],[data-action="finalize"],[data-action="next"]'))b.disabled=true;
   });
   root.addEventListener('change',event=>{
    if(this.#busy)return;const key=event.target?.dataset?.field;
    if(key==='reviewed'){this.#reviewed=event.target.checked;void this.render();}
    else if(key==='mode'){this.#values.mode=event.target.value;this.#job=null;this.#result=null;this.#cursor=null;this.#reviewed=false;void this.render();}
   });
   root.addEventListener('click',event=>{
    const button=event.target.closest?.('button[data-action]');if(!button||button.disabled||this.#busy)return;
    void(async()=>{this.#busy=true;for(const input of root.querySelectorAll('input,textarea,select,button'))input.disabled=true;
     try{
      if(!gameInstance?.user?.isGM)throw Error(t('GMRequired','GM authority required'));
      const values={...this.#values},scope=values.scope.trim(),arcId=values.arcId.trim(),archiveId=values.archiveId.trim(),action=button.dataset.action;
      const sourceEventId=`ep:event:history_${secureUUID().replaceAll('-','')}`,expectedRevision=this.#job?.revision;
      if(['record','prepare','append','seal','finalize'].includes(action)&&!this.#reviewed)throw Error(t('ReviewRequired','Review these selections first'));
      let result;
      if(action==='query'||action==='next'){
       result=await chronology.query({scope,arcId,timeline:values.mode,observerId:values.mode==='knowledge'?values.observerId.trim():null,from:Number(values.from),to:Number(values.to),limit:16,cursor:action==='next'?this.#cursor:null});
       this.#cursor=result.nextCursor;
      }else if(action==='record'){
       result=values.mode==='knowledge'?await chronology.indexDisclosure({scope,arcId,receiptId:values.receiptId.trim()}):
        await chronology.recordEvent({scope,arcId,eventId:values.eventId.trim(),entryId:`ep:chronology:${(await sha256Hex(JSON.stringify({scope,arcId,eventId:values.eventId.trim()}))).slice(0,24)}`,
         fictionAt:values.fictionAt===''?null:Number(values.fictionAt),causeEntryIds:values.causeEntryIds.split(',').map(s=>s.trim()).filter(Boolean)});
      }else if(action==='summary')result=await archives.readSummary({scope,arcId});
      else if(action==='inspect')this.#job=result=await archives.inspect({scope,archiveId});
      else if(action==='prepare')this.#job=result=await archives.prepare({scope,archiveId,arcId,expectedArcRevision:Number(values.arcRevision),sourceEventId,title:values.title,text:values.text});
      else if(action==='append')this.#job=result=await archives.appendBatch({scope,archiveId,expectedRevision,sourceEventId,references:[{type:values.memberType,id:values.memberId.trim(),revision:Number(values.memberRevision)}]});
      else if(action==='seal')this.#job=result=await archives.seal({scope,archiveId,expectedRevision,reviewEventId:sourceEventId,approved:true});
      else if(action==='advance')this.#job=result=await archives.advance({scope,archiveId,expectedRevision,sourceEventId});
      else if(action==='finalize'){result=await archives.finalize({scope,archiveId,expectedRevision,reviewEventId:sourceEventId});this.#job=await archives.inspect({scope,archiveId});}
      else if(action==='page')result=await archives.loadPage({scope,archiveId,page:Number(values.page)});
      this.#result=result??{state:t('Unavailable','No published summary or archive job found')};this.#message='';this.#reviewed=false;
     }catch(error){this.#message=`${error.code??'HISTORY_ERROR'}: ${error.message}`;this.#result=null;this.#reviewed=false;this.#cursor=null;}
     finally{this.#busy=false;if(!this.#closed)await this.render();}
    })();
   });
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
