import {validateNoticeView} from '../contracts/notification-view.mjs';
import {EasyPlotsError} from '../contracts/errors.mjs';
const weight={info:0,attention:1,urgent:2};
/** Stores only already disclosed views on this client. No source/index reader. */
export class PlayerNoticeInbox {
 #items=new Map();
 receive(input){const item=validateNoticeView(input),old=this.#items.get(item.id);
  if(old){if(JSON.stringify(old)!==JSON.stringify(item))throw new EasyPlotsError('NOTICE_REUSE_CONFLICT','Received notice identity changed');return false;}
  if(this.#items.size>=64)this.#items.delete(this.#items.keys().next().value);this.#items.set(item.id,item);return true;
 }
 get groups(){const groups=new Map();for(const item of this.#items.values()){const key=item.group?.id??`single:${item.id}`,group=groups.get(key)??{id:key,title:item.group?.title??'Narrative update',level:'info',items:[]};group.items.push(structuredClone(item));if(weight[item.level]>weight[group.level])group.level=item.level;groups.set(key,group);}return [...groups.values()].sort((a,b)=>weight[b.level]-weight[a.level]);}
 dismiss(id){for(const [key,item] of this.#items)if((item.group?.id??`single:${item.id}`)===id)this.#items.delete(key);}
}
const el=(tag,cls='',text='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=String(text);return e;};
export function makePlayerNotificationInboxWindow(Base,{inbox}={}){
 return class EasyPlotsPlayerNoticeInbox extends Base {
  static DEFAULT_OPTIONS={id:'easy-plots-player-notice-inbox',window:{title:'Easy Plots — Narrative Updates',resizable:true},position:{width:650,height:510}};
  async _renderHTML(){const root=el('section','ep-editor ep-player-notices');root.append(el('h2','','Narrative updates'),el('p','ep-dim','Up to 64 received messages on this client. Dismissing a group changes this local view.'));
   const groups=inbox.groups;if(!groups.length)root.append(el('p','','No received updates.'));
   for(const group of groups){const section=el('section','ep-panel ep-notice-group');section.dataset.groupId=group.id;section.append(el('h3','',group.title),el('small','',`${group.level} · ${group.items.length} received`));for(const item of group.items)section.append(el('p','ep-notice-text',item.text));const dismiss=el('button','ep-button','Dismiss received group');dismiss.type='button';dismiss.dataset.action='dismiss-notice-group';dismiss.addEventListener('click',()=>{inbox.dismiss(group.id);void this.render();});section.append(dismiss);root.append(section);}return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
