/** Private GM evidence UI. Report values are rendered only as text. */
import {executionFingerprint} from '../graph/graph-dependencies.mjs';
const el=(tag,text='')=>{const node=document.createElement(tag);node.textContent=String(text);return node;};
export function renderPublicationPreflight(report){
 const root=el('section');root.className='ep-publication-preflight';
 if(!report){root.append(el('p','This candidate has no stored validation.'));return root;}
 root.append(el('h3',report.ok?'Publication checks passed':'Publication blocked'),el('p',`${report.blockers.length} blockers · ${report.warnings.length} warnings · ${report.nodeCount} nodes · ${report.edgeCount} edges`));
 for(const row of [...report.blockers,...report.warnings]){const item=el('article');item.className=row.severity==='blocker'?'ep-danger':'ep-warning';item.append(el('strong',`${row.severity.toUpperCase()}: ${row.code}`),el('p',row.message),el('p',row.remediation));if(row.nodeId||row.edgeId)item.append(el('small',[row.nodeId,row.edgeId].filter(Boolean).join(' · ')));root.append(item);}
 root.append(el('h4','Required coverage'));
 const checks=el('ul');for(const row of report.coverage.checks)checks.append(el('li',`${row.id}: ${row.status} (${row.checked}/${row.total})`));root.append(checks);
 root.append(el('p','These checks cover static publication contracts. Native world execution, current event state and roll observations, and recipient authorization are checked by their existing runtime and effect review services.'));
 return root;
}
export function makeGraphPreflightWindow(Base,{gameInstance,validations,preflight,graphProvider,capabilities=()=>[],published=false}={}){
 return class EasyPlotsGraphPreflight extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-graph-preflight',window:{title:'Easy Plots — Publication preflight',resizable:true},position:{width:800,height:700}};
  #review=null;#message='';#reason='';#ack=false;#busy=false;
  async _renderHTML(){
   const root=el('section');root.className='ep-editor ep-preflight-desk';if(!gameInstance?.user?.isGM){root.append(el('p','GM authority required'));return root;}
   let graph,view;try{graph=await graphProvider();if(!graph)throw Error('Select a graph first');view=published?{status:(await validations.publishedManifest(graph))?'tracked':'untracked',report:null}:await validations.inspectCandidate(graph,{capabilities:capabilities()});}catch(error){root.append(el('p',`Validation unavailable: ${error.code??error.message}`));return root;}
   root.append(el('h2',published?'Legacy publication dependency review':'Candidate publication preflight'),el('p',`${graph.title??graph.id} · ${published?'published version':'draft revision'} ${published?graph.publishedVersion:graph.revision} · ${view.status}`));
   const fingerprint=executionFingerprint(graph),report=this.#review?.executionFingerprint===fingerprint?this.#review.report:view.report;
   root.append(renderPublicationPreflight(report));
   const button=(action,label,disabled=false)=>{const node=el('button',label);node.type='button';node.dataset.action=action;node.disabled=disabled;root.append(node);};
   button('validate',published?'Review current exact contracts':'Validate this candidate');
   let reason,ack;
   if(published&&view.status==='untracked'){
    root.append(el('p','This immutable publication predates dependency tracking. Explicit adoption binds the currently reviewed contracts; it cannot establish which contracts ran historically. A changed tracked publication requires a migrated draft.'));
    reason=el('input');reason.dataset.field='reason';reason.placeholder='Reason for adopting these exact current contracts';reason.value=this.#reason;root.append(reason);
    const label=el('label');ack=el('input');ack.type='checkbox';ack.checked=this.#ack;ack.dataset.field='acknowledge';label.append(ack,el('span','I reviewed these current contracts and acknowledge the listed warnings.'));root.append(label);
    button('adopt','Adopt reviewed legacy publication',!report?.ok);
   }
   if(this.#message)root.append(el('p',this.#message));
   root.addEventListener('click',event=>{const node=event.target.closest?.('button[data-action]');if(!node||node.disabled||this.#busy)return;void(async()=>{this.#busy=true;try{
    if(!gameInstance?.user?.isGM)throw Error('GM authority required');const current=await graphProvider();if(executionFingerprint(current)!==fingerprint)throw Error('The graph changed. Refresh its evidence first.');
    if(node.dataset.action==='validate'){
     const result=published?{report:await preflight.inspect(current,{capabilities:capabilities()})}:await validations.validateCandidate(current,{capabilities:capabilities(),expectedValidationRevision:view.revision});this.#review={executionFingerprint:fingerprint,report:result.report};this.#message='Validation evidence refreshed.';
    }else{
     this.#reason=reason.value;this.#ack=ack.checked;if(!this.#ack)throw Error('Explicit review of these contracts is required');
     await validations.adoptPublished(current,{approved:true,reason:this.#reason,expectedExecutionFingerprint:fingerprint,capabilities:capabilities(),acknowledgeWarnings:this.#ack});this.#message='Exact dependency contracts adopted without changing the immutable publication.';
    }
   }catch(error){this.#message=`Preflight action rejected: ${error.code??error.message}`;}finally{this.#busy=false;await this.render();}})();});
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
