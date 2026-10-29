/** GM-only versioned timeline desk. Canonical selection requires established
 * source observations and never promotes the preview into world effects. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=String(text);return n;};
const eventId=()=>`ep:event:timeline_${secureUUID().replaceAll('-','_')}`;
export function makeGMTimelineBranchWindow(Base,{service,gameInstance}={}){
 if(!['read','version','create','branch','selectCanonical','canonical'].every(k=>typeof service?.[k]==='function'))throw new EasyPlotsError('TIMELINE_DESK_DEPENDENCY','Protected timeline branch service required');
 return class EasyPlotsTimelineBranchDesk extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-timeline-branches',window:{title:'Easy Plots — Timeline branches',resizable:true},position:{width:800,height:820}};
  #fields={scope:'world',timelineId:'ep:timeline:next_session001',branchId:'ep:branch:canonical001',label:'Canonical timeline',parentBranchId:'ep:branch:canonical001',parentVersion:'1',version:'1',sourceRefs:'[]',hypotheses:'[]',rules:'[]'};
  #root=null;#version=null;#canonical=null;#message='';#reviewed=false;#busy=false;
  async _renderHTML(){
   const root=el('section');root.className='ep-editor ep-timeline-branches';
   if(!gameInstance?.user?.isGM){root.append(el('p','GM authority required'));return root;}
   root.append(el('h2','Timeline branches'),el('p','Alternates preserve their original sources and parent versions. Canonical selection records outcomes already established in canonical world facts.'));
   const field=(key,label,area=false)=>{const wrap=el('label',label),input=el(area?'textarea':'input');wrap.className='ep-field';input.className='ep-input';input.dataset.field=key;input.value=this.#fields[key];if(area)input.rows=3;wrap.append(input);root.append(wrap);};
   field('scope','Narrative scope');field('timelineId','Timeline ID');field('branchId','Branch ID');field('label','Branch label');field('version','Version to inspect or select');
   field('sourceRefs','Canonical world facts (JSON: id, revision, key)',true);
   const button=(action,label,disabled=false)=>{const b=el('button',label);b.type='button';b.dataset.action=action;b.disabled=disabled||this.#busy;root.append(b);};
   button('load','Load timeline');button('create','Create timeline from canonical facts');button('version','Inspect immutable branch version');
   field('parentBranchId','Exact parent branch ID');field('parentVersion','Exact parent version');field('hypotheses','Hypotheses (JSON: key, value)',true);field('rules','Declarative what-if rules (JSON)',true);button('branch','Save alternate branch version',!this.#root);
   const review=el('label','I reviewed that every selected outcome already exists in the named canonical fact revisions'),check=el('input');check.type='checkbox';check.dataset.field='reviewed';check.checked=this.#reviewed;review.append(check);root.append(review);button('select','Select established canonical branch',!this.#reviewed||!this.#root);
   if(this.#message)root.append(el('p',this.#message));
   if(this.#root)root.append(el('pre',JSON.stringify({timelineRevision:this.#root.revision,branches:this.#root.data.branches,canonical:this.#canonical},null,2)));
   if(this.#version)root.append(el('pre',JSON.stringify(this.#version.data,null,2)));
   root.addEventListener('input',event=>{const key=event.target?.dataset?.field;if(Object.hasOwn(this.#fields,key)){this.#fields[key]=event.target.value;this.#reviewed=false;const control=root.querySelector('[data-action="select"]');if(control)control.disabled=true;}});
   root.addEventListener('change',event=>{if(event.target?.dataset?.field==='reviewed'){this.#reviewed=event.target.checked;const control=root.querySelector('[data-action="select"]');if(control)control.disabled=!this.#reviewed||!this.#root;}});
   root.addEventListener('click',event=>{const b=event.target.closest?.('button[data-action]');if(!b||b.disabled||this.#busy)return;void(async()=>{
    this.#busy=true;try{
     if(!gameInstance?.user?.isGM)throw new EasyPlotsError('GM_REQUIRED','GM authority required');
     const data={...this.#fields};for(const value of Object.values(data))if(value.length>16000)throw Error('Timeline input exceeds its budget');
     const action=b.dataset.action,base={scope:data.scope.trim(),timelineId:data.timelineId.trim()},branchId=data.branchId.trim();
     if(action==='load'){this.#root=await service.read(base);this.#version=null;}
     else if(action==='version')this.#version=await service.version({...base,branchId,version:Number(data.version)});
     else if(action==='create')this.#root=await service.create({...base,branchId,label:data.label,sourceRefs:JSON.parse(data.sourceRefs),sourceEventId:eventId()});
     else{
      if(!this.#root||this.#root.id!==base.timelineId||this.#root.scope!==base.scope)throw Error('Load this exact timeline before changing its branches');
      if(action==='branch')this.#root=await service.branch({...base,branchId,parentBranchId:data.parentBranchId.trim(),parentVersion:Number(data.parentVersion),label:data.label,hypotheses:JSON.parse(data.hypotheses),rules:JSON.parse(data.rules),expectedRevision:this.#root.revision,sourceEventId:eventId()});
      else if(action==='select'){
       if(!this.#reviewed)throw Error('Review the established canonical sources before selection');
       this.#root=await service.selectCanonical({...base,branchId,version:Number(data.version),sourceRefs:JSON.parse(data.sourceRefs),expectedRevision:this.#root.revision,reviewEventId:eventId()});
      }
     }
     this.#canonical=this.#root?await service.canonical(base):null;this.#message='Protected timeline saved or loaded. No world effects executed.';this.#reviewed=false;
    }catch(error){this.#message=`Timeline action rejected: ${error.code??error.message}`;this.#reviewed=false;}
    finally{this.#busy=false;await this.render();}
   })();});return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
