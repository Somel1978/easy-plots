/** Native world documents are broadcast by Foundry. Keep their body opaque;
 * the authenticated targeted transport distributes keys separately.
 * This is AES-256-GCM via WebCrypto, never a custom cipher or hash substitute.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {validatePublicationView} from '../contracts/private-publication.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export const PUBLICATION_ENVELOPE_VERSION=1;
export const PUBLICATION_BLOCK_BYTES=8192;
const encode=new TextEncoder(),decode=new TextDecoder('utf-8',{fatal:true});
const ref=value=>{
 if(!value||!['ChatMessage','JournalEntry'].includes(value.nativeKind)||typeof value.nativeId!=='string'||!/^[A-Za-z0-9]{16}$/.test(value.nativeId))fail('PUBLICATION_REFERENCE','Exact supported native document reference required');
 return {nativeKind:value.nativeKind,nativeId:value.nativeId};
};
export function requirePublicationCrypto(engine=globalThis.crypto){
 if(typeof engine?.getRandomValues!=='function'||['generateKey','exportKey','importKey','encrypt','decrypt'].some(k=>typeof engine?.subtle?.[k]!=='function'))fail('PUBLICATION_CRYPTO_UNAVAILABLE','Protected native publications require WebCrypto in HTTPS or localhost');return engine;
}
const base64=bytes=>btoa(String.fromCharCode(...bytes));
function fromBase64(value,size){
 if(typeof value!=='string'||value.length!==4*Math.ceil(size/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))fail('PUBLICATION_ENVELOPE','Invalid bounded encrypted envelope');
 let result;try{result=Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch{fail('PUBLICATION_ENVELOPE','Invalid encrypted envelope encoding');}
 if(result.length!==size||base64(result)!==value)fail('PUBLICATION_ENVELOPE','Encrypted envelope has a noncanonical size or encoding');return result;
}
export function randomPublicationNativeId(){
 const engine=requirePublicationCrypto(),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';let id='';
 // Rejection sampling avoids modulo bias. Native IDs carry no source IDs.
 for(let round=0;round<4&&id.length<16;round++)for(const byte of engine.getRandomValues(new Uint8Array(32))){if(byte<248)id+=alphabet[byte%62];if(id.length===16)break;}
 if(id.length!==16)fail('PUBLICATION_RANDOM_SOURCE','Secure native identifier generation failed');return id;
}
export function validatePublicationEnvelope(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['version','token','nonce','ciphertext'].includes(k))||value.version!==PUBLICATION_ENVELOPE_VERSION||typeof value.token!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(value.token))fail('PUBLICATION_ENVELOPE','Unsupported encrypted native publication contract');
 fromBase64(value.nonce,12);fromBase64(value.ciphertext,PUBLICATION_BLOCK_BYTES+16);return {...value};
}
const additionalData=(reference,token)=>encode.encode(`easy-plots:private-publication:v1|${reference.nativeKind}|${reference.nativeId}|${token}`);
export async function sealPublication(view,reference){
 view=validatePublicationView(view);reference=ref(reference);const engine=requirePublicationCrypto(),token=secureUUID();
 const json=encode.encode(JSON.stringify(view)),block=engine.getRandomValues(new Uint8Array(PUBLICATION_BLOCK_BYTES));new DataView(block.buffer).setUint32(0,json.length);block.set(json,4);
 const key=await engine.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']),nonce=engine.getRandomValues(new Uint8Array(12));
 const ciphertext=await engine.subtle.encrypt({name:'AES-GCM',iv:nonce,tagLength:128,additionalData:additionalData(reference,token)},key,block),raw=await engine.subtle.exportKey('raw',key);
 // Only envelope may enter a native Document. key belongs in protected storage
 // and in a recipient-authenticated, explicitly targeted key reply.
 return {envelope:{version:PUBLICATION_ENVELOPE_VERSION,token,nonce:base64(nonce),ciphertext:base64(new Uint8Array(ciphertext))},key:base64(new Uint8Array(raw))};
}
export async function openPublication(envelope,key,reference){
 envelope=validatePublicationEnvelope(envelope);reference=ref(reference);const engine=requirePublicationCrypto(),raw=fromBase64(key,32);
 try{
  const imported=await engine.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['decrypt']),bytes=new Uint8Array(await engine.subtle.decrypt({name:'AES-GCM',iv:fromBase64(envelope.nonce,12),tagLength:128,additionalData:additionalData(reference,envelope.token)},imported,fromBase64(envelope.ciphertext,PUBLICATION_BLOCK_BYTES+16)));
  const length=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0);if(length<1||length>6000||length+4>bytes.length)fail('PUBLICATION_DECRYPTION','Protected content is unavailable');
  return validatePublicationView(JSON.parse(decode.decode(bytes.subarray(4,length+4))));
 }catch{fail('PUBLICATION_DECRYPTION','Protected content is unavailable');}
}
