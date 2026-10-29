/** Version-bound GM presentation only. The evaluator never reads this store. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {sha256Hex,secureUUID} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export class LiveGraphAppearance {
 #domains;#registry;#gm;#writer;
 constructor({domains,registry,gmProvider,writer}={}){if(!domains?.hasRecordOrIndex||!registry?.authorizeMutation||!registry?.getActive||typeof gmProvider!=='function'||!writer?.assertEligible)fail('APPEARANCE_DEPENDENCY','Protected presentation store, plot policy and GM writer required');this.#domains=domains;this.#registry=registry;this.#gm=gmProvider;this.#writer=writer;}
 #authority(){const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);return gm;}
 async #key(graphId,version){return `ep:graph-appearance:${(await sha256Hex(`${this.#registry.scope}|${graphId}|${version}`)).slice(0,28)}`;}
 #fields(value,graph){
  if(!value||Object.keys(value).sort().join(',')!=='nodes,title'||!(value.title===null||text(value.title,100))||!Array.isArray(value.nodes)||value.nodes.length>64||new Set(value.nodes.map(n=>n?.nodeId)).size!==value.nodes.length)fail('APPEARANCE_FIELDS','Only an optional title and up to64 distinct node labels/positions are allowed');
  for(const n of value.nodes){if(!n||Object.keys(n).some(k=>!['nodeId','label','layout'].includes(k))||!graph.nodes.some(row=>row.id===n.nodeId)||!(n.label===undefined||text(n.label,100))||!(n.layout===undefined||n.layout&&Object.keys(n.layout).sort().join(',')==='x,y'&&Number.isFinite(n.layout.x)&&Number.isFinite(n.layout.y)&&n.layout.x>=0&&n.layout.x<=15000&&n.layout.y>=0&&n.layout.y<=30000)||n.label===undefined&&n.layout===undefined)fail('APPEARANCE_FIELDS','Only existing node labels and bounded coordinates may change');}return clone(value);
 }
 async read(graphId){
  this.#authority();assertNarrativeId(graphId);const activation=await this.#registry.getActivation(graphId),graph=await this.#registry.getActive(graphId);if(!activation?.active||!graph||graph.publishedVersion!==activation.publishedVersion)fail('APPEARANCE_INACTIVE','An active immutable graph is required');const id=await this.#key(graphId,graph.publishedVersion),row=await this.#domains.read('graph-appearance',this.#registry.scope,id);if(!row&&await this.#domains.hasRecordOrIndex('graph-appearance',this.#registry.scope,id))fail('APPEARANCE_UNCERTAIN','Known presentation index needs reconciliation');
  const snapshotDigest=await sha256Hex(JSON.stringify(graph));if(row&&(row.data.graphId!==graphId||row.data.publishedVersion!==graph.publishedVersion||row.data.snapshotDigest!==snapshotDigest))fail('APPEARANCE_STALE','Presentation no longer matches its exact immutable snapshot');const appearance=this.#fields(row?.data.appearance??{title:null,nodes:[]},graph),display=clone(graph);if(appearance.title!==null)display.title=appearance.title;for(const patch of appearance.nodes){const node=display.nodes.find(n=>n.id===patch.nodeId);if(patch.label!==undefined)node.label=patch.label;if(patch.layout!==undefined)node.layout=clone(patch.layout);}
  this.#authority();return {graphId,publishedVersion:graph.publishedVersion,activationRevision:activation.revision,revision:row?.revision??null,snapshotDigest,appearance,graph:display};
 }
 async save(input,{requesterContext=null}={}){
  input=clone(input);if(!input||Object.keys(input).some(k=>!['graphId','publishedVersion','expectedActivationRevision','expectedRevision','title','nodes'].includes(k)))fail('APPEARANCE_FIELDS','Structural graph fields cannot be changed by a live appearance edit');const {graphId,publishedVersion,expectedActivationRevision,expectedRevision,title,nodes}=input;
  await this.#registry.authorizeMutation(graphId,'edit',{requesterContext});const before=await this.read(graphId);if(before.publishedVersion!==publishedVersion||before.activationRevision!==expectedActivationRevision||before.revision!==expectedRevision)fail('REVISION_CONFLICT','Active graph or presentation changed since review');const appearance=this.#fields({title,nodes},before.graph),id=await this.#key(graphId,publishedVersion);await this.#registry.authorizeMutation(graphId,'edit',{requesterContext});const active=await this.#registry.getActivation(graphId);if(active?.revision!==expectedActivationRevision||!active.active||active.publishedVersion!==publishedVersion)fail('REVISION_CONFLICT','Activation changed during presentation review');const gm=this.#authority();return this.#domains.save({type:'graph-appearance',scope:this.#registry.scope,id,expectedRevision,sourceEventId:`ep:event:appearance_${secureUUID().replaceAll('-','_')}`,data:{graphId,publishedVersion,snapshotDigest:before.snapshotDigest,appearance,editedBy:requesterContext?.userId??gm.userId}});
 }
}
