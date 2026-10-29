/** Core workspaces follow the supplied GM/player layout, using real campaign data. */
import {readPlotPage} from './plot-list.mjs';
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=String(text);n.className=cls;return n;};
const button=(text,action,cls='')=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',()=>{if(b.disabled)return;b.disabled=true;b.setAttribute('aria-busy','true');void Promise.resolve().then(action).catch(e=>globalThis.ui?.notifications?.warn?.(e.message)).finally(()=>{if(b.isConnected){b.disabled=false;b.removeAttribute('aria-busy');}});});return b;};
export function makeGMCampaignWorkspace(Base,{gameInstance,getState,listPlots,openPlot,newPlot,openSetup,resumePlot=()=>null,openSession=()=>{},openReview=()=>{},getActivity=async()=>[]}={}){
 return class extends Base{
  static DEFAULT_OPTIONS={id:'easy-plots-gm-workspace',window:{title:'Easy Plots — GM Workspace',resizable:true},position:{width:1180,height:800}};
  #cursor='0:0';#next=null;#error='';
  async _renderHTML(){
   const root=el('section','','ep-campaign-workspace ep-gm-home');
   if(!gameInstance?.user?.isGM){root.append(el('p','GM access required'));return root;}
   const state=await getState(),connected=state.state==='configured',title=gameInstance.world?.title??gameInstance.world?.name??'Your campaign';
   const heading=el('header','','ep-home-heading'),intro=el('div');intro.append(el('small',title,'ep-kicker'),el('h2','Your campaign'),el('p','Prepare stories. Follow the players’ choices.','ep-dim'));
   const actions=el('div','','ep-home-heading-actions'),create=button('＋ New plot',newPlot,'ep-primary');create.dataset.action='new-plot';create.disabled=!connected;
   actions.append(button('World setup',openSetup),create);heading.append(intro,actions);root.append(heading);
   const columns=el('div','','ep-home-grid'),main=el('div','','ep-home-primary'),rail=el('aside','','ep-dashboard-rail');
   if(!connected){const setup=el('section','','ep-workspace-banner');setup.append(el('h3','Set up or unlock world storage'),el('p',state.message),button('Open world storage',openSetup,'ep-primary'));main.append(setup);}
   const sectionHead=el('div','','ep-section-heading');sectionHead.append(el('h3','Your plots'),button('Refresh',()=>{this.#cursor='0:0';return this.render();}));main.append(sectionHead);
   const current=resumePlot();if(current){const resume=el('div','','ep-resume-work');resume.append(el('span',current.dirty?'Your open plot has changes pending.':'Continue your open plot.'),button('Continue editing',current.open));main.append(resume);}
   if(connected){
    try{
     this.#error='';const page=await readPlotPage(listPlots,{cursor:this.#cursor,limit:12});this.#next=page.nextCursor;
     if(!page.items.length){const empty=el('section','','ep-workspace-card ep-home-empty');empty.append(el('h3',this.#next?'Loading your saved plots':'Your first story starts here'),el('p',this.#next?'More stored index pages remain. Continue loading to find your saved plots.':'Create a plot to begin. New plots are saved as drafts, and edits autosave to this world.'));if(this.#next)empty.append(button('Continue loading plots',()=>{this.#cursor=this.#next;return this.render();}));main.append(empty);}
     const list=el('div','','ep-workspace-plots');
     for(const [index,plot] of page.items.entries()){
      const card=el('article','',index===0?'ep-workspace-card ep-plot-featured':'ep-workspace-card');
      card.append(el('small','Saved draft','ep-tag'),el('h3',plot.title??'Untitled plot'),el('p','Continue shaping this plot’s story flow.','ep-dim'));
      const footer=el('footer','','ep-plot-card-footer');footer.append(el('small',`Draft revision ${plot.revision}`),button('Open plot',()=>openPlot(plot.id),index===0?'ep-primary':''));card.append(footer);list.append(card);
     }
     if(page.items.length)main.append(list);
     if(this.#cursor!=='0:0'||this.#next){const pages=el('nav','','ep-pagination');if(this.#cursor!=='0:0')pages.append(button('First page',()=>{this.#cursor='0:0';return this.render();}));if(this.#next&&page.items.length)pages.append(button('Next page',()=>{this.#cursor=this.#next;return this.render();}));main.append(pages);}
    }catch(error){this.#error=error.message;}
   }else main.append(el('p','Your saved plots will appear here after this world’s vault is unlocked.','ep-dim'));
   if(this.#error){const error=el('p',this.#error,'ep-error');error.setAttribute('role','alert');main.append(error);}
   const session=el('section','','ep-workspace-card');session.append(el('small','Next session','ep-kicker'),el('h3','Prepare the next chapter'),el('p','Select plots, prepare private notes and review your session agenda.','ep-dim'));const sessionButton=button('Session tools',openSession);sessionButton.disabled=!connected;session.append(sessionButton);main.append(session);
   const review=el('section','','ep-workspace-card');review.append(el('h3','GM review'),el('p','Review requests and proposed consequences before acting.','ep-dim'));const reviewButton=button('Open review',openReview);reviewButton.disabled=!connected;review.append(reviewButton);rail.append(review);
   const activity=el('section','','ep-workspace-card');activity.append(el('h3','Recent activity'),el('small','Events loaded in this GM session.','ep-dim'));
   try{const entries=connected?await getActivity():[];for(const entry of entries.slice(0,8)){const row=el('article','','ep-activity-row');row.append(el('strong',entry.label),el('small',entry.status));activity.append(row);}if(!entries.length)activity.append(el('p','No events are loaded in this session yet. This does not mean that stored review work is empty.','ep-dim'));}catch{activity.append(el('p','Recent activity could not be loaded. Open review to inspect stored events.','ep-dim'));}
   rail.append(activity);columns.append(main,rail);root.append(columns,el('footer',connected?'World storage connected · New plots and editor changes are saved as drafts.':'World storage is locked.','ep-home-footer'));return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
export function makePlayerCampaignWorkspace(Base,{gameInstance,getViews=()=>[],inbox=null}={}){
 return class extends Base{
  static DEFAULT_OPTIONS={id:'easy-plots-player-workspace',window:{title:'Easy Plots — Player portal',resizable:true},position:{width:1180,height:800}};
  #actor='';#tab='Quests';route='player-quests';
  selectTab(name){if(!['Quests','Investigations','Known world','Journal','Notifications'].includes(name))return;this.#tab=name;this.route=name==='Notifications'?'notices':`player-${name.toLowerCase().replaceAll(' ','-')}`;}
  async _renderHTML(){
   const root=el('section','','ep-campaign-workspace ep-player-home');
   if(gameInstance.user?.isGM){root.append(el('p','Open the GM workspace to manage the campaign.'));return root;}
   const actors=(gameInstance.actors?.contents??[]).filter(a=>a.isOwner&&typeof a.id==='string');if(!actors.some(a=>a.id===this.#actor))this.#actor=actors[0]?.id??'';
   const characterLabel=el('label','Character'),character=el('select');character.dataset.field='character';for(const actor of actors){const option=el('option',actor.name??'Character');option.value=actor.id;character.append(option);}character.value=this.#actor;character.addEventListener('change',()=>{this.#actor=character.value;void this.render();});characterLabel.append(character);root.append(characterLabel);
   const world=gameInstance.world?.title??gameInstance.world?.name??'your campaign',heading=el('header','','ep-home-heading'),intro=el('div');intro.append(el('small',world,'ep-kicker'),el('h2',`Your story in ${world}`),el('p','The leads you’ve found. The choices still ahead.','ep-dim'));heading.append(intro);root.append(heading);
   const tabs=el('nav','','ep-player-tabs');tabs.setAttribute('aria-label','Character journal sections');
   for(const name of ['Quests','Investigations','Known world','Journal','Notifications']){const b=button(name,()=>{this.selectTab(name);return this.render();});b.dataset.tab=name;b.dataset.route=name==='Notifications'?'notices':`player-${name.toLowerCase().replaceAll(' ','-')}`;b.setAttribute('aria-current',this.#tab===name?'page':'false');tabs.append(b);}root.append(tabs);
   const layout=el('div','','ep-player-grid'),main=el('main','','ep-player-content'),rail=el('aside','','ep-dashboard-rail');main.append(el('h3',this.#tab));
   const groups=inbox?.groups??[],views=actors.length?(await getViews()).filter(v=>v.actorId===this.#actor):[];
   if(!actors.length)main.append(el('section','No owned world character is available. Ask your GM to assign a character to you.','ep-workspace-card'));
   else if(this.#tab==='Notifications'){
    if(!groups.length)main.append(el('section','No received updates. New campaign notices will appear here when shared with you.','ep-workspace-card'));
    for(const group of groups){const card=el('article','','ep-workspace-card');card.append(el('h3',group.title));for(const item of group.items)card.append(el('p',item.text));card.append(button('Dismiss',()=>{inbox.dismiss(group.id);return this.render();}));main.append(card);}
   }else{
    const kind={Quests:'quest-board',Investigations:'investigation-board',Journal:'session-recap','Known world':'spatial-atlas'}[this.#tab],selected=views.filter(v=>v.kind===kind);
    if(!selected.length){const empty=el('section','','ep-workspace-card');empty.append(el('h3','Nothing shared here yet'),el('p','Nothing has been shared with this character in this session yet. Automatic discovery of shared campaign content is not available yet.','ep-dim'));main.append(empty);}
    for(const view of selected){const card=el('article','','ep-workspace-card ep-shared-story');card.append(el('small',this.#tab==='Quests'?'Shared quest':this.#tab,'ep-tag'),el('h3',view.title??'Shared story'));
     if(view.kind==='quest-board')for(const item of view.view?.objectives??[]){const row=el('div','','ep-quest-objective');row.append(el('span',item.status==='completed'?'✓':'○'),el('p',item.text));card.append(row);}
     if(view.kind==='session-recap')for(const line of view.view?.recap??[])card.append(el('p',line.text));
     if(view.kind==='investigation-board'){const clues=el('div','','ep-shared-clues');for(const item of (view.view?.evidence??[]).slice(0,6)){const clue=el('article','','ep-shared-clue');clue.append(el('strong',item.title),el('p',item.description));clues.append(clue);}card.append(clues);}
     card.append(button('Open shared content',view.open));main.append(card);
    }
   }
   const notices=el('section','','ep-workspace-card');notices.append(el('h3','New for you'));if(!groups.length)notices.append(el('p','No new campaign notices.','ep-dim'));for(const group of groups.slice(0,3)){const item=el('article','','ep-activity-row');item.append(el('strong',group.title));for(const notice of group.items.slice(0,2))item.append(el('p',notice.text));notices.append(item);}rail.append(notices);
   const recap=views.find(v=>v.kind==='session-recap');if(recap){const card=el('section','','ep-workspace-card');card.append(el('small','Last shared recap','ep-kicker'),el('h3',recap.title??'Session journal'));const line=recap.view?.recap?.[0];if(line)card.append(el('p',line.text));card.append(button('Read your session journal',()=>{this.selectTab('Journal');return this.render();}));rail.append(card);}
   layout.append(main,rail);root.append(layout,el('footer','Only information shared with your character appears here.','ep-home-footer'));return root;
  }
  _replaceHTML(result,content){content.replaceChildren(result);}
 };
}
/** Task directories keep the whole navigation map visible while legacy desks migrate. */
export function makeWorkspaceSection(Base,{id,title,intro,tasks=[],advanced=false}={}){return class extends Base{
 static DEFAULT_OPTIONS={id:`easy-plots-${id}`,window:{title:`Easy Plots — ${title}`}};
 route=id;
 async _renderHTML(){const root=el('section','','ep-campaign-workspace');root.append(el('h2',title),el('p',intro));if(advanced)root.append(el('p','These existing tools still use technical forms. Their guided task interfaces are tracked in the UI work order.','ep-workspace-banner'));
 const list=el('div','','ep-workspace-plots');for(const task of tasks){const card=el('article','','ep-workspace-card');card.append(el('h3',task.title),el('p',task.description));const b=button(task.label??'Open',task.open);b.disabled=!!task.reason;if(task.reason)card.append(el('p',task.reason,'ep-dim'));card.append(b);list.append(card);}root.append(list);return root;}
 _replaceHTML(result,content){content.replaceChildren(result);}
};}
