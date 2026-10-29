/** Versioned, protected publication plans derived only from recipient knowledge.
 * Preparing/approving a plan cannot create native Documents or distribute keys.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {receiptKnowledgeTime} from '../domains/knowledge.mjs';
import {validatePublicationView} from '../contracts/private-publication.mjs';
import {versionedEvent} from '../contracts/canonical-event.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const fingerprint=value=>sha256Hex(JSON.stringify(value));
const ids=values=>{if(!Array.isArray(values)||values.length>8||new Set(values).size!==values.length)fail('PUBLICATION_BUDGET','At most eight distinct source references per category');values.forEach(assertNarrativeId);return [...values];};
export class KnowledgePublications {
 #domains;#knowledge;#gm;#writer;#router;#ledger;#world;#readRoll;
 constructor({domains,knowledgeLedger,gmProvider,writer,router=null,ledger=null,worldId=null,readRoll=null}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||typeof knowledgeLedger?.projection!=='function'||typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function')fail('PUBLICATION_DEPENDENCY','Protected knowledge/plan storage and designated GM authority required');
  this.#domains=domains;this.#knowledge=knowledgeLedger;this.#gm=gmProvider;this.#writer=writer;this.#router=router;this.#ledger=ledger;this.#world=worldId;this.#readRoll=readRoll;
 }
 #authority(){const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);}
 async #snapshot({scope,observerId,receiptIds,correctionIds,worldTime,title}){
  const sourceRefs=[],receipts=new Map(),read=async(type,id)=>{const row=await this.#domains.read(type,scope,id);if(!row)fail('PUBLICATION_SOURCE_MISSING','Selected knowledge source is unavailable');sourceRefs.push({type,id,revision:row.revision});return row;};
  for(const id of receiptIds){
   const row=await read('knowledge-receipt',id);
   if(row.data.observerId!==observerId||row.data.state!=='published'||receiptKnowledgeTime(row.data)>worldTime)fail('PUBLICATION_KNOWLEDGE','Selected receipt is not available to this observer at the authored time');
   const claim=await read('knowledge-claim',row.data.claimId);if(claim.revision!==row.data.claimRevision||claim.data.status!=='established')fail('PUBLICATION_SOURCE_STALE','Claim changed after the selected disclosure');receipts.set(id,row);
  }
  const seen=new Set();for(const id of correctionIds){const row=await read('knowledge-correction',id),receipt=receipts.get(row.data.receiptId);
   if(!receipt||row.data.observerId!==observerId||row.data.claimId!==receipt.data.claimId||row.data.receiptRevision!==receipt.revision||seen.has(receipt.id))fail('PUBLICATION_KNOWLEDGE','Correction does not uniquely match a selected recipient receipt');seen.add(receipt.id);
  }
  const projection=await this.#knowledge.projection({scope,observerId,receiptIds,correctionIds,worldTime,max:8});
  if(projection.claims.length!==receiptIds.length)fail('PUBLICATION_KNOWLEDGE','Every selected source must produce one authorized view');
  const view=validatePublicationView({kind:'knowledge-publication',version:1,title,worldTime,claims:projection.claims.map(({text,stance})=>({text,stance}))});
  return {sourceRefs,view};
 }
 async read({scope='world',id}={}){
  this.#authority();assertNarrativeId(id);const row=await this.#domains.read('knowledge-publication',scope,id);if(!row)return null;
  const {state,approval,retirement,bodyDigest,...body}=row.data??{};
  if(!['draft','approved','retired'].includes(state)||!['ChatMessage','JournalEntry'].includes(body.nativeKind)||bodyDigest!==await fingerprint(body))fail('PUBLICATION_CORRUPT','Protected publication contract or content fingerprint differs');
  validatePublicationView(body.view);
  if(body.view.kind==='roll-publication'){
   if(body.nativeKind!=='ChatMessage'||!['gm-only','all-players','observers'].includes(body.audience)||!body.rollSource||!['d20','opposed'].includes(body.rollSource.kind)||!Number.isSafeInteger(body.rollSource.revision)||body.rollSource.revision<1)fail('PUBLICATION_CORRUPT','Invalid mechanical roll publication policy');
   assertNarrativeId(body.rollSource.attemptId);ids(body.observerIds);if((body.audience==='observers')!==(body.observerIds.length>0))fail('PUBLICATION_CORRUPT','Roll recipients must match its disclosure policy');this.#authority();return row;
  }
  if(body.audience!=='observer')fail('PUBLICATION_CORRUPT','Knowledge publications require a known observer');
  assertNarrativeId(body.observerId);ids(body.receiptIds);ids(body.correctionIds);
  if(!Array.isArray(body.sourceRefs)||body.sourceRefs.length>24)fail('PUBLICATION_CORRUPT','Invalid bounded source observations');
  for(const ref of body.sourceRefs){assertNarrativeId(ref.id);if(!['knowledge-receipt','knowledge-claim','knowledge-correction'].includes(ref.type)||!Number.isSafeInteger(ref.revision)||ref.revision<1)fail('PUBLICATION_CORRUPT','Unsupported publication source');}
  this.#authority();return row;
 }
 async prepare({scope='world',id,observerId,nativeKind,title,receiptIds=[],correctionIds=[],worldTime,sourceEventId}={}){
  this.#authority();for(const value of [id,observerId,sourceEventId])assertNarrativeId(value);
  if(!['ChatMessage','JournalEntry'].includes(nativeKind)||!Number.isFinite(worldTime)||worldTime<0||worldTime>1e12)fail('PUBLICATION_CONTRACT','Explicit native channel and fictional time required');
  const selection=clone({scope,observerId,title,receiptIds:ids(receiptIds),correctionIds:ids(correctionIds),worldTime});if(!selection.receiptIds.length)fail('PUBLICATION_KNOWLEDGE','Select at least one authorized receipt');
  const snapshot=await this.#snapshot(selection),body={nativeKind,audience:'observer',observerId,receiptIds:selection.receiptIds,correctionIds:selection.correctionIds,...snapshot};
  this.#authority();return this.#domains.save({type:'knowledge-publication',scope,id,sourceEventId,data:{state:'draft',...body,bodyDigest:await fingerprint(body)}});
 }
 async #fresh(row){
  if(row.data.view.kind==='roll-publication'){
   const source=await this.#rollSnapshot(row.data.rollSource);if(JSON.stringify(source)!==JSON.stringify(row.data.rollSource))fail('PUBLICATION_SOURCE_STALE','Mechanical roll changed after preparation');return;
  }
  const current=await this.#snapshot({scope:row.scope,observerId:row.data.observerId,receiptIds:row.data.receiptIds,correctionIds:row.data.correctionIds,worldTime:row.data.view.worldTime,title:row.data.view.title});
  if(JSON.stringify(current.sourceRefs)!==JSON.stringify(row.data.sourceRefs)||JSON.stringify(current.view)!==JSON.stringify(row.data.view))fail('PUBLICATION_SOURCE_STALE','Publication inputs changed after preparation');
 }
 async #rollSnapshot({kind,attemptId,revision,disclosure,side}){
  if(typeof this.#readRoll!=='function')fail('PUBLICATION_DEPENDENCY','Authoritative native roll reader required');
  const row=await this.#readRoll(kind,attemptId);
  if(!row||row.state!=='resolved'||row.kind!==(kind==='d20'?'native-roll':'native-opposed-roll')||row.attemptId!==attemptId||row.revision!==revision||row.fingerprint!==await fingerprint(row.request))fail('PUBLICATION_SOURCE_STALE','Resolved native roll identity, revision and request proof required');
  this.#authority();return {kind,attemptId,revision,disclosure,side,recordDigest:await fingerprint(row)};
 }
 /** Roll visibility grants no narrative knowledge and cannot reveal a DC,
  * modifier, opponent total, raw Roll JSON, or canonical correctness field. */
 async prepareRoll(spec={}){
  this.#authority();if(Object.keys(spec).some(k=>!['scope','id','title','worldTime','audience','observerIds','rollKind','attemptId','expectedRollRevision','disclosure','side','sourceEventId'].includes(k)))fail('PUBLICATION_CONTRACT','Only authored roll identity and disclosure policy are accepted');
  const {scope='world',id,title,worldTime,audience,rollKind:kind,attemptId,expectedRollRevision:revision,disclosure,side=kind==='opposed'?'initiator':'self',sourceEventId}=clone(spec),observerIds=ids(spec.observerIds??[]);
  for(const value of [id,attemptId,sourceEventId])assertNarrativeId(value);
  if(!['d20','opposed'].includes(kind)||!['gm-only','all-players','observers'].includes(audience)||(audience==='observers')!==(observerIds.length>0)||!['total-only','outcome-only','total-and-outcome'].includes(disclosure)||!Number.isFinite(worldTime)||worldTime<0||worldTime>1e12||!(kind==='d20'?side==='self':['initiator','opponent'].includes(side)))fail('PUBLICATION_CONTRACT','Explicit roll kind, recipient policy, selected fields and fictional time required');
  const rollSource=await this.#rollSnapshot({kind,attemptId,revision,disclosure,side}),roll=await this.#readRoll(kind,attemptId);
  if(await fingerprint(roll)!==rollSource.recordDigest)fail('PUBLICATION_SOURCE_STALE','Roll changed while preparing its disclosure');
  const total=kind==='d20'?roll.total:roll.totals?.[side];let outcome=roll.outcome;
  if(kind==='opposed')outcome=roll.winner==='tie'?'tie':roll.band==='partial'?(roll.winner===side?'partial-success':'partial-failure'):(roll.winner===side?'success':'failure');
  const view=validatePublicationView({kind:'roll-publication',version:1,title,worldTime,mode:kind==='d20'?roll.request.mode:'opposed',disclosure,...(disclosure!=='outcome-only'?{total}:{}),...(disclosure!=='total-only'?{outcome}:{})}),body={nativeKind:'ChatMessage',audience,observerIds,rollSource,view};
  this.#authority();return this.#domains.save({type:'knowledge-publication',scope,id,sourceEventId,data:{state:'draft',...body,bodyDigest:await fingerprint(body)}});
 }
 async approve({scope='world',id,expectedRevision,reviewEventId}={}){
  assertNarrativeId(reviewEventId);const row=await this.read({scope,id});if(!row||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Publication changed before GM review');
  if(row.data.state!=='draft')fail('PUBLICATION_FINAL','Only draft publication plans can be approved');await this.#fresh(row);this.#authority();
  return this.#domains.save({type:'knowledge-publication',scope,id,expectedRevision,sourceEventId:reviewEventId,data:{...row.data,state:'approved',approval:{reviewEventId}}});
 }
 async forExecution({scope='world',id,expectedRevision}={}){
  const row=await this.read({scope,id});if(!row||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Publication changed before the approved effect');
  if(row.data.state!=='approved')fail('PUBLICATION_APPROVAL_REQUIRED','A reviewed immutable publication plan is required');await this.#fresh(row);this.#authority();return row;
 }
 async propose({scope='world',id,expectedRevision}={}){
  this.#authority();if(typeof this.#router?.ingest!=='function'||typeof this.#ledger?.get!=='function'||typeof this.#world!=='string'||!this.#world)fail('PUBLICATION_DEPENDENCY','Protected canonical event pipeline required');
  const row=await this.read({scope,id});if(!row||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Publication changed before proposing its effect');
  if(row.data.state!=='approved')fail('PUBLICATION_APPROVAL_REQUIRED','Reviewed publication required');
  const key=await fingerprint({world:this.#world,scope,id,revision:row.revision}),event=versionedEvent({id:`ep:event:publication_${key.slice(0,28)}`,eventType:'narrative.publication-reviewed',source:{kind:'gm-approved-intent',capability:'verified-publication-v1',requestId:`ep:request:publication_${key.slice(0,28)}`},payload:{scope,publicationId:id,expectedPublicationRevision:row.revision}}),existing=await this.#ledger.get(event.id);
  if(existing){if(JSON.stringify(existing.event)!==JSON.stringify(event))fail('EVENT_REUSE_CONFLICT','Publication event identity has different content');return {eventId:event.id,status:'duplicate-or-recovery-required',persistedState:existing.state};}
  await this.#fresh(row);this.#authority();return {eventId:event.id,...await this.#router.ingest(event)};
 }
 async retire({scope='world',id,expectedRevision,reason,reviewEventId}={}){
  assertNarrativeId(reviewEventId);const row=await this.read({scope,id});if(!row||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Publication changed before retirement');
  if(row.data.state!=='approved'||typeof reason!=='string'||!reason.trim()||reason.length>300)fail('PUBLICATION_REVIEW','Approved publication and bounded review reason required');
  return this.#domains.save({type:'knowledge-publication',scope,id,expectedRevision,sourceEventId:reviewEventId,data:{...row.data,state:'retired',retirement:{reason:reason.trim(),reviewEventId}}});
 }
}
