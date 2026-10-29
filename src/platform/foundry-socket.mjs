/**
 * Easy Plots v0.4 native module socket adapter.
 *
 * The supplied Foundry v14 server source shows that package custom socket events
 * append socket.user.id and that {recipients:[userId]} routes to recipient sessions.
 * NEVER derive identity from payload.senderUserId, actorId, or claimedUserId.
 *
 * This transport is an optional adapter: protected storage, durable intent queues,
 * multi-GM write fencing, and live hostile-client tests remain separate gates.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {PlayerIntentGate} from '../security/request-gate.mjs';
import {createLocalGMContext} from '../security/authority.mjs';
import {secureUUID} from '../contracts/digest.mjs';

export const MODULE_SOCKET = 'module.easy-plots';
const MAX_BYTES = 8192;
const ID_RE = /^[A-Za-z0-9_.:-]{8,160}$/;
const MAX_PENDING = 32;

const fail = (code, detail) => {throw new EasyPlotsError(code, detail);};
const isRecord = x => x && typeof x === 'object' && !Array.isArray(x);
const hasId = x => typeof x === 'string' && ID_RE.test(x);

/** Copy only public, player-controlled fields; reject oversized data. */
export function normalizePlayerIntent(input) {
  if (!isRecord(input)) fail('INVALID_INTENT','Intent must be an object');
  if (!hasId(input.requestId) || !hasId(input.actorId) || !hasId(input.opportunityId)) {
    fail('INVALID_INTENT','Invalid request or narrative reference');
  }
  if (input.approach !== undefined && typeof input.approach !== 'string') fail('INVALID_INTENT','Approach must be text');
  const approach = input.approach;
  if (approach !== undefined && approach.length > 1024) fail('INVALID_INTENT','Approach is too long');
  const intent = Object.freeze({
    requestId: input.requestId,
    actorId: input.actorId,
    opportunityId: input.opportunityId,
    ...(approach === undefined ? {} : {approach})
  });
  if (JSON.stringify(intent).length > MAX_BYTES) fail('INVALID_INTENT','Intent too large');
  return intent;
}

/**
 * Delivery is always to the server-recognized recipient IDs. No broadcast fallback.
 * An onAcceptedIntent callback MUST durably enqueue the accepted intent; otherwise
 * the adapter does not claim successful acceptance or simulate world writes.
 */
export class NativeFoundryIntentTransport {
  #game; #channel; #listener; #gate; #onAcceptedIntent; #randomId;
  #pending = new Map(); #active = false;

  constructor({gameInstance, channel=MODULE_SOCKET, actorAuthorization,
    onAcceptedIntent=null, randomId=secureUUID}={}) {
    this.#game=gameInstance;
    this.#channel=channel;
    this.#randomId=randomId;
    this.#onAcceptedIntent=onAcceptedIntent;
    // Native channel authentication is supplied by the server argument, not payload.
    this.#gate=new PlayerIntentGate({
      nativeProofVerifier: async (_intent,origin)=> origin.source==='verified-native-module-socket' &&
        origin.verified === true && origin.proofOfOrigin === 'foundry-v14-socket-server-sender',
      actorAuthorization: async (userId,actorId)=> {
        if (typeof actorAuthorization!=='function') return false;
        return await actorAuthorization(userId,actorId) === true;
      }
    });
  }

  get started(){return this.#active;}

  #designatedGM(){
    const gm=this.#game?.users?.activeGM;
    return gm?.active && gm.isGM && hasId(gm.id) ? gm : null;
  }

  start() {
    const socket=this.#game?.socket;
    if (!socket || typeof socket.on!=='function' || typeof socket.emit!=='function') {
      fail('SOCKET_UNAVAILABLE','Foundry game socket is unavailable');
    }
    if (this.#game?.modules?.get?.('easy-plots')?.socket !== true) {
      fail('SOCKET_NOT_REGISTERED','Module must declare socket: true in its manifest');
    }
    if (this.#active) return this;
    this.#listener=(packet,serverSenderId)=>{void this.#receive(packet,serverSenderId);};
    socket.on(this.#channel,this.#listener);
    this.#active=true;
    return this;
  }

  stop() {
    if (this.#listener && typeof this.#game.socket.off==='function') {
      this.#game.socket.off(this.#channel,this.#listener);
    }
    this.#listener=null;
    this.#active=false;
    for(const {reject,timeout} of this.#pending.values()) {
      clearTimeout(timeout);
      reject(new EasyPlotsError('TRANSPORT_STOPPED','Transport has stopped'));
    }
    this.#pending.clear();
  }

  #emitTo(userId, packet) {
    if (!this.#active || !hasId(userId)) fail('SOCKET_UNAVAILABLE','Verified recipient required');
    this.#game.socket.emit(this.#channel,packet,{recipients:[userId]});
  }

  /** Client-side submit, returns only a receipt, never private world information. */
  async submit({actorId,opportunityId,approach}, {timeoutMs=10000,requestId=null}={}) {
    if (this.#game?.user?.isGM) fail('PLAYER_ONLY','Use the GM approval interface instead');
    const gm=this.#designatedGM();
    if (!gm) fail('GM_UNAVAILABLE','No eligible GM connected');
    if (this.#pending.size>=MAX_PENDING) fail('BACKPRESSURE','Too many pending requests');
    // Retain this requestId when retrying after an uncertain network timeout.
    requestId ??= String(this.#randomId());
    const intent=normalizePlayerIntent({requestId,actorId,opportunityId,approach});
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{
        this.#pending.delete(requestId);
        reject(new EasyPlotsError('REQUEST_TIMEOUT','No durable receipt received'));
      },timeoutMs);
      this.#pending.set(requestId,{resolve,reject,timeout});
      try{this.#emitTo(gm.id,{kind:'intent.request',version:1,intent});}
      catch(err){clearTimeout(timeout);this.#pending.delete(requestId);reject(err);}
    });
  }

  async #receive(packet,senderId) {
    if (!this.#active || !isRecord(packet)) return;
    // Sender identity is the separate, server-added callback argument.
    if (!hasId(senderId) || !this.#game?.users?.get?.(senderId)) return;
    if (packet.kind === 'intent.receipt') return this.#receiveReceipt(packet,senderId);
    if (packet.kind !== 'intent.request') return;
    if (!this.#game.user?.isGM || this.#designatedGM()?.id!==this.#game.user.id) return;
    if (senderId === this.#game.user.id || this.#game.users.get(senderId)?.isGM) return;
    let intent;
    try{intent=normalizePlayerIntent(packet.intent);}catch{return;}
    if (typeof this.#onAcceptedIntent!=='function') return; // No durable queue.
    const gm=this.#game.user;
    try {
      const context=createLocalGMContext({user:gm,epoch:`${this.#game.world?.id??'world'}:transport`},
        this.#game.world?.id??'unknown-world');
      const result=await this.#gate.accept(intent,{
        source:'verified-native-module-socket',verified:true,userId:senderId,
        proofOfOrigin:'foundry-v14-socket-server-sender'
      },context);
      // Callback MUST persist idempotently by (verified user, request ID).
      // Returning without a durable acknowledged write is not accepted.
      const durable=await this.#onAcceptedIntent({...result,intent,verifiedUserId:senderId});
      if (durable?.durable !== true) throw new EasyPlotsError('NOT_DURABLE','Queue did not confirm persistence');
      // Duplicate requests whose durable lifecycle has already ended cannot
      // be presented as new pending requests. No private status is disclosed.
      const publicState = durable.state === undefined || durable.state === 'pending' ? 'pending' : 'rejected';
      this.#emitTo(senderId,{kind:'intent.receipt',version:1,requestId:intent.requestId,state:publicState});
    } catch {
      this.#emitTo(senderId,{kind:'intent.receipt',version:1,requestId:intent.requestId,state:'rejected'});
    }
  }

  #receiveReceipt(packet,senderId){
    const gm=this.#designatedGM();
    if(!gm || senderId!==gm.id || this.#game.user?.isGM) return;
    if (!hasId(packet.requestId) || !['pending','rejected'].includes(packet.state)) return;
    const request=this.#pending.get(packet.requestId);
    if(!request)return;
    this.#pending.delete(packet.requestId);
    clearTimeout(request.timeout);
    request.resolve(Object.freeze({requestId:packet.requestId,state:packet.state}));
  }
}
