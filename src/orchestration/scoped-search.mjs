/** Bounded GM-only exact-term narrative index.
 * A posting is a hint, never a truth source. Search rechecks canonical record
 * revision and readiness; partially written or outdated postings are ignored.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const SCOPES=/^[a-z][a-z0-9-]{0,32}$/;
const TERMS=/^[\p{L}\p{N}][\p{L}\p{N}_-]{1,45}$/u;
const MAX_TERMS=8,SHARDS=8,MAX_POSTINGS=16;
const INDEXABLE_TYPES=new Set(['faction','npc-agenda','relationship','evidence','investigation','objective','obligation','location','world-fact','story-hook','arc','faction-agenda','npc-schedule','pressure-clock','session-handoff']);
const normalize=s=>typeof s==='string'?s.normalize('NFKC').trim().toLocaleLowerCase('en'):'';
function termsOf(values){
 if(!Array.isArray(values)||values.length<1||values.length>MAX_TERMS)fail('SEARCH_TERMS','Between 1 and 8 explicit search tokens required');
 const out=values.map(normalize);
 if(out.some(t=>!TERMS.test(t))||new Set(out).size!==out.length)fail('SEARCH_TERMS','Invalid or duplicate search tokens');
 return out;
}
const shardOf=hash=>Number.parseInt(hash.slice(0,3),16)%SHARDS;
export class ScopedNarrativeSearch {
 #repo;#gm;#domains;
 constructor({repository,gmProvider,domains=null}={}){
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function')fail('SEARCH_DEPENDENCY','Protected repository and GM context required');
  if(domains!==null&&typeof domains.read!=='function')fail('SEARCH_DEPENDENCY','Canonical domain reader required');
  this.#repo=repository;this.#gm=gmProvider;this.#domains=domains;
 }
 #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
 #scope(scope){if(typeof scope!=='string'||!SCOPES.test(scope))fail('SEARCH_SCOPE','Explicit world search scope required');return scope;}
 async #sourceLoc(scope,id){const h=await sha256Hex(id);return {id,partitionId:`search-source-${scope}-${h.slice(0,2)}`};}
 async #tokenLoc(scope,term,shard){const h=await sha256Hex(term);return {id:`ep:search:${h.slice(0,32)}_${shard}`,partitionId:`search-token-${scope}-${h.slice(0,2)}-${shard}`};}
 async #readSource(scope,id,gm){const loc=await this.#sourceLoc(scope,id);return this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});}
 async #writeSource(scope,id,data,expectedRevision,gm){const loc=await this.#sourceLoc(scope,id);
  return this.#repo.put({id,partitionId:loc.partitionId,kind:'gm-search-source',scope,data},{expectedRevision,gm});
 }
 async index({scope='world',entityId,title,domain,keywords,sourceEventId,expectedRevision=null,canonicalRevision=null}={}){
  this.#scope(scope);assertNarrativeId(entityId);assertNarrativeId(sourceEventId);
  const terms=termsOf(keywords),gm=this.#context();
  if(typeof title!=='string'||!title.trim()||title.length>140||typeof domain!=='string'||!SCOPES.test(domain))fail('SEARCH_CONTENT','Bounded title and domain required');
  if(expectedRevision!==null&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<1))fail('REVISION_CONFLICT','Invalid expected revision');
  const previous=await this.#readSource(scope,entityId,gm);
  if((previous?.revision??null)!==expectedRevision)fail('REVISION_CONFLICT','Canonical search source changed');
  if(canonicalRevision!==null&&(!INDEXABLE_TYPES.has(domain)||!Number.isSafeInteger(canonicalRevision)||canonicalRevision<1||!this.#domains))
   fail('SEARCH_CANONICAL','Verified domain source and positive revision required');
  const data={title:title.trim(),domain,terms,sourceEventId,canonicalRevision,state:'pending'};
  const pending=await this.#writeSource(scope,entityId,data,expectedRevision,gm);
  return this.#complete(scope,entityId,pending,gm);
 }
 /** Read a real domain record by exact ID; never trust search metadata as fact. */
 supportsCanonicalType(type){return INDEXABLE_TYPES.has(type);}
 async indexVerifiedDomain({type,scope='world',entityId}={}){
  this.#scope(scope);assertNarrativeId(entityId);
  if(!this.#domains||!INDEXABLE_TYPES.has(type))fail('SEARCH_CANONICAL','Indexed domain type is not authorized');
  const row=await this.#domains.read(type,scope,entityId);
  if(!row)fail('SEARCH_CANONICAL_MISSING','Canonical domain record does not exist');
  const title=[row.data?.title,row.data?.name,row.data?.label].find(x=>typeof x==='string'&&x.trim())??'';
  if(!title||title.length>140)fail('SEARCH_CANONICAL','Canonical title must be bounded');
  const keywords=[...new Set(title.normalize('NFKC').toLocaleLowerCase('en').match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu)??[])]
   .filter(x=>TERMS.test(x)).slice(0,MAX_TERMS);
  if(keywords.length===0)fail('SEARCH_CANONICAL','Canonical title has no searchable terms');
  const gm=this.#context(),prior=await this.#readSource(scope,entityId,gm);
  if(prior?.data?.state==='ready'&&prior.data.canonicalRevision===row.revision&&prior.data.domain===type&&
    prior.data.title===title&&JSON.stringify(prior.data.terms)===JSON.stringify(keywords))return prior;
  return this.index({scope,entityId,title,domain:type,keywords,sourceEventId:row.sourceEventId,
    expectedRevision:prior?.revision??null,canonicalRevision:row.revision});
 }
 async resume({scope='world',entityId}={}){
  this.#scope(scope);assertNarrativeId(entityId);const gm=this.#context();const pending=await this.#readSource(scope,entityId,gm);
  if(!pending)fail('SEARCH_MISSING','Search source record missing');
  if(pending.data?.state==='ready')return pending;
  if(pending.data?.state!=='pending')fail('SEARCH_STATE','Unsupported index state');
  return this.#complete(scope,entityId,pending,gm);
 }
 async #complete(scope,entityId,pending,gm){
  const {terms}=pending.data;
  if(pending.data.canonicalRevision!==null&&pending.data.canonicalRevision!==undefined){
   if(!this.#domains||!INDEXABLE_TYPES.has(pending.data.domain))fail('SEARCH_CANONICAL','Canonical domain verification unavailable');
   const source=await this.#domains.read(pending.data.domain,scope,entityId);
   if(!source||source.revision!==pending.data.canonicalRevision||source.sourceEventId!==pending.data.sourceEventId)
    fail('SEARCH_SOURCE_CHANGED','Canonical domain changed during indexing');
  }
  for(const term of terms){
   const h=await sha256Hex(entityId),shard=shardOf(h),loc=await this.#tokenLoc(scope,term,shard);
   const token=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});
   if(token&&(token.kind!=='gm-search-token'||token.data.term!==term||!Array.isArray(token.data.entries)))fail('SEARCH_CORRUPT','Wrong token record');
   const prior=token?.data.entries??[];
   let updated=prior.filter(p=>p.entityId!==entityId);
   if(updated.length>=MAX_POSTINGS){
    // Prune only this exact bounded shard; no global scan and no broad deletion.
    const valid=[];
    for(const entry of updated){
     assertNarrativeId(entry.entityId);
     const source=await this.#readSource(scope,entry.entityId,gm);
     if(source?.revision!==entry.sourceRevision||source.data?.state!=='ready'||!source.data.terms?.includes(term))continue;
     if(source.data.canonicalRevision!==null&&source.data.canonicalRevision!==undefined){
      if(!this.#domains||!INDEXABLE_TYPES.has(source.data.domain))continue;
      const canonical=await this.#domains.read(source.data.domain,scope,entry.entityId);
      if(!canonical||canonical.revision!==source.data.canonicalRevision||canonical.sourceEventId!==source.data.sourceEventId)continue;
     }
     valid.push(entry);
    }
    updated=valid;
   }
   if(updated.length>=MAX_POSTINGS)fail('SEARCH_BUCKET_FULL','Search token bucket full; split scope or refine tokens');
   updated.push({entityId,sourceRevision:pending.revision+1});
   await this.#repo.put({id:loc.id,partitionId:loc.partitionId,kind:'gm-search-token',scope,data:{term,entries:updated}},
    {expectedRevision:token?.revision??null,gm});
  }
  const ready=await this.#writeSource(scope,entityId,{...pending.data,state:'ready'},pending.revision,gm);
  if(ready.data.state!=='ready')fail('SEARCH_UNCERTAIN','Index not verified ready');
  return ready;
 }
 async search({scope='world',term,limit=12}={}){
  this.#scope(scope);const gm=this.#context();const [normalized]=termsOf([term]);
  if(!Number.isSafeInteger(limit)||limit<1||limit>32)fail('SEARCH_BUDGET','Invalid result limit');
  let candidates=0,eligible=0,incomplete=false;const results=[];
  for(let shard=0;shard<SHARDS;shard++){
   const loc=await this.#tokenLoc(scope,normalized,shard);
   const row=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});
   if(!row)continue;
   if(row.kind!=='gm-search-token'||row.data?.term!==normalized||!Array.isArray(row.data?.entries)||row.data.entries.length>MAX_POSTINGS)
    fail('SEARCH_CORRUPT','Untrusted token index');
   for(const entry of row.data.entries){
    candidates++;
    assertNarrativeId(entry.entityId);
    const source=await this.#readSource(scope,entry.entityId,gm);
    if(!source||source.data?.state!=='ready'||source.revision!==entry.sourceRevision||!source.data.terms.includes(normalized)){
      incomplete=true;continue;
    }
    if(source.data.canonicalRevision!==null&&source.data.canonicalRevision!==undefined){
     if(!this.#domains||!INDEXABLE_TYPES.has(source.data.domain)){incomplete=true;continue;}
     const canonical=await this.#domains.read(source.data.domain,scope,entry.entityId);
     if(!canonical||canonical.revision!==source.data.canonicalRevision||canonical.sourceEventId!==source.data.sourceEventId){
      incomplete=true;continue;
     }
    }
    eligible++;
    if(results.length<limit)results.push({id:source.id,title:source.data.title,domain:source.data.domain});
   }
  }
  return {kind:'gm-scoped-search',scope,term:normalized,results,hasMore:eligible>limit,incomplete,scannedTokenShards:SHARDS,visibility:'gm-only'};
 }
}
