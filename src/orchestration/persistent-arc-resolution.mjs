/** GM-authoritative arc resolution. The staged resolution is NOT a world effect.
 * Only an explicitly approved eligible ending is recorded, never inferred from
 * a player's guess. Writes span separate Foundry documents and can be uncertain.
 * Reconciliation never silently repeats effects or activates dormant hooks.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {planCampaignClosure,prepareClosureDecision} from './campaign-closure.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const SCOPE=/^[a-z][a-z0-9-]{0,47}$/;
const validScope=scope=>{if(typeof scope!=='string'||!SCOPE.test(scope))fail('ARC_SCOPE','Explicit bounded scope required');return scope;};
export class PersistentArcResolutions {
 #domains;
 constructor({domains}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function')fail('ARC_STORE','Protected domain store required');
  this.#domains=domains;
 }
 async readArc({scope='world',arcId}={}){validScope(scope);assertNarrativeId(arcId);return this.#domains.read('arc',scope,arcId);}
 async inspect({scope='world',arcId,resolutionId}={}){
  validScope(scope);assertNarrativeId(arcId);assertNarrativeId(resolutionId);
  const [arc,resolution]=await Promise.all([
   this.#domains.read('arc',scope,arcId),this.#domains.read('arc-resolution',scope,resolutionId)
  ]);
  if(resolution&&resolution.data?.arcId!==arcId)fail('ARC_RESOLUTION_MISMATCH','Resolution belongs to a different arc');
  const state=resolution?.data?.state??'not-started';
  const arcPointsToThis=arc?.data?.resolutionId===resolutionId&&arc?.data?.status==='concluded';
  return clone({arcId,resolutionId,arcRevision:arc?.revision??null,resolutionRevision:resolution?.revision??null,
   state,arcPointsToThis,requiresGMReconciliation:state==='prepared'||(state==='committed'&&!arcPointsToThis),
   safeToRetryAsNew:false});
 }
 async plan({scope='world',arcId,max=64}={}){
  const arc=await this.readArc({scope,arcId});if(!arc)fail('ARC_MISSING','Canonical arc required');
  if(arc.data?.status==='concluded')fail('ARC_ALREADY_CONCLUDED','Concluded arc requires explicit reopening');
  const d=arc.data;
  return planCampaignClosure({arcId,arcRevision:arc.revision,endingContracts:d.endingContracts,
   worldFacets:d.worldFacets,objectives:d.objectives,unresolvedThreads:d.unresolvedThreads,
   worldTime:d.worldTime,max});
 }
 async finalize({scope='world',arcId,resolutionId,endingId,approvalEventId,expectedArcRevision}={}){
  validScope(scope);for(const id of [arcId,resolutionId,endingId,approvalEventId])assertNarrativeId(id);
  if(!Number.isSafeInteger(expectedArcRevision)||expectedArcRevision<1)fail('ARC_REVISION','Expected arc revision required');
  const existing=await this.#domains.read('arc-resolution',scope,resolutionId);
  if(existing)fail('ARC_RESOLUTION_EXISTS','Resolution already staged; inspect and reconcile instead of replaying');
  const arc=await this.readArc({scope,arcId});if(!arc||arc.revision!==expectedArcRevision)fail('REVISION_CONFLICT','Arc has changed');
  const plan=await this.plan({scope,arcId});
  const decision=prepareClosureDecision(plan,{endingId,gmApprovalId:approvalEventId,currentArcRevision:expectedArcRevision});
  const source={arcId,resolutionId,endingId,approvalEventId,sourceRevision:expectedArcRevision,
   snapshot:clone(decision.resolutionSnapshot),unresolvedThreadIds:clone(decision.unresolvedThreadIds)};
  // Stage first; if this fails no arc state is changed. This record is not
  // permission to auto-run any effects, or to reveal GM-only narrative truth.
  let resolution=await this.#domains.save({type:'arc-resolution',scope,id:resolutionId,
   sourceEventId:approvalEventId,data:{...source,state:'prepared',effectsExecuted:0,epiloguePublished:false}});
  let savedArc;
  try{
   savedArc=await this.#domains.save({type:'arc',scope,id:arcId,expectedRevision:expectedArcRevision,
    sourceEventId:approvalEventId,data:{...clone(arc.data),status:'concluded',resolutionId,
     resolutionRevision:resolution.revision}});
  }catch(error){fail('ARC_COMMIT_UNCERTAIN',`Resolution staged, arc not verified: ${error.code??error.message}`);}
  try{
   resolution=await this.#domains.save({type:'arc-resolution',scope,id:resolutionId,
    expectedRevision:resolution.revision,sourceEventId:approvalEventId,
    data:{...source,state:'committed',committedArcRevision:savedArc.revision,
     effectsExecuted:0,epiloguePublished:false}});
  }catch(error){fail('ARC_COMMIT_UNCERTAIN',`Arc concluded; resolution verification requires GM review: ${error.code??error.message}`);}
  return clone({resolutionId,arcId,state:resolution.data.state,arcRevision:savedArc.revision,
   resolutionRevision:resolution.revision,unresolvedThreadIds:source.unresolvedThreadIds,
   effectsExecuted:0,epiloguePublished:false});
 }
 /** Explicit GM recovery ONLY after checking the current canonical arc. */
 async reconcile({scope='world',arcId,resolutionId,reviewEventId,expectedResolutionRevision}={}){
  validScope(scope);for(const id of [arcId,resolutionId,reviewEventId])assertNarrativeId(id);
  const [arc,resolution]=await Promise.all([
   this.#domains.read('arc',scope,arcId),this.#domains.read('arc-resolution',scope,resolutionId)
  ]);
  if(!resolution||resolution.data.arcId!==arcId)fail('ARC_RESOLUTION_MISSING','Resolution not staged for this arc');
  if(resolution.revision!==expectedResolutionRevision)fail('REVISION_CONFLICT','Resolution changed');
  if(resolution.data.state!=='prepared')fail('ARC_RECONCILIATION_STATE','Only prepared resolution requires reconciliation');
  if(!arc||arc.data.status!=='concluded'||arc.data.resolutionId!==resolutionId)
   fail('ARC_RECOVERY_REVIEW','The canonical arc does not confirm this resolution; no implicit replay');
  const saved=await this.#domains.save({type:'arc-resolution',scope,id:resolutionId,
   expectedRevision:resolution.revision,sourceEventId:reviewEventId,
   data:{...clone(resolution.data),state:'committed',committedArcRevision:arc.revision,
    reconciliationEventId:reviewEventId}});
  return {arcId,resolutionId,state:'committed',resolutionRevision:saved.revision,
   effectsExecuted:0,epiloguePublished:false};
 }
}
