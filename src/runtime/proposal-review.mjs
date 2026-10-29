/** Durable GM approval and separately authorized effect application for published graph proposals.
 *
 * Approval is stored before native mutation. The executor never blindly retries
 * applying a proposal if it sees an existing applying/uncertain journal record.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {clone} from '../contracts/record.mjs';
import {EffectCoordinator} from './effects.mjs';
import {ALL_EFFECT_NODE_PROVIDER} from '../graph/node-catalog.mjs';
import {GraphDataFrame} from './graph-data-frame.mjs';
import {resolveDataGuard} from './data-guards.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const MAX_PROPOSALS=32;
const DOMAIN_NODE_EFFECTS=ALL_EFFECT_NODE_PROVIDER;
const PROVENANCE_FIELDS=['operationId','idempotencyKey','sourceEventId','providerId','graphId','publishedVersion','nodeId','rootGraphId','rootPublishedVersion','callChain','payload','guardInputs','stateInputs'];
function assertJournalProvenance(journal,proposal){
  if(!journal)fail('OPERATION_NOT_COMPLETED','Original operation journal is required');
  for(const key of PROVENANCE_FIELDS)if(JSON.stringify(journal[key])!==JSON.stringify(proposal[key]))fail('OPERATION_PROVENANCE','Effect journal differs from its original proposal');
}
function assertOperationId(id){if(typeof id!=='string'||!/^ep:operation:[a-zA-Z0-9_:-]{6,200}$/.test(id))fail('INVALID_OPERATION','Invalid operation ID');return id;}
export async function proposalLocator(eventId,operationId){
  if(typeof eventId!=='string'||!/^ep:event:[A-Za-z0-9_-]{8,120}$/.test(eventId))fail('INVALID_EVENT','Invalid event ID');
  assertOperationId(operationId);
  const h=await sha256Hex(`${eventId}\u0000${operationId}`);
  return {id:`ep:review:${h.slice(0,24)}`,partitionId:`effect-review:${h.slice(0,2)}`};
}
export class DurableProposalReview {
  #repository;#ledger;#registry;#providers;#journal;#gm;#coordinator;#readRoll;#dependencyGuard;
  constructor({repository,ledger,registry,providers,journal,gmProvider,readRoll=null,dependencyGuard=null}={}){
    if(!repository?.read||!repository?.put||!ledger?.get||!registry?.getActive||
      !providers?.get||!journal?.get||typeof gmProvider!=='function')fail('INVALID_RUNTIME','Proposal review requires protected repository, active graph, ledger and provider journal');
    this.#repository=repository;this.#ledger=ledger;this.#registry=registry;
    this.#providers=providers;this.#journal=journal;this.#gm=gmProvider;
    this.#readRoll=readRoll;
    if(dependencyGuard!==null&&typeof dependencyGuard!=='function')fail('INVALID_RUNTIME','Optional dependency guard must be callable');this.#dependencyGuard=dependencyGuard;
    this.#coordinator=new EffectCoordinator({journal,providers});
  }
  #context(){const ctx=this.#gm();assertLocalGM(ctx);return ctx;}
  #dataOptions(event){
    let reads=0;return {event,readRoll:this.#readRoll,consume:()=>{this.#context();if(++reads>160)fail('EVALUATION_BUDGET','Review dependency budget exhausted');},
      readGraph:async(id,version)=>{this.#context();return this.#registry.getPublished(id,version);},
      readState:async({scope,key})=>{this.#context();const provider=this.#providers.get('narrative.set-state');if(typeof provider?.get!=='function')fail('STATE_READ_UNAVAILABLE','Protected state reader is unavailable');return provider.get({scope,key,value:null});}};
  }
  async #proposal(eventId,operationId,{mustBeActive=false}={}){
    this.#context();assertOperationId(operationId);
    const entry=await this.#ledger.get(eventId);
    if(!entry||entry.state!=='review-required')fail('EVENT_NOT_REVIEWABLE','Event not awaiting review');
    if(!Array.isArray(entry.proposals)||entry.proposals.length>MAX_PROPOSALS)fail('INVALID_PROPOSAL','Event review payload malformed');
    const proposals=entry.proposals.filter(p=>p.operationId===operationId);
    if(proposals.length!==1)fail('PROPOSAL_NOT_FOUND','Proposal must match a unique persisted event entry');
    const proposal=proposals[0];
    if(proposal.sourceEventId!==eventId||typeof proposal.idempotencyKey!=='string'||proposal.state!=='requires-gm-approval')
      fail('INVALID_PROPOSAL','Proposal provenance or approval state is invalid');
    if(mustBeActive){
      const options=this.#dataOptions(entry.event),contexts=new Map();let parameters={},stack=[];
      const chain=proposal.callChain??[];
      if(!Array.isArray(chain)||chain.length>8)fail('SUBGRAPH_PROVENANCE','Invalid bounded subgraph chain');
      if(chain.length){
        const activeRoot=await this.#registry.getActive(proposal.rootGraphId);
        if(!activeRoot||activeRoot.publishedVersion!==proposal.rootPublishedVersion)
          fail('PUBLISHED_REVISION_STALE','Root graph changed after nested proposal');
        let current=activeRoot;stack=[current.id];contexts.set(current.id,{parameters:{},stack:[...stack]});
        for(const link of chain){
          const call=current.nodes.find(n=>n.id===link.callNodeId&&!n.disabled&&['core.subgraph.call','core.subgraph.mixed'].includes(n.typeId));
          if(link.parentGraphId!==current.id||link.parentVersion!==current.publishedVersion||
            !call||call.data.graphId!==link.childGraphId||call.data.publishedVersion!==link.childVersion||
            (call.typeId==='core.subgraph.mixed'?link.mode!=='mixed':link.mode!==undefined))
            fail('SUBGRAPH_PROVENANCE','Published subgraph call chain no longer matches');
          if(call.typeId==='core.subgraph.mixed'){
            const frame=new GraphDataFrame(current,{...options,parameters,stack}),invocation=await frame.invocation(call.id);
            if(JSON.stringify(invocation.parameters)!==JSON.stringify(link.parameters)||JSON.stringify(frame.stateInputs)!==JSON.stringify(link.parameterStateInputs))fail('DATA_REVISION_STALE','Subgraph arguments changed after evaluation');
            parameters=invocation.parameters;current=invocation.graph;
          }else{parameters={};current=await this.#registry.getPublished(link.childGraphId,link.childVersion);}
          if(!current||current.publishedVersion!==link.childVersion)fail('SUBGRAPH_UNAVAILABLE','Published child graph unavailable');
          if(stack.includes(current.id))fail('SUBGRAPH_RECURSION','Recursive invocation chain');stack=[...stack,current.id];contexts.set(current.id,{parameters:clone(parameters),stack:[...stack]});
        }
        if(current.id!==proposal.graphId||current.publishedVersion!==proposal.publishedVersion)
          fail('SUBGRAPH_PROVENANCE','Nested proposal leaf does not match published child');
      }
      const active=chain.length?await this.#registry.getPublished(proposal.graphId,proposal.publishedVersion):await this.#registry.getActive(proposal.graphId);
      const authored=active?.nodes.find(n=>n.id===proposal.nodeId&&!n.disabled&&
          ((n.typeId==='core.effect.proposal'&&n.data.providerId===proposal.providerId)||
           (n.typeId==='core.milestone.qualify'&&proposal.providerId==='narrative.qualify-milestone'&&n.data.milestoneId===proposal.payload?.milestoneId)||
           (Object.hasOwn(DOMAIN_NODE_EFFECTS,n.typeId)&&DOMAIN_NODE_EFFECTS[n.typeId]===proposal.providerId)));
      if(!active||active.publishedVersion!==proposal.publishedVersion||!authored)
        fail('PUBLISHED_REVISION_STALE','Proposal no longer matches its active published graph');
      if(!chain.length){stack=[active.id];contexts.set(active.id,{parameters:{},stack});}
      if(proposal.guardInputs===undefined&&active.nodes.some(n=>['core.state.read','core.branch.data'].includes(n.typeId)))fail('GUARD_EVIDENCE_REQUIRED','Legacy proposal lacks reconstructable state-guard evidence');
      if(proposal.guardInputs!==undefined&&(!Array.isArray(proposal.guardInputs)||proposal.guardInputs.length>32))fail('GUARD_EVIDENCE_INVALID','Invalid bounded guard evidence');
      for(const guard of proposal.guardInputs??[]){
        const source=await options.readGraph(guard.graphId,guard.publishedVersion),node=source?.nodes.find(n=>n.id===guard.nodeId&&!n.disabled);
        if(!node)fail('GUARD_EVIDENCE_INVALID','Guard no longer matches a published node');
        const context=contexts.get(guard.graphId);if(!context)fail('GUARD_EVIDENCE_INVALID','Guard is outside this invocation path');
        const current=await resolveDataGuard(source,node,{...options,...context});
        if(JSON.stringify(current)!==JSON.stringify(guard))fail('DATA_REVISION_STALE','A branch input changed after event evaluation');
      }
      if(authored.typeId!=='core.milestone.qualify'){
        const frame=new GraphDataFrame(active,{...options,parameters,stack});
        const payload=await frame.payload(authored);
        if(authored.data.inputBindings&&JSON.stringify(frame.stateInputs)!==JSON.stringify(proposal.stateInputs))
          fail('DATA_REVISION_STALE','Data dependencies changed after evaluation');
        if(JSON.stringify(payload)!==JSON.stringify(proposal.payload))fail('PUBLISHED_REVISION_STALE','Proposal payload differs from its published data inputs');
      }
    }
    if(mustBeActive&&this.#dependencyGuard){await this.#dependencyGuard({entry,proposal});this.#context();}
    return proposal;
  }
  async get(eventId,operationId){
    const gm=this.#context(),loc=await proposalLocator(eventId,operationId);
    const row=await this.#repository.read(loc.id,{partitionId:loc.partitionId,gm});
    if(row){
      if(row.kind!=='proposal-review'||row.operationId!==operationId||row.sourceEventId!==eventId||row.id!==loc.id)
        fail('REVIEW_CORRUPT','Proposal review identity mismatch');
      if(typeof this.#repository.hasReadyIndex==='function'&&
        !await this.#repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm}))
        fail('INDEX_UNCERTAIN','Review index incomplete');
    }
    return row;
  }
  async decide(eventId,operationId,{approve=false,reason=''}={}){
    const gm=this.#context();await this.#proposal(eventId,operationId,{mustBeActive:approve});
    if(typeof reason!=='string'||reason.length>500)fail('INVALID_DECISION','A bounded review note is required');
    const existing=await this.get(eventId,operationId);
    if(existing){
      if(existing.state===(approve?'approved':'rejected'))return existing;
      fail('REVIEW_ALREADY_DECIDED','Proposal has already been reviewed');
    }
    const loc=await proposalLocator(eventId,operationId);
    const row={...loc,kind:'proposal-review',sourceEventId:eventId,operationId,
      approvedBy:gm.userId,state:approve?'approved':'rejected',reason};
    try{await this.#repository.put(row,{expectedRevision:null,gm});}
    catch(error){const found=await this.get(eventId,operationId);if(!found)throw error;
      if(found.state!==(approve?'approved':'rejected'))fail('REVIEW_ALREADY_DECIDED','Conflicting GM review');
    }
    const verified=await this.get(eventId,operationId);
    if(!verified||verified.state!==(approve?'approved':'rejected'))fail('REVIEW_NOT_DURABLE','Review write not verified');
    return verified;
  }
  async #change(row,next,extra={}){
    const gm=this.#context(),loc=await proposalLocator(row.sourceEventId,row.operationId);
    const updated=await this.#repository.put({...row,...clone(extra),...loc,state:next},
      {expectedRevision:row.revision,gm});
    const confirmed=await this.get(row.sourceEventId,row.operationId);
    if(!confirmed||confirmed.state!==next||confirmed.revision!==updated.revision)
      fail('REVIEW_WRITE_UNCERTAIN','Review update lacks read-back verification');
    return confirmed;
  }
  async execute(eventId,operationId){
    const gm=this.#context();
    const proposal=await this.#proposal(eventId,operationId,{mustBeActive:true});
    const row=await this.get(eventId,operationId);
    if(!row||row.state!=='approved')fail('APPROVAL_REQUIRED','GM approval must be persisted before execution');
    if(row.approvedBy!==gm.userId)fail('APPROVER_CHANGED','Execution requires the approving GM; use reconciliation after handover');
    const provider=this.#providers.get(proposal.providerId);
    if(!provider)fail('MISSING_CAPABILITY','Required effect provider unavailable');
    provider.validate(proposal.payload);
    // Do not trust mutable provider payload fields to select a different event or action.
    const executing=await this.#change(row,'executing');
    let result;
    try{result=await this.#coordinator.execute(proposal,gm);}
    catch(error){
      try{await this.#change(executing,'uncertain',{failureCode:error.code??'EXECUTION_FAILURE'});}catch{}
      return {status:'uncertain',reason:error.code??'EXECUTION_FAILURE'};
    }
    try {
      const done=await this.#change(executing,result.status==='completed'||result.status==='already-completed'?'completed':'uncertain',
        {journalState:result.record?.state??null});
      return {status:done.state,record:done};
    }catch(error){return {status:'uncertain',reason:'REVIEW_UPDATE_UNCERTAIN'};}
  }
  /** A successor can approve the same still-unexecuted proposal. This never
   * adopts an application attempt or treats an uncertain journal as absent. */
  async adoptApproval(eventId,operationId,{approved=false,expectedRevision,reason=''}={}){
    const gm=this.#context(),lease=()=>{const now=this.#context();if(now.userId!==gm.userId||now.worldId!==gm.worldId||now.epoch!==gm.epoch)fail('GM_AUTHORITY_CHANGED','GM changed while reviewing approval transfer');};
    if(approved!==true||typeof reason!=='string'||!reason.trim()||reason.length>500)fail('APPROVAL_ADOPTION_REVIEW','Explicit successor review and a bounded reason are required');
    const proposal=await this.#proposal(eventId,operationId,{mustBeActive:true}),row=await this.get(eventId,operationId);
    if(!row||row.state!=='approved'||typeof row.approvedBy!=='string'||!row.approvedBy)fail('APPROVAL_ADOPTION_STATE','Only an approved operation with no execution attempt can be transferred');
    if(row.revision!==expectedRevision)fail('REVISION_CONFLICT','Approval changed during successor review');
    const started=typeof this.#journal.hasRecordOrIndex==='function'?await this.#journal.hasRecordOrIndex(proposal.idempotencyKey):await this.#journal.get(proposal.idempotencyKey)!==null;lease();
    if(started)fail('APPROVAL_ADOPTION_JOURNAL','An existing journal or index requires outcome reconciliation, not approval transfer');
    if(row.approvedBy===gm.userId){if(row.adoptedBy===gm.userId&&row.reason===reason)return row;fail('APPROVAL_ALREADY_OWNED','The current GM already owns this approval');}
    const history=row.approvalHistory??[];if(!Array.isArray(history)||history.length>=16)fail('REVIEW_HISTORY_BUDGET','Approval transfer history needs explicit maintenance');
    lease();const transferred=await this.#change(row,'approved',{approvedBy:gm.userId,adoptedBy:gm.userId,reason,approvalHistory:[...clone(history),{approvedBy:row.approvedBy,reason:row.reason,revision:row.revision}]});lease();return transferred;
  }
  /** Read-only classification. Never reapplies native effects and never assumes that no journal means no effect. */
  async inspectRecovery(eventId,operationId){
    this.#context();const row=await this.get(eventId,operationId);
    if(!row)return {state:'unreviewed'};
    if(!['executing','uncertain'].includes(row.state))return {state:row.state};
    const proposal=await this.#proposal(eventId,operationId);
    const journal=await this.#journal.get(proposal.idempotencyKey);
    return {state:row.state,journalState:journal?.state??'missing',
      next:journal?.state==='completed'?'review-and-reconcile-completion':'manual-effect-verification-required'};
  }
  /** Explicit historical reconciliation. Only verify the original operation:
   * never apply, rebuild a proposal, or replay a graph after GM handover. */
  async reconcile(eventId,operationId,{approved=false}={}){
    const gm=this.#context(),lease=()=>{const current=this.#context();if(current.userId!==gm.userId||current.worldId!==gm.worldId||current.epoch!==gm.epoch)fail('GM_AUTHORITY_CHANGED','GM authority changed during reconciliation');};
    if(approved!==true)fail('APPROVAL_REQUIRED','Explicit GM reconciliation approval required');
    const proposal=await this.#proposal(eventId,operationId),row=await this.get(eventId,operationId);
    if(!row||!['executing','uncertain','completed'].includes(row.state)||typeof row.approvedBy!=='string'||!row.approvedBy)fail('RECONCILIATION_REQUIRED','An originally approved, interrupted operation is required');
    let journal=await this.#journal.get(proposal.idempotencyKey);assertJournalProvenance(journal,proposal);lease();
    if(journal.state==='completed'){
      if(journal.verification!=='confirmed')fail('OPERATION_NOT_COMPLETED','Completed journal lacks confirmed verification');
    }else{
      if(row.state==='completed'||!['applying','verifying','uncertain'].includes(journal.state))fail('RECONCILIATION_REQUIRED','Journal does not establish an interrupted application');
      const provider=this.#providers.get(proposal.providerId);
      if(typeof provider?.verify!=='function')fail('MISSING_CAPABILITY','Original effect verifier unavailable');
      if(typeof provider.validate==='function')provider.validate(proposal.payload);
      const originalContext={...gm,operationId:proposal.operationId,sourceEventId:eventId,graphId:proposal.graphId,nodeId:proposal.nodeId};let confirmed=await provider.verify(clone(proposal.payload),originalContext);
      if(confirmed!==true&&typeof provider.confirmOriginal==='function'){lease();await provider.confirmOriginal(clone(proposal.payload),originalContext,{approved:true});lease();confirmed=await provider.verify(clone(proposal.payload),originalContext);}
      lease();if(confirmed!==true)fail('VERIFICATION_UNCONFIRMED','Original operation outcome is not confirmed; no effect was retried');
      await this.#journal.change(proposal.idempotencyKey,journal.state,{state:'completed',verification:'confirmed',reconciliation:{version:1,byUserId:gm.userId,originalApprovedBy:row.approvedBy}});
      journal=await this.#journal.get(proposal.idempotencyKey);lease();assertJournalProvenance(journal,proposal);
      if(journal.state!=='completed'||journal.verification!=='confirmed'||journal.reconciliation?.byUserId!==gm.userId)fail('JOURNAL_WRITE_UNCERTAIN','Reconciled journal lacks durable read-back verification');
    }
    lease();
    if(row.state==='completed')return {status:'completed',record:row};
    const completed=await this.#change(row,'completed',{journalState:'completed',reconciledBy:gm.userId});lease();
    return {status:'completed',record:completed};
  }
  /** Historical completion proof. Does not reapply an effect or assert that
   * its result still describes current world state. */
  async verifiedCompletion(eventId,operationId){
    this.#context();assertOperationId(operationId);
    const entry=await this.#ledger.get(eventId),matches=entry?.proposals?.filter(p=>p.operationId===operationId)??[];
    if(matches.length!==1||matches[0].sourceEventId!==eventId)fail('PROPOSAL_NOT_FOUND','A unique original operation proposal is required');
    const proposal=matches[0],review=await this.get(eventId,operationId),journal=await this.#journal.get(proposal.idempotencyKey);
    if(review?.state!=='completed'||typeof review.approvedBy!=='string'||!review.approvedBy||journal?.state!=='completed'||journal.verification!=='confirmed')fail('OPERATION_NOT_COMPLETED','Durable approved and verified completion is required');
    assertJournalProvenance(journal,proposal);
    const rootGraphId=proposal.rootGraphId??proposal.graphId,rootPublishedVersion=proposal.rootPublishedVersion??proposal.publishedVersion;
    const nodeIds=[...new Set([...(proposal.graphId===rootGraphId?[proposal.nodeId]:[]),...(proposal.callChain??[]).filter(link=>link.parentGraphId===rootGraphId).map(link=>link.callNodeId)])];
    return {sourceEventId:eventId,operationId,rootGraphId,rootPublishedVersion,nodeIds};
  }
}
