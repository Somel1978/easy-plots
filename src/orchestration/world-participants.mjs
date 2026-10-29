/** Explicit GM bindings between world Actors and protected narrative identities. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const nativeId=id=>{if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(id))fail('PARTICIPANT_ACTOR','Select an exact world Actor ID');return id;};
const world=scope=>{if(scope!=='world')fail('PARTICIPANT_SCOPE','Participant bindings require world scope');};
const identity=row=>({nativeActorId:row.nativeActorId,narrativeActorId:row.narrativeActorId,observerId:row.observerId,scope:row.scope});
function fields(row){
 nativeId(row.nativeActorId);assertNarrativeId(row.narrativeActorId);assertNarrativeId(row.observerId);world(row.scope);
 if(!row.narrativeActorId.startsWith('ep:actor:')||!['active','retired'].includes(row.status))fail('PARTICIPANT_FIELDS','A narrative Actor identity, observer identity and explicit status are required');
}
export async function participantBindingLocator(nativeActorId){
 nativeId(nativeActorId);const hash=await sha256Hex(`native-participant:world:${nativeActorId}`);return {id:`ep:participant:${hash.slice(0,28)}`,partitionId:`native-participants:world:${hash.slice(0,2)}`};
}
export async function participantRefLocator(aliasId){
 assertNarrativeId(aliasId);const hash=await sha256Hex(`native-participant-ref:world:${aliasId}`);return {id:`ep:participant-ref:${hash.slice(0,28)}`,partitionId:`native-participant-refs:world:${hash.slice(0,2)}`};
}
export class WorldParticipants {
 #repo;#gm;#writer;#game;#tail=Promise.resolve();
 constructor({repository,gmProvider,writer,gameInstance}={}){
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function'||typeof gameInstance?.actors?.get!=='function'||typeof gameInstance?.users?.get!=='function')fail('PARTICIPANT_DEPENDENCY','Protected repository, GM writer and actual world Actor/User collections are required');
  this.#repo=repository;this.#gm=gmProvider;this.#writer=writer;this.#game=gameInstance;
 }
 #authority(){const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);return gm;}
 #actor(id){
  nativeId(id);const actor=this.#game.actors.get(id);
  if(!actor||actor.id!==id||actor.isToken===true||actor.parent||typeof actor.testUserPermission!=='function')fail('PARTICIPANT_ACTOR','The selected world Actor is unavailable');return actor;
 }
 #gmActor(id,gmUserId=this.#authority().userId){
  const gm=this.#authority(),user=this.#game.users.get(gmUserId),actor=this.#actor(id);
  if(gm.userId!==gmUserId||!user?.isGM||user.active!==true||actor.testUserPermission(user,'OWNER')!==true)fail('PARTICIPANT_GM_ACTOR','Current GM must own the exact selected world Actor');return actor;
 }
 #playerOwner(id,userId){
  this.#authority();const user=this.#game.users.get(userId),actor=this.#actor(id);
  if(!user||user.active!==true||user.isGM||actor.testUserPermission(user,'OWNER')!==true)fail('PARTICIPANT_OWNER','Authenticated active player must own the selected world Actor');return actor;
 }
 #queue(fn){const result=this.#tail.then(fn,fn);this.#tail=result.then(()=>undefined,()=>undefined);return result;}
 async #stored(loc){
  const gm=this.#authority(),row=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});this.#authority();
  if(typeof this.#repo.indexStatus==='function'){
   const status=await this.#repo.indexStatus(loc.id,{partitionId:loc.partitionId,gm:this.#authority()});this.#authority();
   if(row?status!=='ready':status!==null)fail('PARTICIPANT_INDEX_UNCERTAIN','Participant metadata has an unavailable or unverified protected index');
  }else if(row&&typeof this.#repo.hasReadyIndex==='function'&&!await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:this.#authority()}))fail('PARTICIPANT_INDEX_UNCERTAIN','Participant metadata index requires reconciliation');
  this.#authority();if(row&&(row.id!==loc.id||row.partitionId!==loc.partitionId||!Number.isSafeInteger(row.revision)||row.revision<1))fail('PARTICIPANT_CORRUPT','Participant metadata identity or revision differs');return row;
 }
 async #primary(id){
  const row=await this.#stored(await participantBindingLocator(id));if(!row)return null;fields(row);
  if(row.kind!=='native-participant-binding'||row.nativeActorId!==id||!['prepared','ready'].includes(row.state)||row.identityFingerprint!==await sha256Hex(JSON.stringify(identity(row))))fail('PARTICIPANT_CORRUPT','Participant binding differs from its exact identity');this.#authority();return row;
 }
 async #ref(aliasId){
  const row=await this.#stored(await participantRefLocator(aliasId));if(!row)return null;
  if(row.kind!=='native-participant-ref'||row.aliasId!==aliasId||!['prepared','ready'].includes(row.state)||typeof row.identityFingerprint!=='string')fail('PARTICIPANT_CORRUPT','Participant reverse reference is invalid');nativeId(row.nativeActorId);assertNarrativeId(row.bindingId);return row;
 }
 #matches(ref,row){return ref?.bindingId===row.id&&ref.nativeActorId===row.nativeActorId&&ref.identityFingerprint===row.identityFingerprint;}
 async #ready(id){
  const row=await this.#primary(id);if(!row)return null;if(row.state!=='ready')fail('PARTICIPANT_RECOVERY_REQUIRED','Participant binding is prepared; inspect and explicitly complete its original metadata');
  for(const alias of new Set([row.narrativeActorId,row.observerId])){const ref=await this.#ref(alias);if(ref?.state!=='ready'||!this.#matches(ref,row))fail('PARTICIPANT_BINDING_UNCERTAIN','Participant reverse reference is missing, prepared or inconsistent');}
  const current=await this.#primary(id);if(!current||current.revision!==row.revision||current.state!=='ready'||current.identityFingerprint!==row.identityFingerprint||current.status!==row.status)fail('PARTICIPANT_STALE','Participant binding changed during resolution');this.#authority();return row;
 }
 async #byAlias(aliasId){
  assertNarrativeId(aliasId);const ref=await this.#ref(aliasId);if(!ref)return null;
  if(ref.state!=='ready')fail('PARTICIPANT_RECOVERY_REQUIRED','Participant reverse reference is prepared');
  const row=await this.#ready(ref.nativeActorId);if(!row||!this.#matches(ref,row)||![row.narrativeActorId,row.observerId].includes(aliasId))fail('PARTICIPANT_BINDING_UNCERTAIN','Participant reverse reference has no exact canonical binding');return row;
 }
 #active(row){if(!row||row.status!=='active')fail('PARTICIPANT_UNAVAILABLE','No active explicit participant binding is available');return row;}
 async read({nativeActorId}={}){this.#authority();return clone(await this.#ready(nativeId(nativeActorId)));}
 async inspect({nativeActorId}={}){
  this.#authority();const row=await this.#primary(nativeId(nativeActorId));if(!row)return {binding:null,references:[],canRecover:false};const references=[];
  for(const aliasId of new Set([row.narrativeActorId,row.observerId]))references.push({aliasId,reference:await this.#ref(aliasId)});
  this.#authority();return clone({binding:row,references,canRecover:row.state==='prepared'});
 }
 async #finish(row){
  this.#gmActor(row.nativeActorId);
  for(const aliasId of new Set([row.narrativeActorId,row.observerId])){
   const loc=await participantRefLocator(aliasId);let ref=await this.#ref(aliasId);
   if(ref&&!this.#matches(ref,row))fail('PARTICIPANT_DUPLICATE','Narrative Actor and observer IDs must belong to one exact native Actor binding');
   if(!ref){await this.#repo.put({...loc,kind:'native-participant-ref',state:'prepared',aliasId,bindingId:row.id,nativeActorId:row.nativeActorId,identityFingerprint:row.identityFingerprint},{expectedRevision:null,gm:this.#authority()});ref=await this.#ref(aliasId);}
   if(!ref||!this.#matches(ref,row))fail('PARTICIPANT_WRITE_UNCERTAIN','Prepared participant reference was not confirmed');
   if(ref.state==='prepared'){this.#gmActor(row.nativeActorId);await this.#repo.put({...ref,state:'ready'},{expectedRevision:ref.revision,gm:this.#authority()});const confirmed=await this.#ref(aliasId);if(confirmed?.state!=='ready'||!this.#matches(confirmed,row))fail('PARTICIPANT_WRITE_UNCERTAIN','Participant reference activation was not confirmed');}
  }
  const current=await this.#primary(row.nativeActorId);if(!current||current.revision!==row.revision||current.identityFingerprint!==row.identityFingerprint||current.state!=='prepared')fail('REVISION_CONFLICT','Prepared participant metadata changed');
  this.#gmActor(row.nativeActorId);await this.#repo.put({...current,state:'ready'},{expectedRevision:current.revision,gm:this.#authority()});return this.read({nativeActorId:row.nativeActorId});
 }
 save(raw){
  const input=clone(raw);return this.#queue(async()=>{
   this.#authority();if(!input||Object.keys(input).sort().join(',')!=='expectedRevision,narrativeActorId,nativeActorId,observerId,scope,status')fail('PARTICIPANT_FIELDS','Select the exact Actor, narrative IDs, world scope, status and observed metadata revision');fields(input);
   if(input.expectedRevision!==null&&(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1))fail('REVISION_CONFLICT','Exact participant metadata revision required');
   const previous=await this.#primary(input.nativeActorId);
   if(previous?.state==='prepared')fail('PARTICIPANT_RECOVERY_REQUIRED','Inspect and explicitly complete the original prepared binding');
   if((previous?.revision??null)!==input.expectedRevision)fail('REVISION_CONFLICT','Participant metadata changed since review');
   const identityFingerprint=await sha256Hex(JSON.stringify(identity(input)));
   if(previous&&previous.identityFingerprint!==identityFingerprint)fail('PARTICIPANT_IDENTITY_IMMUTABLE','An established participant identity cannot silently be reassigned; retire it instead');
   if(previous){await this.#ready(input.nativeActorId);if(previous.status===input.status)return clone(previous);if(previous.status==='retired')fail('PARTICIPANT_RETIRED','Retired participant bindings cannot be reactivated');
    const saved=await this.#repo.put({...previous,status:'retired'},{expectedRevision:previous.revision,gm:this.#authority()});return this.read({nativeActorId:saved.nativeActorId});}
   if(input.status!=='active')fail('PARTICIPANT_FIELDS','A new participant binding must explicitly be active');this.#gmActor(input.nativeActorId);
   const loc=await participantBindingLocator(input.nativeActorId),candidate={...loc,kind:'native-participant-binding',state:'prepared',...identity(input),status:'active',identityFingerprint};
   for(const alias of new Set([input.narrativeActorId,input.observerId]))if(await this.#ref(alias))fail('PARTICIPANT_DUPLICATE','Narrative Actor and observer IDs are already reserved by an existing binding');
   this.#gmActor(input.nativeActorId);await this.#repo.put(candidate,{expectedRevision:null,gm:this.#authority()});const staged=await this.#primary(input.nativeActorId);if(!staged||staged.state!=='prepared'||staged.identityFingerprint!==identityFingerprint)fail('PARTICIPANT_WRITE_UNCERTAIN','Participant preparation was not confirmed');return this.#finish(staged);
  });
 }
 recover({nativeActorId,expectedRevision}={}){nativeId(nativeActorId);return this.#queue(async()=>{this.#authority();const row=await this.#primary(nativeActorId);if(!row||row.state!=='prepared'||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Inspect the exact prepared participant revision before completing it');return this.#finish(row);});}
 async resolveObserver({actorId,verifiedUserId}={}){
  this.#playerOwner(actorId,verifiedUserId);const row=this.#active(await this.#ready(actorId));this.#playerOwner(actorId,verifiedUserId);return row.observerId;
 }
 async resolveNativeActor({narrativeActorId,gmUserId}={}){
  const gm=this.#authority();if(gm.userId!==gmUserId)fail('PARTICIPANT_GM_ACTOR','Only the current trusted GM can resolve a narrative Actor');
  const row=this.#active(await this.#byAlias(narrativeActorId));if(row.narrativeActorId!==narrativeActorId)fail('PARTICIPANT_UNAVAILABLE','The selected identity is not a bound narrative Actor');return this.#gmActor(row.nativeActorId,gmUserId);
 }
 #owners(nativeActorId){
  const actor=this.#actor(nativeActorId),users=this.#game.users.contents;if(!Array.isArray(users))fail('PARTICIPANT_USERS_UNAVAILABLE','Actual world User collection is required');
  const owners=users.filter(user=>user.active===true&&!user.isGM&&this.#game.users.get(user.id)===user&&actor.testUserPermission(user,'OWNER')===true);
  if(owners.length!==1)fail(owners.length?'PARTICIPANT_RECIPIENT_AMBIGUOUS':'PARTICIPANT_RECIPIENT_UNAVAILABLE','Participant requires exactly one active owning player for notification delivery');return owners[0].id;
 }
 async resolveRecipientUser({scope='world',recipientId}={}){
  this.#authority();world(scope);const row=this.#active(await this.#byAlias(recipientId)),userId=this.#owners(row.nativeActorId),current=this.#active(await this.#ready(row.nativeActorId));
  if(current.revision!==row.revision||this.#owners(row.nativeActorId)!==userId)fail('PARTICIPANT_RECIPIENT_CHANGED','Participant recipient ownership changed during resolution');this.#playerOwner(row.nativeActorId,userId);return userId;
 }
 async authorizeRecipient(userId,recipientId){return await this.resolveRecipientUser({recipientId})===userId;}
}
