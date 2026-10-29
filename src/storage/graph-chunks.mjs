/** Immutable, bounded, GM-only graph page storage. One targeted published graph
 * is reconstructed on demand; unrelated campaign graphs are not enumerated.
 * Chunks are written and read back BEFORE the manifest is made discoverable.
 * Partial writes leave unreachable chunks, never half-active graph snapshots.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {validateGraph} from '../graph/validate.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const SCOPE=/^[a-z][a-z0-9-]{0,40}$/;
const MAX_PART_BYTES=7600,MAX_PAGES=120,MAX_GRAPH_BYTES=850_000; // bounded immutable snapshot; native index shards split independently
const bytes=x=>new TextEncoder().encode(JSON.stringify(x)).length;
// Publication identity must not depend on JSON object key insertion order.
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):
  Array.isArray(x)?`[${x.map(canonical).join(',')}]`:
  `{${Object.keys(x).sort().map(k=>`${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
export function splitGraphPages(graph,{maxPageBytes=MAX_PART_BYTES}={}){
  if(!Number.isInteger(maxPageBytes)||maxPageBytes<500||maxPageBytes>MAX_PART_BYTES)fail('GRAPH_BUDGET','Invalid page size');
  const pages=[];
  for(const kind of ['nodes','edges']){
    let current=[];
    for(const item of graph[kind]??[]){
      if(bytes(item)>maxPageBytes-160)fail('GRAPH_CHUNK_BUDGET','One graph element exceeds chunk limit');
      if(current.length&&bytes([...current,item])>maxPageBytes){pages.push({kind,records:current});current=[];}
      current.push(item);
    }
    if(current.length)pages.push({kind,records:current});
  }
  if(pages.length>MAX_PAGES)fail('GRAPH_BUDGET','Too many graph partitions');
  return pages;
}
export class ImmutableGraphPageStore {
  #repo;#gm;#scope;
  constructor({repository,gmProvider,scope='main'}={}){
    if(!repository?.read||!repository?.put||typeof gmProvider!=='function'||!SCOPE.test(scope))fail('GRAPH_REPOSITORY','Scoped GM repository required');
    this.#repo=repository;this.#gm=gmProvider;this.#scope=scope;
  }
  #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
  async #loc(graphId,revision){
    assertNarrativeId(graphId);
    if(!graphId.startsWith('ep:graph:')||!Number.isInteger(revision)||revision<1)fail('GRAPH_ID','Published graph ID and revision required');
    const h=await sha256Hex(`${graphId}|${revision}|${this.#scope}`);
    return {id:`ep:graphmanifest:${h.slice(0,24)}`,partitionId:`graphmanifest-${this.#scope}`,token:h.slice(0,24)};
  }
  async #read(loc){const gm=this.#context(),row=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});
    if(row&&(row.id!==loc.id||row.partitionId!==loc.partitionId))fail('GRAPH_CORRUPT','Graph storage record identity mismatch');
    if(!row&&typeof this.#repo.indexStatus==='function'&&await this.#repo.indexStatus(loc.id,{partitionId:loc.partitionId,gm})!==null)fail('INDEX_UNCERTAIN','Known graph index has no payload');
    if(row&&typeof this.#repo.hasReadyIndex==='function'&&!await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm}))fail('INDEX_UNCERTAIN','Graph index incomplete');
    return row;
  }
  async manifest(graphId,revision){const loc=await this.#loc(graphId,revision),row=await this.#read(loc);
    if(!row)return null;
    if(row.kind!=='immutable-graph-manifest'||row.graphId!==graphId||row.publishedRevision!==revision||row.pages?.length>MAX_PAGES||!Array.isArray(row.pages))fail('GRAPH_CORRUPT','Invalid graph manifest');
    return row;
  }
  async publish(graph,{revision,capabilities=[]}={}){
    this.#context();validateGraph(graph,{requiredCapabilities:capabilities});
    if(bytes(graph)>MAX_GRAPH_BYTES)fail('GRAPH_BUDGET','Graph exceeds bounded snapshot size');
    const loc=await this.#loc(graph.id,revision);
    const existing=await this.manifest(graph.id,revision);
    const fingerprint=await sha256Hex(canonical(graph));
    if(existing){if(existing.fingerprint!==fingerprint)fail('IMMUTABLE_SNAPSHOT_CONFLICT','Published revision cannot be overwritten');return existing;}
    const {nodes,edges,...meta}=clone(graph);
    if(bytes(meta)>4000)fail('GRAPH_BUDGET','Graph metadata exceeds safe manifest size');
    const pages=splitGraphPages(graph),descriptors=[];
    for(let index=0;index<pages.length;index++){
      const page=pages[index],content={kind:page.kind,records:page.records},digest=await sha256Hex(JSON.stringify(content));
      const part={id:`ep:graphpage:${loc.token}_${index}`,partitionId:`graphpage-${this.#scope}-${loc.token.slice(0,2)}`};
      const prior=await this.#read(part);
      if(prior){if(prior.digest!==digest||prior.manifestId!==loc.id)fail('GRAPH_CHUNK_CONFLICT','Immutable graph chunk collision');}
      else await this.#repo.put({...part,kind:'immutable-graph-page',manifestId:loc.id,digest,content},
        {expectedRevision:null,gm:this.#context()});
      const confirmed=await this.#read(part);
      if(!confirmed||confirmed.digest!==digest||JSON.stringify(confirmed.content)!==JSON.stringify(content))fail('GRAPH_CHUNK_UNCERTAIN','Graph chunk not durably verified');
      descriptors.push({...part,digest,kind:page.kind,count:page.records.length});
    }
    await this.#repo.put({id:loc.id,partitionId:loc.partitionId,kind:'immutable-graph-manifest',
      graphId:graph.id,publishedRevision:revision,fingerprint,metadata:meta,pages:descriptors},
      {expectedRevision:null,gm:this.#context()});
    const saved=await this.manifest(graph.id,revision);
    if(!saved||saved.fingerprint!==fingerprint)fail('GRAPH_MANIFEST_UNCERTAIN','Published graph manifest not read back');
    return saved;
  }
  async readPage(graphId,revision,index){
    const manifest=await this.manifest(graphId,revision);
    if(!manifest)fail('GRAPH_NOT_FOUND','Published graph manifest not found');
    if(!Number.isInteger(index)||index<0||index>=manifest.pages.length)fail('GRAPH_PAGE','Page outside published manifest');
    const descriptor=manifest.pages[index],row=await this.#read(descriptor);
    if(!row||row.kind!=='immutable-graph-page'||row.manifestId!==manifest.id||
      row.digest!==descriptor.digest||await sha256Hex(JSON.stringify(row.content))!==descriptor.digest)
      fail('GRAPH_CORRUPT','Published graph chunk failed immutable verification');
    return clone(row.content);
  }
  async getGraph(graphId,revision){
    const manifest=await this.manifest(graphId,revision);if(!manifest)return null;
    const graph=clone({...manifest.metadata,nodes:[],edges:[]});
    for(let index=0;index<manifest.pages.length;index++){
      const data=await this.readPage(graphId,revision,index);
      graph[data.kind].push(...data.records);
    }
    if(await sha256Hex(canonical(graph))!==manifest.fingerprint)fail('GRAPH_CORRUPT','Reconstructed snapshot differs from published fingerprint');
    validateGraph(graph);return graph;
  }
}
