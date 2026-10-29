/** Durable candidate evidence and explicit legacy-publication adoption. No
 * publication snapshot is rewritten and no activation/effect is performed. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {contractHash} from './dependency-contracts.mjs';
import {executionFingerprint,assertDependencyManifest} from './graph-dependencies.mjs';
import {assertPreflightReport} from './publication-preflight.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export function graphValidationLocator(graphId,{scope='main',publishedVersion=null}={}){
 assertNarrativeId(graphId);if(!graphId.startsWith('ep:graph:')||!/^[a-z][a-z0-9-]{0,45}$/.test(scope)||publishedVersion!==null&&(!Number.isSafeInteger(publishedVersion)||publishedVersion<1))fail('VALIDATION_LOCATOR','A graph, registry scope and optional immutable positive publication version are required');
 const token=contractHash({graphId,scope,publishedVersion});return {id:`ep:graph-validation:${token.slice(0,32)}`,partitionId:`graph-validations:${scope}:${token.slice(0,2)}`};
}
export class PersistentGraphValidations {
 #repo;#gm;#scope;#preflight;#dependencies;#writer;
 constructor({repository,gmProvider,scope='main',preflight,dependencies,writer=null}={}){
  if(!repository?.read||!repository?.put||typeof gmProvider!=='function'||!preflight?.inspect||!dependencies?.compare||writer!==null&&typeof writer?.assertEligible!=='function')fail('VALIDATION_CONFIG','Revisioned repository, preflight, dependencies and GM authority are required');
  if(!/^[a-z][a-z0-9-]{0,45}$/.test(scope))fail('VALIDATION_CONFIG','Registry scope must be a stable slug');this.#repo=repository;this.#gm=gmProvider;this.#scope=scope;this.#preflight=preflight;this.#dependencies=dependencies;this.#writer=writer;
 }
 #context(){const gm=this.#gm();assertLocalGM(gm);this.#writer?.assertEligible(gm);return gm;}
 async #read(loc,gm){
  const row=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});
  if(row){
   if(row.id!==loc.id||row.partitionId!==loc.partitionId||row.kind!=='graph-validation'||!row.data||row.data.fingerprint!==contractHash(row.data.evidence))fail('VALIDATION_CORRUPT','Stored validation evidence identity/integrity failed');
   if(this.#repo.hasReadyIndex&&!(await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm})))fail('INDEX_UNCERTAIN','Validation evidence has a pending repository index');
   assertPreflightReport(row.data.evidence.report);
  }
  return row;
 }
 async #store(loc,evidence,expectedRevision,gm){
  const data={evidence,fingerprint:contractHash(evidence)};
  if(new TextEncoder().encode(JSON.stringify(data)).length>57000)fail('VALIDATION_BUDGET','Validation evidence exceeds its bounded native record budget');
  this.#context();await this.#repo.put({...loc,kind:'graph-validation',accessClass:'gm-secret',data},{expectedRevision,gm});
  const saved=await this.#read(loc,this.#context());if(!saved||saved.revision!==(expectedRevision??0)+1||saved.data.fingerprint!==data.fingerprint)fail('VALIDATION_UNCERTAIN','Validation evidence was not durably verified');return saved;
 }
 async validateCandidate(graph,{capabilities=[],expectedValidationRevision=null}={}){
  const gm=this.#context(),loc=graphValidationLocator(graph.id,{scope:this.#scope}),old=await this.#read(loc,gm);
  if((old?.revision??null)!==expectedValidationRevision)fail('REVISION_CONFLICT','Candidate validation changed; refresh its evidence');
  const report=await this.#preflight.inspect(graph,{capabilities});
  // Blocked evidence is durable and reviewable, but never qualifies publication.
  const evidence={graphId:graph.id,candidateRevision:graph.revision,executionFingerprint:executionFingerprint(graph),capabilities:[...capabilities].sort(),report};
  const saved=await this.#store(loc,evidence,expectedValidationRevision,gm);return {revision:saved.revision,report:clone(report)};
 }
 async inspectCandidate(graph,{capabilities=[]}={}){
  const row=await this.#read(graphValidationLocator(graph.id,{scope:this.#scope}),this.#context());
  if(!row)return {status:'unvalidated',revision:null,report:null,changed:['validation:missing']};
  const evidence=row.data.evidence,manifest=evidence.report.dependencyManifest;
  if(!manifest)return {status:'blocked',revision:row.revision,report:clone(evidence.report),changed:['validation:blocked']};
  let comparison;
  try{comparison=await this.#dependencies.compare(manifest,graph,{capabilities});}
  catch(error){return {status:'stale',revision:row.revision,report:clone(evidence.report),changed:[`dependency:${error.code??'CHECK_FAILED'}`],issues:[{severity:'blocker',code:error.code??'DEPENDENCY_CHECK_FAILED',message:error.message,remediation:'Restore the exact immutable dependency and validate the candidate again.'}]};}
  const changed=[...comparison.changed];
  if(contractHash([...capabilities].sort())!==contractHash(evidence.capabilities))changed.push('capabilities:selection');
  // A cosmetic edit may increment the draft revision. The static executable
  // identity and dependencies decide whether its validation remains current.
  return {status:changed.length?'stale':evidence.report.ok?(comparison.issues.some(x=>x.severity==='blocker')?'stale':'current'):'blocked',revision:row.revision,report:clone(evidence.report),changed,issues:comparison.issues};
 }
 async assertCurrent(graph,{capabilities=[],acknowledgeWarnings=false}={}){
  const view=await this.inspectCandidate(graph,{capabilities});
  if(view.status==='blocked')this.#preflight.assertPublishable(view.report,{acknowledgeWarnings});
  if(view.status!=='current')fail('GRAPH_VALIDATION_STALE',`Validate this exact candidate before publication (${view.status}: ${view.changed.join(', ')})`);
  this.#preflight.assertPublishable(view.report,{acknowledgeWarnings});return view.report;
 }
 async publishedManifest(snapshot){
  this.#context();
  if(snapshot.dependencyManifest){assertDependencyManifest(snapshot.dependencyManifest);if(snapshot.dependencyManifest.graphId!==snapshot.id||snapshot.dependencyManifest.executionFingerprint!==executionFingerprint(snapshot))fail('DEPENDENCY_MANIFEST_CORRUPT','Publication dependency manifest identity differs');return clone(snapshot.dependencyManifest);}
  const row=await this.#read(graphValidationLocator(snapshot.id,{scope:this.#scope,publishedVersion:snapshot.publishedVersion}),this.#context());
  if(!row)return null;
  const evidence=row.data.evidence;if(evidence.graphId!==snapshot.id||evidence.publishedVersion!==snapshot.publishedVersion||evidence.executionFingerprint!==executionFingerprint(snapshot)||evidence.adoption?.approved!==true)fail('VALIDATION_CORRUPT','Adopted evidence does not describe the exact immutable publication');
  assertDependencyManifest(evidence.report.dependencyManifest);return clone(evidence.report.dependencyManifest);
 }
 async assertPublishedCurrent(snapshot,{capabilities=[]}={}){
  const manifest=await this.publishedManifest(snapshot);
  if(!manifest)fail('GRAPH_DEPENDENCIES_UNTRACKED','Explicitly validate and adopt this legacy publication before activation or execution');
  const comparison=await this.#dependencies.compare(manifest,snapshot,{capabilities});
  if(!comparison.current)fail('GRAPH_DEPENDENCIES_STALE',`Published dependency contracts changed: ${comparison.changed.join(', ')||comparison.issues.map(x=>x.code).join(', ')}`);
  return manifest;
 }
 async adoptPublished(snapshot,{approved=false,expectedExecutionFingerprint,reason,capabilities=[],acknowledgeWarnings=false}={}){
  const gm=this.#context();if(approved!==true||typeof reason!=='string'||!reason.trim()||reason.length>600||expectedExecutionFingerprint!==executionFingerprint(snapshot))fail('LEGACY_DEPENDENCY_REVIEW_REQUIRED','Explicit GM review, reason and exact execution fingerprint are required to adopt current contracts for a legacy publication');
  if(snapshot.dependencyManifest)fail('PUBLICATION_ALREADY_TRACKED','Tracked immutable publications cannot be reinterpreted through legacy adoption');
  const loc=graphValidationLocator(snapshot.id,{scope:this.#scope,publishedVersion:snapshot.publishedVersion}),old=await this.#read(loc,gm);
  if(old){const manifest=await this.publishedManifest(snapshot),comparison=await this.#dependencies.compare(manifest,snapshot,{capabilities});if(!comparison.current)fail('GRAPH_DEPENDENCIES_STALE','Adopted publication contracts changed; create and publish a migrated draft');return {adopted:true,created:false,manifest};}
  const report=await this.#preflight.inspect(snapshot,{capabilities});this.#preflight.assertPublishable(report,{acknowledgeWarnings});
  const evidence={graphId:snapshot.id,publishedVersion:snapshot.publishedVersion,executionFingerprint:expectedExecutionFingerprint,capabilities:[...capabilities].sort(),report,adoption:{approved:true,approvedBy:gm.userId,reason:reason.trim(),meaning:'Current exact contracts explicitly reviewed; original historical contracts are not inferred.'}};
  await this.#store(loc,evidence,null,gm);return {adopted:true,created:true,manifest:await this.publishedManifest(snapshot)};
 }
}
