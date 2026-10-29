/**
 * Bounded, indexed Foundry world Compendium prototype. Production disabled until
 * LIVE GM/player tests prove protected pack, index and bootstrap confidentiality.
 * Foundry Document updates do not provide atomic compare-and-swap.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {isEncryptedNativePack} from './encrypted-native-pack.mjs';
import {NATIVE_PARTITION_POLICY,storageTierForRecord,assertPartitionId,partitionManifestKey,partitionIndexKey,hashBit} from './partition-policy.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const NS='easy-plots', SCHEMA=1, MAX_PAGES=8, PAGE_SIZE=32, MAX_BYTES=65536;
const keyRecord=(partitionId,id)=>`ep:record:${partitionId}:${id}`;
const MAX_DEPTH=NATIVE_PARTITION_POLICY.maxDepth;
export async function opaqueFoundryId(key){
  if(typeof key!=='string'||!key.length)fail('INVALID_STORAGE_KEY','Key required');
  return (await sha256Hex(key)).slice(0,16);
}
export function verifyProtectedPackConfiguration({gameInstance,pack,attestation,coreBuild}){
  if(!gameInstance?.user?.isGM)fail('GM_REQUIRED','GM required');
  if(pack?.documentName!=='JournalEntry'||pack?.metadata?.packageType!=='world'||pack.locked||!pack.collection)
    fail('PACK_INVALID','Unlocked world-owned JournalEntry pack required');
  const encrypted=attestation?.level==='encrypted-vault'&&isEncryptedNativePack(pack)&&attestation.vaultVersion===1;
  if((!encrypted&&attestation?.level!=='live-multiplayer')||attestation.worldId!==gameInstance.world?.id||
    attestation.coreBuild!==coreBuild||attestation.packId!==pack.collection||
    (!encrypted&&(!attestation.playerIndexDenied||!attestation.playerDocumentDenied||!attestation.playerBootstrapDenied)))
    fail('PACK_UNVERIFIED','Live multiplayer access tests required for exact world, pack and build');
  if(!Array.isArray(gameInstance.users?.contents)||typeof pack.getUserLevel!=='function')
    fail('PACK_PERMISSIONS_UNAVAILABLE','Cannot verify player roles');
  for(const user of gameInstance.users.contents)if(!user.isGM && pack.getUserLevel(user)!==0)
    fail('PACK_PUBLIC','Protected pack is accessible to a non-GM');
}
const rawFlag=doc=>doc?.getFlag?.(NS,'storage')??doc?.flags?.[NS]?.storage;
/**
 * Every write is locally serialized via writer.withWriter and read back.
 * Never claims CAS or safe concurrent co-GM writes.
 */
export class NativePackRepository {
  #game;#pack;#proof;#coreBuild;#writer;#reads=0;
  constructor({gameInstance,pack,attestation,coreBuild,writer}){
    if(typeof writer?.withWriter!=='function')fail('WRITER_REQUIRED','Designated GM writer required');
    this.#game=gameInstance;this.#pack=pack;this.#proof=attestation;this.#coreBuild=coreBuild;this.#writer=writer;
  }
  #check(gm){
    assertLocalGM(gm);
    if(gm.userId!==this.#game?.user?.id)fail('GM_SESSION_MISMATCH','Wrong GM session');
    this.#writer.assertEligible(gm);
    verifyProtectedPackConfiguration({gameInstance:this.#game,pack:this.#pack,attestation:this.#proof,coreBuild:this.#coreBuild});
  }
  async #raw(key,gm){
    this.#check(gm);this.#reads++;
    // getDocuments is a native server-backed fetch, unlike getDocument which
    // can return the client's cached Document and give a false read-back.
    if(typeof this.#pack.getDocuments!=='function')fail('NATIVE_API_MISSING','Server-backed pack getDocuments required');
    const id=await opaqueFoundryId(key);
    const docs=await this.#pack.getDocuments({_id:id});
    this.#check(gm);
    const doc=docs?.find(x=>x.id===id || x._id===id)??null;
    if(!doc)return null;
    const value=rawFlag(doc);
    if(value?.key!==key||value?.schema!==SCHEMA)fail('PACK_CORRUPT','Document ID collision or unsupported record schema');
    return {doc,value:clone(value)};
  }
  async #persist(key,payload,gm,expected){
    this.#check(gm);
    const prior=await this.#raw(key,gm);
    if((prior?.value.revision??null)!==expected)fail('REVISION_CONFLICT','Pack record changed');
    const value={schema:SCHEMA,key,revision:(prior?.value.revision??0)+1,payload:clone(payload)};
    if(new TextEncoder().encode(JSON.stringify(value)).byteLength>MAX_BYTES)fail('RECORD_TOO_LARGE','Native record exceeds bounded size');
    if(prior)await prior.doc.update({[`flags.${NS}.storage`]:value});
    else {
      const cls=this.#pack.documentClass;
      if(typeof cls?.createDocuments!=='function')fail('NATIVE_API_MISSING','JournalEntry createDocuments missing');
      const id=await opaqueFoundryId(key);
      const docs=await cls.createDocuments([{_id:id,name:`Easy Plots ${id}`,flags:{[NS]:{storage:value}}}],
        {pack:this.#pack.collection,keepId:true});
      if(!Array.isArray(docs)||docs.length!==1)fail('WRITE_UNCERTAIN','Document creation was not confirmed');
    }
    const observed=await this.#raw(key,gm);
    if(observed?.value.revision!==value.revision||JSON.stringify(observed.value.payload)!==JSON.stringify(value.payload))
      fail('WRITE_UNCERTAIN','Pack read-back differs from committed data');
    return value.revision;
  }
  async #manifest(partitionId,path,gm,{required=false}={}){
    const raw=await this.#raw(partitionManifestKey(partitionId,path),gm);
    if(!raw){if(required)fail('INDEX_UNCERTAIN','Known shard manifest is missing');return null;}
    const m=raw.value.payload;
    if(m?.kind!=='adaptive-partition'||m.partitionId!==partitionId||m.path!==path||m.policyVersion!==1||
      !['leaf','copying','ready'].includes(m.state)||!Array.isArray(m.pageCounts)||m.pageCounts.length!==MAX_PAGES||
      m.pageCounts.some(n=>!Number.isInteger(n)||n<0||n>PAGE_SIZE))fail('PARTITION_CORRUPT','Invalid partition manifest');
    if(m.state!=='leaf'&&(!Array.isArray(m.source)||m.source.length!==MAX_PAGES||
      !Number.isInteger(m.nextPage)||m.nextPage<0||m.nextPage>MAX_PAGES||path.length>=MAX_DEPTH||
      m.source.some(x=>!Number.isSafeInteger(x.revision)||x.revision<1||!Number.isInteger(x.count)||x.count<1||x.count>PAGE_SIZE||!/^[a-f0-9]{64}$/.test(x.digest??''))))fail('PARTITION_CORRUPT','Invalid migration manifest');
    if(m.state==='ready'&&m.nextPage!==MAX_PAGES)fail('PARTITION_CORRUPT','Incomplete split published as ready');
    return {data:m,revision:raw.value.revision};
  }
  async #saveManifest(partitionId,path,data,revision,gm){
    return this.#persist(partitionManifestKey(partitionId,path),data,gm,revision);
  }
  async #page(partitionId,page,gm,path='',manifest=null){
    const stored=(await this.#raw(partitionIndexKey(partitionId,page,path),gm))?.value;
    if(!stored&&manifest?.data.pageCounts[page]>0)fail('INDEX_UNCERTAIN','Known native index page is missing');
    const entries=stored?stored.payload?.entries:[];
    if(!Array.isArray(entries)||entries.length>PAGE_SIZE)fail('INDEX_CORRUPT','Invalid bounded index');
    if(manifest&&entries.length<manifest.data.pageCounts[page])fail('INDEX_UNCERTAIN','Known index entries are missing');
    const ids=new Set();
    for(const e of entries){
      assertNarrativeId(e?.id);
      if(ids.has(e.id)||!['pending','prepared','ready'].includes(e.status)||
        e.tier!==undefined&&!['shard','historical'].includes(e.tier)||e.kind!==undefined&&(typeof e.kind!=='string'||e.kind.length>120))fail('INDEX_CORRUPT','Invalid or duplicate index entry');
      if(path){const h=await sha256Hex(e.id);for(let d=0;d<path.length;d++)if(String(hashBit(h,d))!==path[d])fail('INDEX_CORRUPT','Index identity belongs to another shard');}
      ids.add(e.id);
    }
    return {entries:clone(entries),revision:stored?.revision??null};
  }
  async #savePage(partitionId,page,entries,revision,gm,path=''){
    if(entries.length>PAGE_SIZE)fail('INDEX_FULL','Bounded page full');
    await this.#persist(partitionIndexKey(partitionId,page,path),{entries},gm,revision);
  }
  async #leaf(partitionId,gm,hash=null,{leftmost=false}={}){
    let path='',manifest=await this.#manifest(partitionId,path,gm);
    for(let depth=0;manifest?.data.state==='ready';depth++){
      if(depth>=MAX_DEPTH)fail('PARTITION_BUDGET','Partition tree depth exceeded');
      path+=leftmost?'0':String(hashBit(hash,depth));
      manifest=await this.#manifest(partitionId,path,gm,{required:true});
    }
    return {path,manifest};
  }
  async #leafAt(partitionId,path,gm){
    if(!/^[01]{0,20}$/.test(path))fail('INVALID_CURSOR','Invalid shard path');
    let m=await this.#manifest(partitionId,'',gm);
    for(let i=0;i<path.length;i++){
      if(m?.data.state!=='ready')fail('CURSOR_STALE','Partition topology changed; restart bounded traversal');
      m=await this.#manifest(partitionId,path.slice(0,i+1),gm,{required:true});
    }
    if(m?.data.state==='ready')fail('CURSOR_STALE','Shard split; restart bounded traversal');
    return {path,manifest:m};
  }
  async #nextLeaf(partitionId,path,gm){
    const zero=path.lastIndexOf('0');if(zero<0)return null;
    let next=path.slice(0,zero)+'1',m=await this.#manifest(partitionId,next,gm,{required:true});
    while(m.data.state==='ready'){
      next+='0';if(next.length>MAX_DEPTH)fail('PARTITION_BUDGET','Partition tree depth exceeded');
      m=await this.#manifest(partitionId,next,gm,{required:true});
    }
    return next;
  }
  async #startSplit(partitionId,leaf,gm){
    const {path,manifest}=leaf;if(path.length>=MAX_DEPTH)fail('PARTITION_FULL','Adaptive hash depth exhausted');
    const source=[],ids=new Set();
    for(let page=0;page<MAX_PAGES;page++){
      const index=await this.#page(partitionId,page,gm,path,manifest);
      if(index.entries.length!==PAGE_SIZE)fail('PARTITION_CORRUPT','Only a full shard can split');
      for(const entry of index.entries){if(ids.has(entry.id))fail('INDEX_CORRUPT','Duplicate shard identity');ids.add(entry.id);}
      source.push({revision:index.revision,count:index.entries.length,digest:await sha256Hex(JSON.stringify(index.entries))});
    }
    const data={kind:'adaptive-partition',policyVersion:1,partitionId,path,state:'copying',pageCounts:source.map(x=>x.count),source,nextPage:0};
    const revision=await this.#saveManifest(partitionId,path,data,manifest?.revision??null,gm);
    return {data,revision};
  }
  async #copyMigration(partitionId,path,manifest,maxPages,gm){
    let migratedPages=0,m=manifest;
    while(m.data.state==='copying'&&m.data.nextPage<MAX_PAGES&&migratedPages<maxPages){
      const page=m.data.nextPage,source=await this.#page(partitionId,page,gm,path,m),proof=m.data.source[page];
      if(source.revision!==proof.revision||await sha256Hex(JSON.stringify(source.entries))!==proof.digest)fail('PARTITION_CORRUPT','Migration source changed; review required');
      for(const entry of source.entries){
        const hash=await sha256Hex(entry.id),child=path+hashBit(hash,path.length);
        // Copy indices only. Payloads keep their original exact stable key.
        let inserted=false;
        for(let target=0;target<MAX_PAGES;target++){
          const index=await this.#page(partitionId,target,gm,child),old=index.entries.find(e=>e.id===entry.id);
          if(old){if(JSON.stringify(old)!==JSON.stringify(entry))fail('PARTITION_CORRUPT','Conflicting copied index entry');inserted=true;break;}
          if(index.entries.length<PAGE_SIZE){await this.#savePage(partitionId,target,[...index.entries,entry],index.revision,gm,child);inserted=true;break;}
        }
        if(!inserted)fail('PARTITION_CORRUPT','Split child exceeded source capacity');
      }
      const data={...m.data,nextPage:page+1};
      m={data,revision:await this.#saveManifest(partitionId,path,data,m.revision,gm)};migratedPages++;
    }
    if(m.data.state==='copying'&&m.data.nextPage===MAX_PAGES){
      for(const bit of ['0','1']){
        const child=path+bit,pageCounts=[];
        for(let p=0;p<MAX_PAGES;p++)pageCounts.push((await this.#page(partitionId,p,gm,child)).entries.length);
        const existing=await this.#manifest(partitionId,child,gm);
        const data={kind:'adaptive-partition',policyVersion:1,partitionId,path:child,state:'leaf',pageCounts};
        if(existing&&JSON.stringify(existing.data)!==JSON.stringify(data))fail('PARTITION_CORRUPT','Unexpected migration child manifest');
        if(!existing)await this.#saveManifest(partitionId,child,data,null,gm);
      }
      const data={...m.data,state:'ready'};
      m={data,revision:await this.#saveManifest(partitionId,path,data,m.revision,gm)};
    }
    return {manifest:m,migratedPages};
  }
  async read(id,{partitionId,gm}={}){
    assertNarrativeId(id);assertPartitionId(partitionId);
    const row=(await this.#raw(keyRecord(partitionId,id),gm))?.value.payload??null;
    if(row&&(row.id!==id||row.partitionId!==partitionId))fail('RECORD_MISMATCH','Record key collision');
    return clone(row);
  }
  async put(record,{expectedRevision=null,gm}={}){
    assertNarrativeId(record?.id);const {id,partitionId}=record;assertPartitionId(partitionId);this.#check(gm);
    return this.#writer.withWriter(gm,async()=>{
      const key=keyRecord(partitionId,id),prior=(await this.#raw(key,gm))?.value;
      if(prior){
        if(prior.payload.id!==id||prior.payload.partitionId!==partitionId)fail('RECORD_MISMATCH','Record key collision');
        if(prior.payload.revision!==expectedRevision)fail('REVISION_CONFLICT','Record revision changed');
        if(storageTierForRecord(prior.payload)!==storageTierForRecord(record)||prior.payload.kind!==record.kind)fail('RECORD_MISMATCH','Storage kind and tier cannot change under one identity');
        const next={...clone(record),revision:expectedRevision+1};await this.#persist(key,next,gm,prior.revision);return next;
      }
      if(expectedRevision!==null)fail('REVISION_CONFLICT','New record expectedRevision must be null');
      const hash=await sha256Hex(id);let leaf=await this.#leaf(partitionId,gm,hash),loc=null;
      for(let attempt=0;attempt<=MAX_DEPTH;attempt++){
        if(leaf.manifest?.data.state==='copying'){
          await this.#copyMigration(partitionId,leaf.path,leaf.manifest,MAX_PAGES,gm);leaf=await this.#leaf(partitionId,gm,hash);continue;
        }
        let gap=false;
        for(let page=0;page<MAX_PAGES;page++){
          const index=await this.#page(partitionId,page,gm,leaf.path,leaf.manifest),match=index.entries.find(e=>e.id===id);
          if(gap&&index.entries.length)fail('INDEX_CORRUPT','Gap in contiguous native index pages');
          if(match){loc={page,index,match};break;}
          if(index.entries.length<PAGE_SIZE){gap=true;if(!loc)loc={page,index,match:null};}
        }
        if(loc)break;
        const m=await this.#startSplit(partitionId,leaf,gm);await this.#copyMigration(partitionId,leaf.path,m,MAX_PAGES,gm);leaf=await this.#leaf(partitionId,gm,hash);
      }
      if(!loc)fail('PARTITION_FULL','Adaptive partition budget exhausted');
      if(loc.match?.status==='ready')fail('INDEX_CORRUPT','Ready index references missing data');
      const entry={id,status:'prepared',tier:storageTierForRecord(record),...(typeof record.kind==='string'?{kind:record.kind}:{})};
      if(!loc.match){
        await this.#savePage(partitionId,loc.page,[...loc.index.entries,entry],loc.index.revision,gm,leaf.path);
        if(leaf.manifest){const data={...leaf.manifest.data,pageCounts:[...leaf.manifest.data.pageCounts]};data.pageCounts[loc.page]=loc.index.entries.length+1;await this.#saveManifest(partitionId,leaf.path,data,leaf.manifest.revision,gm);}
      }
      const next={...clone(record),revision:1};await this.#persist(key,next,gm,null);
      const updated=await this.#page(partitionId,loc.page,gm,leaf.path),entries=updated.entries.map(e=>e.id===id?{...e,status:'ready'}:e);
      if(!entries.some(e=>e.id===id))fail('INDEX_CORRUPT','Prepared entry lost');
      await this.#savePage(partitionId,loc.page,entries,updated.revision,gm,leaf.path);return next;
    });
  }
  async hasReadyIndex(id,{partitionId,gm}={}){return await this.indexStatus(id,{partitionId,gm})==='ready';}
  /** null is absence. Prepared/legacy pending is NEVER an absence proof. */
  async indexStatus(id,{partitionId,gm}={}){
    assertNarrativeId(id);assertPartitionId(partitionId);
    const leaf=await this.#leaf(partitionId,gm,await sha256Hex(id));let status=null,gap=false;
    for(let page=0;page<MAX_PAGES;page++){
      const index=await this.#page(partitionId,page,gm,leaf.path,leaf.manifest);
      if(gap&&index.entries.length)fail('INDEX_CORRUPT','Gap in contiguous native index pages');
      if(index.entries.length<PAGE_SIZE)gap=true;
      const e=index.entries.find(x=>x.id===id);if(e){if(status)fail('INDEX_CORRUPT','Duplicate index identity');status=e.status==='pending'?'prepared':e.status;}
    }
    return status;
  }
  async reconcilePage({partitionId,page=0,path='',gm}={}){
    assertPartitionId(partitionId);if(!Number.isInteger(page)||page<0||page>=MAX_PAGES)fail('INVALID_PAGE','Invalid index page');
    return this.#writer.withWriter(gm,async()=>{
      const leaf=await this.#leafAt(partitionId,path,gm);
      if(leaf.manifest?.data.state==='copying')fail('PARTITION_MIGRATING','Complete index migration before repairing prepared entries');
      const index=await this.#page(partitionId,page,gm,path,leaf.manifest);let repaired=0;const unresolved=[],entries=[];
      for(const entry of index.entries){
        if(entry.status==='ready'){entries.push(entry);continue;}
        const row=await this.read(entry.id,{partitionId,gm});
        if(row){entries.push({...entry,status:'ready',tier:storageTierForRecord(row),...(row.kind?{kind:row.kind}:{})});repaired++;}
        else{entries.push(entry);unresolved.push(entry.id);}
      }
      if(repaired)await this.#savePage(partitionId,page,entries,index.revision,gm,path);return {repaired,unresolved};
    });
  }
  #inspection(partitionId,path,m){return {partitionId,path,tier:'top-level',state:m?.data.state??'legacy',children:m?.data.state==='ready'?[path+'0',path+'1']:[],migration:m?.data.state==='copying'?{nextPage:m.data.nextPage,totalPages:MAX_PAGES}:null,policy:clone(NATIVE_PARTITION_POLICY)};}
  async inspectPartition({partitionId,path='',gm}={}){
    assertPartitionId(partitionId);if(!/^[01]{0,20}$/.test(path))fail('INVALID_PAGE','Invalid shard path');
    const m=await this.#manifest(partitionId,path,gm,{required:path!==''});return this.#inspection(partitionId,path,m);
  }
  async reconcilePartition({partitionId,path='',maxPages=1,gm}={}){
    assertPartitionId(partitionId);if(!/^[01]{0,20}$/.test(path)||!Number.isInteger(maxPages)||maxPages<1||maxPages>MAX_PAGES)fail('PARTITION_BUDGET','One to eight migration pages required');
    return this.#writer.withWriter(gm,async()=>{
      const m=await this.#manifest(partitionId,path,gm,{required:path!==''});
      const result=m?.data.state==='copying'?await this.#copyMigration(partitionId,path,m,maxPages,gm):{manifest:m,migratedPages:0};
      return {...this.#inspection(partitionId,path,result.manifest),migratedPages:result.migratedPages,complete:result.manifest?.data.state!=='copying'};
    });
  }
  async #indexQuery({partitionId,cursor='0:0',limit=16,tier='all',gm}={}){
    assertPartitionId(partitionId);if(!Number.isInteger(limit)||limit<1||limit>PAGE_SIZE)fail('QUERY_BUDGET','Invalid limit');
    if(!['all','shard','historical'].includes(tier))fail('QUERY_TIER','Explicit index tier required');
    const root=await this.#manifest(partitionId,'',gm);let leaf,page,offset,tree=false,token;
    const legacy=/^([0-7]):(\d{1,2})$/.exec(cursor),modern=/^t:([a-f0-9]{12}):([01]{1,20}):([0-7]):(\d{1,2})$/.exec(cursor);
    if(legacy){
      page=Number(legacy[1]);offset=Number(legacy[2]);
      if(root?.data.state==='ready'){
        if(cursor!=='0:0')fail('CURSOR_STALE','Partition split; restart traversal');
        leaf=await this.#leaf(partitionId,gm,null,{leftmost:true});tree=true;
      }else leaf={path:'',manifest:root};
    }else if(modern){
      token=(await sha256Hex(partitionId)).slice(0,12);if(modern[1]!==token)fail('INVALID_CURSOR','Cursor belongs to another partition');
      leaf=await this.#leafAt(partitionId,modern[2],gm);page=Number(modern[3]);offset=Number(modern[4]);tree=true;
    }else fail('INVALID_CURSOR','Expected bounded native index cursor');
    const index=await this.#page(partitionId,page,gm,leaf.path,leaf.manifest);if(offset>index.entries.length)fail('INVALID_CURSOR','Offset beyond current page');
    const entries=index.entries.slice(offset,offset+limit),end=offset+entries.length;
    let nextCursor=null;
    if(tree){
      token??=(await sha256Hex(partitionId)).slice(0,12);
      if(end<index.entries.length)nextCursor=`t:${token}:${leaf.path}:${page}:${end}`;
      else if(page<MAX_PAGES-1)nextCursor=`t:${token}:${leaf.path}:${page+1}:0`;
      else{const next=await this.#nextLeaf(partitionId,leaf.path,gm);if(next!==null)nextCursor=`t:${token}:${next}:0:0`;}
    }else nextCursor=end<index.entries.length?`${page}:${end}`:page<MAX_PAGES-1?`${page+1}:0`:null;
    const unresolved=entries.filter(e=>e.status!=='ready').map(e=>e.id);
    // Legacy metadata has an unknown tier; preserve it as an explicit candidate
    // rather than silently excluding a potentially relevant historical record.
    const items=entries.filter(e=>e.status==='ready'&&(tier==='all'||e.tier===undefined||e.tier===tier)).map(e=>({...e,partitionId,tier:e.tier??'unknown',path:leaf.path}));
    return {items,unresolved,nextCursor};
  }
  /** One manifest path + one index page; payloads are never hydrated. */
  async queryIndex(options={}){return this.#indexQuery(options);}
  /** One index page and <=limit exact record fetches. Follow empty pages too. */
  async query(options={}){
    const index=await this.#indexQuery(options),items=[],unresolved=[...index.unresolved];
    for(const entry of index.items){const row=await this.read(entry.id,{partitionId:options.partitionId,gm:options.gm});if(row)items.push(row);else unresolved.push(entry.id);}
    return {items,unresolved,nextCursor:index.nextCursor};
  }
  get instrumentation(){return {reads:this.#reads,maxPartitionRecords:MAX_PAGES*PAGE_SIZE,maxShardRecords:MAX_PAGES*PAGE_SIZE,maxPartitionDepth:MAX_DEPTH};}
}
