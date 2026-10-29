/**
 * One designated GM serializes local writes. This is NOT a distributed lock.
 * Handover and split-brain require external verification: fail closed when
 * designated GM changes or after uncertain completion.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertLocalGM} from './authority.mjs';
const err=(code,message)=>{throw new EasyPlotsError(code,message);};
export class DesignatedGMWriter {
  #game;#suspended=false;#reason=null;#tail=Promise.resolve();#generation=0;#designatedGM=null;#observedTopology=false;#hooks=null;#hookIds=[];
  constructor({gameInstance}){this.#game=gameInstance;}
  get state(){return Object.freeze({suspended:this.#suspended,reason:this.#reason,
    generation:this.#generation,designatedGM:this.#designatedGM,observedTopology:this.#observedTopology});}
  /**
   * Any observed change in designated writer suspends local writes, even when
   * the same GM later becomes active again. It is a fencing aid, NOT a
   * server-enforced distributed lock or a complete guarantee against split brain.
   */
  observeCoordinator(){
    const active=this.#game?.users?.activeGM;
    const next=active?.active&&active?.isGM?active.id:null;
    if(!this.#observedTopology){this.#observedTopology=true;this.#designatedGM=next;return this.state;}
    if(next!==this.#designatedGM){this.#designatedGM=next;this.suspend('GM_COORDINATOR_CHANGED');}
    return this.state;
  }
  /** Subscribe to Foundry User lifecycle changes to detect transient handover. */
  watchHooks(HooksInstance){
    if(this.#hooks)err('GM_WATCH_ALREADY_STARTED','Coordinator observer is already installed');
    if(typeof HooksInstance?.on!=='function'||typeof HooksInstance?.off!=='function')
      err('GM_HOOKS_UNAVAILABLE','Foundry Hooks.on/off required for coordinator monitoring');
    this.observeCoordinator();
    const check=()=>this.observeCoordinator();
    this.#hooks=HooksInstance;
    for(const name of ['updateUser','createUser','deleteUser'])this.#hookIds.push([name,HooksInstance.on(name,check)]);
    return this.state;
  }
  stopWatching(){
    if(!this.#hooks)return;
    for(const [name,id] of this.#hookIds)this.#hooks.off(name,id);
    this.#hooks=null;this.#hookIds=[];
  }
  assertEligible(context){
    assertLocalGM(context);
    const wasSuspended=this.#suspended;
    this.observeCoordinator();
    if(!wasSuspended&&this.#suspended)err('GM_HANDOVER_UNCERTAIN','Active GM changed; operation requires reconciliation');
    if(this.#suspended)err('GM_WRITE_SUSPENDED',this.#reason??'GM writes suspended');
    if(this.#game?.user?.id!==context.userId || !this.#game?.user?.isGM)err('GM_SESSION_MISMATCH','Unexpected GM identity');
    const active=this.#game.users?.activeGM;
    if(!active?.active || !active.isGM || active.id!==context.userId)err('NOT_DESIGNATED_GM','Only Foundry designated active GM may write');
    return true;
  }
  suspend(reason='MANUAL_HANDOVER_REQUIRED'){
    this.#suspended=true;this.#reason=reason;this.#generation++;
  }
  /** Caller must inspect durable operations externally before acknowledging recovery. */
  resumeAfterReconciliation({gmContext,confirmedNoUncertainOperations=false}={}){
    assertLocalGM(gmContext);
    this.observeCoordinator();
    if(!confirmedNoUncertainOperations)err('RECOVERY_NOT_VERIFIED','Durable operation review required before resuming');
    if(this.#game?.users?.activeGM?.id!==gmContext.userId)err('NOT_DESIGNATED_GM','Only designated GM may resume');
    // A different designated GM must start a fresh client writer; local
    // acknowledgement cannot retroactively fence a departed coordinator.
    if(this.#designatedGM!==gmContext.userId)err('GM_COORDINATOR_MISMATCH','The current designated GM must own recovery');
    this.#suspended=false;this.#reason=null;this.#generation++;
  }
  async withWriter(context,fn){
    this.assertEligible(context);
    const run=async()=>{
      this.assertEligible(context);
      const generation=this.#generation;
      try {
        const result=await fn();
        if(generation!==this.#generation)err('GM_WRITE_UNCERTAIN','Writer generation changed during operation');
        this.assertEligible(context);
        return result;
      } catch(e){
        // A failure can happen after a native document write; never retry blindly.
        if(e?.code==='NOT_DESIGNATED_GM'||e?.code==='GM_SESSION_MISMATCH'||e?.code==='GM_WRITE_UNCERTAIN'){
          this.suspend('GM_HANDOVER_UNCERTAIN');
        }
        throw e;
      }
    };
    const operation=this.#tail.then(run,run);
    this.#tail=operation.then(()=>undefined,()=>undefined);
    return operation;
  }
}
