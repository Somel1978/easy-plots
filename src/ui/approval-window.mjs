/** GM-only, one-key-at-a-time durable intent inspector. No automatic effects. */
const el=(tag,cls='',text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
export function makeApprovalWindow(BaseApplicationV2,{queue,gameInstance}={}){
  if(!queue)throw new Error('Durable queue is required');
  return class EasyPlotsApprovals extends BaseApplicationV2 {
    static DEFAULT_OPTIONS={id:'easy-plots-gm-approvals',window:{title:'Easy Plots — GM Request Review',resizable:true},position:{width:600,height:470}};
    #key='';#entry=null;#message='';#busy=false;
    async _renderHTML(){
      const root=el('section','ep-editor ep-approvals');
      if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM authority required'));return root;}
      root.append(el('h3','', 'Durable Request Review'));
      root.append(el('p','ep-banner','Enter an exact user:requestId key. No global private queue is loaded, and approval never executes a narrative effect.'));
      const label=el('label','ep-field');label.append(el('span','ep-label','Request key'));
      const input=el('input','ep-input');input.value=this.#key;input.dataset.field='intent-key';label.append(input);root.append(label);
      const find=el('button','ep-button','Find request');find.dataset.action='find';root.append(find);
      if(this.#message)root.append(el('p','ep-notice',this.#message));
      if(this.#entry){
        const box=el('div','ep-panel');
        box.append(el('strong','',`Request: ${this.#entry.state}`),el('p','',`Verified requester: ${this.#entry.verifiedUserId}`));
        box.append(el('p','',`Actor: ${this.#entry.intent?.actorId}`));
        box.append(el('p','',`Opportunity: ${this.#entry.intent?.opportunityId}`));
        box.append(el('p','',`Approach: ${this.#entry.intent?.approach??'(none)'}`));
        if(this.#entry.state==='pending'){
          const actions=el('div','ep-actions');
          for(const [action,title] of [['approve','Approve Request'],['reject','Reject Request']]){
            const b=el('button','ep-button',title);b.dataset.action=action;actions.append(b);
          }
          box.append(actions);
        }
        root.append(box);
      }
      root.addEventListener('click',evt=>{const b=evt.target.closest('button[data-action]');if(b)void this.#action(b.dataset.action,root);});
      return root;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
    async #action(action,root){
      if(this.#busy)return;this.#busy=true;this.#message='';
      try{
        if(!gameInstance?.user?.isGM)throw Error('GM required');
        if(action==='find'){
          this.#key=root.querySelector('[data-field="intent-key"]')?.value?.trim()??'';
          this.#entry=await queue.get(this.#key);
          if(!this.#entry)this.#message='No durable request found.';
        }else if(action==='approve'||action==='reject'){
          if(!this.#entry||this.#entry.state!=='pending')throw Error('Only pending requests can be reviewed');
          this.#entry=await queue.transition(this.#key,'pending',action==='approve'?'approved':'rejected',
            {gmUserId:gameInstance.user.id,approval:action==='approve'});
          this.#message=action==='approve'?'Approved for later execution; no effects were executed.':'Request rejected.';
        }
      }catch(error){this.#message=`${error.code??'REVIEW_ERROR'}: ${error.message}`;}
      finally{this.#busy=false;await this.render();}
    }
  };
}
