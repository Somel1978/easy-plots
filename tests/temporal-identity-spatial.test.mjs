import test from 'node:test';import assert from 'node:assert/strict';
import {classifyDueSchedule,scheduleNextTick} from '../src/domains/scheduler.mjs';
import {proposeIdentityLink,projectObserverAliases,assessIdentityMerge} from '../src/domains/identity.mjs';
import {planKnownRoute,projectKnownLocations} from '../src/domains/locations.mjs';
import {createSessionBrief,authorizeSessionRecap} from '../src/domains/session-planner.mjs';
test('due scheduler classifies deterministic expiry vs uncertain actions',()=>{
  const result=classifyDueSchedule({from:0,to:60,dueIndex:[{id:'expiry',dueAt:15,kind:'explicit-expiry',deterministic:true},
    {id:'travel',dueAt:20,kind:'npc-schedule'},{id:'tomorrow',dueAt:90,kind:'npc-schedule'}]});
  assert.deepEqual(result.eligible.map(i=>i.id),['expiry']);assert.deepEqual(result.pending.map(i=>i.id),['travel']);assert.equal(result.backgroundExecution,false);
});
test('no eligible GM means no background timer run',()=>{
  assert.equal(scheduleNextTick({activeGM:false,worldTime:100,indexedNextDueAt:20}).status,'paused-no-authoritative-gm');
});
test('alias linking does not automatically expose underlying identity or transfer obligations',()=>{
  const r=proposeIdentityLink({entityId:'entity',personaId:'persona',sourceEventId:'ep:event:x',relationship:'persona-of'});
  assert.equal(r.transferObligations,false);assert.equal(r.discloseToPlayers,false);
  assert.equal(projectObserverAliases([{observerId:'p1',disclosureId:'d1',personaPublicId:'vp',publicName:'Masked figure',secretTruth:'Marrek'}],{observerId:'p1',authorizedDisclosureIds:[]}).length,0);
});
test('identity merging is proposed rather than performed',()=>{
  assert.equal(assessIdentityMerge({primary:{id:'a'},duplicate:{id:'b'},linkedObligationIds:['debt']}).automaticDeletion,false);
});
test('route search cannot use undisclosed paths',()=>{
  const links=[{id:'r1',fromId:'dock',toId:'tower',open:true},{id:'r2',fromId:'tower',toId:'lair',open:true}];
  assert.equal(planKnownRoute({fromId:'dock',toId:'lair',links,authorizedLinkIds:['r1']}).status,'no-authorized-route');
  assert.deepEqual(planKnownRoute({fromId:'dock',toId:'lair',links,authorizedLinkIds:['r1','r2']}).linkIds,['r1','r2']);
  assert.deepEqual(projectKnownLocations([{publicId:'dock',disclosedName:'Harbor',disclosedTo:['p1'],disclosureId:'d1',secretCoordinates:[22,33]}],{observerId:'p1',disclosureIds:['d1']}),[{id:'dock',name:'Harbor',regionId:null}]);
});
test('session brief remains GM-only until explicit recap selection',()=>{
  const brief=createSessionBrief({activePlots:[{id:'public',gmLabel:'Open harbor'},{id:'secret',gmLabel:'Secret traitor'}]});
  assert.throws(()=>authorizeSessionRecap(brief),{code:'RECAP_APPROVAL'});
  const recap=authorizeSessionRecap(brief,{gmApproved:true,disclosureIds:['public']});
  assert.deepEqual(recap.items,[{referenceId:'public',label:'Open harbor',status:'unreviewed'}]);
  assert.equal(JSON.stringify(recap).includes('traitor'),false);
});
