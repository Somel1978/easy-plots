/** GM-only bounded knowledge propagation planner (ADR 15, 44, 105-107).
 * Canonical truth is never included in a player projection. No state mutation.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const policySet=new Set(['allow','review','deny']);
const stanceSet=new Set(['reported','believed','doubted','disputed','retracted']);
function boundedIds(value,max=128){
  if(!Array.isArray(value)||value.length>max)fail('KNOWLEDGE_LIMIT','A bounded list is required');
  value.forEach(assertNarrativeId);if(new Set(value).size!==value.length)fail('KNOWLEDGE_DUPLICATE','Duplicate stable IDs');
  return value;
}
/**
 * @param {object} input - One authored disclosure event, scoped communication edges,
 *   and recipient snapshots. These are PRIVATE GM inputs, never sent to a player.
 */
export function planKnowledgePropagation({disclosure,connections=[],recipientStates=[],worldTime=0,
  maxConnections=64,maxRecipients=64,maxHops=4,maxPlanned=64}={}){
  if(!disclosure||typeof disclosure!=='object')fail('KNOWLEDGE_EVENT','Disclosure required');
  for(const key of ['eventId','claimId','sourceId'])assertNarrativeId(disclosure[key]);
  if(!Number.isFinite(worldTime)||worldTime<0||!Number.isInteger(maxHops)||maxHops<1||maxHops>8)
    fail('KNOWLEDGE_TIME','Bounded world time and propagation depth required');
  boundedIds(disclosure.initialRecipientIds,maxRecipients);
  if(!stanceSet.has(disclosure.stance??'reported'))fail('KNOWLEDGE_STANCE','Invalid source assertion');
  if(!Array.isArray(connections)||connections.length>maxConnections||!Array.isArray(recipientStates)||recipientStates.length>maxRecipients)
    fail('KNOWLEDGE_LIMIT','Propagation scope exceeds bounds');
  if(!Number.isInteger(maxPlanned)||maxPlanned<1||maxPlanned>128)fail('KNOWLEDGE_LIMIT','Invalid proposal cap');
  const states=new Map();
  for(const record of recipientStates){
    assertNarrativeId(record.observerId);
    if(states.has(record.observerId))fail('KNOWLEDGE_DUPLICATE','Duplicate recipient snapshot');
    const known=boundedIds(record.knownEventIds??[],128);
    states.set(record.observerId,{...record,knownEventIds:new Set(known)});
  }
  const edges=new Map();
  const edgeIds=new Set();
  for(const edge of connections){
    for(const key of ['id','fromId','toId'])assertNarrativeId(edge[key]);
    if(edge.fromId===edge.toId||edgeIds.has(edge.id))fail('KNOWLEDGE_EDGE','Duplicate/self-link communication edge');
    edgeIds.add(edge.id);
    if(!policySet.has(edge.policy))fail('KNOWLEDGE_POLICY','Communication policy must be explicit');
    if(!Number.isFinite(edge.delay??0)||(edge.delay??0)<0)fail('KNOWLEDGE_TIME','Invalid delay');
    if(edge.distortion!==undefined&&(!edge.distortion||typeof edge.distortion!=='object'||
      !stanceSet.has(edge.distortion.stance)||typeof edge.distortion.reasonId!=='string'))
      fail('KNOWLEDGE_DISTORTION','Only explicit provenance-backed distortion allowed');
    if(edge.distortion)assertNarrativeId(edge.distortion.reasonId);
    const list=edges.get(edge.fromId)??[];list.push(edge);edges.set(edge.fromId,list);
  }
  // Breadth-first with bounded candidate graph, no implicit auto-sharing of hidden truths.
  const queue=disclosure.initialRecipientIds.map(id=>({id,depth:0,via:null,at:worldTime,
    stance:disclosure.stance??'reported',provenance:[disclosure.eventId],policy:'review'}));
  const seen=new Set(),proposals=[],rejected=[];
  while(queue.length){
    if(queue.length>maxConnections*maxHops+maxRecipients)fail('KNOWLEDGE_LIMIT','Queue exceeded bound');
    const current=queue.shift();
    const key=`${disclosure.eventId}|${current.id}`;
    if(seen.has(key))continue;seen.add(key);
    if(seen.size>maxPlanned)fail('KNOWLEDGE_LIMIT','Recipient plan budget exhausted');
    const existing=states.get(current.id);
    if(!existing){rejected.push({observerId:current.id,reason:'recipient-not-in-scoped-snapshot'});continue;}
    if(existing.knownEventIds.has(disclosure.eventId))continue;
    if(current.policy==='deny'){rejected.push({observerId:current.id,reason:'communication-policy-denies'});continue;}
    const status=current.at>worldTime?'scheduled-review':'gm-review';
    proposals.push({observerId:current.id,sourceEventId:disclosure.eventId,claimId:disclosure.claimId,
      sourceId:disclosure.sourceId,stance:current.stance,status,notBefore:current.at,
      provenanceEventIds:[...current.provenance],pathDepth:current.depth,
      // The receiving character may not know who first originated the assertion.
      sourceVisibility:'gm-only',committed:false});
    if(current.depth>=maxHops)continue;
    for(const edge of edges.get(current.id)??[]){
      if(edge.policy==='deny')continue;
      const nextState=states.get(edge.toId);
      if(!nextState||nextState.knownEventIds.has(disclosure.eventId))continue;
      queue.push({id:edge.toId,depth:current.depth+1,via:edge.id,
        at:current.at+(edge.delay??0),stance:edge.distortion?.stance??current.stance,
        provenance:[...current.provenance,edge.id,...(edge.distortion?[edge.distortion.reasonId]:[])],
        policy:edge.policy});
    }
  }
  return {sourceEventId:disclosure.eventId,claimId:disclosure.claimId,
    proposals:clone(proposals),excluded:clone(rejected),status:'gm-review',committed:false,
    autoPublished:false,canonicalTruthEvaluated:false};
}

/** Generate a minimal, explicitly disclosed claim view from completed records.
 * The caller must supply an already-authorized observer and published-event set.
 */
export function projectDisclosedClaims({observerId,records=[],authorizedEventIds=[],max=64}={}){
  assertNarrativeId(observerId);const permitted=new Set(boundedIds(authorizedEventIds,max));
  if(!Array.isArray(records)||records.length>max)fail('KNOWLEDGE_LIMIT','Bounded claim projection required');
  return records.filter(r=>r.observerId===observerId&&r.state==='published'&&permitted.has(r.disclosureEventId))
    .map(r=>({claimPublicId:r.claimPublicId,text:r.publicText,stance:r.stance,provenancePublicIds:
      Array.isArray(r.provenancePublicIds)?r.provenancePublicIds.slice(0,8):[]}));
}
