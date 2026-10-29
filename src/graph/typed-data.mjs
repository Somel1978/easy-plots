/** Bounded, GM-private values. Data links never schedule narrative flow. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {validateRollInput} from '../runtime/roll-input.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export const DATA_CALL_TYPES=Object.freeze(['core.data.call','core.subgraph.mixed']);
export const DATA_NODE_TYPES=Object.freeze(['core.data.literal','core.state.value','core.roll.value','core.data.parameter','core.data.export',...DATA_CALL_TYPES,'core.data.compare','core.data.event']);
export const VALUE_TYPES=Object.freeze(['json','string','number','boolean','entity']);
const unsafe=new Set(['__proto__','prototype','constructor']);
export const safeDataKey=key=>typeof key==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key)&&!unsafe.has(key);
export function boundedValue(value,type='json'){
  if(!VALUE_TYPES.includes(type))fail('DATA_TYPE','Unknown data value type');
  let count=0;
  const visit=(v,depth)=>{
    if(depth>8||++count>512)fail('DATA_BUDGET','Value exceeds depth or entry budget');
    if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
    if(Array.isArray(v)&&v.length<=64)return v.map(x=>visit(x,depth+1));
    if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype){
      const keys=Object.keys(v).sort();
      if(keys.length>64||keys.some(k=>unsafe.has(k)))fail('DATA_VALUE','Unsafe object key');
      return Object.fromEntries(keys.map(k=>[k,visit(v[k],depth+1)]));
    }
    fail('DATA_VALUE','Value must contain finite, bounded plain JSON');
  };
  const result=visit(value,0);
  if(new TextEncoder().encode(JSON.stringify(result)).length>2048)fail('DATA_BUDGET','Value exceeds byte budget');
  if(type!=='json'&&(type==='entity'?typeof result!=='string':typeof result!==type))fail('DATA_TYPE','Value does not match its declared type');
  if(type==='entity')assertNarrativeId(result);
  return result;
}
export function dataNodePorts(typeId,valueType,data={}){
  const p=(id,direction,type)=>({id,direction,valueType:type,accessClass:'gm-secret'});
  if(DATA_CALL_TYPES.includes(typeId))return [...(typeId==='core.subgraph.mixed'?[p('in','input','event'),p('out','output','event')]:[]),...(data.inputs??[]).map(x=>p(`param-${x.name}`,'input',x.valueType)),...(data.outputs??[]).map(x=>p(`result-${x.name}`,'output',x.valueType))];
  if(typeId==='core.data.export')return [p('input','input',valueType),p('value','output',valueType)];
  if(typeId==='core.data.compare')return [p('left','input',data.operandType),p('right','input',data.operandType),p('value','output','boolean')];
  return [...(typeId==='core.state.value'?[p('entity','input','entity')]:[]),p('value','output',valueType)];
}
export const DATA_NODE_DEFAULTS=Object.freeze({
  'core.data.literal':{valueType:'boolean',value:true},
  'core.state.value':{scope:'world',key:'clue-found',valueType:'boolean',expectedRevision:null},
  'core.roll.value':{rollKind:'d20',attemptId:'ep:attempt:example_roll001',expectedRevision:2,side:'self',field:'total',valueType:'number'},
  'core.data.parameter':{name:'input',valueType:'boolean'},
  'core.data.export':{name:'output',valueType:'boolean'},
  'core.data.call':{graphId:'ep:graph:data_library001',publishedVersion:1,inputs:[{name:'input',valueType:'boolean'}],outputs:[{name:'output',valueType:'boolean'}]},
  'core.subgraph.mixed':{graphId:'ep:graph:mixed_library001',publishedVersion:1,inputs:[{name:'input',valueType:'boolean'}],outputs:[{name:'output',valueType:'boolean'}]},
  'core.data.compare':{valueType:'boolean',operandType:'number',operator:'gte'},
  'core.data.event':{valueType:'boolean',path:['payload','verified']}
});
export function validateDataInterface(entries){
  if(!Array.isArray(entries)||entries.length>16)fail('DATA_INTERFACE','Subgraph interface exceeds bounded arity');
  const names=new Set();
  for(const e of entries){
    if(!e||typeof e!=='object'||Object.keys(e).sort().join(',')!=='name,valueType'||!safeDataKey(e.name)||!VALUE_TYPES.includes(e.valueType)||names.has(e.name))fail('DATA_INTERFACE','Interface names and value types must be unique and valid');
    names.add(e.name);
  }
  return entries;
}
export function publishedDataInterface(graph){
  const list=type=>graph.nodes.filter(n=>n.typeId===type&&!n.disabled).map(n=>({name:n.data.name,valueType:n.data.valueType})).sort((a,b)=>a.name.localeCompare(b.name));
  const inputs=list('core.data.parameter'),outputs=list('core.data.export');
  validateDataInterface(inputs);validateDataInterface(outputs);return {inputs,outputs};
}
export function assertPublishedDataInterface(call,child){
  if(!child||child.id!==call.data.graphId||child.publishedVersion!==call.data.publishedVersion)fail('SUBGRAPH_UNAVAILABLE','Pinned data subgraph is unavailable');
  const actual=publishedDataInterface(child),sort=x=>[...x].sort((a,b)=>a.name.localeCompare(b.name));
  if(JSON.stringify(actual)!==JSON.stringify({inputs:sort(call.data.inputs),outputs:sort(call.data.outputs)}))fail('DATA_INTERFACE_STALE','Pinned child interface differs from the authored call manifest');
  return actual;
}
export function validateDataNode(node){
  const d=node.data;
  if(!DATA_NODE_TYPES.includes(node.typeId)||!d||typeof d!=='object'||Array.isArray(d)||node.accessClass!=='gm-secret')fail('DATA_CONTRACT','Data nodes require a protected typed contract');
  if(!DATA_CALL_TYPES.includes(node.typeId)&&!VALUE_TYPES.includes(d.valueType))fail('DATA_TYPE','Unsupported output type');
  const keys=node.typeId==='core.roll.value'?['rollKind','attemptId','expectedRevision','side','field','valueType']:node.typeId==='core.data.event'?['valueType','path']:node.typeId==='core.data.compare'?['valueType','operandType','operator']:node.typeId==='core.data.literal'?['valueType','value']:DATA_CALL_TYPES.includes(node.typeId)?['graphId','publishedVersion','inputs','outputs']:['core.data.parameter','core.data.export'].includes(node.typeId)?['name','valueType']:['scope','key','valueType','expectedRevision'];
  if(Object.keys(d).some(k=>!keys.includes(k)))fail('DATA_CONTRACT','Unexpected data-node field');
  if(node.typeId==='core.data.literal')boundedValue(d.value,d.valueType);
  else if(node.typeId==='core.roll.value'){
    validateRollInput(d);if(d.valueType!==(d.field==='total'?'number':'string'))fail('DATA_TYPE','Mechanical field must match its exact output type');
  }else if(node.typeId==='core.data.event'){
    if(!Array.isArray(d.path)||!d.path.length||d.path.length>8||!['id','eventType','payload','source'].includes(d.path[0])||d.path.some(k=>typeof k!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(k)||unsafe.has(k)))fail('DATA_EVENT_PATH','A safe bounded canonical-event path is required');
  }else if(node.typeId==='core.data.compare'){
    if(d.valueType!=='boolean'||!VALUE_TYPES.includes(d.operandType)||!['eq','neq','gt','gte','lt','lte','contains'].includes(d.operator))fail('DATA_COMPARISON','Typed comparison requires an explicit supported operator');
    if(['gt','gte','lt','lte'].includes(d.operator)&&d.operandType!=='number'||d.operator==='contains'&&d.operandType!=='string')fail('DATA_COMPARISON','Comparison operator does not match its operand type');
  }else if(DATA_CALL_TYPES.includes(node.typeId)){
    assertNarrativeId(d.graphId);
    if(!d.graphId.startsWith('ep:graph:')||!Number.isSafeInteger(d.publishedVersion)||d.publishedVersion<1)fail('DATA_INTERFACE','An immutable child graph revision is required');
    if(d.graphId===node.graphId)fail('SUBGRAPH_RECURSION','Data calls cannot invoke their own graph');
    validateDataInterface(d.inputs);validateDataInterface(d.outputs);
    if(node.typeId==='core.data.call'&&!d.outputs.length)fail('DATA_INTERFACE','Pure data call requires an exported value');
  }else if(['core.data.parameter','core.data.export'].includes(node.typeId)){
    if(!safeDataKey(d.name))fail('DATA_INTERFACE','A safe parameter or export name is required');
  }else{
    if(typeof d.scope!=='string'||!/^[a-z][a-z0-9-]{0,50}$/.test(d.scope)||typeof d.key!=='string'||!/^[a-zA-Z][a-zA-Z0-9_.:-]{0,110}$/.test(d.key)||unsafe.has(d.key))fail('DATA_LOCATOR','Invalid protected state locator');
    if(d.expectedRevision!==null&&(!Number.isSafeInteger(d.expectedRevision)||d.expectedRevision<1))fail('DATA_REVISION','State read requires a positive revision or explicit null');
  }
  const ports=dataNodePorts(node.typeId,d.valueType,d);
  if(!Array.isArray(node.ports)||node.ports.length!==ports.length||ports.some(p=>!node.ports.some(q=>Object.keys(p).every(k=>q[k]===p[k]))))fail('DATA_PORTS','Data ports must match the typed protected node contract');
  return true;
}
export function branchDataPorts(){return [
  {id:'in',direction:'input',valueType:'event',accessClass:'gm-secret'},
  {id:'predicate',direction:'input',valueType:'boolean',accessClass:'gm-secret'},
  {id:'true',direction:'output',valueType:'event',accessClass:'gm-secret'},
  {id:'false',direction:'output',valueType:'event',accessClass:'gm-secret'}
];}
export function validateDataBranch(node){
  if(node.typeId!=='core.branch.data'||node.accessClass!=='gm-secret'||!node.data||typeof node.data!=='object'||Array.isArray(node.data)||Object.keys(node.data).length)fail('DATA_BRANCH','Typed branch requires a protected, parameter-free contract');
  const ports=branchDataPorts();
  if(node.ports?.length!==ports.length||ports.some(p=>!node.ports.some(q=>Object.keys(p).every(k=>q[k]===p[k]))))fail('DATA_BRANCH','Typed branch requires boolean input and explicit true/false outputs');
}
export function validateInputBindings(node){
  const bindings=node.data?.inputBindings;
  if(bindings===undefined)return;
  if(!bindings||typeof bindings!=='object'||Array.isArray(bindings)||Object.keys(bindings).length>16)fail('DATA_BINDING','Invalid bounded payload bindings');
  for(const [field,inputId] of Object.entries(bindings)){
    if(!safeDataKey(field)||!Object.hasOwn(node.data.payload??{},field)||typeof inputId!=='string')fail('DATA_BINDING','Binding requires an existing safe payload field');
    const port=node.ports.find(p=>p.id===inputId&&p.direction==='input');
    if(!port||!VALUE_TYPES.includes(port.valueType)||port.accessClass!=='gm-secret'||node.accessClass!=='gm-secret')fail('DATA_BINDING','Bound payload inputs must remain GM-private and typed');
  }
}
