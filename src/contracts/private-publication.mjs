/** Only allowlisted narrative projections may enter a native publication.
 * GM provenance, identities, hidden criteria and raw HTML are not view fields.
 */
import {EasyPlotsError} from './errors.mjs';
import {clone} from './record.mjs';
const fail=message=>{throw new EasyPlotsError('PUBLICATION_VIEW',message);};
const stances=new Set(['reported','believed','doubted','disputed','retracted']);
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
export function validatePublicationView(value){
 if(value?.kind==='roll-publication')return validateRollPublicationView(value);
 if(!plain(value)||Object.keys(value).some(k=>!['kind','version','title','worldTime','claims'].includes(k))||value.kind!=='knowledge-publication'||value.version!==1||typeof value.title!=='string'||!value.title.trim()||value.title.length>140||!Number.isFinite(value.worldTime)||value.worldTime<0||!Array.isArray(value.claims)||!value.claims.length||value.claims.length>8)fail('Bounded supported narrative publication required');
 for(const item of value.claims)if(!plain(item)||Object.keys(item).some(k=>!['text','stance'].includes(k))||typeof item.text!=='string'||!item.text||item.text.length>600||!stances.has(item.stance))fail('Only public wording and its reported stance may be published');
 if(new TextEncoder().encode(JSON.stringify(value)).length>6000)fail('Publication exceeds its bounded native envelope; select fewer claims');return clone(value);
}
function validateRollPublicationView(value){
 const keys=['kind','version','title','worldTime','mode','disclosure','total','outcome'];
 if(!plain(value)||Object.keys(value).some(k=>!keys.includes(k))||value.version!==1||typeof value.title!=='string'||!value.title.trim()||value.title.length>140||!Number.isFinite(value.worldTime)||value.worldTime<0||!['active','passive','opposed'].includes(value.mode)||!['total-only','outcome-only','total-and-outcome'].includes(value.disclosure))fail('Bounded mechanical roll projection required');
 const wantsTotal=value.disclosure!=='outcome-only',wantsOutcome=value.disclosure!=='total-only';
 if(Object.hasOwn(value,'total')!==wantsTotal||wantsTotal&&(!Number.isSafeInteger(value.total)||Math.abs(value.total)>10000)||Object.hasOwn(value,'outcome')!==wantsOutcome||wantsOutcome&&!['success','partial','failure','partial-success','partial-failure','tie'].includes(value.outcome))fail('Only explicitly selected mechanical totals/outcomes may be disclosed');
 return clone(value);
}
