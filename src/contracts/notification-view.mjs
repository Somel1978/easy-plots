import {EasyPlotsError} from './errors.mjs';
import {assertNarrativeId,clone} from './record.mjs';
const fail=()=>{throw new EasyPlotsError('INVALID_NOTIFICATION','Bounded recipient-safe notice required');};
export function validateNoticeGroup(g){
 if(!g||typeof g!=='object'||Array.isArray(g)||Object.keys(g).sort().join(',')!=='id,title'||!/^ep:notice-group:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(g.id??'')||typeof g.title!=='string'||!g.title.trim()||g.title.length>80)fail();return clone(g);
}
export function validateNoticeView(item){
 if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['id','text','level','group'].includes(k))||typeof item.text!=='string'||!item.text.trim()||item.text.length>280||!['info','attention','urgent'].includes(item.level))fail();assertNarrativeId(item.id);
 if(item.group!==undefined)validateNoticeGroup(item.group);
 return clone(item);
}
