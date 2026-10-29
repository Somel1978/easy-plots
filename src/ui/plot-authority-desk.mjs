const el=(tag,text='')=>{const e=document.createElement(tag);e.textContent=String(text);return e;};
export function makePlotAuthorityDeskWindow(Base,{gameInstance,registry,sourceGraphId=()=>'',onChanged=null}={}){
 return class EasyPlotsPlotAuthority extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-plot-authority',window:{title:'Easy Plots — Plot permissions',resizable:true},position:{width:740,height:650}};
  #id='';#policy=null;#draftRevision=null;#message='';#busy=false;#command=null;
  async _renderHTML(){
   const root=el('section');root.className='ep-editor ep-plot-authority';if(!gameInstance.user?.isGM){root.append(el('p','GM authority required'));return root;}
   root.append(el('h2','Plot permissions'),el('p','The owner delegates editing, publication and activation separately. These decisions do not approve narrative effects.'));
   const field=(name,label,value='')=>{const l=el('label',label),input=el('input');l.className='ep-field';input.className='ep-input';input.dataset.field=name;input.value=String(value);l.append(input);root.append(l);return input;};
   const button=(action,label,disabled=false)=>{const b=el('button',label);b.type='button';b.dataset.action=action;b.disabled=disabled;root.append(b);};
   field('graph-id','Plot ID',this.#id||sourceGraphId());button('inspect','Refresh permissions');
   field('request-id','Original command ID after a lost response');button('inspect-command','Inspect my original command');if(this.#command)root.append(el('pre',JSON.stringify(this.#command,null,2)));
   const users=gameInstance.users?.contents??[...(gameInstance.users?.values?.()??[])],gms=users.filter(u=>u.isGM);
   if(this.#policy){
    const p=this.#policy;root.append(el('p',`Owner: ${gms.find(u=>u.id===p.ownerUserId)?.name??p.ownerUserId??'Unassigned legacy plot'} · revision ${p.revision??'none'}`));
    root.append(el('p',`Your rights: edit ${p.rights.edit?'yes':'no'}, publish ${p.rights.publish?'yes':'no'}, activate ${p.rights.activate?'yes':'no'}`));
    for(const user of gms.filter(u=>u.id!==p.ownerUserId)){const row=el('fieldset');row.append(el('legend',user.name??user.id));for(const action of ['edit','publish','activate']){const label=el('label',action),input=el('input');input.type='checkbox';input.dataset.delegate=user.id;input.dataset.right=action;input.checked=p.delegates.some(g=>g.userId===user.id&&g.actions.includes(action));input.disabled=!p.canManage;label.prepend(input);row.append(label);}root.append(row);}
    field('reason','Reason for this decision');button('delegate','Save delegated rights',!p.canManage);
    const label=el('label','New owner'),select=el('select');select.dataset.field='owner';for(const user of gms){const option=el('option',user.name??user.id);option.value=user.id;select.append(option);}label.append(select);root.append(label);
    button('transfer','Transfer ownership',!p.canManage);button('recover','Recover unavailable owner',!p.canRecover);
    if(!p.ownerUserId){root.append(el('p',`Legacy draft reviewed at revision ${this.#draftRevision??'unavailable'}. Ownership adoption requires the coordinator.`));button('adopt','Adopt reviewed legacy draft',gameInstance.users?.activeGM?.id!==gameInstance.user.id||!this.#draftRevision);}
    if(p.lastDecision)root.append(el('pre',JSON.stringify({lastDecision:p.lastDecision,history:p.history},null,2)));
   }
   if(this.#message)root.append(el('p',this.#message));
   root.addEventListener('click',event=>{const b=event.target.closest?.('button[data-action]');if(!b||b.disabled||this.#busy)return;void(async()=>{
    this.#busy=true;this.#message='';root.querySelectorAll('button').forEach(x=>{x.disabled=true;});
    try{
     if(!gameInstance.user?.isGM)throw Error('GM authority required');const action=b.dataset.action,id=root.querySelector('[data-field="graph-id"]').value.trim();
     if(action==='inspect-command'){this.#command=await registry.inspectCommand(root.querySelector('[data-field="request-id"]').value.trim());this.#message=this.#command?'Original command receipt loaded. Refresh the plot to review its actual revision; no command was repeated.':'No confirmed command payload was found for this GM and request ID.';}
     else if(action==='inspect'){this.#id=id;this.#policy=await registry.inspectAuthority(id);this.#draftRevision=(await registry.getDraft(id))?.revision??null;}
     else{
      if(id!==this.#id||!this.#policy)throw Error('Refresh this exact plot before changing permissions');const reason=root.querySelector('[data-field="reason"]').value,ownerUserId=root.querySelector('[data-field="owner"]').value;
      if(action==='adopt')await registry.adoptLegacyAuthority({graphId:id,expectedDraftRevision:this.#draftRevision,ownerUserId,reason});
      else{const delegates=[];for(const user of gms){const actions=[...root.querySelectorAll('input[data-delegate]')].filter(x=>x.dataset.delegate===user.id&&x.checked).map(x=>x.dataset.right);if(actions.length)delegates.push({userId:user.id,actions});}await registry.updateAuthority({graphId:id,expectedRevision:this.#policy.revision,delegates,...(action!=='delegate'?{ownerUserId}:{}),...(action==='recover'?{recover:true}:{}),reason});}
      this.#policy=await registry.inspectAuthority(id);await onChanged?.(id);this.#message='Plot permissions saved. Publication and activation remain separate.';
     }
    }catch(error){this.#message=`Permission action rejected: ${error.code??error.message}. Refresh before another decision.`;}
    finally{this.#busy=false;await this.render();}
   })();});return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
