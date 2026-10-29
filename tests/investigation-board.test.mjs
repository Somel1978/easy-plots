import test from 'node:test';import assert from 'node:assert/strict';
import {createInvestigationBoardProjection,validatePlayerBoardProjection} from '../src/domains/investigation-board.mjs';
const observer='ep:actor:player_001',other='ep:actor:player_002';
const base={investigationId:'ep:investigation:missing_shipments',title:'The Missing Shipments',evidence:[
  {id:'ep:evidence:manifest_001',title:'Public Manifest',summary:'Lists cargo',canonicalTruth:'The culprit is X',disclosedTo:[observer]},
  {id:'ep:evidence:hidden_002',title:'Hidden Clue',summary:'Secret',disclosedTo:[other]}],
  theories:[{id:'ep:theory:first_001',title:'A Suspect',reasoning:'The manifest suggests...',ownerId:observer,
    canonicalTruth:true,disclosedTo:[observer],arguments:[{evidenceId:'ep:evidence:manifest_001',direction:'support'},
      {evidenceId:'ep:evidence:hidden_002',direction:'contradict'}]},
    {id:'ep:theory:hidden_002',title:'Secret theory',ownerId:other,disclosedTo:[other],arguments:[]}],
  opportunities:[{id:'ep:opportunity:examine_001',label:'Examine the manifest',currentlyAvailable:true,disclosedTo:[observer],hiddenAnswer:'yes'},
    {id:'ep:opportunity:hidden_002',label:'Secret action',currentlyAvailable:true,disclosedTo:[other]}]};
const context={observerId:observer,authorizedEvidenceIds:['ep:evidence:manifest_001'],authorizedOpportunityIds:['ep:opportunity:examine_001']};
test('player board is allowlisted, knowledge-filtered and conceals undisclosed counts',()=>{
  const board=createInvestigationBoardProjection(base,context);
  assert.deepEqual(board.evidence.map(e=>e.id),['ep:evidence:manifest_001']);
  assert.equal(board.theories.length,1);assert.equal(board.theories[0].supportEvidenceIds.length,1);
  assert.equal(board.theories[0].contradictionEvidenceIds.length,0);
  assert.equal(board.actions.length,1);
  for(const text of ['canonicalTruth','hiddenAnswer','Secret theory','Hidden Clue','Secret action'])assert.equal(JSON.stringify(board).includes(text),false);
  assert.equal(validatePlayerBoardProjection(board),true);
  assert.equal(Object.hasOwn(board,'totalEvidence'),false);
});
test('excessive or unauthorized board content is rejected',()=>{
  assert.throws(()=>createInvestigationBoardProjection(base,{...context,observerId:'bad-id'}),{code:'INVALID_ID'});
  assert.throws(()=>createInvestigationBoardProjection({...base,evidence:new Array(51).fill(base.evidence[0])},context),{code:'BOARD_BUDGET'});
  const board=createInvestigationBoardProjection(base,context);
  assert.throws(()=>validatePlayerBoardProjection({...board,gmTruth:'secret'}),{code:'INVALID_BOARD'});
  assert.throws(()=>validatePlayerBoardProjection({...board,evidence:[{...board.evidence[0],hiddenSource:'GM'}]}),{code:'INVALID_BOARD'});
});
