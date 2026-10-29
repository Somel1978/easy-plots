/** Registered, versioned, lazily instantiated *logic-only* narrative node types.
 * Extension evaluators cannot execute native effects; only boolean/typed flow
 * decisions can leave this boundary. Consequences still go through approved
 * effect provider nodes and the durable GM review journal.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {clone,assertPlainObject,deepFreeze} from '../contracts/record.mjs';
import {contractHash,callableContract,isContractFingerprint} from './dependency-contracts.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const TYPE=/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;
const VERSION=/^\d+\.\d+\.\d+$/;
export class NarrativeNodeExtensions {
  #registered=new Map();#loaders=new Map();
  register({typeId,version='1.0.0',contractFingerprint,label,ports,defaultData={},validate,evaluate}={}){
    if(typeof typeId!=='string'||!TYPE.test(typeId)||typeId.startsWith('core.')||typeId.length>100)
      fail('EXTENSION_TYPE','Versioned non-core namespaced type required');
    if(!VERSION.test(version)||typeof label!=='string'||label.length>80||
      !Array.isArray(ports)||ports.length<1||ports.length>12||
      typeof validate!=='function'||typeof evaluate!=='function')fail('EXTENSION_CONTRACT','Complete typed evaluator contract required');
    if(this.#registered.has(typeId))fail('EXTENSION_DUPLICATE','Extension already registered');
    const ids=new Set();for(const p of ports){
      if(!p||typeof p.id!=='string'||ids.has(p.id)||!['input','output'].includes(p.direction)||
        !['event','boolean','number','string','entity'].includes(p.valueType)||
        !['gm','gm-secret'].includes(p.accessClass))fail('EXTENSION_PORT','Invalid typed port');
      ids.add(p.id);
    }
    assertPlainObject(defaultData,'EXTENSION_DATA');
    if(contractFingerprint!==undefined&&!isContractFingerprint(contractFingerprint))fail('EXTENSION_CONTRACT','Explicit contract fingerprint must be SHA-256');
    contractFingerprint??=contractHash({typeId,version,ports,defaultData,callbacks:callableContract({validate,evaluate})});
    const entry=deepFreeze({typeId,version,contractFingerprint,label,ports:clone(ports),defaultData:clone(defaultData),validate,evaluate});
    this.#registered.set(typeId,entry);return {typeId,version};
  }
  registerLazy(typeId,loader){
    if(typeof typeId!=='string'||!TYPE.test(typeId)||typeId.startsWith('core.')||typeof loader!=='function'||
      this.#loaders.has(typeId)||this.#registered.has(typeId))fail('EXTENSION_CONTRACT','Unique lazy extension loader required');
    this.#loaders.set(typeId,loader);
  }
  get(typeId){return this.#registered.get(typeId)??null;}
  contract(typeId){const p=this.get(typeId);return p?{id:typeId,version:p.version,fingerprint:p.contractFingerprint}:null;}
  list(){return [...this.#registered.values()].map(e=>({id:e.typeId,label:e.label,version:e.version}));}
  async load(typeId){
    if(this.#registered.has(typeId))return this.#registered.get(typeId);
    const loader=this.#loaders.get(typeId);if(!loader)fail('EXTENSION_UNAVAILABLE','Requested extension has no registered provider');
    const factory=await loader();
    if(!this.#registered.has(typeId)){
      if(factory?.typeId!==typeId)fail('EXTENSION_CONTRACT','Loader supplied wrong declared type');
      this.register(factory);
    }
    this.#loaders.delete(typeId);
    return this.get(typeId);
  }
  validateNode(node){
    const provider=this.get(node.typeId);
    if(!provider)fail('EXTENSION_UNAVAILABLE','Published node extension is not registered');
    if(node.providerVersion!==provider.version)fail('EXTENSION_VERSION','Published node requires a different provider version');
    if(JSON.stringify(node.ports)!==JSON.stringify(provider.ports))fail('EXTENSION_PORT','Node ports differ from registered contract');
    assertPlainObject(node.data,'EXTENSION_DATA');
    if(JSON.stringify(node.data).length>4096)fail('EXTENSION_BUDGET','Extension data exceeds bounded contract size');
    provider.validate(node.data);
    return true;
  }
  async route(node,{event,gmContext}={}){
    const provider=this.get(node.typeId);this.validateNode(node);
    if(!gmContext?.kind||gmContext.kind!=='ep-gm-context-v1')fail('GM_REQUIRED','Logic extensions may evaluate only in GM runtime');
    // No effect journal, document mutation or provider API is given to evaluator.
    const result=await provider.evaluate(clone(node.data),Object.freeze({eventId:event?.id,eventType:event?.eventType,
      payload:clone(event?.payload??{})}));
    if(result===false)return {pass:false,allowedPorts:[]};
    if(result===true)return {pass:true,allowedPorts:null};
    if(!result||typeof result!=='object'||!Array.isArray(result.allowedPorts)||result.allowedPorts.length>12||
      result.allowedPorts.some(p=>typeof p!=='string'||!node.ports.some(port=>port.id===p&&port.direction==='output'))||
      Object.keys(result).some(k=>k!=='allowedPorts'))fail('EXTENSION_RESULT','Extension may return only a bounded flow decision');
    return {pass:true,allowedPorts:result.allowedPorts};
  }
}
