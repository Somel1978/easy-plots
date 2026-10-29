/** Authoring discovery metadata. Suggestions never grant capabilities or connect steps. */
import {ALL_EFFECT_NODE_PROVIDER} from '../graph/node-catalog.mjs';

export const STEP_CATEGORIES=Object.freeze([
 {id:'flow',label:'Flow and decisions',description:'Conditions, branches and joining story paths.'},
 {id:'values',label:'Values and rolls',description:'Read, compare and pass information between steps.'},
 {id:'people',label:'People and factions',description:'Characters, identities, factions and relationships.'},
 {id:'knowledge',label:'Knowledge and investigations',description:'Evidence, theories, beliefs and sharing information.'},
 {id:'quests',label:'Quests and milestones',description:'Objectives, opportunities and story progress.'},
 {id:'time',label:'Time and pressure',description:'Schedules, deadlines and clocks.'},
 {id:'places',label:'Places and travel',description:'Locations, discoveries and known routes.'},
 {id:'resources',label:'Foundry resources',description:'Documents, bindings and reviewed resource actions.'},
 {id:'continuity',label:'Campaign and continuity',description:'Arcs, sessions, recaps and timelines.'},
 {id:'extensions',label:'Extensions',description:'Additional step types registered by installed providers.'}
]);
const readable=text=>String(text).replace(/^core\./,'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[._-]/g,' ').replace(/\s*·\s*/g,' ').replace(/\s+/g,' ').replace(/^./,c=>c.toUpperCase());
export function stepCategory(id){
 if(!id.startsWith('core.'))return 'extensions';
 if(/^core\.(data\.|roll\.|state\.|subgraph\.)/.test(id))return 'values';
 if(/resource|provenance|blueprint/.test(id))return 'resources';
 if(/(?:^|\.)(?:time|pressure|deadline)(?:\.|$)|after-time|before-time|world-time|clock/.test(id))return 'time';
 if(/location|route/.test(id))return 'places';
 if(/faction|npc|relationship|obligation|social-debt|reputation|identity|gate.actor/.test(id))return 'people';
 if(/knowledge|investigation|evidence|disclosure|hypothesis|player-contribution|world.fact|notification/.test(id))return 'knowledge';
 if(/quest|milestone|story.hook/.test(id))return 'quests';
 if(/arc|campaign|session|continuity|timeline/.test(id))return 'continuity';
 return 'flow';
}
const descriptions={
 'core.condition':'Continue along a path only when its condition is met.',
 'core.branch.condition':'Choose a true or false path after checking a condition.',
 'core.flow.join':'Wait for configured incoming paths before continuing.',
 'core.branch.parallel':'Start multiple configured story paths from one event.',
 'core.effect.proposal':'Propose a narrative consequence for a separate GM decision.',
 'core.state.read':'Read recorded narrative state and choose a matching path.',
 'core.data.literal':'Provide a typed value that other steps can use.',
 'core.data.compare':'Compare typed values and produce a yes/no result.',
 'core.data.event':'Read a value from the event that started this flow.',
 'core.roll.value':'Read an already verified mechanical roll.',
 'core.subgraph.call':'Call a specific published plot as part of this flow.'
};
export function stepCatalog(types){
 const seen=new Set();return types.filter(t=>!t.id.startsWith('core.trigger.')).map(type=>{
  if(seen.has(type.id))throw Error('Duplicate authoring step type');seen.add(type.id);
  const category=stepCategory(type.id),label=readable(type.label??type.id),effect=type.id==='core.effect.proposal'||Object.hasOwn(ALL_EFFECT_NODE_PROVIDER,type.id);
  const description=descriptions[type.id]??(effect?`${label}. Creates a proposal for GM review.`:type.id.startsWith('core.gate.')?`Continue only when the configured ${label.toLowerCase().replace(/^gate /,'')} check passes.`:STEP_CATEGORIES.find(c=>c.id===category).description);
  return {id:type.id,label,category,description,effect};
 });
}
export function discoverSteps(catalog,{category='recommended',query='',selectedType=null,page=0,pageSize=8}={}){
 if(!Number.isInteger(page)||page<0||!Number.isInteger(pageSize)||pageSize<1||pageSize>12)throw Error('A bounded step-library page is required');
 const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
 const words=normalize(query.trim()).split(/\s+/).filter(Boolean);
 let matches=catalog;
 if(category==='recommended'&&!words.length){
  const related=selectedType&&!selectedType.startsWith('core.trigger.')?stepCategory(selectedType):'flow';
  const ids=related==='values'?['core.data.event','core.data.literal','core.data.compare','core.state.value','core.branch.data']:['core.condition','core.branch.condition','core.effect.proposal','core.state.read'];
  const extra=catalog.filter(s=>s.category===related&&!ids.includes(s.id)).slice(0,4).map(s=>s.id);
  const order=[...ids,...extra];matches=order.map(id=>catalog.find(s=>s.id===id)).filter(Boolean);
 }else if(category!=='recommended')matches=catalog.filter(s=>s.category===category);
 if(words.length)matches=matches.filter(s=>{const text=normalize(`${s.label} ${s.description} ${s.id} ${s.category}`);return words.every(w=>text.includes(w));});
 const total=matches.length,pages=Math.ceil(total/pageSize),safePage=Math.min(page,Math.max(0,pages-1));
 return {items:matches.slice(safePage*pageSize,(safePage+1)*pageSize),total,page:safePage,pages};
}
