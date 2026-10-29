/** Region indexing is an approved graph effect; it never discovers for anyone. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {validateSpatialRegion} from '../domains/spatial-contract.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export function createSpatialRegionProvider({service,domains,gmProvider}={}){
 if(!service?.saveRegion||!domains?.read||typeof gmProvider!=='function')fail('SPATIAL_DEPENDENCY','Protected spatial service and GM required');
 const authority=()=>assertLocalGM(gmProvider()),digest=p=>sha256Hex(JSON.stringify(p));
 const get=async payload=>{authority();const p=validateSpatialRegion(payload),row=await domains.read('spatial-region',p.scope,p.regionId);authority();return row;};
 return Object.freeze({id:'narrative.location-region',version:'1.0.0',validate:validateSpatialRegion,get,
  async apply(payload,ctx){authority();const p=validateSpatialRegion(payload);if(!/^ep:operation:[A-Za-z0-9_:-]{6,200}$/.test(ctx?.operationId??'')||!/^ep:event:[A-Za-z0-9_-]{8,120}$/.test(ctx?.sourceEventId??''))fail('EFFECT_PROVENANCE','Approved spatial operation and event required');const row=await get(p),payloadDigest=await digest(p);
   if(row?.effectReceipt?.operationId===ctx.operationId){if(row.effectReceipt.sourceEventId!==ctx.sourceEventId||row.effectReceipt.payloadDigest!==payloadDigest)fail('OPERATION_CONFLICT','Spatial operation content differs');return {recordId:row.id,revision:row.revision,alreadyApplied:true};}
   const saved=await service.saveRegion({...p,sourceEventId:ctx.sourceEventId,effectReceipt:{operationId:ctx.operationId,sourceEventId:ctx.sourceEventId,payloadDigest}});return {recordId:saved.id,revision:saved.revision};
  },
  async verify(payload,ctx){const p=validateSpatialRegion(payload),row=await get(p);return Boolean(row&&row.effectReceipt?.operationId===ctx?.operationId&&row.effectReceipt?.sourceEventId===ctx?.sourceEventId&&row.effectReceipt?.payloadDigest===await digest(p)&&JSON.stringify(row.data)===JSON.stringify(p));}
 });
}
