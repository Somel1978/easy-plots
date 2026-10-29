/** Bounded immutable alternate timelines over named canonical world facts.
 * Selection observes established truth; it cannot apply a simulated outcome. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {runIsolatedWhatIf} from '../domains/simulation.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const digest=value=>sha256Hex(JSON.stringify(value));
const positive=n=>Number.isSafeInteger(n)&&n>0;
const validKey=key=>typeof key==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,89}$/.test(key)&&!['constructor','prototype'].includes(key);
const title=value=>{if(typeof value!=='string'||!value.trim()||value.length>120)fail('TIMELINE_LABEL','A bounded branch label is required');return value;};
export class PersistentTimelineBranches {
 #domains;
 constructor({domains}={}){
  if(!['read','save','readRevision','retainRevision'].every(k=>typeof domains?.[k]==='function'))fail('TIMELINE_DEPENDENCY','Protected revisioned domain storage required');
  this.#domains=domains;
 }
 async read({scope='world',timelineId}={}){
  assertNarrativeId(timelineId);const row=await this.#domains.read('timeline',scope,timelineId);
  if(row&&row.data.kind!=='timeline-workspace-v1')fail('TIMELINE_IDENTITY','This identity belongs to another timeline contract');return row;
 }
 async #versionId(timelineId,branchId,version){return `ep:timeline-version:${(await digest({timelineId,branchId,version})).slice(0,28)}`;}
 async version({scope='world',timelineId,branchId,version}={}){
  assertNarrativeId(timelineId);assertNarrativeId(branchId);if(!positive(version)||version>32)fail('TIMELINE_VERSION','Branch version must be between 1 and 32');
  const row=await this.#domains.read('timeline',scope,await this.#versionId(timelineId,branchId,version));
  if(row&&(row.data.kind!=='timeline-branch-version-v1'||row.data.timelineId!==timelineId||row.data.branchId!==branchId||row.data.version!==version))fail('TIMELINE_IDENTITY','Branch version identity mismatch');return row;
 }
 async #sources(scope,refs,{historical=false}={}){
  if(!Array.isArray(refs)||refs.length<1||refs.length>24)fail('TIMELINE_BUDGET','One to 24 explicitly named world facts required');
  const facts={},sources=[],ids=new Set();
  for(const ref of refs){
   assertPlainObject(ref,'TIMELINE_SOURCE');assertNarrativeId(ref.id);
   if(Object.keys(ref).some(k=>!['id','revision','key','fingerprint'].includes(k))||!positive(ref.revision)||!validKey(ref.key)||Object.hasOwn(facts,ref.key)||ids.has(ref.id))fail('TIMELINE_SOURCE','Unique safe keys and exact fact revisions required');
   const row=historical?await this.#domains.readRevision('world-fact',scope,ref.id,ref.revision):await this.#domains.read('world-fact',scope,ref.id);
   if(!row||row.revision!==ref.revision||!Object.hasOwn(row.data,'value')||!['asserted','active','established'].includes(row.data.status))fail('TIMELINE_SOURCE_STALE','An exact established canonical fact value is required');
   const fingerprint=await digest({id:row.id,revision:row.revision,sourceEventId:row.sourceEventId,data:row.data});
   if(ref.fingerprint!==undefined&&ref.fingerprint!==fingerprint)fail('TIMELINE_SOURCE_STALE','Canonical source fingerprint changed');
   facts[ref.key]=clone(row.data.value);sources.push({id:ref.id,revision:ref.revision,key:ref.key,fingerprint});ids.add(ref.id);
  }
  if(JSON.stringify(facts).length>6000)fail('TIMELINE_BUDGET','Canonical fact values exceed timeline budget');return {facts,sources};
 }
 async #storeVersion(scope,data,sourceEventId){
  const id=await this.#versionId(data.timelineId,data.branchId,data.version),old=await this.#domains.read('timeline',scope,id);
  if(old){if(await digest(old.data)!==await digest(data)||old.sourceEventId!==sourceEventId)fail('TIMELINE_VERSION_CONFLICT','An interrupted immutable version has different content; use the original request');return old;}
  return this.#domains.save({type:'timeline',scope,id,data,sourceEventId});
 }
 async create({scope='world',timelineId,branchId,label='Canonical timeline',sourceRefs,sourceEventId}={}){
  for(const id of [timelineId,branchId,sourceEventId])assertNarrativeId(id);title(label);
  if(await this.read({scope,timelineId}))fail('REVISION_CONFLICT','Timeline already exists');
  const observed=await this.#sources(scope,sourceRefs);
  for(const ref of observed.sources)await this.#domains.retainRevision('world-fact',scope,ref.id,ref.revision);
  const branch={kind:'timeline-branch-version-v1',timelineId,branchId,version:1,label,parent:null,lineageDepth:0,sourceRefs:observed.sources,
   hypotheses:[],rules:[],preview:runIsolatedWhatIf({initialFacts:observed.facts}),effectsExecuted:0};
  await this.#storeVersion(scope,branch,sourceEventId);
  // Recheck after retaining source snapshots. A changed fact cannot become live
  // canonical merely because its earlier revision was successfully retained.
  await this.#sources(scope,observed.sources);
  return this.#domains.save({type:'timeline',scope,id:timelineId,sourceEventId,data:{kind:'timeline-workspace-v1',
   branches:[{branchId,headVersion:1,lineageDepth:0}],canonical:{branchId,version:1,sourceRefs:observed.sources,selectionEventId:sourceEventId},effectsExecuted:0,gameEventsCreated:0}});
 }
 async branch({scope='world',timelineId,branchId,parentBranchId,parentVersion,label,hypotheses=[],rules=[],maxPasses=8,expectedRevision,sourceEventId}={}){
  for(const id of [timelineId,branchId,parentBranchId,sourceEventId])assertNarrativeId(id);title(label);
  const root=await this.read({scope,timelineId});if(!root||root.revision!==expectedRevision)fail('REVISION_CONFLICT','Timeline changed before branching');
  const parentEntry=root.data.branches.find(b=>b.branchId===parentBranchId),existing=root.data.branches.find(b=>b.branchId===branchId);
  if(!parentEntry||!positive(parentVersion)||parentVersion>parentEntry.headVersion)fail('TIMELINE_PARENT','An attached exact parent branch version is required');
  if(existing&&(parentBranchId!==branchId||parentVersion!==existing.headVersion))fail('TIMELINE_PARENT','A new version must extend that branch current head');
  if(!existing&&root.data.branches.length>=12)fail('TIMELINE_BUDGET','Maximum 12 branches per timeline');
  const version=(existing?.headVersion??0)+1,depth=existing?existing.lineageDepth:parentEntry.lineageDepth+1;
  if(version>32||depth>8)fail('TIMELINE_BUDGET','Maximum 32 versions and eight fork levels');
  const parent=await this.version({scope,timelineId,branchId:parentBranchId,version:parentVersion});
  if(!parent)fail('TIMELINE_PARENT','Immutable parent is unavailable');
  // Historical source resolution proves provenance; the alternate stays useful
  // after live facts change and is never silently rebased onto them.
  await this.#sources(scope,parent.data.sourceRefs,{historical:true});
  const preview=runIsolatedWhatIf({initialFacts:parent.data.preview.hypotheticalFacts,hypotheses,rules,maxPasses});
  if(Object.keys(preview.hypotheticalFacts).length>24||JSON.stringify(preview).length>10000)fail('TIMELINE_BUDGET','Alternate outcome exceeds bounded timeline preview');
  const data={kind:'timeline-branch-version-v1',timelineId,branchId,version,label,parent:{branchId:parentBranchId,version:parentVersion},lineageDepth:depth,
   sourceRefs:clone(parent.data.sourceRefs),hypotheses:clone(hypotheses),rules:clone(rules),preview,effectsExecuted:0};
  await this.#storeVersion(scope,data,sourceEventId);
  const branches=root.data.branches.filter(b=>b.branchId!==branchId);branches.push({branchId,headVersion:version,lineageDepth:depth});
  return this.#domains.save({type:'timeline',scope,id:timelineId,expectedRevision,sourceEventId,data:{...root.data,branches}});
 }
 async selectCanonical({scope='world',timelineId,branchId,version,sourceRefs,expectedRevision,reviewEventId}={}){
  assertNarrativeId(reviewEventId);const root=await this.read({scope,timelineId});
  if(!root||root.revision!==expectedRevision)fail('REVISION_CONFLICT','Timeline selection changed before review');
  const attached=root.data.branches.find(b=>b.branchId===branchId);
  if(!attached||version>attached.headVersion)fail('TIMELINE_BRANCH','An attached branch version is required');
  const branch=await this.version({scope,timelineId,branchId,version});
  if(!branch?.data.preview.converged)fail('TIMELINE_CONVERGENCE','An incomplete hypothetical outcome cannot be selected');
  const observed=await this.#sources(scope,sourceRefs),candidate=branch.data.preview.hypotheticalFacts;
  if(Object.keys(candidate).length!==Object.keys(observed.facts).length||Object.entries(candidate).some(([key,value])=>!Object.hasOwn(observed.facts,key)||JSON.stringify(value)!==JSON.stringify(observed.facts[key])))fail('TIMELINE_NOT_CANONICAL','Every selected outcome must already be established in actual canonical fact records');
  for(const original of branch.data.sourceRefs)if(observed.sources.find(r=>r.key===original.key)?.id!==original.id)fail('TIMELINE_SOURCE_IDENTITY','Selection cannot substitute another fact for an existing source');
  for(const ref of observed.sources)await this.#domains.retainRevision('world-fact',scope,ref.id,ref.revision);
  await this.#sources(scope,observed.sources);
  return this.#domains.save({type:'timeline',scope,id:timelineId,expectedRevision,sourceEventId:reviewEventId,data:{...root.data,
   canonical:{branchId,version,sourceRefs:observed.sources,selectionEventId:reviewEventId}}});
 }
 async canonical({scope='world',timelineId}={}){
  const root=await this.read({scope,timelineId});if(!root)return null;
  try{const observed=await this.#sources(scope,root.data.canonical.sourceRefs);return {...clone(root.data.canonical),timelineRevision:root.revision,status:'current-canonical-sources',facts:observed.facts,effectsExecuted:0};}
  catch(error){if(error.code!=='TIMELINE_SOURCE_STALE')throw error;return {...clone(root.data.canonical),timelineRevision:root.revision,status:'canonical-sources-changed',facts:null,effectsExecuted:0};}
 }
}
