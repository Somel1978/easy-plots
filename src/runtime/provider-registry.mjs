/** Exact, explicitly registered effect capabilities. No arbitrary script evaluation. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {contractHash,callableContract,isContractFingerprint} from '../graph/dependency-contracts.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export class EffectProviderRegistry {
  #items=new Map();
  register({id,version='1.0.0',contractFingerprint,apply,verify,validate,get,previewLegacyAdoption,adoptLegacy,confirmOriginal}={}) {
    if(typeof id!=='string'||!/^([a-z][a-z0-9-]*\.)+[a-z][a-z0-9-]*$/.test(id)||id.length>100)
      fail('INVALID_PROVIDER','A namespaced provider ID is required');
    if(!/^\d+\.\d+\.\d+$/.test(version))fail('INVALID_PROVIDER','A semantic provider version is required');
    if(typeof apply!=='function'||typeof verify!=='function'||typeof validate!=='function')
      fail('INVALID_PROVIDER','Provider needs validate, apply and verify contracts');
    if(this.#items.has(id))fail('DUPLICATE_PROVIDER','Provider identifier already registered');
    if(get!==undefined&&typeof get!=='function')fail('INVALID_PROVIDER','Optional provider reader must be a function');
    for(const fn of [previewLegacyAdoption,adoptLegacy])if(fn!==undefined&&typeof fn!=='function')fail('INVALID_PROVIDER','Optional migration capabilities must be functions');
    if(confirmOriginal!==undefined&&typeof confirmOriginal!=='function')fail('INVALID_PROVIDER','Optional original-outcome confirmation must be callable');
    if(contractFingerprint!==undefined&&!isContractFingerprint(contractFingerprint))fail('INVALID_PROVIDER','Explicit contract fingerprint must be SHA-256');
    // An explicit fingerprint also binds policy captured by a provider closure.
    // Closed-over configuration changes require a version/fingerprint change.
    contractFingerprint??=contractHash({id,version,callbacks:callableContract({apply,verify,validate,get,previewLegacyAdoption,adoptLegacy,confirmOriginal})});
    const provider=Object.freeze({id,version,contractFingerprint,apply,verify,validate,...(get?{get}:{}),...(previewLegacyAdoption?{previewLegacyAdoption}:{}),...(adoptLegacy?{adoptLegacy}:{}),...(confirmOriginal?{confirmOriginal}:{})});
    this.#items.set(id,provider);return provider;
  }
  get(id){return this.#items.get(id);}
  has(id){return this.#items.has(id);}
  contract(id){const p=this.#items.get(id);return p?{id:p.id,version:p.version,fingerprint:p.contractFingerprint}:null;}
  list(){return [...this.#items.values()].map(({id,version})=>({id,version}));}
}
