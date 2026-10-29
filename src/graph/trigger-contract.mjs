/** Typed event-source filtering. An authored manual event is never silently
 * interchangeable with a native document Hook of the same eventType.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertEventType} from './event-type.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
const TYPES=new Set(['native-hook','gm-approved-intent','test-fixture']);
export const TRIGGER_NODE_TYPES=Object.freeze(['core.trigger.event','core.trigger.manual','core.trigger.schedule-due','core.trigger.document-event','core.trigger.operations-completed','core.trigger.reviewed-plan','core.trigger.encounter-closed','core.trigger.resource-activation']);
const TRIGGERS=new Set(TRIGGER_NODE_TYPES);
export const isTriggerNode=node=>TRIGGERS.has(node?.typeId);
export function validateEventTrigger(node){
 const d=node?.data;
 if(!isTriggerNode(node))throw new EasyPlotsError('TRIGGER_CONTRACT','Unsupported trigger contract');
 const fields=['eventType','sourceKinds',...(node.typeId==='core.trigger.operations-completed'?['sourceGraphId','sourcePublishedVersion','requiredNodeIds']:[])];
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!fields.includes(k)))
  throw new EasyPlotsError('TRIGGER_CONTRACT','Typed event source contract required');
 assertEventType(d.eventType);
 if(d.sourceKinds!==undefined){
  if(!Array.isArray(d.sourceKinds)||d.sourceKinds.length>3||
    d.sourceKinds.some(k=>!TYPES.has(k))||new Set(d.sourceKinds).size!==d.sourceKinds.length)
   throw new EasyPlotsError('TRIGGER_CONTRACT','Source kind allowlist invalid');
 }
 if(node.typeId==='core.trigger.operations-completed'){
  assertNarrativeId(d.sourceGraphId);
  if(!d.sourceGraphId.startsWith('ep:graph:')||d.eventType!=='narrative.operations-completed'||!Number.isSafeInteger(d.sourcePublishedVersion)||d.sourcePublishedVersion<1||!Array.isArray(d.requiredNodeIds)||d.requiredNodeIds.length<1||d.requiredNodeIds.length>8||new Set(d.requiredNodeIds).size!==d.requiredNodeIds.length)throw new EasyPlotsError('TRIGGER_CONTRACT','Completed-operation trigger requires a pinned source graph and bounded unique node IDs');
  d.requiredNodeIds.forEach(assertNarrativeId);
 }
 if(node.typeId!=='core.trigger.event'){
  const source=node.typeId==='core.trigger.document-event'?'native-hook':'gm-approved-intent';
  if(d.sourceKinds?.length!==1||d.sourceKinds[0]!==source)
   throw new EasyPlotsError('TRIGGER_CONTRACT','Specialized event source must be exact');
  if(node.typeId==='core.trigger.schedule-due'&&d.eventType!=='narrative.schedule-due')
   throw new EasyPlotsError('TRIGGER_CONTRACT','Scheduled trigger must use canonical due event');
  if(node.typeId==='core.trigger.manual'&&d.eventType==='narrative.schedule-due')
   throw new EasyPlotsError('TRIGGER_CONTRACT','Schedule events require verified schedule trigger');
  if(node.typeId==='core.trigger.reviewed-plan'&&d.eventType!=='narrative.reviewed-plan')throw new EasyPlotsError('TRIGGER_CONTRACT','Reviewed-plan trigger requires its verified intent event');
  if(node.typeId==='core.trigger.encounter-closed'&&d.eventType!=='narrative.encounter-closed')throw new EasyPlotsError('TRIGGER_CONTRACT','Encounter closure requires its selected verified outcome event');
  if(node.typeId==='core.trigger.resource-activation'&&d.eventType!=='narrative.resource-activation-reviewed')throw new EasyPlotsError('TRIGGER_CONTRACT','Resource activation requires its reviewed native-proof intent');
 }
 return true;
}
export function triggerAcceptsEvent(node,event){
 validateEventTrigger(node);
 if(node.data.eventType!==event.eventType||node.data.sourceKinds?.length&&
   !node.data.sourceKinds.includes(event.source?.kind))return false;
 switch(node.typeId){
  case 'core.trigger.resource-activation':return event.source?.capability==='verified-resource-activation-v1'&&event.payload?.verified===true&&['expectedManifestRevision','publishedVersion','expectedActivationRevision'].every(k=>Number.isSafeInteger(event.payload[k])&&event.payload[k]>0);
  case 'core.trigger.manual':return typeof event.source?.requestId==='string'&&event.source.requestId.startsWith('ep:request:')&&event.source.scheduleId===undefined;
  case 'core.trigger.schedule-due':return typeof event.source?.scheduleId==='string'&&
    event.source.scheduleId===event.payload?.scheduleId&&event.payload?.verified===true&&
    Number.isSafeInteger(event.payload?.sourceRevision)&&event.payload.sourceRevision>=1;
  case 'core.trigger.document-event':return event.source?.kind==='native-hook'&&typeof event.source?.hook==='string'&&event.source.hook.length>0;
  case 'core.trigger.operations-completed':{
   if(event.source?.capability!=='verified-operations-v1'||event.payload?.verified!==true||!Array.isArray(event.payload.completions)||event.payload.completions.length>8)return false;
   const selected=event.payload.completions.filter(row=>row.rootGraphId===node.data.sourceGraphId&&row.rootPublishedVersion===node.data.sourcePublishedVersion);
   return node.data.requiredNodeIds.every(id=>selected.some(row=>Array.isArray(row.nodeIds)&&row.nodeIds.includes(id)));
  }
  case 'core.trigger.reviewed-plan':return event.source?.capability==='verified-reviewed-plan-v1'&&event.source.planId===event.payload?.planId&&event.payload?.verified===true&&Number.isSafeInteger(event.payload.planRevision)&&event.payload.planRevision>0;
  case 'core.trigger.encounter-closed':return event.source?.capability==='verified-encounter-closure-v1'&&event.payload?.verified===true&&['victory','defeat','escape','negotiation','stalemate'].includes(event.payload?.outcome)&&typeof event.payload?.encounterId==='string'&&typeof event.payload?.resolutionId==='string'&&typeof event.payload?.operationId==='string'&&event.causalParentIds?.includes(event.payload.sourceEventId);
  default:return true;
 }
}
