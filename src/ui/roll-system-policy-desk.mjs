const el=(tag,text='')=>{const e=document.createElement(tag);e.textContent=String(text);return e;};
export function makeRollSystemPolicyWindow(Base,{gameInstance,service}={}){
 return class EasyPlotsRollPolicy extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-roll-policy',window:{title:'Easy Plots — Roll system policy',resizable:true},position:{width:760,height:650}};
  #chosen='';#reason='';#manifest='';#message='';#busy=false;
  async _renderHTML(){
   const root=el('section');root.className='ep-editor ep-roll-policy';if(!gameInstance.user?.isGM){root.append(el('p','GM authority required'));return root;}let view;try{view=await service.inspect();}catch(error){root.append(el('p',`Roll policy unavailable: ${error.code??error.message}`));return root;}
   root.append(el('h2','Roll system policy'),el('p',`Current system: ${view.system.id} ${view.system.version} · Foundry ${view.system.coreBuild}`),el('p','These declarations select the existing GM-authored d20 checks. Modifiers, difficulties, ties and partial bands remain authored by the GM. A declaration does not add the game system’s native rule automation.'));
   const select=el('select');select.dataset.field='policy';for(const policy of view.registered){const option=el('option',`${policy.label} · ${policy.version}`);option.value=policy.id;select.append(option);}select.value=this.#chosen||view.effectivePolicyId;root.append(select);
   const reason=el('input');reason.className='ep-input';reason.dataset.field='reason';reason.placeholder='Reason for this policy selection';reason.value=this.#reason;root.append(reason);
   const button=(action,label)=>{const b=el('button',label);b.type='button';b.dataset.action=action;root.append(b);};button('select-policy','Save reviewed policy selection');button('refresh-policy','Refresh policy state');
   const declaration=el('textarea');declaration.className='ep-input';declaration.dataset.field='manifest';declaration.rows=10;declaration.value=this.#manifest||JSON.stringify({id:'example.system-d20',version:'1.0.0',label:'Authored d20 for this system',systemId:view.system.id,systemVersions:[view.system.version],coreBuilds:[view.system.coreBuild],implementation:'foundry-authored-d20-v1'},null,2);root.append(el('h3','Register an exact system declaration'),declaration);button('register-policy','Register declaration in this coordinator');
   if(view.selection)root.append(el('pre',JSON.stringify(view.selection.data,null,2)));if(this.#message)root.append(el('p',this.#message));
   root.addEventListener('click',event=>{const b=event.target.closest?.('button[data-action]');if(!b||b.disabled||this.#busy)return;void(async()=>{this.#busy=true;try{
    if(!gameInstance.user?.isGM)throw Error('GM authority required');this.#chosen=select.value;this.#reason=reason.value;this.#manifest=declaration.value;
    if(b.dataset.action==='register-policy'){if(this.#manifest.length>12000)throw Error('Declaration input exceeds its budget');const registered=await service.register(JSON.parse(this.#manifest));this.#chosen=registered.id;this.#message='Declaration registered. Select it explicitly before new rolls use it.';}
    else if(b.dataset.action==='select-policy'){const policy=view.registered.find(p=>p.id===this.#chosen);if(!policy)throw Error('Refresh the registered policy first');await service.select({policyId:policy.id,policyVersion:policy.version,expectedRevision:view.selection?.revision??null,reason:this.#reason});this.#message='Roll policy selection saved. Existing attempts retain their original results and policy.';}
    else this.#message='Policy state refreshed.';
   }catch(error){this.#message=`Policy action rejected: ${error.code??error.message}`;}finally{this.#busy=false;await this.render();}})();});return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
