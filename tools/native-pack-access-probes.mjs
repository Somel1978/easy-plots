/**
 * Manual, synthetic-only probes for disposable Foundry v14 worlds.
 * Import this ES module from GM and player console. Never use real secrets.
 * A successful probe is a necessary condition, not a security proof by itself.
 */
const assertGame=()=>{if(!globalThis.game?.ready)throw new Error('Run in a ready Foundry world');};

/** GM checks collection config before placing any protected content. */
export function gmInspectPackConfiguration(packId){
  assertGame();if(!game.user.isGM)throw new Error('GM required');
  const pack=game.packs.get(packId);
  if(!pack)throw new Error('World Compendium not found');
  return {
    worldId:game.world.id,packId:pack.collection,
    packageType:pack.metadata.packageType,documentName:pack.documentName,
    locked:pack.locked,
    userLevels:game.users.contents.map(u=>({userId:u.id,role:u.role,isGM:u.isGM,level:pack.getUserLevel(u)})),
    caution:'Player clients must independently test direct database queries, index access and bootstrap/network payloads.'
  };
}

/**
 * Player attempts both ordinary and low-level native database access.
 * Do not infer confidentiality just because game.packs.get() returns null.
 * Pass a synthetic canary ID created in the protected pack by the GM.
 */
export async function playerInspectProtectedPack({packId,canaryDocumentId}){
  assertGame();if(game.user.isGM)throw new Error('Use a non-GM player client');
  if(typeof packId!=='string'||!packId||typeof canaryDocumentId!=='string'||!canaryDocumentId)
    throw new Error('Pack ID and SYNTHETIC canary document ID required');
  const result={packListed:false,indexFetch:'not-attempted',documentFetch:'not-attempted',
    directIndexFetch:'not-attempted',directDocumentFetch:'not-attempted',
    bootstrapAndNetworkInspection:'manual-required'};
  const pack=game.packs.get(packId);
  result.packListed=!!pack;
  if(pack){
    try {await pack.getIndex();result.indexFetch='ALLOWED';}catch {result.indexFetch='denied';}
    try {const doc=await pack.getDocument(canaryDocumentId);result.documentFetch=doc?'ALLOWED':'missing';}
    catch {result.documentFetch='denied';}
  }
  const cls=foundry.documents.JournalEntry.implementation;
  if(typeof cls?.database?.get!=='function'){
    result.directIndexFetch='api-missing';result.directDocumentFetch='api-missing';return result;
  }
  try {
    const docs=await cls.database.get(cls,{query:{},index:true,indexFields:['name'],pack:packId},game.user);
    result.directIndexFetch=docs?.length?'ALLOWED':'empty';
  } catch {result.directIndexFetch='denied';}
  try {
    const docs=await cls.database.get(cls,{query:{_id:canaryDocumentId},pack:packId},game.user);
    result.directDocumentFetch=docs?.length?'ALLOWED':'missing';
  } catch {result.directDocumentFetch='denied';}
  return result;
}

/** Explicit pass predicate for synthetic tests; network/bootstrap still manual. */
export function assessPackProbeResults(samples){
  if(!Array.isArray(samples)||!samples.length)throw new Error('Provide non-GM player results');
  const bad=[];
  for(const [i,s] of samples.entries()){
    if(s.packListed||s.indexFetch==='ALLOWED'||s.documentFetch==='ALLOWED'||
      s.directIndexFetch==='ALLOWED'||s.directDocumentFetch==='ALLOWED')bad.push(i);
  }
  return {provisionalPass:bad.length===0,failedPlayerSampleIndices:bad,
    outstanding:['Inspect each player session bootstrap payload','Inspect network frames and reconnect','Verify all non-GM roles','Repeat after pack/Foundry permission changes'],
    warning:'Do not treat these probes as automatic durable-storage authorization.'};
}
