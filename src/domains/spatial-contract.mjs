/** Bounded atlas contracts shared by the protected service and socket client. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject,clone} from '../contracts/record.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export const SPATIAL_LIMITS=Object.freeze({locations:32,routes:32,depth:8,corrections:64});
export function spatialScope(scope){if(!/^[a-z][a-z0-9-]{0,47}$/.test(scope??''))fail('SPATIAL_SCOPE','Explicit bounded atlas scope required');return scope;}
export function spatialIds(ids,max=32){if(!Array.isArray(ids)||ids.length>max||new Set(ids).size!==ids.length)fail('SPATIAL_BUDGET','Bounded unique spatial references required');ids.forEach(assertNarrativeId);return [...ids];}
export function atlasId(id){assertNarrativeId(id);if(!id.startsWith('ep:atlas:'))fail('SPATIAL_ATLAS','Public atlas identifier required');return id;}
const only=(value,keys,code='SPATIAL_CONTRACT')=>{assertPlainObject(value,code);if(Object.keys(value).some(k=>!keys.includes(k)))fail(code,'Unexpected spatial contract field');};
export function validateSpatialRegion(payload){
 only(payload,['scope','regionId','locationIds','routeIds','expectedRevision','visibility']);spatialScope(payload.scope);assertNarrativeId(payload.regionId);
 const locationIds=spatialIds(payload.locationIds),routeIds=spatialIds(payload.routeIds);
 if(locationIds.includes(payload.regionId))fail('SPATIAL_HIERARCHY','Selected region is separate from its direct children');
 if(payload.expectedRevision!==undefined&&payload.expectedRevision!==null&&(!Number.isSafeInteger(payload.expectedRevision)||payload.expectedRevision<1))fail('REVISION_CONFLICT','Positive region revision required');
 if(payload.visibility!==undefined&&payload.visibility!=='gm-only')fail('SPATIAL_DISCLOSURE','Atlas sources remain GM private');
 return clone({scope:payload.scope,regionId:payload.regionId,locationIds,routeIds,expectedRevision:payload.expectedRevision??null,visibility:'gm-only'});
}
export function validateAtlasBindings({discoveries,routeKnowledge,correctionIds=[]}){
 if(!Array.isArray(discoveries)||discoveries.length>33||!Array.isArray(routeKnowledge)||routeKnowledge.length>32)fail('SPATIAL_BUDGET','Bounded observer atlas bindings required');
 for(const item of discoveries){only(item,['discoveryId','receiptId','nextAtlasId']);assertNarrativeId(item.discoveryId);assertNarrativeId(item.receiptId);if(item.nextAtlasId!==undefined)atlasId(item.nextAtlasId);}
 for(const item of routeKnowledge){only(item,['routeId','receiptId']);assertNarrativeId(item.routeId);assertNarrativeId(item.receiptId);}
 spatialIds(discoveries.map(d=>d.discoveryId),33);spatialIds(routeKnowledge.map(r=>r.routeId));spatialIds([...discoveries,...routeKnowledge].map(d=>d.receiptId),65);spatialIds(correctionIds,64);
 return clone({discoveries,routeKnowledge,correctionIds});
}
/** No protected IDs, source revisions, hidden counts or arbitrary properties. */
export function validateSpatialProjection(value){
 only(value,['id','regionId','locations','routes'],'INVALID_PROJECTION');atlasId(value.id);assertNarrativeId(value.regionId);
 if(!Array.isArray(value.locations)||value.locations.length<1||value.locations.length>33||!Array.isArray(value.routes)||value.routes.length>32)fail('INVALID_PROJECTION','Invalid bounded atlas projection');
 const ids=new Set();for(const row of value.locations){only(row,['id','name','parentId','kind','atlasId'],'INVALID_PROJECTION');assertNarrativeId(row.id);if(ids.has(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>600||!['region','site'].includes(row.kind))fail('INVALID_PROJECTION','Invalid disclosed location');ids.add(row.id);if(row.parentId!==null)assertNarrativeId(row.parentId);if(row.atlasId!==undefined)atlasId(row.atlasId);}
 if(!ids.has(value.regionId)||value.locations.find(l=>l.id===value.regionId)?.parentId!==null)fail('INVALID_PROJECTION','Known selected region required');
 for(const row of value.locations)if(row.parentId!==null&&(!ids.has(row.parentId)||row.parentId!==value.regionId||row.id===value.regionId))fail('INVALID_PROJECTION','Disclosed hierarchy must stay inside the selected region');
 const routes=new Set();for(const row of value.routes){only(row,['id','name','fromId','toId','status'],'INVALID_PROJECTION');assertNarrativeId(row.id);if(routes.has(row.id)||ids.has(row.id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>600||!ids.has(row.fromId)||!ids.has(row.toId)||row.fromId===row.toId||!['open','restricted','closed'].includes(row.status))fail('INVALID_PROJECTION','Invalid disclosed route');routes.add(row.id);}
 if(new TextEncoder().encode(JSON.stringify(value)).length>48000)fail('INVALID_PROJECTION','Atlas projection exceeds its message budget');return clone(value);
}
