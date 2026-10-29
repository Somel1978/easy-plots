/** Bounded GM-only investigation coverage and opportunity viability analyzer.
 * Never infers truth from a player's guessed answer or implies all paths have
 * been found when only a partial dependency partition was inspected.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
function ids(list,max=64){if(!Array.isArray(list)||list.length>max)fail('VIABILITY_BUDGET','Bounded IDs required');list.forEach(assertNarrativeId);if(new Set(list).size!==list.length)fail('VIABILITY_DUPLICATE','Duplicate stable IDs');return list;}
export function analyzeInvestigationViability({investigationId,objectives=[],opportunities=[],verifiedEvidenceIds=[],coverage='partial',maxObjectives=48,maxOpportunities=96}={}){
 assertNarrativeId(investigationId);ids(verifiedEvidenceIds);
 if(!['complete','partial','unknown'].includes(coverage))fail('VIABILITY_COVERAGE','Explicit scope coverage required');
 if(!Array.isArray(objectives)||objectives.length>maxObjectives||!Array.isArray(opportunities)||opportunities.length>maxOpportunities)fail('VIABILITY_BUDGET','Scoped investigation exceeded inspection budget');
 const evidence=new Set(verifiedEvidenceIds),opportunityByEvidence=new Map(),seen=new Set();
 for(const op of opportunities){
   assertNarrativeId(op.id);assertNarrativeId(op.evidenceId);
   if(seen.has(op.id))fail('VIABILITY_DUPLICATE','Duplicate opportunity');seen.add(op.id);
   if(!['available','blocked','expired','unknown'].includes(op.status))fail('VIABILITY_OPPORTUNITY','Opportunity status required');
   const byEvidence=opportunityByEvidence.get(op.evidenceId)??[];
   byEvidence.push(op);opportunityByEvidence.set(op.evidenceId,byEvidence);
 }
 seen.clear();const results=[];
 for(const objective of objectives){
   assertNarrativeId(objective.id);
   if(seen.has(objective.id))fail('VIABILITY_DUPLICATE','Duplicate investigation objective');seen.add(objective.id);
   const required=ids(objective.requiredEvidenceIds??[]);
   if(!required.length)fail('VIABILITY_OBJECTIVE','Objectives require explicit author-defined evidence constraints');
   const present=required.filter(id=>evidence.has(id));
   const outstanding=required.filter(id=>!evidence.has(id));
   const possible=outstanding.filter(id=>(opportunityByEvidence.get(id)??[]).some(op=>op.status==='available'));
   const ambiguous=outstanding.filter(id=>(opportunityByEvidence.get(id)??[]).some(op=>op.status==='unknown'));
   const missing=outstanding.filter(id=>!possible.includes(id)&&!ambiguous.includes(id));
   const classification=outstanding.length===0?'evidence-satisfied':
     missing.length===0&&ambiguous.length===0?'viable-on-known-routes':
     coverage!=='complete'||ambiguous.length?'undetermined':
     objective.allowFailure===true?'legitimate-failure-route':'no-known-discovery-route';
   results.push({objectiveId:objective.id,classification,verifiedEvidenceCount:present.length,
     remainingEvidenceCount:outstanding.length,availableOpportunityCount:possible.length,
     uncertainOpportunityCount:ambiguous.length,requiresGMReview:classification!=='evidence-satisfied',
     completionAwarded:false});
 }
 return clone({investigationId,coverage,results,canonicalTruthDisclosed:false,scopeComplete:coverage==='complete',
   automaticCompletion:false,authoritativeEffects:0});
}
