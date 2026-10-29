/**
 * Focused GM-only native resource and reverse-reference inspector.
 * Read-only by design: changes to native Actor/Item/Journal data require a
 * published narrative operation and its journaled approval gateway.
 */
const el=(tag,className='',text='')=>{
  const node=document.createElement(tag);if(className)node.className=className;
  node.textContent=String(text);return node;
};
export function makeNativeResourceInspectorWindow(Base,{gameInstance,readBinding,auditReferences}={}){
  if(typeof readBinding!=='function'||typeof auditReferences!=='function')
    throw Error('Protected native resource reader and bounded reference auditor are required');
  return class EasyPlotsNativeResourceInspector extends Base{
    static DEFAULT_OPTIONS={id:'easy-plots-native-resource-inspector',
      window:{title:'Easy Plots — Native Resource Inspector',resizable:true},
      position:{width:740,height:600}};
    #scope='world';#resourceId='';#nativeUuid='';#binding=null;#audit=null;#busy=false;#message='';
    async _renderHTML(){
      const root=el('section','ep-editor ep-resource-inspector');
      if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM authority required'));return root;}
      root.append(el('h2','','Protected Narrative Resources'));
      root.append(el('p','ep-banner','Inspect one known resource and its bounded reverse-reference shard. No native documents are modified.'));
      for(const [label,key,value] of [['Scope','scope',this.#scope],
        ['Narrative resource ID','resource-id',this.#resourceId],['World Actor/Item/Journal UUID','native-uuid',this.#nativeUuid]]){
        const field=el('label','ep-field');field.append(el('span','ep-label',label));
        const input=el('input','ep-input');input.dataset.field=key;input.value=value;field.append(input);root.append(field);
      }
      for(const [action,title] of [['read','Inspect binding'],['audit','Audit native references']]){
        const button=el('button','ep-button',title);button.type='button';button.dataset.action=action;root.append(button);
      }
      if(this.#message)root.append(el('p','ep-warning',this.#message));
      if(this.#binding){
        const panel=el('section','ep-panel');panel.append(el('h3','','Protected binding'));
        for(const [label,value] of Object.entries({
          'Resource':this.#binding.resourceId,'Status':this.#binding.status,
          'Native document':this.#binding.nativeId===null?'Detached':`${this.#binding.documentKind}.${this.#binding.nativeId}`,
          'Ownership':this.#binding.ownership,'Revision':this.#binding.revision,
          'Last operation':this.#binding.lastOperationId
        }))panel.append(el('p','',`${label}: ${value??'—'}`));
        root.append(panel);
      }
      if(this.#audit){
        const panel=el('section','ep-panel');panel.append(el('h3','','Reverse-reference audit'));
        panel.append(el('small','ep-dim',`${this.#audit.items.length} entries in this bounded page; ${this.#audit.unresolved?.length??0} unresolved index references.`));
        for(const row of this.#audit.items){const item=el('article','ep-board-item');
          item.append(el('strong','',row.assessment),
            el('p','',`${row.dependentId} → ${row.resourceId} (${row.status})`));
          panel.append(item);
        }
        if(this.#audit.nextCursor)panel.append(el('p','ep-notice',`Additional records exist. Cursor: ${this.#audit.nextCursor}`));
        root.append(panel);
      }
      root.addEventListener('click',event=>{
        const button=event.target.closest?.('button[data-action]');if(!button||this.#busy)return;
        void (async()=>{this.#busy=true;this.#message='';try{
          if(!gameInstance?.user?.isGM)throw Error('GM authority required');
          this.#scope=root.querySelector('[data-field="scope"]')?.value?.trim()??'';
          this.#resourceId=root.querySelector('[data-field="resource-id"]')?.value?.trim()??'';
          this.#nativeUuid=root.querySelector('[data-field="native-uuid"]')?.value?.trim()??'';
          if(button.dataset.action==='read'){
            this.#binding=await readBinding({scope:this.#scope,resourceId:this.#resourceId});
            this.#message=this.#binding?'Binding record loaded':'No bound resource found';
          }else{
            this.#audit=await auditReferences({scope:this.#scope,nativeUuid:this.#nativeUuid,limit:16});
            this.#message='Read-only audit completed; no resources were changed.';
          }
        }catch(error){this.#message=`${error.code??'RESOURCE_LOOKUP_FAILED'}: ${error.message}`;}
        finally{this.#busy=false;await this.render();}})();
      });
      return root;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
  };
}
