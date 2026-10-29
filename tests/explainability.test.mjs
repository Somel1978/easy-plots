import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {DurableEventLedger} from '../src/runtime/event-ledger.mjs';
import {explainNarrativeEvent} from '../src/runtime/explainability.mjs';
import {PersistentGraphRegistry} from '../src/graph/persistent-registry.mjs';
import {IndexedGraphRegistry,ActiveTriggerCatalog} from '../src/runtime/active-subscriptions.mjs';
import {DurableReactiveRouter} from '../src/runtime/durable-router.mjs';
import {graph,event,session,gid,condition} from './fixtures.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
const gmProvider=()=>createLocalGMContext(session(),'test-world');
async function setup(){
 const repository=new MemoryPartitionRepository();
 const base=new PersistentGraphRegistry({repository,gmProvider});
 const catalog=new ActiveTriggerCatalog({repository,gmProvider});
 const registry=new IndexedGraphRegistry({registry:base,catalog});
 const ledger=new DurableEventLedger({repository,gmProvider});
 const router=new DurableReactiveRouter({registry,catalog,ledger,gmProvider});
 const g=graph();await registry.saveDraft(g);await registry.publish(g.id,{expectedRevision:1});await registry.activate(g.id,1,{expectedActivationRevision:null});
 return {router,ledger};
}
function safe(e){return {...e,source:{kind:'test-fixture'},payload:{...e.payload,secret:'DO_NOT_DISCLOSE'}};}
test('durable graph evaluation retains bounded causal trace without event payload',async()=>{
 const {router,ledger}=await setup();const ev=safe(event('ep:event:explain_pass_001',true));
 assert.equal((await router.ingest(ev)).status,'review-required');
 const stored=await ledger.get(ev.id);assert.equal(stored.evaluations.length,1);
 assert.equal(stored.evaluations[0].trace.length,3);
 const explanation=await explainNarrativeEvent({eventId:ev.id,graphId:gid,ledger,gmProvider});
 assert.equal(explanation.status,'observed');assert.equal(explanation.proposalCount,1);
 assert.equal(explanation.trace[1].nodeId,condition);
 assert.equal(JSON.stringify(explanation).includes('DO_NOT_DISCLOSE'),false);
});
test('condition-blocked trace explains why an effect was not reached',async()=>{
 const {router,ledger}=await setup();const ev=safe(event('ep:event:explain_fail_001',false));
 assert.equal((await router.ingest(ev)).status,'evaluated');
 const explanation=await explainNarrativeEvent({eventId:ev.id,graphId:gid,ledger,gmProvider});
 assert.equal(explanation.blockedCount,1);
 assert.equal(explanation.trace.find(x=>x.nodeId===condition).status,'condition-blocked');
 assert.equal(explanation.proposalCount,0);
});
test('no matching evaluation is not falsely diagnosed as a failed branch',async()=>{
 const {router,ledger}=await setup();const ev=safe(event('ep:event:explain_scope_001',true));await router.ingest(ev);
 const explanation=await explainNarrativeEvent({eventId:ev.id,graphId:'ep:graph:other_001',ledger,gmProvider});
 assert.equal(explanation.status,'not-observed');assert.equal(explanation.trace.length,0);
});
test('GM authority and corrupt traces fail closed',async()=>{
 const ledger={get:async()=>({state:'evaluated',evaluations:[{graphId:gid,trace:[{graphId:gid,nodeId:condition,status:'secret-leak'}]}],proposals:[]})};
 await assert.rejects(explainNarrativeEvent({eventId:'ep:event:explain_bad_001',graphId:gid,ledger,gmProvider}),{code:'EXPLAIN_CORRUPT'});
 await assert.rejects(explainNarrativeEvent({eventId:'ep:event:explain_bad_001',graphId:gid,ledger,gmProvider:()=>({userId:'P',isGM:false})}));
});
