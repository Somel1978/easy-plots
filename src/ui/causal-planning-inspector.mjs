/** Focus-scoped, GM-only read inspector for temporal and cross-plot plans.
 * No direct effect execution, global graph enumeration, or unfiltered player
 * transport. All text comes through textContent, never HTML injection.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
const element=(tag,cls='',txt='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=String(txt);return e;};
const ids=v=>String(v).split(',').map(x=>x.trim()).filter(Boolean);
export function makeGMCausalPlanningWindow(Base,{gameInstance,queryDue,queryCrossPlot,queueDue=null,queryNPC=null,catchup=null}={}){
 if(typeof queryDue!=='function'||typeof queryCrossPlot!=='function')
  throw new EasyPlotsError('INSPECTOR_DEPENDENCY','GM temporal and cross-plot read providers required');
 return class EasyPlotsCausalPlanningWindow extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-causal-planning',window:{title:'Easy Plots — Causal Planning Inspector',resizable:true},position:{width:760,height:670}};
  #mode='due';#from='0';#to='180';#eventId='ep:event:inspect_001';#eventType='evidence.discovered';
  #sourcePlotId='ep:plot:source_001';#known='';#scopes='world';#result=null;#message='';#busy=false;#dueSelected='';#dueAck=false;
  #npcSchedule='ep:schedule:example_001';#npcReceipts='';#npcCorrections='';#npcTime='0';
  #catchupId='ep:catchup:offline_review001';#catchupRevision=null;#catchupBucket='0';#catchupPage='0';
  async _renderHTML(){
   const root=element('section','ep-editor ep-causal-planning');
   if(!gameInstance?.user?.isGM){root.append(element('p','ep-error','GM authority required'));return root;}
   root.append(element('h2','','Scoped Timeline & Cross-Plot Inspector'));
   root.append(element('p','ep-banner','GM-only read preview. No time changes, auto-activation, or native effects.'));
   const switcher=element('select','ep-input');switcher.dataset.field='mode';
   for(const [value,label] of [['due','Due narrative commitments'],['crossplot','Cross-plot event dependencies'],...(queryNPC?[['npc','NPC agenda and knowledge']]:[]),...(catchup?[['catchup','Resume long temporal catch-up']]:[])]){
    const opt=element('option','',label);opt.value=value;switcher.append(opt);
   }switcher.value=this.#mode;root.append(switcher);
   const defs=this.#mode==='catchup'?[['catchupId','Catch-up job ID',this.#catchupId],['from','After fictional world time (-1 includes time zero)',this.#from],['to','Through fictional world time',this.#to],['catchupBucket','Retained bucket to inspect',this.#catchupBucket],['catchupPage','Retained page in bucket',this.#catchupPage]]:this.#mode==='due'?[['from','From world-time day',this.#from],['to','To world-time day',this.#to]]:this.#mode==='npc'?[
     ['npcSchedule','Canonical NPC schedule ID',this.#npcSchedule],['npcReceipts','NPC knowledge receipt IDs (comma separated)',this.#npcReceipts],['npcCorrections','Knowledge correction IDs (comma separated)',this.#npcCorrections],['npcTime','Current fictional world time',this.#npcTime]]:[
     ['eventId','Canonical event ID',this.#eventId],['eventType','Event type',this.#eventType],
     ['sourcePlotId','Verified source plot ID',this.#sourcePlotId],['known','GM-known fact IDs (comma separated)',this.#known],
     ['scopes','Approved narrative scopes (comma separated)',this.#scopes]];
   for(const [key,label,value] of defs){const field=element('label','ep-field');field.append(element('span','ep-label',label));
    const input=element('input','ep-input');input.dataset.field=key;input.value=value;field.append(input);root.append(field);}
   const submit=element('button','ep-button','Inspect selected scope');submit.type='button';submit.dataset.action='inspect';root.append(submit);
   if(this.#mode==='catchup'){
    root.append(element('p','ep-banner','Each step retains one bounded posting page and saves progress. Completion means the index was reviewed; it does not mean actions happened. Late or repaired entries require another catch-up job.'));
    for(const [action,label] of [['create-catchup','Create catch-up job'],['advance-catchup','Retain next indexed page'],['read-catchup-page','Read retained bucket']]){
     const b=element('button','ep-button',label);b.type='button';b.dataset.action=action;b.disabled=action!=='create-catchup'&&this.#catchupRevision===null;root.append(b);
    }
   }
   if(['due','catchup'].includes(this.#mode)&&Array.isArray(this.#result?.candidates)&&this.#result.candidates.length&&typeof queueDue==='function'){
    const area=element('section','ep-panel ep-due-queue');area.append(element('h3','','Queue a verified due event for GM review'));
    area.append(element('p','ep-banner','This only records a GM-originated narrative event; it does not execute the scheduled action.'));
    const select=element('select','ep-input');select.dataset.field='dueScheduleId';
    const empty=element('option','','Select one indexed commitment');empty.value='';select.append(empty);
    for(const candidate of this.#result.candidates){const option=element('option','',candidate.id);option.value=candidate.id;select.append(option);}
    select.value=this.#dueSelected;area.append(select);
    const ackLabel=element('label','ep-field');const ack=element('input','ep-input');ack.type='checkbox';ack.checked=this.#dueAck;ack.dataset.field='ackDue';
    ackLabel.append(ack,element('span','ep-label','I authorize recording this due event for GM review'));area.append(ackLabel);
    const queue=element('button','ep-button','Record due narrative event');queue.type='button';queue.dataset.action='queue-due';
    queue.disabled=!this.#dueAck||!this.#result.candidates.some(c=>c.id===this.#dueSelected);area.append(queue);root.append(area);
   }
   if(this.#message)root.append(element('p','ep-warning',this.#message));
   if(this.#result){const panel=element('section','ep-panel ep-causal-result');panel.append(element('h3','','Indexed GM preview'));
    panel.append(element('pre','ep-lab-output',JSON.stringify(this.#result,null,2)));root.append(panel);}
   root.addEventListener('input',ev=>{
    if(this.#busy||this.#mode!=='catchup'||!['catchupId','from','to'].includes(ev.target?.dataset?.field))return;
    this.#catchupRevision=null;this.#result=null;this.#dueAck=false;this.#dueSelected='';
    root.querySelectorAll('.ep-due-queue,.ep-causal-result').forEach(e=>e.remove());
    root.querySelectorAll('[data-action="advance-catchup"],[data-action="read-catchup-page"]').forEach(b=>{b.disabled=true;});
   });
   root.addEventListener('change',ev=>{if(this.#busy)return;
    if(ev.target?.dataset?.field==='mode'){this.#mode=ev.target.value;this.#result=null;this.#message='';this.#dueAck=false;this.#dueSelected='';void this.render();}
    if(ev.target?.dataset?.field==='dueScheduleId'){this.#dueSelected=ev.target.value;this.#dueAck=false;void this.render();}
    if(ev.target?.dataset?.field==='ackDue'){this.#dueAck=Boolean(ev.target.checked);void this.render();}});
   root.addEventListener('click',ev=>{
    const action=ev.target?.dataset?.action;if(this.#busy||ev.target?.disabled||!['inspect','queue-due','create-catchup','advance-catchup','read-catchup-page'].includes(action))return;
    void(async()=>{this.#busy=true;try{
     if(action==='queue-due'){
      if(typeof queueDue!=='function'||!['due','catchup'].includes(this.#mode)||!this.#dueAck||
        !this.#result?.candidates?.some(candidate=>candidate.id===this.#dueSelected))
        throw new EasyPlotsError('DUE_REVIEW_REQUIRED','Explicit authorized schedule selection is required');
      const worldTime=Number(this.#to);
      if(!Number.isSafeInteger(worldTime)||worldTime<0)throw new EasyPlotsError('DUE_TIME','Finite current world time required');
      const result=await queueDue({scheduleId:this.#dueSelected,worldTime});
      this.#dueAck=false;this.#dueSelected='';
      this.#message=`GM review event recorded (${result.status??'received'}). No scheduled action was executed.`;
      return;
     }
     if(!gameInstance?.user?.isGM)throw new EasyPlotsError('GM_REQUIRED','GM authority required');
     const read=key=>root.querySelector(`[data-field="${key}"]`)?.value?.trim()??'';
     if(this.#mode==='catchup'){
      if(!catchup)throw Error('Protected catch-up service required');
      const id=read('catchupId');let job;
      if(action==='create-catchup'){
       const sourceEventId=`ep:event:catchup_review_${secureUUID().replaceAll('-','_')}`;
       job=await catchup.create({id,from:Number(read('from')),to:Number(read('to')),sourceEventId});this.#result={job,candidates:[]};
      }else if(action==='advance-catchup'){
       if(id!==this.#catchupId||this.#catchupRevision===null)throw Error('Inspect the current catch-up job first');
       const step=await catchup.advance({id,expectedRevision:this.#catchupRevision,maxBuckets:1,sourceEventId:`ep:event:catchup_step_${secureUUID().replaceAll('-','_')}`});job=step.job;
       this.#result={...step,candidates:step.pages.flatMap(p=>p.data.body.candidates)};if(step.pages.length){this.#catchupBucket=String(step.pages.at(-1).data.body.bucket);this.#catchupPage=String(step.pages.at(-1).data.body.page??0);}
      }else if(action==='read-catchup-page'){
       const page=await catchup.readPage({id,bucket:Number(read('catchupBucket')),page:Number(read('catchupPage'))});if(!page)throw Error('This bucket has not been retained');job=await catchup.read({id});
       this.#catchupBucket=read('catchupBucket');this.#catchupPage=read('catchupPage');this.#result={job,page,candidates:page.data.body.candidates};
      }else{job=await catchup.read({id});if(!job)throw Error('Catch-up job not found');this.#result={job,candidates:[]};}
      this.#catchupId=id;this.#catchupRevision=job.revision;this.#from=String(job.data.from);this.#to=String(job.data.to);this.#dueSelected='';this.#dueAck=false;
     }else if(this.#mode==='due'){
      this.#from=read('from');this.#to=read('to');this.#dueSelected='';this.#dueAck=false;
      const from=Number(this.#from),to=Number(this.#to);
      if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<from)throw new Error('Finite integer world-time days required');
      this.#result=await queryDue({from,to});
     }else if(this.#mode==='npc'){
      this.#npcSchedule=read('npcSchedule');this.#npcReceipts=read('npcReceipts');this.#npcCorrections=read('npcCorrections');this.#npcTime=read('npcTime');
      this.#result=await queryNPC({scheduleId:this.#npcSchedule,knowledgeReceiptIds:ids(this.#npcReceipts),correctionIds:ids(this.#npcCorrections),worldTime:Number(this.#npcTime)});
     }else{
      this.#eventId=read('eventId');this.#eventType=read('eventType');this.#sourcePlotId=read('sourcePlotId');
      this.#known=read('known');this.#scopes=read('scopes');
      const knownFactIds=ids(this.#known),approvedScopes=ids(this.#scopes);
      if(knownFactIds.length>64||approvedScopes.length>16)throw new Error('Inspector inputs exceed bounded scope');
      this.#result=await queryCrossPlot({event:{id:this.#eventId,eventType:this.#eventType},
       verifiedSourcePlotId:this.#sourcePlotId,knownFactIds,approvedScopes});
     }
     this.#message='';
    }catch(error){if(action==='inspect')this.#result=null;this.#message=`${error.code??'INSPECTION_ERROR'}: ${error.message}`;}
    finally{this.#busy=false;await this.render();}})();
   });
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
