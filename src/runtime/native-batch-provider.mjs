import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject,clone} from '../contracts/record.mjs';
export const NATIVE_BATCH_PROVIDER='narrative.execute-ordered-native-batch';
export function validateNativeBatchPayload(input){
 assertPlainObject(input,'NATIVE_BATCH_PAYLOAD');if(Object.keys(input).sort().join(',')!=='batchFingerprint,batchId,expectedBatchRevision,scope'||!/^[a-z][a-z0-9-]{0,45}$/.test(input.scope??'')||!Number.isSafeInteger(input.expectedBatchRevision)||input.expectedBatchRevision<1||!/^[a-f0-9]{64}$/.test(input.batchFingerprint??''))throw new EasyPlotsError('NATIVE_BATCH_PAYLOAD','Exact immutable batch identity, revision and fingerprint required');assertNarrativeId(input.batchId);return clone(input);
}
export function createNativeBatchProvider({service}={}){if(!service?.execute||!service?.verify)throw new EasyPlotsError('NATIVE_BATCH_DEPENDENCY','Protected ordered batch service required');return Object.freeze({id:NATIVE_BATCH_PROVIDER,version:'1.0.0',validate:validateNativeBatchPayload,apply:(payload,ctx)=>service.execute(payload,ctx),verify:(payload,ctx)=>service.verify(payload,ctx),confirmOriginal:(payload,ctx,review)=>service.confirmOriginal(payload,ctx,review)});}
