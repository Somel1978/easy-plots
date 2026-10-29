import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentFactionAgenda} from '../src/orchestration/persistent-faction-agenda.mjs';
import {PersistentNarrativeForecasts} from '../src/orchestration/persistent-forecasts.mjs';
const factA='ep:fact:forecast_A001',factB='ep:fact:forecast_B001',claimA='ep:claim:forecast_A001',claimB='ep:claim:forecast_B001';
const receiptA='ep:knowledge-receipt:forecast_A001',receiptB='ep:knowledge-receipt:forecast_B001',agendaId='ep:agenda:forecast001',factionId='ep:faction:forecast001';
async function suite({missingFact=false}={}){
 const repository=new MemoryPartitionRepository(),user={id:'gm_forecast001',isGM:true},ctx=createLocalGMContext({user,epoch:'forecast'},'world'),gmProvider=()=>ctx;
 const domains=new NarrativeDomainStore({repository,gmProvider}),factionAgendas=new PersistentFactionAgenda({domains}),forecasts=new PersistentNarrativeForecasts({domains,factionAgendas});
 const put=(type,id,data,expectedRevision=null)=>domains.save({type,scope:'world',id,data,expectedRevision,sourceEventId:'ep:event:forecast_setup001'});
 if(!missingFact)await put('world-fact',factA,{status:'asserted',value:'A is possible'});
 await put('world-fact',factB,{status:'asserted',value:'B is possible'});
 for(const [id,claimId] of [[receiptA,claimA],[receiptB,claimB]])await put('knowledge-receipt',id,{observerId:factionId,claimId,state:'published',availableAt:0});
 await factionAgendas.publish({agendaId,factionId,sourceEventId:'ep:event:forecast_agenda001',rules:[
  {id:'rule-a',actionId:'act-a',notBefore:0,expiresAt:100,requiredCanonicalFactIds:[factA],requiredFactionKnowledgeIds:[claimA]},
  {id:'rule-b',actionId:'act-b',notBefore:0,expiresAt:100,requiredCanonicalFactIds:[factB],requiredFactionKnowledgeIds:[claimB]}]});
 const spec=(suffix='A001',ruleId='rule-a')=>({scope:'world',forecastId:`ep:forecast:${suffix}`,agendaId,sourceEventId:'ep:event:forecast_author001',worldTime:10,expiresAt:90,
  knowledgeReceiptIds:[receiptA,receiptB],predictions:[{ruleId,summary:'An authored plausible outcome'}]});
 return {repository,user,domains,factionAgendas,forecasts,put,spec};
}
test('ADR-097: forecast hypotheses require both canonical conditions and the faction own knowledge',async()=>{
 const s=await suite(),p=s.spec();
 assert.equal((await s.forecasts.preview({...p,knowledgeReceiptIds:[]})).predictions.length,0);
 const preview=await s.forecasts.preview(p);assert.equal(preview.predictions[0].certainty,'authored-hypothesis');assert.equal(preview.effectsExecuted,0);
 assert.equal(await s.domains.read('narrative-forecast','world',p.forecastId),null,'Preview does not create a record');
 await s.forecasts.create(p);const result=await s.forecasts.inspect({forecastId:p.forecastId,worldTime:20});
 assert.equal(result.status,'fresh-hypothesis');assert.equal(result.predictions.length,1);assert.equal(result.canonicalCommitted,false);assert.equal(result.knowledgeScope,'explicit-receipts-only');
});
test('ADR-098: dependency changes stale only the affected forecast, including different rules in the same agenda',async()=>{
 const s=await suite(),a=s.spec('A001'),b=s.spec('B001','rule-b');await s.forecasts.create(a);await s.forecasts.create(b);
 await s.put('world-fact',factB,{status:'retracted',value:'B changed'},1);
 const reads=[],read=s.repository.read.bind(s.repository);s.repository.read=async(id,options)=>{reads.push(id);return read(id,options);};
 s.repository.query=()=>{throw Error('Forecasts must not enumerate world partitions');};
 assert.equal((await s.forecasts.inspect({forecastId:a.forecastId,worldTime:20})).status,'fresh-hypothesis');
 assert.equal(reads.includes(factB),false);assert.equal(reads.includes(receiptB),false);
 const changed=await s.forecasts.inspect({forecastId:b.forecastId,worldTime:20});assert.equal(changed.status,'stale');assert.deepEqual(changed.predictions,[]);
 assert.equal(changed.changedDependencies[0].id,factB);
});
test('a forecast never treats another observer receipt as faction knowledge',async()=>{
 const s=await suite();await s.put('knowledge-receipt',receiptA,{observerId:'ep:faction:other001',claimId:claimA,state:'published',availableAt:0},1);
 await assert.rejects(s.forecasts.create(s.spec()),{code:'AGENDA_KNOWLEDGE'});assert.equal(await s.domains.read('narrative-forecast','world',s.spec().forecastId),null);
});
test('forecast dependency manifests survive reconstruction and expire at authored temporal boundaries',async()=>{
 const s=await suite(),p=s.spec();await s.forecasts.create(p);const restored=new PersistentNarrativeForecasts(s);
 assert.equal((await restored.inspect({forecastId:p.forecastId,worldTime:20})).status,'fresh-hypothesis');
 assert.equal((await restored.inspect({forecastId:p.forecastId,worldTime:90})).status,'expired');
 await assert.rejects(restored.create(p),{code:'FORECAST_IMMUTABLE'});
});
test('missing canonical facts are captured as absence dependencies and invalidate when created',async()=>{
 const s=await suite({missingFact:true}),p=s.spec();await s.forecasts.create(p);
 assert.deepEqual((await s.forecasts.inspect({forecastId:p.forecastId,worldTime:20})).predictions,[]);
 await s.put('world-fact',factA,{status:'asserted',value:'Now established'});
 assert.equal((await s.forecasts.inspect({forecastId:p.forecastId,worldTime:20})).status,'stale');
});
test('concurrent source changes prevent a false coherent forecast from being persisted',async()=>{
 const s=await suite(),read=s.domains.read.bind(s.domains);let factReads=0;
 s.domains.read=async(type,scope,id)=>{
  const row=await read(type,scope,id);
  if(type==='world-fact'&&id===factA&&++factReads===2)await s.put('world-fact',factA,{status:'retracted',value:'Concurrent correction'},1);
  return row;
 };
 await assert.rejects(s.forecasts.create(s.spec()),{code:'FORECAST_SOURCE_CHANGED'});
 assert.equal(await read('narrative-forecast','world',s.spec().forecastId),null);
});
test('invalid rules, unknown effect fields and unbounded horizons cannot produce forecasts',async()=>{
 const s=await suite(),p=s.spec();
 await assert.rejects(s.forecasts.preview({...p,predictions:[{ruleId:'unknown',summary:'Not authored'}]}),{code:'FORECAST_RULE'});
 await assert.rejects(s.forecasts.preview({...p,executeEffects:true}),{code:'FORECAST_INPUT'});
 await assert.rejects(s.forecasts.preview({...p,expiresAt:9}),{code:'FORECAST_TIME'});
});
test('corrupt persisted forecasts fail integrity validation rather than displaying predictions',async()=>{
 const s=await suite(),p=s.spec();await s.forecasts.create(p);const row=await s.domains.read('narrative-forecast','world',p.forecastId);
 row.data.predictions[0].summary='Altered without a valid fingerprint';await s.repository.put(row,{expectedRevision:row.revision});
 await assert.rejects(s.forecasts.inspect({forecastId:p.forecastId,worldTime:20}),{code:'FORECAST_CORRUPT'});
});
test('forecast records remain GM-private after authority revocation',async()=>{
 const s=await suite(),p=s.spec();await s.forecasts.create(p);s.user.isGM=false;
 await assert.rejects(s.forecasts.inspect({forecastId:p.forecastId,worldTime:20}),{code:'GM_AUTHORITY_REVOKED'});
});
test('cached hypotheses expire when an authored future rule window starts even without record changes',async()=>{
 const s=await suite(),timed='ep:agenda:timed_forecast001';
 await s.factionAgendas.publish({agendaId:timed,factionId,sourceEventId:'ep:event:forecast_timed001',rules:[{id:'wait',actionId:'depart',notBefore:50,expiresAt:100,requiredCanonicalFactIds:[factA],requiredFactionKnowledgeIds:[claimA]}]});
 const p={...s.spec(),agendaId:timed,predictions:[{ruleId:'wait',summary:'Departure may follow when the window opens'}]};
 await s.forecasts.create(p);assert.equal((await s.forecasts.inspect({forecastId:p.forecastId,worldTime:20})).status,'fresh-hypothesis');
 assert.equal((await s.forecasts.inspect({forecastId:p.forecastId,worldTime:50})).status,'expired');
});
