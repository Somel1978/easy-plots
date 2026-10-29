/** Authenticated GM authoring commands. One designated physical writer; plot
 * authority belongs to the requesting GM. Unknown mutations never auto-replay. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {clone} from '../contracts/record.mjs';
import {sha256Hex,secureUUID} from '../contracts/digest.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export const GM_AUTHORING_METHODS=Object.freeze({getDraft:1,listDrafts:1,getPublished:2,getActivation:1,getActive:1,saveDraft:2,publish:2,activate:3,deactivate:2,validateCandidate:2,inspectValidation:2,adoptPublishedDependencies:3,inspectAuthority:1,updateAuthority:1,adoptLegacyAuthority:1,inspectCommand:1,getAppearance:1,saveAppearance:1});
const MUTATIONS=new Set(['saveDraft','publish','activate','deactivate','validateCandidate','adoptPublishedDependencies','updateAuthority','adoptLegacyAuthority','saveAppearance']);
const ID=/^[A-Za-z0-9_.:-]{8,160}$/;
const fields={saveDraft:['expectedRevision'],publish:['expectedRevision','capabilities','acknowledgeWarnings'],validateCandidate:['expectedRevision','capabilities','expectedValidationRevision'],inspectValidation:['capabilities'],adoptPublishedDependencies:['approved','expectedExecutionFingerprint','reason','capabilities','acknowledgeWarnings'],activate:['expectedActivationRevision','capabilities'],deactivate:['expectedActivationRevision'],listDrafts:['cursor','limit'],updateAuthority:['graphId','expectedRevision','delegates','ownerUserId','recover','reason'],adoptLegacyAuthority:['graphId','expectedRevision','expectedDraftRevision','ownerUserId','reason'],saveAppearance:['graphId','publishedVersion','expectedActivationRevision','expectedRevision','title','nodes']};
export function normalizeGMAuthoringCommand(method,args){
 if(!Object.hasOwn(GM_AUTHORING_METHODS,method)||!Array.isArray(args)||args.length!==GM_AUTHORING_METHODS[method])fail('GM_COMMAND_INVALID','An allowed, bounded authoring command is required');
 const visit=(v,depth=0)=>{if(depth>40)fail('GM_COMMAND_INVALID','Command nesting exceeds its budget');if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;if(Array.isArray(v)){for(const x of v)visit(x,depth+1);return;}if(!v||Object.getPrototypeOf(v)!==Object.prototype)fail('GM_COMMAND_INVALID','Only plain JSON command values are allowed');for(const [k,x] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))fail('GM_COMMAND_INVALID','Unsafe object key');visit(x,depth+1);}};
 visit(args);const json=JSON.stringify(args);if(new TextEncoder().encode(json).length>890_000)fail('GM_COMMAND_BUDGET','Authoring command exceeds its transport budget');
 const input=JSON.parse(json),opts=['activate','adoptPublishedDependencies'].includes(method)?input[2]:['saveDraft','publish','deactivate','validateCandidate','inspectValidation'].includes(method)?input[1]:fields[method]?input[0]:null;
 if(method==='inspectCommand'&&!ID.test(input[0]??''))fail('GM_COMMAND_INVALID','Exact original request identity required');
 if(fields[method]&&(!opts||Array.isArray(opts)||typeof opts!=='object'||Object.keys(opts).some(k=>!fields[method].includes(k))))fail('GM_COMMAND_INVALID','Only explicit authoring options are allowed');
 return input;
}
export class GMPlotAuthoring {
 #registry;#authority;#domains;#game;#writer;#gm;#appearance;#tail=Promise.resolve();#queued=0;
 constructor({registry,authority,domains,gameInstance,writer,gmProvider,appearance=null}={}){if(!registry?.saveDraft||!authority?.issueRequester||!domains?.save||!writer?.assertEligible||typeof gmProvider!=='function')fail('GM_COMMAND_DEPENDENCY','Protected authoring dependencies required');this.#registry=registry;this.#authority=authority;this.#domains=domains;this.#game=gameInstance;this.#writer=writer;this.#gm=gmProvider;this.#appearance=appearance;}
 #check(userId,generation){const gm=this.#gm();this.#writer.assertEligible(gm);const user=this.#game.users?.get?.(userId);if(!user?.isGM||!user.active||gm.userId!==this.#game.user?.id||gm.worldId!==this.#game.world?.id||generation!==(this.#writer.state?.generation??0))fail('GM_COMMAND_AUTHORITY','GM requester or coordinator authority changed');}
 async executeLocal(method,args,{requestId=`gm-authoring-${secureUUID()}`}={}){return this.execute({method,args,requestId,verifiedUserId:this.#game.user?.id});}
 async execute({method,args,requestId,verifiedUserId}={}){
  if(!ID.test(requestId??'')||!ID.test(verifiedUserId??''))fail('GM_COMMAND_INVALID','Exact native request and sender identities required');
  args=normalizeGMAuthoringCommand(method,args);const generation=this.#writer.state?.generation??0;this.#check(verifiedUserId,generation);
  const requesterContext=this.#authority.issueRequester({verifiedUserId,requestId});if(this.#queued>=8)fail('BACKPRESSURE','Authoring command queue is full');this.#queued++;
  const result=this.#tail.then(()=>this.#run({method,args,requestId,verifiedUserId,generation,requesterContext}));this.#tail=result.catch(()=>{});try{return await result;}finally{this.#queued--;}
 }
 async #run({method,args,requestId,verifiedUserId,generation,requesterContext}){
  const check=()=>this.#check(verifiedUserId,generation);check();const mutation=MUTATIONS.has(method),scope=this.#registry.scope,graphId=method==='saveDraft'?args[0]?.id:method==='saveAppearance'||method.endsWith('Authority')&&method!=='inspectAuthority'?args[0]?.graphId:['listDrafts','inspectCommand'].includes(method)?null:args[0];let journal=null,id;
  if(mutation){
   id=`ep:gm-command:${(await sha256Hex(`${this.#game.world.id}|${scope}|${verifiedUserId}|${requestId}`)).slice(0,28)}`;const argsDigest=await sha256Hex(JSON.stringify({method,args}));check();const prior=await this.#domains.read('gm-authoring-request',scope,id);check();
   if(prior){if(prior.data.requestId!==requestId||prior.data.requesterUserId!==verifiedUserId||prior.data.method!==method||prior.data.argsDigest!==argsDigest)fail('GM_COMMAND_CONFLICT','A request identity cannot be reused for another command');if(prior.data.state==='completed')return {replayed:true,value:null,authority:null,receipt:clone(prior.data)};fail('GM_COMMAND_UNCERTAIN','The original command requires review; it will not be repeated');}
   if(await this.#domains.hasRecordOrIndex('gm-authoring-request',scope,id))fail('GM_COMMAND_UNCERTAIN','An earlier command write may exist; reconcile storage before review');check();
   journal=await this.#domains.save({type:'gm-authoring-request',scope,id,expectedRevision:null,sourceEventId:`ep:event:gm_command_${secureUUID().replaceAll('-','_')}`,data:{state:'prepared',requestId,requesterUserId:verifiedUserId,coordinatorUserId:this.#game.user.id,method,argsDigest,graphId}});check();
  }
  try{
   let value;
   if(method==='inspectCommand'){const commandId=`ep:gm-command:${(await sha256Hex(`${this.#game.world.id}|${scope}|${verifiedUserId}|${args[0]}`)).slice(0,28)}`;value=await this.#domains.read('gm-authoring-request',scope,commandId);if(!value&&await this.#domains.hasRecordOrIndex('gm-authoring-request',scope,commandId))fail('GM_COMMAND_UNCERTAIN','Known command index needs protected storage reconciliation');}
   else if(method==='inspectAuthority')value=await this.#authority.inspect(graphId,{requesterContext});
   else if(method==='getAppearance'||method==='saveAppearance'){if(!this.#appearance)fail('APPEARANCE_UNAVAILABLE','Live presentation service is unavailable');value=method==='getAppearance'?await this.#appearance.read(graphId):await this.#appearance.save(args[0],{requesterContext});}
   else if(method==='updateAuthority')value=await this.#authority.update({...args[0],requesterContext});
   else if(method==='adoptLegacyAuthority')value=await this.#authority.adoptLegacy({...args[0],requesterContext});
   else if(['saveDraft','publish','deactivate','validateCandidate','inspectValidation'].includes(method))value=await this.#registry[method](args[0],{...args[1],requesterContext});
   else if(method==='activate'||method==='adoptPublishedDependencies')value=await this.#registry[method](args[0],args[1],{...args[2],requesterContext});
   else value=await this.#registry[method](...args);
   check();const authority=graphId?await this.#authority.inspect(graphId,{requesterContext}):null;check();
   if(mutation){journal=await this.#domains.save({type:'gm-authoring-request',scope,id,expectedRevision:journal.revision,sourceEventId:journal.sourceEventId,data:{...journal.data,state:'completed',result:{id:value?.id??null,revision:value?.revision??null,publishedVersion:value?.publishedVersion??null}}});check();}
   return {value,authority,receipt:journal?clone(journal.data):null,replayed:false};
  }catch(error){
   if(journal?.data.state==='prepared'){try{check();await this.#domains.save({type:'gm-authoring-request',scope,id,expectedRevision:journal.revision,sourceEventId:journal.sourceEventId,data:{...journal.data,state:'uncertain',failureCode:typeof error?.code==='string'?error.code.slice(0,80):'GM_COMMAND_FAILED'}});}catch{}}
   throw error;
  }
 }
}

/** Same editor contract on the coordinator and on another authenticated GM. */
export class GMPlotRegistryClient {
 #invoke;#rights=new Map();#scope;#localGM;
 constructor({invoke,scope='main',isLocalGM=()=>true}={}){if(typeof invoke!=='function')fail('GM_COMMAND_DEPENDENCY','Authoring command invocation required');this.#invoke=invoke;this.#scope=scope;this.#localGM=isLocalGM;}
 get scope(){return this.#scope;}
 authoringRights(graphId){return this.#localGM()?clone(this.#rights.get(graphId)?.rights??{edit:true,publish:true,activate:true}):{edit:false,publish:false,activate:false};}
 assertLocalAuthoring(graphId,action){if(!this.authoringRights(graphId)[action])fail('PLOT_AUTHORING_DENIED','This GM cannot edit this plot');}
 async #call(method,args){if(!this.#localGM())fail('GM_COMMAND_AUTHORITY','Current GM authority required');const response=await this.#invoke(method,args);if(!this.#localGM())fail('GM_COMMAND_AUTHORITY','GM authority changed');if(response.replayed)fail('GM_COMMAND_ALREADY_COMPLETED','This command already completed. Refresh the graph to inspect its result.');if(response.authority)this.#rights.set(response.authority.graphId,clone(response.authority));return response.value;}
 getDraft(id){return this.#call('getDraft',[id]);}listDrafts(opts={}){return this.#call('listDrafts',[opts]);}getPublished(id,version){return this.#call('getPublished',[id,version]);}getActivation(id){return this.#call('getActivation',[id]);}getActive(id){return this.#call('getActive',[id]);}
 saveDraft(graph,opts={}){return this.#call('saveDraft',[graph,opts]);}publish(id,opts={}){return this.#call('publish',[id,opts]);}activate(id,version,opts={}){return this.#call('activate',[id,version,opts]);}deactivate(id,opts={}){return this.#call('deactivate',[id,opts]);}
 validateCandidate(id,opts={}){return this.#call('validateCandidate',[id,opts]);}inspectValidation(id,opts={}){return this.#call('inspectValidation',[id,opts]);}adoptPublishedDependencies(id,version,opts={}){return this.#call('adoptPublishedDependencies',[id,version,opts]);}
 inspectAuthority(id){return this.#call('inspectAuthority',[id]);}updateAuthority(input){return this.#call('updateAuthority',[input]);}adoptLegacyAuthority(input){return this.#call('adoptLegacyAuthority',[input]);}
 inspectCommand(requestId){return this.#call('inspectCommand',[requestId]);}
 getAppearance(graphId){return this.#call('getAppearance',[graphId]);}saveAppearance(input){return this.#call('saveAppearance',[input]);}
}
