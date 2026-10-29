/** Editable private preparation from exact GM pins. No campaign enumeration,
 * player projection, activation, disclosure, event intake or effect provider. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,assertPlainObject,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {createSessionBrief} from '../domains/session-planner.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const TYPES=new Set(['objective','obligation','story-hook','scheduled-commitment','npc-schedule','faction','npc-agenda','arc','investigation','world-fact','chronology-event','session-handoff']);
const digest=value=>sha256Hex(JSON.stringify(value));
const positive=n=>Number.isSafeInteger(n)&&n>0;
export class PersistentSessionPreparation {
 #domains;#focus;#registry;#gm;
 constructor({domains,focus,registry,gmProvider}={}){
  if(!['read','save','readRevision','retainRevision'].every(k=>typeof domains?.[k]==='function')||typeof focus?.read!=='function'||typeof focus?.pinSessionPlots!=='function'||!['getActivation','getPublished'].every(k=>typeof registry?.[k]==='function')||typeof gmProvider!=='function')fail('SESSION_PREPARATION_DEPENDENCY','Protected stores, GM focus, exact graph registry and trusted GM authority required');
  this.#domains=domains;this.#focus=focus;this.#registry=registry;this.#gm=gmProvider;
 }
 #identity(){const gm=this.#gm();assertLocalGM(gm);return gm.userId;}
 async #plots(refs){
  this.#identity();if(!Array.isArray(refs)||refs.length<1||refs.length>8)fail('SESSION_PREPARATION_PINS','Pin one to eight named active plots for preparation');
  const seen=new Set(),plots=[];
  for(const ref of refs){
   assertNarrativeId(ref.graphId);if(seen.has(ref.graphId)||!positive(ref.publishedVersion)||!positive(ref.activationRevision))fail('SESSION_PREPARATION_PINS','Unique exact plot observations required');seen.add(ref.graphId);
   this.#identity();const active=await this.#registry.getActivation(ref.graphId);
   if(!active?.active||active.graphId!==ref.graphId||active.revision!==ref.activationRevision||active.publishedVersion!==ref.publishedVersion)fail('SESSION_PREPARATION_STALE','A pinned plot activation changed; explicitly pin its current revision');
   const graph=await this.#registry.getPublished(ref.graphId,ref.publishedVersion);this.#identity();
   if(!graph||graph.id!==ref.graphId||graph.publishedVersion!==ref.publishedVersion)fail('SESSION_PREPARATION_STALE','Pinned published plot is unavailable');
   plots.push({...clone(ref),label:String(graph.title??graph.name??'(untitled)').slice(0,160),fingerprint:await digest(graph)});
  }
  return plots;
 }
 async pinPlots({graphIds,expectedFocusRevision=null,sourceEventId}={}){
  const owner=this.#identity();assertNarrativeId(sourceEventId);
  if(!Array.isArray(graphIds)||graphIds.length>8||new Set(graphIds).size!==graphIds.length)fail('SESSION_PREPARATION_PINS','At most eight unique named plot IDs');
  const plotRefs=[];
  for(const graphId of graphIds){
   assertNarrativeId(graphId);const active=await this.#registry.getActivation(graphId);
   if(!active?.active||active.graphId!==graphId)fail('SESSION_PREPARATION_INACTIVE','Every named preparation plot must be active');
   plotRefs.push({graphId,publishedVersion:active.publishedVersion,activationRevision:active.revision});
  }
  if(plotRefs.length)await this.#plots(plotRefs);
  if(this.#identity()!==owner)fail('SESSION_PREPARATION_OWNER','GM identity changed while pinning');
  return this.#focus.pinSessionPlots({plotRefs,expectedRevision:expectedFocusRevision,sourceEventId});
 }
 async pins(){this.#identity();const row=await this.#focus.read();return {revision:row.revision,plotRefs:clone(row.data.sessionPlotRefs??[])};}
 async read({scope='world',sessionId}={}){
  const owner=this.#identity();assertNarrativeId(sessionId);const row=await this.#domains.read('review-plan',scope,sessionId);
  if(row&&(row.data.kind!=='session-preparation-v1'||row.data.ownerUserId!==owner))fail('SESSION_PREPARATION_OWNER','This preparation belongs to another GM or planning contract');return row;
 }
 #references(refs,plotIds){
  if(!Array.isArray(refs)||refs.length>24)fail('SESSION_PREPARATION_BUDGET','Maximum 24 explicit narrative references');
  const seen=new Set();return refs.map(ref=>{
   assertPlainObject(ref,'SESSION_PREPARATION_REFERENCE');assertNarrativeId(ref.id);assertNarrativeId(ref.plotId);
   if(Object.keys(ref).some(k=>!['type','id','revision','plotId'].includes(k))||!TYPES.has(ref.type)||!positive(ref.revision)||!plotIds.has(ref.plotId))fail('SESSION_PREPARATION_REFERENCE','Exact supported source revisions must name a pinned plot');
   const key=`${ref.type}:${ref.id}`;if(seen.has(key))fail('SESSION_PREPARATION_REFERENCE','Duplicate source reference');seen.add(key);return clone(ref);
  });
 }
 async #sources(scope,refs){
  const sources=[];
  for(const ref of refs){
   const row=await this.#domains.read(ref.type,scope,ref.id);
   if(!row||row.revision!==ref.revision)fail('SESSION_PREPARATION_STALE','Selected narrative source changed before preparation');
   sources.push({...ref,label:String(row.data.title??row.data.name??row.data.label??ref.id).slice(0,160),status:String(row.data.status??row.data.state??'unreviewed').slice(0,64),sourceEventId:row.sourceEventId,fingerprint:await digest(row)});
  }
  return sources;
 }
 #edits({notes='',agenda=[]},sourceIds){
  if(typeof notes!=='string'||notes.length>2000||!Array.isArray(agenda)||agenda.length>16)fail('SESSION_PREPARATION_EDIT','Bounded private notes and at most 16 agenda entries required');
  const seen=new Set();for(const entry of agenda){
   assertPlainObject(entry,'SESSION_PREPARATION_EDIT');assertNarrativeId(entry.id);
   if(Object.keys(entry).some(k=>!['id','text','referenceIds'].includes(k))||seen.has(entry.id)||typeof entry.text!=='string'||!entry.text.trim()||entry.text.length>500||!Array.isArray(entry.referenceIds)||entry.referenceIds.length>8||new Set(entry.referenceIds).size!==entry.referenceIds.length||entry.referenceIds.some(id=>!sourceIds.has(id)))fail('SESSION_PREPARATION_EDIT','Agenda entries require unique IDs, bounded text and selected references');seen.add(entry.id);
  }
  return {notes,agenda:clone(agenda)};
 }
 async prepare({scope='world',sessionId,title='Next session',sourceRefs=[],expectedRevision=null,expectedFocusRevision,sourceEventId}={}){
  const owner=this.#identity();assertNarrativeId(sourceEventId);
  if(typeof title!=='string'||!title.trim()||title.length>120)fail('SESSION_PREPARATION_EDIT','A bounded preparation title is required');
  const old=await this.read({scope,sessionId});if((old?.revision??null)!==expectedRevision)fail('REVISION_CONFLICT','Preparation changed before assembly');
  const focus=await this.#focus.read();if(focus.revision!==expectedFocusRevision)fail('REVISION_CONFLICT','GM pins changed before assembly');
  const plots=await this.#plots(focus.data.sessionPlotRefs??[]),refs=this.#references(sourceRefs,new Set(plots.map(p=>p.graphId))),sources=await this.#sources(scope,refs);
  // Immutable preimages remain available if the live source changes later.
  for(const ref of refs)await this.#domains.retainRevision(ref.type,scope,ref.id,ref.revision);
  const editable=old?{notes:old.data.notes,agenda:old.data.agenda}:{notes:'',agenda:[]};
  // Refresh retains authored notes and agenda, even if a referenced item is no
  // longer selected. An explicit edit can remove its old narrative reference.
  const brief=createSessionBrief({activePlots:plots.map(p=>({id:p.graphId,gmLabel:p.label,status:'active'})),
   gmPins:focus.data.attention.filter(a=>a.pinned&&plots.some(p=>p.graphId===a.graphId)).map(a=>({id:a.eventId,status:'pinned'})),
   dueEvents:sources.filter(s=>['scheduled-commitment','npc-schedule'].includes(s.type)).map(s=>({id:s.id,label:s.label,status:s.status})),
   unresolved:sources.filter(s=>!['scheduled-commitment','npc-schedule'].includes(s.type)).map(s=>({id:s.id,label:s.label,status:s.status}))});
  // Recheck all named dependencies after awaits; no query/list API exists here.
  const checked=await this.#plots(focus.data.sessionPlotRefs),checkedSources=await this.#sources(scope,refs),latestFocus=await this.#focus.read();
  if(await digest(checked)!==await digest(plots)||await digest(checkedSources)!==await digest(sources)||latestFocus.revision!==focus.revision)fail('SESSION_PREPARATION_STALE','Selected sources changed during preparation');
  if(this.#identity()!==owner)fail('SESSION_PREPARATION_OWNER','GM identity changed during assembly');
  return this.#domains.save({type:'review-plan',scope,id:sessionId,expectedRevision,sourceEventId,data:{kind:'session-preparation-v1',mode:'session-preparation',
   state:'editable-gm-preparation',ownerUserId:owner,title,focusRevision:focus.revision,plots,sources,brief,...editable,permission:'gm-only',published:false,effectsExecuted:0,gameEventsCreated:0}});
 }
 async edit({scope='world',sessionId,expectedRevision,sourceEventId,notes,agenda}={}){
  assertNarrativeId(sourceEventId);const row=await this.read({scope,sessionId});if(!row||row.revision!==expectedRevision)fail('REVISION_CONFLICT','Preparation changed before editing');
  const edits=this.#edits({notes,agenda},new Set([...row.data.sources.map(s=>s.id),...row.data.plots.map(p=>p.graphId),...row.data.agenda.flatMap(a=>a.referenceIds)]));
  this.#identity();return this.#domains.save({type:'review-plan',scope,id:sessionId,expectedRevision,sourceEventId,data:{...row.data,...edits}});
 }
 async sourceStatus({scope='world',sessionId}={}){
  const row=await this.read({scope,sessionId});if(!row)return null;const stale=[];
  const pins=await this.pins();if(pins.revision!==row.data.focusRevision)stale.push({kind:'pins',reason:'GM focus or preparation pins changed'});
  for(const plot of row.data.plots){
   try{const [current]=await this.#plots([plot]);if(current.fingerprint!==plot.fingerprint)stale.push({kind:'plot',id:plot.graphId});}
   catch(error){if(error.code!=='SESSION_PREPARATION_STALE')throw error;stale.push({kind:'plot',id:plot.graphId});}
  }
  for(const ref of row.data.sources){const current=await this.#domains.read(ref.type,scope,ref.id);if(!current||current.revision!==ref.revision||await digest(current)!==ref.fingerprint)stale.push({kind:'source',type:ref.type,id:ref.id});}
  return {sessionId,revision:row.revision,status:stale.length?'sources-changed':'current',stale,editable:true,published:false,effectsExecuted:0};
 }
}
