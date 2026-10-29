/**
 * Bounded, typed and GM-private narrative state capabilities.  These implement
 * durable *narrative* facts/operations only; they never mutate Actors/Items,
 * broadcast secret records, invent off-screen events, or call arbitrary scripts.
 *
 * Each descriptor is a stable versioned contract; no dynamic patch provider.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {NarrativeDomainStore} from '../domains/domain-store.mjs';
import {canonicalDomainEffect} from './canonical-domain-effects.mjs';
const error=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const SCOPED=/^[a-z][a-z0-9-]{0,47}$/;
const OP=/^ep:operation:[a-zA-Z0-9_:-]{6,200}$/;
const EV=/^ep:event:[a-zA-Z0-9_-]{8,120}$/;
const KINDS=Object.freeze([
  {nodeType:'core.faction.membership',providerId:'narrative.faction-membership',type:'faction-membership',keys:['factionId','memberId'],ids:['factionId','memberId'],enums:{status:['member','suspended','former'],rank:['initiate','member','officer','leader']},defaults:{status:'member',rank:'member'}},
  {nodeType:'core.faction.agenda',providerId:'narrative.faction-agenda',type:'faction-agenda',keys:['agendaId'],ids:['agendaId','factionId'],enums:{status:['draft','active','paused','completed','failed'],knowledgePolicy:['self','shared','gm-only']},defaults:{status:'draft',knowledgePolicy:'gm-only'}},
  {nodeType:'core.npc.agenda',providerId:'narrative.npc-agenda',type:'npc-agenda',keys:['agendaId'],ids:['agendaId','npcId'],enums:{status:['draft','active','paused','completed','failed']},optionalIdLists:['requiredKnowledgeIds','requiredCanonicalFactIds'],defaults:{status:'draft'},canonical:{type:'npc-agenda',field:'agendaId'}},
  {nodeType:'core.npc.schedule',providerId:'narrative.npc-schedule',type:'npc-schedule',keys:['scheduleId'],ids:['scheduleId','npcId','locationId'],optionalIds:['agendaId'],enums:{status:['planned','due','confirmed','cancelled']},numbers:['dueWorldTime'],defaults:{status:'planned',dueWorldTime:0},canonical:{type:'npc-schedule',field:'scheduleId'}},
  {nodeType:'core.investigation.hypothesis',providerId:'narrative.investigation-hypothesis',type:'investigation-hypothesis',keys:['hypothesisId'],ids:['hypothesisId','investigationId','observerId'],enums:{status:['proposed','contested','retracted','reviewed']},idLists:['supportingEvidenceIds','contradictingEvidenceIds'],defaults:{status:'proposed',supportingEvidenceIds:[],contradictingEvidenceIds:[]}},
  {nodeType:'core.investigation.contribution',providerId:'narrative.investigation-contribution',type:'investigation-contribution',keys:['contributionId'],ids:['contributionId','investigationId','contributorId','sourceId'],enums:{kind:['discovered','shared','corroborated','acted']},immutable:true,defaults:{kind:'discovered'}},
  {nodeType:'core.location.discovery',providerId:'narrative.location-discovery',type:'location-discovery',keys:['discoveryId'],ids:['discoveryId','locationId','observerId'],enums:{status:['discovered','disputed','retracted']},defaults:{status:'discovered'},canonical:{type:'location-discovery',field:'discoveryId'}},
  {nodeType:'core.location.route',providerId:'narrative.location-route',type:'location-route',keys:['routeId'],ids:['routeId','fromLocationId','toLocationId'],enums:{status:['open','restricted','closed']},defaults:{status:'open'},canonical:{type:'location-route',field:'routeId'}},
  {nodeType:'core.location.place',providerId:'narrative.location-place',type:'location-place',keys:['locationId'],ids:['locationId'],optionalIds:['parentLocationId'],strings:['name'],enums:{kind:['region','site']},defaults:{name:'Narrative location',kind:'region'},canonical:{type:'location',field:'locationId'}},
  {nodeType:'core.pressure.clock',providerId:'narrative.pressure-clock',type:'pressure-clock',keys:['clockId'],ids:['clockId','plotId'],enums:{status:['active','suspended','completed']},ints:['ticks','maxTicks'],defaults:{status:'active',ticks:0,maxTicks:6}},
  {nodeType:'core.deadline.review',providerId:'narrative.deadline-review',type:'deadline-review',keys:['deadlineId'],ids:['deadlineId','plotId'],enums:{status:['pending','due','waived','resolved']},numbers:['dueWorldTime'],defaults:{status:'pending',dueWorldTime:0}},
  {nodeType:'core.encounter.outcome',providerId:'narrative.encounter-outcome',type:'encounter-outcome',keys:['encounterId','resolutionId'],ids:['encounterId','resolutionId','plotId'],enums:{outcome:['victory','defeat','escape','negotiation','stalemate']},immutable:true,defaults:{outcome:'stalemate'}},
  {nodeType:'core.campaign.continuity',providerId:'narrative.continuity-link',type:'continuity-link',keys:['linkId'],ids:['linkId','sourceArcId','targetArcId','entityId'],enums:{status:['proposed','referenced','retired']},defaults:{status:'proposed'}},
  {nodeType:'core.quest.opportunity',providerId:'narrative.quest-opportunity',type:'quest-opportunity',keys:['opportunityId'],ids:['opportunityId','plotId'],enums:{status:['hidden','eligible','available','closed']},defaults:{status:'hidden'}},
  {nodeType:'core.knowledge.retraction',providerId:'narrative.claim-retraction',type:'claim-retraction',keys:['retractionId'],ids:['retractionId','claimId','sourceId'],enums:{reason:['incorrect','superseded','withdrawn','contested']},immutable:true,defaults:{reason:'withdrawn'}},
  {nodeType:'core.session.objective',providerId:'narrative.session-objective',type:'session-objective',keys:['sessionId','objectiveId'],ids:['sessionId','objectiveId','plotId'],enums:{status:['planned','in-play','addressed','deferred']},defaults:{status:'planned'}},
  {nodeType:'core.timeline.annotation',providerId:'narrative.timeline-annotation',type:'timeline-annotation',keys:['annotationId'],ids:['annotationId','eventId'],enums:{timeline:['fiction','execution','knowledge']},numbers:['worldTime'],immutable:true,defaults:{timeline:'fiction',worldTime:0}},
  {nodeType:'core.arc.epilogue',providerId:'narrative.arc-epilogue',type:'arc-epilogue',keys:['epilogueId'],ids:['epilogueId','arcId','resolutionId'],enums:{status:['draft','approved','published']},defaults:{status:'draft'}},
  {nodeType:'core.investigation.opportunity',providerId:'narrative.investigation-opportunity',type:'investigation-opportunity',keys:['opportunityId'],ids:['opportunityId','investigationId'],enums:{status:['unknown','available','attempted','resolved','expired']},defaults:{status:'unknown'}},
  // Additional approved narrative domains. Each is an explicit, GM-reviewed
  // typed state record, not an invitation to mutate a Foundry Actor directly.
  {nodeType:'core.identity.persona-link',providerId:'narrative.identity-persona-link',type:'identity-persona-link',keys:['linkId'],ids:['linkId','entityId','personaId'],enums:{status:['asserted','verified','disputed','retracted'],disclosure:['secret','restricted','known']},defaults:{status:'asserted',disclosure:'secret'}},
  {nodeType:'core.identity.succession',providerId:'narrative.identity-succession',type:'identity-succession',keys:['successionId'],ids:['successionId','predecessorId','successorId'],enums:{status:['proposed','verified','rejected']},immutable:true,defaults:{status:'proposed'}},
  {nodeType:'core.faction.privilege',providerId:'narrative.faction-privilege',type:'faction-privilege',keys:['privilegeId'],ids:['privilegeId','factionId','beneficiaryId'],enums:{status:['eligible','granted','suspended','revoked']},defaults:{status:'eligible'}},
  {nodeType:'core.faction.renown',providerId:'narrative.faction-renown',type:'faction-renown',keys:['factionId','actorId'],ids:['factionId','actorId'],ints:['renown'],enums:{standing:['unknown','neutral','positive','negative']},defaults:{renown:0,standing:'neutral'}},
  {nodeType:'core.investigation.evidence-link',providerId:'narrative.evidence-link',type:'evidence-link',keys:['linkId'],ids:['linkId','investigationId','evidenceId','claimId'],enums:{relationship:['supports','contradicts','contextualizes'],status:['proposed','verified','disputed']},defaults:{relationship:'supports',status:'proposed'}},
  {nodeType:'core.investigation.conclusion',providerId:'narrative.investigation-conclusion',type:'investigation-conclusion',keys:['conclusionId'],ids:['conclusionId','investigationId','hypothesisId'],enums:{status:['claimed','gm-reviewed','verified','rejected','unresolved']},idLists:['supportingEvidenceIds'],defaults:{status:'claimed',supportingEvidenceIds:[]}},
  {nodeType:'core.knowledge.rumor',providerId:'narrative.knowledge-rumor',type:'knowledge-rumor',keys:['rumorId'],ids:['rumorId','claimId','speakerId','observerId'],enums:{stance:['reported','believed','disputed','retracted'],status:['pending','shared','withheld']},defaults:{stance:'reported',status:'pending'}},
  {nodeType:'core.knowledge.credibility',providerId:'narrative.knowledge-credibility',type:'knowledge-credibility',keys:['observerId','claimId','sourceId'],ids:['observerId','claimId','sourceId'],enums:{assessment:['unassessed','credible','uncertain','unreliable','retracted']},defaults:{assessment:'unassessed'}},
  {nodeType:'core.arc.resolution-facet',providerId:'narrative.arc-resolution-facet',type:'arc-resolution-facet',keys:['facetId'],ids:['facetId','arcId','resolutionId'],enums:{state:['proposed','eligible','approved','excluded'],category:['leader','faction','world','relationship','disclosure']},defaults:{state:'proposed',category:'world'}},
  {nodeType:'core.time.transition-plan',providerId:'narrative.time-transition-plan',type:'time-transition-plan',keys:['planId'],ids:['planId','arcId'],enums:{state:['draft','reviewed','authorized','committed','cancelled']},numbers:['startWorldTime','endWorldTime'],defaults:{state:'draft',startWorldTime:0,endWorldTime:100}},
  {nodeType:'core.resource.provenance',providerId:'narrative.resource-provenance',type:'resource-provenance',keys:['resourceId'],ids:['resourceId','sourceGraphId','ownerId'],enums:{ownership:['borrowed','shared','exclusive','detached'],status:['tracked','stale','missing','archived']},defaults:{ownership:'borrowed',status:'tracked'}},
  {nodeType:'core.campaign.recap',providerId:'narrative.campaign-recap',type:'campaign-recap',keys:['recapId'],ids:['recapId','arcId'],idLists:['referencedEventIds'],enums:{status:['draft','gm-reviewed','published'],audience:['gm','authorized-party']},defaults:{status:'draft',audience:'gm',referencedEventIds:[]}},
  {nodeType:'core.identity.entity',providerId:'narrative.identity-entity',type:'identity-entity',keys:['entityId'],ids:['entityId'],optionalIds:['resourceId'],strings:['name'],enums:{kind:['character','faction','place','object','other'],status:['active','retired']},terminalValues:{status:['retired']},defaults:{name:'Narrative entity',kind:'character',status:'active'},canonical:{type:'narrative-entity',field:'entityId'}},
  {nodeType:'core.identity.persona',providerId:'narrative.identity-persona',type:'identity-persona',keys:['personaId'],ids:['personaId','entityId'],strings:['name'],enums:{status:['active','retired']},terminalValues:{status:['retired']},defaults:{name:'Public persona',status:'active'},canonical:{type:'persona',field:'personaId'}}

]);
export const NARRATIVE_CAPABILITY_DEFS=Object.freeze(KINDS.map(d=>Object.freeze({...d})));
export const NARRATIVE_NODE_EFFECT_PROVIDER=Object.freeze(Object.fromEntries(KINDS.map(d=>[d.nodeType,d.providerId])));
export const NARRATIVE_NODE_DEFAULTS=Object.freeze(Object.fromEntries(KINDS.map((d,i)=>[
  d.nodeType,{scope:'world',...Object.fromEntries(d.ids.map(key=>[key,`ep:${key.replace(/Id$/,'').replace(/([A-Z])/g,'-$1').toLowerCase()}:example_${String(i+1).padStart(3,'0')}`])),...(d.defaults??{}),expectedRevision:null}
])));
const common=new Set(['scope','expectedRevision','visibility']);
export function validateNarrativeCapability(providerId,payload){
  const d=KINDS.find(s=>s.providerId===providerId);
  if(!d)error('CAPABILITY_UNAVAILABLE','Unknown narrative capability');
  assertPlainObject(payload,'CAPABILITY_PAYLOAD');
  if(!SCOPED.test(payload.scope??''))error('CAPABILITY_SCOPE','Explicit bounded narrative scope required');
  if(payload.visibility!==undefined&&payload.visibility!=='gm-only')error('CAPABILITY_DISCLOSURE','Capability data must remain GM-only');
  if(payload.expectedRevision!==null&&payload.expectedRevision!==undefined&&(!Number.isInteger(payload.expectedRevision)||payload.expectedRevision<1))error('CAPABILITY_REVISION','Expected revision invalid');
  const allowed=new Set([...common,...d.ids,...(d.optionalIds??[]),...Object.keys(d.enums??{}),...(d.strings??[]),...(d.numbers??[]),...(d.ints??[]),...(d.idLists??[]),...(d.optionalIdLists??[])]);
  if(Object.keys(payload).some(k=>!allowed.has(k)))error('CAPABILITY_FIELD','Unexpected field in typed capability');
  for(const field of d.ids)assertNarrativeId(payload[field]);
  for(const field of d.optionalIds??[])if(payload[field]!==undefined)assertNarrativeId(payload[field]);
  for(const field of d.strings??[])if(typeof payload[field]!=='string'||!payload[field].trim()||payload[field].length>160)error('CAPABILITY_TEXT',`Bounded authored ${field} required`);
  if(d.type==='identity-persona'&&payload.personaId===payload.entityId)error('IDENTITY_SELF','A persona retains a separate identity from its underlying entity');
  for(const [field,values] of Object.entries(d.enums??{}))if(!values.includes(payload[field]))error('CAPABILITY_ENUM',`Invalid ${field}`);
  for(const field of d.numbers??[])if(!Number.isFinite(payload[field])||payload[field]<0)error('CAPABILITY_TIME',`Invalid ${field}`);
  for(const field of d.ints??[])if(!Number.isSafeInteger(payload[field])||payload[field]<0||payload[field]>100)error('CAPABILITY_VALUE',`Invalid ${field}`);
  for(const field of d.idLists??[]){if(!Array.isArray(payload[field])||payload[field].length>32)error('CAPABILITY_LIST',`Invalid ${field}`);payload[field].forEach(assertNarrativeId);if(new Set(payload[field]).size!==payload[field].length)error('CAPABILITY_LIST',`Duplicate ${field}`);}
  for(const field of d.optionalIdLists??[])if(payload[field]!==undefined){if(!Array.isArray(payload[field])||payload[field].length>32)error('CAPABILITY_LIST',`Invalid ${field}`);payload[field].forEach(assertNarrativeId);if(new Set(payload[field]).size!==payload[field].length)error('CAPABILITY_LIST',`Duplicate ${field}`);}
  if(d.type==='pressure-clock'&&(payload.maxTicks<1||payload.ticks>payload.maxTicks))error('CLOCK_RANGE','Clock exceeds maximum');
  if(d.type==='location-route'&&payload.fromLocationId===payload.toLocationId)error('ROUTE_ENDPOINTS','Route needs different endpoints');
  if(d.type==='continuity-link'&&payload.sourceArcId===payload.targetArcId)error('CONTINUITY_SELF','Continuity requires distinct arcs');
  if(d.type==='identity-succession'&&payload.predecessorId===payload.successorId)error('IDENTITY_SELF','Identity succession requires different entities');
  if(d.type==='time-transition-plan'&&payload.endWorldTime<payload.startWorldTime)error('TIME_ORDER','Time transition must advance or preserve world time');
  if(d.type==='investigation-conclusion'&&payload.status==='verified'&&!payload.supportingEvidenceIds.length)error('CONCLUSION_EVIDENCE','Verified conclusion requires evidence identifiers');
  for(const field of d.idLists??[])if((payload.supportingEvidenceIds??[]).some(id=>(payload.contradictingEvidenceIds??[]).includes(id)))error('HYPOTHESIS_CONFLICT','Evidence cannot simultaneously support and contradict in same record');
  const size=new TextEncoder().encode(JSON.stringify(payload)).length;
  if(size>3500)error('CAPABILITY_BUDGET','Narrative effect payload exceeds budget');
  return clone({...payload,visibility:'gm-only',expectedRevision:payload.expectedRevision??null});
}
export function createNarrativeCapabilityProviders({repository,gmProvider,domains=new NarrativeDomainStore({repository,gmProvider})}={}){
  if(typeof repository?.read!=='function'||typeof repository?.put!=='function'||typeof gmProvider!=='function')error('CAPABILITY_STORE','Guarded repository and GM provider required');
  const gm=()=>{const g=gmProvider();assertLocalGM(g);return g;};
  return KINDS.map(d=>{
    const validate=p=>validateNarrativeCapability(d.providerId,p);
    const locator=async p=>{const hash=await sha256Hex(`${d.type}|${p.scope}|${d.keys.map(k=>p[k]).join('|')}`);
      return {id:`ep:${d.type}:${hash.slice(0,24)}`,partitionId:`cap-${d.type}-${p.scope}-${hash.slice(0,2)}`};};
    if(d.canonical)return canonicalDomainEffect({definition:{...d,id:d.providerId,legacyKind:`cap-${d.type}`,identityFields:d.ids,fixedOptionalIds:d.optionalIds},validate,legacyLocator:locator,repository,domains,gmProvider});
    const get=async payload=>{const p=validate(payload),loc=await locator(p),g=gm();const row=await repository.read(loc.id,{partitionId:loc.partitionId,gm:g});
      if(row&&(row.id!==loc.id||row.partitionId!==loc.partitionId||row.kind!==`cap-${d.type}`||row.scope!==p.scope))error('CAPABILITY_CORRUPT','Stored capability identity mismatch');
      if(row&&typeof repository.hasReadyIndex==='function'&&!await repository.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm:g}))error('INDEX_UNCERTAIN','Capability index not ready');
      return row;};
    return Object.freeze({id:d.providerId,version:'1.0.0',validate,get,
      async apply(payload,ctx){const p=validate(payload),g=gm();if(!OP.test(ctx?.operationId)||!EV.test(ctx?.sourceEventId))error('EFFECT_PROVENANCE','Approved operation/source event required');
        const old=await get(p),loc=await locator(p);
        if(old?.lastOperationId===ctx.operationId){if(JSON.stringify(old.data)!==JSON.stringify(p))error('OPERATION_CONFLICT','Same operation with changed content');return {recordId:old.id,alreadyApplied:true};}
        if(d.immutable&&old)error('IMMUTABLE_RECORD','History can only be revised by a new event');
        if((old?.revision??null)!==p.expectedRevision)error('REVISION_CONFLICT','Narrative data changed since GM approval');
        for(const key of d.ids)if(old&&old.data[key]!==p[key])error('IDENTITY_CONFLICT','Identity reference changed in an existing narrative record');
        if(d.type==='faction-membership'&&old?.data.status==='former'&&p.status==='member')error('MEMBERSHIP_REVIEW','Rejoining requires separate approved membership identity');
        if(d.type==='pressure-clock'&&old&&(old.data.status==='completed'&&p.status==='active'||p.ticks<old.data.ticks))error('CLOCK_REVIEW','Clock reset requires a new authoritative clock');
        if(d.type==='arc-epilogue'&&old?.data.status==='published'&&p.status!=='published')error('EPILOGUE_LOCKED','Published epilogue cannot revert to a draft');
        if(d.type==='campaign-recap'&&old?.data.status==='published'&&p.status!=='published')error('RECAP_LOCKED','Published recap cannot revert');
        if(d.type==='time-transition-plan'&&old?.data.state==='committed'&&p.state!=='committed')error('TIME_COMMITTED','Committed world time plan cannot regress');
        if(d.type==='identity-persona-link'&&old?.data.status==='verified'&&p.status==='asserted')error('IDENTITY_REVIEW','Verified identity cannot silently become unverified');
        const row=await repository.put({...loc,kind:`cap-${d.type}`,scope:p.scope,visibility:'gm-only',data:p,lastOperationId:ctx.operationId,lastSourceEventId:ctx.sourceEventId},
          {expectedRevision:p.expectedRevision,gm:g});return {recordId:row.id,revision:row.revision};
      },
      async verify(payload,ctx){const p=validate(payload),row=await get(p);return Boolean(row&&row.lastOperationId===ctx?.operationId&&row.lastSourceEventId===ctx?.sourceEventId&&JSON.stringify(row.data)===JSON.stringify(p));}
    });
  });
}
