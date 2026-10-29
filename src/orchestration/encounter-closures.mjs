/** One reviewed closure per native Combat identity, independent of GM/scope.
 * Existing outcome capabilities remain attributed assertions. Only a selected,
 * verified operation can generate the canonical encounter-closed event. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {versionedEvent} from '../contracts/canonical-event.mjs';
import {validateNativeHookEvent} from '../platform/foundry-hook-ingress.mjs';
import {validateNarrativeCapability} from '../runtime/narrative-capabilities.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const hash=value=>sha256Hex(JSON.stringify(value));
const nativeId=uuid=>{const match=/^Combat\.([A-Za-z0-9]{16})$/.exec(uuid??'');if(!match)fail('ENCOUNTER_NATIVE_SOURCE','Exact world Combat UUID required');return match[1];};
export class PersistentEncounterClosures {
 #domains;#reviews;#ledger;#router;#gm;#writer;#game;
 constructor({domains,reviews,ledger,router,gmProvider,writer,gameInstance}={}){if(!domains?.hasRecordOrIndex||!reviews?.verifiedCompletion||!ledger?.get||!ledger?.hasRecordOrIndex||!router?.ingest||typeof gmProvider!=='function'||!writer?.assertEligible||typeof gameInstance?.combats?.get!=='function')fail('ENCOUNTER_DEPENDENCY','Protected verified operations, native Combat collection and GM event pipeline required');this.#domains=domains;this.#reviews=reviews;this.#ledger=ledger;this.#router=router;this.#gm=gmProvider;this.#writer=writer;this.#game=gameInstance;}
 #authority(){const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);if(gm.userId!==this.#game.user?.id||gm.worldId!==this.#game.world.id)fail('ENCOUNTER_AUTHORITY','Native coordinator identity changed');return gm;}
 async #key(uuid){nativeId(uuid);return (await hash({worldId:this.#game.world.id,nativeCombatUuid:uuid})).slice(0,28);}
 async read({nativeCombatUuid}={}){
  this.#authority();const key=await this.#key(nativeCombatUuid),id=`ep:encounter-closure:${key}`,row=await this.#domains.read('encounter-closure','world',id);
  if(!row&&await this.#domains.hasRecordOrIndex('encounter-closure','world',id))fail('ENCOUNTER_UNCERTAIN','Known closure selection has no confirmed payload');
  if(row&&(row.data.nativeCombatUuid!==nativeCombatUuid||row.data.worldId!==this.#game.world.id||row.data.eventId!==`ep:event:encounter_closed_${key}`||typeof row.data.selectedBy!=='string'||!row.data.selectedBy||row.data.state!=='selected'||await hash(row.data.selection)!==row.data.selectionDigest))fail('ENCOUNTER_CORRUPT','Canonical encounter selection differs');if(row)validateNarrativeCapability('narrative.encounter-outcome',row.data.selection.payload);this.#authority();return row;
 }
 async preview({sourceEventId,operationId}={}){
  this.#authority();assertNarrativeId(sourceEventId);const completion=await this.#reviews.verifiedCompletion(sourceEventId,operationId),entry=await this.#ledger.get(sourceEventId),event=entry?.event;validateNativeHookEvent(event);
  if(event.eventType!=='foundry.combat.deleted'||event.source.hook!=='deleteCombat'||event.payload.documentType!=='Combat')fail('ENCOUNTER_NATIVE_SOURCE','Encounter closure requires an observed native Combat deletion');
  const nativeCombatUuid=event.source.documentUuid;if(this.#game.combats.get(nativeId(nativeCombatUuid)))fail('ENCOUNTER_STILL_PRESENT','The selected native Combat still exists');
  const proposal=entry.proposals.find(p=>p.operationId===operationId);if(proposal?.providerId!=='narrative.encounter-outcome')fail('ENCOUNTER_OUTCOME_REQUIRED','Select one verified encounter-outcome operation');
  const payload=validateNarrativeCapability(proposal.providerId,proposal.payload),selection={sourceEventId,operationId,completion,nativeEventDigest:await hash(event),payload},key=await this.#key(nativeCombatUuid),selectionDigest=await hash(selection);this.#authority();
  return {nativeCombatUuid,selection,selectionDigest,closureId:`ep:encounter-closure:${key}`,eventId:`ep:event:encounter_closed_${key}`,effectsExecuted:0};
 }
 async select(spec,{approved=false,expectedFingerprint}={}){
  if(approved!==true)fail('ENCOUNTER_REVIEW_REQUIRED','Explicit GM selection of one verified outcome required');const preview=await this.preview(spec);if(expectedFingerprint!==preview.selectionDigest)fail('ENCOUNTER_SELECTION_STALE','Review the exact current completed outcome before selection');
  const old=await this.read(preview);if(old){if(old.data.selectionDigest!==preview.selectionDigest)fail('ENCOUNTER_ALREADY_SELECTED','This native Combat already has a different canonical outcome');return old;}
  const gm=this.#authority();return this.#domains.save({type:'encounter-closure',scope:'world',id:preview.closureId,sourceEventId:spec.sourceEventId,data:{state:'selected',worldId:this.#game.world.id,nativeCombatUuid:preview.nativeCombatUuid,selection:preview.selection,selectionDigest:preview.selectionDigest,selectedBy:gm.userId,eventId:preview.eventId}});
 }
 #event(row){const {selection:s,eventId}=row.data,p=s.payload;return versionedEvent({id:eventId,eventType:'narrative.encounter-closed',source:{kind:'gm-approved-intent',capability:'verified-encounter-closure-v1',requestId:`ep:request:encounter_${eventId.split('_').at(-1)}`},causalParentIds:[s.sourceEventId],correlationId:row.id,payload:{scope:p.scope,encounterId:p.encounterId,resolutionId:p.resolutionId,plotId:p.plotId,outcome:p.outcome,sourceEventId:s.sourceEventId,operationId:s.operationId,verified:true}});}
 async emit({nativeCombatUuid,expectedRevision}={}, {approved=false}={}){
  if(approved!==true)fail('ENCOUNTER_REVIEW_REQUIRED','Explicit GM submission of the selected closure required');const row=await this.read({nativeCombatUuid});if(!row||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Fresh canonical closure selection required');const event=this.#event(row),existing=await this.#ledger.get(event.id);
  if(existing){if(JSON.stringify(existing.event)!==JSON.stringify(event))fail('EVENT_REUSE_CONFLICT','Canonical closure event content differs');return {eventId:event.id,status:'duplicate-or-recovery-required',persistedState:existing.state};}
  if(await this.#ledger.hasRecordOrIndex?.(event.id))fail('ENCOUNTER_UNCERTAIN','Known closure event index needs reconciliation; the event will not be submitted again');
  const current=await this.preview({sourceEventId:row.data.selection.sourceEventId,operationId:row.data.selection.operationId});if(current.selectionDigest!==row.data.selectionDigest)fail('ENCOUNTER_SELECTION_STALE','Original verified closure source changed');this.#authority();return {eventId:event.id,...await this.#router.ingest(event,{retainWithoutSubscribers:true})};
 }
}
