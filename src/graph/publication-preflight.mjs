/** GM-only, severity-aware publication evidence; no effect is applied here. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {clone} from '../contracts/record.mjs';
import {validateGraph} from './validate.mjs';
import {effectProviderId} from './graph-dependencies.mjs';
import {contractHash} from './dependency-contracts.mjs';
const requiredNativeSources=new Set(['narrative.execute-ordered-native-batch','narrative.activate-resource-manifest']);
const protectedAccess=value=>value==='gm'||value==='gm-secret';
const issue=(severity,code,message,remediation,extra={})=>({severity,code,message,remediation,...extra});
export class PublicationPreflight {
 #dependencies;#validate;#external;
 constructor({dependencies,validateSupported=validateGraph,externalChecks=null}={}){
  if(typeof dependencies?.capture!=='function'||typeof validateSupported!=='function'||externalChecks!==null&&typeof externalChecks!=='function')throw new EasyPlotsError('PREFLIGHT_CONFIG','Dependency resolver and structural validator are required');
  this.#dependencies=dependencies;this.#validate=validateSupported;this.#external=externalChecks;
 }
 async inspect(graph,{capabilities=[]}={}){
  const issues=[],checks=[],nodeCount=graph?.nodes?.length??0,edgeCount=graph?.edges?.length??0;
  const check=(id,total,blocked=0,extra={})=>checks.push({id,status:blocked?'blocked':total?'passed':'not-applicable',checked:total,total,...extra});
  let structure;
  try{structure=await this.#validate(graph,{capabilities,requiredCapabilities:capabilities});for(const warning of structure?.warnings??[])issues.push(issue('warning',warning.code,'Node is outside the reachable narrative flow','Connect, remove or explicitly retain this unreachable node.',warning));check('structure',1);}
  catch(error){issues.push(issue('blocker',error.code??'STRUCTURE_INVALID',error.message,'Correct the graph contract and validate this candidate again.'));check('structure',1,1);}
  let captured=null;
  try{captured=await this.#dependencies.capture(graph,{capabilities});issues.push(...captured.issues);check('node-contracts',captured.manifest.dependencies.filter(d=>d.kind==='node').length,captured.issues.filter(x=>x.dependencyKind==='node'||x.code==='NODE_CONTRACT_VERSION').length);check('child-contracts',captured.manifest.dependencies.filter(d=>d.kind==='graph').length,captured.issues.filter(x=>/SUBGRAPH|INTERFACE|OPERATION_SOURCE/.test(x.code)).length);}
  catch(error){issues.push(issue('blocker',error.code??'DEPENDENCY_CHECK_FAILED',error.message,'Restore the bounded immutable dependency graph and validate again.'));check('node-contracts',nodeCount,1);check('child-contracts',1,1);}
  let checkedProviders=0,providerBlockers=0,disclosureBlockers=0,nativeSources=0;
  const nodes=Array.isArray(graph?.nodes)?graph.nodes:[],byId=new Map(nodes.map(node=>[node.id,node]));
  for(const node of nodes){
   const providerId=effectProviderId(node);
   if(providerId){
    checkedProviders++;const provider=this.#dependencies.providers()?.get?.(providerId);
    if(!provider){providerBlockers++;issues.push(issue('blocker','EFFECT_PROVIDER_UNAVAILABLE',`Required effect provider ${providerId} is unavailable`,'Install and validate the exact provider before publication.',{nodeId:node.id,providerId}));}
    else try{await provider.validate(node.typeId==='core.milestone.qualify'?{milestoneId:node.data?.milestoneId}:clone(node.data?.payload??{}));}catch(error){providerBlockers++;issues.push(issue('blocker',error.code??'EFFECT_PAYLOAD_INVALID',error.message,'Correct this provider payload; publication cannot bypass its validation.',{nodeId:node.id,providerId}));}
    if(requiredNativeSources.has(providerId))nativeSources++;
   }
   // Graph execution definitions carry predicates, provider payloads, event
   // routes and source metadata. Player content uses separate allowlists.
   if(!protectedAccess(node.accessClass)||node.ports?.some(p=>!protectedAccess(p.accessClass))){disclosureBlockers++;issues.push(issue('blocker','PRIVATE_EXECUTION_VISIBLE','Execution nodes and ports must remain accessible only to GMs','Protect the execution definition and publish player content through an approved projection provider.',{nodeId:node.id}));}
   if(!node.typeId?.startsWith('core.'))try{this.#dependencies.extensions()?.validateNode?.(node);}catch(error){issues.push(issue('blocker',error.code??'NODE_CONTRACT_INVALID',error.message,'Restore the exact node extension and validate its authored data.',{nodeId:node.id}));}
  }
  for(const edge of Array.isArray(graph?.edges)?graph.edges:[]){
   const from=byId.get(edge.source?.nodeId),to=byId.get(edge.target?.nodeId),output=from?.ports?.find(p=>p.id===edge.source.portId),input=to?.ports?.find(p=>p.id===edge.target.portId);
   if(from&&to&&protectedAccess(from.accessClass)&&(!protectedAccess(to.accessClass)||output&&protectedAccess(output.accessClass)&&input&&!protectedAccess(input.accessClass))){disclosureBlockers++;issues.push(issue('blocker','SECRET_DISCLOSURE_PATH','A protected narrative dependency reaches a less protected execution input','Keep this route GM-only and publish an explicitly approved, allowlisted player projection.',{edgeId:edge.id,nodeId:to.id}));}
  }
  check('effect-providers',checkedProviders,providerBlockers);check('disclosure-paths',nodeCount+edgeCount,disclosureBlockers);
  if(this.#external){
   try{const external=await this.#external({graph,manifest:captured?.manifest??null,capabilities});
    if(!external||!Array.isArray(external.issues)||!Array.isArray(external.coverage))throw new EasyPlotsError('PREFLIGHT_EXTERNAL_CONTRACT','External checks must return issues and coverage arrays');
    for(const row of external.issues){if(!['blocker','warning'].includes(row.severity)||typeof row.code!=='string'||typeof row.message!=='string'||typeof row.remediation!=='string')throw new EasyPlotsError('PREFLIGHT_EXTERNAL_CONTRACT','External issues require severity, code, message and remediation');issues.push(clone(row));}
    for(const row of external.coverage){if(typeof row.id!=='string'||!['passed','blocked','not-applicable','unavailable'].includes(row.status)||!Number.isSafeInteger(row.total)||!Number.isSafeInteger(row.checked)||row.total<0||row.checked<0||row.checked>row.total)throw new EasyPlotsError('PREFLIGHT_EXTERNAL_CONTRACT','External coverage must contain bounded checked/total counts');checks.push(clone(row));}
    if(nativeSources&&!external.coverage.some(row=>row.id==='native-source-contracts'&&row.status==='passed'&&row.checked===nativeSources&&row.total===nativeSources))throw new EasyPlotsError('PREFLIGHT_SOURCE_COVERAGE','Every native batch/manifest source must be checked in this candidate');
   }catch(error){issues.push(issue('blocker',error.code??'PREFLIGHT_EXTERNAL_FAILED',error.message,'Restore the required source checks before publication.'));check('native-source-contracts',Math.max(nativeSources,1),1);}
  }else if(nativeSources){issues.push(issue('blocker','NATIVE_SOURCE_PREFLIGHT_UNAVAILABLE','Native batch or manifest source validation is unavailable','Configure the exact immutable plan/manifest checks before publication.'));checks.push({id:'native-source-contracts',status:'unavailable',checked:0,total:nativeSources});}
  const blockers=issues.filter(x=>x.severity==='blocker'),warnings=issues.filter(x=>x.severity==='warning'),coverage={complete:checks.every(x=>['passed','not-applicable'].includes(x.status)&&x.checked===x.total),checks,excluded:['native-world-execution','event-state-and-roll-freshness','player-recipient-authorization-at-effect-time']};
  const report={kind:'graph-publication-preflight',schemaVersion:'1.0.0',graphId:graph?.id??null,candidateRevision:graph?.revision??null,ok:blockers.length===0&&coverage.complete,blockers,warnings,coverage,nodeCount,edgeCount,dependencyManifest:captured?.manifest??null};
  return {...report,fingerprint:contractHash(report)};
 }
 assertPublishable(report,{acknowledgeWarnings=false}={}){
  assertPreflightReport(report);
  if(!report.ok||report.blockers.length||!report.coverage.complete)throw new EasyPlotsError('PUBLICATION_BLOCKED',`Publication blocked: ${report.blockers.map(x=>x.code).join(', ')||'incomplete coverage'}`,{report:clone(report)});
  if(report.warnings.length&&acknowledgeWarnings!==true)throw new EasyPlotsError('PREFLIGHT_REVIEW_REQUIRED','Review and explicitly acknowledge the preflight warnings',{report:clone(report)});
  return report;
 }
}
export function assertPreflightReport(report){
 if(!report||report.kind!=='graph-publication-preflight'||report.schemaVersion!=='1.0.0'||!Array.isArray(report.blockers)||!Array.isArray(report.warnings)||!report.coverage||!Array.isArray(report.coverage.checks))throw new EasyPlotsError('PREFLIGHT_REPORT_CORRUPT','Invalid publication preflight report');
 const {fingerprint,...body}=report;if(fingerprint!==contractHash(body))throw new EasyPlotsError('PREFLIGHT_REPORT_CORRUPT','Publication preflight report fingerprint differs');
 return report;
}
