/** GM-only preparation & inspection of durable knowledge propagation and
 * faction agenda contracts. Authoring a plan is not a narrative effect.
 * Recipient disclosure and faction decisions execute only through existing
 * reviewed graph operations: this window never bypasses the effect journal.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {planKnowledgePropagation} from '../orchestration/knowledge-propagation.mjs';
const el=(tag,cls='',text='')=>{
 const node=document.createElement(tag);if(cls)node.className=cls;node.textContent=String(text);return node;
};
const sample={
 'identity-inspect':{scope:'world',entityId:'ep:entity:contact001'},
 'knowledge-plan':{
  scope:'world',planId:'ep:propagation:planning001',sourceEventId:'ep:event:knowledge001',worldTime:100,
  disclosure:{eventId:'ep:event:knowledge001',claimId:'ep:claim:manifest001',sourceId:'ep:actor:witness001',initialRecipientIds:['ep:actor:harper001'],stance:'reported'},
  recipientStates:[{observerId:'ep:actor:harper001',knownEventIds:[]}],connections:[]
 },
 'knowledge-inspect':{scope:'world',planId:'ep:propagation:planning001'},
 'agenda-publish':{scope:'world',agendaId:'ep:agenda:harper001',factionId:'ep:faction:harper001',sourceEventId:'ep:event:agenda001',
  rules:[{id:'investigate-cargo',actionId:'investigate-pier',notBefore:100,expiresAt:200,
   requiredCanonicalFactIds:['ep:fact:manifest001'],requiredFactionKnowledgeIds:['ep:claim:manifest001']}]},
 'agenda-assess':{scope:'world',agendaId:'ep:agenda:harper001',knowledgeReceiptIds:[],worldTime:150},
 'forecast-create':{scope:'world',forecastId:'ep:forecast:harper001',agendaId:'ep:agenda:harper001',sourceEventId:'ep:event:forecast001',knowledgeReceiptIds:[],worldTime:150,expiresAt:180,predictions:[{ruleId:'investigate-cargo',summary:'The faction may send investigators to the pier'}]},
 'forecast-inspect':{scope:'world',forecastId:'ep:forecast:harper001',worldTime:150},
 'dependency-register':{scope:'world',id:'ep:dependency:inference001',dependent:{kind:'domain',type:'objective',id:'ep:objective:inference001',revision:1},sources:[{type:'knowledge-receipt',id:'ep:receipt:known001',revision:1}],sourceEventId:'ep:event:dependency001'},
 'dependency-retire':{scope:'world',id:'ep:dependency:inference001',expectedRevision:2,sourceEventId:'ep:event:retire_dependency001'},
 'correction-stage-inspect':{scope:'world',receiptId:'ep:receipt:known001',correctionId:'ep:correction:review001'},
 'correction-stage-review':{scope:'world',receiptId:'ep:receipt:known001',correctionId:'ep:correction:review001',expectedRevision:1,decision:'cancel-uncommitted',reason:'The GM verified this correction was never committed',sourceEventId:'ep:event:correction_stage_review001'},
 'review-begin':{scope:'world',change:{kind:'receipt-correction',correctionId:'ep:correction:review001',revision:1},reviewPass:0},
 'review-inspect':{scope:'world',id:'ep:knowledge-review-job:known001'},
 'review-advance':{scope:'world',id:'ep:knowledge-review-job:known001',expectedRevision:1},
 'review-list':{scope:'world',jobId:'ep:knowledge-review-job:known001',limit:16},
 'review-decide':{scope:'world',jobId:'ep:knowledge-review-job:known001',id:'ep:knowledge-review:known001',expectedRevision:1,decision:'followup-required',reason:'Review this conclusion with the corrected knowledge'}
};
const reviewWrites=new Set(['dependency-register','dependency-retire','correction-stage-review','review-begin','review-advance','review-decide']);
const writing=new Set(['knowledge-plan','agenda-publish','forecast-create',...reviewWrites]);
export function makeGMKnowledgeFactionDeskWindow(Base,{gameInstance,knowledgePropagation,factionAgendas,forecasts=null,knowledgeReviews=null,identities=null}={}){
 if(typeof knowledgePropagation?.plan!=='function'||typeof knowledgePropagation?.readPlan!=='function'||
   typeof factionAgendas?.publish!=='function'||typeof factionAgendas?.assess!=='function')
  throw new EasyPlotsError('SOCIETY_DESK_DEPENDENCY','Guarded knowledge/faction services required');
 return class EasyPlotsKnowledgeFactionDesk extends Base{
  static DEFAULT_OPTIONS={id:'easy-plots-knowledge-faction-desk',window:{title:'Easy Plots — Society & Knowledge Desk',resizable:true},position:{width:820,height:720}};
  #mode='knowledge-plan';#input=JSON.stringify(sample['knowledge-plan'],null,2);#result=null;#message='';#busy=false;#acknowledged=false;#previewHash=null;
  async _renderHTML(){
   const root=el('section','ep-editor ep-society-desk');
   if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM authority required'));return root;}
   root.append(el('h2','','Knowledge and Faction Orchestration'));
   root.append(el('p','ep-banner','Protected authoring. Plan/agenda publication never executes native effects or auto-shares secrets. Recipient decisions require the journaled GM event-review workflow.'));
   const mode=el('select','ep-input');mode.dataset.field='mode';
   const choices=[['knowledge-plan','Plan recipient-specific disclosure'],['knowledge-inspect','Inspect stored propagation plan'],['agenda-publish','Publish faction agenda contract'],['agenda-assess','Assess faction knowledge and eligibility']];
   if(forecasts)choices.push(['forecast-create','Prepare grounded faction forecast'],['forecast-inspect','Check forecast dependencies']);
   if(identities)choices.push(['identity-inspect','Inspect a narrative entity or persona and optional native reference']);
   if(knowledgeReviews)choices.push(['dependency-register','Register conclusion knowledge dependencies'],['review-begin','Begin correction review from an exact source'],['review-inspect','Inspect durable correction review'],['review-advance','Retain the next source page and queue reviews'],['review-list','Load one page of dependent conclusions'],['review-decide','Record an explicit conclusion review']);
   if(knowledgeReviews)choices.push(['dependency-retire','Retire an obsolete dependency before separately reviewed follow-up'],['correction-stage-inspect','Inspect an interrupted correction source'],['correction-stage-review','Confirm or cancel interrupted correction staging']);
   for(const [key,label] of choices){
    const option=el('option','',label);option.value=key;mode.append(option);
   }mode.value=this.#mode;root.append(mode);
   const scenario=el('textarea','ep-input');scenario.rows=13;scenario.dataset.field='scenario';scenario.value=this.#input;root.append(scenario);
   const preview=el('button','ep-button','Preview');preview.type='button';preview.dataset.action='preview';root.append(preview);
   if(writing.has(this.#mode)&&this.#result){
    const row=el('label','ep-field');const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=this.#acknowledged;checkbox.dataset.field='confirm';
    row.append(checkbox,el('span','ep-label','I have reviewed this configuration; save the typed GM-only record.'));root.append(row);
    const commit=el('button','ep-button',reviewWrites.has(this.#mode)?'Save reviewed knowledge audit action':this.#mode==='knowledge-plan'?'Save GM propagation plan':this.#mode==='forecast-create'?'Save GM forecast hypothesis':'Publish immutable agenda');
    commit.type='button';commit.dataset.action='commit';commit.disabled=!this.#acknowledged;root.append(commit);
   }
   if(this.#message)root.append(el('p','ep-warning',this.#message));
   if(this.#result){const box=el('section','ep-panel');box.append(el('h3','','GM-only result'));
    box.append(el('pre','ep-lab-output',JSON.stringify(this.#result,null,2)));root.append(box);}
   root.addEventListener('change',event=>{
    if(event.target?.dataset?.field==='mode'&&!this.#busy){this.#mode=event.target.value;
     this.#input=JSON.stringify(sample[this.#mode],null,2);this.#result=null;this.#acknowledged=false;this.#message='';this.#previewHash=null;void this.render();}
    if(event.target?.dataset?.field==='confirm'){this.#acknowledged=event.target.checked;void this.render();}
   });
   root.addEventListener('input',event=>{
    if(event.target?.dataset?.field==='scenario'){this.#result=null;this.#acknowledged=false;this.#previewHash=null;
     this.#message='Input changed. Preview again before any write.';root.querySelector('[data-action="commit"]')?.setAttribute('disabled','');}
   });
   root.addEventListener('click',event=>{
    const action=event.target?.closest?.('button[data-action]')?.dataset?.action;
    if(!action||this.#busy)return;
    void(async()=>{this.#busy=true;try{
      if(!gameInstance?.user?.isGM)throw new EasyPlotsError('GM_REQUIRED','GM authority required');
      const raw=scenario.value;if(raw.length>14_000)throw new Error('Scenario exceeds editor input budget');
      const data=JSON.parse(raw);
      if(action==='preview'){
       this.#input=raw;this.#acknowledged=false;
       this.#result=this.#mode==='knowledge-plan'?planKnowledgePropagation({...data,maxPlanned:16,maxConnections:48}):
        this.#mode==='identity-inspect'?await identities.resolve(data):
        reviewWrites.has(this.#mode)?{action:this.#mode,request:data,effectsExecuted:0,note:'Dependency registration and review preserve prior reasoning. No graph is evaluated and no conclusion is rewritten.'}:
        this.#mode==='review-inspect'?await knowledgeReviews.readJob(data):
        this.#mode==='review-list'?await knowledgeReviews.list(data):
        this.#mode==='correction-stage-inspect'?await knowledgeReviews.inspectCorrectionStage(data):
        this.#mode==='knowledge-inspect'?await knowledgePropagation.readPlan(data):
        this.#mode==='agenda-publish'?{review:'Typed agenda ready for explicit publication',rules:data.rules?.length??0,autoEffects:false}:
        this.#mode==='forecast-create'?await forecasts.preview(data):
        this.#mode==='forecast-inspect'?await forecasts.inspect(data):
        await factionAgendas.assess(data);
       this.#previewHash=raw;this.#message='Preview only. No GM-authorized effect or player disclosure has occurred.';
      }else{
       if(!writing.has(this.#mode)||!this.#acknowledged||this.#previewHash!==raw||!this.#result)
        throw new Error('A fresh preview and explicit acknowledgement are required');
       const reviewMethod={'dependency-register':'register','dependency-retire':'retire','correction-stage-review':'reviewCorrectionStage','review-begin':'begin','review-advance':'advance','review-decide':'decide'}[this.#mode];
       this.#result=reviewMethod?await knowledgeReviews[reviewMethod](data):this.#mode==='knowledge-plan'?await knowledgePropagation.plan(data):this.#mode==='forecast-create'?await forecasts.create(data):await factionAgendas.publish(data);
       this.#message='GM-only record saved. Use a published graph and the GM event-review journal to authorize any narrative consequence.';
       this.#acknowledged=false;this.#previewHash=null;
      }
    }catch(error){this.#message=`${error.code??'DESK_ERROR'}: ${error.message}`;this.#result=null;this.#acknowledged=false;this.#previewHash=null;}
    finally{this.#busy=false;await this.render();}})();
   });
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
