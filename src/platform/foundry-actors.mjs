/**
 * Minimum Actor ownership verification for native player intents.
 * This adapter recognizes WORLD Actors only. Scene unlinked tokens and special
 * delegation require their own explicitly tested authorization adapter.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
export function createWorldActorAuthorizer(gameInstance) {
  return async (verifiedUserId,actorId)=>{
    const user=gameInstance?.users?.get?.(verifiedUserId);
    if (!user || user.isGM || !user.active) return false;
    const actor=gameInstance?.actors?.get?.(actorId);
    if(!actor) return false;
    try {return actor.testUserPermission(user,'OWNER') === true;}catch{return false;}
  };
}
export function requireNativeStorageAdapter(adapter) {
  if (!adapter || typeof adapter.enqueueOnce !== 'function' || adapter.nativeVerified !== true) {
    throw new EasyPlotsError('NATIVE_STORAGE_UNVERIFIED','A verified durable Foundry storage adapter is required');
  }
  return async ({intent,verifiedUserId})=>{
    // Idempotency key MUST cover origin + request to avoid cross-user collisions.
    const result=await adapter.enqueueOnce(`${verifiedUserId}:${intent.requestId}`,{intent,verifiedUserId});
    if(result?.durable !== true) throw new EasyPlotsError('NOT_DURABLE','A durable queue receipt was not confirmed');
    return {durable:true};
  };
}

/**
 * A conservative extension for synthetic/unlinked Token Actors in v14 scenes.
 * Supported identifier: `Scene.<sceneId>.Token.<tokenId>`. The player must be
 * viewing that scene and must own the exact synthetic Actor. Linked token
 * Actors should instead use world Actor IDs, preventing ambiguous authority.
 * No permission is inferred from token visibility, target selection, or a
 * player-supplied user ID.
 */
const TOKEN_REF=/^Scene\.([A-Za-z0-9]{16})\.Token\.([A-Za-z0-9]{16})$/;
export function createScopedActorAuthorizer(gameInstance){
  const world=createWorldActorAuthorizer(gameInstance);
  return async(verifiedUserId,actorReference)=>{
    const ref=typeof actorReference==='string'?actorReference:'';
    if(!ref.startsWith('Scene.'))return world(verifiedUserId,ref);
    const match=TOKEN_REF.exec(ref);
    if(!match)return false;
    const user=gameInstance?.users?.get?.(verifiedUserId);
    if(!user||!user.active||user.isGM||user.viewedScene!==match[1])return false;
    const scene=gameInstance?.scenes?.get?.(match[1]);
    const token=scene?.tokens?.get?.(match[2]);
    // Synthetic unlinked Actors have their own ownership rules. Never inherit
    // authorization from merely seeing the token, its scene, or its world base.
    if(!token||token.actorLink===true||token.actor?.isToken!==true)return false;
    try{return token.actor.testUserPermission(user,'OWNER')===true;}catch{return false;}
  };
}
