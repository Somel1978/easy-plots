/**
 * Disposable-world native Hook signature probe. Import from a GM browser
 * console, record only metadata (never document data, changes, or secrets).
 * Does NOT emit world updates, affect documents, or start the narrative engine.
 *
 * import {installEasyPlotsHookProbe} from '/modules/easy-plots/tools/foundry-hook-observation-probe.mjs';
 * const probe=installEasyPlotsHookProbe();
 * // Perform a benign Actor/Journal edit in the disposable world.
 * probe.results(); probe.stop();
 */
const NAMES=['updateActor','updateItem','createJournalEntry','updateJournalEntry'];
export function installEasyPlotsHookProbe({hooks=globalThis.Hooks,gameInstance=globalThis.game}={}){
  if(!gameInstance?.user?.isGM)throw Error('Run only as GM in a disposable Foundry world');
  if(typeof hooks?.on!=='function'||typeof hooks?.off!=='function')throw Error('Foundry Hook API missing');
  const results=[],handlers=new Map();let active=true;
  for(const name of NAMES){
    const fn=(doc,...args)=>{
      if(!active)return;
      const isUpdate=name.startsWith('update');
      const userId=isUpdate?args[2]:args[1];
      results.push({hook:name,documentName:typeof doc?.documentName==='string'?doc.documentName:'(missing)',
        hasUUID:typeof doc?.uuid==='string'&&doc.uuid.length>0,
        userIdPresent:typeof userId==='string',argsCount:1+args.length});
      if(results.length>20)results.shift();
    };
    hooks.on(name,fn);handlers.set(name,fn);
  }
  return Object.freeze({
    results:()=>results.map(r=>({...r})),
    stop:()=>{active=false;for(const [name,fn] of handlers)hooks.off(name,fn);handlers.clear();}
  });
}
