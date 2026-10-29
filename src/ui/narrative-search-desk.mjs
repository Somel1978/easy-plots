/** Scoped GM narrative search. Never performs an all-world scan or exposes index
 * pages to player clients. Results are reverified against canonical source rows.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
const el=(tag,cls='',text='')=>{const n=document.createElement(tag);if(cls)n.className=cls;n.textContent=String(text);return n;};
export function makeGMNarrativeSearchWindow(Base,{service,gameInstance}={}){
 if(typeof service?.search!=='function'||typeof service?.index!=='function')throw new EasyPlotsError('SEARCH_DEPENDENCY','Protected search index required');
 return class EasyPlotsNarrativeSearchDesk extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-search-desk',window:{title:'Easy Plots — Narrative Search',resizable:true},position:{width:680,height:610}};
  #term='harbor';#scope='world';#type='location';#entityId='';#result=null;#message='';#busy=false;
  async _renderHTML(){
   const root=el('section','ep-editor ep-search-desk');
   if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM required'));return root;}
   root.append(el('h2','','Scoped Narrative Search'),el('p','ep-banner','Exact keyword lookup in protected GM indices. No full-campaign enumeration. Results are verified against current records.'));
   for(const [name,label,value] of [['scope','Search scope',this.#scope],['term','Exact keyword',this.#term]]){
    const field=el('label','ep-field');field.append(el('span','ep-label',label));const input=el('input','ep-input');input.dataset.field=name;input.value=value;field.append(input);root.append(field);
   }
   if(typeof service.indexVerifiedDomain==='function'){
    root.append(el('h3','','Repair an exact canonical index entry'));
    for(const [name,label,value] of [['type','Authorized domain type',this.#type],['entity','Exact narrative record ID',this.#entityId]]){
     const field=el('label','ep-field');field.append(el('span','ep-label',label));
     const input=el('input','ep-input');input.dataset.field=name;input.value=value;field.append(input);root.append(field);
    }
    const repair=el('button','ep-button','Verify and reindex exact record');repair.type='button';repair.dataset.action='repair';root.append(repair);
   }
   const button=el('button','ep-button','Search verified references');button.type='button';button.dataset.action='search';root.append(button);
   if(this.#message)root.append(el('p','ep-notice',this.#message));
   if(this.#result){
    const pane=el('section','ep-panel');pane.append(el('h3','','Matching narrative references'));
    for(const hit of this.#result.results){const row=el('article','ep-board-item');row.append(el('strong','',hit.title),el('p','',`${hit.domain} · ${hit.id}`));pane.append(row);}
    if(!this.#result.results.length)pane.append(el('p','','No verified matches in the selected scope.'));
    if(this.#result.incomplete)pane.append(el('p','ep-warning','Some index entries are stale or incomplete; GM reconciliation may be required.'));
    if(this.#result.hasMore)pane.append(el('p','ep-warning','Result limit reached; refine the keyword or scope.'));
    root.append(pane);
   }
   root.addEventListener('click',ev=>{const action=ev.target?.closest?.('button[data-action]')?.dataset?.action;if(!['search','repair'].includes(action)||this.#busy)return;
    void(async()=>{this.#busy=true;try{
      if(!gameInstance?.user?.isGM)throw new EasyPlotsError('GM_REQUIRED','GM required');
      this.#scope=root.querySelector('[data-field="scope"]').value.trim();this.#term=root.querySelector('[data-field="term"]').value.trim();
      if(action==='repair'){
       this.#type=root.querySelector('[data-field="type"]')?.value.trim();
       this.#entityId=root.querySelector('[data-field="entity"]')?.value.trim();
       if(typeof service.indexVerifiedDomain!=='function')throw new EasyPlotsError('SEARCH_DEPENDENCY','Canonical repair unavailable');
       const row=await service.indexVerifiedDomain({type:this.#type,scope:this.#scope,entityId:this.#entityId});
       this.#message=`Canonical search entry verified at index revision ${row.revision}. No narrative world state changed.`;
      }else{
       this.#result=await service.search({scope:this.#scope,term:this.#term,limit:12});
       this.#message='Protected scoped index consulted; no narrative effects performed.';
      }
    }catch(error){this.#result=null;this.#message=`${error.code??'SEARCH_ERROR'}: ${error.message}`;}
    finally{this.#busy=false;await this.render();}})();
   });
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
