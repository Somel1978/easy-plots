/** GM-only lightweight entities and optional native shells. Persona lineage
 * is independent of native resources, relationships and observer knowledge. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const COLLECTIONS={Actor:'actors',Item:'items',JournalEntry:'journal'};
export class PersistentNarrativeIdentities {
 #domains;#gm;#writer;#game;#binding;
 constructor({domains,gmProvider,writer,gameInstance,readBinding}={}){if(!domains?.read||!domains?.hasRecordOrIndex||typeof gmProvider!=='function'||!writer?.assertEligible||typeof readBinding!=='function')fail('IDENTITY_DEPENDENCY','Protected identities, native binding reader and GM authority required');this.#domains=domains;this.#gm=gmProvider;this.#writer=writer;this.#game=gameInstance;this.#binding=readBinding;}
 #authority(){const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);if(gm.userId!==this.#game.user?.id||gm.worldId!==this.#game.world?.id)fail('IDENTITY_AUTHORITY','Current native coordinator required');}
 async #read(type,scope,id){const row=await this.#domains.read(type,scope,id);if(!row&&await this.#domains.hasRecordOrIndex(type,scope,id))fail('IDENTITY_UNCERTAIN','Known identity has no confirmed payload');return row;}
 async resolve({scope='world',entityId=null,personaId=null}={}){
  this.#authority();if(Boolean(entityId)===Boolean(personaId))fail('IDENTITY_REFERENCE','Select one entity or persona identity');assertNarrativeId(entityId??personaId);let persona=null;
  if(personaId){persona=await this.#read('persona',scope,personaId);if(!persona){this.#authority();return {status:'missing',entity:null,persona:null,native:null};}if(persona.data.personaId!==personaId||!['active','retired'].includes(persona.data.status))fail('IDENTITY_CORRUPT','Persona identity or lifecycle differs');entityId=persona.data.entityId;assertNarrativeId(entityId);}
  const entity=await this.#read('narrative-entity',scope,entityId);if(!entity){this.#authority();return {status:persona?'underlying-entity-missing':'missing',entity:null,persona:clone(persona),native:null};}
  if(entity.data.entityId!==entityId||!['active','retired'].includes(entity.data.status))fail('IDENTITY_CORRUPT','Canonical entity identity or lifecycle differs');let native={status:'not-attached'};
  if(entity.data.resourceId){const binding=await this.#binding({scope,resourceId:entity.data.resourceId});this.#authority();
   if(!binding)native={status:'binding-unavailable'};
   else{if(binding.resourceId!==entity.data.resourceId||binding.scope!==scope||!Object.hasOwn(COLLECTIONS,binding.documentKind))fail('IDENTITY_BINDING','Native binding identity differs');if(binding.status!=='bound')native={status:'detached',documentKind:binding.documentKind};else{const document=this.#game[COLLECTIONS[binding.documentKind]]?.get?.(binding.nativeId);native={status:document&&!document.pack?'available':'missing',documentKind:binding.documentKind,nativeId:binding.nativeId,uuid:`${binding.documentKind}.${binding.nativeId}`};}}
  }
  this.#authority();return clone({status:persona?.data.status??entity.data.status,entity,persona,native});
 }
}
