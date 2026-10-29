/** Foundry broadcasts native world Document data. Native publications therefore
 * contain a generic public shell and fixed-size ciphertext, never private text,
 * source IDs, audience IDs or keys. Keys use a separate authenticated transport.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {sealPublication,validatePublicationEnvelope,randomPublicationNativeId,requirePublicationCrypto} from '../security/publication-envelope.mjs';
const MODULE='easy-plots',FLAG='publicationEnvelope',TITLE='Easy Plots',BODY='<p>Protected Easy Plots content. Open with Easy Plots.</p>';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const hash=value=>sha256Hex(JSON.stringify(value));
const nativeReference=p=>{if(!p||!['ChatMessage','JournalEntry'].includes(p.nativeKind)||typeof p.nativeId!=='string'||!/^[A-Za-z0-9]{16}$/.test(p.nativeId))fail('PUBLICATION_REFERENCE','Exact native publication reference required');return {nativeKind:p.nativeKind,nativeId:p.nativeId};};
const envelopeId=async(scope,id)=>`ep:publication-envelope:${(await hash({scope,id})).slice(0,28)}`;
const locatorId=async reference=>`ep:publication-locator:${(await hash(nativeReference(reference))).slice(0,28)}`;
export function validateNativePublicationPayload(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['scope','publicationId','expectedPublicationRevision'].includes(k))||typeof p.scope!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(p.scope)||!Number.isSafeInteger(p.expectedPublicationRevision)||p.expectedPublicationRevision<1)fail('PUBLICATION_PAYLOAD','Reviewed publication identity and exact revision required');
 assertNarrativeId(p.publicationId);return clone(p);
}
export class ProtectedNativePublications {
 #domains;#plans;#gmProvider;#writer;#game;#authorize;#observer;
 constructor({domains,plans,gmProvider,writer,gameInstance,actorAuthorization,resolveObserver}={}){
  if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||typeof plans?.forExecution!=='function'||typeof plans?.read!=='function'||typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function'||typeof actorAuthorization!=='function'||typeof resolveObserver!=='function')fail('PUBLICATION_DEPENDENCY','Protected publication plans, authority and native Actor mapping required');
  this.#domains=domains;this.#plans=plans;this.#gmProvider=gmProvider;this.#writer=writer;this.#game=gameInstance;this.#authorize=actorAuthorization;this.#observer=resolveObserver;
 }
 #gm(lease=this.#gmProvider()){
  assertLocalGM(lease);this.#writer.assertEligible(lease);
  if(this.#game?.user?.isGM!==true||this.#game.user.id!==lease.userId||this.#game.world?.id!==lease.worldId)fail('PUBLICATION_AUTHORITY','Current native GM and world must match the verified context');return lease;
 }
 #collection(kind){return kind==='ChatMessage'?this.#game?.messages:this.#game?.journal;}
 get availableKinds(){return ['ChatMessage','JournalEntry'].filter(kind=>{const c=this.#collection(kind);return typeof c?.get==='function'&&typeof c?.documentClass?.createDocuments==='function';});}
 async #read(scope,id){
  this.#gm();const row=await this.#domains.read('native-publication-envelope',scope,id);if(!row)return null;
  const {state,acknowledgement,bodyDigest,...body}=row.data??{};
  if(!['prepared','ready'].includes(state)||bodyDigest!==await hash(body))fail('PUBLICATION_CORRUPT','Protected encrypted publication differs from its captured fingerprint');
  nativeReference(body);validatePublicationEnvelope(body.envelope);this.#gm();return row;
 }
 #document(row){const c=this.#collection(row.data.nativeKind);if(typeof c?.get!=='function')fail('PUBLICATION_NATIVE_UNAVAILABLE','Native publication collection is unavailable');return c.get(row.data.nativeId);}
 #confirms(row){
  const doc=this.#document(row),d=row.data;if(!doc||doc.id!==d.nativeId||doc.documentName!==d.nativeKind||typeof doc.toObject!=='function'||typeof doc.getFlag!=='function')return false;
  let envelope;try{envelope=validatePublicationEnvelope(doc.getFlag(MODULE,FLAG));}catch{return false;}
  if(['version','token','nonce','ciphertext'].some(k=>envelope[k]!==d.envelope[k]))return false;
  const raw=doc.toObject();
  if(d.nativeKind==='ChatMessage')return raw.author===d.authorId&&raw.content===BODY&&raw.style===1&&raw.blind===false&&Array.isArray(raw.whisper)&&raw.whisper.length===0&&Array.isArray(raw.rolls)&&raw.rolls.length===0&&!raw.speaker?.actor&&!raw.speaker?.token&&!raw.speaker?.scene;
  const page=raw.pages?.[0];return raw.name===TITLE&&raw.ownership?.default===2&&Object.keys(raw.ownership).length===1&&raw.pages?.length===1&&page._id===d.pageId&&page.name==='Protected content'&&page.type==='text'&&page.text?.content===BODY&&page.text.format===1&&page.ownership?.default===-1&&Object.keys(page.ownership).length===1;
 }
 #nativeData(row){
  const d=row.data,flags={[MODULE]:{[FLAG]:clone(d.envelope)}};
  if(d.nativeKind==='ChatMessage')return {_id:d.nativeId,type:'base',author:d.authorId,style:1,content:BODY,speaker:{alias:'Easy Plots',actor:null,token:null,scene:null},whisper:[],blind:false,rolls:[],flags};
  return {_id:d.nativeId,name:TITLE,ownership:{default:2},pages:[{_id:d.pageId,name:'Protected content',type:'text',text:{content:BODY,format:1},ownership:{default:-1}}],flags};
 }
 async inspect({scope='world',publicationId}={}){
  this.#gm();assertNarrativeId(publicationId);const row=await this.#read(scope,await envelopeId(scope,publicationId));if(!row)return null;
  return {id:row.id,revision:row.revision,state:row.data.state,nativeKind:row.data.nativeKind,nativeId:row.data.nativeId,operationId:row.data.operationId,sourceEventId:row.data.sourceEventId,nativeConfirmed:this.#confirms(row)};
 }
 async #stageLocator(scope,row){
  const id=await locatorId(row.data),body={nativeKind:row.data.nativeKind,nativeId:row.data.nativeId,sourceScope:scope,envelopeId:row.id,publicationId:row.data.publicationId},old=await this.#domains.read('native-publication-locator','world',id);
  if(old){if(JSON.stringify(old.data)!==JSON.stringify(body))fail('PUBLICATION_LOCATOR_CONFLICT','Native publication reference already has different protected provenance');return;}
  await this.#domains.save({type:'native-publication-locator',scope:'world',id,sourceEventId:row.data.sourceEventId,data:body});
  const confirmed=await this.#domains.read('native-publication-locator','world',id);if(!confirmed||JSON.stringify(confirmed.data)!==JSON.stringify(body))fail('PUBLICATION_LOCATOR_UNCERTAIN','Native publication locator was not durably verified');
 }
 async apply(payload,context){
  const p=validateNativePublicationPayload(payload),ctx={operationId:context?.operationId,sourceEventId:context?.sourceEventId},lease=this.#gm();
  if(!/^ep:operation:[A-Za-z0-9_:-]{6,200}$/.test(ctx.operationId??'')||!/^ep:event:[A-Za-z0-9_-]{8,120}$/.test(ctx.sourceEventId??''))fail('PUBLICATION_PROVENANCE','Approved journal operation and canonical event required');
  const id=await envelopeId(p.scope,p.publicationId),old=await this.#read(p.scope,id);
  if(old){
   if(old.data.operationId===ctx.operationId&&old.data.sourceEventId===ctx.sourceEventId&&old.data.planRevision===p.expectedPublicationRevision&&old.data.state==='ready'&&this.#confirms(old))return {alreadyApplied:true,nativeKind:old.data.nativeKind,nativeId:old.data.nativeId};
   fail('PUBLICATION_RECONCILIATION_REQUIRED','An earlier native publication requires explicit verified reconciliation; do not recreate it');
  }
  const plan=await this.#plans.forExecution({scope:p.scope,id:p.publicationId,expectedRevision:p.expectedPublicationRevision}),kind=plan.data.nativeKind,collection=this.#collection(kind);
  if(!this.availableKinds.includes(kind))fail('PUBLICATION_NATIVE_UNAVAILABLE','Native creation capability is unavailable for this channel');
  requirePublicationCrypto();const nativeId=randomPublicationNativeId();if(collection.get(nativeId))fail('PUBLICATION_NATIVE_COLLISION','Native ID already exists');
  const sealed=await sealPublication(plan.data.view,{nativeKind:kind,nativeId}),body={nativeKind:kind,nativeId,pageId:kind==='JournalEntry'?randomPublicationNativeId():null,publicationId:p.publicationId,planRevision:plan.revision,planBodyDigest:plan.data.bodyDigest,authorId:lease.userId,...ctx,envelope:sealed.envelope,key:sealed.key};
  this.#gm(lease);await this.#plans.forExecution({scope:p.scope,id:p.publicationId,expectedRevision:p.expectedPublicationRevision});
  await this.#domains.save({type:'native-publication-envelope',scope:p.scope,id,sourceEventId:ctx.sourceEventId,data:{state:'prepared',...body,bodyDigest:await hash(body)}});
  const prepared=await this.#read(p.scope,id);if(!prepared)fail('PUBLICATION_PREPARE_UNCERTAIN','Protected encrypted intent could not be read back');
  await this.#stageLocator(p.scope,prepared);await this.#plans.forExecution({scope:p.scope,id:p.publicationId,expectedRevision:p.expectedPublicationRevision});this.#gm(lease);
  try{
   const created=await collection.documentClass.createDocuments([this.#nativeData(prepared)],{keepId:true});
   if(!Array.isArray(created)||created.length!==1||!this.#confirms(prepared))fail('PUBLICATION_NATIVE_UNCERTAIN','Native encrypted document was not verified');
   this.#gm(lease);await this.#domains.save({type:'native-publication-envelope',scope:p.scope,id,expectedRevision:prepared.revision,sourceEventId:ctx.sourceEventId,data:{...prepared.data,state:'ready'}});
   const ready=await this.#read(p.scope,id);if(ready?.data.state!=='ready')fail('PUBLICATION_NATIVE_UNCERTAIN','Native publication acknowledgement was not verified');
   return {alreadyApplied:false,nativeKind:kind,nativeId};
  }catch(error){throw new EasyPlotsError('PUBLICATION_RECONCILIATION_REQUIRED','Native publication may exist; verify the original document before recovery',{reason:error.code??'UNKNOWN'});}
 }
 async verify(payload,context){
  const p=validateNativePublicationPayload(payload),row=await this.#read(p.scope,await envelopeId(p.scope,p.publicationId));
  return Boolean(row&&row.data.state==='ready'&&row.data.planRevision===p.expectedPublicationRevision&&row.data.operationId===context?.operationId&&row.data.sourceEventId===context?.sourceEventId&&this.#confirms(row));
 }
 async confirm({scope='world',publicationId,expectedEnvelopeRevision,reviewEventId}={}){
  this.#gm();assertNarrativeId(reviewEventId);const row=await this.#read(scope,await envelopeId(scope,publicationId));
  if(!row||row.revision!==expectedEnvelopeRevision)fail('REVISION_CONFLICT','Encrypted publication changed before reconciliation');
  if(row.data.state!=='prepared'||!this.#confirms(row))fail('PUBLICATION_RECONCILIATION_REQUIRED','The exact original native document must verify before confirmation');
  await this.#stageLocator(scope,row);this.#gm();await this.#domains.save({type:'native-publication-envelope',scope,id:row.id,expectedRevision:row.revision,sourceEventId:reviewEventId,data:{...row.data,state:'ready',acknowledgement:{reviewEventId}}});
  return {nativeKind:row.data.nativeKind,nativeId:row.data.nativeId,effectsExecuted:0,keysDistributed:0};
 }
 async #lookup(reference){
  reference=nativeReference(reference);this.#gm();const loc=await this.#domains.read('native-publication-locator','world',await locatorId(reference));
  if(!loc||loc.data.nativeKind!==reference.nativeKind||loc.data.nativeId!==reference.nativeId)fail('PUBLICATION_UNAVAILABLE','Protected content is unavailable');
  const row=await this.#read(loc.data.sourceScope,loc.data.envelopeId);
  if(!row||row.data.nativeId!==reference.nativeId||row.data.nativeKind!==reference.nativeKind||row.data.publicationId!==loc.data.publicationId||row.data.state!=='ready'||!this.#confirms(row))fail('PUBLICATION_UNAVAILABLE','Protected content is unavailable');
  const plan=await this.#plans.read({scope:row.scope,id:row.data.publicationId});
  if(!plan||plan.data.state!=='approved'||plan.revision!==row.data.planRevision||plan.data.bodyDigest!==row.data.planBodyDigest)fail('PUBLICATION_UNAVAILABLE','Protected content is unavailable');
  return {row,plan};
 }
 async #identity({verifiedUserId,actorId}){
  this.#gm();const user=this.#game.users?.get?.(verifiedUserId);
  if(!user||user.isGM||!user.active||typeof actorId!=='string'||actorId.length>160||await this.#authorize(verifiedUserId,actorId)!==true)fail('PUBLICATION_UNAVAILABLE','Protected content is unavailable');
  const observer=await this.#observer({verifiedUserId,actorId});assertNarrativeId(observer);this.#gm();return observer;
 }
 async keyForPlayer({nativeKind,nativeId,verifiedUserId,actorId}={}){
  if(this.#game.users?.get?.(verifiedUserId)?.isGM)fail('PUBLICATION_UNAVAILABLE','Protected content is unavailable');
  return this.keyForUser({nativeKind,nativeId,verifiedUserId,actorId});
 }
 async keyForUser({nativeKind,nativeId,verifiedUserId,actorId}={}){
  requirePublicationCrypto();
  this.#gm();const user=this.#game.users?.get?.(verifiedUserId);if(!user?.active)fail('PUBLICATION_UNAVAILABLE','Protected content is unavailable');const isGM=user.isGM===true;
  const {row,plan}=await this.#lookup({nativeKind,nativeId});
  if(!isGM&&plan.data.audience!=='all-players'){
   if(plan.data.audience==='gm-only')fail('PUBLICATION_UNAVAILABLE','Protected content is unavailable');
   const observer=await this.#identity({verifiedUserId,actorId}),allowed=plan.data.audience==='observer'?plan.data.observerId===observer:plan.data.audience==='observers'&&plan.data.observerIds.includes(observer);
   if(!allowed||await this.#identity({verifiedUserId,actorId})!==observer)fail('PUBLICATION_UNAVAILABLE','Protected content is unavailable');
  }
  this.#gm();const current=this.#game.users?.get?.(verifiedUserId);if(!current?.active||(current.isGM===true)!==isGM)fail('PUBLICATION_UNAVAILABLE','Protected content is unavailable');
  return {nativeKind,nativeId,token:row.data.envelope.token,key:row.data.key};
 }
 async viewForGM(reference){const {plan}=await this.#lookup(reference);this.#gm();return clone(plan.data.view);}
}
export function createProtectedPublicationProvider({service,gmProvider}={}){
 if(typeof service?.apply!=='function'||typeof service?.verify!=='function'||typeof gmProvider!=='function')fail('PUBLICATION_DEPENDENCY','Protected native publication service required');
 return Object.freeze({id:'narrative.publish-known-content',version:'1.0.0',validate:p=>{requirePublicationCrypto();return validateNativePublicationPayload(p);},
  async apply(p,context){assertLocalGM(gmProvider());return service.apply(validateNativePublicationPayload(p),context);},
  async verify(p,context){assertLocalGM(gmProvider());return service.verify(validateNativePublicationPayload(p),context);}
 });
}
