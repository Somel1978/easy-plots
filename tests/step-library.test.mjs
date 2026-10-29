import test from 'node:test';
import assert from 'node:assert/strict';
import {EDITABLE_NODE_TYPES} from '../src/editor/model.mjs';
import {STEP_CATEGORIES,stepCatalog,discoverSteps} from '../src/editor/step-library.mjs';
import {readPlotPage} from '../src/ui/plot-list.mjs';

test('every authorable non-trigger step has one category and all steps remain discoverable',()=>{
 const catalog=stepCatalog(EDITABLE_NODE_TYPES),expected=EDITABLE_NODE_TYPES.filter(t=>!t.id.startsWith('core.trigger.'));
 assert.equal(catalog.length,expected.length);const discovered=[];
 for(const category of STEP_CATEGORIES){let page=0,result;do{result=discoverSteps(catalog,{category:category.id,page});assert(result.items.length<=8);discovered.push(...result.items.map(s=>s.id));page++;}while(page<result.pages);}
 assert.deepEqual(discovered.sort(),expected.map(s=>s.id).sort());assert.equal(new Set(discovered).size,expected.length);
});
test('related suggestions change with a value step and searching related steps searches the whole catalog',()=>{
 const catalog=stepCatalog(EDITABLE_NODE_TYPES),start=discoverSteps(catalog,{selectedType:'core.trigger.manual'}),data=discoverSteps(catalog,{selectedType:'core.data.literal'});
 assert(start.items.some(s=>s.id==='core.condition'));assert(data.items.some(s=>s.id==='core.data.compare'));assert.notDeepEqual(start.items,data.items);
 assert(discoverSteps(catalog,{query:'materialize journal'}).items.some(s=>s.id==='core.resource.materialize-journal'));
 assert.equal(discoverSteps(catalog,{category:'places',query:'materialize journal'}).total,0);
});
test('extensions stay discoverable and consequence descriptions accurately identify proposals',()=>{
 const catalog=stepCatalog([...EDITABLE_NODE_TYPES,{id:'thirdparty.knowledge',label:'Custom provider'}]);
 assert.equal(catalog.find(s=>s.id==='thirdparty.knowledge').category,'extensions');
 assert.match(catalog.find(s=>s.id==='core.faction.standing').description,/proposal for GM review/);
 assert.equal(discoverSteps(catalog,{query:'impossible-no-such-step'}).total,0);
});
test('plot browsing follows empty storage pages and never presents a false empty first page',async()=>{
 const calls=[],pages={'0:0':{items:[],nextCursor:'1:0'},'1:0':{items:[{id:'saved-plot',title:'Saved story'}],nextCursor:'2:0'},'2:0':{items:[],nextCursor:null}};
 const result=await readPlotPage(async opts=>{calls.push(opts);return pages[opts.cursor];});
 assert.deepEqual(result.items,[{id:'saved-plot',title:'Saved story'}]);assert.equal(result.complete,true);assert.deepEqual(calls.map(c=>c.cursor),['0:0','1:0','2:0']);
});
test('plot browsing remains bounded, exposes incomplete discovery and detects a repeated cursor',async()=>{
 let reads=0;const result=await readPlotPage(async()=>({items:[],nextCursor:String(++reads)}),{pageBudget:2});assert.equal(reads,2);assert.equal(result.complete,false);assert.equal(result.nextCursor,'2');
 await assert.rejects(readPlotPage(async()=>({items:[],nextCursor:'0:0'})),/repeated a page/);
});
