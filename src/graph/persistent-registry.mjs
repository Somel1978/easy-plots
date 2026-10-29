/**
 * Durable graph draft / immutable snapshot / independent activation contracts.
 * Works with the bounded Foundry native repository after LIVE authorization
 * verification, or with the isolated MemoryPartitionRepository for tests.
 * Every mutation must carry an eligible GM context; native repository imposes
 * stronger designated-writer and access-proof gates.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {validateGraph} from './validate.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {GRAPH_NODE_TYPES, ALL_EFFECT_NODE_PROVIDER} from './node-catalog.mjs';
import {validateNarrativeCapability,NARRATIVE_NODE_EFFECT_PROVIDER} from '../runtime/narrative-capabilities.mjs';
import {factionStandingInput,obligationInput,evidenceInput} from '../runtime/domain-providers.mjs';
import {LOGIC_NODE_TYPES,validateLogicNode} from './logic-nodes.mjs';
import {STATE_READ_TYPE,validateStateRead} from './state-read.mjs';
import {DATA_NODE_TYPES,validateDataNode,validateInputBindings,assertPublishedDataInterface} from './typed-data.mjs';
import {validateSubgraphCall} from './subgraph-call.mjs';
import {validateFlowJoin} from './flow-join.mjs';
import {validateEventTrigger,isTriggerNode} from './trigger-contract.mjs';
import {EXTENDED_DOMAIN_PROVIDER_IDS,validateExtendedDomainPayload} from '../runtime/extended-providers.mjs';
import {validateJournalMaterialization} from '../platform/foundry-journal-provider.mjs';
import {validateNativeShell} from '../platform/foundry-actor-item-provider.mjs';
import {validateNativeBinding} from '../platform/foundry-resource-binding.mjs';
import {validateNativeReferenceEffect} from '../runtime/reverse-reference-provider.mjs';
import {validateReviewedHypothesisPayload} from '../runtime/reviewed-hypothesis-provider.mjs';
import {validateReviewedKnowledgePayload} from '../runtime/reviewed-knowledge-provider.mjs';
import {validateReviewedFactionAgendaPayload} from '../runtime/reviewed-faction-agenda-provider.mjs';
import {validateReviewedFactionSchedulePayload} from '../runtime/reviewed-faction-schedule-provider.mjs';
import {validateReviewedMilestonePayload} from '../runtime/reviewed-milestone-provider.mjs';
import {validateNPCActionPayload} from '../runtime/npc-action-provider.mjs';
import {validateBoardEditApproval} from '../runtime/player-board-edit-provider.mjs';
import {validateNativePublicationPayload} from '../platform/protected-native-publications.mjs';
import {validateQueueNoticePayload} from '../runtime/notification-queue-provider.mjs';
import {validateNativeBatchPayload,NATIVE_BATCH_PROVIDER} from '../runtime/native-batch-provider.mjs';
import {validateResourceActivation,RESOURCE_ACTIVATION_PROVIDER} from '../runtime/resource-manifest-provider.mjs';
import {validateSpatialRegion} from '../domains/spatial-contract.mjs';

const failure=(code,message)=>{throw new EasyPlotsError(code,message);};
const SUPPORTED_NODE_TYPES=new Set(GRAPH_NODE_TYPES);
const SIZE_LIMIT=44_000; // Conservative per-document prototype limit, not final full-graph limit.
const textEncoder=new TextEncoder();
const isJSONRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
function canonical(value,seen=new WeakSet()) {
  if(value===null || typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(typeof value!=='object')failure('NON_JSON_DATA','Graph may only contain finite JSON data');
  if(seen.has(value))failure('CYCLIC_DATA','Graph cannot contain circular references');
  seen.add(value);
  let out;
  if(Array.isArray(value))out=`[${value.map(v=>canonical(v,seen)).join(',')}]`;
  else if(isJSONRecord(value))out=`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k],seen)}`).join(',')}}`;
  else failure('NON_JSON_DATA','Graph must contain only plain JSON objects');
  seen.delete(value);
  return out;
}
const digest=sha256Hex;
const safeScope=scope=>{
  if(typeof scope!=='string'||!/^[a-z][a-z0-9-]{0,45}$/.test(scope))failure('INVALID_SCOPE','Scope must be a short stable partition slug');
  return scope;
};
export function assertSupported(graph,{capabilities=[],extensions=null,maxBytes=SIZE_LIMIT}={}) {
  if(!isJSONRecord(graph))failure('INVALID_GRAPH','Graph must be a plain object');
  const json=canonical(graph);
  if(textEncoder.encode(json).length>maxBytes)failure('GRAPH_RECORD_TOO_LARGE','Graph exceeds the configured bounded snapshot budget');
  for(const node of graph.nodes??[]) {
    if(node.typeId==='core.location.region'||node.typeId==='core.effect.proposal'&&node.data?.providerId==='narrative.location-region')validateSpatialRegion(node.data?.payload);
    if(node.typeId==='core.resource.activate-manifest'||node.typeId==='core.effect.proposal'&&node.data?.providerId===RESOURCE_ACTIVATION_PROVIDER)validateResourceActivation(node.data?.payload);
    if(node.typeId==='core.resource.ordered-batch'||node.typeId==='core.effect.proposal'&&node.data?.providerId===NATIVE_BATCH_PROVIDER)validateNativeBatchPayload(node.data?.payload);
    if(!SUPPORTED_NODE_TYPES.has(node.typeId)){
      if(!extensions?.get?.(node.typeId))failure('NODE_PROVIDER_UNAVAILABLE',`Unimplemented node provider: ${node.typeId}`);
      extensions.validateNode(node);
    }
    if(node.typeId==='core.flow.join')validateFlowJoin(node);
    if(node.typeId==='core.subgraph.call')validateSubgraphCall(node.data,{parentGraphId:graph.id});
    if(LOGIC_NODE_TYPES.includes(node.typeId))validateLogicNode(node);
    if(node.typeId===STATE_READ_TYPE)validateStateRead(node);
    if(DATA_NODE_TYPES.includes(node.typeId))validateDataNode(node);
    validateInputBindings(node);
    if(node.data?.inputBindings&&node.typeId!=='core.effect.proposal'&&!Object.hasOwn(ALL_EFFECT_NODE_PROVIDER,node.typeId))failure('DATA_BINDING','Only implemented effect providers consume payload bindings');
    if(isTriggerNode(node))validateEventTrigger(node);
    if(['core.condition','core.branch.condition'].includes(node.typeId)&&!isJSONRecord(node.data?.condition))failure('INVALID_CONDITION','Condition requires a structured expression');
    if(node.typeId==='core.milestone.qualify' && (typeof node.data?.milestoneId!=='string'||!/^ep:milestone:[a-zA-Z0-9_-]{3,120}$/.test(node.data.milestoneId)))failure('INVALID_MILESTONE','Milestone node requires stable ID');
    if(node.typeId==='core.effect.proposal' && (typeof node.data?.providerId!=='string'||!node.data.providerId))failure('INVALID_EFFECT','Effect proposal requires providerId');
    // Materializations/bindings must be attributed to the actual published
    // graph containing the effect node, never an arbitrary GM-authored origin.
    if(['core.resource.materialize-journal','core.resource.materialize-actor',
       'core.resource.materialize-item','core.resource.bind-native'].includes(node.typeId)&&
       node.data?.payload?.sourceGraphId!==graph.id)
      failure('RESOURCE_PROVENANCE_MISMATCH','Native resource source graph must match the published graph');
    if(Object.hasOwn(ALL_EFFECT_NODE_PROVIDER,node.typeId)){
      if(!isJSONRecord(node.data?.payload))failure('INVALID_EFFECT','Domain node requires a typed payload');
      const providerId=ALL_EFFECT_NODE_PROVIDER[node.typeId];
      if(EXTENDED_DOMAIN_PROVIDER_IDS.includes(providerId))validateExtendedDomainPayload(providerId,node.data.payload);
      if(providerId==='narrative.change-faction-standing')factionStandingInput(node.data.payload);
      if(providerId==='narrative.resolve-obligation')obligationInput(node.data.payload);
      if(providerId==='narrative.attest-evidence')evidenceInput(node.data.payload);
      if(Object.hasOwn(NARRATIVE_NODE_EFFECT_PROVIDER,node.typeId))validateNarrativeCapability(providerId,node.data.payload);
      if(providerId==='narrative.materialize-journal-shell')validateJournalMaterialization(node.data.payload);
      if(providerId==='narrative.materialize-actor-shell')validateNativeShell(node.data.payload,'Actor');
      if(providerId==='narrative.materialize-item-shell')validateNativeShell(node.data.payload,'Item');
      if(providerId==='narrative.bind-native-reference')validateNativeBinding(node.data.payload);
      if(providerId==='narrative.track-native-reference')validateNativeReferenceEffect(node.data.payload);
      if(providerId==='narrative.schedule-reviewed-faction-action')validateReviewedFactionSchedulePayload(node.data.payload);
      if(providerId==='narrative.schedule-npc-action')validateNPCActionPayload(node.data.payload);
      if(providerId==='narrative.apply-player-board-edit')validateBoardEditApproval(node.data.payload);
      if(providerId==='narrative.publish-known-content')validateNativePublicationPayload(node.data.payload);
      if(providerId==='narrative.queue-notification')validateQueueNoticePayload(node.data.payload);
      if(providerId==='narrative.review-faction-agenda')validateReviewedFactionAgendaPayload(node.data.payload);
      if(providerId==='narrative.approve-knowledge-recipient')validateReviewedKnowledgePayload(node.data.payload);
      if(providerId==='narrative.review-investigation-hypothesis')validateReviewedHypothesisPayload(node.data.payload);
      if(providerId==='narrative.complete-investigation-milestone')validateReviewedMilestonePayload(node.data.payload);
    }
  }
  return validateGraph(graph,{requiredCapabilities:capabilities});
}
/** Stable, deterministic storage locators, no campaign-wide graph discovery. */
export async function graphStorageKeys(graphId,scope='main') {
  assertNarrativeId(graphId); safeScope(scope);
  if(!graphId.startsWith('ep:graph:'))failure('INVALID_GRAPH_ID','Expected a graph identifier');
  const idHash=await digest(graphId);
  const idToken=idHash.slice(0,24);
  return Object.freeze({
    draft:{id:`ep:draft:${idToken}`,partitionId:`graph-drafts:${scope}`},
    activation:{id:`ep:activation:${idToken}`,partitionId:`graph-activations:${scope}`},
    snapshot:(revision)=>{
      if(!Number.isInteger(revision)||revision<1)failure('INVALID_VERSION','Snapshot requires a positive revision');
      return {id:`ep:snapshot:${idToken}_${revision}`,partitionId:`graph-snapshots:${scope}:${idHash.slice(0,2)}`};
    }
  });
}

export class PersistentGraphRegistry {
  #repo;#scope;#gmProvider;#extensions;#pageStore;#authoring;#preflight;#validations;
  constructor({repository,scope='main',gmProvider,extensions=null,pageStore=null,authoring=null,preflight=null,validations=null}) {
    if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function')
      failure('INVALID_REPOSITORY','A revision-aware repository and GM context provider are required');
    this.#repo=repository; this.#scope=safeScope(scope);this.#gmProvider=gmProvider;this.#extensions=extensions;this.#pageStore=pageStore;this.#authoring=authoring;
    this.#preflight=preflight;this.#validations=validations;
    if(authoring&&authoring.registryScope!==this.#scope)failure('PLOT_AUTHORITY_SCOPE','Authoring policy must match this exact graph registry scope');
  }
  get scope(){return this.#scope;}
  authorizeMutation(graphId,action,opts={}){return this.#authoring?.authorize(graphId,action,opts)??null;}
  inspectAuthority(graphId,opts={}){return this.#authoring?.inspect(graphId,opts)??Promise.resolve({graphId,rights:{edit:true,publish:true,activate:true},enforced:false});}
  assertLocalAuthoring(graphId,action){this.#authoring?.assertLocalAuthoring(graphId,action);}
  authoringRights(graphId){return this.#authoring?.cachedRights(graphId)??{edit:true,publish:true,activate:true};}
  #gm(){const gm=this.#gmProvider();assertLocalGM(gm);return gm;}
  #validationService(){return typeof this.#validations==='function'?this.#validations():this.#validations;}
  #preflightService(){return typeof this.#preflight==='function'?this.#preflight():this.#preflight;}
  async validateCandidate(graphId,{expectedRevision,capabilities=[],expectedValidationRevision=null,requesterContext=null}={}){
    this.#gm();const graph=await this.getDraft(graphId);if(!graph)failure('NOT_FOUND','Draft graph does not exist');
    if(graph.revision!==expectedRevision)failure('REVISION_CONFLICT','Candidate changed before validation');
    await this.authorizeMutation(graphId,'publish',{requesterContext});
    const service=this.#validationService();if(!service)return null;
    return service.validateCandidate(graph,{capabilities,expectedValidationRevision});
  }
  async inspectValidation(graphId,options={}){
    this.#gm();const graph=await this.getDraft(graphId);if(!graph)failure('NOT_FOUND','Draft graph does not exist');
    const service=this.#validationService();if(!service)return {status:'unconfigured',revision:null,report:null,changed:[]};return service.inspectCandidate(graph,options);
  }
  async publishedDependencyManifest(snapshot){this.#gm();return this.#validationService()?.publishedManifest(snapshot)??snapshot.dependencyManifest??null;}
  async adoptPublishedDependencies(graphId,publishedVersion,options={}){
    this.#gm();await this.authorizeMutation(graphId,'publish',options);const snapshot=await this.getPublished(graphId,publishedVersion);
    if(!snapshot)failure('NOT_FOUND','Published revision does not exist');const service=this.#validationService();if(!service)failure('VALIDATION_UNAVAILABLE','Persistent publication validation is not configured');return service.adoptPublished(snapshot,options);
  }
  async #read(loc,gm){
    const row=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});
    if(row&&typeof this.#repo.hasReadyIndex==='function' &&
      !(await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm})))
      failure('INDEX_UNCERTAIN','Stored record has not been certified by its bounded index; reconcile before use');
    return row;
  }
  async #put(record,expectedRevision,gm){return this.#repo.put(record,{expectedRevision,gm});}
  async getDraft(graphId){const gm=this.#gm(),keys=await graphStorageKeys(graphId,this.#scope);
    const row=await this.#read(keys.draft,gm);
    if(!row)return null;
    if(this.#authoring)await this.#authoring.inspect(graphId);
    if(row.kind!=='graph-draft')failure('DRAFT_CORRUPT','Unexpected draft storage type');
    if(row.graphRef){
      if(row.graphRef.graphId!==graphId||row.graphRef.revision!==row.revision||!this.#pageStore)failure('DRAFT_CORRUPT','Draft page reference mismatch');
      const graph=await this.#pageStore.getGraph(graphId,row.graphRef.revision);
      if(!graph||graph.id!==graphId||graph.revision!==row.revision)failure('DRAFT_CORRUPT','Draft page revision invalid');
      return graph;
    }
    if(row.graph?.id!==graphId||row.graph.revision!==row.revision)failure('DRAFT_CORRUPT','Draft identity or revision mismatch');
    return clone(row.graph);
  }
  async saveDraft(graph,{expectedRevision=null,requesterContext=null}={}) {
    const gm=this.#gm();assertNarrativeId(graph?.id);
    const keys=await graphStorageKeys(graph.id,this.#scope);
    const old=await this.#read(keys.draft,gm);
    if((old?.revision??null)!==expectedRevision)failure('REVISION_CONFLICT','Draft has been modified by another editor');
    const next=clone({...graph,revision:(old?.revision??0)+1});
    assertSupported(next,{extensions:this.#extensions,maxBytes:this.#pageStore?850_000:SIZE_LIMIT});
    await this.authorizeMutation(graph.id,'edit',{requesterContext,allowCreate:!old});
    // Persist immutable content pages before updating the mutable draft pointer.
    if(this.#pageStore)await this.#pageStore.publish(next,{revision:next.revision});
    await this.authorizeMutation(graph.id,'edit',{requesterContext});
    const row=await this.#put({...keys.draft,kind:'graph-draft',graphId:next.id,title:next.title,
      ...(this.#pageStore?{graphRef:{graphId:next.id,revision:next.revision}}:{graph:next})},expectedRevision,gm);
    if(row.revision!==next.revision)failure('WRITE_UNCERTAIN','Draft revision verification failed');
    const verified=await this.getDraft(next.id);
    if(!verified||verified.revision!==next.revision)failure('WRITE_UNCERTAIN','Draft not read back');
    return verified;
  }
  async getPublished(graphId,publishedVersion){
    const gm=this.#gm();const keys=await graphStorageKeys(graphId,this.#scope);
    const loc=keys.snapshot(publishedVersion);const row=await this.#read(loc,gm);
    if(!row)return null;
    if(row.kind!=='published-graph'||row.graphId!==graphId||row.publishedVersion!==publishedVersion)
      failure('SNAPSHOT_CORRUPT','Published snapshot identity mismatch');
    let snapshot=row.snapshot;
    if(row.graphRef){
      if(!this.#pageStore||row.graphRef.graphId!==graphId||row.graphRef.revision!==publishedVersion)failure('SNAPSHOT_CORRUPT','Published page reference invalid');
      const graph=await this.#pageStore.getGraph(graphId,publishedVersion);
      if(!graph)failure('SNAPSHOT_CORRUPT','Published graph pages unavailable');
      snapshot={...graph,publishedVersion,publicationReport:row.publicationReport,...(row.dependencyManifest?{dependencyManifest:row.dependencyManifest}:{})};
    }
    if(await digest(canonical(snapshot))!==row.fingerprint)failure('SNAPSHOT_CORRUPT','Published snapshot fingerprint mismatch');
    return clone(snapshot);
  }
  async publish(graphId,{expectedRevision,capabilities=[],acknowledgeWarnings=false,requesterContext=null}={}){
    const gm=this.#gm();const draft=await this.getDraft(graphId);
    if(!draft)failure('NOT_FOUND','Draft graph does not exist');
    if(!Number.isInteger(expectedRevision)||draft.revision!==expectedRevision)failure('REVISION_CONFLICT','The draft changed since the publication request');
    await this.authorizeMutation(graphId,'publish',{requesterContext});
    let report=assertSupported(draft,{capabilities,extensions:this.#extensions,maxBytes:this.#pageStore?850_000:SIZE_LIMIT});
    for(const node of draft.nodes)if(['core.data.call','core.subgraph.mixed'].includes(node.typeId))assertPublishedDataInterface(node,await this.getPublished(node.data.graphId,node.data.publishedVersion));
    for(const node of draft.nodes)if(node.typeId==='core.trigger.operations-completed'){
      const source=await this.getPublished(node.data.sourceGraphId,node.data.sourcePublishedVersion);
      if(!source||node.data.requiredNodeIds.some(id=>!source.nodes.some(n=>n.id===id&&!n.disabled&&(n.typeId==='core.effect.proposal'||n.typeId==='core.milestone.qualify'||['core.subgraph.call','core.subgraph.mixed'].includes(n.typeId)||Object.hasOwn(ALL_EFFECT_NODE_PROVIDER,n.typeId)))))failure('OPERATION_SOURCE_CONTRACT','Completion trigger must reference implemented operations in an exact published source graph');
    }
    const validations=this.#validationService(),preflight=this.#preflightService();
    if(validations)report=await validations.assertCurrent(draft,{capabilities,acknowledgeWarnings});
    else if(preflight){report=await preflight.inspect(draft,{capabilities});preflight.assertPublishable(report,{acknowledgeWarnings});}
    if(report.warnings.length && acknowledgeWarnings!==true)
      failure('PREFLIGHT_REVIEW_REQUIRED','Graph contains narrative reachability warnings requiring explicit GM acknowledgement');
    if(this.#pageStore)await this.#pageStore.publish(draft,{revision:draft.revision,capabilities});
    await this.authorizeMutation(graphId,'publish',{requesterContext});
    const snapshot=clone({...draft,publishedVersion:draft.revision,publicationReport:report,...(report.dependencyManifest?{dependencyManifest:report.dependencyManifest}:{})});
    const fp=await digest(canonical(snapshot));
    const keys=await graphStorageKeys(graphId,this.#scope);
    const loc=keys.snapshot(snapshot.publishedVersion);
    const old=await this.#read(loc,gm);
    if(old){
      if(old.fingerprint!==fp||old.graphId!==graphId)failure('IMMUTABLE_SNAPSHOT_CONFLICT','Published revision cannot be overwritten');
      return this.getPublished(graphId,snapshot.publishedVersion);
    }
    try {
      await this.#put({...loc,kind:'published-graph',graphId,publishedVersion:snapshot.publishedVersion,fingerprint:fp,
        ...(this.#pageStore?{graphRef:{graphId,revision:snapshot.publishedVersion},publicationReport:report,...(snapshot.dependencyManifest?{dependencyManifest:snapshot.dependencyManifest}:{})}:{snapshot})},null,gm);
    } catch(error){
      // An interrupted create can leave a pending index. Do NOT signal success.
      throw error;
    }
    const saved=await this.getPublished(graphId,snapshot.publishedVersion);
    if(!saved)failure('SNAPSHOT_NOT_DURABLE','Published snapshot not durably verified');
    return saved;
  }
  async getActivation(graphId){
    const gm=this.#gm();const keys=await graphStorageKeys(graphId,this.#scope);
    const row=await this.#read(keys.activation,gm);
    if(!row)return null;
    if(row.kind!=='graph-activation'||row.graphId!==graphId)failure('ACTIVATION_CORRUPT','Activation pointer mismatch');
    return clone(row);
  }
  async activate(graphId,publishedVersion,{expectedActivationRevision=null,requesterContext=null,capabilities=[]}={}){
    const gm=this.#gm();const keys=await graphStorageKeys(graphId,this.#scope);
    await this.authorizeMutation(graphId,'activate',{requesterContext});
    const snapshot=await this.getPublished(graphId,publishedVersion);
    if(!snapshot)failure('NOT_FOUND','Published revision does not exist');
    await this.#validationService()?.assertPublishedCurrent(snapshot,{capabilities});
    const old=await this.#read(keys.activation,gm);
    if((old?.revision??null)!==expectedActivationRevision)failure('REVISION_CONFLICT','Activation state has changed');
    if(old?.active&&old.publishedVersion===publishedVersion)return clone(old);
    await this.authorizeMutation(graphId,'activate',{requesterContext});
    return this.#put({...keys.activation,kind:'graph-activation',graphId,publishedVersion,active:true},expectedActivationRevision,gm);
  }
  async deactivate(graphId,{expectedActivationRevision,requesterContext=null}={}){
    const gm=this.#gm(),keys=await graphStorageKeys(graphId,this.#scope);
    await this.authorizeMutation(graphId,'activate',{requesterContext});
    const old=await this.#read(keys.activation,gm);
    if(!old)failure('NOT_FOUND','No active graph record');
    if(old.revision!==expectedActivationRevision)failure('REVISION_CONFLICT','Activation state has changed');
    await this.authorizeMutation(graphId,'activate',{requesterContext});
    return this.#put({...keys.activation,kind:'graph-activation',graphId,publishedVersion:old.publishedVersion,active:false},expectedActivationRevision,gm);
  }
  async getActive(graphId){
    const record=await this.getActivation(graphId);
    if(!record?.active)return null;
    const snapshot=await this.getPublished(graphId,record.publishedVersion);
    if(!snapshot)failure('BROKEN_ACTIVATION','Active revision not found');
    return snapshot;
  }
  async listDrafts({cursor='0:0',limit=16}={}){
    this.#gm();
    if(typeof this.#repo.query!=='function')failure('QUERY_UNAVAILABLE','Bounded query required');
    if(!Number.isInteger(limit)||limit<1||limit>16)failure('QUERY_BUDGET','Draft index page limit is 16');
    const page=await this.#repo.query({partitionId:`graph-drafts:${this.#scope}`,cursor,limit,gm:this.#gm()});
    const result=Array.isArray(page)?{items:page,nextCursor:null,unresolved:[]} : page;
    if(result.unresolved?.length)failure('INDEX_UNCERTAIN','Draft index contains records requiring reconciliation');
    return {items:result.items.filter(x=>x.kind==='graph-draft').map(x=>({id:x.graph?.id??x.graphId??x.graphRef?.graphId,title:x.graph?.title??x.title??x.graphRef?.graphId,revision:x.revision})),nextCursor:result.nextCursor??null};
  }
}
