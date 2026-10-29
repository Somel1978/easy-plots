import {EasyPlotsError, requireInvariant} from './errors.mjs';
export const VERSION = '1.0.0';
const idPattern = /^ep:[a-z][a-z0-9-]*:[a-zA-Z0-9_-]{3,120}$/;
export function assertNarrativeId(id) {requireInvariant(typeof id === 'string' && idPattern.test(id), 'INVALID_ID', 'Invalid stable narrative identifier');return id;}
export function assertPlainObject(value, code = 'INVALID_OBJECT') {
  requireInvariant(value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype, code, 'Expected a plain object');
  return value;
}
export function clone(value) { return structuredClone(value); }
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
export function assertRevision(value) { requireInvariant(Number.isInteger(value) && value >= 0,'INVALID_REVISION','Expected a non-negative integer revision'); return value; }
export function assertUnique(values, code='DUPLICATE_ID') {
  const set=new Set(values); if(set.size !== values.length) throw new EasyPlotsError(code, 'Duplicate identifier in contract');
}
