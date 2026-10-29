import {EasyPlotsError, requireInvariant} from '../contracts/errors.mjs';
const trustedContexts = new WeakSet();
export function createLocalGMContext(session, worldId) {
  requireInvariant(session && session.user && session.user.isGM === true && typeof session.user.id === 'string', 'GM_REQUIRED', 'Only an authenticated local Foundry GM session can create an authority context');
  requireInvariant(typeof worldId === 'string' && worldId.length > 0, 'WORLD_REQUIRED', 'World identifier required');
  const context=Object.freeze({kind:'ep-gm-context-v1',userId:session.user.id,worldId,epoch:String(session.epoch ?? 'local'),session});
  trustedContexts.add(context);
  return context;
}
export function assertLocalGM(context) {
  if (!context || !trustedContexts.has(context) || context.kind !== 'ep-gm-context-v1') throw new EasyPlotsError('GM_REQUIRED','Verified GM execution context required');
  if (!context.session?.user?.isGM || context.session.user.id !== context.userId) throw new EasyPlotsError('GM_AUTHORITY_REVOKED','GM session changed or lost authority');
  return context;
}
export function assertAttestedPlayerOrigin(origin) {
  // Never turn untrusted socket payload fields into proof of player identity.
  if (!['verified-native-document-hook','verified-native-module-socket'].includes(origin?.source) || origin?.verified !== true || !origin?.userId || !origin?.proofOfOrigin) {
    throw new EasyPlotsError('ORIGIN_UNVERIFIED','Player intent requires a verified native origin.');
  }
  return origin.userId;
}
