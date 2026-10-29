/** Bounded LRU of static indexes only. Every hit checks exact dependencies;
 * event values, state, rolls, visits, joins and guards stay in fresh frames. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {clone,deepFreeze} from '../contracts/record.mjs';
import {executionGraph,assertDependencyManifest} from './graph-dependencies.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
class ReadonlyIndex {
 #map;
 constructor(entries){this.#map=new Map(entries);Object.freeze(this);}
 get(key){return this.#map.get(key);}
 has(key){return this.#map.has(key);}
 get size(){return this.#map.size;}
 keys(){return this.#map.keys();}
 values(){return this.#map.values();}
 entries(){return this.#map.entries();}
 [Symbol.iterator](){return this.#map[Symbol.iterator]();}
}
function compile(graph,manifest){
 const source=deepFreeze(executionGraph(graph)),nodes=new ReadonlyIndex(source.nodes.map(node=>[node.id,node])),edges=new Map(),incoming=new Map(),dataIncoming=new Map();
 for(const edge of source.edges){
  if(['flow','condition','event'].includes(edge.kind)){
   const list=edges.get(edge.source.nodeId)??[];list.push({edgeId:edge.id,targetId:edge.target.nodeId,portId:edge.source.portId});edges.set(edge.source.nodeId,list);
   const predecessor=incoming.get(edge.target.nodeId)??new Set();predecessor.add(edge.id);incoming.set(edge.target.nodeId,predecessor);
  }else if(edge.kind==='data'){
   const key=`${edge.target.nodeId}|${edge.target.portId}`;
   if(dataIncoming.has(key))fail('DATA_CARDINALITY','Compiled data inputs require one producer');dataIncoming.set(key,edge.source);
  }
 }
 return Object.freeze({kind:'compiled-graph-indexes',graphId:graph.id,executionFingerprint:manifest.executionFingerprint,dependencyFingerprint:manifest.fingerprint,nodes,
  edges:new ReadonlyIndex([...edges].map(([id,list])=>[id,deepFreeze(list)])),
  // Runtime only reads predecessor size/IDs; expose frozen arrays with size.
  incoming:new ReadonlyIndex([...incoming].map(([id,set])=>[id,Object.freeze({size:set.size,has:key=>set.has(key),[Symbol.iterator]:()=>set.values()})])),
  dataIncoming:new ReadonlyIndex(dataIncoming),nodeCount:source.nodes.length,edgeCount:source.edges.length});
}
export class CompiledGraphCache {
 #dependencies;#entries=new Map();#max;#maxNodes;#nodes=0;#stats={hits:0,misses:0,compilations:0,invalidations:0,evictions:0};
 constructor({dependencies,maxEntries=32,maxNodes=10000}={}){
  if(typeof dependencies?.compare!=='function'||!Number.isInteger(maxEntries)||maxEntries<1||maxEntries>128||!Number.isInteger(maxNodes)||maxNodes<1||maxNodes>100000)fail('COMPILE_CACHE_CONFIG','A dependency resolver and bounded cache capacities are required');
  this.#dependencies=dependencies;this.#max=maxEntries;this.#maxNodes=maxNodes;
 }
 #remove(key,reason){const old=this.#entries.get(key);if(!old)return;this.#entries.delete(key);this.#nodes-=old.compiled.nodeCount;this.#stats[reason]++;}
 async get(graph,{manifest=graph?.dependencyManifest,capabilities=[]}={}){
  if(!manifest)fail('GRAPH_DEPENDENCIES_UNTRACKED','Validate and explicitly adopt this legacy publication before execution');
  assertDependencyManifest(manifest);
  const comparison=await this.#dependencies.compare(manifest,graph,{capabilities});
  if(!comparison.current){this.invalidate({graphId:graph.id});fail('GRAPH_DEPENDENCIES_STALE',`Published graph contracts changed: ${comparison.changed.join(', ')||comparison.issues.map(x=>x.code).join(', ')}`);}
  const key=`${graph.id}|${manifest.executionFingerprint}|${manifest.fingerprint}`,old=this.#entries.get(key);
  if(old){this.#entries.delete(key);this.#entries.set(key,old);this.#stats.hits++;return old.compiled;}
  this.#stats.misses++;const compiled=compile(graph,manifest);this.#stats.compilations++;
  if(compiled.nodeCount>this.#maxNodes)fail('COMPILE_CACHE_BUDGET','Graph exceeds the compiled cache node bound');
  // A stale graph version does not evict distinct immutable valid versions.
  this.#entries.set(key,{manifest:clone(manifest),compiled});this.#nodes+=compiled.nodeCount;
  while(this.#entries.size>this.#max||this.#nodes>this.#maxNodes)this.#remove(this.#entries.keys().next().value,'evictions');
  return compiled;
 }
 invalidate({kind=null,id=null,graphId=null}={}){
  let invalidated=0;
  for(const [key,entry] of this.#entries)if(graphId?entry.manifest.graphId===graphId:kind&&id?entry.manifest.dependencies.some(dep=>dep.kind===kind&&dep.id===id):false){this.#remove(key,'invalidations');invalidated++;}
  return {invalidated};
 }
 clear(){for(const key of this.#entries.keys())this.#remove(key,'evictions');}
 get instrumentation(){return {...this.#stats,entries:this.#entries.size,nodes:this.#nodes,maxEntries:this.#max,maxNodes:this.#maxNodes};}
}
