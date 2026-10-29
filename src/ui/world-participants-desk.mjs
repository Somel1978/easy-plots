/** GM-only explicit world Actor/narrative identity binding editor. */
const el=(tag,text='')=>{const node=document.createElement(tag);node.textContent=String(text);return node;};
export function makeWorldParticipantsDesk(Base,{service,gameInstance}={}){
 if(typeof service?.save!=='function'||typeof service?.inspect!=='function'||typeof service?.recover!=='function')throw Error('Protected world participant service required');
 return class EasyPlotsWorldParticipants extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-world-participants',window:{title:'Easy Plots — World participants',resizable:true},position:{width:720,height:610}};
  #native='';#narrative='';#observer='';#status='active';#revision=null;#inspection=null;#message='';#busy=false;
  async _renderHTML(){
   const root=el('section');root.className='ep-editor ep-world-participants';if(!gameInstance?.user?.isGM){root.append(el('p','GM authority required'));return root;}
   root.append(el('h2','World participants'),el('p','Bind a selected world Actor to the narrative Actor and observer IDs you explicitly choose. Actor names and player characters do not infer an identity. This saves protected metadata; it creates no Actor, narrative fact or knowledge receipt.'));
   const field=(label,node)=>{const wrapper=el('label',label);wrapper.className='ep-field';node.className='ep-input';wrapper.append(node);root.append(wrapper);return node;};
   const actors=el('select');actors.dataset.field='native-actor';const empty=el('option','Select a world Actor');empty.value='';actors.append(empty);
   for(const actor of gameInstance.actors?.contents??[])if(actor&&!actor.isToken&&!actor.parent&&typeof actor.id==='string'){const option=el('option',actor.name??actor.id);option.value=actor.id;actors.append(option);}actors.value=this.#native;field('Native world Actor',actors);
   const narrative=el('input');narrative.dataset.field='narrative-actor';narrative.value=this.#narrative;narrative.placeholder='ep:actor:your_stable_identity';narrative.maxLength=160;field('Narrative Actor ID',narrative);
   const observer=el('input');observer.dataset.field='observer';observer.value=this.#observer;observer.placeholder='Explicit stable observer ID';observer.maxLength=160;field('Observer ID',observer);
   const status=el('select');status.dataset.field='status';for(const value of ['active','retired']){const option=el('option',value);option.value=value;status.append(option);}status.value=this.#status;field('Binding status',status);
   root.append(el('p',`Scope: world · Loaded metadata revision: ${this.#revision??'new binding'}. Established IDs are immutable. Retirement preserves their reservation and disables resolution.`));
   const button=(action,label,disabled=false)=>{const node=el('button',label);node.type='button';node.dataset.action=action;node.disabled=disabled||this.#busy;root.append(node);};button('read','Read selected binding',!this.#native);button('save','Save explicit binding',!this.#native);button('recover','Complete inspected prepared binding',!this.#inspection?.canRecover);
   if(this.#inspection)root.append(el('pre',JSON.stringify(this.#inspection,null,2)));if(this.#message)root.append(el('p',this.#message));
   const capture=()=>{this.#native=actors.value;this.#narrative=narrative.value;this.#observer=observer.value;this.#status=status.value;};
   actors.addEventListener('change',()=>{if(this.#busy)return;this.#native=actors.value;this.#narrative='';this.#observer='';this.#status='active';this.#revision=null;this.#inspection=null;this.#message='Read this exact Actor binding before editing existing metadata.';void this.render();});
   for(const input of [narrative,observer,status])input.addEventListener('input',capture);
   root.addEventListener('click',event=>{const button=event.target.closest?.('button[data-action]');if(!button||button.disabled||this.#busy)return;capture();void this.#action(button.dataset.action);});return root;
  }
  async #action(action){
   this.#busy=true;try{
    if(!gameInstance?.user?.isGM)throw Error('GM authority required');
    if(action==='read'){this.#inspection=await service.inspect({nativeActorId:this.#native});const binding=this.#inspection.binding;this.#revision=binding?.revision??null;this.#narrative=binding?.narrativeActorId??'';this.#observer=binding?.observerId??'';this.#status=binding?.status??'active';this.#message=binding?'Exact protected binding loaded.':'No existing binding. Enter both stable identities explicitly.';}
    else{const saved=action==='recover'?await service.recover({nativeActorId:this.#native,expectedRevision:this.#revision}):await service.save({nativeActorId:this.#native,narrativeActorId:this.#narrative.trim(),observerId:this.#observer.trim(),scope:'world',status:this.#status,expectedRevision:this.#revision});this.#revision=saved.revision;this.#narrative=saved.narrativeActorId;this.#observer=saved.observerId;this.#status=saved.status;this.#inspection=await service.inspect({nativeActorId:this.#native});this.#message=action==='recover'?'Original prepared binding completed after explicit review.':'Participant metadata saved. No world or narrative consequence was executed.';}
   }catch(error){this.#message=`Participant action rejected: ${error.code??error.message}`;}finally{this.#busy=false;await this.render();}
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
