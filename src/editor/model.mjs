import {validateConvergenceCycles} from '../graph/convergence.mjs';
/** Portable editor state. No Foundry DOM dependency; testable via Node. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {clone,assertNarrativeId} from '../contracts/record.mjs';
import {validateGraph} from '../graph/validate.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {ALL_EFFECT_NODE_PROVIDER,DOMAIN_NODE_DEFAULTS} from '../graph/node-catalog.mjs';
import {LOGIC_NODE_CONFIG,LOGIC_NODE_TYPES,validateLogicNode} from '../graph/logic-nodes.mjs';
import {validateSubgraphCall} from '../graph/subgraph-call.mjs';
import {validateFlowJoin} from '../graph/flow-join.mjs';
import {STATE_READ_TYPE,STATE_READ_DEFAULT,validateStateRead} from '../graph/state-read.mjs';
import {validateEventTrigger,isTriggerNode} from '../graph/trigger-contract.mjs';
import {DATA_NODE_TYPES,DATA_NODE_DEFAULTS,dataNodePorts,validateDataNode,safeDataKey,branchDataPorts} from '../graph/typed-data.mjs';

const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const uid=type=>{
  return `ep:${type}:${secureUUID().replaceAll('-','_')}`;
};
const gridPosition=index=>({x:60+(index%4)*215,y:95+Math.floor(index/4)*115});
const port=(id,direction)=>({id,direction,valueType:'event',accessClass:'gm'});
const types={
  'core.trigger.event':{label:'Event trigger',ports:[port('out','output')],data:{eventType:'evidence.discovered',sourceKinds:[]}},
  'core.trigger.manual':{label:'GM manual event trigger',ports:[port('out','output')],data:{eventType:'narrative.manual',sourceKinds:['gm-approved-intent']}},
  'core.trigger.schedule-due':{label:'Verified due-commitment trigger',ports:[port('out','output')],data:{eventType:'narrative.schedule-due',sourceKinds:['gm-approved-intent']}},
  'core.trigger.document-event':{label:'Native document Hook trigger',ports:[port('out','output')],data:{eventType:'foundry.actor.updated',sourceKinds:['native-hook']}},
  'core.trigger.operations-completed':{label:'After verified completed operations',ports:[port('out','output')],data:{eventType:'narrative.operations-completed',sourceKinds:['gm-approved-intent'],sourceGraphId:'ep:graph:source_example001',sourcePublishedVersion:1,requiredNodeIds:['ep:node:source_example001']}},
  'core.trigger.reviewed-plan':{label:'Reviewed planning intent',ports:[port('out','output')],data:{eventType:'narrative.reviewed-plan',sourceKinds:['gm-approved-intent']}},
  'core.trigger.encounter-closed':{label:'Selected verified encounter closure',ports:[port('out','output')],data:{eventType:'narrative.encounter-closed',sourceKinds:['gm-approved-intent']}},
  'core.trigger.resource-activation':{label:'Reviewed resource activation',ports:[port('out','output')],data:{eventType:'narrative.resource-activation-reviewed',sourceKinds:['gm-approved-intent']}},
  'core.condition':{label:'Condition',ports:[port('in','input'),port('out','output')],data:{condition:{op:'compare',operator:'eq',left:{type:'reference',path:['event','verified'],requiredPermission:'gm'},right:{type:'literal',value:true}}}},
  'core.branch.condition':{label:'True / False branch',ports:[port('in','input'),port('true','output'),port('false','output')],data:{condition:{op:'compare',operator:'eq',left:{type:'reference',path:['event','verified'],requiredPermission:'gm'},right:{type:'literal',value:true}}}},
  'core.branch.data':{label:'Branch on typed boolean',ports:branchDataPorts(),data:{}},
  'core.milestone.qualify':{label:'Qualify milestone',ports:[port('in','input')],data:{milestoneId:'ep:milestone:example_001'}},
  'core.state.read':{label:'Read authoritative narrative state',ports:[port('in','input'),port('match','output'),port('mismatch','output'),port('absent','output')],data:clone(STATE_READ_DEFAULT)},
  'core.flow.join':{label:'Join incoming flow (all/any)',ports:[port('in','input'),port('out','output')],data:{mode:'all'}},
  'core.subgraph.call':{label:'Published subgraph call',ports:[port('in','input'),port('out','output')],data:{graphId:'ep:graph:example_001',publishedVersion:1}},
  'core.effect.proposal':{label:'Effect proposal',ports:[port('in','input')],data:{providerId:'narrative.set-state',payload:{key:'clue-found',value:true}}},
  'core.faction.standing':{label:'Faction standing change',ports:[port('in','input')],data:{payload:{factionId:'ep:faction:example_001',actorId:'ep:actor:example_001',dimension:'reputation',delta:1}}},
  'core.obligation.resolve':{label:'Resolve obligation',ports:[port('in','input')],data:{payload:{obligationId:'ep:obligation:example_001',debtorId:'ep:faction:example_001',creditorId:'ep:actor:example_001',outcome:'fulfilled'}}},
  'core.investigation.attest-evidence':{label:'Attest evidence',ports:[port('in','input')],data:{payload:{evidenceId:'ep:evidence:example_001',investigationId:'ep:investigation:example_001',factId:'manifest-proven'}}}
};
for(const [id,providerId] of Object.entries(ALL_EFFECT_NODE_PROVIDER)){
  if(types[id])continue;
  types[id]={label:id.replace('core.','').replaceAll('.',' · '),ports:[port('in','input')],data:{providerId,payload:clone(DOMAIN_NODE_DEFAULTS[id])}};
}
for(const typeId of LOGIC_NODE_TYPES){
  const def=LOGIC_NODE_CONFIG[typeId];
  types[typeId]={label:def.label,ports:[port('in','input'),...def.outputs.map(id=>port(id,'output'))],data:clone(def.data)};
}
for(const typeId of DATA_NODE_TYPES)types[typeId]={label:({'core.roll.value':'Read verified mechanical roll','core.state.value':'Read typed state value','core.data.literal':'Typed constant','core.data.parameter':'Subgraph input','core.data.export':'Subgraph output','core.data.call':'Typed subgraph call','core.subgraph.mixed':'Subgraph with values and effect proposals','core.data.compare':'Compare typed values','core.data.event':'Read canonical event value'})[typeId],
  ports:dataNodePorts(typeId,DATA_NODE_DEFAULTS[typeId].valueType,DATA_NODE_DEFAULTS[typeId]),data:clone(DATA_NODE_DEFAULTS[typeId])};
export const EDITABLE_NODE_TYPES=Object.freeze(Object.entries(types).map(([id,v])=>({id,label:v.label})));
function safeTitle(v){
  if(typeof v!=='string'||v.trim().length<2||v.length>100)fail('INVALID_TITLE','Plot title must be 2–100 characters');
  return v.trim();
}
const node=(graphId,typeId,index)=>{
  const spec=types[typeId];if(!spec)fail('UNKNOWN_NODE_TYPE','Unsupported editor node type');
  const data=clone(spec.data);
  if(['core.resource.materialize-journal','core.resource.materialize-actor',
      'core.resource.materialize-item','core.resource.bind-native'].includes(typeId))
    data.payload.sourceGraphId=graphId;
  return {id:uid('node'),graphId,typeId,accessClass:DATA_NODE_TYPES.includes(typeId)||typeId==='core.branch.data'?'gm-secret':'gm',ports:clone(spec.ports),data,layout:gridPosition(index)};
};
export function makeEditableGraph({title='Untitled Plot',partitionId='arc-main'}={}){
  const graphId=uid('graph');const root=node(graphId,'core.trigger.event',0);
  return {id:graphId,kind:'graph',schemaVersion:'1.0.0',revision:0,partitionId,
    title:safeTitle(title),rootNodeId:root.id,nodes:[root],edges:[],requiredCapabilityIds:[]};
}
export class GraphEditorModel {
  #registry;#graph=null;#dirty=false;#selected=null;#mode;#extensions;
  #view={layer:'all',density:'comfortable',nodeLayers:{},expandedNodeIds:[],collapsedNodeIds:[]};
  constructor({registry,mode='sandbox',extensions=null}){this.#extensions=extensions;if(!registry)fail('REGISTRY_REQUIRED','Graph editor requires registry');this.#registry=registry;this.#mode=mode;}
  get state(){return Object.freeze({graph:clone(this.#graph),dirty:this.#dirty,selectedNodeId:this.#selected,mode:this.#mode,view:clone(this.#view),authoringRights:this.#registry.authoringRights?.(this.#graph?.id)??{edit:true,publish:true,activate:true}});}
  setViewLayer(layer){if(!['all','narrative','execution','knowledge'].includes(layer))fail('VIEW_LAYER','Unknown narrative view layer');this.#view.layer=layer;}
  setViewDensity(density){if(!['compact','comfortable','expanded'].includes(density))fail('VIEW_DENSITY','Unknown node density');this.#view.density=density;this.#view.expandedNodeIds=[];this.#view.collapsedNodeIds=[];}
  isNodeExpanded(id){return this.#view.expandedNodeIds.includes(id)||this.#view.density==='expanded'&&!this.#view.collapsedNodeIds.includes(id);}
  nodeLayer(node){return this.#view.nodeLayers[node.id]??(/knowledge|investigation|evidence|disclosure/.test(node.typeId)?'knowledge':Object.hasOwn(ALL_EFFECT_NODE_PROVIDER,node.typeId)||['core.milestone.qualify','core.effect.proposal'].includes(node.typeId)?'narrative':'execution');}
  setNodeViewLayer(id,layer){
    if(!this.#graph?.nodes.some(n=>n.id===id))fail('UNKNOWN_NODE','Node not found');
    if(!['narrative','execution','knowledge'].includes(layer))fail('VIEW_LAYER','Choose a concrete node view layer');
    this.#view.nodeLayers[id]=layer;
  }
  toggleNodeExpansion(id){
    if(!this.#graph?.nodes.some(n=>n.id===id))fail('UNKNOWN_NODE','Node not found');
    const expanded=new Set(this.#view.expandedNodeIds),collapsed=new Set(this.#view.collapsedNodeIds);
    if(this.isNodeExpanded(id)){expanded.delete(id);collapsed.add(id);}else{expanded.add(id);collapsed.delete(id);}
    this.#view.expandedNodeIds=[...expanded];this.#view.collapsedNodeIds=[...collapsed];
  }
  get viewGraph(){
    if(!this.#graph)return null;
    const graph=clone(this.#graph),nodes=graph.nodes.filter(n=>this.#view.layer==='all'||this.nodeLayer(n)===this.#view.layer),ids=new Set(nodes.map(n=>n.id));
    const edges=graph.edges.filter(e=>ids.has(e.source.nodeId)&&ids.has(e.target.nodeId));
    return {...graph,nodes,edges,hiddenNodeCount:graph.nodes.length-nodes.length,
      boundaryEdgeCount:graph.edges.filter(e=>ids.has(e.source.nodeId)!==ids.has(e.target.nodeId)).length};
  }
  get graph(){return clone(this.#graph);}
  get mode(){return this.#mode;}
  get selectedNode(){return clone(this.#graph?.nodes.find(n=>n.id===this.#selected)??null);}
  #mutate(fn){if(!this.#graph)fail('NO_GRAPH','Create or load a plot first');this.#registry.assertLocalAuthoring?.(this.#graph.id,'edit');const candidate=clone(this.#graph);const value=fn(candidate);this.#graph=candidate;this.#dirty=true;return value;}
  newGraph(title='Untitled Plot'){
    this.#view={...this.#view,layer:'all',nodeLayers:{},expandedNodeIds:[],collapsedNodeIds:[]};
    this.#graph=makeEditableGraph({title});this.#dirty=true;this.#selected=this.#graph.rootNodeId;return this.graph;
  }
  async load(graphId){
    assertNarrativeId(graphId);
    if(this.#dirty)fail('UNSAVED_CHANGES','Save the draft or deliberately discard changes before loading another');
    const graph=await this.#registry.getDraft(graphId);
    if(!graph)fail('NOT_FOUND','Plot draft was not found');
    this.#view={...this.#view,layer:'all',nodeLayers:{},expandedNodeIds:[],collapsedNodeIds:[]};
    this.#graph=graph;this.#dirty=false;this.#selected=graph.rootNodeId;return this.graph;
  }
  discardUnsaved(){this.#graph=null;this.#dirty=false;this.#selected=null;this.#view={...this.#view,layer:'all',nodeLayers:{},expandedNodeIds:[],collapsedNodeIds:[]};}
  rename(title){this.#mutate(g=>{g.title=safeTitle(title);});return this.graph;}
  selectNode(id){if(!this.#graph?.nodes.some(n=>n.id===id))fail('UNKNOWN_NODE','Node not found');this.#selected=id;}
  availableNodeTypes(){return [...EDITABLE_NODE_TYPES,...(this.#extensions?.list()??[])];}
  addNode(typeId){const next=this.#mutate(g=>{let n;
    const provider=this.#extensions?.get(typeId);
    if(provider){n={id:uid('node'),graphId:g.id,typeId,providerVersion:provider.version,accessClass:'gm',
      ports:clone(provider.ports),data:clone(provider.defaultData),layout:gridPosition(g.nodes.length)};}
    else n=node(g.id,typeId,g.nodes.length);
    g.nodes.push(n);return n.id;});this.#selected=next;return next;}
  setRootTriggerType(typeId){
    if(!['core.trigger.event','core.trigger.manual','core.trigger.schedule-due','core.trigger.document-event','core.trigger.operations-completed','core.trigger.reviewed-plan','core.trigger.encounter-closed','core.trigger.resource-activation'].includes(typeId))
      fail('INVALID_TRIGGER','Root can only use a built-in event-source trigger');
    this.#mutate(g=>{
      const root=g.nodes.find(n=>n.id===g.rootNodeId);
      if(!root)fail('INVALID_ROOT','Root trigger missing');
      const def=types[typeId];root.typeId=typeId;root.data=clone(def.data);root.ports=clone(def.ports);
    });
    this.#selected=this.#graph.rootNodeId;
    return this.selectedNode;
  }
  moveNode(id,{x,y}={}){
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>15000||y>30000)fail('INVALID_POSITION','Node position must stay within the bounded canvas');
    this.#mutate(g=>{const n=g.nodes.find(n=>n.id===id);if(!n)fail('UNKNOWN_NODE','Node not found');n.layout={x:Math.round(x),y:Math.round(y)};});
  }
  removeNode(id){this.#mutate(g=>{
    if(id===g.rootNodeId)fail('ROOT_REQUIRED','Root trigger cannot be removed');
    if(!g.nodes.some(n=>n.id===id))fail('UNKNOWN_NODE','Node not found');
    g.nodes=g.nodes.filter(n=>n.id!==id);
    g.edges=g.edges.filter(e=>e.source.nodeId!==id&&e.target.nodeId!==id);
  });this.#selected=this.#graph.rootNodeId;}
  updateSelected({eventType,sourceKindsJSON,conditionJSON,providerId,payloadJSON,milestoneId}={}){
    const id=this.#selected;
    this.#mutate(g=>{
      const n=g.nodes.find(n=>n.id===id);if(!n)fail('UNKNOWN_NODE','Node not found');
      if(n.typeId==='core.trigger.operations-completed'){
        let parsed;try{parsed=JSON.parse(payloadJSON);}catch{fail('TRIGGER_CONTRACT','Completed-operation trigger configuration must be JSON');}
        validateEventTrigger({...n,data:parsed});n.data=parsed;
      }else if(isTriggerNode(n)){
        if(typeof eventType!=='string'||!eventType.trim()||eventType.length>120)fail('INVALID_TRIGGER','Event type is required');
        n.data.eventType=eventType.trim();
        if(sourceKindsJSON!==undefined){let sourceKinds;try{sourceKinds=JSON.parse(sourceKindsJSON);}catch{fail('TRIGGER_CONTRACT','Source kind list must be valid JSON');}
          n.data.sourceKinds=sourceKinds;}
        validateEventTrigger(n);
      }else if(['core.condition','core.branch.condition'].includes(n.typeId)){
        let parsed;try{parsed=JSON.parse(conditionJSON);}catch{fail('INVALID_CONDITION','Condition must contain valid JSON');}
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))fail('INVALID_CONDITION','Condition must be a JSON object');
        n.data.condition=parsed;
      }else if(DATA_NODE_TYPES.includes(n.typeId)){
        let parsed;try{parsed=JSON.parse(payloadJSON);}catch{fail('DATA_CONTRACT','Typed data configuration requires valid JSON');}
        const candidate={...n,data:parsed,ports:dataNodePorts(n.typeId,parsed?.valueType,parsed??{})};
        validateDataNode(candidate);n.data=parsed;n.ports=candidate.ports;validateGraph(g,{allowIncompleteData:true});
      }else if(n.typeId===STATE_READ_TYPE){
        let parsed;try{parsed=JSON.parse(payloadJSON);}catch{fail('STATE_READ_DATA','State read requires valid JSON');}
        validateStateRead({...n,data:parsed});n.data=parsed;
      }else if(LOGIC_NODE_TYPES.includes(n.typeId)){
        let parsed;try{parsed=JSON.parse(payloadJSON);}catch{fail('LOGIC_NODE_DATA','Logic node data must be valid JSON');}
        validateLogicNode({...n,data:parsed});n.data=parsed;
      }else if(n.typeId==='core.flow.join'){
        let parsed;try{parsed=JSON.parse(payloadJSON);}catch{fail('FLOW_JOIN_CONTRACT','Join must contain JSON configuration');}
        validateFlowJoin({data:parsed});n.data=parsed;
      }else if(n.typeId==='core.subgraph.call'){
        let parsed;try{parsed=JSON.parse(payloadJSON);}catch{fail('SUBGRAPH_CONTRACT','Subgraph data must be valid JSON');}
        validateSubgraphCall(parsed);n.data=parsed;
      }else if(n.typeId==='core.milestone.qualify'){
        if(typeof milestoneId!=='string'||!/^ep:milestone:[a-zA-Z0-9_-]{3,120}$/.test(milestoneId))fail('INVALID_MILESTONE','Stable milestone ID is required');
        n.data.milestoneId=milestoneId;
      }else if(Object.hasOwn(ALL_EFFECT_NODE_PROVIDER,n.typeId)){
        let parsed;try{parsed=JSON.parse(payloadJSON);}catch{fail('INVALID_EFFECT','Typed domain payload must be valid JSON');}
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))fail('INVALID_EFFECT','Typed domain payload must be an object');
        n.data.payload=parsed;
      }else if(this.#extensions?.get(n.typeId)){
        let parsed;try{parsed=JSON.parse(payloadJSON);}catch{fail('EXTENSION_DATA','Extension data must be valid JSON');}
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))fail('EXTENSION_DATA','Extension data must be an object');
        this.#extensions.validateNode({...n,data:parsed});n.data=parsed;
      }else if(n.typeId==='core.effect.proposal'){
        if(typeof providerId!=='string'||!providerId.trim()||providerId.length>120)fail('INVALID_EFFECT','Effect provider is required');
        let parsed;try{parsed=JSON.parse(payloadJSON);}catch{fail('INVALID_EFFECT','Effect payload must be valid JSON');}
        if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))fail('INVALID_EFFECT','Effect payload must be a JSON object');
        n.data.providerId=providerId.trim();n.data.payload=parsed;
      }
    });
    return this.selectedNode;
  }
  bindSelectedInput({field,sourceNodeId,sourcePortId='value'}={}){
    return this.#mutate(g=>{
      const to=g.nodes.find(n=>n.id===this.#selected),from=g.nodes.find(n=>n.id===sourceNodeId);
      if(!to||!(to.typeId==='core.effect.proposal'||Object.hasOwn(ALL_EFFECT_NODE_PROVIDER,to.typeId)))fail('DATA_BINDING','Select an effect proposal to bind a value');
      if(!safeDataKey(field)||!Object.hasOwn(to.data.payload??{},field))fail('DATA_BINDING','Choose an existing payload field');
      const source=from?.ports.find(p=>p.id===sourcePortId&&p.direction==='output');
      if(!DATA_NODE_TYPES.includes(from?.typeId)||!source)fail('DATA_PROVIDER_UNAVAILABLE','Choose a typed data output');
      const inputId=`data-${field}`;
      to.accessClass='gm-secret';to.data.inputBindings={...to.data.inputBindings,[field]:inputId};
      to.ports=to.ports.filter(p=>p.id!==inputId);
      to.ports.push({id:inputId,direction:'input',valueType:source.valueType,accessClass:'gm-secret'});
      g.edges=g.edges.filter(e=>!(e.target.nodeId===to.id&&e.target.portId===inputId));
      g.edges.push({id:uid('edge'),kind:'data',source:{nodeId:from.id,portId:source.id},target:{nodeId:to.id,portId:inputId}});
      validateGraph(g,{allowIncompleteData:true});return this.#selected;
    });
  }
  unbindSelectedInput(field){
    return this.#mutate(g=>{
      const to=g.nodes.find(n=>n.id===this.#selected),inputId=to?.data.inputBindings?.[field];
      if(!inputId)fail('DATA_BINDING','Payload field has no data binding');
      delete to.data.inputBindings[field];to.ports=to.ports.filter(p=>p.id!==inputId);
      g.edges=g.edges.filter(e=>!(e.target.nodeId===to.id&&e.target.portId===inputId));
      if(!Object.keys(to.data.inputBindings).length)delete to.data.inputBindings;
    });
  }
  connect(sourceId,targetId,{sourcePortId=null,targetPortId=null}={}){
    return this.#mutate(g=>{
      if(sourceId===targetId)fail('SELF_EDGE','Cannot connect a node to itself');
      const from=g.nodes.find(n=>n.id===sourceId),to=g.nodes.find(n=>n.id===targetId);
      if(!from||!to)fail('UNKNOWN_NODE','Connection requires two existing nodes');
      const out=from.ports.find(p=>p.direction==='output'&&(sourcePortId===null||p.id===sourcePortId));const input=to.ports.find(p=>p.direction==='input'&&p.valueType===out?.valueType&&(targetPortId===null||p.id===targetPortId));
      if(!out||!input)fail('INVALID_CONNECTION','No matching source and target ports');
      if(from.typeId==='core.branch.condition'&&sourcePortId===null)fail('BRANCH_PORT_REQUIRED','Choose the true or false branch explicitly');
      if(g.edges.some(e=>e.source.nodeId===sourceId&&e.source.portId===out.id&&e.target.nodeId===targetId))fail('DUPLICATE_CONNECTION','The connection already exists');
      const edge={id:uid('edge'),kind:out.valueType==='event'?'flow':'data',source:{nodeId:sourceId,portId:out.id},target:{nodeId:targetId,portId:input.id}};
      try{validateConvergenceCycles({...g,edges:[...g.edges,edge]},{localFlowTypes:[...LOGIC_NODE_TYPES,'core.condition','core.branch.condition','core.branch.data','core.state.read','core.effect.proposal']});}
      catch(error){if(error.code==='UNBOUNDED_CYCLE')fail('CYCLE_BLOCKED','Flow cycles require an explicit bounded convergence repeat path');throw error;}
      g.edges.push(edge);if(edge.kind==='data')validateGraph(g,{allowIncompleteData:true});return edge.id;
    });
  }
  disconnect(id){this.#mutate(g=>{if(!g.edges.some(e=>e.id===id))fail('UNKNOWN_EDGE','Connection not found');g.edges=g.edges.filter(e=>e.id!==id);});}
  preview(){if(!this.#graph)fail('NO_GRAPH','No plot selected');return validateGraph(this.#graph);}
  async save(){if(!this.#graph)fail('NO_GRAPH','No plot selected');const result=await this.#registry.saveDraft(this.#graph,{expectedRevision:this.#graph.revision||null});this.#graph=result;this.#dirty=false;return this.graph;}
  async publish({acknowledgeWarnings=false}={}){
    if(!this.#graph)fail('NO_GRAPH','No plot selected');if(this.#dirty)fail('UNSAVED_CHANGES','Save the latest draft before publishing');
    if(this.#registry.validateCandidate){const view=await this.#registry.inspectValidation?.(this.#graph.id);if(view?.status!=='current')await this.#registry.validateCandidate(this.#graph.id,{expectedRevision:this.#graph.revision,expectedValidationRevision:view?.revision??null});}
    return this.#registry.publish(this.#graph.id,{expectedRevision:this.#graph.revision,acknowledgeWarnings});
  }
  async activation(){if(!this.#graph)fail('NO_GRAPH','No plot selected');return this.#registry.getActivation(this.#graph.id);}
  async activate(publishedVersion){if(!this.#graph)fail('NO_GRAPH','No plot selected');const old=await this.activation();return this.#registry.activate(this.#graph.id,publishedVersion,{expectedActivationRevision:old?.revision??null});}
  async deactivate(){if(!this.#graph)fail('NO_GRAPH','No plot selected');const old=await this.activation();if(!old)return null;return this.#registry.deactivate(this.#graph.id,{expectedActivationRevision:old.revision});}
  async listDrafts({cursor,limit}={}){return this.#registry.listDrafts({cursor,limit});}
}
