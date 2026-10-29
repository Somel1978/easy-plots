/** Native-store-compatible, bounded, GM-only dependency index for independent
 * cross-plot reactions. A link is *not* an effect, an event, or automatic
 * evidence disclosure. The target must still qualify independently.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {assertEventType} from '../runtime/active-subscriptions.mjs';
import {routeCrossPlotEvent} from './crossplot.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const TYPES=new Set(['observe','qualify','unlock','prerequisite','aggregate','react','exclusive','historical']);
const SCOPE=/^[a-z][a-z0-9-]{0,44}$/;
const MAX_LINKS=48;
export function validateCrossPlotLink(link){
  if(!link||typeof link!=='object'||Array.isArray(link))fail('CROSSPLOT_LINK','Typed link required');
  for(const key of ['id','sourcePlotId','targetId'])assertNarrativeId(link[key]);
  if(!TYPES.has(link.kind))fail('CROSSPLOT_KIND','Unsupported dependency relation');
  assertEventType(link.eventType);
  if(!SCOPE.test(link.scope??''))fail('CROSSPLOT_SCOPE','Explicit scoped link required');
  if(!Number.isInteger(link.expectedRevision)||link.expectedRevision<1)fail('CROSSPLOT_REVISION','Expected target revision required');
  if(!Array.isArray(link.requiredKnownFactIds)||link.requiredKnownFactIds.length>12)fail('CROSSPLOT_FACTS','Bounded knowledge prerequisites required');
  link.requiredKnownFactIds.forEach(assertNarrativeId);
  if(new Set(link.requiredKnownFactIds).size!==link.requiredKnownFactIds.length)fail('CROSSPLOT_FACTS','Duplicate knowledge prerequisite');
  const keys=['id','sourcePlotId','targetId','kind','eventType','scope','expectedRevision','requiredKnownFactIds'];
  if(Object.keys(link).some(k=>!keys.includes(k)))fail('CROSSPLOT_FIELDS','Unexpected dependency metadata');
  return clone(link);
}
export async function crossPlotIndexLocator(eventType,scope='main'){
  assertEventType(eventType);
  if(!SCOPE.test(scope))fail('CROSSPLOT_SCOPE','Bounded index scope required');
  const hash=await sha256Hex(`crossplot:${scope}:${eventType}`);
  return {id:`ep:crossidx:${hash.slice(0,24)}`,partitionId:`crossplot-index:${scope}:${hash.slice(0,2)}`};
}
export class NativeCrossPlotDependencyCatalog{
  #repo;#gm;#scope;
  constructor({repository,gmProvider,scope='main'}={}){
    if(!repository?.read||!repository?.put||typeof gmProvider!=='function'||!SCOPE.test(scope))fail('CROSSPLOT_REPOSITORY','Scoped GM repository required');
    this.#repo=repository;this.#gm=gmProvider;this.#scope=scope;
  }
  #context(){const gm=this.#gm();assertLocalGM(gm);return gm;}
  async #read(eventType){const gm=this.#context(),loc=await crossPlotIndexLocator(eventType,this.#scope),row=await this.#repo.read(loc.id,{partitionId:loc.partitionId,gm});
    if(row){
      if(row.id!==loc.id||row.partitionId!==loc.partitionId||row.kind!=='crossplot-index'||row.eventType!==eventType||!Array.isArray(row.links)||row.links.length>MAX_LINKS)
        fail('CROSSPLOT_CORRUPT','Dependency index record is inconsistent');
      if(typeof this.#repo.hasReadyIndex==='function'&&!await this.#repo.hasReadyIndex(loc.id,{partitionId:loc.partitionId,gm}))fail('INDEX_UNCERTAIN','Dependency index not ready');
      const ids=new Set();for(const record of row.links){validateCrossPlotLink(record.link);if(ids.has(record.link.id))fail('CROSSPLOT_CORRUPT','Duplicate dependency identity');ids.add(record.link.id);
        if(!Number.isSafeInteger(record.activeRevision)||record.activeRevision<1)fail('CROSSPLOT_CORRUPT','Dependency revision missing');}
    }
    return {loc,row,gm};
  }
  async lookup(eventType){const {row}=await this.#read(assertEventType(eventType));return clone(row?.links??[]);}
  async stage(link,{activeRevision}={}){
    const l=validateCrossPlotLink(link);
    if(!Number.isSafeInteger(activeRevision)||activeRevision<1)fail('CROSSPLOT_REVISION','Actual target revision required');
    const {loc,row,gm}=await this.#read(l.eventType),entries=row?.links??[];
    const existing=entries.find(x=>x.link.id===l.id);
    if(existing&&JSON.stringify(existing)==JSON.stringify({link:l,activeRevision}))return {staged:false,existing:true};
    if(existing)fail('CROSSPLOT_CONFLICT','Changing an existing link requires a new approved link ID');
    if(entries.length>=MAX_LINKS)fail('CROSSPLOT_BUDGET','Maximum event-type fan-out exceeded');
    await this.#repo.put({...loc,kind:'crossplot-index',eventType:l.eventType,links:[...entries,{link:l,activeRevision}]},{expectedRevision:row?.revision??null,gm});
    const read=await this.lookup(l.eventType);
    if(!read.some(x=>x.link.id===l.id&&x.activeRevision===activeRevision))fail('CROSSPLOT_UNCERTAIN','Indexed link not read back');
    return {staged:true,linkId:l.id};
  }
  async evaluate(event,{knownFactIds=[],approvedScopes=[],maxSubscribers=MAX_LINKS}={}){
    this.#context();
    const records=await this.lookup(event.eventType);
    return routeCrossPlotEvent(event,records.map(x=>({...x.link,activeRevision:x.activeRevision})),
      {knownFactIds,approvedScopes,maxSubscribers});
  }
}
