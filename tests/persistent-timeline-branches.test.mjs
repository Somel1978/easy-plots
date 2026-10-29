import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentTimelineBranches} from '../src/orchestration/persistent-timelines.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {createExtendedDomainProviders} from '../src/runtime/extended-providers.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
import {runIsolatedWhatIf} from '../src/domains/simulation.mjs';
const timelineId='ep:timeline:harbor_timeline001',live='ep:branch:live_timeline001',alternate='ep:branch:alternate_timeline001',factId='ep:fact:harbor_timeline001',sourceEventId='ep:event:timeline_setup001';
const refs=(revision=1)=>[{id:factId,key:'harbor',revision}];
async function setup(){
 const repository=new MemoryPartitionRepository(),user={id:'TimelineGM001',isGM:true},gm=createLocalGMContext({user,epoch:'timeline'},'world'),gmProvider=()=>gm;
 const domains=new NarrativeDomainStore({repository,gmProvider}),service=new PersistentTimelineBranches({domains});
 await domains.save({type:'world-fact',scope:'world',id:factId,data:{value:'open',status:'asserted'},sourceEventId});
 const root=await service.create({timelineId,branchId:live,sourceRefs:refs(),sourceEventId});
 return {repository,user,gmProvider,domains,service,root};
}
const fork=(service,expectedRevision=1,other={})=>service.branch({timelineId,branchId:alternate,parentBranchId:live,parentVersion:1,label:'Closed harbor',hypotheses:[{key:'harbor',value:'closed'}],expectedRevision,sourceEventId,...other});
test('ADR-039: alternate timeline versions survive restart with exact parent lineage and zero changes to canonical facts',async()=>{
 const s=await setup(),before=await s.domains.read('world-fact','world',factId),root=await fork(s.service);
 const restarted=new PersistentTimelineBranches({domains:s.domains}),one=await restarted.version({timelineId,branchId:alternate,version:1});
 assert.deepEqual(one.data.parent,{branchId:live,version:1});assert.equal(one.data.preview.hypotheticalFacts.harbor,'closed');assert.equal(one.visibility,'gm-only');
 const next=await fork(restarted,root.revision,{parentBranchId:alternate,parentVersion:1,label:'Reopened harbor',hypotheses:[{key:'harbor',value:'reopened'}]});
 assert.equal(next.data.branches.find(b=>b.branchId===alternate).headVersion,2);assert.equal(next.data.canonical.branchId,live);
 assert.equal((await restarted.version({timelineId,branchId:alternate,version:1})).data.preview.hypotheticalFacts.harbor,'closed');
 assert.deepEqual(await s.domains.read('world-fact','world',factId),before);assert.deepEqual((await restarted.canonical({timelineId})).facts,{harbor:'open'});
 assert.equal(one.data.preview.committed,false);assert.equal(one.data.preview.effectsExecuted,0);
});
test('ADR-039: a hypothetical branch becomes the selected canonical view only after actual approved graph effects establish every outcome',async()=>{
 const s=await setup(),root=await fork(s.service),selection={timelineId,branchId:alternate,version:1,sourceRefs:refs(),expectedRevision:root.revision,reviewEventId:'ep:event:timeline_select001'};
 await assert.rejects(s.service.selectCanonical(selection),{code:'TIMELINE_NOT_CANONICAL'});
 assert.equal((await s.service.read({timelineId})).data.canonical.branchId,live);
 const catalog=new ActiveTriggerCatalog(s),registry=new IndexedGraphRegistry({catalog,registry:new PersistentGraphRegistry(s)}),ledger=new DurableEventLedger(s),router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider:s.gmProvider});
 const providers=new EffectProviderRegistry();for(const p of createExtendedDomainProviders(s))providers.register(p);
 const review=new DurableProposalReview({...s,registry,ledger,providers,journal:new MemoryOperationJournal()}),model=new GraphEditorModel({registry});
 model.newGraph('Actual harbor closure');const node=model.addNode('core.world.fact');model.updateSelected({payloadJSON:JSON.stringify({scope:'world',factId,value:'closed',status:'asserted',expectedRevision:1})});model.connect(model.graph.rootNodeId,node);
 await model.save();const published=await model.publish();await model.activate(published.publishedVersion);
 const eventId='ep:event:timeline_actual_closure001';await router.ingest({id:eventId,eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{}});
 const proposal=(await ledger.get(eventId)).proposals.find(p=>p.nodeId===node);
 assert.equal((await s.domains.read('world-fact','world',factId)).data.value,'open');
 await review.decide(eventId,proposal.operationId,{approve:true});assert.equal((await review.execute(eventId,proposal.operationId)).status,'completed');
 const actual=await s.domains.read('world-fact','world',factId);assert.equal(actual.revision,2);assert.equal(actual.effectReceipt.operationId,proposal.operationId);
 ledger.accept=async()=>{throw Error('Canonical selection must not create an event');};
 const selected=await s.service.selectCanonical({...selection,sourceRefs:refs(2)});assert.deepEqual(selected.data.canonical.sourceRefs.map(r=>r.revision),[2]);assert.equal(selected.data.canonical.branchId,alternate);
 assert.equal((await s.service.canonical({timelineId})).status,'current-canonical-sources');assert.equal((await s.service.version({timelineId,branchId:live,version:1})).data.preview.hypotheticalFacts.harbor,'open');
 assert.deepEqual(await s.domains.read('world-fact','world',factId),actual);assert.equal(await ledger.get(selection.reviewEventId),null);
});
test('timeline selection cannot substitute another canonical fact, ignore extra hypothetical outcomes, or adopt a stale revision',async()=>{
 const s=await setup(),root=await fork(s.service),other='ep:fact:substitute_timeline001';await s.domains.save({type:'world-fact',scope:'world',id:other,data:{value:'closed',status:'asserted'},sourceEventId});
 await assert.rejects(s.service.selectCanonical({timelineId,branchId:alternate,version:1,sourceRefs:[{id:other,key:'harbor',revision:1}],expectedRevision:root.revision,reviewEventId:sourceEventId}),{code:'TIMELINE_SOURCE_IDENTITY'});
 await s.domains.save({type:'world-fact',scope:'world',id:factId,data:{value:'closed',status:'asserted'},expectedRevision:1,sourceEventId});
 await assert.rejects(s.service.selectCanonical({timelineId,branchId:alternate,version:1,sourceRefs:refs(),expectedRevision:root.revision,reviewEventId:sourceEventId}),{code:'TIMELINE_SOURCE_STALE'});
 const status=await s.service.canonical({timelineId});assert.equal(status.status,'canonical-sources-changed');assert.equal(status.facts,null);
 const forked=await fork(s.service,root.revision,{branchId:'ep:branch:historic_timeline001'});assert.equal(forked.data.branches.length,3,'Forking uses retained historical facts, without rebasing');
});
test('derived outcomes need their own canonical sources and budget-exhausted alternatives remain hypothetical',async()=>{
 const s=await setup(),root=await fork(s.service,1,{hypotheses:[],rules:[{id:'derive',key:'harbor',equals:'open',outputKey:'warehouse',value:'safe'}]});
 const args={timelineId,branchId:alternate,version:1,sourceRefs:refs(),expectedRevision:root.revision,reviewEventId:sourceEventId};
 await assert.rejects(s.service.selectCanonical(args),{code:'TIMELINE_NOT_CANONICAL'});
 const derivedId='ep:fact:derived_timeline001';await s.domains.save({type:'world-fact',scope:'world',id:derivedId,data:{status:'asserted',value:'safe'},sourceEventId});
 const selected=await s.service.selectCanonical({...args,sourceRefs:[...refs(),{id:derivedId,key:'warehouse',revision:1}]});assert.equal(selected.data.canonical.sourceRefs.length,2);
 const t=await setup(),exhausted=await fork(t.service,1,{hypotheses:[],maxPasses:2,rules:[{id:'close',key:'harbor',equals:'open',outputKey:'harbor',value:'closed'},{id:'open',key:'harbor',equals:'closed',outputKey:'harbor',value:'open'}]});
 await assert.rejects(t.service.selectCanonical({...args,expectedRevision:exhausted.revision}),{code:'TIMELINE_CONVERGENCE'});assert.equal((await t.service.canonical({timelineId})).branchId,live);
});
test('immutable branch persistence recovers a failed root update with the original request and refuses reinterpretation',async()=>{
 const s=await setup(),save=s.domains.save.bind(s.domains);let stop=true;
 s.domains.save=async spec=>{if(stop&&spec.id===timelineId){stop=false;throw Error('root acknowledgement failure');}return save(spec);};
 await assert.rejects(fork(s.service),/root acknowledgement/);assert.equal((await s.service.read({timelineId})).data.branches.length,1);
 await assert.rejects(fork(s.service,1,{hypotheses:[{key:'harbor',value:'other'}]}),{code:'TIMELINE_VERSION_CONFLICT'});
 const recovered=await fork(s.service);assert.equal(recovered.data.branches.length,2);assert.equal((await s.service.version({timelineId,branchId:alternate,version:1})).revision,1);
});
test('timeline bounds reject excessive fork depth, branches, versions and unsafe simulation rules',async()=>{
 const s=await setup();let root=s.root,parent=live;
 for(let i=1;i<=8;i++){const child=`ep:branch:bounded_depth_${i}`;root=await fork(s.service,root.revision,{branchId:child,parentBranchId:parent,parentVersion:1});parent=child;}
 await assert.rejects(fork(s.service,root.revision,{branchId:'ep:branch:bounded_depth_nine',parentBranchId:parent,parentVersion:1}),{code:'TIMELINE_BUDGET'});
 for(let i=9;i<=11;i++)root=await fork(s.service,root.revision,{branchId:`ep:branch:bounded_width_${i}`});
 await assert.rejects(fork(s.service,root.revision),{code:'TIMELINE_BUDGET'});
 const t=await setup();root=await fork(t.service);
 for(let i=2;i<=32;i++)root=await fork(t.service,root.revision,{parentBranchId:alternate,parentVersion:i-1});
 await assert.rejects(fork(t.service,root.revision,{parentBranchId:alternate,parentVersion:32}),{code:'TIMELINE_BUDGET'});
 assert.throws(()=>runIsolatedWhatIf({initialFacts:{x:'yes'},rules:[{id:'bad',key:'x',equals:'yes',outputKey:'__proto__',value:{polluted:true}}]}),{code:'SIMULATION_RULE'});
 assert.throws(()=>runIsolatedWhatIf({maxRules:1000}),{code:'SIMULATION_BUDGET'});assert.equal(({}).polluted,undefined);
});
test('timeline reads fail closed on unknown indexes and GM revocation',async()=>{
 const s=await setup();s.repository.hasReadyIndex=async()=>false;await assert.rejects(s.service.canonical({timelineId}),{code:'INDEX_UNCERTAIN'});
 s.user.isGM=false;await assert.rejects(s.service.read({timelineId}),{code:'GM_AUTHORITY_REVOKED'});
});
