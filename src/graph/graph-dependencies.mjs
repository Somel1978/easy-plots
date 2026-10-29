/** Exact static dependencies. Runtime observations belong to each event/frame. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {clone,deepFreeze,assertNarrativeId} from '../contracts/record.mjs';
import {GRAPH_NODE_TYPES,ALL_EFFECT_NODE_PROVIDER} from './node-catalog.mjs';
import * as logic from './logic-nodes.mjs';
import * as typed from './typed-data.mjs';
import * as trigger from './trigger-contract.mjs';
import * as conditions from './conditions.mjs';
import * as state from './state-read.mjs';
import * as joins from './flow-join.mjs';
import * as calls from './subgraph-call.mjs';
import * as convergence from './convergence.mjs';
import * as advanced from './advanced-logic.mjs';
import {CANONICAL_EVENT_SCHEMA_V1} from '../contracts/canonical-event-schema.mjs';
import {contractHash,callableContract,isContractFingerprint} from './dependency-contracts.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const choose=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,clone(value[key])]));
const keyOf=entry=>`${entry.kind}:${entry.id}`;
export function executionGraph(graph){
 if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))fail('INVALID_GRAPH','A graph with node and edge arrays is required');
 return {...choose(graph,['kind','schemaVersion','id','rootNodeId','requiredCapabilityIds']),
  nodes:graph.nodes.map(node=>choose(node,['id','graphId','typeId','providerVersion','disabled','accessClass','ports','data'])),
  edges:graph.edges.map(edge=>choose(edge,['id','kind','source','target']))};
}
export const executionFingerprint=graph=>contractHash(executionGraph(graph));
export function effectProviderId(node){return node.typeId==='core.milestone.qualify'?'narrative.qualify-milestone':ALL_EFFECT_NODE_PROVIDER[node.typeId]??(node.typeId==='core.effect.proposal'?node.data?.providerId:null);}
/** Core ABI declarations are versioned with executable schemas. A changed
 * closed-over implementation policy must explicitly replace its descriptor. */
export class CoreNodeContractCatalog {
 #items=new Map();
 constructor(){for(const typeId of GRAPH_NODE_TYPES){
  const group=typeId===convergence.CONVERGENCE_NODE_TYPE?convergence:trigger.TRIGGER_NODE_TYPES.includes(typeId)?trigger:typed.DATA_NODE_TYPES.includes(typeId)||typeId==='core.branch.data'?typed:advanced.ADVANCED_LOGIC_TYPES.includes(typeId)?advanced:logic.LOGIC_NODE_TYPES.includes(typeId)?logic:typeId===state.STATE_READ_TYPE?state:typeId==='core.flow.join'?joins:typeId==='core.subgraph.call'?calls:['core.condition','core.branch.condition'].includes(typeId)?conditions:{};
  const logicDefinition=logic.LOGIC_NODE_CONFIG[typeId];
  this.define(typeId,{version:'1.0.0',descriptor:{executionABI:'easy-plots-published-runtime-v1',typeId,providerId:ALL_EFFECT_NODE_PROVIDER[typeId]??null,...(logicDefinition?{data:logicDefinition.data,outputs:logicDefinition.outputs}:{}),callbacks:callableContract(group)}});
 }}
 define(id,{version,descriptor,fingerprint}={}){
  if(typeof id!=='string'||!/^core\.[a-z0-9.-]+$/.test(id)||!/^\d+\.\d+\.\d+$/.test(version??'')||fingerprint!==undefined&&!isContractFingerprint(fingerprint))fail('NODE_CONTRACT','A versioned core contract and SHA-256 fingerprint or JSON descriptor are required');
  if(fingerprint===undefined&&descriptor===undefined)fail('NODE_CONTRACT','An explicit executable contract descriptor is required');
  const value=deepFreeze({id,version,fingerprint:fingerprint??contractHash({id,version,descriptor})});this.#items.set(id,value);return clone(value);
 }
 contract(id){return clone(this.#items.get(id)??null);}
}
const providerContract=(registry,id)=>{
 const declared=registry?.contract?.(id);if(declared)return declared;
 const p=registry?.get?.(id);return p?{id,version:p.version,fingerprint:p.contractFingerprint??contractHash({id,version:p.version,callbacks:callableContract({validate:p.validate,apply:p.apply,verify:p.verify,get:p.get})})}:null;
};
/** Registries may be supplied lazily because native providers are composed
 * after the graph repository. No provider loader/evaluator runs here. */
export class GraphDependencyResolver {
 #providers;#extensions;#read;#actions;#nodes;#maxGraphs;#maxNodes;#readManifest;#external;
 constructor({providers=null,extensions=null,readPublished=null,readPublishedManifest=null,externalDependencies=null,actions=null,nodeContracts=new CoreNodeContractCatalog(),maxGraphs=16,maxNodes=2500}={}){
  if(readPublished!==null&&typeof readPublished!=='function'||!Number.isInteger(maxGraphs)||maxGraphs<1||maxGraphs>32||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>2500)fail('DEPENDENCY_CONFIG','Bounded dependency graph limits and a published reader are required');
  if(readPublishedManifest!==null&&typeof readPublishedManifest!=='function'||externalDependencies!==null&&typeof externalDependencies!=='function')fail('DEPENDENCY_CONFIG','Published manifest and external dependency readers must be callable');
  this.#providers=providers;this.#extensions=extensions;this.#read=readPublished;this.#readManifest=readPublishedManifest;this.#external=externalDependencies;this.#actions=actions;this.#nodes=nodeContracts;this.#maxGraphs=maxGraphs;this.#maxNodes=maxNodes;
 }
 providers(){return typeof this.#providers==='function'?this.#providers():this.#providers;}
 extensions(){return typeof this.#extensions==='function'?this.#extensions():this.#extensions;}
 nodeContract(typeId){return typeId.startsWith('core.')?this.#nodes?.contract?.(typeId):this.extensions()?.contract?.(typeId);}
 async capture(graph,{capabilities=[]}={}){
  assertNarrativeId(graph?.id);const dependencies=new Map(),issues=[],seen=new Map(),visiting=new Set();let nodeCount=0;
  const add=(kind,id,contract,details={})=>{
   if(!contract||typeof contract.version!=='string'||!isContractFingerprint(contract.fingerprint)){issues.push({severity:'blocker',code:'DEPENDENCY_UNAVAILABLE',dependencyKind:kind,dependencyId:id,message:`Required ${kind} contract ${id} is unavailable`,remediation:'Install and explicitly validate the exact required contract.'});return;}
   const entry={kind,id,version:contract.version,fingerprint:contract.fingerprint,...details},prior=dependencies.get(keyOf(entry));
   if(prior&&(prior.version!==entry.version||prior.fingerprint!==entry.fingerprint))fail('DEPENDENCY_CONFLICT','One publication cannot require two contracts for the same dependency');
   dependencies.set(keyOf(entry),entry);
  };
  const walk=async(current,isRoot=false)=>{
   const selection=`${current.id}@${current.publishedVersion??'candidate'}`;
   if(visiting.has(current.id))fail('SUBGRAPH_RECURSION','Recursive published graph dependency');
   if(seen.has(selection))return seen.get(selection);
   if(seen.size>=this.#maxGraphs)fail('DEPENDENCY_BUDGET','Published dependency graph count exceeds its bound');
   const fp=executionFingerprint(current);seen.set(selection,fp);visiting.add(current.id);
   if((nodeCount+=current.nodes.length)>this.#maxNodes)fail('DEPENDENCY_BUDGET','Transitive publication node count exceeds its bound');
   for(const node of current.nodes){
    const contract=this.nodeContract(node.typeId);add('node',node.typeId,contract);
    if(contract&&node.providerVersion!==undefined&&node.providerVersion!==contract.version)issues.push({severity:'blocker',code:'NODE_CONTRACT_VERSION',nodeId:node.id,graphId:current.id,message:'Authored node requires a different provider version',remediation:'Restore that provider version or migrate and revalidate the node.'});
    if(trigger.isTriggerNode(node))add('event','canonical-event',{version:'1.0.0',fingerprint:contractHash(CANONICAL_EVENT_SCHEMA_V1)});
    const providerId=effectProviderId(node);
    if(providerId){
     add('provider',providerId,providerContract(this.providers(),providerId));
     if(node.data?.payload?.actionContract!==undefined||node.data?.payload?.actionVersion!==undefined){
      const payload=node.data.payload,actions=typeof this.#actions==='function'?this.#actions():this.#actions,action=actions?.describe?.(providerId);
      if(!isContractFingerprint(payload.actionContract)||typeof payload.actionVersion!=='string'||!action||action.version!==payload.actionVersion||action.contractFingerprint!==payload.actionContract)issues.push({severity:'blocker',code:'ACTION_CONTRACT_STALE',nodeId:node.id,graphId:current.id,message:'Published action declaration is unavailable or changed',remediation:'Restore the exact action declaration or explicitly migrate its payload.'});
      else add('action',providerId,{version:action.version,fingerprint:action.contractFingerprint},{targetProviderId:action.targetProviderId,targetVersion:action.targetVersion});
     }
     if(this.#external){
      const external=await this.#external({node,graph:current,providerId,providers:this.providers()});
      if(external){
       if(!Array.isArray(external.dependencies)||!Array.isArray(external.issues))fail('DEPENDENCY_EXTERNAL_CONTRACT','External dependencies and issues arrays are required');
       for(const row of external.dependencies){if(!['provider','external'].includes(row.kind))fail('DEPENDENCY_EXTERNAL_CONTRACT','Only exact provider and external source dependencies may be added');add(row.kind,row.id,row);}
       issues.push(...external.issues.map(clone));
      }
     }
    }
    const childCall=['core.subgraph.call','core.subgraph.mixed','core.data.call'].includes(node.typeId),completion=node.typeId==='core.trigger.operations-completed';
    if(!childCall&&!completion)continue;
    const id=completion?node.data?.sourceGraphId:node.data?.graphId,version=completion?node.data?.sourcePublishedVersion:node.data?.publishedVersion;
    if(typeof id!=='string'||!Number.isSafeInteger(version)||version<1){issues.push({severity:'blocker',code:'SUBGRAPH_CONTRACT',nodeId:node.id,message:'A positive immutable child/source graph version is required',remediation:'Select an exact published graph version.'});continue;}
    const child=await this.#read?.(id,version);
    if(!child||child.id!==id||child.publishedVersion!==version){issues.push({severity:'blocker',code:'SUBGRAPH_UNAVAILABLE',nodeId:node.id,graphId:current.id,message:`Pinned graph ${id} version ${version} is unavailable`,remediation:'Restore this immutable graph version before publishing.'});continue;}
    let childManifest=null;
    if(childCall){
     childManifest=child.dependencyManifest??await this.#readManifest?.(child);
     if(!childManifest)issues.push({severity:'blocker',code:'SUBGRAPH_DEPENDENCIES_UNTRACKED',nodeId:node.id,graphId:current.id,message:'Pinned child publication has no validated dependency manifest',remediation:'Explicitly validate and adopt the legacy child publication before this parent.'});
     else {assertDependencyManifest(childManifest);if(childManifest.graphId!==child.id||childManifest.executionFingerprint!==executionFingerprint(child))fail('DEPENDENCY_MANIFEST_CORRUPT','Pinned child manifest does not describe the immutable child graph');}
    }
    if(childCall&&node.typeId!=='core.subgraph.call')try{typed.assertPublishedDataInterface(node,child);}catch(error){issues.push({severity:'blocker',code:error.code??'DATA_INTERFACE_STALE',nodeId:node.id,message:error.message,remediation:'Rebind the exact published child interface and revalidate.'});}
    if(completion&&(!Array.isArray(node.data.requiredNodeIds)||node.data.requiredNodeIds.some(id=>!child.nodes.some(n=>n.id===id&&!n.disabled&&(effectProviderId(n)||['core.subgraph.call','core.subgraph.mixed'].includes(n.typeId))))))issues.push({severity:'blocker',code:'OPERATION_SOURCE_CONTRACT',nodeId:node.id,message:'Completion trigger requires implemented operations in the exact source graph',remediation:'Select valid source operation node IDs.'});
    // Completion references observe provenance; they do not invoke the source.
    const childFp=completion?executionFingerprint(child):await walk(child);
    add('graph',`${id}@${version}`,{version:String(version),fingerprint:childFp},{graphId:id,publishedVersion:version,interfaceFingerprint:contractHash(typed.publishedDataInterface(child))});
    if(childManifest&&childManifest.dependencies.some(expected=>contractHash(expected)!==contractHash(dependencies.get(keyOf(expected))??null)))issues.push({severity:'blocker',code:'SUBGRAPH_DEPENDENCIES_STALE',nodeId:node.id,graphId:current.id,message:'Pinned child publication requires different execution contracts',remediation:'Restore its exact contracts or publish a migrated child and explicitly rebind this parent.'});
   }
   for(const id of current.requiredCapabilityIds??[]){
    if(!capabilities.includes(id))issues.push({severity:'blocker',code:'MISSING_CAPABILITY',graphId:current.id,message:`Required capability ${id} is unavailable`,remediation:'Enable the named capability and revalidate.'});
    add('capability',id,{version:'1',fingerprint:contractHash({id,available:capabilities.includes(id)})});
   }
   visiting.delete(current.id);return fp;
  };
  const rootFingerprint=await walk(graph,true),entries=[...dependencies.values()].sort((a,b)=>keyOf(a).localeCompare(keyOf(b))),fingerprint=contractHash(entries);
  return {manifest:{kind:'graph-dependency-manifest',schemaVersion:'1.0.0',graphId:graph.id,executionFingerprint:rootFingerprint,dependencies:entries,fingerprint},issues,nodeCount,graphCount:seen.size};
 }
 async compare(manifest,graph,options={}){
  assertDependencyManifest(manifest);
  const captured=await this.capture(graph,options),actual=captured.manifest,old=new Map(manifest.dependencies.map(x=>[keyOf(x),x])),next=new Map(actual.dependencies.map(x=>[keyOf(x),x]));
  const changed=[...new Set([...old.keys(),...next.keys()])].filter(key=>contractHash(old.get(key)??null)!==contractHash(next.get(key)??null));
  if(manifest.graphId!==graph.id||manifest.executionFingerprint!==actual.executionFingerprint)changed.unshift('graph:execution');
  return {current:changed.length===0&&captured.issues.every(x=>x.severity!=='blocker'),changed,issues:captured.issues,manifest:actual};
 }
}
export function assertDependencyManifest(manifest){
 if(!manifest||manifest.kind!=='graph-dependency-manifest'||manifest.schemaVersion!=='1.0.0'||typeof manifest.graphId!=='string'||!isContractFingerprint(manifest.executionFingerprint)||!Array.isArray(manifest.dependencies)||manifest.dependencies.length>5200||!isContractFingerprint(manifest.fingerprint)||manifest.fingerprint!==contractHash(manifest.dependencies))fail('DEPENDENCY_MANIFEST_CORRUPT','Dependency manifest integrity failed');
 const seen=new Set();for(const entry of manifest.dependencies){if(!entry||!['node','provider','event','action','graph','capability','external'].includes(entry.kind)||typeof entry.id!=='string'||typeof entry.version!=='string'||!isContractFingerprint(entry.fingerprint)||seen.has(keyOf(entry)))fail('DEPENDENCY_MANIFEST_CORRUPT','Invalid or repeated dependency contract');seen.add(keyOf(entry));}
 return manifest;
}
