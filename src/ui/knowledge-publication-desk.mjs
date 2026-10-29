import {secureUUID} from '../contracts/digest.mjs';
const el=(tag,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=String(text);return e;};
const uid=kind=>`ep:${kind}:${secureUUID().replaceAll('-','_')}`;
const split=value=>value.split(',').map(s=>s.trim()).filter(Boolean);
export function makeGMKnowledgePublicationWindow(Base,{gameInstance,plans,native,prepareHandler=null,openDraft=null,openEvent=null,openPublication=null}={}){
 return class EasyPlotsKnowledgePublication extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-knowledge-publications',window:{title:'Easy Plots — Protected Chat & Journal',resizable:true},position:{width:790,height:710}};
  #fields={scope:'world',id:uid('publication'),publicationKind:'knowledge',observerId:'',nativeKind:'ChatMessage',title:'Narrative update',receiptIds:'',correctionIds:'',worldTime:'0',rollKind:'d20',attemptId:'',expectedRollRevision:'2',disclosure:'total-only',audience:'gm-only',observerIds:'',side:'self'};#row=null;#nativeInfo=null;#eventId=null;#handlerId=null;#message='';#busy=false;
  async _renderHTML(){
   const root=el('section','ep-editor ep-knowledge-publications');if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM authority required'));return root;}
   root.append(el('h2','','Protected Chat & Journal publication'),el('p','ep-banner','Preparing or approving a plan creates no native entry. Knowledge and mechanical roll disclosure have independent recipient policies.'));
   const select=(key,label,options)=>{const field=el('label','ep-field');field.append(el('span','ep-label',label));const input=el('select','ep-input');input.dataset.field=key;for(const [value,title] of options){const o=el('option','',title);o.value=value;input.append(o);}input.value=this.#fields[key];field.append(input);root.append(field);};
   select('publicationKind','Publication content',[['knowledge','Known narrative projection'],['roll','Mechanical roll report']]);
   const roll=this.#fields.publicationKind==='roll';
   const fields=[['scope','Narrative scope'],['id','Publication ID'],['title','Authorized title'],['worldTime','As-of fictional world time'],...(roll?[['attemptId','Resolved native attempt ID'],['expectedRollRevision','Exact roll revision'],['observerIds','Authorized observer IDs (private recipient policy only)']]:[['observerId','Recipient narrative observer ID'],['receiptIds','Known receipt IDs (comma separated; at most 8)'],['correctionIds','Selected correction IDs']])];
   for(const [key,label] of fields){
    const l=el('label','ep-field');l.append(el('span','ep-label',label));const input=el('input','ep-input');input.dataset.field=key;input.value=this.#fields[key];l.append(input);root.append(l);
   }
   if(roll){select('rollKind','Native source',[['d20','Active or passive d20'],['opposed','Opposed d20']]);select('disclosure','Mechanical fields to release',[['total-only','Selected total only'],['outcome-only','Mechanical outcome only'],['total-and-outcome','Selected total and outcome']]);select('audience','Who may open this mechanical report',[['gm-only','Blind: GMs only'],['all-players','Public: all connected users'],['observers','Private: named narrative observers']]);select('side','Selected side',this.#fields.rollKind==='opposed'?[['initiator','Initiator'],['opponent','Opponent']]:[['self','Rolling actor']]);root.append(el('p','ep-dim','Roll reports use Chat. DCs, modifiers, opponent totals and private narrative facts are excluded. Native entries use a generic encrypted shell.'));}
   else select('nativeKind','Native channel',[['ChatMessage','Protected Chat entry'],['JournalEntry','Protected Journal entry']]);
   const button=(action,label,disabled=false)=>{const b=el('button','ep-button',label);b.type='button';b.dataset.action=action;b.disabled=disabled;root.append(b);};
   button('new-plan','New publication');button('prepare',roll?'Prepare mechanical disclosure':'Prepare known projection');button('inspect','Load saved plan');button('approve','Approve saved plan',this.#row?.data.state!=='draft');button('propose','Propose native effect',this.#row?.data.state!=='approved');
   if(prepareHandler)button('prepare-handler','Prepare publication graph draft');if(this.#handlerId&&openDraft)button('open-handler','Open publication graph draft');if(this.#eventId&&openEvent)button('open-event','Open native effect review');
   if(this.#row){root.append(el('pre','ep-publication-plan',JSON.stringify({id:this.#row.id,revision:this.#row.revision,state:this.#row.data.state,nativeKind:this.#row.data.nativeKind,audience:this.#row.data.audience,observerId:this.#row.data.observerId,observerIds:this.#row.data.observerIds,view:this.#row.data.view},null,2)));button('inspect-native','Inspect native result');button('confirm-native','Confirm verified original result',this.#nativeInfo?.state!=='prepared'||this.#nativeInfo.nativeConfirmed!==true);}
   if(this.#nativeInfo){root.append(el('pre','ep-publication-native',JSON.stringify(this.#nativeInfo,null,2)));if(openPublication)button('open-content','Open authorized native content',this.#nativeInfo.state!=='ready');}
   if(this.#message)root.append(el('p','ep-publication-desk-message',this.#message));
   root.addEventListener('input',event=>{if(this.#busy||!event.target.dataset.field)return;const key=event.target.dataset.field;this.#fields[key]=event.target.value;this.#row=null;this.#nativeInfo=null;this.#eventId=null;root.querySelectorAll('.ep-publication-plan,.ep-publication-native').forEach(e=>e.remove());for(const action of ['approve','propose','inspect-native','confirm-native','open-content','open-event']){const b=root.querySelector(`[data-action="${action}"]`);if(b)b.disabled=true;}if(key==='rollKind')this.#fields.side=this.#fields.rollKind==='opposed'?'initiator':'self';if(['publicationKind','rollKind'].includes(key))void this.render();});
   root.addEventListener('click',event=>{const b=event.target.closest?.('button[data-action]');if(!b||b.disabled||this.#busy)return;
    void(async()=>{this.#busy=true;let opened=false;try{
     if(!gameInstance?.user?.isGM)throw Error('GM authority required');const action=b.dataset.action;
     for(const input of root.querySelectorAll('[data-field]'))this.#fields[input.dataset.field]=input.value;
     const {scope,id}=this.#fields;
     if(action==='new-plan'){this.#fields.id=uid('publication');this.#row=null;this.#nativeInfo=null;this.#eventId=null;}
     else if(action==='prepare'){
      const common={scope,id,title:this.#fields.title,worldTime:Number(this.#fields.worldTime),sourceEventId:uid('event')};
      this.#row=this.#fields.publicationKind==='roll'?await plans.prepareRoll({...common,rollKind:this.#fields.rollKind,attemptId:this.#fields.attemptId,expectedRollRevision:Number(this.#fields.expectedRollRevision),disclosure:this.#fields.disclosure,side:this.#fields.side,audience:this.#fields.audience,observerIds:split(this.#fields.observerIds)}):await plans.prepare({...common,observerId:this.#fields.observerId,nativeKind:this.#fields.nativeKind,receiptIds:split(this.#fields.receiptIds),correctionIds:split(this.#fields.correctionIds)});this.#message='Projection saved privately. Review and approve this exact plan before proposing its native effect.';
     }else if(action==='inspect'){
      this.#row=await plans.read({scope,id});if(!this.#row)throw Error('Saved plan not found');const d=this.#row.data;Object.assign(this.#fields,{publicationKind:d.view.kind==='roll-publication'?'roll':'knowledge',observerId:d.observerId??'',nativeKind:d.nativeKind,title:d.view.title,receiptIds:(d.receiptIds??[]).join(', '),correctionIds:(d.correctionIds??[]).join(', '),worldTime:String(d.view.worldTime)});if(d.rollSource)Object.assign(this.#fields,{rollKind:d.rollSource.kind,attemptId:d.rollSource.attemptId,expectedRollRevision:String(d.rollSource.revision),disclosure:d.rollSource.disclosure,side:d.rollSource.side,audience:d.audience,observerIds:d.observerIds.join(', ')});this.#nativeInfo=null;this.#eventId=null;
     }else if(action==='approve'){this.#row=await plans.approve({scope,id:this.#row.id,expectedRevision:this.#row.revision,reviewEventId:uid('event')});this.#message='Plan approved. Native creation still requires its own reviewed effect.';}
     else if(action==='propose'){const result=await plans.propose({scope,id:this.#row.id,expectedRevision:this.#row.revision});this.#eventId=result.eventId;this.#message=`Publication proposal: ${result.status}. Review, approve and execute the effect separately.`;}
     else if(action==='prepare-handler'){const result=await prepareHandler();this.#handlerId=result.graphId;this.#message='Publication graph draft prepared. Publish and activate it from the editor before proposing native effects.';}
     else if(action==='open-handler'){await openDraft(this.#handlerId);opened=true;}
     else if(action==='open-event'){await openEvent(this.#eventId);opened=true;}
     else if(action==='inspect-native'){this.#nativeInfo=await native.inspect({scope,publicationId:this.#row.id});this.#message=this.#nativeInfo?'Native result inspected. No document was recreated.':'No native creation has been prepared.';}
     else if(action==='confirm-native'){await native.confirm({scope,publicationId:this.#row.id,expectedEnvelopeRevision:this.#nativeInfo.revision,reviewEventId:uid('event')});this.#nativeInfo=await native.inspect({scope,publicationId:this.#row.id});this.#message='The original native document is confirmed. Its operation journal still requires verified reconciliation.';}
     else if(action==='open-content'){await openPublication({nativeKind:this.#nativeInfo.nativeKind,nativeId:this.#nativeInfo.nativeId});opened=true;}
    }catch(error){this.#message=`Publication rejected: ${error.code??error.message}`;}finally{this.#busy=false;if(!opened)await this.render();}})();
   });return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
