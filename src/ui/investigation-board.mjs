/** Client UI receives a pre-built allowlisted board, never protected documents. */
import {validatePlayerBoardProjection} from '../domains/investigation-board.mjs';
import {secureUUID} from '../contracts/digest.mjs';
const elem=(tag,cls='',text='')=>{const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=String(text);return e;};
export function makeInvestigationBoardWindow(Base,{projectionProvider,submitIntent=null,actorIdProvider=null,submitBoardEdit=null}={}){
  if(typeof projectionProvider!=='function')throw Error('A recipient-safe projection provider is required');
  return class EasyPlotsInvestigationBoard extends Base {
    static DEFAULT_OPTIONS={id:'easy-plots-investigation-board',window:{title:'Easy Plots — Investigation',resizable:true},position:{width:800,height:650}};
    #message='';#busy=false;#edit={title:'',reasoning:'',arguments:[]};#requestId=null;
    async _renderHTML(){
      const board=await projectionProvider();validatePlayerBoardProjection(board);
      const root=elem('section','ep-investigation-board ep-editor');
      root.append(elem('h2','',board.title),elem('small','ep-dim','Only evidence and theories shared with this character appear here.'));
      if(this.#message)root.append(elem('p','ep-notice',this.#message));
      const evidence=elem('section','ep-panel');evidence.append(elem('h3','','Discovered evidence'));
      for(const e of board.evidence){const card=elem('article','ep-board-item');card.append(elem('strong','',e.title),elem('p','',e.description));evidence.append(card);}
      if(!board.evidence.length)evidence.append(elem('p','ep-dim','No disclosed evidence is available.'));
      root.append(evidence);
      const theories=elem('section','ep-panel');theories.append(elem('h3','','Theories and arguments'));
      for(const t of board.theories){const card=elem('article','ep-board-item');card.append(elem('strong','',t.title),elem('p','',t.reasoning));
        card.append(elem('small','ep-dim',`${t.supportEvidenceIds.length} supporting · ${t.contradictionEvidenceIds.length} challenging disclosed arguments`));theories.append(card);}
      if(!board.theories.length)theories.append(elem('p','ep-dim','No shared theories are available.'));
      root.append(theories);
      if(board.version===2&&typeof submitBoardEdit==='function'){
        const form=elem('section','ep-panel ep-board-edit');form.append(elem('h3','','Propose a theory or revise your own'),elem('p','ep-dim','Your proposal stays private until GM review and approval. Cite only the clues shown on this board.'));
        const choice=elem('select','ep-input');choice.dataset.field='editTheory';const fresh=elem('option','','New theory');fresh.value='';choice.append(fresh);
        for(const theory of board.theories.filter(t=>t.canEdit===true)){const o=elem('option','',theory.title);o.value=theory.id;choice.append(o);}choice.value=this.#edit.replacesPublicTheoryId??'';form.append(choice);
        const title=elem('input','ep-input');title.dataset.field='editTitle';title.maxLength=140;title.placeholder='Your theory';title.value=this.#edit.title;form.append(title);
        const reasoning=elem('textarea','ep-input');reasoning.dataset.field='editReasoning';reasoning.maxLength=900;reasoning.placeholder='Explain your reasoning';reasoning.value=this.#edit.reasoning;form.append(reasoning);
        for(const clue of board.evidence){const label=elem('label','ep-field');label.append(elem('span','ep-label',clue.title));const select=elem('select','ep-input');select.dataset.editEvidence=clue.id;
          for(const [value,text] of [['','Do not cite'],['support','Supports the theory'],['contradict','Challenges the theory']]){const o=elem('option','',text);o.value=value;select.append(o);}select.value=this.#edit.arguments.find(a=>a.evidenceId===clue.id)?.direction??'';label.append(select);form.append(label);}
        const send=elem('button','ep-button','Send proposal for GM review');send.type='button';send.dataset.action='submit-board-edit';form.append(send);root.append(form);
        const capture=()=>({title:title.value,reasoning:reasoning.value,arguments:[...form.querySelectorAll('[data-edit-evidence]')].filter(s=>s.value).map(s=>({evidenceId:s.dataset.editEvidence,direction:s.value})),...(choice.value?{replacesPublicTheoryId:choice.value}:{})});
        form.addEventListener('input',()=>{if(!this.#busy){this.#edit=capture();this.#requestId=null;}});
        choice.addEventListener('change',()=>{if(this.#busy)return;const selected=board.theories.find(t=>t.id===choice.value&&t.canEdit===true);
          this.#edit=selected?{title:selected.title,reasoning:selected.reasoning,arguments:[...selected.supportEvidenceIds.map(evidenceId=>({evidenceId,direction:'support'})),...selected.contradictionEvidenceIds.map(evidenceId=>({evidenceId,direction:'contradict'}))],replacesPublicTheoryId:selected.id}:{title:'',reasoning:'',arguments:[]};this.#requestId=null;void this.render();});
        send.addEventListener('click',()=>{if(this.#busy)return;this.#busy=true;this.#edit=capture();this.#requestId??=secureUUID();form.querySelectorAll('input,textarea,select,button').forEach(e=>{e.disabled=true;});
          void(async()=>{try{if(!this.#edit.title.trim()||this.#edit.arguments.length>24)throw Error('A theory and at most 24 disclosed clues are required');
            await submitBoardEdit({...this.#edit,editToken:board.editToken},{requestId:this.#requestId});this.#message='Proposal received for GM review. No board changes have been applied.';this.#edit={title:'',reasoning:'',arguments:[]};this.#requestId=null;
          }catch{this.#message='Unable to submit this proposal. Refresh the board or ask your GM to review it.';}finally{this.#busy=false;await this.render();}})();
        });
      }
      const actions=elem('section','ep-panel');actions.append(elem('h3','','Available actions'));
      if(typeof submitIntent==='function'&&typeof actorIdProvider==='function'){
        const field=elem('textarea','ep-input');field.dataset.field='approach';field.maxLength=1024;field.placeholder='Describe what your character attempts';actions.append(field);
        for(const a of board.actions){const btn=elem('button','ep-button',a.label);btn.type='button';btn.dataset.opportunityId=a.opportunityId;actions.append(btn);}
      }else actions.append(elem('p','ep-dim','Available actions are informational in this view.'));
      root.append(actions);
      root.addEventListener('click',event=>{
        const btn=event.target.closest?.('button[data-opportunity-id]');if(!btn||this.#busy)return;
        const available=board.actions.find(a=>a.opportunityId===btn.dataset.opportunityId);
        if(!available)return;
        this.#busy=true;
        void (async()=>{try{
          const actorId=await actorIdProvider();const approach=root.querySelector('[data-field="approach"]')?.value??'';
          const receipt=await submitIntent({actorId,opportunityId:available.opportunityId,approach});
          this.#message=receipt?.state==='pending'?'Request received for GM review.':'Request submitted; see your GM for the outcome.';
        }catch(e){this.#message='Unable to submit the request.';}finally{this.#busy=false;await this.render();}})();
      });
      return root;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
  };
}
