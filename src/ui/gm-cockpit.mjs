/** A bounded, graph-focused GM inspector with no background campaign enumeration. */
const el=(tag,cls='',text='')=>{const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=String(text);return e;};
export function makeGMCockpitWindow(Base,{getSnapshot,getExplanation=null,gameInstance,openEditor=()=>{},openEventReview=()=>{},watchGraph=null}={}){
  if(typeof getSnapshot!=='function')throw Error('Focused GM cockpit snapshot provider required');
  return class EasyPlotsGMCockpit extends Base {
    static DEFAULT_OPTIONS={id:'easy-plots-gm-cockpit',window:{title:'Easy Plots — GM Cockpit',resizable:true},position:{width:740,height:620}};
    #graphId='';#events='';#snapshot=null;#explanation=null;#message='';#busy=false;
    #unsubscribe=null;#closed=false;#generation=0;#refreshChain=Promise.resolve();
    #watch(){
      this.#unsubscribe?.();this.#unsubscribe=null;
      if(typeof watchGraph!=='function')return;
      const graphId=this.#graphId;
      this.#unsubscribe=watchGraph(graphId,change=>{
        this.#refreshChain=this.#refreshChain.then(async()=>{
          if(this.#closed||!gameInstance?.user?.isGM||graphId!==this.#graphId)return;
          const token=++this.#generation,ids=[...new Set([...this.#events.split(',').map(s=>s.trim()).filter(Boolean),change.eventId])].slice(-12);
          const snapshot=await getSnapshot(graphId,ids);
          if(token!==this.#generation||this.#closed||graphId!==this.#graphId||!gameInstance?.user?.isGM)return;
          this.#events=ids.join(',');this.#snapshot=snapshot;this.#explanation=null;await this.render();
        }).catch(async error=>{if(!this.#closed&&gameInstance?.user?.isGM&&graphId===this.#graphId){this.#message=`${error.code??'VIEW_REFRESH_FAILED'}: Focus refresh needs review`;await this.render();}});
        return this.#refreshChain;
      });
    }
    async close(options){this.#closed=true;this.#generation++;this.#unsubscribe?.();this.#unsubscribe=null;return typeof super.close==='function'?super.close(options):this;}
    async _renderHTML(){
      const root=el('section','ep-editor ep-gm-cockpit');
      if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM authority required'));return root;}
      root.append(el('h2','','Focused Narrative Cockpit'),el('small','ep-dim','Load a known graph ID and at most 12 explicitly relevant events. No campaign-wide scan.'));
      for(const [label,key,value] of [['Graph ID','graph-id',this.#graphId],['Relevant event IDs (comma-separated)','event-ids',this.#events]]){
        const field=el('label','ep-field');field.append(el('span','ep-label',label));const input=el('input','ep-input');input.dataset.field=key;input.value=value;field.append(input);root.append(field);
      }
      for(const [action,name] of [['load','Inspect focus'],['editor','Graph editor'],['review','Event review']]){
        const b=el('button','ep-button',name);b.dataset.action=action;b.type='button';root.append(b);
      }
      if(this.#message)root.append(el('p','ep-notice',this.#message));
      if(this.#snapshot){const s=this.#snapshot;const panel=el('section','ep-panel');
        panel.append(el('h3','',s.title));
        for(const text of [`Draft revision: ${s.draftRevision??'—'}`,
          `Active publication: ${s.active?`v${s.publishedVersion}`:'None'}`,
          `Graph nodes in focus: ${s.nodeCount}`,
          `Loaded relevant events: ${s.events.length}`,
          `Events awaiting GM review: ${s.requiresReview}`])panel.append(el('p','',text));
        for(const event of s.events){const item=el('article','ep-board-item');
          item.append(el('strong','',event.eventType),el('p','',`${event.id} · ${event.state} · ${event.proposalCount} proposals`));
          if(typeof getExplanation==='function'){const b=el('button','ep-button','Explain evaluation');b.type='button';b.dataset.action='explain';b.dataset.eventId=event.id;item.append(b);}
          panel.append(item);}
        root.append(panel);
      }
      if(this.#explanation){const x=this.#explanation;const panel=el('section','ep-panel');
        panel.append(el('h3','','Historical causal explanation'),el('p','',x.conclusion??x.status));
        for(const entry of x.trace??[])panel.append(el('p','',`${entry.graphId} · ${entry.nodeId} · ${entry.status}${entry.selectedPorts?.length?' · '+entry.selectedPorts.join(', '):''}`));
        root.append(panel);
      }
      root.addEventListener('click',ev=>{const b=ev.target.closest?.('button[data-action]');if(!b||this.#busy)return;
        void (async()=>{this.#busy=true;this.#message='';try{
          if(!gameInstance?.user?.isGM)throw Error('GM authority required');
          if(b.dataset.action==='explain'){this.#explanation=await getExplanation(this.#graphId,b.dataset.eventId);}
          else if(b.dataset.action==='editor')openEditor();
          else if(b.dataset.action==='review')openEventReview();
          else if(b.dataset.action==='load'){
            this.#graphId=root.querySelector('[data-field="graph-id"]')?.value?.trim()??'';
            this.#events=root.querySelector('[data-field="event-ids"]')?.value?.trim()??'';
            const ids=this.#events.split(',').map(v=>v.trim()).filter(Boolean);
            if(ids.length>12)throw Error('No more than 12 event IDs are permitted');
            this.#closed=false;this.#watch();const token=++this.#generation,graphId=this.#graphId;
            const snapshot=await getSnapshot(graphId,ids);
            if(token===this.#generation&&!this.#closed&&graphId===this.#graphId){this.#snapshot=snapshot;this.#explanation=null;}
          }
        }catch(e){this.#snapshot=null;this.#explanation=null;this.#message=`${e.code??'COCKPIT_ERROR'}: ${e.message}`;}
        finally{this.#busy=false;await this.render();}})();
      });
      return root;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
  };
}
