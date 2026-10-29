import {assertLocalGM} from '../security/authority.mjs';
import {EasyPlotsError} from '../contracts/errors.mjs';
export class EffectCoordinator {
  constructor({journal,providers}){this.journal=journal;this.providers=providers;}
  async execute(spec,gmContext){
    assertLocalGM(gmContext);
    if(!spec?.operationId||!spec?.idempotencyKey||!spec?.providerId)throw new EasyPlotsError('INVALID_EFFECT','Missing effect contract');
    const provider=this.providers.get(spec.providerId);
    if(!provider || typeof provider.apply!=='function' || typeof provider.verify!=='function')throw new EasyPlotsError('MISSING_CAPABILITY','Provider lacks apply/verify contract');
    if(typeof provider.validate==='function')provider.validate(spec.payload);
    // The identity is trusted only after it is bound to a durable journal record.
    const effectContext={...gmContext,operationId:spec.operationId,sourceEventId:spec.sourceEventId,graphId:spec.graphId,nodeId:spec.nodeId};
    const existing=await this.journal.createOnce(spec.idempotencyKey,{...spec,state:'prepared',attempts:0});
    if(!existing.created) {
      if(existing.record.state==='completed')return {status:'already-completed',record:existing.record};
      return {status:'reconciliation-required',record:existing.record};
    }
    const applied=await this.journal.change(spec.idempotencyKey,'prepared',{state:'applying',attempts:1});
    try {
      const nativeReceipt=await provider.apply(spec.payload,effectContext);
      await this.journal.change(spec.idempotencyKey,'applying',{state:'verifying',nativeReceipt});
    } catch(err) {
      // An exception or lost acknowledgement cannot establish that a native mutation was not applied.
      const record=await this.journal.change(spec.idempotencyKey,'applying',{state:'uncertain',failureCode:'APPLY_OR_ACK_FAILED'});
      return {status:'uncertain',record};
    }
    try {
      const verified=await provider.verify(spec.payload,effectContext);
      if(verified!==true)throw new Error('verification not confirmed');
      const record=await this.journal.change(spec.idempotencyKey,'verifying',{state:'completed',verification:'confirmed'});
      return {status:'completed',record};
    } catch(err) {
      const record=await this.journal.change(spec.idempotencyKey,'verifying',{state:'uncertain',failureCode:'VERIFICATION_FAILED'});
      return {status:'uncertain',record};
    }
  }
}
