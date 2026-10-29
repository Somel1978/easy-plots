/** Portable full-graph adapter for the existing immutable blueprint catalog
 * and graph page store. Instance creation saves a linked draft only.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {createPortableTemplate,validatePortableTemplate,materializeTemplate,templateDigest} from '../graph/portable-template.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export class PortableGraphTemplates {
 #catalog;#pages;#registry;#domains;#gm;#writer;
 constructor({catalog,pages,registry,domains,gmProvider,writer}={}){
  if(typeof catalog?.publish!=='function'||typeof catalog?.getRevision!=='function'||typeof catalog?.instantiate!=='function'||typeof pages?.publish!=='function'||typeof pages?.getGraph!=='function'||typeof registry?.getPublished!=='function'||typeof registry?.getDraft!=='function'||typeof registry?.saveDraft!=='function'||typeof domains?.read!=='function'||typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function')fail('TEMPLATE_DEPENDENCY','Protected blueprint, graph page/draft and GM services required');
  this.#catalog=catalog;this.#pages=pages;this.#registry=registry;this.#domains=domains;this.#gm=gmProvider;this.#writer=writer;
 }
 #authority(){const gm=this.#gm();assertLocalGM(gm);this.#writer.assertEligible(gm);}
 async exportGraph({graphId,publishedVersion,blueprintId,revision}={}){
  this.#authority();const graph=await this.#registry.getPublished(graphId,publishedVersion);if(!graph)fail('TEMPLATE_SOURCE_MISSING','Exact immutable source graph required');
  const portable=await createPortableTemplate(graph,{blueprintId,revision});this.#authority();return portable;
 }
 async store({scope='world',template,sourceEventId}={}){
  this.#authority();template=await validatePortableTemplate(template);assertNarrativeId(sourceEventId);
  const fields={templateFormat:template.formatVersion,templateFingerprint:template.fingerprint,graphRef:{id:template.graph.id,revision:template.revision},slots:template.slots,instanceGraphId:null,instanceSpecDigest:null};
  if(new TextEncoder().encode(JSON.stringify(fields)).length>5000)fail('TEMPLATE_CATALOG_BUDGET','Template binding manifest exceeds its bounded catalog record');
  const existing=await this.#catalog.getRevision({scope,blueprintId:template.blueprintId,revision:template.revision});
  if(existing){if(await templateDigest(existing.data.fields)!==await templateDigest(fields))fail('BLUEPRINT_IMMUTABLE','Stored template revision has different content');return existing;}
  this.#authority();await this.#pages.publish(template.graph,{revision:template.revision,capabilities:template.graph.requiredCapabilityIds??[]});
  return this.#catalog.publish({scope,blueprintId:template.blueprintId,revision:template.revision,fields,sourceEventId,expectedPreviousRevision:template.revision===1?null:template.revision-1});
 }
 async exportStored({scope='world',blueprintId,revision}={}){
  this.#authority();const source=await this.#catalog.getRevision({scope,blueprintId,revision}),fields=source?.data.fields;
  if(!fields||fields.templateFormat!=='1.0.0'||!fields.graphRef||!Array.isArray(fields.slots))fail('TEMPLATE_SOURCE_MISSING','Published graph template required');
  const graph=await this.#pages.getGraph(fields.graphRef.id,fields.graphRef.revision);if(!graph)fail('TEMPLATE_SOURCE_MISSING','Template graph pages are unavailable');
  return validatePortableTemplate({format:'easy-plots-graph-template',formatVersion:fields.templateFormat,blueprintId,revision,graph,slots:fields.slots,fingerprint:fields.templateFingerprint});
 }
 async previewInstance({scope='world',blueprintId,revision,instanceId,bindings={},title}={}){
  this.#authority();const input=clone({instanceId,bindings,...(title===undefined?{}:{title})}),template=await this.exportStored({scope,blueprintId,revision});
  const graph=await materializeTemplate(template,input);this.#authority();return {graph,templateFingerprint:template.fingerprint,instanceSpecDigest:await templateDigest(graph),activated:false,nativeResourcesCreated:0};
 }
 async instantiate(spec={}, {approved=false,expectedFingerprint}={}){
  if(approved!==true)fail('TEMPLATE_REVIEW_REQUIRED','Explicit GM review of the instance bindings is required');
  const input=clone(spec),preview=await this.previewInstance(input),scope=input.scope??'world';
  if(preview.instanceSpecDigest!==expectedFingerprint)fail('TEMPLATE_REVIEW_STALE','Instance bindings differ from the reviewed preview');
  const graph=preview.graph,oldDraft=await this.#registry.getDraft(graph.id);
  if(oldDraft&&await templateDigest({...oldDraft,revision:0})!==preview.instanceSpecDigest)fail('TEMPLATE_INSTANCE_CONFLICT','Existing instance draft has local edits or different bindings');
  const previous=await this.#domains.read('blueprint-instance',scope,graph.id);
  if(previous){if(previous.data.blueprintId!==input.blueprintId||previous.data.sourceRevision!==input.revision||previous.data.fields.instanceSpecDigest!==preview.instanceSpecDigest||previous.data.fields.instanceGraphId!==graph.id)fail('TEMPLATE_INSTANCE_CONFLICT','Instance identity already belongs to a different reviewed template');}
  else{this.#authority();await this.#catalog.instantiate({scope,instanceId:graph.id,blueprintId:input.blueprintId,blueprintRevision:input.revision,sourceEventId:input.sourceEventId,overrides:{instanceGraphId:graph.id,instanceSpecDigest:preview.instanceSpecDigest}});}
  this.#authority();const draft=oldDraft??await this.#registry.saveDraft(graph,{expectedRevision:null});
  return {graphId:draft.id,draftRevision:draft.revision,blueprintId:input.blueprintId,blueprintRevision:input.revision,alreadyCreated:Boolean(oldDraft),activated:false,nativeResourcesCreated:0};
 }
}
