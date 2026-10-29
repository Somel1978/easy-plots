import {assertAttestedPlayerOrigin,assertLocalGM} from './authority.mjs';
import {EasyPlotsError} from '../contracts/errors.mjs';
export class PlayerIntentGate {
  constructor({nativeProofVerifier=null, actorAuthorization=null}={}) {
    this.nativeProofVerifier=nativeProofVerifier;
    this.actorAuthorization=actorAuthorization;
  }
  async accept(sourceRecord, origin, context) {
    assertLocalGM(context);
    assertAttestedPlayerOrigin(origin);
    if (!this.nativeProofVerifier || !this.actorAuthorization) throw new EasyPlotsError('NATIVE_SPIKE_UNVERIFIED','Trusted Foundry player request path is not configured');
    const validOrigin=await this.nativeProofVerifier(sourceRecord,origin);
    if (validOrigin !== true) throw new EasyPlotsError('ORIGIN_UNVERIFIED','Native origin proof failed');
    if (!await this.actorAuthorization(origin.userId,sourceRecord?.actorId)) throw new EasyPlotsError('DENIED','Actor authorization failed');
    return Object.freeze({verifiedUserId:origin.userId,actorId:sourceRecord.actorId,requestId:sourceRecord.requestId,approved:false});
  }
}
