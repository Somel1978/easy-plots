import {MemoryPartitionRepository,MemoryOperationJournal} from '../src/storage/memory.mjs';
import {NarrativeDomainStore} from '../src/domains/domain-store.mjs';
import {createLocalGMContext} from '../src/security/authority.mjs';
import {EasyPlotsError} from '../src/contracts/errors.mjs';
import {PersistentKnowledgeLedger} from '../src/orchestration/persistent-knowledge.mjs';
import {PersistentSpatialAtlas} from '../src/orchestration/persistent-spatial.mjs';
import {createNarrativeCapabilityProviders} from '../src/runtime/narrative-capabilities.mjs';
import {createSpatialRegionProvider} from '../src/runtime/spatial-region-provider.mjs';
import {EffectProviderRegistry} from '../src/runtime/provider-registry.mjs';
export const spatialIds={region:'ep:location:region_001',dock:'ep:location:dock_001',tower:'ep:location:tower_001',secret:'ep:location:secret_001',road:'ep:route:road_001',secretRoad:'ep:route:secret_001',observer:'ep:observer:player_001',other:'ep:observer:other_001',atlas:'ep:atlas:public_region_001'};
export async function spatialFixture({seed=true}={}){
 const repository=new MemoryPartitionRepository(),user={id:'spatial-GM-001',isGM:true,active:true},state={eligible:true,time:100},gmProvider=()=>createLocalGMContext({user},'spatial-world'),writer={assertEligible(){if(!state.eligible)throw new EasyPlotsError('GM_WRITER','Coordinator changed');}},domains=new NarrativeDomainStore({repository,gmProvider}),knowledge=new PersistentKnowledgeLedger({domains}),spatial=new PersistentSpatialAtlas({domains,knowledge,gmProvider,writer,worldTimeProvider:()=>state.time}),providers=new EffectProviderRegistry(),journal=new MemoryOperationJournal();
 for(const provider of createNarrativeCapabilityProviders({repository,domains,gmProvider}))providers.register(provider);providers.register(createSpatialRegionProvider({service:spatial,domains,gmProvider}));let sequence=0;
 const apply=async(id,payload)=>{const n=++sequence;return providers.get(id).apply({scope:'world',expectedRevision:null,...payload},{operationId:`ep:operation:spatial_seed_${n}`,sourceEventId:`ep:event:spatial_seed_${n}`});};
 const receipt=async(key,label,observerId=spatialIds.observer)=>{const claimId=`ep:claim:spatial_${key}`,publicId=`ep:known:spatial_${key}`;await knowledge.createClaim({claimId,publicId,publicText:label,canonicalTruth:`Private truth ${key}`,sourceEventId:`ep:event:spatial_claim_${key}`});return knowledge.recordDisclosure({claimId,observerId,sourceEventId:`ep:event:spatial_disclose_${key}`,sourceId:'ep:source:spatial_001',stance:'believed'});};
 const view={scope:'world',atlasId:spatialIds.atlas,regionId:spatialIds.region,observerId:spatialIds.observer,discoveries:[],routeKnowledge:[],correctionIds:[],sourceEventId:'ep:event:spatial_view_001'},receipts={};
 if(seed){for(const [key,name,kind]of [['region','Northern coast','region'],['dock','Harbor','site'],['tower','Old watchtower','region'],['secret','SECRET LAIR','site']])await apply('narrative.location-place',{locationId:spatialIds[key],name,kind,...(key==='region'?{}:{parentLocationId:spatialIds.region})});
  await apply('narrative.location-route',{routeId:spatialIds.road,fromLocationId:spatialIds.dock,toLocationId:spatialIds.tower,status:'open'});await apply('narrative.location-route',{routeId:spatialIds.secretRoad,fromLocationId:spatialIds.tower,toLocationId:spatialIds.secret,status:'open'});
  for(const [key,label]of [['region','Known coast'],['dock','Public harbor'],['tower','Seen tower']]){const discoveryId=`ep:discovery:spatial_${key}`;await apply('narrative.location-discovery',{discoveryId,locationId:spatialIds[key],observerId:spatialIds.observer,status:'discovered'});receipts[key]=await receipt(key,label);view.discoveries.push({discoveryId,receiptId:receipts[key].id});}
  await apply('narrative.location-discovery',{discoveryId:'ep:discovery:secret_other',locationId:spatialIds.secret,observerId:spatialIds.other,status:'discovered'});
  for(const [key,label]of [['road','Coastal road'],['secretRoad','Rumored passage']]){receipts[key]=await receipt(key,label);view.routeKnowledge.push({routeId:spatialIds[key],receiptId:receipts[key].id});}
  await spatial.saveRegion({scope:'world',regionId:spatialIds.region,locationIds:[spatialIds.dock,spatialIds.tower,spatialIds.secret],routeIds:[spatialIds.road,spatialIds.secretRoad],sourceEventId:'ep:event:spatial_manifest_001'});await spatial.saveView(view);
 }
 return {repository,user,state,gmProvider,writer,domains,knowledge,spatial,providers,journal,apply,receipt,view,receipts};
}
