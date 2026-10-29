/** Explicitly approved narrative corrections; never an undo of native effects. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export function validateDomainCorrection(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['type','scope','id','expectedRevision','targetRevision','reason'].includes(k)))fail('CORRECTION_CONTRACT','A bounded typed correction contract is required');
 if(!['world-fact','objective','relationship','observer-belief'].includes(p.type)||typeof p.scope!=='string'||!/^[a-z][a-z0-9-]{0,48}$/.test(p.scope))fail('CORRECTION_TYPE','Unsupported correction scope/type');
 assertNarrativeId(p.id);
 if(!Number.isSafeInteger(p.expectedRevision)||p.expectedRevision<2||!Number.isSafeInteger(p.targetRevision)||p.targetRevision<1||p.targetRevision>=p.expectedRevision||typeof p.reason!=='string'||!p.reason.trim()||p.reason.length>500)fail('CORRECTION_CONTRACT','Reviewed current revision, older target and reason required');
 return p;
}
export function createDomainCorrectionProvider({domains,gmProvider}={}){
 if(typeof domains?.restoreRevision!=='function'||typeof gmProvider!=='function')fail('CORRECTION_DEPENDENCY','Protected revisioned domain service required');
 const gm=()=>assertLocalGM(gmProvider());
 return Object.freeze({id:'narrative.restore-domain-revision',version:'1.0.0',validate:validateDomainCorrection,
  async get(payload){gm();const p=validateDomainCorrection(payload);return domains.read(p.type,p.scope,p.id);},
  async apply(payload,ctx){
   gm();const p=validateDomainCorrection(payload),row=await domains.read(p.type,p.scope,p.id),hash=await sha256Hex(JSON.stringify(p));
   if(row?.effectReceipt?.operationId===ctx?.operationId){
    if(row.effectReceipt.sourceEventId!==ctx?.sourceEventId||row.effectReceipt.payloadDigest!==hash)fail('OPERATION_CONFLICT','Corrective operation identity was reused');
    return {recordId:row.id,revision:row.revision,alreadyApplied:true};
   }
   const saved=await domains.restoreRevision(p,ctx);return {recordId:saved.id,revision:saved.revision};
  },
  async verify(payload,ctx){
   gm();const p=validateDomainCorrection(payload),row=await domains.read(p.type,p.scope,p.id);
   return Boolean(row?.effectReceipt?.operationId===ctx?.operationId&&row.effectReceipt.sourceEventId===ctx?.sourceEventId&&
    row.effectReceipt.payloadDigest===await sha256Hex(JSON.stringify(p))&&row.correctionReceipt?.targetRevision===p.targetRevision);
  }
 });
}
