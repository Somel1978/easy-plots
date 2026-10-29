/** Lazy data evaluation, private to one immutable graph and canonical event. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {DATA_NODE_TYPES,DATA_CALL_TYPES,validateDataNode,validateInputBindings,boundedValue,assertPublishedDataInterface} from '../graph/typed-data.mjs';
import {resolveRollInput} from './roll-input.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export class GraphDataFrame {
  #nodes;#incoming;#values=new Map();#reading=new Set();#readState;#consume;#reads=new Map();
  #graph;#readGraph;#readRoll;#parameters;#stack;#budget;#calls=new Map();#event;
  constructor(graph,{readState=null,readGraph=null,readRoll=null,event=null,parameters={},consume=()=>{},stack=[graph.id],budget={values:0,calls:0}}={}){
    this.#event=event;
    this.#graph=graph;this.#readGraph=readGraph;this.#readRoll=readRoll;this.#parameters=parameters;this.#stack=stack;this.#budget=budget;
    this.#nodes=new Map(graph.nodes.map(n=>[n.id,n]));this.#incoming=new Map();this.#readState=readState;this.#consume=consume;
    for(const e of graph.edges)if(e.kind==='data'){
      const key=`${e.target.nodeId}|${e.target.portId}`;
      if(this.#incoming.has(key))fail('DATA_CARDINALITY','Data inputs require a unique producer');
      this.#incoming.set(key,e.source);
    }
  }
  async #input(nodeId,portId){
    const source=this.#incoming.get(`${nodeId}|${portId}`);
    if(!source)fail('DATA_INPUT_MISSING','Required data input is not connected');
    return this.value(source.nodeId,source.portId);
  }
  async value(nodeId,portId='value'){
    const cacheKey=`${nodeId}|${portId}`;
    if(this.#values.has(cacheKey))return structuredClone(this.#values.get(cacheKey));
    if(this.#reading.has(cacheKey))fail('DATA_CYCLE','Recursive data dependency');
    const node=this.#nodes.get(nodeId);
    if(!node||node.disabled||!DATA_NODE_TYPES.includes(node.typeId))fail('DATA_PROVIDER_UNAVAILABLE','Data producer is unavailable');
    validateDataNode(node);const output=node.ports.find(p=>p.id===portId&&p.direction==='output');
    if(!output||output.valueType==='event')fail('DATA_PORTS','Unknown declared typed data output');
    if(++this.#budget.values>32)fail('DATA_BUDGET','Bounded dependency read count exhausted');
    this.#consume();this.#reading.add(cacheKey);
    try{
      const d=node.data;let value;
      if(node.typeId==='core.data.literal')value=boundedValue(d.value,d.valueType);
      else if(node.typeId==='core.roll.value'){
        const resolved=await resolveRollInput(this.#readRoll,d);this.#consume();value=boundedValue(resolved.value,d.valueType);
        this.#reads.set(`${this.#graph.id}|${nodeId}`,{graphId:this.#graph.id,publishedVersion:this.#graph.publishedVersion??null,nodeId,...resolved.observation});
      }
      else if(node.typeId==='core.data.event'){
        if(!this.#event)fail('DATA_EVENT_UNAVAILABLE','A canonical event must be supplied by the authenticated runtime');
        let selected=this.#event;
        for(const key of d.path){
          if(selected===null||typeof selected!=='object'||!Object.hasOwn(selected,key))fail('DATA_EVENT_PATH','Authored event input is absent');
          selected=selected[key];
        }
        value=boundedValue(selected,d.valueType);
      }
      else if(node.typeId==='core.data.parameter'){
        if(!Object.hasOwn(this.#parameters,d.name))fail('DATA_PARAMETER_MISSING','Named subgraph input is unavailable');
        value=boundedValue(this.#parameters[d.name],d.valueType);
      }else if(node.typeId==='core.data.export')value=boundedValue(await this.#input(nodeId,'input'),d.valueType);
      else if(node.typeId==='core.data.compare'){
        const left=boundedValue(await this.#input(nodeId,'left'),d.operandType),right=boundedValue(await this.#input(nodeId,'right'),d.operandType);
        value=d.operator==='eq'?JSON.stringify(left)===JSON.stringify(right):d.operator==='neq'?JSON.stringify(left)!==JSON.stringify(right):
          d.operator==='gt'?left>right:d.operator==='gte'?left>=right:d.operator==='lt'?left<right:d.operator==='lte'?left<=right:left.includes(right);
      }
      else if(DATA_CALL_TYPES.includes(node.typeId)){
        const call=await this.invocation(nodeId);
        const name=portId.slice('result-'.length),exported=call.graph.nodes.find(n=>n.typeId==='core.data.export'&&!n.disabled&&n.data.name===name);
        if(!exported)fail('DATA_INTERFACE_STALE','Requested child export is unavailable');
        value=boundedValue(await call.frame.value(exported.id),output.valueType);
        for(const row of call.frame.stateInputs)this.#reads.set(`${row.graphId}|${row.nodeId}`,row);
      }else{
        if(typeof this.#readState!=='function')fail('STATE_READ_UNAVAILABLE','Protected state reader is unavailable');
        const entity=this.#incoming.has(`${nodeId}|entity`)?await this.#input(nodeId,'entity'):null;
        if(entity!==null)boundedValue(entity,'entity');
        const key=entity??d.key,row=await this.#readState({scope:d.scope,key});
        if(!row)fail('DATA_STATE_ABSENT','Authoritative state value is absent');
        if(row.kind!=='narrative-state'||row.scope!==d.scope||row.stateKey!==key||!Number.isSafeInteger(row.revision)||row.revision<1)fail('STATE_READ_CORRUPT','Authoritative state identity is inconsistent');
        if(d.expectedRevision!==null&&row.revision!==d.expectedRevision)fail('DATA_REVISION_STALE','State no longer matches the authored revision');
        value=boundedValue(row.value,d.valueType);
        this.#reads.set(`${this.#graph.id}|${nodeId}`,{graphId:this.#graph.id,publishedVersion:this.#graph.publishedVersion??null,nodeId,scope:d.scope,key,revision:row.revision});
      }
      this.#values.set(cacheKey,value);return structuredClone(value);
    }finally{this.#reading.delete(cacheKey);}
  }
  async invocation(nodeId){
    const node=this.#nodes.get(nodeId);if(!node||!DATA_CALL_TYPES.includes(node.typeId)||node.disabled)fail('DATA_PROVIDER_UNAVAILABLE','Published call node required');
    validateDataNode(node);let call=this.#calls.get(nodeId);if(call)return call;
    const d=node.data;
    if(typeof this.#readGraph!=='function')fail('SUBGRAPH_UNAVAILABLE','Protected published graph reader is unavailable');
    if(this.#stack.includes(d.graphId))fail('SUBGRAPH_RECURSION','Recursive typed subgraph dependency');
    if(++this.#budget.calls>8)fail('SUBGRAPH_BUDGET','Typed subgraph invocation budget exhausted');
    const child=await this.#readGraph(d.graphId,d.publishedVersion);assertPublishedDataInterface(node,child);
    const parameters={};for(const p of d.inputs)parameters[p.name]=boundedValue(await this.#input(nodeId,`param-${p.name}`),p.valueType);
    boundedValue(parameters,'json');
    call={graph:child,parameters:structuredClone(parameters),frame:new GraphDataFrame(child,{readState:this.#readState,readGraph:this.#readGraph,readRoll:this.#readRoll,event:this.#event,parameters,
      consume:this.#consume,stack:[...this.#stack,child.id],budget:this.#budget})};
    this.#calls.set(nodeId,call);return call;
  }
  async payload(node){
    validateInputBindings(node);
    const payload=structuredClone(node.data.payload??{});
    for(const [field,inputId] of Object.entries(node.data.inputBindings??{})){
      const port=node.ports.find(p=>p.id===inputId&&p.direction==='input');
      payload[field]=boundedValue(await this.#input(node.id,inputId),port.valueType);
    }
    return payload;
  }
  async input(nodeId,portId){
    const port=this.#nodes.get(nodeId)?.ports.find(p=>p.id===portId&&p.direction==='input');
    if(!port)fail('DATA_PORTS','Data consumer requires a declared input port');
    return boundedValue(await this.#input(nodeId,portId),port.valueType);
  }
  get stateInputs(){return [...this.#reads.values()].sort((a,b)=>a.graphId.localeCompare(b.graphId)||a.nodeId.localeCompare(b.nodeId)).map(x=>structuredClone(x));}
}
