import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryPartitionRepository} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {GMInvestigationWorkbench} from '../src/orchestration/investigation-workbench.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {validatePlayerBoardProjection} from '../src/domains/investigation-board.mjs';
const id=x=>`ep:${x}`;
const investigationId=id('investigation:case_001');
const clue=id('evidence:manifest_001');
const publicClue=id('public:clue_001');
const alice=id('actor:alice_001');
const bob=id('actor:bob_001');
const eventId=id('event:hypothesis_001');
async function setup({shared=false}={}){
 const gmProvider=()=>createLocalGMContext({user:{id:'GM',isGM:true},epoch:'local'},'world');
 const domains=new NarrativeDomainStore({repository:new MemoryPartitionRepository(),gmProvider});
 const workbench=new GMInvestigationWorkbench({domains});
 const data={title:'Missing Manifest',canonicalTruth:'GM-SECRET-CULPRIT',theories:[],opportunities:[],evidence:[
  {id:clue,publicId:publicClue,title:'Private manifest',publicTitle:'Cargo document',summary:'hidden details',
   publicSummary:'A cargo manifest',disclosedTo:shared?[alice,bob]:[alice]}
 ]};
 await domains.save({type:'investigation',scope:'world',id:investigationId,data,sourceEventId:id('event:setup_001')});
 return {domains,workbench};
}
const theory={scope:'world',investigationId,hypothesisId:id('hypothesis:th_001'),observerId:alice,
 sourceEventId:eventId,expectedRevision:1,title:'Smugglers used the docks',reasoning:'A manifest lists a suspicious destination',
 arguments:[{evidenceId:clue,direction:'support'}]};
test('GM-reviewed hypothesis persists with stable causal provenance and safe player view',async()=>{
 const {workbench}=await setup();const saved=await workbench.recordReviewedHypothesis(theory);
 assert.equal(saved.revision,2);assert.equal(saved.data.theories[0].sourceEventId,eventId);
 const view=await workbench.boardForObserver({investigationId,observerId:alice});
 assert.equal(validatePlayerBoardProjection(view),true);
 assert.deepEqual(view.theories[0].supportEvidenceIds,[publicClue]);
 assert.equal(view.evidence[0].id,publicClue);
 assert.equal(JSON.stringify(view).includes('GM-SECRET'),false);
 assert.equal(JSON.stringify(view).includes('hidden details'),false);
 assert.equal(JSON.stringify(view).includes(clue),false);
 const other=await workbench.boardForObserver({investigationId,observerId:bob});
 assert.equal(other.evidence.length,0);assert.equal(other.theories.length,0);
});
test('theory submission is idempotent per reviewed canonical event',async()=>{
 const {workbench}=await setup();const first=await workbench.recordReviewedHypothesis(theory);
 const repeat=await workbench.recordReviewedHypothesis(theory);assert.equal(repeat.revision,first.revision);
 await assert.rejects(workbench.recordReviewedHypothesis({...theory,sourceEventId:id('event:other_001'),expectedRevision:2}),{code:'HYPOTHESIS_CONFLICT'});
});
test('author cannot cite evidence not known to them or duplicate arguments',async()=>{
 const {workbench}=await setup();
 await assert.rejects(workbench.recordReviewedHypothesis({...theory,arguments:[{evidenceId:id('evidence:hidden_001'),direction:'support'}]}),{code:'HYPOTHESIS_EVIDENCE'});
 await assert.rejects(workbench.recordReviewedHypothesis({...theory,arguments:[...theory.arguments,...theory.arguments]}),{code:'HYPOTHESIS_EVIDENCE'});
});
test('sharing requires recipients to already know every cited clue',async()=>{
 const {workbench}=await setup();
 await assert.rejects(workbench.recordReviewedHypothesis({...theory,shareWith:[bob]}),{code:'HYPOTHESIS_DISCLOSURE'});
 const shared=await setup({shared:true});
 await shared.workbench.recordReviewedHypothesis({...theory,shareWith:[bob]});
 const view=await shared.workbench.boardForObserver({investigationId,observerId:bob});
 assert.equal(view.theories.length,1);assert.deepEqual(view.theories[0].supportEvidenceIds,[publicClue]);
});
test('revision changes and hidden verdict fields cannot enter the player record',async()=>{
 const {workbench}=await setup();
 await assert.rejects(workbench.recordReviewedHypothesis({...theory,expectedRevision:2}),{code:'REVISION_CONFLICT'});
 const record=await workbench.recordReviewedHypothesis({...theory,canonicalTruth:'foo',trueCulprit:'bar'});
 assert.equal(record.data.theories[0].canonicalTruth,undefined);
 assert.equal(record.data.theories[0].canonicalComparison,null);
 assert.equal(record.data.theories[0].trueCulprit,undefined);
});
