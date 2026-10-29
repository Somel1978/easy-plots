/** GM-private authored hypotheses grounded in canonical agenda/knowledge state.
 * Forecasts never run effects or assert that a future outcome has happened.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const digest=value=>sha256Hex(JSON.stringify(value));
const time=t=>Number.isFinite(t)&&t>=0&&t<=1e12;
function input(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['scope','forecastId','agendaId','sourceEventId','knowledgeReceiptIds','worldTime','expiresAt','predictions'].includes(k)))fail('FORECAST_INPUT','A typed forecast contract is required');
 for(const id of [p.forecastId,p.agendaId,p.sourceEventId])assertNarrativeId(id);
 if(!p.forecastId.startsWith('ep:forecast:')||!p.sourceEventId.startsWith('ep:event:')||! /^[a-z][a-z0-9-]{0,47}$/.test(p.scope??''))fail('FORECAST_INPUT','Explicit narrative forecast scope/identity required');
 if(!time(p.worldTime)||!time(p.expiresAt)||p.expiresAt<=p.worldTime)fail('FORECAST_TIME','An authored future validity horizon is required');
 if(!Array.isArray(p.knowledgeReceiptIds)||p.knowledgeReceiptIds.length>24||new Set(p.knowledgeReceiptIds).size!==p.knowledgeReceiptIds.length)fail('FORECAST_BUDGET','Use bounded, unique knowledge receipts');
 p.knowledgeReceiptIds.forEach(assertNarrativeId);
 if(!Array.isArray(p.predictions)||!p.predictions.length||p.predictions.length>24)fail('FORECAST_BUDGET','Use a bounded nonempty set of authored possibilities');
 const ids=new Set();
 for(const x of p.predictions){
  if(!x||Object.keys(x).some(k=>!['ruleId','summary'].includes(k))||typeof x.ruleId!=='string'||ids.has(x.ruleId)||typeof x.summary!=='string'||!x.summary.trim()||x.summary.length>240)fail('FORECAST_INPUT','Each authored outcome requires a unique rule and bounded summary');
  ids.add(x.ruleId);
 }
 return clone(p);
}
export class PersistentNarrativeForecasts {
 #domains;#agendas;
 constructor({domains,factionAgendas}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||typeof factionAgendas?.assess!=='function'||typeof factionAgendas?.read!=='function')fail('FORECAST_DEPENDENCY','Protected canonical and agenda services required');
  this.#domains=domains;this.#agendas=factionAgendas;
 }
 async preview(spec){
  const p=input(spec),agenda=await this.#agendas.read({scope:p.scope,agendaId:p.agendaId});
  if(!agenda||agenda.data.state!=='published')fail('FORECAST_AGENDA','Published canonical agenda required');
  const rules=new Map(agenda.data.rules.map(r=>[r.id,r]));
  for(const prediction of p.predictions)if(!rules.has(prediction.ruleId))fail('FORECAST_RULE','Prediction must refer to a published agenda rule');
  const selected=p.predictions.map(x=>rules.get(x.ruleId)),knownClaims=new Set(selected.flatMap(r=>r.requiredFactionKnowledgeIds??[]));
  const relevantReceipts=[];
  for(const id of p.knowledgeReceiptIds){const row=await this.#domains.read('knowledge-receipt',p.scope,id);if(row&&knownClaims.has(row.data.claimId))relevantReceipts.push(id);}
  const locators=[{type:'faction-agenda',id:p.agendaId},
   ...[...new Set(selected.flatMap(r=>r.requiredCanonicalFactIds??[]))].map(id=>({type:'world-fact',id})),
   ...relevantReceipts.map(id=>({type:'knowledge-receipt',id}))];
  if(locators.length>64)fail('FORECAST_BUDGET','Scoped forecast dependencies exceed the read budget');
  const dependencies=[];
  for(const loc of locators){const row=await this.#domains.read(loc.type,p.scope,loc.id);dependencies.push({...loc,revision:row?.revision??null});}
  const assessment=await this.#agendas.assess({scope:p.scope,agendaId:p.agendaId,knowledgeReceiptIds:p.knowledgeReceiptIds,worldTime:p.worldTime,ruleIds:p.predictions.map(x=>x.ruleId)});
  const eligible=new Map(assessment.proposals.map(x=>[x.ruleId,x]));
  const predictions=p.predictions.filter(x=>eligible.has(x.ruleId)).map(x=>({ruleId:x.ruleId,actionId:eligible.get(x.ruleId).actionId,summary:x.summary,certainty:'authored-hypothesis'}));
  const explanations=p.predictions.map(x=>({ruleId:x.ruleId,assessment:eligible.has(x.ruleId)?'canonical-and-observer-prerequisites-satisfied':'prerequisites-not-established'}));
  const temporalBoundaries=selected.flatMap(r=>[r.notBefore??0,r.expiresAt??1e12]).filter(t=>t>p.worldTime);
  const validUntil=Math.min(p.expiresAt,...temporalBoundaries);
  // Re-read only the captured dependency set. A concurrent canonical change
  // must not be silently stored as a coherent forecast preview.
  for(const d of dependencies){const current=await this.#domains.read(d.type,p.scope,d.id);if((current?.revision??null)!==d.revision)fail('FORECAST_SOURCE_CHANGED','Dependency changed during forecast preparation');}
  const plan={forecastId:p.forecastId,agendaId:p.agendaId,scope:p.scope,sourceEventId:p.sourceEventId,
   preparedAt:p.worldTime,validUntil,dependencies,predictions,explanations,knowledgeScope:'explicit-receipts-only',state:'hypothesis',canonicalCommitted:false,effectsExecuted:0};
  return {...plan,fingerprint:await digest(plan)};
 }
 async create(spec){
  const plan=await this.preview(spec);
  if(await this.#domains.read('narrative-forecast',plan.scope,plan.forecastId))fail('FORECAST_IMMUTABLE','Create a new forecast identity rather than overwrite reviewed history');
  return this.#domains.save({type:'narrative-forecast',scope:plan.scope,id:plan.forecastId,sourceEventId:plan.sourceEventId,data:plan});
 }
 async inspect({scope='world',forecastId,worldTime}={}){
  assertNarrativeId(forecastId);if(!time(worldTime))fail('FORECAST_TIME','Current world time required');
  const row=await this.#domains.read('narrative-forecast',scope,forecastId);if(!row)return null;
  const {fingerprint,...plan}=row.data;
  if(plan.forecastId!==forecastId||plan.scope!==scope||plan.state!=='hypothesis'||!Array.isArray(plan.dependencies)||plan.dependencies.length>64||await digest(plan)!==fingerprint)fail('FORECAST_CORRUPT','Stored forecast identity, bounds or fingerprint are invalid');
  const changed=[];
  for(const d of plan.dependencies){
   if(!['world-fact','knowledge-receipt','faction-agenda'].includes(d.type)||d.revision!==null&&(!Number.isSafeInteger(d.revision)||d.revision<1))fail('FORECAST_CORRUPT','Unsupported forecast dependency');
   const current=await this.#domains.read(d.type,scope,d.id);if((current?.revision??null)!==d.revision)changed.push({type:d.type,id:d.id,expectedRevision:d.revision,currentRevision:current?.revision??null});
  }
  const status=changed.length?'stale':worldTime<plan.preparedAt||worldTime>=plan.validUntil?'expired':'fresh-hypothesis';
  return {forecastId,status,changedDependencies:changed,predictions:status==='fresh-hypothesis'?clone(plan.predictions):[],explanations:clone(plan.explanations),
   knowledgeScope:plan.knowledgeScope,canonicalCommitted:false,effectsExecuted:0,visibility:'gm-only'};
 }
}
