import test from 'node:test';import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {PersistentInvestigationMilestones} from '../src/orchestration/persistent-investigation-milestones.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const id=x=>`ep:${x}`;const investigator=id('actor:hero001'),stranger=id('actor:stranger001');
const investigationId=id('investigation:harbor001'),objectiveId=id('objective:manifest001');
const evidenceId=id('evidence:manifest001'),milestoneId=id('milestone:manifest001');
const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'local'},'world');
async function setup(kind='discovery'){
 const d=new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider});
 await d.save({type:'investigation',scope:'world',id:investigationId,sourceEventId:id('event:setup001'),
  data:{title:'Manifest Mystery',canonicalTruth:'SECRET-VIPER',evidence:[{id:evidenceId,disclosedTo:[investigator]}],theories:[]}});
 const service=new PersistentInvestigationMilestones({domains:d});
 await service.createContract({milestoneId,investigationId,objectiveId,kind,requiredEvidenceIds:[evidenceId],
  verificationEventId:kind==='verified-conclusion'?id('event:verify001'):null,
  publicId:id('public:manifest001'),publicTitle:'Recovered the manifest',allowedObserverIds:[investigator],sourceEventId:id('event:publish001')});
 return {d,service};
}
const contribution={milestoneId,actorId:investigator,evidenceId,sourceEventId:id('event:discover001'),expectedRevision:null};
test('eligible evidence requires canonical knowledge, then separate GM completion',async()=>{
 const {service}=await setup();assert.equal((await service.assess({milestoneId})).status,'prerequisites-not-established');
 const r=await service.recordEvidence(contribution);assert.equal(r.revision,1);
 const a=await service.assess({milestoneId});assert.equal(a.status,'eligible-for-gm-review');assert.equal(a.completed,false);
 const completed=await service.complete({milestoneId,reviewEventId:id('event:approve001'),expectedContractRevision:1,expectedProgressRevision:1});
 assert.equal(completed.effectsExecuted,0);
 assert.equal((await service.assess({milestoneId})).status,'already-completed');
 await assert.rejects(service.complete({milestoneId,reviewEventId:id('event:approve002'),expectedContractRevision:1,expectedProgressRevision:1}),{code:'MILESTONE_COMPLETED'});
 const view=await service.project({milestoneIds:[milestoneId],observerId:investigator});
 assert.equal(view.milestones[0].state,'completed');assert.equal(JSON.stringify(view).includes('SECRET-VIPER'),false);
 assert.deepEqual(await service.project({milestoneIds:[milestoneId],observerId:stranger}),{milestones:[]});
});
test('unknown evidence and guessed identity do not qualify a milestone',async()=>{
 const {service}=await setup();
 await assert.rejects(service.recordEvidence({...contribution,actorId:stranger}),{code:'MILESTONE_EVIDENCE'});
 await assert.rejects(service.recordEvidence({...contribution,evidenceId:id('evidence:guess001')}),{code:'MILESTONE_EVIDENCE'});
 await assert.rejects(service.complete({milestoneId,reviewEventId:id('event:approve001'),expectedContractRevision:1,expectedProgressRevision:null}),{code:'MILESTONE_NOT_ELIGIBLE'});
});
test('duplicate evidence event is idempotent and conflicting reused identity rejected',async()=>{
 const {service}=await setup();const first=await service.recordEvidence(contribution);
 const same=await service.recordEvidence(contribution);assert.equal(same.revision,first.revision);
 await assert.rejects(service.recordEvidence({...contribution,verificationAuthorized:true}),{code:'MILESTONE_EVENT_CONFLICT'});
});
test('verified conclusion requires independent verification event, not just evidence',async()=>{
 const {service}=await setup('verified-conclusion');
 await service.recordEvidence(contribution);
 assert.equal((await service.assess({milestoneId})).status,'prerequisites-not-established');
 await service.recordEvidence({...contribution,sourceEventId:id('event:verify001'),verificationAuthorized:true,expectedRevision:1});
 assert.equal((await service.assess({milestoneId})).status,'eligible-for-gm-review');
});
test('stale progress revision cannot complete an otherwise eligible milestone',async()=>{
 const {service}=await setup();await service.recordEvidence(contribution);
 await assert.rejects(service.complete({milestoneId,reviewEventId:id('event:approve001'),expectedContractRevision:1,expectedProgressRevision:null}),{code:'REVISION_CONFLICT'});
});
