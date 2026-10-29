/** Portable graph structure with explicit external binding slots. Native and
 * campaign identifiers are removed, never silently rebound in another world.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {validateGraph} from './validate.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?`[${x.map(canonical).join(',')}]`:`{${Object.keys(x).sort().map(k=>`${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
export const templateDigest=data=>sha256Hex(canonical(data));
const native=/^(Actor|Item|JournalEntry|Scene|Combat|ChatMessage|RollTable|Cards|Playlist|Macro|Compendium)\.[A-Za-z0-9_.-]+$/;
const embedded=/(?:\b(?:Actor|Item|JournalEntry|Scene|Combat|ChatMessage|RollTable|Cards|Playlist|Macro|Compendium)\.[A-Za-z0-9_.-]+|ep:[a-z][a-z0-9-]*:[A-Za-z0-9_-]+)/;
const nativeKeys=new Set(['nativeId','previousNativeId','actorId','itemId','journalId','sceneId','combatId','messageId']);
const marker=id=>`ep:template-slot:${id}`;
const graphMarker=id=>`ep:graph:template_binding_${id}`;
const mapTree=(value,fn,path=[])=>{
 if(Array.isArray(value))return value.map((v,i)=>mapTree(v,fn,[...path,String(i)]));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>{if(embedded.test(k))fail('TEMPLATE_EMBEDDED_REFERENCE','Identifier keys need an explicit authoring adapter before portability');return [k,mapTree(v,fn,[...path,k])];}));
 return fn(value,path);
};
export async function createPortableTemplate(graph,{blueprintId,revision}={}){
 assertNarrativeId(blueprintId);if(!blueprintId.startsWith('ep:blueprint:')||!Number.isSafeInteger(revision)||revision<1)fail('TEMPLATE_ID','Versioned blueprint identity required');
 graph=clone(graph);validateGraph(graph,{requiredCapabilities:graph.requiredCapabilityIds??[]});
 const graphId=`ep:graph:portable_${(await sha256Hex(blueprintId)).slice(0,24)}`,internal=new Map([[graph.id,graphId]]),slots=[],byValue=new Map();
 graph.nodes.forEach((n,i)=>internal.set(n.id,`ep:node:portable_${String(i).padStart(6,'0')}`));graph.edges.forEach((e,i)=>internal.set(e.id,`ep:edge:portable_${String(i).padStart(6,'0')}`));
 const slot=(value,kind,label,extra={})=>{
  const key=JSON.stringify({kind,value,...extra});if(byValue.has(key))return byValue.get(key);
  if(slots.length>=64)fail('TEMPLATE_BINDING_BUDGET','At most 64 distinct external bindings per template');
  const id=`binding_${String(slots.length+1).padStart(3,'0')}`,placeholder=kind==='published-graph'?graphMarker(id):kind==='state-key'||kind==='scope'?`template-${id.replaceAll('_','-')}`:marker(id);
  slots.push({id,kind,placeholder,label:label.replace(new RegExp(embedded.source,'g'),'external reference').slice(0,100),...extra});byValue.set(key,placeholder);return placeholder;
 };
 const cleanValue=(value,path,node)=>{
  if(typeof value!=='string')return value;
  const key=path.at(-1),label=`${node?.label??'Graph'} · ${path.slice(-3).join('.')}`;
  if(internal.has(value))return internal.get(value);
  if(/^ep:[a-z][a-z0-9-]*:/.test(value)){assertNarrativeId(value);return slot(value,'narrative-id',label,{namespace:value.split(':')[1]});}
  const match=native.exec(value);if(match)return slot(value,'native-uuid',label,{documentKind:match[1]});
  if(embedded.test(value))fail('TEMPLATE_EMBEDDED_REFERENCE','Embedded world references need explicit cleanup before export');
  if(nativeKeys.has(key)&&value)return slot(value,'native-id',label);
  if(key==='scope')return slot(value,'scope',label);
  if(key==='key'&&(node?.typeId==='core.state.value'||node?.typeId==='core.state.read'||node?.data?.providerId==='narrative.set-state'))return slot(value,'state-key',label);
  return value;
 };
 const nodes=graph.nodes.map(node=>{
  const n=clone(node);
  // Child graphs are explicit local pinned dependencies, including completed
  // operation roots that happen to cite an older version of the same graph.
  const prepare=value=>{
   if(Array.isArray(value)){value.forEach(prepare);return;}
   if(!value||typeof value!=='object')return;
   for(const [key,versionKey] of [['graphId','publishedVersion'],['sourceGraphId','sourcePublishedVersion']])if(typeof value[key]==='string'&&Number.isSafeInteger(value[versionKey])){
    value[key]=slot(value[key],'published-graph',`${n.label??n.typeId} · ${key}`,{versionHint:value[versionKey]});value[versionKey]=1;
   }
   if(n.typeId==='core.trigger.operations-completed'&&Array.isArray(value.requiredNodeIds))value.requiredNodeIds=value.requiredNodeIds.map(id=>slot(id,'narrative-id',`${n.label} · source operation`,{namespace:'node'}));
   if(Object.hasOwn(value,'expectedRevision'))value.expectedRevision=null;
   Object.values(value).forEach(prepare);
  };
  prepare(n.data);
  // Slot placeholders are already sanitized and must not themselves become
  // external narrative dependencies in this second pass.
  return mapTree(n,(v,path)=>slots.some(s=>s.placeholder===v)?v:cleanValue(v,path,n));
 });
 const portable={id:graphId,kind:'graph',schemaVersion:'1.0.0',revision:0,partitionId:'template',title:cleanValue(graph.title??'Reusable plot',['title']),rootNodeId:internal.get(graph.rootNodeId),nodes,
  edges:mapTree(graph.edges,(v,path)=>cleanValue(v,path)),requiredCapabilityIds:clone(graph.requiredCapabilityIds??[])};
 const body={format:'easy-plots-graph-template',formatVersion:'1.0.0',blueprintId,revision,graph:portable,slots};
 return {...body,fingerprint:await templateDigest(body)};
}
export async function validatePortableTemplate(input){
 const value=clone(input);
 if(!value||Object.keys(value).some(k=>!['format','formatVersion','blueprintId','revision','graph','slots','fingerprint'].includes(k))||value.format!=='easy-plots-graph-template'||value.formatVersion!=='1.0.0'||!Number.isSafeInteger(value.revision)||value.revision<1||!Array.isArray(value.slots)||value.slots.length>64||new TextEncoder().encode(JSON.stringify(value)).length>850000)fail('TEMPLATE_CONTRACT','A bounded supported portable template is required');
 assertNarrativeId(value.blueprintId);if(!value.blueprintId.startsWith('ep:blueprint:'))fail('TEMPLATE_CONTRACT','Blueprint identity required');
 const {fingerprint,...body}=value;if(fingerprint!==await templateDigest(body))fail('TEMPLATE_FINGERPRINT','Portable structure differs from the reviewed fingerprint');
 const ids=new Set(),tokens=new Set();
 for(const slot of value.slots){
  if(!slot||Object.keys(slot).some(k=>!['id','kind','placeholder','label','namespace','documentKind','versionHint'].includes(k))||!/^binding_[0-9]{3}$/.test(slot.id??'')||!['narrative-id','native-uuid','native-id','published-graph','state-key','scope'].includes(slot.kind)||typeof slot.placeholder!=='string'||typeof slot.label!=='string'||slot.label.length>100||embedded.test(slot.label)||ids.has(slot.id)||tokens.has(slot.placeholder))fail('TEMPLATE_BINDING_CONTRACT','Invalid or duplicate template binding');
  const expected=slot.kind==='published-graph'?graphMarker(slot.id):['scope','state-key'].includes(slot.kind)?`template-${slot.id.replaceAll('_','-')}`:marker(slot.id);
  if(slot.placeholder!==expected||slot.kind==='published-graph'&&(!Number.isSafeInteger(slot.versionHint)||slot.versionHint<1)||slot.kind==='narrative-id'&&!/^[a-z][a-z0-9-]*$/.test(slot.namespace??'')||slot.kind==='native-uuid'&&!native.test(`${slot.documentKind}.placeholder`))fail('TEMPLATE_BINDING_CONTRACT','Binding marker or declared type differs');
  ids.add(slot.id);tokens.add(slot.placeholder);
 }
 const internal=new Set([value.graph?.id,...(value.graph?.nodes??[]).map(n=>n.id),...(value.graph?.edges??[]).map(e=>e.id)]),used=new Set();
 mapTree(value.graph,(v)=>{if(tokens.has(v)){used.add(v);return v;}if(typeof v==='string'&&embedded.test(v)&&!internal.has(v))fail('TEMPLATE_UNBOUND_REFERENCE','Portable graph contains an undeclared external reference');return v;});
 if(used.size!==tokens.size)fail('TEMPLATE_BINDING_CONTRACT','Every binding must name an actual structural dependency');
 validateGraph(value.graph,{requiredCapabilities:value.graph.requiredCapabilityIds??[]});return value;
}
export async function materializeTemplate(template,{instanceId,bindings={},title}={}){
 bindings=clone(bindings);template=await validatePortableTemplate(template);assertNarrativeId(instanceId);
 if(!instanceId.startsWith('ep:graph:')||!bindings||typeof bindings!=='object'||Array.isArray(bindings)||Object.keys(bindings).length!==template.slots.length||Object.keys(bindings).some(id=>!template.slots.some(s=>s.id===id)))fail('TEMPLATE_BINDING_REQUIRED','One explicit binding for every external dependency is required');
 const replacements=new Map(),versions=new Map();
 for(const slot of template.slots){
  const value=bindings[slot.id];let resolved=value;
  if(slot.kind==='published-graph'){
   if(!value||Object.keys(value).some(k=>!['graphId','publishedVersion'].includes(k))||typeof value.graphId!=='string'||!value.graphId.startsWith('ep:graph:')||!Number.isSafeInteger(value.publishedVersion)||value.publishedVersion<1)fail('TEMPLATE_BINDING_TYPE','A pinned local graph binding is required');
   assertNarrativeId(value.graphId);resolved=value.graphId;versions.set(slot.placeholder,value.publishedVersion);
  }else if(slot.kind==='narrative-id'){assertNarrativeId(value);if(value.split(':')[1]!==slot.namespace)fail('TEMPLATE_BINDING_TYPE','Narrative binding namespace differs');}
  else if(slot.kind==='native-uuid'){const match=typeof value==='string'&&native.exec(value);if(!match||match[1]!==slot.documentKind)fail('TEMPLATE_BINDING_TYPE','Native UUID kind differs');}
  else if(slot.kind==='native-id'&&(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(value))||slot.kind==='scope'&&(typeof value!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(value))||slot.kind==='state-key'&&(typeof value!=='string'||!/^[A-Za-z][A-Za-z0-9_.:-]{0,110}$/.test(value)))fail('TEMPLATE_BINDING_TYPE','Invalid explicit native ID, narrative scope or state key');
  replacements.set(slot.placeholder,resolved);
 }
 const internal=new Map([[template.graph.id,instanceId]]);
 for(const [kind,items] of [['node',template.graph.nodes],['edge',template.graph.edges]])for(const item of items)internal.set(item.id,`ep:${kind}:${(await sha256Hex(`${instanceId}|${item.id}`)).slice(0,28)}`);
 const apply=value=>{
  if(Array.isArray(value))return value.map(apply);
  if(value&&typeof value==='object'){
   const out=Object.fromEntries(Object.entries(value).map(([key,v])=>[key,apply(v)]));
   for(const [key,versionKey] of [['graphId','publishedVersion'],['sourceGraphId','sourcePublishedVersion']])if(versions.has(value[key]))out[versionKey]=versions.get(value[key]);return out;
  }
  return replacements.has(value)?replacements.get(value):internal.has(value)?internal.get(value):value;
 };
 const graph=apply(template.graph);graph.partitionId='arc-main';graph.revision=0;
 if(title!==undefined){if(typeof title!=='string'||!title.trim()||title.length>120)fail('TEMPLATE_TITLE','Bounded instance title required');graph.title=title.trim();}
 graph.templateSource={blueprintId:template.blueprintId,revision:template.revision,fingerprint:template.fingerprint};
 validateGraph(graph,{requiredCapabilities:graph.requiredCapabilityIds??[]});return graph;
}
