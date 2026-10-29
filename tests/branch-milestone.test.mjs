import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {ActiveTriggerCatalog,IndexedGraphRegistry} from '../src/runtime/active-subscriptions.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {createMilestoneProvider} from '../src/runtime/milestone-provider.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
import {DurableProposalReview} from '../src/runtime/proposal-review.mjs';
import {GraphEditorModel} from '../src/editor/model.mjs';
const port=(id,direction)=>({id,direction,valueType:'event',accessClass:'gm'});
const gid='ep:graph:branch_001';
const ids={trigger:'ep:node:branch_trigger',branch:'ep:node:branch_switch',success:'ep:node:milestone_true',failure:'ep:node:effect_false'};
function branchGraph(){
  const n=(id,typeId,ports,data)=>({id,graphId:gid,typeId,ports:ports.map(x=>port(...x)),accessClass:'gm',data});
  return {id:gid,kind:'graph',schemaVersion:'1.0.0',revision:0,partitionId:'plot-branch',rootNodeId:ids.trigger,requiredCapabilityIds:[],nodes:[
    n(ids.trigger,'core.trigger.event',[['out','output']],{eventType:'evidence.discovered'}),
    n(ids.branch,'core.branch.condition',[['in','input'],['true','output'],['false','output']],{condition:{op:'compare',operator:'eq',left:{type:'reference',path:['event','verified'],requiredPermission:'gm'},right:{type:'literal',value:true}}}),
    n(ids.success,'core.milestone.qualify',[['in','input']],{milestoneId:'ep:milestone:manifest_001'}),
    n(ids.failure,'core.effect.proposal',[['in','input']],{providerId:'narrative.set-state',payload:{key:'unverified',value:true}})
  ],edges:[
    {id:'ep:edge:branch_start',kind:'flow',source:{nodeId:ids.trigger,portId:'out'},target:{nodeId:ids.branch,portId:'in'}},
    {id:'ep:edge:branch_true',kind:'flow',source:{nodeId:ids.branch,portId:'true'},target:{nodeId:ids.success,portId:'in'}},
    {id:'ep:edge:branch_false',kind:'flow',source:{nodeId:ids.branch,portId:'false'},target:{nodeId:ids.failure,portId:'in'}}
  ]};
}
function harness(){
  const repository=new MemoryPartitionRepository(),gm=createLocalGMContext({user:{isGM:true,id:'gm'},epoch:'one'},'world'),gmProvider=()=>gm;
  const graphRegistry=new PersistentGraphRegistry({repository,gmProvider});
  const catalog=new ActiveTriggerCatalog({repository,gmProvider});
  const registry=new IndexedGraphRegistry({registry:graphRegistry,catalog});
  const ledger=new DurableEventLedger({repository,gmProvider});
  const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
  const provider=createMilestoneProvider({repository,gmProvider});const providers=new EffectProviderRegistry();providers.register(provider);
  const journal=new MemoryOperationJournal();
  const review=new DurableProposalReview({repository,ledger,registry,providers,journal,gmProvider});
  return {repository,registry,ledger,router,provider,review,journal};
}
async function activate(s){const draft=await s.registry.saveDraft(branchGraph());await s.registry.publish(gid,{expectedRevision:draft.revision});await s.registry.activate(gid,1,{expectedActivationRevision:null});}
const e=(id,verified)=>({id,eventType:'evidence.discovered',source:{kind:'test-fixture',testId:'milestone'},payload:{verified}});
test('true branch proposes only the verified milestone, not the false effect',async()=>{
  const s=harness();await activate(s);
  const id='ep:event:branch_true_001';const res=await s.router.ingest(e(id,true));
  assert.equal(res.status,'review-required');
  const proposals=(await s.ledger.get(id)).proposals;
  assert.equal(proposals.length,1);assert.equal(proposals[0].providerId,'narrative.qualify-milestone');
  assert.deepEqual(proposals[0].payload,{milestoneId:'ep:milestone:manifest_001'});
});
test('false branch proposes only the other effect',async()=>{
  const s=harness();await activate(s);const id='ep:event:branch_false_001';
  await s.router.ingest(e(id,false));
  assert.equal((await s.ledger.get(id)).proposals[0].providerId,'narrative.set-state');
});
test('milestone qualification is persisted only after GM approves and executes',async()=>{
  const s=harness();await activate(s);const id='ep:event:milestone_test_001';
  await s.router.ingest(e(id,true));const p=(await s.ledger.get(id)).proposals[0];
  assert.equal(await s.provider.get(p.payload),null);
  await s.review.decide(id,p.operationId,{approve:true});
  const res=await s.review.execute(id,p.operationId);
  assert.equal(res.status,'completed');
  const row=await s.provider.get(p.payload);
  assert.equal(row.status,'qualified');assert.equal(row.operationId,p.operationId);assert.equal(row.sourceEventId,id);
});
test('milestone provider does not grant qualification twice for different event operations',async()=>{
  const s=harness();const payload={milestoneId:'ep:milestone:manifest_001'};
  await s.provider.apply(payload,{operationId:'ep:operation:milestone_001',sourceEventId:'ep:event:qualifying_001'});
  await assert.rejects(s.provider.apply(payload,{operationId:'ep:operation:milestone_002',sourceEventId:'ep:event:qualifying_002'}),{code:'MILESTONE_ALREADY_QUALIFIED'});
});
test('editor supports branch edges with explicit true and false output ports',()=>{
  const model=new GraphEditorModel({registry:{}});const g=model.newGraph('Branches');
  const branch=model.addNode('core.branch.condition'),success=model.addNode('core.milestone.qualify'),failure=model.addNode('core.effect.proposal');
  model.connect(g.rootNodeId,branch);
  assert.throws(()=>model.connect(branch,success),{code:'BRANCH_PORT_REQUIRED'});
  model.connect(branch,success,{sourcePortId:'true'});
  model.connect(branch,failure,{sourcePortId:'false'});
  assert.deepEqual(model.preview().warnings,[]);
  assert.equal(model.graph.edges.filter(x=>x.source.nodeId===branch).length,2);
});
