import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {assertLocalGM} from '../security/authority.mjs';
export function validateBoardEditApproval(p){
 const fail=()=>{throw new EasyPlotsError('BOARD_EDIT_APPROVAL','Explicit private request, revision and GM-selected audience required');};
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['scope','requestId','expectedRequestRevision','shareWith'].includes(k))||typeof p.scope!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(p.scope)||!Number.isSafeInteger(p.expectedRequestRevision)||p.expectedRequestRevision<1||!Array.isArray(p.shareWith)||p.shareWith.length>16||new Set(p.shareWith).size!==p.shareWith.length)fail();
 assertNarrativeId(p.requestId);p.shareWith.forEach(assertNarrativeId);return clone(p);
}
export function createPlayerBoardEditProvider({service,gmProvider}={}){
 if(typeof service?.apply!=='function'||typeof service?.verify!=='function'||typeof gmProvider!=='function')throw new EasyPlotsError('BOARD_EDIT_DEPENDENCY','Private request approval service required');
 return Object.freeze({id:'narrative.apply-player-board-edit',version:'1.0.0',validate:validateBoardEditApproval,
  async apply(payload,context){assertLocalGM(gmProvider());return service.apply(validateBoardEditApproval(payload),context);},
  async verify(payload,context){assertLocalGM(gmProvider());return service.verify(validateBoardEditApproval(payload),context);}
 });
}
