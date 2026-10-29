/** Focus-scoped GM narrative continuity interface. No player-delivered raw data,
 * implicit activation, or automatic consequences. Written actions require a
 * fresh preview, an explicit review checkbox and GM authorization.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
const el=(tag,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=String(text);return e;};
const example=Object.freeze({
 arc:{scope:'world',arcId:'ep:arc:waterdeep001'},
 blueprint:{scope:'world',instanceId:'ep:instance:harbor001',targetRevision:2},
 knowledge:{scope:'world',observerId:'ep:actor:hero001',receiptIds:[],correctionIds:[],worldTime:0}
});
export function makeGMContinuityDeskWindow(Base,{gameInstance,arcResolutions,blueprints,knowledgeLedger}={}){
 if(typeof arcResolutions?.plan!=='function'||typeof arcResolutions?.finalize!=='function'||
    typeof blueprints?.planAdoption!=='function'||typeof blueprints?.adopt!=='function'||
    typeof knowledgeLedger?.projection!=='function')
  throw new EasyPlotsError('CONTINUITY_DESK_DEPENDENCY','Verified protected arc, blueprint and knowledge services required');
 return class EasyPlotsContinuityDesk extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-continuity-desk',window:{title:'Easy Plots — Campaign Continuity Desk',resizable:true},position:{width:800,height:710}};
  #mode='arc';#input=JSON.stringify(example.arc,null,2);#result=null;#message='';#busy=false;#reviewed=false;
  #choice='';#resolutions='{}';
  async _renderHTML(){
   const root=el('section','ep-editor ep-continuity-desk');
   if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM authority required'));return root;}
   root.append(el('h2','','Campaign Continuity Desk'));
   root.append(el('p','ep-banner','Protected narrative records. Previews never apply effects; reviewed transitions do not activate story hooks or publish epilogues.'));
   const mode=el('select','ep-input');mode.dataset.field='mode';
   for(const [value,label] of [['arc','Arc finalization'],['blueprint','Blueprint instance update'],['knowledge','Observer knowledge projection']]){
    const option=el('option','',label);option.value=value;mode.append(option);
   }mode.value=this.#mode;root.append(mode);
   const scenario=el('textarea','ep-input');scenario.dataset.field='scenario';scenario.rows=10;scenario.value=this.#input;root.append(scenario);
   const preview=el('button','ep-button','Preview authorized state');preview.type='button';preview.dataset.action='preview';root.append(preview);
   if(this.#result&&this.#mode==='arc'){
    const row=el('label','ep-field');row.append(el('span','ep-label','Eligible ending ID to finalize'));
    const selector=el('select','ep-input');selector.dataset.field='ending';
    for(const e of this.#result.eligible??[]){const opt=el('option','',e.endingId);opt.value=e.endingId;selector.append(opt);}
    if(this.#choice&&(this.#result.eligible??[]).some(e=>e.endingId===this.#choice))selector.value=this.#choice;
    this.#choice=selector.value;row.append(selector);root.append(row);
   }
   if(this.#result&&this.#mode==='blueprint'&&this.#result.conflicts?.length){
    const field=el('label','ep-field');field.append(el('span','ep-label','GM conflict decisions (JSON: field -> source or instance)'));
    const textarea=el('textarea','ep-input');textarea.rows=4;textarea.dataset.field='resolutions';textarea.value=this.#resolutions;field.append(textarea);root.append(field);
   }
   if(this.#result&&this.#mode!=='knowledge'){
    const field=el('label','ep-field');const checkbox=el('input');checkbox.type='checkbox';checkbox.dataset.field='confirmed';checkbox.checked=this.#reviewed;
    field.append(checkbox,el('span','ep-label','I have reviewed the current revisions and authorize the specified transition.'));root.append(field);
    const submit=el('button','ep-button',this.#mode==='arc'?'Finalize selected ending':'Adopt reviewed blueprint update');
    submit.type='button';submit.dataset.action='commit';submit.disabled=!this.#reviewed;root.append(submit);
   }
   if(this.#message)root.append(el('p','ep-warning',this.#message));
   if(this.#result){const panel=el('section','ep-panel');panel.append(el('h3','','GM-only result'));
    panel.append(el('pre','ep-lab-output',JSON.stringify(this.#result,null,2)));root.append(panel);}
   root.addEventListener('change',ev=>{
    if(ev.target?.dataset?.field==='mode'&&!this.#busy){this.#mode=ev.target.value;this.#input=JSON.stringify(example[this.#mode],null,2);
     this.#result=null;this.#reviewed=false;this.#message='';void this.render();}
    if(ev.target?.dataset?.field==='confirmed'){this.#reviewed=ev.target.checked;void this.render();}
    if(ev.target?.dataset?.field==='ending')this.#choice=ev.target.value;
   });
   root.addEventListener('input',ev=>{if(ev.target?.dataset?.field==='scenario'){
    this.#result=null;this.#reviewed=false;this.#message='Inputs changed: preview again before committing.';
    root.querySelector('button[data-action="commit"]')?.setAttribute('disabled','');
   }});
   root.addEventListener('click',ev=>{
    const action=ev.target?.closest?.('button[data-action]')?.dataset?.action;
    if(!action||this.#busy)return;
    void(async()=>{this.#busy=true;try{
      if(!gameInstance?.user?.isGM)throw new EasyPlotsError('GM_REQUIRED','GM authorization required');
      if(action==='preview'){
       this.#input=scenario.value;if(this.#input.length>12_000)throw new Error('Preview scope exceeds input budget');
       const input=JSON.parse(this.#input);this.#reviewed=false;
       this.#result=this.#mode==='arc'?await arcResolutions.plan(input):
         this.#mode==='blueprint'?await blueprints.planAdoption(input):await knowledgeLedger.projection(input);
       this.#choice=this.#mode==='arc'?this.#result.eligible?.[0]?.endingId??'':'';
       this.#message='This preview does not commit narrative state or native effects.';
      }else{
       if(!this.#result||!this.#reviewed||this.#mode==='knowledge')throw new Error('Fresh preview and explicit GM review required');
       const input=JSON.parse(scenario.value);
       if(scenario.value!==this.#input)throw new Error('Review is stale: scenario changed');
       const stamp=secureUUID().replaceAll('-','_');
       if(this.#mode==='arc'){
        const endingId=root.querySelector('[data-field="ending"]')?.value;
        if(!this.#result.eligible?.some(e=>e.endingId===endingId))throw new Error('Chosen ending not eligible');
        // The selected resolution identity is a separately generated record,
        // never derived from a player's submitted title or visible theory.
        this.#result=await arcResolutions.finalize({...input,endingId,
         expectedArcRevision:this.#result.arcRevision,
         resolutionId:`ep:resolution:desk_${stamp}`,approvalEventId:`ep:event:desk_review_${stamp}`});
       }else{
        const decisions=root.querySelector('[data-field="resolutions"]')?.value??'{}';
        this.#resolutions=decisions;if(decisions.length>2048)throw new Error('Conflict policy budget exceeded');
        this.#result=await blueprints.adopt({...input,
         expectedInstanceRevision:this.#result.instanceRevision,
         reviewEventId:`ep:event:desk_review_${stamp}`,conflictResolutions:JSON.parse(decisions)});
       }
       this.#message='Reviewed transition saved. No native Actor/Item effects, story-hook activations, or knowledge disclosures performed.';
       this.#reviewed=false;
      }
    }catch(error){this.#message=`${error.code??'REVIEW_FAILED'}: ${error.message}`;this.#reviewed=false;
     if(action==='preview')this.#result=null;}
    finally{this.#busy=false;await this.render();}})();
   });
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
