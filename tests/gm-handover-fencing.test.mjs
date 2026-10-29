import test from 'node:test';import assert from 'node:assert/strict';
import {DesignatedGMWriter} from '../src/security/gm-writer.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const user=id=>({id,isGM:true,active:true});
const gm=user('gm-01'),other=user('gm-02');
const context=createLocalGMContext({user:gm},'world1');
function make(){const gameInstance={user:gm,users:{activeGM:gm}};
 const handlers=new Map();let seq=0;
 const HooksInstance={on:(name,fn)=>{const id=++seq;handlers.set(id,{name,fn});return id;},
   off:(name,id)=>{assert.equal(handlers.get(id)?.name,name);handlers.delete(id);},
   emit:(name)=>{for(const h of handlers.values())if(h.name===name)h.fn();},
   get count(){return handlers.size;}};
 return {writer:new DesignatedGMWriter({gameInstance}),gameInstance,HooksInstance};}
test('writer captures designated GM and observes handover even if old GM becomes active again',async()=>{
 const f=make();f.writer.watchHooks(f.HooksInstance);
 await f.writer.withWriter(context,async()=>true);
 f.gameInstance.users.activeGM=other;f.HooksInstance.emit('updateUser');
 f.gameInstance.users.activeGM=gm;f.HooksInstance.emit('updateUser');
 assert.equal(f.writer.state.suspended,true);
 await assert.rejects(()=>f.writer.withWriter(context,async()=>true),{code:'GM_WRITE_SUSPENDED'});
 assert.throws(()=>f.writer.resumeAfterReconciliation({gmContext:context}),{code:'RECOVERY_NOT_VERIFIED'});
 f.writer.resumeAfterReconciliation({gmContext:context,confirmedNoUncertainOperations:true});
 assert.equal(await f.writer.withWriter(context,async()=>42),42);
 f.writer.stopWatching();assert.equal(f.HooksInstance.count,0);
});
test('handover during an awaited write does not return successful acknowledgement',async()=>{
 const f=make();f.writer.watchHooks(f.HooksInstance);
 let release;const latch=new Promise(resolve=>release=resolve);
 let begun;const started=new Promise(resolve=>begun=resolve);
 const operation=f.writer.withWriter(context,async()=>{begun();await latch;return 'native-updated';});
 await started;
 f.gameInstance.users.activeGM=other;f.HooksInstance.emit('updateUser');
 f.gameInstance.users.activeGM=gm;f.HooksInstance.emit('updateUser');
 release();await assert.rejects(operation,{code:'GM_WRITE_UNCERTAIN'});
 assert.equal(f.writer.state.suspended,true);
});
test('hook monitor installation requires observable hooks and never silently doubles listeners',()=>{
 const f=make();assert.throws(()=>f.writer.watchHooks({}),{code:'GM_HOOKS_UNAVAILABLE'});
 f.writer.watchHooks(f.HooksInstance);
 assert.throws(()=>f.writer.watchHooks(f.HooksInstance),{code:'GM_WATCH_ALREADY_STARTED'});
 f.writer.stopWatching();f.writer.stopWatching();assert.equal(f.HooksInstance.count,0);
});
