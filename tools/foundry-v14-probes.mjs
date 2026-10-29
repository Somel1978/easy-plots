/**
 * MANUAL Foundry VTT v14 diagnostic utilities. Execute separately from GM and player
 * browser sessions after importing as an ES module in the Foundry developer console.
 * NEVER enter secrets or real protected campaign content in a probe payload.
 * These are probes, not proof that a chosen production adapter is trustworthy.
 */
export function installChatOriginObserver({marker='EP_ORIGIN_PROBE'}={}) {
  if(!game.user?.isGM)throw new Error('GM client required for origin observer');
  const handler=(message,options,requestingUserId)=>{
    if(message?.flags?.['easy-plots']?.probeMarker!==marker)return;
    console.info('[Easy Plots SEC origin probe]',{
      messageId:message.id,
      nativeHookRequestingUserId:requestingUserId,
      claimedPayloadUserId:message.flags['easy-plots'].claimedUserId,
      authorId:message.author?.id,
      whisperedToGM:Array.isArray(message.whisper)&&message.whisper.some(id=>game.users.get(id)?.isGM),
      clientUserId:game.user.id
    });
  };
  Hooks.on('createChatMessage',handler);
  return ()=>Hooks.off('createChatMessage',handler);
}
export async function sendOriginProbe({marker='EP_ORIGIN_PROBE'}={}) {
  const gmIds=game.users.filter(u=>u.isGM).map(u=>u.id);
  if(!gmIds.length)throw new Error('No GM recipients available');
  const message=await ChatMessage.create({
    content:'EP ORIGIN PROBE — SYNTHETIC CONTENT ONLY',
    whisper:gmIds,
    flags:{'easy-plots':{probeMarker:marker,claimedUserId:'FORGED_GM_ID_SENT_BY_PLAYER'}}
  });
  return {messageId:message.id,localCreatorId:game.user.id,warning:'Compare nativeHookRequestingUserId on a GM session to this user. Do not infer confidentiality from this test alone.'};
}
export async function inspectProtectedPack(packId) {
  // This must be executed in an unauthorized PLAYER client to test actual leakage.
  if(game.user?.isGM)throw new Error('This read-only visibility probe must run as a player');
  const pack=game.packs.get(packId);
  const result={packListed:Boolean(pack),packId,indexAccessible:false,documentAccessible:false,detail:'unknown'};
  if(!pack)return result;
  try {
    const index=await pack.getIndex();result.indexAccessible=true;
    const entry=index?.contents?.[0]??null;
    if(entry?._id){
      try {const doc=await pack.getDocument(entry._id);result.documentAccessible=Boolean(doc);}
      catch {result.documentAccessible=false;}
    }
    result.detail='Record names and metadata may be visible even if document fetch is blocked; inspect without logging secret payloads.';
  } catch {result.detail='Index request rejected for this player.';}
  return result;
}
export function documentAccessProbe(doc) {
  if(game.user?.isGM)throw new Error('Run in a player client');
  return {visible:Boolean(doc?.visible),owner:Boolean(doc?.isOwner),hasObserverPermission:Boolean(doc?.testUserPermission?.(game.user,'OBSERVER')),uuidVisible:Boolean(doc?.uuid)};
}

/**
 * SERVER MODULE SOCKET PROBE for Foundry v14 build 369.
 * Requires module.json `socket: true` and the enabled easy-plots module.
 * Install the listener in GM, intended player, and an uninvolved player.
 * Send only synthetic records. Compare sender attestation and recipients.
 */
export function installNativeModuleSocketProbe({marker='EP_SOCKET_PROBE'}={}) {
  const handler=(packet, nativeUserId)=>{
    if (packet?.kind!=='source-audit.probe'||packet?.marker!==marker)return;
    console.info('[Easy Plots v14 socket probe]',{
      localClient:game.user.id,
      authenticatedSender:nativeUserId,
      payloadClaimedUserId:packet.claimedUserId,
      nonce:packet.nonce,
      instruction:'Record which recipient clients received this synthetic message'
    });
  };
  game.socket.on('module.easy-plots',handler);
  return ()=>game.socket.off('module.easy-plots',handler);
}
export function sendNativeModuleSocketProbe(recipientId,{marker='EP_SOCKET_PROBE'}={}){
  if(!recipientId || !game.users.get(recipientId))throw new Error('Select a valid recipient user');
  const nonce=foundry.utils.randomID();
  game.socket.emit('module.easy-plots',{
    kind:'source-audit.probe',marker,nonce,
    claimedUserId:'THIS_IS_NOT_THE_AUTHENTICATED_SENDER'
  },{recipients:[recipientId]});
  return {nonce,claimedSender:'THIS_IS_NOT_THE_AUTHENTICATED_SENDER',recipientId};
}
