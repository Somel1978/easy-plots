/** One audience-safe ApplicationV2 entry point for a Foundry player.
 * The browser never queries narrative Compendiums. Every request is sent to
 * the designated GM and independently authorized against the exact Actor.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {validateContinuityProjection} from '../platform/foundry-continuity-transport.mjs';
import {validatePlayerBoardProjection} from '../domains/investigation-board.mjs';
const elem=(tag,cls='',text='')=>{const node=document.createElement(tag);if(cls)node.className=cls;node.textContent=String(text);return node;};
const modes=[['session-recap','Session recap'],['quest-board','Quest objectives'],['vote-result','Approved vote'],['investigation-board','Investigation clues']];
export function makePlayerNarrativePortalWindow(Base,{gameInstance,requestProjection,openInvestigationBoard=null}={}){
 if(typeof requestProjection!=='function')throw new EasyPlotsError('PLAYER_PORTAL_DEPENDENCY','Authenticated targeted projection transport required');
 return class EasyPlotsPlayerNarrativePortal extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-player-portal',window:{title:'Easy Plots — Your Story',resizable:true},position:{width:750,height:650}};
  #kind='quest-board';#id='';#actorId='';#result=null;#error='';#busy=false;
  async _renderHTML(){
   const root=elem('section','ep-editor ep-player-portal');
   if(gameInstance?.user?.isGM){root.append(elem('p','ep-error','Player-only audience view'));return root;}
   root.append(elem('h2','','Your Story'),elem('p','ep-dim','This page requests only story details your character is authorized to see. It cannot inspect GM records.'));
   const kindField=elem('label','ep-field');kindField.append(elem('span','ep-label','View'));
   const select=elem('select','ep-input');select.dataset.field='kind';
   for(const [id,name] of modes){const option=elem('option','',name);option.value=id;option.selected=id===this.#kind;select.append(option);}kindField.append(select);root.append(kindField);
   const actors=Array.isArray(gameInstance?.actors?.contents)?gameInstance.actors.contents.filter(a=>a?.isOwner&&typeof a.id==='string'):[];
   const actorField=elem('label','ep-field');actorField.append(elem('span','ep-label','Your native Actor ID'));
   const actorInput=elem('input','ep-input');actorInput.dataset.field='actor';actorInput.maxLength=160;actorInput.value=this.#actorId||actors[0]?.id||'';
   actorInput.placeholder='Owned Actor ID or authorized unlinked token Actor ID';actorField.append(actorInput);root.append(actorField);
   if(actors.length){const suggested=elem('small','ep-dim',`Owned world Actors: ${actors.slice(0,12).map(a=>a.name??a.id).join(' · ')}`);root.append(suggested);}
   const recordField=elem('label','ep-field');recordField.append(elem('span','ep-label','Exact story publication ID'));
   const record=elem('input','ep-input');record.dataset.field='record';record.maxLength=180;record.value=this.#id;
   record.placeholder=this.#kind==='quest-board'?'ep:quest-publication:...':this.#kind==='session-recap'?'ep:session:...':this.#kind==='vote-result'?'ep:vote:...':'ep:investigation:...';recordField.append(record);root.append(recordField);
   const load=elem('button','ep-button','Load approved story view');load.type='button';load.dataset.action='load';load.disabled=this.#busy;root.append(load);
   if(this.#error)root.append(elem('p','ep-notice',this.#error));
   if(this.#result){const card=elem('section','ep-panel');
    if(this.#kind==='session-recap'){
     card.append(elem('h3','','Shared session recap'));
     for(const entry of this.#result.recap)card.append(elem('p','ep-board-item',entry.text));
    }else if(this.#kind==='quest-board'){
     card.append(elem('h3','',this.#result.title));
     for(const entry of this.#result.objectives){const item=elem('article','ep-board-item');item.append(elem('strong','',entry.status),elem('p','',entry.text));card.append(item);}
    }else if(this.#kind==='vote-result'){
     card.append(elem('h3','','Approved decision'),elem('p','',this.#result.choiceId));
    }else{
     card.append(elem('h3','',this.#result.title));
     for(const entry of this.#result.evidence){const item=elem('article','ep-board-item');item.append(elem('strong','',entry.title),elem('p','',entry.description));card.append(item);}
     for(const theory of this.#result.theories){const item=elem('article','ep-board-item');item.append(elem('strong','',theory.title),elem('p','',theory.reasoning));card.append(item);}
     if(openInvestigationBoard){const edit=elem('button','ep-button','Open investigation board');edit.type='button';edit.dataset.action='open-investigation';edit.addEventListener('click',()=>{void openInvestigationBoard(this.#id,this.#actorId);});card.append(edit);}
    }root.append(card);
   }
   root.addEventListener('change',ev=>{if(ev.target?.dataset.field==='kind'){
    this.#kind=select.value;this.#result=null;this.#error='';void this.render();
   }});
   root.addEventListener('click',ev=>{if(ev.target?.closest('button[data-action="load"]')!==load||this.#busy)return;
    void(async()=>{this.#busy=true;try{
     this.#kind=select.value;this.#actorId=actorInput.value.trim();this.#id=record.value.trim();
     assertNarrativeId(this.#id);
     if(!/^[A-Za-z0-9_.:-]{8,160}$/.test(this.#actorId))throw new EasyPlotsError('PLAYER_PORTAL_ACTOR','Native Actor ID required');
     const result=await requestProjection({kind:this.#kind,id:this.#id,actorId:this.#actorId});
     if(this.#kind==='investigation-board')validatePlayerBoardProjection(result);
     else validateContinuityProjection(this.#kind,result);
     this.#result=result;this.#error='';
    }catch{this.#result=null;this.#error='No approved view is available for this character and publication.';}
    finally{this.#busy=false;await this.render();}})();
   });
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
