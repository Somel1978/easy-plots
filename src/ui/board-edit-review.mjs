import {secureUUID} from '../contracts/digest.mjs';
const el=(tag,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=String(text);return e;};
export function makeGMBoardEditReviewWindow(Base,{gameInstance,service,prepareHandler=null,openDraft=null,openEvent=null}={}){
 return class EasyPlotsBoardEditReview extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-board-edits',window:{title:'Easy Plots — Player Board Proposals',resizable:true},position:{width:780,height:680}};
  #cursor='0:0';#next=null;#items=[];#id='';#row=null;#reason='';#message='';#busy=false;#eventId=null;#handlerId=null;
  async _renderHTML(){
   const root=el('section','ep-editor ep-board-edit-review');if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM authority required'));return root;}
   root.append(el('h2','','Player board proposals'),el('p','ep-banner','Player edits remain private requests. Review the author and disclosed evidence, then propose an effect through an active review graph. Every effect requires its own approval and execution.'));
   const button=(action,text,disabled=false)=>{const b=el('button','ep-button',text);b.dataset.action=action;b.type='button';b.disabled=disabled;root.append(b);};
   button('list','Load first request page');button('next','Next request page',!this.#next);
   if(prepareHandler)button('prepare-handler','Prepare review graph draft');if(this.#handlerId&&openDraft)button('open-handler','Open review graph draft');
   for(const row of this.#items){const b=el('button','ep-button',`${row.data.state} · ${row.data.edit.title}`);b.type='button';b.dataset.action='select';b.dataset.id=row.id;root.append(b);}
   const id=el('input','ep-input');id.dataset.field='requestId';id.placeholder='Exact private request ID';id.value=this.#id;root.append(id);button('inspect','Inspect request');
   if(this.#row){root.append(el('pre','ep-board-request',JSON.stringify({id:this.#row.id,revision:this.#row.revision,state:this.#row.data.state,authorUserId:this.#row.data.verifiedUserId,actorId:this.#row.data.actorId,investigationId:this.#row.data.investigationId,edit:this.#row.data.edit},null,2)));
    button('propose','Propose reviewed edit',this.#row.data.state!=='pending');const reason=el('input','ep-input');reason.dataset.field='reason';reason.placeholder='GM reason for dismissal';reason.maxLength=300;reason.value=this.#reason;root.append(reason);button('dismiss','Dismiss request',this.#row.data.state!=='pending');
   }
   if(this.#eventId&&openEvent)button('open-event','Open effect review');if(this.#message)root.append(el('p','ep-board-edit-message',this.#message));
   root.addEventListener('click',event=>{const b=event.target.closest?.('button[data-action]');if(!b||b.disabled||this.#busy)return;
    void(async()=>{this.#busy=true;try{
     if(!gameInstance?.user?.isGM)throw Error('GM authority required');const action=b.dataset.action;
     if(action==='list'||action==='next'){
      this.#cursor=action==='list'?'0:0':this.#next;const page=await service.list({cursor:this.#cursor});this.#items=page.items;this.#next=page.nextCursor;
     }else if(action==='inspect'||action==='select'){
      this.#id=action==='select'?b.dataset.id:id.value.trim();this.#row=await service.read({id:this.#id});this.#eventId=null;this.#message=this.#row?'':'Request not found';
     }else if(action==='propose'){
      const result=await service.queueForGMReview({id:this.#row.id,expectedRevision:this.#row.revision});this.#eventId=result.eventId;
      this.#message=result.status==='no-subscribers'?'Publish and activate a review graph before proposing this edit.':`Review event ${result.eventId}: ${result.status}. The board is unchanged until the effect is approved and executed.`;
     }else if(action==='dismiss'){
      this.#reason=root.querySelector('[data-field="reason"]').value;this.#row=await service.dismiss({id:this.#row.id,expectedRevision:this.#row.revision,reason:this.#reason,reviewEventId:`ep:event:board_edit_review_${secureUUID().replaceAll('-','_')}`});this.#message='Request dismissed. Its history is retained.';
     }else if(action==='prepare-handler'){
      const result=await prepareHandler();this.#handlerId=result.graphId;this.#message=`Prepared review graph draft ${result.graphId}. Review, publish and activate it from the editor before processing requests.`;
     }else if(action==='open-handler'){await openDraft(this.#handlerId);}
     else if(action==='open-event'){await openEvent(this.#eventId);}
    }catch(error){this.#message=`Board review rejected: ${error.code??error.message}`;}
    finally{this.#busy=false;await this.render();}})();
   });return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
