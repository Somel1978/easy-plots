/** Native root-document metadata only. No source content is serialized. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertLocalGM} from '../security/authority.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const collections={Actor:'actors',Item:'items',JournalEntry:'journal',Combat:'combats',ChatMessage:'messages'};
export function validateSourceUuid(uuid){
 const match=typeof uuid==='string'?/^(Actor|Item|JournalEntry|Combat|ChatMessage)\.([A-Za-z0-9_-]{1,80})$/.exec(uuid):null;
 if(!match)fail('SIGNAL_SOURCE','Only an exact supported native root document may be watched');return {kind:match[1],id:match[2]};
}
export function validateSourceStamp(stamp){
 if(!stamp||Object.keys(stamp).some(k=>!['exists','modifiedTime'].includes(k))||typeof stamp.exists!=='boolean'||stamp.exists&&(!Number.isSafeInteger(stamp.modifiedTime)||stamp.modifiedTime<0)||!stamp.exists&&stamp.modifiedTime!==null)fail('SIGNAL_SOURCE_STAMP','Verified native modification metadata is required');
 return {exists:stamp.exists,modifiedTime:stamp.modifiedTime};
}
export function nativeHookStamp(hook,document){
 validateSourceUuid(document?.uuid);
 return validateSourceStamp(hook==='deleteCombat'?{exists:false,modifiedTime:null}:{exists:true,modifiedTime:document?._stats?.modifiedTime});
}
export function createNativeSourceStampReader({gameInstance,gmProvider,writer}={}){
 if(typeof gmProvider!=='function'||typeof writer?.assertEligible!=='function')fail('SIGNAL_DEPENDENCY','Trusted native GM source reader required');
 return async uuid=>{
  const gm=gmProvider();assertLocalGM(gm);writer.assertEligible(gm);
  if(!gameInstance?.user?.isGM||gameInstance.user.id!==gm.userId)fail('GM_REQUIRED','Current local GM required');
  const {kind,id}=validateSourceUuid(uuid),collection=gameInstance[collections[kind]];
  if(typeof collection?.get!=='function')fail('SIGNAL_SOURCE_UNAVAILABLE','Required native collection is unavailable');
  const document=collection.get(id);
  if(!document)return {exists:false,modifiedTime:null};
  if(document.uuid!==uuid||document.documentName!==kind||typeof document.testUserPermission!=='function'||document.testUserPermission(gameInstance.user,'OWNER')!==true)fail('SIGNAL_SOURCE_DENIED','Native identity and GM document authority could not be verified');
  return validateSourceStamp({exists:true,modifiedTime:document._stats?.modifiedTime});
 };
}
