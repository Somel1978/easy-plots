/** Copy-on-write posting shards. A compact protected root publishes immutable
 * pages only after read-back. A prepared root retains the previous valid view;
 * restart reconciliation verifies staged pages, never scans the pack. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const MAX_SHARDS=128;
export function comparePostingKeys(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1;}return 0;}
export class BoundedPostingPages {
 #repo;#gm;#capacity;#key;#validate;
 constructor({repository,gmProvider,capacity,key,validate}){this.#repo=repository;this.#gm=gmProvider;this.#capacity=capacity;this.#key=key;this.#validate=validate;}
 #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
 validateRoot(row){
  if(!Array.isArray(row.entries)||row.entries.length>this.#capacity)fail('POSTING_CORRUPT','Invalid legacy posting capacity');
  this.#entries(row.entries);
  for(const tree of [row.postingPages,row.postingMigration?.target].filter(Boolean)){
   if(tree.version!==1||tree.pageSize!==this.#capacity||!Array.isArray(tree.pages)||tree.pages.length>MAX_SHARDS||!Number.isSafeInteger(tree.total)||tree.total<0||tree.total!==tree.pages.reduce((n,p)=>n+p.count,0))fail('POSTING_CORRUPT','Invalid posting directory');
   let previous=null;
   for(const p of tree.pages){
    if(!Number.isInteger(p.count)||p.count<1||p.count>this.#capacity||typeof p.id!=='string'||typeof p.partitionId!=='string'||!/^[a-f0-9]{64}$/.test(p.fingerprint??'')||!Array.isArray(p.lower)||!Array.isArray(p.upper)||comparePostingKeys(p.lower,p.upper)>0||previous&&comparePostingKeys(previous,p.lower)>=0)fail('POSTING_CORRUPT','Overlapping or malformed posting shards');
    previous=p.upper;
   }
  }
  if(row.postingPages&&row.entries.length)fail('POSTING_CORRUPT','Published posting tree contains legacy entries');
  if(row.postingMigration&&(!Array.isArray(row.postingMigration.staged)||row.postingMigration.staged.length>2||row.postingMigration.staged.some(p=>!row.postingMigration.target.pages.some(t=>JSON.stringify(t)===JSON.stringify(p)))||row.postingMigration.state!=='prepared'))fail('POSTING_CORRUPT','Unknown posting migration state');
 }
 #entries(entries){
  let prior=null;const sorted=[...entries].sort((a,b)=>comparePostingKeys(this.#key(a),this.#key(b)));
  for(const e of sorted){this.#validate(e);const key=this.#key(e);if(prior&&comparePostingKeys(prior,key)>=0)fail('POSTING_CORRUPT','Duplicate posting key');prior=key;}
 }
 async #readPage(root,descriptor){
  const row=await this.#repo.read(descriptor.id,{partitionId:descriptor.partitionId,gm:this.#context()});this.#context();
  if(!row){if(typeof this.#repo.indexStatus==='function')await this.#repo.indexStatus(descriptor.id,{partitionId:descriptor.partitionId,gm:this.#context()});fail('INDEX_UNCERTAIN','Known posting shard is missing');}
  if(typeof this.#repo.hasReadyIndex==='function'&&!await this.#repo.hasReadyIndex(descriptor.id,{partitionId:descriptor.partitionId,gm:this.#context()}))fail('INDEX_UNCERTAIN','Posting shard index is incomplete');
  const hash=await sha256Hex(`${root.partitionId}\0${root.id}\0${descriptor.fingerprint}`);
  if(descriptor.id!==`ep:posting-page:${hash.slice(0,32)}`||descriptor.partitionId!==`posting-pages-${hash.slice(0,4)}`)fail('POSTING_CORRUPT','Posting descriptor belongs to another root');
  if(row.id!==descriptor.id||row.partitionId!==descriptor.partitionId||row.kind!=='immutable-posting-page'||row.rootId!==root.id||!Array.isArray(row.entries)||row.entries.length!==descriptor.count||await sha256Hex(JSON.stringify(row.entries))!==descriptor.fingerprint)fail('POSTING_CORRUPT','Posting shard failed immutable verification');
  this.#entries(row.entries);const entries=[...row.entries].sort((a,b)=>comparePostingKeys(this.#key(a),this.#key(b)));
  if(comparePostingKeys(this.#key(entries[0]),descriptor.lower)!==0||comparePostingKeys(this.#key(entries.at(-1)),descriptor.upper)!==0)fail('POSTING_CORRUPT','Posting range differs from directory');
  return entries;
 }
 async #writePage(root,entries){
  const fingerprint=await sha256Hex(JSON.stringify(entries)),hash=await sha256Hex(`${root.partitionId}\0${root.id}\0${fingerprint}`);
  const loc={id:`ep:posting-page:${hash.slice(0,32)}`,partitionId:`posting-pages-${hash.slice(0,4)}`};
  const descriptor={...loc,count:entries.length,fingerprint,lower:this.#key(entries[0]),upper:this.#key(entries.at(-1))};
  const old=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm:this.#context()});
  if(!old)await this.#repo.put({...loc,kind:'immutable-posting-page',rootId:root.id,entries},{expectedRevision:null,gm:this.#context()});
  await this.#readPage(root,descriptor);return descriptor;
 }
 async #save(row,expectedRevision){
  if(new TextEncoder().encode(JSON.stringify(row)).length>60_000)fail('POSTING_BUDGET','Posting metadata byte budget exhausted');
  const saved=await this.#repo.put(row,{expectedRevision,gm:this.#context()});this.#context();
  const observed=await this.#repo.read(row.id,{partitionId:row.partitionId,gm:this.#context()});
  if(!observed||observed.revision!==saved.revision||JSON.stringify(observed)!==JSON.stringify(saved))fail('POSTING_UNCERTAIN','Posting root was not read back');
  if(typeof this.#repo.hasReadyIndex==='function'&&!await this.#repo.hasReadyIndex(row.id,{partitionId:row.partitionId,gm:this.#context()}))fail('INDEX_UNCERTAIN','Posting root index is incomplete');
  return observed;
 }
 async reconcile(row){
  this.validateRoot(row);if(!row.postingMigration)return row;
  // At most two new pages are staged by a single split/update; unchanged pages
  // retain their immutable descriptors and need no rehydration during repair.
  for(const p of row.postingMigration.staged)await this.#readPage(row,p);
  const {postingMigration,...rest}=row;
  return this.#save({...rest,entries:[],postingPages:postingMigration.target},row.revision);
 }
 async change(row,{entry=null,removeKey=null}={}){
  this.#context();this.validateRoot(row);row=await this.reconcile(row);
  const key=entry?this.#key(entry):removeKey,tree=row.postingPages;
  if(!Array.isArray(key))fail('POSTING_KEY','Exact posting key required');
  let at=0,entries,pages=tree?[...tree.pages]:[];
  if(tree&&pages.length){at=pages.findIndex(p=>comparePostingKeys(key,p.upper)<=0);if(at<0)at=pages.length-1;entries=await this.#readPage(row,pages[at]);}
  else entries=clone(row.entries);
  const prior=entries.find(e=>comparePostingKeys(this.#key(e),key)===0);
  if(entry&&prior&&JSON.stringify(prior)===JSON.stringify(entry)||!entry&&!prior)return row;
  entries=entries.filter(e=>comparePostingKeys(this.#key(e),key)!==0);if(entry){this.#validate(entry);entries.push(clone(entry));}
  entries.sort((a,b)=>comparePostingKeys(this.#key(a),this.#key(b)));
  if(!tree&&entries.length<=this.#capacity)return this.#save({...row,entries},row.revision??null);
  const chunks=entries.length>this.#capacity?[entries.slice(0,Math.ceil(entries.length/2)),entries.slice(Math.ceil(entries.length/2))]:entries.length?[entries]:[];
  if(pages.length-(tree&&pages.length?1:0)+chunks.length>MAX_SHARDS)fail('POSTING_BUDGET','Posting directory shard budget exhausted');
  const staged=[];for(const chunk of chunks)staged.push(await this.#writePage(row,chunk));
  if(tree&&pages.length)pages.splice(at,1,...staged);else pages=staged;
  const target={version:1,pageSize:this.#capacity,pages,total:pages.reduce((n,p)=>n+p.count,0)};
  const prepared=await this.#save({...row,postingMigration:{state:'prepared',target,staged}},row.revision??null);
  return this.reconcile(prepared);
 }
 async find(row,key){
  this.#context();this.validateRoot(row);if(row.postingMigration)fail('INDEX_UNCERTAIN','Prepared posting migration requires exact reconciliation');
  if(!row.postingPages)return clone(row.entries.find(e=>comparePostingKeys(this.#key(e),key)===0)??null);
  const page=row.postingPages.pages.find(p=>comparePostingKeys(p.lower,key)<=0&&comparePostingKeys(p.upper,key)>=0);if(!page)return null;
  return clone((await this.#readPage(row,page)).find(e=>comparePostingKeys(this.#key(e),key)===0)??null);
 }
 async page(row,{page=0,offset=0,limit=32}={}){
  this.#context();this.validateRoot(row);if(row.postingMigration)fail('INDEX_UNCERTAIN','Prepared posting migration requires exact reconciliation');const pages=row.postingPages?.pages;
  if(!Number.isInteger(page)||page<0||page>=(pages?.length||1)||!Number.isInteger(offset)||offset<0)fail('POSTING_CURSOR','Invalid posting page cursor');
  const entries=pages?(pages.length?await this.#readPage(row,pages[page]):[]):[...row.entries].sort((a,b)=>comparePostingKeys(this.#key(a),this.#key(b)));
  if(offset>entries.length)fail('POSTING_CURSOR','Offset beyond posting page');
  const items=clone(entries.slice(offset,offset+limit)),end=offset+items.length;
  return {items,nextCursor:end<entries.length?{page,offset:end}:pages&&page+1<pages.length?{page:page+1,offset:0}:null};
 }
 get policy(){return {version:1,pageSize:this.#capacity,maxShards:MAX_SHARDS,maxRecords:this.#capacity*MAX_SHARDS};}
}
