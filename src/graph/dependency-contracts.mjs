/** Stable JSON and SHA-256 identities for declared execution contracts. */
import {sha256Bytes} from '../contracts/digest.mjs';
import {EasyPlotsError} from '../contracts/errors.mjs';
export function canonicalContract(value,seen=new Set()){
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(!value||typeof value!=='object'||seen.has(value)||!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype)throw new EasyPlotsError('DEPENDENCY_JSON','Execution contracts require finite plain JSON');
 seen.add(value);let result;
 if(Array.isArray(value))result=`[${value.map(item=>canonicalContract(item,seen)).join(',')}]`;
 else result=`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalContract(value[key],seen)}`).join(',')}}`;
 seen.delete(value);return result;
}
export function contractHash(value){return [...sha256Bytes(new TextEncoder().encode(canonicalContract(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export const isContractFingerprint=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function callableContract(functions){return Object.fromEntries(Object.entries(functions).filter(([,fn])=>typeof fn==='function').map(([key,fn])=>[key,Function.prototype.toString.call(fn)]));}
