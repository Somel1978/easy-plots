/** Decrypted projections render locally with textContent, never enrichHTML or
 * persisted native document content. Every opening requests current authority.
 */
import {openPublication,validatePublicationEnvelope,requirePublicationCrypto} from '../security/publication-envelope.mjs';
import {validatePublicationView} from '../contracts/private-publication.mjs';
const el=(tag,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=String(text);return e;};
export function makeProtectedPublicationWindow(Base,{gameInstance,nativeKind,nativeId,actorId='',requestKey=null,gmView=null}={}){
 return class EasyPlotsProtectedPublication extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-protected-publication',window:{title:'Easy Plots — Protected Update',resizable:true},position:{width:690,height:530}};
  #actorId=actorId;#view=null;#message='';#busy=false;
  async _renderHTML(){
   const root=el('section','ep-editor ep-protected-publication');root.append(el('h2','','Protected narrative update'));
   const actor=el('input','ep-input');actor.dataset.field='publicationActor';actor.maxLength=160;actor.value=this.#actorId||gameInstance?.user?.character?.id||gameInstance?.actors?.contents?.find(a=>a.isOwner)?.id||'';actor.placeholder='Your owned native Actor ID';
   if(!gameInstance?.user?.isGM)root.append(el('p','ep-dim','For a private update, choose your owned character. Public mechanical results need no character.'),actor);
   const open=el('button','ep-button','Open authorized content');open.type='button';open.dataset.action='open-protected';open.disabled=this.#busy;root.append(open);
   if(this.#message)root.append(el('p','ep-publication-message',this.#message));
   if(this.#view){const section=el('section','ep-panel ep-publication-plaintext');section.append(el('h3','',this.#view.title),el('small','ep-dim',`Reported at fictional time ${this.#view.worldTime}`));
    if(this.#view.kind==='roll-publication'){
     section.append(el('p','ep-banner','Mechanical report. Narrative knowledge is disclosed separately.'),el('p','',`Mode: ${this.#view.mode}`));
     if(Object.hasOwn(this.#view,'total'))section.append(el('p','ep-roll-total',`Total: ${this.#view.total}`));if(Object.hasOwn(this.#view,'outcome'))section.append(el('p','ep-roll-outcome',`Result: ${this.#view.outcome}`));
    }else for(const claim of this.#view.claims){const item=el('article','ep-board-item');item.append(el('p','',claim.text),el('small','ep-dim',claim.stance));section.append(item);}root.append(section);
   }
   actor.addEventListener('input',()=>{if(!this.#busy){this.#actorId=actor.value;this.#view=null;root.querySelector('.ep-publication-plaintext')?.remove();}});
   open.addEventListener('click',()=>{if(this.#busy)return;this.#busy=true;this.#view=null;this.#message='';open.disabled=true;actor.disabled=true;
    void(async()=>{try{
     const reference={nativeKind,nativeId};
     if(gameInstance?.user?.isGM&&typeof gmView==='function'){this.#view=validatePublicationView(await gmView(reference));}
     else{
      requirePublicationCrypto();if(typeof requestKey!=='function')throw Error('Authenticated key transport required');this.#actorId=actor.value.trim();
      const collection=nativeKind==='ChatMessage'?gameInstance?.messages:gameInstance?.journal,doc=collection?.get?.(nativeId),envelope=validatePublicationEnvelope(doc?.getFlag?.('easy-plots','publicationEnvelope'));
      const grant=await requestKey({...reference,actorId:this.#actorId});if(grant.token!==envelope.token||grant.nativeId!==nativeId||grant.nativeKind!==nativeKind)throw Error('Grant does not match this document');
      this.#view=await openPublication(envelope,grant.key,reference);
     }
    }catch(error){this.#view=null;this.#message=error.code==='PUBLICATION_CRYPTO_UNAVAILABLE'?'Open Foundry through HTTPS or localhost to view protected updates.':'Protected content is unavailable for this character.';}
    finally{this.#busy=false;await this.render();}})();
   });return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
export function attachProtectedPublicationButton(document,html,openPublicationWindow){
 if(typeof openPublicationWindow!=='function'||!html?.append||html.querySelector?.('[data-action="open-protected-publication"]'))return false;
 try{validatePublicationEnvelope(document?.getFlag?.('easy-plots','publicationEnvelope'));}catch{return false;}
 if(!['ChatMessage','JournalEntry'].includes(document.documentName))return false;
 const button=el('button','ep-button','Open protected Easy Plots content');button.type='button';button.dataset.action='open-protected-publication';
 button.addEventListener('click',()=>{void Promise.resolve(openPublicationWindow({nativeKind:document.documentName,nativeId:document.id})).catch(()=>{});});html.append(button);return true;
}
