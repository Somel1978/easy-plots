/** GM-only durable event/impact inspector with explicit two-step approval and execution. */
import {appendConvergenceDiagnostics} from './convergence-diagnostics.mjs';
const el=(tag,cls='',text='')=>{const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=String(text);return e;};
export function makeEventReviewWindow(Base,{ledger,reviews,runtimeStatus,gameInstance,continuations=null,effectPreview=null}={}){
  if(typeof ledger?.get!=='function'||typeof reviews?.get!=='function')throw Error('Durable narrative ledger and GM review service required');
  return class EasyPlotsEventReview extends Base {
    static DEFAULT_OPTIONS={id:'easy-plots-gm-event-review',window:{title:'Easy Plots — Event Review',resizable:true},position:{width:680,height:550}};
    #id='';#event=null;#message='';#busy=false;
    #selected=new Set();#continuationPreview=null;#continuationSpec=null;#previousId=null;
    async loadEvent(id){
      if(!gameInstance?.user?.isGM)throw Error('GM required');
      this.#id=id;this.#event=await ledger.get(id);this.#selected.clear();this.#continuationPreview=null;this.#continuationSpec=null;this.#previousId=null;
      if(!this.#event)this.#message='Event not found in its bounded durable shard.';return this.render(true);
    }
    async _renderHTML(){
      const root=el('section','ep-editor ep-approvals');
      if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM required'));return root;}
      root.append(el('h3','','Durable Narrative Event Review'));
      const state=runtimeStatus?.()??{};
      root.append(el('p','ep-banner',`Reactive Hooks: ${state.running?'Explicitly enabled':'Disabled'} · ${state.inflight??0} in flight. Native effects require a persisted GM approval and a separate Execute action.`));
      const label=el('label','ep-field');label.append(el('span','ep-label','Exact canonical event ID'));
      const input=el('input','ep-input');input.value=this.#id;input.dataset.field='event-id';label.append(input);root.append(label);
      const find=el('button','ep-button','Load event');find.type='button';find.dataset.action='find';root.append(find);
      if(this.#previousId){const back=el('button','ep-button','Return to source event');back.type='button';back.dataset.action='return-source';root.append(back);}
      if(state.recentEventIds?.length){
        root.append(el('h4','','Recent event IDs in this GM client'));
        const list=el('div','ep-edges');for(const id of state.recentEventIds.slice(0,12)){
          const btn=el('button','ep-button ep-draft-entry',id);btn.type='button';btn.dataset.action='select';btn.dataset.id=id;list.append(btn);
        }root.append(list);
      }
      if(this.#message)root.append(el('p','ep-notice',this.#message));
      if(this.#event){
        const box=el('div','ep-panel');
        appendConvergenceDiagnostics(box,{event:this.#event});
        box.append(el('h4','',`State: ${this.#event.state}`));
        box.append(el('p','',`Event: ${this.#event.event?.eventType??'(unknown)'}`));
        box.append(el('p','',`Origin: ${this.#event.event?.source?.hook??this.#event.event?.source?.kind??'(unknown)'}`));
        box.append(el('p','',`Graph evaluations: ${this.#event.evaluations?.length??0}`));
        box.append(el('p','',`Proposed effects: ${this.#event.proposals?.length??0}`));
        if(this.#event.reason)box.append(el('p','ep-warning',`Reason for manual reconciliation: ${this.#event.reason}`));
        for(const [i,proposal] of (this.#event.proposals??[]).slice(0,32).entries()){
          const review=await reviews.get(this.#event.sourceEventId,proposal.operationId);
          const state=review?.state??'pending';
          let effectDetail=null,previewError=null;if(effectPreview)try{effectDetail=await effectPreview(proposal);}catch(error){previewError=error?.code??'EFFECT_PREVIEW_UNAVAILABLE';}
          const item=el('div','ep-edge');
          item.append(el('p','ep-warning',`${proposal.providerId} · ${proposal.operationId} · ${state}`));
          const preview=el('details','ep-effect-preview');preview.append(el('summary','','Review effect and provenance'),el('p','ep-dim','Recorded proposal; viewing this preview does not apply an effect.'),el('pre','ep-effect-provenance',JSON.stringify({sourceEventId:proposal.sourceEventId,operationId:proposal.operationId,rootGraphId:proposal.rootGraphId??proposal.graphId,rootPublishedVersion:proposal.rootPublishedVersion??proposal.publishedVersion,graphId:proposal.graphId,publishedVersion:proposal.publishedVersion,nodeId:proposal.nodeId,providerId:proposal.providerId,payload:proposal.payload,callChain:proposal.callChain??[],guardInputs:proposal.guardInputs??[],inputObservations:proposal.stateInputs??[]},null,2)));item.append(preview);
          if(review)preview.append(el('pre','ep-approval-history',JSON.stringify({state:review.state,approvedBy:review.approvedBy,reason:review.reason,approvalHistory:review.approvalHistory??[]},null,2)));
          if(effectDetail)preview.append(el('pre','ep-batch-plan-preview',JSON.stringify(effectDetail,null,2)));if(previewError)item.append(el('p','ep-error',`Effect plan unavailable: ${previewError}`));
          if(this.#event.state==='review-required'&&state==='pending'){
            for(const [action,title] of [['approve-effect','Approve'],['reject-effect','Reject']]){
              const btn=el('button','ep-button',title);btn.type='button';btn.dataset.action=action;btn.dataset.index=String(i);if(action==='approve-effect'&&(previewError||effectDetail?.canExecute===false))btn.disabled=true;item.append(btn);
            }
          } else if(this.#event.state==='review-required'&&state==='approved'){
            if(gameInstance?.user?.id&&review.approvedBy!==gameInstance.user.id){
              item.append(el('small','ep-warning','Another GM approved this operation. Review its unchanged effect and provenance before adopting that approval.'));
              if(typeof reviews.adoptApproval==='function'){const field=el('label','ep-field');field.append(el('span','ep-label','Reason for adopting this unexecuted approval'));const reason=el('input','ep-input');reason.maxLength=500;reason.dataset.adoptionReason=String(i);field.append(reason);item.append(field);const btn=el('button','ep-button','Adopt reviewed approval');btn.type='button';btn.dataset.action='adopt-effect';btn.dataset.index=String(i);btn.dataset.reviewRevision=String(review.revision);btn.disabled=true;reason.addEventListener('input',()=>{btn.disabled=!reason.value.trim();});item.append(btn);}
            }else{const btn=el('button','ep-button ep-danger-btn','Execute approved effect');btn.type='button';btn.dataset.action='execute-effect';btn.dataset.index=String(i);if(previewError||effectDetail?.canExecute===false)btn.disabled=true;item.append(btn);}
          } else if(['executing','uncertain'].includes(state)){
            item.append(el('small','ep-warning','Uncertain state requires reconciliation; automatic retries are disabled.'));
            if(typeof reviews.reconcile==='function'){const btn=el('button','ep-button','Reconcile verified outcome');btn.type='button';btn.dataset.action='reconcile-effect';btn.dataset.index=String(i);item.append(btn);}
          }
          if(state==='completed'&&continuations){const field=el('label','ep-field'),check=el('input');check.type='checkbox';check.dataset.operationIndex=String(i);check.checked=this.#selected.has(i);field.append(check,el('span','','Use this verified completion for follow-up'));item.append(field);}
          box.append(item);
        }
        if(continuations){
          const preview=el('button','ep-button','Preview follow-up from selected completions');preview.type='button';preview.dataset.action='preview-followup';preview.disabled=this.#selected.size<1||this.#selected.size>8;box.append(preview);
          if(this.#continuationPreview){box.append(el('p','','The selected operations are complete. Follow-up effects will require their own approval.'),el('pre','ep-lab-output',JSON.stringify(this.#continuationPreview.event.payload.completions,null,2)));
            appendConvergenceDiagnostics(box,{cascade:this.#continuationPreview.cascade});
            const submit=el('button','ep-button','Submit verified follow-up');submit.type='button';submit.dataset.action='submit-followup';submit.disabled=this.#continuationPreview.cascade?.allowed===false;box.append(submit);}
        }
        box.append(el('small','ep-dim','Approve and Execute are separate GM actions. No effect runs on event receipt, publication or activation.'));
        root.append(box);
      }
      root.addEventListener('click',evt=>{const btn=evt.target.closest('button[data-action]');if(btn)void this.#action(btn,root);});
      root.addEventListener('change',evt=>{if(this.#busy||!gameInstance?.user?.isGM||evt.target.dataset.operationIndex===undefined)return;const index=Number(evt.target.dataset.operationIndex);
        if(!Number.isInteger(index)||index<0||index>31)return;if(evt.target.checked)this.#selected.add(index);else this.#selected.delete(index);
        this.#continuationPreview=null;this.#continuationSpec=null;void this.render();});
      return root;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
    async #action(button,root){
      if(this.#busy)return;this.#busy=true;this.#message='';
      try{
        if(!gameInstance?.user?.isGM)throw Error('GM required');
        const action=button.dataset.action;
        if(action==='preview-followup'){
          const operations=[...this.#selected].map(index=>({sourceEventId:this.#event.sourceEventId,operationId:this.#event.proposals[index]?.operationId}));
          this.#continuationPreview=await continuations.preview({operations});this.#continuationSpec={operations};
        }else if(action==='submit-followup'){
          if(!this.#continuationPreview||!this.#continuationSpec)throw Error('Preview the selected completions before submitting');
          const result=await continuations.emit(this.#continuationSpec,{approved:true});this.#continuationPreview=null;this.#continuationSpec=null;this.#selected.clear();
          if(result.status==='no-subscribers')this.#message='No active published follow-up graph is subscribed.';
          else{this.#previousId=this.#id;this.#id=result.eventId;this.#message=`Follow-up evaluation: ${result.status}. New effects remain subject to approval.`;}
        }else if(action==='return-source'){
          this.#id=this.#previousId;this.#previousId=null;this.#selected.clear();this.#continuationPreview=null;this.#continuationSpec=null;
        }else if(['approve-effect','reject-effect','execute-effect','reconcile-effect','adopt-effect'].includes(action)){
          this.#continuationPreview=null;this.#continuationSpec=null;
          const index=Number(button.dataset.index);
          const proposal=Number.isInteger(index)&&index>=0?this.#event?.proposals?.[index]:null;
          if(!proposal||this.#event.state!=='review-required')throw Error('Select a valid reviewable proposal');
          if(action==='adopt-effect'){
            const reason=root.querySelector(`[data-adoption-reason="${index}"]`)?.value??'';
            await reviews.adoptApproval(this.#event.sourceEventId,proposal.operationId,{approved:true,expectedRevision:Number(button.dataset.reviewRevision),reason});
            this.#message='Successor approval recorded. No effect was applied; execute it separately.';
          }else if(action==='reconcile-effect'){
            const result=await reviews.reconcile(this.#event.sourceEventId,proposal.operationId,{approved:true});
            this.#message=`Reconciliation: ${result.status}. The original effect was verified; no effect was retried.`;
          }else if(action==='execute-effect'){
            const result=await reviews.execute(this.#event.sourceEventId,proposal.operationId);
            this.#message=`Execution: ${result.status}. ${result.status==='uncertain'?'Manual reconciliation required.':''}`;
          } else {
            const result=await reviews.decide(this.#event.sourceEventId,proposal.operationId,
              {approve:action==='approve-effect'});
            this.#message=`Proposal ${result.state}; no native effect has been applied by this review.`;
          }
        } else {
          this.#selected.clear();this.#continuationPreview=null;this.#continuationSpec=null;
          this.#id=action==='select'?button.dataset.id:root.querySelector('[data-field="event-id"]')?.value?.trim();
        }
        this.#event=await ledger.get(this.#id);
        if(!this.#event)this.#message='Event not found in its bounded durable shard.';
      }catch(e){this.#event=null;this.#message=`${e.code??'EVENT_ERROR'}: ${e.message}`;}
      finally{this.#busy=false;await this.render();}
    }
  };
}
