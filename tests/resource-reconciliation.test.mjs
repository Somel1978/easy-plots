import test from 'node:test';import assert from 'node:assert/strict';
import {auditResourceReferences,proposeGuidedRebind,proposeResourceRetirement} from '../src/orchestration/resource-reconciliation.mjs';
const id=s=>`ep:resource:${s}`;
const resource={narrativeId:id('npc0001'),nativeUuid:'Actor.fake1',ownership:'borrowed',revision:2,exists:true};
test('audits drift, missing document and shared bindings without destructive changes',()=>{
 const r=auditResourceReferences({resources:[{...resource,exists:false,nativeRevision:5,provenanceRevision:3},{...resource,narrativeId:id('npc0002')}],bindings:[{sourceId:id('plot0001'),targetId:id('missing001')}],knownNarrativeIds:[id('plot0001')]});
 assert.ok(r.findings.some(x=>x.kind==='shared-native-binding'));
 assert.ok(r.findings.some(x=>x.kind==='missing-native-document'));
 assert.ok(r.findings.some(x=>x.kind==='revision-drift'));
 assert.ok(r.findings.some(x=>x.kind==='unresolved-reference'));
 assert.equal(r.deletionsProposed,0);
});
test('unverified and ambiguous native candidates rejected',()=>{
 const base={reference:resource,currentRevision:2,reviewEventId:id('event001'),selectedNativeUuid:'Actor.new1'};
 assert.throws(()=>proposeGuidedRebind({...base,candidates:[{nativeUuid:'Actor.new1',verified:false}]}),{code:'RESOURCE_REVIEW'});
 assert.throws(()=>proposeGuidedRebind({...base,candidates:[{nativeUuid:'Actor.new1',verified:true},{nativeUuid:'Actor.new1',verified:true}]}),{code:'RESOURCE_REVIEW'});
});
test('chosen verified native candidate preserves immutable narrative identity',()=>{
 const r=proposeGuidedRebind({reference:resource,currentRevision:2,reviewEventId:id('event001'),selectedNativeUuid:'Actor.new1',candidates:[{nativeUuid:'Actor.new1',verified:true}]});
 assert.equal(r.narrativeId,resource.narrativeId);assert.equal(r.deleteOldDocument,false);assert.equal(r.committed,false);
});
test('rebind checks current revision and detached ownership',()=>{
 const args={reference:resource,currentRevision:3,reviewEventId:id('event001'),selectedNativeUuid:'Actor.new1',candidates:[{nativeUuid:'Actor.new1',verified:true}]};
 assert.throws(()=>proposeGuidedRebind(args),{code:'REVISION_CONFLICT'});
 assert.throws(()=>proposeGuidedRebind({...args,reference:{...resource,ownership:'detached'},currentRevision:2}),{code:'RESOURCE_DETACHED'});
});
test('retirement never automatically deletes shared or exclusive native document',()=>{
 assert.equal(proposeResourceRetirement({resource,sourceEventId:id('event001')}).deleteNativeDocument,false);
 const r=proposeResourceRetirement({resource:{...resource,ownership:'exclusive'},sourceEventId:id('event001'),reverseReferences:[id('plot0001')]});
 assert.equal(r.requiresReview,true);assert.equal(r.deleteNativeDocument,false);
});
test('duplicate identity and invalid ownership rejected',()=>{
 assert.throws(()=>auditResourceReferences({resources:[resource,resource]}),{code:'RESOURCE_CONTRACT'});
 assert.throws(()=>auditResourceReferences({resources:[{...resource,ownership:'unknown'}]}),{code:'RESOURCE_CONTRACT'});
});
