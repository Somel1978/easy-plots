import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceHost} from '../src/ui/workspace-shell.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {normalizeGMAuthoringCommand} from '../src/orchestration/gm-plot-authoring.mjs';

test('one native host is reused across panels and background refresh cannot steal navigation',async()=>{
  const renders=[];class Native {render(){renders.push(this);return Promise.resolve(this);}}
  const game={user:{id:'gm',isGM:true}},host=createWorkspaceHost(Native,{gameInstance:game});
  class Panel extends host.PanelBase {static DEFAULT_OPTIONS={id:'panel'};}
  const editor=new Panel(),setup=new Panel();await editor.render(true);await setup.render(true);
  assert.equal(host.current,setup);assert.equal(editor.rendered,false);assert.equal(setup.rendered,true);
  await editor.render();assert.equal(host.current,setup);assert.equal(renders.length,2);
  await editor.render(true);assert.equal(host.current,editor);assert.equal(new Set(renders).size,1);
  await setup.close();await setup.render(true);assert.equal(host.current,editor);
  await host.window.close();const count=renders.length;await editor.render();assert.equal(renders.length,count,'background changes must not reopen a closed workspace');await editor.render(true);assert.equal(renders.length,count+1);
});

test('a panel from another user or role cannot reappear after an asynchronous completion',async()=>{
  const renders=[];class Native {render(){renders.push(this);return Promise.resolve(this);}}
  const game={user:{id:'gm',isGM:true}},host=createWorkspaceHost(Native,{gameInstance:game});
  class Panel extends host.PanelBase {}
  const gm=new Panel();await gm.render(true);game.user={id:'player',isGM:false};const player=new Panel();await player.render(true);
  await gm.render(true);assert.equal(host.current,player);assert.equal(renders.length,2);assert.equal(new Set(renders).size,1);
  game.user.isGM=true;await player.render(true);assert.equal(renders.length,2);
});

test('draft browsing omits absent optional values before strict JSON authoring validation',async()=>{
  const commands=[],model=new GraphEditorModel({registry:{listDrafts:async options=>{commands.push(normalizeGMAuthoringCommand('listDrafts',[options])[0]);return {items:[],nextCursor:null};}}});
  await model.listDrafts();await model.listDrafts({limit:12});await model.listDrafts({cursor:'0:0',limit:12});
  assert.deepEqual(commands,[{},{limit:12},{cursor:'0:0',limit:12}]);
  assert.throws(()=>normalizeGMAuthoringCommand('listDrafts',[{cursor:undefined,limit:12}]),{code:'GM_COMMAND_INVALID'});
});
