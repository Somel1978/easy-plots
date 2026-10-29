/** ApplicationV2 audience window; never reads protected native repository. */
import {validateContinuityProjection} from '../platform/foundry-continuity-transport.mjs';
const el=(tag,cls='',text='')=>{const node=document.createElement(tag);if(cls)node.className=cls;node.textContent=String(text);return node;};
export function makePlayerContinuityWindow(Base,{kind,projection}={}){
 validateContinuityProjection(kind,projection);
 return class EasyPlotsPlayerContinuity extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-player-continuity',window:{title:'Easy Plots — Shared Continuity',resizable:true},position:{width:630,height:500}};
  async _renderHTML(){
   const root=el('section','ep-editor ep-player-continuity');
   if(kind==='session-recap'){
    root.append(el('h2','','Session recap'),el('p','ep-dim','Only recap lines approved for this character are shown.'));
    for(const item of projection.recap){const article=el('article','ep-board-item');article.append(el('p','',item.text));root.append(article);}
   }else if(kind==='quest-board'){
    root.append(el('h2','',projection.title),el('p','ep-dim','Only objectives expressly shared with this character are shown.'));
    for(const item of projection.objectives){const article=el('article','ep-board-item');article.append(el('strong','',item.status),el('p','',item.text));root.append(article);}
   }else{
    root.append(el('h2','','Approved decision'),el('p','ep-dim','Final choice. Private ballots and identities are not disclosed.'),
     el('article','ep-board-item',projection.choiceId));
   }
   return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
