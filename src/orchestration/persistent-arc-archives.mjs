/** Incremental, resumable retention of concluded arcs. No source deletion. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const digest=value=>sha256Hex(JSON.stringify(value));
const pageIdentity=async(scope,archiveId,ordinal,references)=>`ep:archive-page:${(await digest({scope,archiveId,ordinal,references})).slice(0,24)}`;
const TYPES=new Set(['arc','arc-resolution','objective','obligation','story-hook','world-fact','relationship','observer-belief','evidence','investigation','timeline','chronology-event','chronology-knowledge','knowledge-claim','knowledge-receipt','knowledge-correction','scheduled-commitment','session-handoff']);
function reference(ref){
 assertNarrativeId(ref?.id);
 if(!TYPES.has(ref.type)||!Number.isSafeInteger(ref.revision)||ref.revision<1)fail('ARCHIVE_REFERENCE','An exact supported canonical revision is required');
 return {type:ref.type,id:ref.id,revision:ref.revision};
}
export async function arcArchiveSummaryId(scope,arcId){assertNarrativeId(arcId);return `ep:arc-summary:${(await digest({scope,arcId})).slice(0,24)}`;}
export class PersistentArcArchives {
 #domains;
 constructor({domains}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||typeof domains?.readRevision!=='function'||typeof domains?.retainRevision!=='function')fail('ARCHIVE_DEPENDENCY','Protected exact-revision history storage required');
  this.#domains=domains;
 }
 async inspect({scope='world',archiveId}={}){
  assertNarrativeId(archiveId);const row=await this.#domains.read('arc-archive',scope,archiveId);
  if(row&&(!['collecting','archiving','archived'].includes(row.data.state)||!Array.isArray(row.data.pageIds)||row.data.pageIds.length>32||!Number.isSafeInteger(row.data.completedPages)||row.data.completedPages<0||row.data.completedPages>row.data.pageIds.length))fail('ARCHIVE_CORRUPT','Archive lifecycle or progress is invalid');
  return row;
 }
 async #manifest(scope,archiveId,expectedRevision){
  const row=await this.inspect({scope,archiveId});if(!row)fail('ARCHIVE_MISSING','Existing archive job required');
  if(row.revision!==expectedRevision)fail('REVISION_CONFLICT','Archive job changed since this action');return row;
 }
 async #page(scope,archiveId,pageId,ordinal){
  const row=await this.#domains.read('arc-archive-page',scope,pageId);
  if(!row||row.data.archiveId!==archiveId||row.data.ordinal!==ordinal||!Array.isArray(row.data.references)||row.data.references.length<1||row.data.references.length>12)fail('ARCHIVE_CORRUPT','Archive reference page is missing or invalid');
  for(const ref of row.data.references){reference(ref);if(!/^[a-f0-9]{64}$/.test(ref.fingerprint??''))fail('ARCHIVE_CORRUPT','Archive source fingerprint missing');}
  if(row.id!==await pageIdentity(scope,archiveId,ordinal,row.data.references))fail('ARCHIVE_CORRUPT','Sealed archive page content has changed');
  return row;
 }
 async #savePage(scope,archiveId,ordinal,references,sourceEventId){
  const id=await pageIdentity(scope,archiveId,ordinal,references),data={archiveId,ordinal,references};
  const old=await this.#domains.read('arc-archive-page',scope,id);
  if(old){if(JSON.stringify(old.data)!==JSON.stringify(data))fail('ARCHIVE_PAGE_CONFLICT','Interrupted reference page has different content; review it explicitly');return old;}
  return this.#domains.save({type:'arc-archive-page',scope,id,data,sourceEventId});
 }
 async #capture(scope,refs){
  const captured=[];for(const input of refs){const ref=reference(input),source=await this.#domains.readRevision(ref.type,scope,ref.id,ref.revision);
   if(!source)fail('ARCHIVE_SOURCE_MISSING','A selected historical revision is unavailable');
   captured.push({...ref,fingerprint:await digest(source)});
  }return captured;
 }
 async prepare({scope='world',archiveId,arcId,expectedArcRevision,sourceEventId,title,text}={}){
  for(const id of [archiveId,arcId,sourceEventId])assertNarrativeId(id);
  if(typeof title!=='string'||!title.trim()||title.length>120||typeof text!=='string'||!text.trim()||text.length>2000)fail('ARCHIVE_SUMMARY','A bounded GM-authored summary is required');
  if(await this.inspect({scope,archiveId}))fail('ARCHIVE_EXISTS','Inspect and resume the existing archive job');
  const arc=await this.#domains.read('arc',scope,arcId);
  if(!arc||arc.revision!==expectedArcRevision)fail('REVISION_CONFLICT','Arc changed before archive preparation');
  if(arc.data.status!=='concluded'||arc.data.archive)fail('ARCHIVE_ARC_STATE','Only a concluded, unarchived arc may be archived');
  const resolution=await this.#domains.read('arc-resolution',scope,arc.data.resolutionId);
  if(!resolution||resolution.data.state!=='committed'||resolution.data.arcId!==arcId||resolution.data.committedArcRevision!==arc.revision)fail('ARCHIVE_RESOLUTION','Verified committed closure for this arc revision required');
  const summaryId=await arcArchiveSummaryId(scope,arcId);
  if(await this.#domains.read('arc-archive-summary',scope,summaryId))fail('ARCHIVE_EXISTS','This arc already has an archive summary or pending commit');
  const references=await this.#capture(scope,[{type:'arc',id:arcId,revision:arc.revision},{type:'arc-resolution',id:resolution.id,revision:resolution.revision}]);
  const page=await this.#savePage(scope,archiveId,0,references,sourceEventId);
  return this.#domains.save({type:'arc-archive',scope,id:archiveId,sourceEventId,data:{arcId,sourceArcRevision:arc.revision,sourceArcFingerprint:await digest(arc),
   resolutionId:resolution.id,resolutionRevision:resolution.revision,summaryId,title,text,state:'collecting',pageIds:[page.id],completedPages:0,memberCount:2,coverage:'explicit-members-only',effectsExecuted:0}});
 }
 async appendBatch({scope='world',archiveId,expectedRevision,sourceEventId,references}={}){
  assertNarrativeId(sourceEventId);const job=await this.#manifest(scope,archiveId,expectedRevision),d=job.data;
  if(d.state!=='collecting'||d.pageIds.length>=32)fail('ARCHIVE_BUDGET','Open archive has no remaining page capacity');
  if(!Array.isArray(references)||references.length<1||references.length>12)fail('ARCHIVE_BUDGET','Append between one and 12 explicit references');
  const seen=new Set();for(let i=0;i<d.pageIds.length;i++)for(const ref of (await this.#page(scope,archiveId,d.pageIds[i],i)).data.references)seen.add(`${ref.type}:${ref.id}:${ref.revision}`);
  for(const ref of references){reference(ref);const key=`${ref.type}:${ref.id}:${ref.revision}`;if(seen.has(key))fail('ARCHIVE_DUPLICATE','Historical revision already selected');seen.add(key);}
  const captured=await this.#capture(scope,references),page=await this.#savePage(scope,archiveId,d.pageIds.length,captured,sourceEventId);
  return this.#domains.save({type:'arc-archive',scope,id:archiveId,expectedRevision,sourceEventId,data:{...d,pageIds:[...d.pageIds,page.id],memberCount:d.memberCount+captured.length}});
 }
 async seal({scope='world',archiveId,expectedRevision,reviewEventId,approved=false}={}){
  assertNarrativeId(reviewEventId);if(approved!==true)fail('ARCHIVE_APPROVAL','Explicit GM review of the selected archive manifest is required');
  const job=await this.#manifest(scope,archiveId,expectedRevision);if(job.data.state!=='collecting')fail('ARCHIVE_STATE','Only an open manifest can be sealed');
  const arc=await this.#domains.read('arc',scope,job.data.arcId);
  if(!arc||await digest(arc)!==job.data.sourceArcFingerprint)fail('ARCHIVE_STALE','Arc changed while preparing its archive');
  await this.#resolution(scope,job.data);
  return this.#domains.save({type:'arc-archive',scope,id:archiveId,expectedRevision,sourceEventId:reviewEventId,data:{...job.data,state:'archiving',authorizationEventId:reviewEventId}});
 }
 async #resolution(scope,data){
  const row=await this.#domains.read('arc-resolution',scope,data.resolutionId);
  if(!row||row.revision!==data.resolutionRevision||row.data.state!=='committed'||row.data.arcId!==data.arcId||row.data.committedArcRevision!==data.sourceArcRevision)fail('ARCHIVE_STALE','Canonical closure changed since archive preparation');
 }
 async advance({scope='world',archiveId,expectedRevision,sourceEventId}={}){
  assertNarrativeId(sourceEventId);const job=await this.#manifest(scope,archiveId,expectedRevision),d=job.data;
  if(d.state!=='archiving'||d.completedPages===d.pageIds.length)fail('ARCHIVE_STATE','No pending retention page');
  const page=await this.#page(scope,archiveId,d.pageIds[d.completedPages],d.completedPages);
  for(const ref of page.data.references){
   const snapshot=await this.#domains.readRevision(ref.type,scope,ref.id,ref.revision);
   if(!snapshot||await digest(snapshot)!==ref.fingerprint)fail('ARCHIVE_HISTORY_CHANGED','Selected historical source failed verification');
   await this.#domains.retainRevision(ref.type,scope,ref.id,ref.revision);
  }
  return this.#domains.save({type:'arc-archive',scope,id:archiveId,expectedRevision,sourceEventId,data:{...d,completedPages:d.completedPages+1}});
 }
 async finalize({scope='world',archiveId,expectedRevision,reviewEventId}={}){
  assertNarrativeId(reviewEventId);let job=await this.#manifest(scope,archiveId,expectedRevision);const d=job.data;
  if(!['archiving','archived'].includes(d.state)||d.completedPages!==d.pageIds.length)fail('ARCHIVE_NOT_READY','All sealed pages must be durably retained first');
  await this.#resolution(scope,d);
  const source=await this.#domains.readRevision('arc',scope,d.arcId,d.sourceArcRevision),arc=await this.#domains.read('arc',scope,d.arcId);
  if(!source||await digest(source)!==d.sourceArcFingerprint||!arc)fail('ARCHIVE_STALE','Concluded source history is unavailable');
  const metadata={archiveId,state:'archived'},archivedData={...source.data,archive:metadata};
  const alreadyMarked=arc.revision===d.sourceArcRevision+1&&JSON.stringify(arc.data)===JSON.stringify(archivedData)&&arc.sourceEventId===d.authorizationEventId;
  if(!alreadyMarked&&(arc.revision!==d.sourceArcRevision||await digest(arc)!==d.sourceArcFingerprint))fail('ARCHIVE_STALE','Canonical arc changed; archive finalization requires review');
  const summaryData={archiveId,arcId:d.arcId,title:d.title,text:d.text,sourceArcRevision:d.sourceArcRevision,memberCount:d.memberCount,pageCount:d.pageIds.length,coverage:d.coverage,state:'pending'};
  let summary=await this.#domains.read('arc-archive-summary',scope,d.summaryId);
  if(summary&&summary.data.archiveId!==archiveId)fail('ARCHIVE_CONFLICT','Another archive owns this arc summary');
  if(summary?.data.state==='archived'){
   if(d.state!=='archived'||!alreadyMarked||JSON.stringify(summary.data)!==JSON.stringify({...summaryData,state:'archived'}))fail('ARCHIVE_UNCERTAIN','Archive summary and source need explicit reconciliation');
   return {archiveId,arcId:d.arcId,state:'archived',revision:job.revision,effectsExecuted:0};
  }
  if(summary&&JSON.stringify(summary.data)!==JSON.stringify(summaryData))fail('ARCHIVE_CONFLICT','Prepared summary differs from the sealed archive');
  if(!summary)summary=await this.#domains.save({type:'arc-archive-summary',scope,id:d.summaryId,data:summaryData,sourceEventId:d.authorizationEventId});
  if(!alreadyMarked)await this.#domains.save({type:'arc',scope,id:d.arcId,data:archivedData,expectedRevision:arc.revision,sourceEventId:d.authorizationEventId});
  if(d.state!=='archived')job=await this.#domains.save({type:'arc-archive',scope,id:archiveId,data:{...d,state:'archived'},expectedRevision:job.revision,sourceEventId:reviewEventId});
  await this.#domains.save({type:'arc-archive-summary',scope,id:d.summaryId,data:{...summaryData,state:'archived'},expectedRevision:summary.revision,sourceEventId:reviewEventId});
  return {archiveId,arcId:d.arcId,state:'archived',revision:job.revision,effectsExecuted:0};
 }
 async readSummary({scope='world',arcId}={}){
  const id=await arcArchiveSummaryId(scope,arcId),row=await this.#domains.read('arc-archive-summary',scope,id);
  if(!row||row.data.state!=='archived')return null;
  if(row.data.arcId!==arcId)fail('ARCHIVE_CORRUPT','Summary arc identity mismatch');return clone(row.data);
 }
 async listSummaries({scope='world',cursor='0:0',limit=16}={}){
  const result=await this.#domains.queryScoped({type:'arc-archive-summary',scope,cursor,limit});
  return {items:result.items.filter(r=>r.data.state==='archived').map(r=>clone(r.data)),nextCursor:result.nextCursor};
 }
 async loadPage({scope='world',archiveId,page=0}={}){
  const job=await this.inspect({scope,archiveId});
  if(!job||job.data.state!=='archived'||!Number.isSafeInteger(page)||page<0||page>=job.data.pageIds.length)fail('ARCHIVE_PAGE','A specific completed archive page is required');
  const refs=(await this.#page(scope,archiveId,job.data.pageIds[page],page)).data.references,items=[];
  for(const ref of refs){const snapshot=await this.#domains.readRevision(ref.type,scope,ref.id,ref.revision);if(!snapshot||await digest(snapshot)!==ref.fingerprint)fail('ARCHIVE_HISTORY_CHANGED','Archived history is unavailable or altered');items.push(snapshot);}
  return {archiveId,page,items,nextPage:page+1<job.data.pageIds.length?page+1:null,scope:'gm-only'};
 }
}
