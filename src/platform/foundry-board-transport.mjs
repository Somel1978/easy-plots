/** Native v14 GM-authoritative, recipient-specific investigation board requests.
 * Server-appended socket sender ID is the only trusted requesting identity.
 * Board payloads must be allowlisted BEFORE sending; no raw GM documents or
 * private query statuses are ever returned to players.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {assertNarrativeId} from '../contracts/record.mjs';
import {createInvestigationBoardProjection,validatePlayerBoardProjection} from '../domains/investigation-board.mjs';
import {MODULE_SOCKET} from './foundry-socket.mjs';
import {validatePlayerBoardEdit} from '../orchestration/player-board-edits.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const ID=/^[A-Za-z0-9_.:-]{8,160}$/;
const MAX_BOARD_BYTES=28_000;
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export class NativeFoundryBoardTransport {
  #game;#loadBoard;#captureEdit;#authorize;#randomId;#listener=null;#pending=new Map();#active=false;#inflight=0;
  constructor({gameInstance,loadBoard=null,onSubmitEdit=null,actorAuthorization=null,randomId=secureUUID}={}){
    this.#game=gameInstance;this.#loadBoard=loadBoard;this.#captureEdit=onSubmitEdit;this.#authorize=actorAuthorization;this.#randomId=randomId;
  }
  #gm(){const gm=this.#game?.users?.activeGM;return gm?.isGM&&gm.active&&ID.test(gm.id)?gm:null;}
  start(){
    if(!this.#game?.socket?.on||!this.#game?.socket?.emit||this.#game?.modules?.get?.('easy-plots')?.socket!==true)
      fail('SOCKET_UNAVAILABLE','Registered native Foundry module socket required');
    if(this.#game.user?.isGM&&(!this.#loadBoard||!this.#authorize))fail('BOARD_SERVER_UNAVAILABLE','Protected board provider and Actor authorizer required');
    if(this.#active)return this;
    this.#listener=(packet,senderId)=>{void this.#receive(packet,senderId);};
    this.#game.socket.on(MODULE_SOCKET,this.#listener);this.#active=true;return this;
  }
  stop(){
    if(this.#listener)this.#game?.socket?.off?.(MODULE_SOCKET,this.#listener);
    this.#active=false;this.#listener=null;
    for(const p of this.#pending.values()){clearTimeout(p.timeout);p.reject(new EasyPlotsError('TRANSPORT_STOPPED','Board transport stopped'));}
    this.#pending.clear();
  }
  #send(to,packet){if(!this.#active||!ID.test(to))fail('SOCKET_UNAVAILABLE','Explicit authenticated recipient required');
    this.#game.socket.emit(MODULE_SOCKET,packet,{recipients:[to]});}
  async request({investigationId,actorId},{requestId=null,timeoutMs=10000}={}){
    if(this.#game?.user?.isGM)fail('PLAYER_ONLY','Player board request requires player context');
    assertNarrativeId(investigationId);
    if(!investigationId.startsWith('ep:investigation:')||!ID.test(actorId))fail('INVALID_BOARD_REQUEST','Investigation and native Actor IDs required');
    const gm=this.#gm();if(!gm)fail('GM_UNAVAILABLE','No designated GM is active');
    requestId??=String(this.#randomId());if(!ID.test(requestId))fail('INVALID_BOARD_REQUEST','Invalid request ID');
    if(this.#pending.size>=16||this.#pending.has(requestId))fail('BACKPRESSURE','Duplicate or too many pending board requests');
    if(!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)fail('INVALID_BOARD_REQUEST','Timeout outside permitted range');
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{this.#pending.delete(requestId);reject(new EasyPlotsError('REQUEST_TIMEOUT','No authorized board reply'));},timeoutMs);
      this.#pending.set(requestId,{resolve,reject,timeout,kind:'read'});
      try{this.#send(gm.id,{kind:'board.request',version:1,requestId,investigationId,actorId});}
      catch(e){clearTimeout(timeout);this.#pending.delete(requestId);reject(e);}
    });
  }
  async submitEdit({investigationId,actorId,edit},{requestId=null,timeoutMs=10000}={}){
    if(this.#game?.user?.isGM)fail('PLAYER_ONLY','Player board edit requires player context');
    assertNarrativeId(investigationId);edit=validatePlayerBoardEdit(edit);
    if(!investigationId.startsWith('ep:investigation:')||!ID.test(actorId)||!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)fail('INVALID_BOARD_REQUEST','Explicit investigation, Actor and bounded timeout required');
    const gm=this.#gm();if(!gm)fail('GM_UNAVAILABLE','No designated GM is active');
    requestId??=String(this.#randomId());if(!ID.test(requestId))fail('INVALID_BOARD_REQUEST','Invalid request ID');
    if(this.#pending.size>=16||this.#pending.has(requestId))fail('BACKPRESSURE','Duplicate or too many pending board requests');
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{this.#pending.delete(requestId);reject(new EasyPlotsError('REQUEST_TIMEOUT','No authorized board edit receipt'));},timeoutMs);
      this.#pending.set(requestId,{resolve,reject,timeout,kind:'edit'});
      try{this.#send(gm.id,{kind:'board.edit',version:1,requestId,investigationId,actorId,edit});}
      catch(e){clearTimeout(timeout);this.#pending.delete(requestId);reject(e);}
    });
  }
  async #receive(packet,senderId){
    if(!this.#active||!isRecord(packet)||!ID.test(senderId)||!this.#game.users?.get?.(senderId))return;
    if(packet.kind==='board.reply')return this.#receiveReply(packet,senderId);
    if(packet.kind==='board.edit-reply')return this.#receiveEditReply(packet,senderId);
    if(!['board.request','board.edit'].includes(packet.kind)||packet.version!==1||!this.#game.user?.isGM||this.#gm()?.id!==this.#game.user.id)return;
    if(this.#game.users.get(senderId)?.isGM||!this.#game.users.get(senderId)?.active)return;
    if(!ID.test(packet.requestId))return;
    const replyKind=packet.kind==='board.edit'?'board.edit-reply':'board.reply';
    const reject=()=>{if(this.#active){try{this.#send(senderId,{kind:replyKind,version:1,requestId:packet.requestId,state:'unavailable'});}catch{}}};
    if(this.#inflight>=8)return reject();this.#inflight++;
    try {
      packet={kind:packet.kind,version:packet.version,requestId:packet.requestId,actorId:packet.actorId,investigationId:packet.investigationId,...(packet.kind==='board.edit'?{edit:validatePlayerBoardEdit(packet.edit)}:{})};
      if(!ID.test(packet.actorId)||typeof packet.investigationId!=='string')return reject();
      assertNarrativeId(packet.investigationId);
      if(!packet.investigationId.startsWith('ep:investigation:')||await this.#authorize(senderId,packet.actorId)!==true)return reject();
      if(packet.kind==='board.edit'){
        if(typeof this.#captureEdit!=='function')return reject();
        const edit=validatePlayerBoardEdit(packet.edit);
        await this.#captureEdit({verifiedUserId:senderId,actorId:packet.actorId,investigationId:packet.investigationId,requestId:packet.requestId,edit});
        this.#send(senderId,{kind:'board.edit-reply',version:1,requestId:packet.requestId,state:'pending'});return;
      }
      // The callback may fetch ONLY the exact requested protected partition.
      const board=await this.#loadBoard({verifiedUserId:senderId,actorId:packet.actorId,investigationId:packet.investigationId});
      validatePlayerBoardProjection(board);
      if(board.investigationId!==packet.investigationId||new TextEncoder().encode(JSON.stringify(board)).length>MAX_BOARD_BYTES)return reject();
      this.#send(senderId,{kind:'board.reply',version:1,requestId:packet.requestId,state:'ready',board});
    }catch{reject();} // Never reveal if an investigation, Actor, or secret exists.
    finally{this.#inflight--;}
  }
  #receiveReply(packet,senderId){
    if(this.#game.user?.isGM||senderId!==this.#gm()?.id||packet.version!==1||!ID.test(packet.requestId))return;
    if(!['ready','unavailable'].includes(packet.state))return;
    const pending=this.#pending.get(packet.requestId);if(!pending||pending.kind!=='read')return;
    this.#pending.delete(packet.requestId);clearTimeout(pending.timeout);
    if(packet.state!=='ready'){pending.reject(new EasyPlotsError('BOARD_UNAVAILABLE','Board is unavailable'));return;}
    try{validatePlayerBoardProjection(packet.board);pending.resolve(packet.board);}
    catch{pending.reject(new EasyPlotsError('INVALID_BOARD','Board projection failed validation'));}
  }
  #receiveEditReply(packet,senderId){
    if(this.#game.user?.isGM||senderId!==this.#gm()?.id||packet.version!==1||!ID.test(packet.requestId)||!['pending','unavailable'].includes(packet.state))return;
    const pending=this.#pending.get(packet.requestId);if(!pending||pending.kind!=='edit')return;
    this.#pending.delete(packet.requestId);clearTimeout(pending.timeout);
    if(packet.state!=='pending')pending.reject(new EasyPlotsError('BOARD_UNAVAILABLE','Board is unavailable'));
    else pending.resolve({state:'pending',requestId:packet.requestId});
  }
}
/** Load exactly one protected investigation record. Observer bindings MUST be
 * resolved from authenticated native Actor identity and GM-controlled metadata.
 */
export function makeNativeBoardLoader({domains,resolveObserver,scope='world'}={}){
  if(typeof domains?.read!=='function'||typeof resolveObserver!=='function')fail('BOARD_DEPENDENCY','Protected domain repository and trusted observer mapping required');
  return async ({verifiedUserId,actorId,investigationId})=>{
    const observerId=await resolveObserver({verifiedUserId,actorId});
    assertNarrativeId(observerId);
    const row=await domains.read('investigation',scope,investigationId);
    if(!row||!row.data)fail('BOARD_UNAVAILABLE','No scoped investigation projection');
    const data=row.data;
    const authorizedEvidenceIds=(data.evidence??[]).filter(e=>e.disclosedTo?.includes(observerId)||e.disclosedTo?.includes('public')).map(e=>e.id);
    const authorizedOpportunityIds=(data.opportunities??[]).filter(a=>a.disclosedTo?.includes(observerId)||a.disclosedTo?.includes('public')).map(a=>a.id);
    return createInvestigationBoardProjection({investigationId,title:data.title??'',evidence:data.evidence??[],theories:data.theories??[],
      opportunities:data.opportunities??[]},{observerId,authorizedEvidenceIds,authorizedOpportunityIds});
  };
}
