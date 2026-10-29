/** Event-type-targeted, nonexecuting reactive evaluation on a published graph. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {assertEventType} from './active-subscriptions.mjs';
import {evaluateCondition} from '../graph/conditions.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {ALL_EFFECT_NODE_PROVIDER} from '../graph/node-catalog.mjs';
import {LOGIC_NODE_TYPES,evaluateLogicNode} from '../graph/logic-nodes.mjs';
import {validateSubgraphCall} from '../graph/subgraph-call.mjs';
import {FLOW_JOIN_TYPE,validateFlowJoin} from '../graph/flow-join.mjs';
import {triggerAcceptsEvent,isTriggerNode} from '../graph/trigger-contract.mjs';
import {STATE_READ_TYPE} from '../graph/state-read.mjs';
import {GraphDataFrame} from './graph-data-frame.mjs';
import {resolveDataGuard,mergeDataGuards} from './data-guards.mjs';
import {validateEventVersion} from '../contracts/canonical-event.mjs';
import {validateRuntimeEvent} from './event-ledger.mjs';
import {boundedValue} from '../graph/typed-data.mjs';
import {MemoryOperationJournal} from '../storage/memory.mjs';
import {EffectCoordinator} from './effects.mjs';
import {CONVERGENCE_NODE_TYPE,BoundedConvergenceRun} from '../graph/convergence.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const MAX_PROPOSALS=12;
const DOMAIN_NODE_EFFECTS=ALL_EFFECT_NODE_PROVIDER;
const MAX_EVENT_SUMMARY_BYTES=48000;
export class DurableReactiveRouter {
  #registry;#catalog;#ledger;#gm;#limits;#extensions;#stateReader;#rollReader;#changes;#cascades;#compiledCache;#dependencyManifestReader;
  constructor({registry,catalog,ledger,gmProvider,extensions=null,stateReader=null,rollReader=null,changes=null,cascades=null,compiledCache=null,dependencyManifestReader=null,maxSubscribers=48,maxNodes=160,maxDepth=24,maxSubgraphs=8}={}){
    if(typeof registry?.getActive!=='function'||typeof catalog?.lookup!=='function'||typeof ledger?.accept!=='function'||typeof gmProvider!=='function')fail('INVALID_RUNTIME','Reactive router requires indexed publication registry, durable ledger and GM authority');
    this.#registry=registry;this.#catalog=catalog;this.#ledger=ledger;this.#gm=gmProvider;this.#extensions=extensions;this.#stateReader=stateReader;
    this.#changes=changes;this.#cascades=cascades;this.#compiledCache=compiledCache;this.#dependencyManifestReader=dependencyManifestReader;
    if(cascades&&(typeof cascades.inspect!=='function'||typeof cascades.reserve!=='function'))fail('INVALID_RUNTIME','Causal budget admission service required');
    if(compiledCache&&typeof compiledCache.get!=='function')fail('INVALID_RUNTIME','Compiled graph cache contract required');
    this.#rollReader=rollReader;
    this.#limits={maxSubscribers,maxNodes,maxDepth,maxSubgraphs};
  }
  #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
  async previewCascade(event){this.#context();return this.#cascades?.inspect(event)??null;}
  async subscribed(eventType){this.#context();return this.#catalog.lookup(assertEventType(eventType));}
  /** The same published evaluator with an isolated effect journal. Native
   * adapters and extension callbacks are never invoked by this preview. */
  async simulatePublished({graphId,publishedVersion,event,hypotheses=[],faults=[]}={}){
    this.#context();event=validateRuntimeEvent(event);
    if(typeof graphId!=='string'||!graphId.startsWith('ep:graph:')||!Number.isSafeInteger(publishedVersion)||publishedVersion<1||typeof this.#registry.getPublished!=='function')fail('SIMULATION_GRAPH','A specific published graph version is required');
    if(!Array.isArray(hypotheses)||hypotheses.length>16||!Array.isArray(faults)||faults.length>12)fail('SIMULATION_BUDGET','Bounded hypotheses and effect faults required');
    const overlay=new Map(),observed=new Map();
    for(const item of hypotheses){
      if(!item||Object.keys(item).some(k=>!['scope','key','value','expectedRevision'].includes(k))||typeof item.scope!=='string'||!/^[a-z][a-z0-9-]{0,50}$/.test(item.scope)||typeof item.key!=='string'||!/^[A-Za-z][A-Za-z0-9_.:-]{0,110}$/.test(item.key)||!Number.isSafeInteger(item.expectedRevision)||item.expectedRevision<1)fail('SIMULATION_HYPOTHESIS','A named state hypothesis requires its observed revision');
      const key=`${item.scope}|${item.key}`;if(overlay.has(key))fail('SIMULATION_HYPOTHESIS','Duplicate state hypothesis');overlay.set(key,{...item,value:boundedValue(item.value)});
    }
    const readState=async({scope,key})=>{
      this.#context();if(typeof this.#stateReader!=='function')fail('STATE_READ_UNAVAILABLE','Protected state reader unavailable');
      const row=await this.#stateReader({scope,key}),selection=`${scope}|${key}`,hypothesis=overlay.get(selection);
      if(hypothesis&&(!row||row.kind!=='narrative-state'||row.scope!==scope||row.stateKey!==key||row.revision!==hypothesis.expectedRevision))fail('SIMULATION_SOURCE_STALE','Hypothesis no longer matches its canonical source');
      observed.set(selection,{scope,key,revision:row?.revision??null});return row&&hypothesis?{...structuredClone(row),value:structuredClone(hypothesis.value)}:row;
    };
    const faultMap=new Map();for(const fault of faults){if(!fault||Object.keys(fault).some(k=>!['nodeId','stage'].includes(k))||typeof fault.nodeId!=='string'||!['apply-ack','verification'].includes(fault.stage)||faultMap.has(fault.nodeId))fail('SIMULATION_FAULT','Unique effect-node fault and declared stage required');faultMap.set(fault.nodeId,fault.stage);}
    const graph=await this.#registry.getPublished(graphId,publishedVersion);if(!graph||graph.id!==graphId||graph.publishedVersion!==publishedVersion)fail('SUBGRAPH_UNAVAILABLE','Immutable simulation graph unavailable');
    for(const item of overlay.values())await readState(item);
    const entry=graph.nodes.find(node=>node.id===graph.rootNodeId&&isTriggerNode(node)&&!node.disabled&&triggerAcceptsEvent(node,event));
    const result=entry?await this.#evaluate(graph,entry,event,{rootGraphId:graph.id,rootVersion:graph.publishedVersion,callChain:[],stack:[graph.id],budget:{nodes:0,graphCalls:0},readState,simulation:true}):{evaluatedNodeIds:[],proposals:[],trace:[]};
    for(const nodeId of faultMap.keys())if(!result.proposals.some(p=>p.nodeId===nodeId))fail('SIMULATION_FAULT','A fault may target only a proposed operation in this scenario');
    const journal=new MemoryOperationJournal(),outcomes=[];
    const providers={get:providerId=>({validate(){},async apply(_payload,context){if(faultMap.get(context.nodeId)==='apply-ack')throw Error('Simulated lost apply acknowledgement');return {kind:'isolated-simulation-receipt',providerId};},async verify(_payload,context){return faultMap.get(context.nodeId)!=='verification';}})};
    const coordinator=new EffectCoordinator({journal,providers});
    for(const proposal of result.proposals){const outcome=await coordinator.execute(proposal,this.#context());outcomes.push({operationId:`ep:simulation-operation:${proposal.operationId.split(':').at(-1)}`,nodeId:proposal.nodeId,providerId:proposal.providerId,status:outcome.status==='completed'?'simulated-completed':'simulated-uncertain',journalState:outcome.record?.state??null,failureCode:outcome.record?.failureCode??null,attempts:outcome.record?.attempts??0});}
    this.#context();return {kind:'published-graph-simulation',graphId,publishedVersion,status:entry?'evaluated':'no-matching-entry',trace:result.trace,
      proposals:result.proposals.map(p=>({...p,operationId:`ep:simulation-operation:${p.operationId.split(':').at(-1)}`,state:'simulation-only'})),outcomes,
      sourceObservations:[...observed.values(),...(result.inputObservations??[])],hypothesisCount:overlay.size,nativeProviders:'not-invoked-or-qualified',canonicalEventsCreated:0,effectsExecuted:0};
  }
  /**
   * Safe only when invoked from an authenticated, opt-in ingress adapter. Never
   * expose this method or an origin-forging wrapper as a player API.
   * All effects remain pending GM review; this function does not mutate world
   * Actors, Items or narrative states.
   */
  async ingest(event,{retainWithoutSubscribers=false}={}){
    if(typeof retainWithoutSubscribers!=='boolean')fail('INVALID_RUNTIME','Explicit event retention policy required');
    this.#context();assertEventType(event?.eventType);validateEventVersion(event);
    // Bind this evaluation to one occurrence before any asynchronous lookup.
    // A caller must not alter the event while durable acceptance is pending.
    event=structuredClone(event);
    const subscriptions=await this.#catalog.lookup(event.eventType);
    if(subscriptions.length>this.#limits.maxSubscribers)fail('FANOUT_BUDGET','Too many event-type subscribers');
    if(!subscriptions.length&&!retainWithoutSubscribers)return {status:'no-subscribers',eventId:event.id,subscriptionsChecked:0};
    // Durable acceptance occurs BEFORE any graph evaluation.
    const accepted=await this.#ledger.accept(event);
    if(!accepted.created)return {status:'duplicate-or-recovery-required',eventId:event.id,persistedState:accepted.record.state};
    await this.#ledger.transition(event.id,'prepared','evaluating');
    try {
      const cascade=await this.#cascades?.reserve(event);
      if(cascade&&!cascade.allowed){
        const evaluations=[{graphId:null,publishedVersion:null,triggerNodeId:null,evaluatedNodeIds:[],trace:[{status:'cascade-stopped',diagnostic:cascade}]}];
        await this.#ledger.transition(event.id,'evaluating','evaluated',{evaluations,proposals:[],reason:cascade.code});
        return {status:'evaluated',eventId:event.id,graphCount:0,proposals:0,cascade};
      }
      const evaluations=[],proposals=[],operationIds=new Set();
      for(const subscription of subscriptions){
        this.#context();
        // This per-graph read is intentionally necessary: the subscription
        // index alone is not authoritative and may contain stale revisions.
        const active=await this.#registry.getActive(subscription.graphId);
        if(!active||active.publishedVersion!==subscription.publishedVersion)continue;
        for(const trigger of active.nodes.filter(n=>isTriggerNode(n)&&!n.disabled&&triggerAcceptsEvent(n,event))){
          const result=await this.#evaluate(active,trigger,event,{rootGraphId:active.id,rootVersion:active.publishedVersion,callChain:[],stack:[active.id],budget:{nodes:0,graphCalls:0}});
          evaluations.push({graphId:active.id,publishedVersion:active.publishedVersion,triggerNodeId:trigger.id,evaluatedNodeIds:result.evaluatedNodeIds,trace:result.trace,...(result.inputObservations.length?{inputObservations:result.inputObservations}:{})});
          for(const proposal of result.proposals)if(!operationIds.has(proposal.operationId)){operationIds.add(proposal.operationId);proposals.push(proposal);}
          if(proposals.length>MAX_PROPOSALS||evaluations.length>32)fail('FANOUT_BUDGET','Reactive evaluation exceeded bounded proposal/evaluation counts');
        }
      }
      if(new TextEncoder().encode(JSON.stringify({evaluations,proposals})).length>MAX_EVENT_SUMMARY_BYTES)
        fail('EVENT_BUDGET','Protected event review record exceeds native storage size limit');
      const state=proposals.length?'review-required':'evaluated';
      if(new TextEncoder().encode(JSON.stringify({...accepted.record,state,evaluations,proposals})).length>60000)
        fail('EVENT_BUDGET','Canonical event and review evidence exceed the native record budget');
      await this.#ledger.transition(event.id,'evaluating',state,{evaluations,proposals});
      // View failures cannot turn a durable accepted event into an uncertain
      // world operation or trigger a replay. This bus carries no event values.
      try{this.#changes?.publish({graphIds:[...new Set(evaluations.flatMap(e=>[e.graphId,...e.trace.map(t=>t.graphId)]))],eventId:event.id,state});}catch{}
      return {status:state,eventId:event.id,graphCount:evaluations.length,proposals:proposals.length};
    }catch(error){
      // Even evaluation-only failures require human review after interrupted
      // persistence. Never silently replay a potentially accepted event.
      try{await this.#ledger.transition(event.id,'evaluating','uncertain',{reason:error.code??'EVALUATION_FAILED'});}
      catch{throw new EasyPlotsError('EVENT_RECOVERY_REQUIRED','Failed to record uncertain event state; inspect durable journal');}
      return {status:'uncertain',eventId:event.id,reason:error.code??'EVALUATION_FAILED'};
    }
  }
  async #evaluate(graph,trigger,event,callContext){
    const readState=callContext.readState??this.#stateReader;
    const readRoll=callContext.readRoll??this.#rollReader,observations=callContext.inputObservations??=new Map();
    const recordInputs=rows=>{for(const row of rows)if(row.kind==='native-roll'){const key=`${row.graphId}|${row.nodeId}`,prior=observations.get(key);if(prior&&JSON.stringify(prior)!==JSON.stringify(row))fail('ROLL_INPUT_STALE','Roll inputs changed within one evaluation');observations.set(key,row);}if(observations.size>32)fail('EVALUATION_BUDGET','Roll observation budget exceeded');};
    const compiled=this.#compiledCache?await this.#compiledCache.get(graph,{manifest:graph.dependencyManifest??await this.#dependencyManifestReader?.(graph)}):null;
    const nodes=compiled?.nodes??new Map(graph.nodes.map(n=>[n.id,n]));
    const edges=compiled?.edges??new Map(),incoming=compiled?.incoming??new Map();
    if(!compiled)for(const edge of graph.edges)if(['flow','condition','event'].includes(edge.kind)){
      const outgoing=edges.get(edge.source.nodeId)??[];outgoing.push({edgeId:edge.id,targetId:edge.target.nodeId,portId:edge.source.portId});edges.set(edge.source.nodeId,outgoing);
      const predecessors=incoming.get(edge.target.nodeId)??new Set();predecessors.add(edge.id);incoming.set(edge.target.nodeId,predecessors);
    }
    const convergence=new BoundedConvergenceRun(graph);
    const queue=[{id:trigger.id,depth:0,via:null,round:0,guards:callContext.guards??[]}],seen=new Set(),joinArrivals=new Map(),joinGuards=new Map(),evaluatedNodeIds=[],proposals=[],trace=[];
    while(queue.length){
      const {id,depth,via,round=0,guards:incomingGuards}=queue.shift();let guards=incomingGuards,nextRound=round;
      if(depth>this.#limits.maxDepth||++callContext.budget.nodes>this.#limits.maxNodes)fail('EVALUATION_BUDGET','Bounded graph budget exhausted');
      if(seen.has(convergence.visitKey(id,round)))continue;
      const node=nodes.get(id);if(!node)continue;
      if(node.typeId===FLOW_JOIN_TYPE){
        validateFlowJoin(node,{incoming:incoming.get(id)?.size??0});
        if(node.data.mode==='all'){
          guards=mergeDataGuards(joinGuards.get(id)??[],guards);joinGuards.set(id,guards);
          const arrivals=joinArrivals.get(id)??new Set();if(via!==null)arrivals.add(via);joinArrivals.set(id,arrivals);
          if(arrivals.size<(incoming.get(id)?.size??0)){trace.push({graphId:graph.id,nodeId:id,status:'join-awaiting-inputs'});continue;}
        }
      }
      seen.add(convergence.visitKey(id,round));
      if(node.disabled){trace.push({graphId:graph.id,nodeId:id,status:'disabled'});continue;}
      evaluatedNodeIds.push(node.id);
      let allowedPort=null;let allowedPorts=null;let disposition='passed',convergenceDiagnostic=null;
      if(node.typeId===CONVERGENCE_NODE_TYPE){
        const outcome=convergence.step(node);allowedPorts=outcome.allowedPorts;nextRound=outcome.round;disposition=outcome.status;convergenceDiagnostic=outcome.diagnostic;
        if(outcome.stopped){trace.push({graphId:graph.id,nodeId:id,status:outcome.status,diagnostic:outcome.diagnostic,selectedPorts:[]});proposals.length=0;queue.length=0;break;}
      }else if(node.typeId==='core.condition'||node.typeId==='core.branch.condition'){
        const valid=evaluateCondition(node.data.condition,{values:{event:event.payload},clearance:'gm-secret'});
        if(node.typeId==='core.condition'&&!valid){
          trace.push({graphId:graph.id,nodeId:id,status:'condition-blocked'});continue;
        }
        if(node.typeId==='core.branch.condition'){allowedPort=valid?'true':'false';disposition='branch-selected';}
      } else if(['core.subgraph.call','core.subgraph.mixed'].includes(node.typeId)){
        const mixed=node.typeId==='core.subgraph.mixed';
        if(!mixed)validateSubgraphCall(node.data,{parentGraphId:graph.id});
        if(++callContext.budget.graphCalls>this.#limits.maxSubgraphs)fail('SUBGRAPH_BUDGET','Published subgraph invocation budget exceeded');
        if(callContext.stack.includes(node.data.graphId))fail('SUBGRAPH_RECURSION','Recursive subgraph dependency detected');
        this.#context();
        let parameters={},parameterStateInputs=[],child;
        if(mixed){
          const frame=new GraphDataFrame(graph,{event,parameters:callContext.parameters??{},stack:callContext.stack,readState,readRoll,
            readGraph:async(id,version)=>{this.#context();return this.#registry.getPublished(id,version);},
            consume:()=>{this.#context();if(++callContext.budget.nodes>this.#limits.maxNodes)fail('EVALUATION_BUDGET','Subgraph arguments exceed the bounded dependency budget');}});
          const invocation=await frame.invocation(node.id);child=invocation.graph;parameters=invocation.parameters;parameterStateInputs=frame.stateInputs;recordInputs(parameterStateInputs);
        }else child=await this.#registry.getPublished(node.data.graphId,node.data.publishedVersion);
        if(!child||child.id!==node.data.graphId||child.publishedVersion!==node.data.publishedVersion)
          fail('SUBGRAPH_UNAVAILABLE','Required immutable child graph is unavailable');
        const entry=child.nodes.find(n=>n.id===child.rootNodeId&&isTriggerNode(n)&&!n.disabled&&triggerAcceptsEvent(n,event));
        if(!entry)fail('SUBGRAPH_ENTRY','Child graph lacks a supported event-entry node');
        const edge={parentGraphId:graph.id,parentVersion:graph.publishedVersion,callNodeId:node.id,childGraphId:child.id,childVersion:child.publishedVersion,
          ...(mixed?{mode:'mixed',parameters,parameterStateInputs}:{})};
        const result=await this.#evaluate(child,entry,event,{...callContext,parameters,guards,callChain:[...callContext.callChain,edge],stack:[...callContext.stack,child.id]});
        for(const proposal of result.proposals)if(convergence.claimOperation(proposal.operationId))proposals.push(proposal);
        trace.push(...result.trace);
        if(proposals.length>MAX_PROPOSALS)fail('EVALUATION_BUDGET','Nested effect proposal budget exceeded');
      } else if(node.typeId===STATE_READ_TYPE||node.typeId==='core.branch.data'){
        const guard=await resolveDataGuard(graph,node,{event,parameters:callContext.parameters??{},stack:callContext.stack,readState,readRoll,readGraph:async(id,version)=>{
          this.#context();return this.#registry.getPublished(id,version);
        },consume:()=>{this.#context();if(++callContext.budget.nodes>this.#limits.maxNodes)fail('EVALUATION_BUDGET','Guard dependency budget exhausted');}});
        recordInputs(guard.stateInputs);guards=mergeDataGuards(guards,[guard]);allowedPorts=[guard.selectedPort];disposition='branch-selected';
      } else if(LOGIC_NODE_TYPES.includes(node.typeId)){
        const outcome=evaluateLogicNode(node,event);
        if(!outcome.pass){trace.push({graphId:graph.id,nodeId:id,status:'logic-blocked'});continue;}
        allowedPorts=outcome.allowedPorts;if(allowedPorts)disposition='branch-selected';
      } else if(node.typeId==='core.effect.proposal'||node.typeId==='core.milestone.qualify'||Object.hasOwn(DOMAIN_NODE_EFFECTS,node.typeId)){
        const providerId=node.typeId==='core.milestone.qualify'?'narrative.qualify-milestone':
          (DOMAIN_NODE_EFFECTS[node.typeId]??node.data?.providerId);
        if(typeof providerId!=='string'||!providerId.trim())fail('INVALID_EFFECT','Proposal requires provider');
        const invocation=callContext.callChain.some(link=>link.mode==='mixed')?'|calls:'+callContext.callChain.map(link=>link.callNodeId).join('/'):'';
        const seed=`${event.id}|${graph.id}|${graph.publishedVersion}|${node.id}${invocation}`;
        const hash=(await sha256Hex(seed)).slice(0,30);
        const frame=new GraphDataFrame(graph,{event,parameters:callContext.parameters??{},stack:callContext.stack,readState,readRoll,readGraph:async(id,version)=>{
          this.#context();return this.#registry.getPublished(id,version);
        },consume:()=>{
          this.#context();if(++callContext.budget.nodes>this.#limits.maxNodes)fail('EVALUATION_BUDGET','Data dependency budget exhausted');
        }});
        const payload=node.typeId==='core.milestone.qualify'?{milestoneId:node.data?.milestoneId}:await frame.payload(node);
        recordInputs(frame.stateInputs);
        if(new TextEncoder().encode(JSON.stringify(payload)).length>2048)fail('EVENT_BUDGET','Effect proposal payload exceeds safe review-record size');
        const operationId=`ep:operation:${hash}`;
        if(convergence.claimOperation(operationId))proposals.push({operationId,idempotencyKey:seed,sourceEventId:event.id,
          graphId:graph.id,publishedVersion:graph.publishedVersion,nodeId:node.id,
          rootGraphId:callContext.rootGraphId,rootPublishedVersion:callContext.rootVersion,callChain:callContext.callChain,
          providerId,payload,guardInputs:guards,...(node.data.inputBindings?{stateInputs:frame.stateInputs}:{}),state:'requires-gm-approval'});
        if(proposals.length>MAX_PROPOSALS)fail('EVALUATION_BUDGET','Per-graph effect proposal budget exhausted');
      } else if(node.typeId!==FLOW_JOIN_TYPE&&!isTriggerNode(node)){
        if(callContext.simulation)fail('SIMULATION_EXTENSION_UNAVAILABLE','Extension callbacks require a separate proven isolated simulation adapter');
        if(!this.#extensions?.get(node.typeId))fail('NODE_PROVIDER_UNAVAILABLE','Unimplemented published node provider');
        const outcome=await this.#extensions.route(node,{event,gmContext:this.#context()});
        if(!outcome.pass){trace.push({graphId:graph.id,nodeId:id,status:'extension-blocked'});continue;}
        allowedPorts=outcome.allowedPorts;if(allowedPorts)disposition='branch-selected';
      }
      trace.push({graphId:graph.id,nodeId:id,status:disposition,...(convergenceDiagnostic?{diagnostic:convergenceDiagnostic}:{}),
        ...(allowedPort!==null?{selectedPorts:[allowedPort]}:allowedPorts!==null?{selectedPorts:[...allowedPorts]}:{})});
      for(const destination of edges.get(id)??[]){
        if(allowedPort!==null && destination.portId!==allowedPort)continue;
        if(allowedPorts!==null&&!allowedPorts.includes(destination.portId))continue;
        queue.push({id:destination.targetId,depth:depth+1,via:destination.edgeId,round:nextRound,guards});
      }
    }
    return {evaluatedNodeIds,proposals,trace,inputObservations:[...observations.values()]};
  }
  async getForGM(eventId){this.#context();return this.#ledger.get(eventId);}
}
