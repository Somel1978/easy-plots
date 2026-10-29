/** Real role-aware workspace shells. No sample records or implicit world effects. */
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=String(text);n.className=cls;return n;};
const button=(text,action)=>{const b=el('button',text);b.type='button';b.addEventListener('click',()=>{void Promise.resolve().then(action).catch(e=>globalThis.ui?.notifications?.warn?.(e.message));});return b;};
export function makeGMCampaignWorkspace(Base,{gameInstance,getState,listPlots,openPlot,newPlot,openSetup,openTools,resumePlot=()=>null}={}){return class extends Base{
 static DEFAULT_OPTIONS={id:'easy-plots-gm-workspace',window:{title:'Easy Plots — GM Workspace',resizable:true},position:{width:1050,height:760}};
 #cursor='0:0';#next=null;#error='';
 async _renderHTML(){const root=el('section','','ep-campaign-workspace');if(!gameInstance?.user?.isGM){root.append(el('p','GM access required'));return root;}const state=await getState();const header=el('header','','ep-campaign-heading');header.append(el('h2',gameInstance.world?.title??gameInstance.world?.name??'Campaign workspace'),el('p','Plots and session tools for this world.'));root.append(header);
 const nav=el('nav');nav.append(button('World setup',()=>openSetup()),button('Refresh',()=>this.render()));root.append(nav);
 const connected=state.state==='configured',banner=el('section','','ep-workspace-banner');banner.append(el('strong',connected?'World storage connected':'Welcome to Easy Plots'),el('p',connected?'Create a plot, build its story flow, then publish it when you are ready.':'Start by creating or unlocking this world’s private storage. Your saved plots will appear here.'));if(!connected)banner.append(button('Set up world storage',()=>openSetup()));root.append(banner);
 const current=resumePlot();if(current){const resume=el('article','','ep-workspace-card');resume.append(el('h3',current.title),el('p',current.dirty?'You have unsaved work. Continue editing to save or discard it.':'Continue where you left off.'),button('Continue editing',current.open));root.append(resume);}
 const create=button('New plot',async()=>{if((await getState()).state!=='configured')return openSetup();await newPlot();});create.dataset.action='new-plot';create.disabled=!connected;root.append(el('h3','Your plots'),create);
 if(connected){try{this.#error='';const page=await listPlots({cursor:this.#cursor,limit:12});this.#next=page.nextCursor??null;if(!page.items.length)root.append(el('p',this.#next?'No plots on this page. Continue to the next page.':'No saved plots yet. Use New plot to create your first story flow.'));const list=el('div','','ep-workspace-plots');for(const plot of page.items){const card=el('article','','ep-workspace-card');card.append(el('h3',plot.title??'Untitled plot'),el('p',`Saved draft · revision ${plot.revision}`),button('Open plot',()=>openPlot(plot.id)));list.append(card);}root.append(list);const pages=el('nav');pages.append(button('First page',()=>{this.#cursor='0:0';return this.render();}));const next=button('Next page',()=>{this.#cursor=this.#next;return this.render();});next.disabled=!this.#next;pages.append(next);root.append(pages);}catch(e){this.#error=e.message;}}
 else root.append(el('p','Your saved plots will appear here after the vault is unlocked. Temporary preview drafts are not shown as saved campaign plots.'));if(this.#error)root.append(el('p',this.#error));return root;}
 _replaceHTML(result,content){content.replaceChildren(result);}
};}
export function makePlayerCampaignWorkspace(Base,{gameInstance,openInbox,getViews=()=>[],inbox=null}={}){return class extends Base{
 static DEFAULT_OPTIONS={id:'easy-plots-player-workspace',window:{title:'Easy Plots — Your Campaign',resizable:true},position:{width:1000,height:740}};
 #actor='';#tab='Quests';
 route='player-quests';
 selectTab(name){if(!['Quests','Investigations','Known world','Journal','Notifications'].includes(name))return;this.#tab=name;this.route=name==='Notifications'?'notices':`player-${name.toLowerCase().replaceAll(' ','-')}`;}
 async _renderHTML(){const root=el('section','','ep-campaign-workspace');if(gameInstance.user?.isGM){root.append(el('p','This workspace is for players. Open the GM workspace to manage the campaign.'));return root;}root.append(el('h2','Your campaign'),el('p','Only information shared with your character appears here.'));
 const actors=(gameInstance.actors?.contents??[]).filter(a=>a.isOwner&&typeof a.id==='string');if(!actors.some(a=>a.id===this.#actor))this.#actor=actors[0]?.id??'';const label=el('label','Character'),select=el('select');select.dataset.field='character';for(const a of actors){const o=el('option',a.name??'Character');o.value=a.id;select.append(o);}select.value=this.#actor;select.addEventListener('change',()=>{this.#actor=select.value;void this.render();});label.append(select);root.append(label);
 root.append(el('h3',this.#tab));
 if(!actors.length)root.append(el('p','No owned world character is available. Ask your GM to assign a character to you.'));
 else if(this.#tab==='Notifications'){const groups=inbox?.groups??[];if(!groups.length)root.append(el('p','No received updates. New campaign notices will appear here when shared with you.'));for(const group of groups){const card=el('article','','ep-workspace-card');card.append(el('h3',group.title));for(const item of group.items)card.append(el('p',item.text));card.append(button('Dismiss',()=>{inbox.dismiss(group.id);return this.render();}));root.append(card);}}
 else{const kind={Quests:'quest-board',Investigations:'investigation-board',Journal:'session-recap','Known world':'spatial-atlas'}[this.#tab],views=(await getViews()).filter(v=>v.actorId===this.#actor&&v.kind===kind);if(!views.length)root.append(el('p','Nothing has been shared with this character in this session yet. Automatic discovery of shared campaign content is not available yet.'));for(const view of views){const card=el('article','','ep-workspace-card');card.append(el('h3',view.title??'Shared story view'),button('Open',view.open));root.append(card);}}return root;}
 _replaceHTML(result,content){content.replaceChildren(result);}
};}

/** Task directories keep the whole navigation map visible while legacy desks migrate. */
export function makeWorkspaceSection(Base,{id,title,intro,tasks=[],advanced=false}={}){return class extends Base{
 static DEFAULT_OPTIONS={id:`easy-plots-${id}`,window:{title:`Easy Plots — ${title}`}};
 route=id;
 async _renderHTML(){const root=el('section','','ep-campaign-workspace');root.append(el('h2',title),el('p',intro));if(advanced)root.append(el('p','These existing tools still use technical forms. Their guided task interfaces are tracked in the UI work order.','ep-workspace-banner'));
 const list=el('div','','ep-workspace-plots');for(const task of tasks){const card=el('article','','ep-workspace-card');card.append(el('h3',task.title),el('p',task.description));const b=button(task.label??'Open',task.open);b.disabled=!!task.reason;if(task.reason)card.append(el('p',task.reason,'ep-dim'));card.append(b);list.append(card);}root.append(list);return root;}
 _replaceHTML(result,content){content.replaceChildren(result);}
};}
