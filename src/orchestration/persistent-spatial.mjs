/** Selected-region spatial hierarchy and observer knowledge projections.
 * Region membership is explicitly bounded. Published views pin canonical
 * revisions; undisclosed canonical changes cannot alter an observer's map.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {planKnownRoute} from '../domains/locations.mjs';
import {SPATIAL_LIMITS,spatialScope,atlasId,validateSpatialRegion,validateAtlasBindings,validateSpatialProjection} from '../domains/spatial-contract.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const EVENT=/^ep:event:[A-Za-z0-9_-]{8,120}$/;
export class PersistentSpatialAtlas {
 #domains;#knowledge;#gm;#writer;#time;
 constructor({domains,knowledge,gmProvider,writer,worldTimeProvider=()=>0}={}){
  if(!domains?.read||!domains?.readRevision||!domains?.save||!domains?.hasRecordOrIndex||typeof knowledge?.projection!=='function'||typeof gmProvider!=='function'||!writer?.assertEligible||typeof worldTimeProvider!=='function')fail('SPATIAL_DEPENDENCY','Protected canonical records, knowledge projections and designated GM required');
  this.#domains=domains;this.#knowledge=knowledge;this.#gm=gmProvider;this.#writer=writer;this.#time=worldTimeProvider;
 }
 #authority(){const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);return gm;}
 async #read(type,scope,id,seen=null){
  this.#authority();assertNarrativeId(id);const row=await this.#domains.read(type,scope,id);this.#authority();
  if(!row&&await this.#domains.hasRecordOrIndex(type,scope,id))fail('SPATIAL_UNCERTAIN','Known spatial source lacks its verified payload');this.#authority();
  if(seen)seen.set(`${type}|${id}`,{type,id,revision:row?.revision??null});return row;
 }
 async #revision(type,scope,id,revision){this.#authority();const row=await this.#domains.readRevision(type,scope,id,revision);this.#authority();if(!row||row.revision!==revision)fail('SPATIAL_HISTORY','Exact published spatial revision unavailable');return row;}
 async #stable(scope,seen){for(const observation of seen.values()){const row=await this.#read(observation.type,scope,observation.id);if((row?.revision??null)!==observation.revision)fail('SPATIAL_STALE','Atlas source changed during projection');}this.#authority();}
 #place(row,id){if(!row||row.data.locationId!==id||!['region','site'].includes(row.data.kind)||typeof row.data.name!=='string'||!row.data.name.trim()||row.data.name.length>160)fail('SPATIAL_LOCATION','Canonical typed location required');if(row.data.parentLocationId!==undefined)assertNarrativeId(row.data.parentLocationId);return row;}
 #route(row,id){if(!row||row.data.routeId!==id||!['open','restricted','closed'].includes(row.data.status))fail('SPATIAL_ROUTE','Canonical typed route required');assertNarrativeId(row.data.fromLocationId);assertNarrativeId(row.data.toLocationId);if(row.data.fromLocationId===row.data.toLocationId)fail('SPATIAL_ROUTE','Route endpoints must differ');return row;}
 async #region(scope,regionId,seen=new Map(),revision=null){
  const manifest=revision===null?await this.#read('spatial-region',scope,regionId,seen):await this.#revision('spatial-region',scope,regionId,revision);
  if(!manifest)fail('SPATIAL_REGION','Selected region has no explicit spatial manifest');
  const data=validateSpatialRegion(manifest.data);if(data.regionId!==regionId)fail('SPATIAL_CORRUPT','Region manifest identity differs');return {manifest,data};
 }
 async inspectRegion({scope='world',regionId}={}){
  this.#authority();spatialScope(scope);assertNarrativeId(regionId);const seen=new Map(),{manifest,data}=await this.#region(scope,regionId,seen),region=this.#place(await this.#read('location',scope,regionId,seen),regionId);
  if(region.data.kind!=='region')fail('SPATIAL_HIERARCHY','Selected location must be a region');
  const children=[],routes=[],ancestors=[],visited=new Set([regionId]);let parent=region.data.parentLocationId;
  while(parent){if(visited.has(parent)||ancestors.length>=SPATIAL_LIMITS.depth)fail('SPATIAL_HIERARCHY','Cyclic or excessive spatial hierarchy');visited.add(parent);const row=this.#place(await this.#read('location',scope,parent,seen),parent);if(row.data.kind!=='region')fail('SPATIAL_HIERARCHY','Only regions can contain locations');ancestors.push(row);parent=row.data.parentLocationId;}
  for(const id of data.locationIds){const row=this.#place(await this.#read('location',scope,id,seen),id);if(row.data.parentLocationId!==regionId||visited.has(id))fail('SPATIAL_HIERARCHY','Manifest children must belong directly to the selected region');children.push(row);}
  const members=new Set([regionId,...data.locationIds]);for(const id of data.routeIds){const row=this.#route(await this.#read('location-route',scope,id,seen),id);if(!members.has(row.data.fromLocationId)||!members.has(row.data.toLocationId))fail('SPATIAL_ROUTE','Selected-region routes must use manifest members');routes.push(row);}
  await this.#stable(scope,seen);return clone({manifest,region,children,routes,ancestors});
 }
 async saveRegion({scope='world',regionId,locationIds=[],routeIds=[],expectedRevision=null,sourceEventId,effectReceipt=null}={}){
  this.#authority();const data=validateSpatialRegion({scope,regionId,locationIds,routeIds,expectedRevision});if(!EVENT.test(sourceEventId??''))fail('SPATIAL_PROVENANCE','Explicit spatial authoring event required');
  const seen=new Map(),region=this.#place(await this.#read('location',scope,regionId,seen),regionId);if(region.data.kind!=='region')fail('SPATIAL_HIERARCHY','Only a typed region can have a manifest');
  const members=new Set([regionId,...locationIds]);for(const id of locationIds){const row=this.#place(await this.#read('location',scope,id,seen),id);if(row.data.parentLocationId!==regionId)fail('SPATIAL_HIERARCHY','Manifest children must belong directly to the region');}
  let parent=region.data.parentLocationId;const visited=new Set([regionId]);while(parent){if(visited.has(parent)||visited.size>SPATIAL_LIMITS.depth)fail('SPATIAL_HIERARCHY','Cyclic or excessive spatial hierarchy');visited.add(parent);const row=this.#place(await this.#read('location',scope,parent,seen),parent);if(row.data.kind!=='region')fail('SPATIAL_HIERARCHY','Only regions can contain locations');parent=row.data.parentLocationId;}
  for(const id of routeIds){const row=this.#route(await this.#read('location-route',scope,id,seen),id);if(!members.has(row.data.fromLocationId)||!members.has(row.data.toLocationId))fail('SPATIAL_ROUTE','Route would escape the bounded selected region');}
  await this.#stable(scope,seen);return this.#domains.save({type:'spatial-region',scope,id:regionId,data,expectedRevision,sourceEventId,effectReceipt});
 }
 async #known(scope,observerId,bindings,correctionIds,seen){
  const receiptIds=bindings.map(b=>b.receiptId),claims=new Map();
  for(const id of receiptIds){const receipt=await this.#read('knowledge-receipt',scope,id,seen);if(!receipt||receipt.data.observerId!==observerId)fail('SPATIAL_KNOWLEDGE','Atlas knowledge must belong to the selected observer');const current=await this.#read('knowledge-claim',scope,receipt.data.claimId,seen);const claim=current?.revision===receipt.data.claimRevision?current:await this.#revision('knowledge-claim',scope,receipt.data.claimId,receipt.data.claimRevision);if([id,receipt.data.claimId,observerId].includes(claim.data.publicId))fail('SPATIAL_ALIAS','Public map aliases must be separate from protected identities');claims.set(id,claim.data.publicId);}
  for(const id of correctionIds){const row=await this.#read('knowledge-correction',scope,id,seen);if(!row||row.data.observerId!==observerId||!receiptIds.includes(row.data.receiptId))fail('SPATIAL_KNOWLEDGE','Atlas corrections must belong to its observer and receipt set');}
  const worldTime=this.#time();if(!Number.isFinite(worldTime)||worldTime<0)fail('SPATIAL_TIME','Trusted world time unavailable');
  // Ledger supports at most64 receipts; selected region plus32 routes allows65.
  // Keep its existing contract by projecting two bounded portions.
  const known=new Map();for(let offset=0;offset<receiptIds.length;offset+=32){const selected=receiptIds.slice(offset,offset+32),selectedCorrections=[];for(const id of correctionIds){const row=await this.#read('knowledge-correction',scope,id,seen);if(selected.includes(row.data.receiptId))selectedCorrections.push(id);}const projected=await this.#knowledge.projection({scope,observerId,receiptIds:selected,correctionIds:selectedCorrections,worldTime,max:64});this.#authority();for(const entry of projected.claims)known.set(entry.id,entry);}
  const result=new Map();for(const [receiptId,publicId]of claims)if(known.has(publicId))result.set(receiptId,known.get(publicId));return result;
 }
 async saveView({scope='world',atlasId:publicAtlasId=null,regionId,observerId,discoveries=[],routeKnowledge=[],correctionIds=[],expectedRevision=null,sourceEventId}={}){
  this.#authority();spatialScope(scope);assertNarrativeId(regionId);assertNarrativeId(observerId);validateAtlasBindings({discoveries,routeKnowledge,correctionIds});if(!EVENT.test(sourceEventId??''))fail('SPATIAL_PROVENANCE','Explicit atlas publication event required');
  publicAtlasId??=`ep:atlas:${secureUUID().replaceAll('-','_')}`;atlasId(publicAtlasId);const seen=new Map(),prior=await this.#read('spatial-view',scope,publicAtlasId,seen);
  if(prior&&(prior.data.observerId!==observerId||prior.data.regionId!==regionId))fail('SPATIAL_IDENTITY','An atlas cannot change its observer or selected region');
  const snapshot=await this.inspectRegion({scope,regionId}),members=new Map([snapshot.region,...snapshot.children].map(row=>[row.id,row])),discoveryBindings=[],routeBindings=[],found=new Set();
  for(const binding of discoveries){const row=await this.#read('location-discovery',scope,binding.discoveryId,seen);if(!row||row.data.discoveryId!==binding.discoveryId||row.data.observerId!==observerId||!['discovered','disputed','retracted'].includes(row.data.status)||!members.has(row.data.locationId)||found.has(row.data.locationId)||row.data.locationId===regionId&&row.data.status!=='discovered')fail('SPATIAL_DISCOVERY','One existing observer discovery is required per visible location');found.add(row.data.locationId);if(binding.nextAtlasId){const next=await this.#read('spatial-view',scope,binding.nextAtlasId,seen);if(!next||next.data.observerId!==observerId||next.data.regionId!==row.data.locationId||members.get(row.data.locationId).data.kind!=='region')fail('SPATIAL_NAVIGATION','Navigation must point to the same observer and disclosed subregion');}discoveryBindings.push({...binding,locationId:row.data.locationId,locationRevision:members.get(row.data.locationId).revision});}
  if(!found.has(regionId))fail('SPATIAL_DISCOVERY','Selected region itself must be discovered');
  for(const binding of routeKnowledge){const row=snapshot.routes.find(r=>r.id===binding.routeId);if(!row)fail('SPATIAL_ROUTE','Route is absent from the selected region');routeBindings.push({...binding,routeRevision:row.revision});}
  const known=await this.#known(scope,observerId,[...discoveries,...routeKnowledge],correctionIds,seen);if([...discoveries,...routeKnowledge].some(b=>!known.has(b.receiptId))||known.get(discoveryBindings.find(b=>b.locationId===regionId).receiptId)?.stance==='retracted')fail('SPATIAL_KNOWLEDGE','Publication requires available observer knowledge and a non-retracted selected region');
  const publicIds=[...known.values()].map(c=>c.id),protectedIds=new Set([observerId,regionId,...members.keys(),...snapshot.routes.map(r=>r.id),...discoveries.map(d=>d.discoveryId),...[...discoveries,...routeKnowledge].map(b=>b.receiptId)]);if(new Set(publicIds).size!==publicIds.length||publicIds.some(id=>protectedIds.has(id)))fail('SPATIAL_ALIAS','Each disclosed atlas item needs a separate public claim identity');
  // Check manifest/location/route revisions after knowledge reads, before write.
  for(const row of [snapshot.manifest,snapshot.region,...snapshot.children,...snapshot.routes])seen.set(`${row.kind}|${row.id}`,{type:row.kind,id:row.id,revision:row.revision});await this.#stable(scope,seen);
  return this.#domains.save({type:'spatial-view',scope,id:publicAtlasId,data:{regionId,observerId,manifestRevision:snapshot.manifest.revision,discoveries:discoveryBindings,routeKnowledge:routeBindings,correctionIds:clone(correctionIds)},expectedRevision,sourceEventId});
 }
 async inspectView({scope='world',atlasId:publicAtlasId}={}){this.#authority();spatialScope(scope);atlasId(publicAtlasId);const row=await this.#read('spatial-view',scope,publicAtlasId);if(!row)fail('SPATIAL_UNAVAILABLE','No approved spatial atlas available');return clone(row);}
 async projection({scope='world',atlasId:publicAtlasId,observerId}={}){
  this.#authority();spatialScope(scope);atlasId(publicAtlasId);assertNarrativeId(observerId);const seen=new Map(),view=await this.#read('spatial-view',scope,publicAtlasId,seen);
  if(!view||view.data.observerId!==observerId)fail('SPATIAL_UNAVAILABLE','No approved spatial atlas available');
  const {regionId,manifestRevision,discoveries,routeKnowledge,correctionIds}=view.data;assertNarrativeId(regionId);
  // Strip persisted pin metadata before validating the authored binding shape.
  validateAtlasBindings({discoveries:discoveries?.map(({discoveryId,receiptId,nextAtlasId})=>({discoveryId,receiptId,...(nextAtlasId?{nextAtlasId}:{})})),routeKnowledge:routeKnowledge?.map(({routeId,receiptId})=>({routeId,receiptId})),correctionIds});
  const {data:manifest}=await this.#region(scope,regionId,seen,manifestRevision),members=new Set([regionId,...manifest.locationIds]),known=await this.#known(scope,observerId,[...discoveries,...routeKnowledge],correctionIds,seen),locations=[],aliases=new Map();
  for(const binding of discoveries){const discovery=await this.#read('location-discovery',scope,binding.discoveryId,seen);if(!discovery||discovery.data.discoveryId!==binding.discoveryId||discovery.data.observerId!==observerId||discovery.data.locationId!==binding.locationId)fail('SPATIAL_CORRUPT','Published discovery identity differs');if(discovery.data.status!=='discovered'||!known.has(binding.receiptId)||known.get(binding.receiptId).stance==='retracted')continue;if(!members.has(binding.locationId))fail('SPATIAL_CORRUPT','Published discovery escapes its pinned region');const place=this.#place(await this.#revision('location',scope,binding.locationId,binding.locationRevision),binding.locationId),claim=known.get(binding.receiptId);if(aliases.has(binding.locationId)||members.has(claim.id)||manifest.routeIds.includes(claim.id))fail('SPATIAL_CORRUPT','Duplicate or protected published location alias');aliases.set(binding.locationId,claim.id);locations.push({id:claim.id,name:claim.text,parentId:null,kind:place.data.kind,...(binding.nextAtlasId?{atlasId:binding.nextAtlasId}:{})});}
  if(!aliases.has(regionId))fail('SPATIAL_UNAVAILABLE','No approved spatial atlas available');const publicRegionId=aliases.get(regionId);for(const row of locations)if(row.id!==publicRegionId)row.parentId=publicRegionId;
  const routes=[];for(const binding of routeKnowledge){if(!known.has(binding.receiptId)||known.get(binding.receiptId).stance==='retracted')continue;if(!manifest.routeIds.includes(binding.routeId))fail('SPATIAL_CORRUPT','Published route escapes its pinned region');const route=this.#route(await this.#revision('location-route',scope,binding.routeId,binding.routeRevision),binding.routeId),fromId=aliases.get(route.data.fromLocationId),toId=aliases.get(route.data.toLocationId);if(!fromId||!toId)continue;const claim=known.get(binding.receiptId);if(members.has(claim.id)||manifest.routeIds.includes(claim.id))fail('SPATIAL_ALIAS','Protected route alias');routes.push({id:claim.id,name:claim.text,fromId,toId,status:route.data.status});}
  const result=validateSpatialProjection({id:publicAtlasId,regionId:publicRegionId,locations,routes});await this.#stable(scope,seen);return result;
 }
 async route({scope='world',atlasId,observerId,fromId,toId}={}){assertNarrativeId(fromId);assertNarrativeId(toId);const view=await this.projection({scope,atlasId,observerId});if(!view.locations.some(l=>l.id===fromId)||!view.locations.some(l=>l.id===toId))return {status:'no-authorized-route',linkIds:[]};return planKnownRoute({fromId,toId,links:view.routes.map(r=>({...r,open:r.status==='open'})),authorizedLinkIds:view.routes.map(r=>r.id),maxLinks:32,maxHops:32});}
}
