/** Foundry v14 record-based controls, registered before canvas preparation.
 * Opening a launcher never initializes native storage, sockets or world hooks. */
const ID='easy-plots';
const registrations=new WeakMap();
export function registerFoundryLaunchers({hooks,gameProvider=()=>globalThis.game,baseProvider=()=>globalThis.foundry?.applications?.api?.ApplicationV2,notify=message=>globalThis.ui?.notifications?.warn?.(message)}={}){
 if(!hooks?.on||!hooks?.once)throw Error('Foundry lifecycle hooks required');
 if(registrations.has(hooks))return registrations.get(hooks);
 const launch=async(method,{gm=false}={})=>{
  try{const game=gameProvider();if(gm&&game?.user?.isGM!==true)throw Error('GM authority required');const api=game?.modules?.get(ID)?.api;if(typeof api?.[method]!=='function')throw Error('Easy Plots is not ready. Finish loading the world and try again.');if(method==='openEditor'&&typeof api.openGMWorkspace==='function'&&!String(api.integrationState??'').startsWith('guarded-native'))return await api.openGMWorkspace();return await api[method]();}
  catch(error){notify(error?.message??'Easy Plots could not open');return null;}
 };
 hooks.on('getSceneControlButtons',controls=>{
  const gm=gameProvider()?.user?.isGM===true;
  const entries=gm?[
   ['workspace','EasyPlots.Launcher.Open','fa-solid fa-diagram-project','openGMWorkspace'],
   ['editor','EasyPlots.Launcher.Editor','fa-solid fa-pen-ruler','openEditor'],
   ['cockpit','EasyPlots.Launcher.Cockpit','fa-solid fa-gauge-high','openCockpit']
  ]:[
   ['portal','EasyPlots.Launcher.Portal','fa-solid fa-book-open','openPlayerWorkspace'],
   ['inbox','EasyPlots.Launcher.Inbox','fa-solid fa-bell','openPlayerNoticeInbox']
  ];
  const tools=Object.fromEntries(entries.map(([name,title,icon,method],order)=>[name,{name,title,icon,order,button:true,onChange:()=>launch(method,{gm})}]));
  controls[ID]={name:ID,title:'EasyPlots.Launcher.Title',icon:'fa-solid fa-diagram-project',order:Math.max(0,...Object.values(controls).map(c=>Number.isFinite(c.order)?c.order:0))+1,tools,
   onChange:(_event,active)=>active?launch(gm?'openGMWorkspace':'openPlayerWorkspace',{gm}):undefined};
 });
 hooks.once('init',()=>{
  const Base=baseProvider(),settings=gameProvider()?.settings;
  if(!Base||typeof settings?.registerMenu!=='function')return;
  // A settings-menu application forwards to the same main window as controls.
  class EasyPlotsSettingsLauncher extends Base {async render(){const gm=gameProvider()?.user?.isGM===true;await launch(gm?'openGMWorkspace':'openPlayerWorkspace',{gm});return this;}}
  settings.registerMenu(ID,'workspace',{name:'EasyPlots.Launcher.Title',label:'EasyPlots.Launcher.Open',hint:'EasyPlots.Launcher.Hint',icon:'fa-solid fa-diagram-project',type:EasyPlotsSettingsLauncher,restricted:false});
 });
 const registration=Object.freeze({launch});registrations.set(hooks,registration);return registration;
}
