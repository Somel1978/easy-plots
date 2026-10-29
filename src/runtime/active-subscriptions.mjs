/**
 * Bounded event-type subscriptions for published narrative graphs.
 * Invariant: this index is only a *candidate* list. Every dispatch MUST check
 * the current activation pointer and published revision, so stale entries
 * cannot execute an inactive graph or an old revision.
 *
 * Publication/activation and index writes are not a multi-document transaction.
 * We stage subscriptions FIRST and activate the graph SECOND. Failed/stale
 * staging never activates a graph. Leftover stale entries are harmless and
 * can be reconciled by scope; unknown outcomes fail closed.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {isTriggerNode} from '../graph/trigger-contract.mjs';
import {assertEventType} from '../graph/event-type.mjs';
export {assertEventType};

const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const MAX_SUBSCRIPTIONS=48;
export function graphEventTypes(graph){
  if(!graph||!Array.isArray(graph.nodes))fail('INVALID_GRAPH','Published graph required');
  const result=new Set();
  for(const node of graph.nodes)if(isTriggerNode(node)&&!node.disabled)result.add(assertEventType(node.data?.eventType));
  if(result.size>32)fail('SUBSCRIPTION_BUDGET','A single graph may subscribe to no more than 32 event types');
  return [...result].sort();
}
export async function subscriptionLocator(eventType,scope='main'){
  assertEventType(eventType);
  if(typeof scope!=='string'||!/^[a-z][a-z0-9-]{0,45}$/.test(scope))fail('INVALID_SCOPE','Invalid narrative scope');
  const hash=await sha256Hex(`ep:subscriptions:v1:${scope}:${eventType}`);
  return Object.freeze({id:`ep:sub:${hash.slice(0,24)}`,partitionId:`subscriptions:${scope}:${hash.slice(0,2)}`});
}
export class ActiveTriggerCatalog {
  #repo;#gm;#scope;#max;
  constructor({repository,gmProvider,scope='main',maxSubscriptions=MAX_SUBSCRIPTIONS}={}) {
    if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function')fail('INVALID_REPOSITORY','Indexed subscription catalog needs a revisioned repository and GM context');
    if(!Number.isInteger(maxSubscriptions)||maxSubscriptions<1||maxSubscriptions>MAX_SUBSCRIPTIONS)fail('SUBSCRIPTION_BUDGET','Invalid subscriptions per event type');
    this.#repo=repository;this.#gm=gmProvider;this.#scope=scope;this.#max=maxSubscriptions;
  }
  #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
  async #read(eventType,gm){
    const loc=await subscriptionLocator(eventType,this.#scope);
    const record=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});
    if(record){
      if(record.kind!=='event-subscriptions'||record.eventType!==eventType||record.id!==loc.id||record.partitionId!==loc.partitionId||!Array.isArray(record.entries))fail('SUBSCRIPTION_CORRUPT','Invalid subscription index document');
      if(typeof this.#repo.hasReadyIndex==='function'&&!(await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm})))fail('INDEX_UNCERTAIN','Subscription index is pending reconciliation');
      if(record.entries.length>this.#max)fail('SUBSCRIPTION_BUDGET','Subscription index exceeds supported fan-out');
      const ids=new Set();
      for(const entry of record.entries){
        if(!entry||typeof entry.graphId!=='string'||!Number.isInteger(entry.publishedVersion)||entry.publishedVersion<1)fail('SUBSCRIPTION_CORRUPT','Invalid subscription entry');
        assertNarrativeId(entry.graphId);
        if(ids.has(entry.graphId))fail('SUBSCRIPTION_CORRUPT','Graph subscribed twice');
        ids.add(entry.graphId);
      }
    }
    return {record,loc};
  }
  async lookup(eventType){
    const gm=this.#context();
    const {record}=await this.#read(assertEventType(eventType),gm);
    return clone(record?.entries??[]);
  }
  async stage(graph){
    const gm=this.#context();
    assertNarrativeId(graph?.id);
    if(!Number.isInteger(graph.publishedVersion)||graph.publishedVersion<1)fail('INVALID_VERSION','Published graph required for subscription registration');
    const types=graphEventTypes(graph);
    for(const eventType of types){
      const {record,loc}=await this.#read(eventType,gm);
      const entries=(record?.entries??[]).filter(x=>x.graphId!==graph.id);
      entries.push({graphId:graph.id,publishedVersion:graph.publishedVersion});
      if(entries.length>this.#max)fail('SUBSCRIPTION_BUDGET','Event subscriber fan-out exceeds bounded capacity');
      const written=await this.#repo.put({...loc,kind:'event-subscriptions',eventType,entries},{expectedRevision:record?.revision??null,gm});
      if(written.revision!==(record?.revision??0)+1)fail('SUBSCRIPTION_UNCERTAIN','Index update revision not confirmed');
      const {record:observed}=await this.#read(eventType,gm);
      if(!observed?.entries.some(x=>x.graphId===graph.id&&x.publishedVersion===graph.publishedVersion))fail('SUBSCRIPTION_UNCERTAIN','Subscription update was not verified');
    }
    return {staged:true,graphId:graph.id,publishedVersion:graph.publishedVersion,eventTypes:types};
  }
  async removeGraph(graph){
    const gm=this.#context();
    const types=graphEventTypes(graph);
    for(const eventType of types){
      const {record,loc}=await this.#read(eventType,gm);
      if(!record?.entries.some(x=>x.graphId===graph.id))continue;
      const entries=record.entries.filter(x=>x.graphId!==graph.id);
      await this.#repo.put({...record,...loc,entries},{expectedRevision:record.revision,gm});
      const {record:observed}=await this.#read(eventType,gm);
      if(observed?.entries.some(x=>x.graphId===graph.id))fail('SUBSCRIPTION_UNCERTAIN','Subscriber cleanup cannot be verified');
    }
    return {pruned:true,graphId:graph.id};
  }
}

/** Publication-aware activation wrapper. No global activation list/read. */
export class IndexedGraphRegistry {
  #registry;#catalog;
  constructor({registry,catalog}){
    if(typeof registry?.getPublished!=='function'||typeof registry?.activate!=='function'||typeof catalog?.stage!=='function')fail('INVALID_REGISTRY','Persistent graph registry and subscription catalog required');
    this.#registry=registry;this.#catalog=catalog;
  }
  get scope(){return this.#registry.scope;}
  authorizeMutation(...args){return this.#registry.authorizeMutation?.(...args)??null;}
  inspectAuthority(...args){return this.#registry.inspectAuthority?.(...args)??Promise.resolve(null);}
  assertLocalAuthoring(...args){return this.#registry.assertLocalAuthoring?.(...args);}
  authoringRights(graphId){return this.#registry.authoringRights?.(graphId)??{edit:true,publish:true,activate:true};}
  saveDraft(...args){return this.#registry.saveDraft(...args);}
  getDraft(...args){return this.#registry.getDraft(...args);}
  listDrafts(...args){return this.#registry.listDrafts(...args);}
  publish(...args){return this.#registry.publish(...args);}
  validateCandidate(...args){return this.#registry.validateCandidate?.(...args)??Promise.resolve(null);}
  inspectValidation(...args){return this.#registry.inspectValidation?.(...args)??Promise.resolve({status:'unconfigured',revision:null,report:null,changed:[]});}
  publishedDependencyManifest(...args){return this.#registry.publishedDependencyManifest?.(...args)??Promise.resolve(null);}
  adoptPublishedDependencies(...args){return this.#registry.adoptPublishedDependencies(...args);}
  getPublished(...args){return this.#registry.getPublished(...args);}
  getActivation(...args){return this.#registry.getActivation(...args);}
  getActive(...args){return this.#registry.getActive(...args);}
  async activate(graphId,version,opts={}){
    await this.#registry.authorizeMutation?.(graphId,'activate',opts);
    const next=await this.#registry.getPublished(graphId,version);
    if(!next)fail('NOT_FOUND','Cannot register nonexistent published revision');
    const old=await this.#registry.getActivation(graphId);
    if((old?.revision??null)!==(opts.expectedActivationRevision??null))fail('REVISION_CONFLICT','Activation changed before subscription staging');
    // Stage all new subscriptions. An incomplete index prevents activation.
    await this.#catalog.stage(next);
    const activation=await this.#registry.activate(graphId,version,opts);
    if(!activation.active||activation.publishedVersion!==version)fail('ACTIVATION_UNCERTAIN','Activation not verified');
    // Stale old subscription entries are always filtered by current activation
    // during dispatch. Cleanup failure is nonfatal but needs manual review.
    let cleanupWarning=null;
    if(old?.active&&old.publishedVersion!==version){
      try {const previous=await this.#registry.getPublished(graphId,old.publishedVersion);
        if(previous){
          const keep=new Set(graphEventTypes(next));
          const removed={...previous,nodes:previous.nodes.filter(n=>!isTriggerNode(n)||!keep.has(n.data.eventType))};
          await this.#catalog.removeGraph(removed);
        }
      } catch(e){cleanupWarning=e.code??'SUBSCRIPTION_CLEANUP_REQUIRED';}
    }
    return {...activation,...(cleanupWarning?{cleanupWarning}:{})};
  }
  async deactivate(graphId,opts={}){
    const prior=await this.#registry.getActivation(graphId);
    // Deactivate before cleanup, so an interrupted cleanup cannot execute effects.
    const result=await this.#registry.deactivate(graphId,opts);
    let cleanupWarning=null;
    if(prior?.active){try{const previous=await this.#registry.getPublished(graphId,prior.publishedVersion);
      if(previous)await this.#catalog.removeGraph(previous);
    }catch(e){cleanupWarning=e.code??'SUBSCRIPTION_CLEANUP_REQUIRED';}}
    return {...result,...(cleanupWarning?{cleanupWarning}:{})};
  }
}
