/** Versioned canonical document and its existing private runtime projection. */
import {EasyPlotsError} from './errors.mjs';
import {clone} from './record.mjs';
import {CANONICAL_EVENT_SCHEMA_V1} from './canonical-event-schema.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export const CANONICAL_EVENT_VERSION='1.0.0';
const eventId=value=>typeof value==='string'&&/^ep:event:[A-Za-z0-9_-]{8,120}$/.test(value);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
function json(value,depth=0,budget={remaining:2048}){
 if(--budget.remaining<0||depth>12)fail('EVENT_JSON_BUDGET','Canonical JSON exceeds its structural bound');
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
 if(Array.isArray(value)){for(const item of value)json(item,depth+1,budget);return;}
 if(plain(value)){for(const key of Object.keys(value))json(value[key],depth+1,budget);return;}
 fail('EVENT_JSON','Canonical values must be finite, plain JSON data');
}
export function validateEventVersion(event,{allowLegacy=true}={}){
 if(event?.eventVersion===undefined){
  if(!allowLegacy||event?.causalParentIds!==undefined||event?.correlationId!==undefined)fail('EVENT_VERSION_REQUIRED','Causal envelope fields require an explicit supported event version');
  return 'legacy-unversioned';
 }
 if(event.eventVersion!==CANONICAL_EVENT_VERSION)fail('EVENT_VERSION_UNSUPPORTED','Unsupported event contract; explicit compatibility or migration is required');
 if(Object.keys(event).some(k=>!['id','eventType','eventVersion','source','payload','causalParentIds','correlationId'].includes(k))||!eventId(event.id)||!Array.isArray(event.causalParentIds)||event.causalParentIds.length>8||new Set(event.causalParentIds).size!==event.causalParentIds.length||event.causalParentIds.some(id=>!eventId(id)||id===event.id)||typeof event.correlationId!=='string'||!event.correlationId||event.correlationId.length>200)fail('EVENT_ENVELOPE','Versioned events require bounded unique parents and correlation identity');
 json(event);return CANONICAL_EVENT_VERSION;
}
export function versionedEvent({id,eventType,source,payload,causalParentIds=[],correlationId=id}={}){
 const event={id,eventType,eventVersion:CANONICAL_EVENT_VERSION,source:clone(source),payload:clone(payload),causalParentIds:clone(causalParentIds),correlationId};
 validateEventVersion(event,{allowLegacy:false});return event;
}
// Only keywords present in the pinned v1 descriptor are supported here. This
// deliberately is not a general JSON Schema evaluator or a plugin interpreter.
function schemaValue(schema,value){
 if(schema.type==='object'){
  if(!plain(value))fail('CANONICAL_EVENT_SCHEMA','Canonical object field is invalid');
  if(schema.required?.some(key=>!Object.hasOwn(value,key))||schema.additionalProperties===false&&Object.keys(value).some(k=>!Object.hasOwn(schema.properties,k)))fail('CANONICAL_EVENT_SCHEMA','Canonical fields do not match the versioned schema');
  for(const [key,child] of Object.entries(schema.properties??{}))if(Object.hasOwn(value,key))schemaValue(child,value[key]);
 }else if(schema.type==='array'){
  if(!Array.isArray(value))fail('CANONICAL_EVENT_SCHEMA','Canonical array field is invalid');for(const item of value)schemaValue(schema.items??{},item);
 }else if(schema.type==='string'){
  if(typeof value!=='string'||value.length<(schema.minLength??0)||schema.pattern&&!new RegExp(schema.pattern).test(value)||schema.format==='date-time'&&(!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))))fail('CANONICAL_EVENT_SCHEMA','Canonical string field is invalid');
 }else if(schema.type==='integer'&&(!Number.isSafeInteger(value)||value<(schema.minimum??-Infinity))||schema.type==='number'&&!Number.isFinite(value))fail('CANONICAL_EVENT_SCHEMA','Canonical number field is invalid');
 if(Object.hasOwn(schema,'const')&&value!==schema.const||schema.enum&&!schema.enum.includes(value))fail('CANONICAL_EVENT_SCHEMA','Canonical enum field is invalid');
}
export function validateCanonicalEventDocument(document){
 json(document);schemaValue(CANONICAL_EVENT_SCHEMA_V1,document);
 if(document.schemaVersion!==CANONICAL_EVENT_VERSION||document.eventVersion!==CANONICAL_EVENT_VERSION)fail('EVENT_VERSION_UNSUPPORTED','Canonical document contract is not supported');
 if(!eventId(document.id)||document.causalParentIds.length>8||new Set(document.causalParentIds).size!==document.causalParentIds.length||document.causalParentIds.some(id=>!eventId(id)||id===document.id)||document.provenance.length>16||document.involvedActorIds.length>64)fail('CANONICAL_EVENT_SCHEMA','Canonical identity or causal provenance exceeds its bound');
 if(new TextEncoder().encode(JSON.stringify(document)).length>24000)fail('CANONICAL_EVENT_BUDGET','Canonical document exceeds its storage budget');
 return clone(document);
}
export function canonicalOrigin(source){
 if(source.kind==='native-hook')return {kind:'foundry-hook',sourceId:source.documentUuid};
 if(source.kind==='gm-approved-intent'){const sourceId=source.scheduleId??source.requestId??source.gmUserId;return {kind:source.scheduleId?'scheduler':'gm-decision',...(typeof sourceId==='string'&&sourceId?{sourceId}:{})};}
 return {kind:'reconciliation',sourceId:'local-test-fixture'};
}
export function canonicalEventDocument(event,{partitionId,worldId,authorId,acceptedAt,worldTime}={}){
 validateEventVersion(event,{allowLegacy:false});const instant=new Date(acceptedAt*1000);if(!Number.isFinite(instant.getTime()))fail('INVALID_EVENT_TIME','Canonical acceptance time must be representable');const realTime=instant.toISOString();
 return validateCanonicalEventDocument({id:event.id,kind:'event',schemaVersion:CANONICAL_EVENT_VERSION,revision:0,partitionId,updatedAt:realTime,accessClass:'gm',provenance:[{authorId}],
  eventType:event.eventType,eventVersion:event.eventVersion,worldId,origin:canonicalOrigin(event.source),causalParentIds:clone(event.causalParentIds),correlationId:event.correlationId,
  involvedActorIds:[],realTime,...(Number.isFinite(worldTime)?{worldTime}:{}),payload:clone(event.payload),payloadAccess:'gm'});
}
