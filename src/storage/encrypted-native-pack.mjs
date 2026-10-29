/** Ciphertext-only native JournalEntry storage; unlocked keys live only here. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const wrappers=new WeakSet(),NS='easy-plots',FLAG='storage',TITLE='Easy Plots vault';
const BLOCK=32768,INLINE=24000,PART=16384,MAX_VALUE=65536,ITERATIONS=310000;
const utf8=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const nativeId=id=>{if(typeof id!=='string'||!/^[A-Za-z0-9]{16}$/.test(id))fail('VAULT_NATIVE_ID','An exact opaque native document ID is required');return id;};
const b64=bytes=>btoa(String.fromCharCode(...bytes));
function unb64(value,length){
 if(typeof value!=='string'||value.length!==Math.ceil(length/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))fail('VAULT_ENVELOPE','Invalid encrypted native envelope');
 let bytes;try{bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch{fail('VAULT_ENVELOPE','Invalid encrypted native envelope');}
 if(bytes.length!==length||b64(bytes)!==value)fail('VAULT_ENVELOPE','Noncanonical encrypted native envelope');return bytes;
}
function envelope(value){
 if(!value||Object.keys(value).sort().join(',')!=='ciphertext,iv,vault'||value.vault!==1)fail('VAULT_ENVELOPE','Native vault document must contain only its encrypted envelope');
 unb64(value.iv,12);unb64(value.ciphertext,BLOCK+16);return value;
}
export function isEncryptedNativePack(pack){return wrappers.has(pack);}
export async function unlockEncryptedPack({pack,gameInstance,passphrase,salt,worldId}={}){
 const engine=globalThis.crypto,userId=gameInstance?.user?.id;
 if(typeof engine?.getRandomValues!=='function'||['importKey','deriveKey','encrypt','decrypt','digest'].some(name=>typeof engine?.subtle?.[name]!=='function'))fail('VAULT_CRYPTO_UNAVAILABLE','Encrypted native storage requires WebCrypto in HTTPS or localhost');
 const authority=()=>{
  if(gameInstance?.user?.isGM!==true||gameInstance.user.active===false||gameInstance.user.id!==userId||typeof worldId!=='string'||!worldId||gameInstance.world?.id!==worldId)fail('VAULT_GM_REQUIRED','Current GM session and exact world are required to unlock or use this vault');
  if(pack.locked)fail('VAULT_PACK_LOCKED','Native vault pack is locked');
 };
 authority();
 if(wrappers.has(pack)||pack?.documentName!=='JournalEntry'||pack?.metadata?.packageType!=='world'||typeof pack.collection!=='string'||!pack.collection||pack.collection.length>180||typeof pack.getDocuments!=='function'||typeof pack.documentClass?.createDocuments!=='function'||typeof pack.getUserLevel!=='function')fail('VAULT_PACK','An unlocked native world JournalEntry pack with exact document APIs is required');
 if(typeof passphrase!=='string'||passphrase.length<12||passphrase.length>1024||typeof salt!=='string'||!/^[a-fA-F0-9]{32}$/.test(salt))fail('VAULT_PASSPHRASE','An explicit passphrase of 12–1024 characters and a public random 16-byte hexadecimal salt are required');
 const password=utf8.encode(passphrase),saltBytes=Uint8Array.from(salt.match(/../g),hex=>parseInt(hex,16));let key;
 try{
  const material=await engine.subtle.importKey('raw',password,'PBKDF2',false,['deriveKey']);authority();
  key=await engine.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:saltBytes,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);authority();
 }finally{password.fill(0);passphrase=null;}
 const aad=id=>utf8.encode(JSON.stringify({vault:1,worldId,packId:pack.collection,documentId:nativeId(id)}));
 const digest=async bytes=>{authority();const result=await engine.subtle.digest('SHA-256',bytes);authority();return [...new Uint8Array(result)].map(b=>b.toString(16).padStart(2,'0')).join('');};
 const randomId=()=>[...engine.getRandomValues(new Uint8Array(8))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const seal=async(id,value)=>{
  authority();const encoded=utf8.encode(JSON.stringify(value));if(encoded.length>BLOCK-4)fail('VAULT_FRAME_BUDGET','Encrypted frame exceeds its fixed padded budget');
  const frame=new Uint8Array(BLOCK);new DataView(frame.buffer).setUint32(0,encoded.length);frame.set(encoded,4);const iv=engine.getRandomValues(new Uint8Array(12));
  const encrypted=await engine.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(id),tagLength:128},key,frame);authority();frame.fill(0);
  const result={vault:1,iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))};if(utf8.encode(JSON.stringify(result)).length>=65536)fail('VAULT_ENVELOPE_BUDGET','Ciphertext envelope exceeds the native record budget');return result;
 };
 const open=async(id,raw)=>{
  authority();const e=envelope(raw);let result;
  try{result=await engine.subtle.decrypt({name:'AES-GCM',iv:unb64(e.iv,12),additionalData:aad(id),tagLength:128},key,unb64(e.ciphertext,BLOCK+16));}
  catch{authority();fail('VAULT_DECRYPT_FAILED','Vault password, document authentication or encrypted content could not be verified');}
  authority();const frame=new Uint8Array(result);if(frame.length!==BLOCK)fail('VAULT_FRAME','Invalid padded vault frame');const length=new DataView(frame.buffer).getUint32(0);
  if(length<1||length>BLOCK-4)fail('VAULT_FRAME','Invalid padded vault frame');let value;
  try{value=JSON.parse(decoder.decode(frame.subarray(4,4+length)));}catch{fail('VAULT_FRAME','Invalid encrypted JSON frame');}finally{frame.fill(0);}return value;
 };
 const readNativeDocument=async id=>{
  authority();nativeId(id);const documents=await pack.getDocuments({_id:id});authority();
  if(!Array.isArray(documents)||documents.length>1||documents.some(doc=>(doc.id??doc._id)!==id))fail('VAULT_NATIVE_QUERY','Native vault reads require one exact document, without scans');return documents[0]??null;
 };
 const rawEnvelope=doc=>envelope(doc?.getFlag?.(NS,FLAG)??doc?.flags?.[NS]?.[FLAG]);
 const decode=async(id,doc)=>{
  const root=await open(id,rawEnvelope(doc));
  if(root?.kind==='inline'&&Object.keys(root).sort().join(',')==='kind,value')return root.value;
  if(root?.kind!=='manifest'||Object.keys(root).sort().join(',')!=='byteLength,digest,kind,nonce,parts'||typeof root.nonce!=='string'||!/^[a-f0-9]{32}$/.test(root.nonce)||!Number.isSafeInteger(root.byteLength)||root.byteLength<=INLINE||root.byteLength>MAX_VALUE||!Array.isArray(root.parts)||root.parts.length!==Math.ceil(root.byteLength/PART)||root.parts.length>4||new Set(root.parts.map(p=>p?.id)).size!==root.parts.length||!/^[a-f0-9]{64}$/.test(root.digest??''))fail('VAULT_MANIFEST','Invalid private encrypted record manifest');
  const bytes=new Uint8Array(root.byteLength);let offset=0;
  for(let index=0;index<root.parts.length;index++){
   const ref=root.parts[index];if(!ref||Object.keys(ref).sort().join(',')!=='digest,id,index'||ref.index!==index||ref.id===id||!/^[a-f0-9]{64}$/.test(ref.digest??''))fail('VAULT_MANIFEST','Invalid private chunk reference');nativeId(ref.id);
   const stored=await readNativeDocument(ref.id);if(!stored)fail('VAULT_CHUNK_MISSING','An authenticated encrypted record chunk is unavailable');const part=await open(ref.id,rawEnvelope(stored)),size=Math.min(PART,root.byteLength-offset);
   if(part?.kind!=='part'||Object.keys(part).sort().join(',')!=='bytes,count,digest,index,kind,nonce,ownerId'||part.ownerId!==id||part.nonce!==root.nonce||part.index!==index||part.count!==root.parts.length||part.digest!==ref.digest)fail('VAULT_CHUNK','Encrypted chunk does not belong to this exact immutable record');
   const block=unb64(part.bytes,size);if(await digest(block)!==ref.digest)fail('VAULT_CHUNK','Encrypted chunk digest differs');bytes.set(block,offset);offset+=block.length;
  }
  if(await digest(bytes)!==root.digest)fail('VAULT_CHUNK','Encrypted record digest differs');try{return JSON.parse(decoder.decode(bytes));}catch{fail('VAULT_VALUE','Invalid reconstructed encrypted record');}finally{bytes.fill(0);}
 };
 const createRaw=async(id,encrypted)=>{
  authority();if(await readNativeDocument(id))fail('VAULT_NATIVE_COLLISION','Encrypted native document identity already exists');
  const result=await pack.documentClass.createDocuments([{_id:id,name:TITLE,ownership:{default:0},pages:[],flags:{[NS]:{[FLAG]:encrypted}}}],{pack:pack.collection,keepId:true});authority();
  if(!Array.isArray(result)||result.length!==1)fail('VAULT_WRITE_UNCERTAIN','Encrypted native creation was not acknowledged');
  const confirmed=await readNativeDocument(id);if(!confirmed||JSON.stringify(rawEnvelope(confirmed))!==JSON.stringify(encrypted))fail('VAULT_WRITE_UNCERTAIN','Encrypted native creation was not confirmed');return confirmed;
 };
 let virtual;
 const write=async(id,value,{create=false,expected=null}={})=>{
  authority();let json;try{json=JSON.stringify(value);}catch{fail('VAULT_VALUE','Native vault values must be JSON data');}
  if(typeof json!=='string')fail('VAULT_VALUE','Native vault values must be JSON data');const bytes=utf8.encode(json);if(bytes.length>MAX_VALUE)fail('VAULT_VALUE_BUDGET','Native vault value exceeds the supported 65536-byte record budget');
  const before=await readNativeDocument(id);if(create?before!==null:before===null||JSON.stringify(rawEnvelope(before))!==JSON.stringify(expected))fail('VAULT_WRITE_CONFLICT','Native vault root changed before the write');let body;
  if(bytes.length<=INLINE)body={kind:'inline',value:JSON.parse(json)};
  else{
   const nonce=randomId()+randomId(),count=Math.ceil(bytes.length/PART),parts=[];
   for(let index=0;index<count;index++){
    const partId=randomId(),block=bytes.subarray(index*PART,Math.min(bytes.length,(index+1)*PART)),hash=await digest(block),part={kind:'part',ownerId:id,nonce,index,count,digest:hash,bytes:b64(block)},encrypted=await seal(partId,part);
    const created=await createRaw(partId,encrypted);if(JSON.stringify(await open(partId,rawEnvelope(created)))!==JSON.stringify(part))fail('VAULT_WRITE_UNCERTAIN','Immutable encrypted chunk was not authenticated');parts.push({id:partId,index,digest:hash});
   }
   body={kind:'manifest',nonce,byteLength:bytes.length,digest:await digest(bytes),parts};
  }
  const encrypted=await seal(id,body),current=await readNativeDocument(id);if(create?current!==null:current===null||JSON.stringify(rawEnvelope(current))!==JSON.stringify(expected))fail('VAULT_WRITE_CONFLICT','Native vault root changed while preparing immutable chunks');
  if(create)await createRaw(id,encrypted);
  else{if(typeof current.update!=='function')fail('VAULT_NATIVE_API','Native JournalEntry update API is required');await current.update({name:TITLE,ownership:{default:0},pages:[],[`flags.${NS}.${FLAG}`]:encrypted});authority();}
  const confirmed=await readNativeDocument(id);if(!confirmed||JSON.stringify(rawEnvelope(confirmed))!==JSON.stringify(encrypted)||JSON.stringify(await decode(id,confirmed))!==json)fail('VAULT_WRITE_UNCERTAIN','Encrypted native record was not read back exactly');authority();return virtual(id,confirmed,JSON.parse(json));
 };
 virtual=(id,raw,value)=>{
  const expected=structuredClone(rawEnvelope(raw));
  return Object.freeze({id,_id:id,documentName:'JournalEntry',name:TITLE,ownership:Object.freeze({default:0}),
   getFlag(namespace,keyName){authority();return namespace===NS&&keyName===FLAG?structuredClone(value):undefined;},
   async update(change){authority();if(!change||Object.keys(change).join(',')!==`flags.${NS}.${FLAG}`)fail('VAULT_UPDATE','Only the native storage value can be updated through the vault');return write(id,structuredClone(change[`flags.${NS}.${FLAG}`]),{expected});}});
 };
 const wrapper=Object.freeze({collection:pack.collection,documentName:'JournalEntry',metadata:Object.freeze({...pack.metadata}),get locked(){return pack.locked;},
  getUserLevel(user){authority();return pack.getUserLevel(user);},
  async getDocuments(query){authority();if(!query||Object.keys(query).join(',')!=='_id')fail('VAULT_NATIVE_QUERY','An exact native document ID query is required');const id=nativeId(query._id),doc=await readNativeDocument(id);return doc?[virtual(id,doc,await decode(id,doc))]:[];},
  documentClass:Object.freeze({async createDocuments(data,options){authority();if(!Array.isArray(data)||data.length!==1||options?.pack!==pack.collection||options.keepId!==true||Object.keys(options).some(k=>!['pack','keepId'].includes(k)))fail('VAULT_CREATE','Create one exact native storage document with keepId');const entry=structuredClone(data[0]);nativeId(entry?._id);if(!entry.flags?.[NS]||Object.keys(entry.flags).join(',')!==NS||Object.keys(entry.flags[NS]).join(',')!==FLAG)fail('VAULT_CREATE','Only encrypted native storage can be created');return [await write(entry._id,entry.flags[NS][FLAG],{create:true})];}})});
 authority();wrappers.add(wrapper);return wrapper;
}
