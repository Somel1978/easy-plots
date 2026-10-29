/** One native Foundry window. Service views are panels, never nested applications. */
import {localize} from './localization.mjs';

const el=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=String(text);node.className=className;return node;};
const t=(key,fallback)=>localize(`EasyPlots.Workspace.${key}`,fallback);
const identity=game=>`${game.user?.id}:${game.user?.isGM===true}`;

export function createWorkspaceHost(NativeApplication,{gameInstance,getState=()=>({}),onNavigate=()=>{}}={}){
  let current=null,owner='',history=[],nativeWindow=null,closed=false;
  const isCurrent=panel=>current===panel&&panel.owner===identity(gameInstance)&&!panel.disposed;
  class Workspace extends NativeApplication {
    static DEFAULT_OPTIONS={id:'easy-plots-workspace',window:{title:'Easy Plots',resizable:true},position:{width:1180,height:800},classes:['easy-plots-workspace-app']};
    async _renderHTML(){
      const root=el('section','','ep-shell');
      const key=identity(gameInstance);
      if(owner!==key){current=null;history=[];owner=key;}
      const rail=el('aside','','ep-shell-rail'),brand=el('header','','ep-shell-brand');
      brand.append(el('strong','Easy Plots'),el('small',gameInstance.world?.title??gameInstance.world?.name??t('campaign','Your campaign')));rail.append(brand);
      const nav=el('nav','','ep-shell-nav');nav.setAttribute('aria-label',t('navigation','Easy Plots navigation'));
      const routes=gameInstance.user?.isGM?[['campaign',t('campaign','Campaign')],['editor',t('editor','Plot editor')],['session',t('session','Session')],['review',t('review','Review')],['world',t('world','World')],['settings',t('settings','Settings')]]:[['player-quests',t('quests','Quests')],['player-investigations',t('investigations','Investigations')],['player-known-world',t('knownWorld','Known world')],['player-journal',t('journal','Journal')],['notices',t('notices','Notifications')]];
      const options=current?.constructor.DEFAULT_OPTIONS??{};
      const route=current?.route??routeFor(options.id);
      for(const [id,label] of routes){const b=el('button',label);b.type='button';b.dataset.route=id;if(!gameInstance.user?.isGM)b.dataset.tab=label;b.setAttribute('aria-current',route===id?'page':'false');b.addEventListener('click',()=>{void Promise.resolve().then(()=>onNavigate(id)).catch(error=>showError(error));});nav.append(b);}rail.append(nav);
      const status=await getState();
      if(identity(gameInstance)!==key)return this._renderHTML();
      const foot=el('footer','','ep-shell-status');foot.append(el('strong',gameInstance.user?.isGM?(status.state==='configured'?t('connected','Storage connected'):t('locked','Storage needs attention')):t('private','Your character’s shared story')));
      rail.append(foot);
      const main=el('main','','ep-shell-main'),heading=el('header','','ep-shell-location');
      if(history.some(p=>!p.disposed&&p.owner===key)){const back=el('button',t('back','Back'),'ep-shell-back');back.type='button';back.dataset.action='workspace-back';back.addEventListener('click',()=>{let previous;while(history.length&&!previous){const candidate=history.pop();if(!candidate.disposed&&candidate.owner===identity(gameInstance))previous=candidate;}if(previous)void previous.render({force:true,history:false}).catch(showError);});heading.append(back);}
      const title=String(options.window?.title??'Easy Plots').replace(/^Easy Plots\s*[—–-]\s*/,'');heading.append(el('span',title));main.append(heading);
      const content=el('div','','ep-shell-content');content.dataset.panel=options.id??'';
      const panel=current;
      if(panel&&isCurrent(panel)){
        let result;try{result=await panel._renderHTML({},{});}catch(error){result=el('section','','ep-campaign-workspace');result.append(el('h2',t('unavailable','Unable to load this view')),el('p',error.message??String(error),'ep-error'));const retry=el('button',t('retry','Try again'));retry.type='button';retry.addEventListener('click',()=>{void panel.render(true).catch(showError);});result.append(retry);}
        // A late read from a previous role or a panel that navigated elsewhere must never replace the active view.
        if(!isCurrent(panel)||identity(gameInstance)!==key)return this._renderHTML();
        if(typeof panel._replaceHTML==='function')panel._replaceHTML(result,content);else content.replaceChildren(result);
        panel.element=content;
      }else content.append(el('p',t('choose','Choose an area to begin.')));
      main.append(content);root.append(rail,main);return root;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
    async close(options){closed=true;if(current)current.rendered=false;return typeof super.close==='function'?super.close(options):this;}
  }
  const showError=error=>{globalThis.ui?.notifications?.warn?.(error.message??String(error));};
  class PanelBase {
    rendered=false;disposed=false;element=null;
    constructor(options={}){this.options={...this.constructor.DEFAULT_OPTIONS,...options};this.owner=identity(gameInstance);}
    async render(force=false){
      if(this.disposed||this.owner!==identity(gameInstance))return this;
      const activate=force===true||force?.force===true;
      // Async completion in a background panel refreshes its state without stealing navigation.
      if((current!==this||closed)&&!activate)return this;
      if(owner!==this.owner){history=[];current=null;owner=this.owner;}
      if(current!==this){if(current&&!current.disposed){current.rendered=false;if(force?.history!==false)history.push(current);history=history.slice(-16);}current=this;}
      closed=false;
      this.rendered=true;
      nativeWindow??=new Workspace();
      await nativeWindow.render({force:true});return this;
    }
    async close(){this.disposed=true;this.rendered=false;history=history.filter(p=>p!==this);if(current===this)current=null;return this;}
  }
  return {PanelBase,get window(){return nativeWindow;},get current(){return current;}};
}

function routeFor(id=''){
  if(id.includes('graph-editor')||id.includes('plot-authority')||id.includes('live-appearance'))return 'editor';
  if(id.includes('world-setup')||id.includes('status')||id.includes('reliability')||id.includes('storage'))return 'settings';
  if(id.includes('gm-workspace'))return 'campaign';
  if(id.includes('player-notification')||id.includes('player-notice'))return 'notices';
  if(id.includes('player'))return 'player';
  if(id.includes('review')||id.includes('approval'))return 'review';
  if(id.includes('cockpit')||id.includes('session')||id.includes('manual-event'))return 'session';
  return 'world';
}
