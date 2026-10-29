import {assertLocalGM} from '../security/authority.mjs';
import {EasyPlotsError} from '../contracts/errors.mjs';
import {evaluateCondition} from '../graph/conditions.mjs';
import {isTriggerNode,triggerAcceptsEvent} from '../graph/trigger-contract.mjs';
/** Indexed active-graph subscriptions. No inactive graph document is read during a dispatch. */
export class NarrativeRuntime {
  #subscribers=new Map();
  constructor({registry,coordinator,maxSubscribers=64,maxNodes=160,maxDepth=24}) {
    this.registry=registry;this.coordinator=coordinator;
    this.budgets={maxSubscribers,maxNodes,maxDepth};
  }
  rebuildActiveIndex(gm) {
    assertLocalGM(gm);
    this.#subscribers.clear();
    for(const id of this.registry.activeIds()) {
      const graph=this.registry.getActive(id);
      for(const n of graph.nodes) if(isTriggerNode(n)&&typeof n.data.eventType==='string') {
        const ids=this.#subscribers.get(n.data.eventType)??new Set();ids.add(graph.id);this.#subscribers.set(n.data.eventType,ids);
      }
    }
    return {indexedEventTypes:this.#subscribers.size};
  }
  async handle(event,gm,{approveEffects=false}={}) {
    assertLocalGM(gm);
    if(typeof event?.id!=='string'||typeof event?.eventType!=='string'||!event?.id.startsWith('ep:'))throw new EasyPlotsError('INVALID_EVENT','Expected canonical narrative event');
    const subscribed=[...(this.#subscribers.get(event.eventType)??[])];
    if(subscribed.length>this.budgets.maxSubscribers)throw new EasyPlotsError('FANOUT_BUDGET','Too many subscribers');
    const results=[];
    for(const id of subscribed) {
      const graph=this.registry.getActive(id);
      if(!graph)continue;
      const matches=graph.nodes.filter(n=>isTriggerNode(n)&&triggerAcceptsEvent(n,event));
      for(const node of matches) {
        const outcome=await this.#evaluateGraph(graph,node,event,gm,approveEffects);
        results.push({graphId:id,triggerNodeId:node.id,...outcome});
      }
    }
    return results;
  }
  async #evaluateGraph(graph,root,event,gm,approveEffects) {
    const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
    const edges=new Map();
    for(const edge of graph.edges) if(['flow','condition','event'].includes(edge.kind)) {
      const list=edges.get(edge.source.nodeId)??[];list.push(edge);edges.set(edge.source.nodeId,list);
    }
    const candidates=[],evaluated=[];
    const queue=[{id:root.id,depth:0}];
    const seen=new Set();
    while(queue.length) {
      const {id,depth}=queue.shift();
      if(depth>this.budgets.maxDepth||evaluated.length>=this.budgets.maxNodes)throw new EasyPlotsError('EVALUATION_BUDGET','Graph evaluation budget exceeded');
      if(seen.has(id))continue;seen.add(id);
      const n=nodes.get(id);if(!n || n.disabled)continue; evaluated.push(id);
      let eligible=true;
      if(n.typeId==='core.condition') {
        eligible=evaluateCondition(n.data.condition,{values:{event:event.payload},clearance:'gm-secret'});
      }
      if(n.typeId==='core.effect.proposal') {
        candidates.push({operationId:`ep:operation:${event.id.replaceAll(':','_')}_${n.id.replaceAll(':','_')}`,idempotencyKey:`${event.id}|${graph.id}|${graph.publishedVersion}|${n.id}`,providerId:n.data.providerId,payload:n.data.payload??{},sourceEventId:event.id,graphId:graph.id,nodeId:n.id});
      }
      if(eligible) for(const e of edges.get(n.id)??[]) queue.push({id:e.target.nodeId,depth:depth+1});
    }
    const effects=[];
    if(approveEffects)for(const candidate of candidates)effects.push(await this.coordinator.execute(candidate,gm));
    return {evaluatedNodeIds:evaluated,proposedEffects:candidates,executed:approveEffects?effects:[],status:approveEffects?'authorized-execution':'review-required'};
  }
}
