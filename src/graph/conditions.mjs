import {EasyPlotsError} from '../contracts/errors.mjs';
const badKeys=new Set(['__proto__','prototype','constructor']);
const visibilityRank={'published':0,'party':1,'observer-private':2,'gm':3,'gm-secret':4};
function resolveValue(spec,context) {
  if (spec?.type==='literal') return spec.value;
  if (spec?.type!=='reference'||!Array.isArray(spec.path)||spec.path.length>12) throw new EasyPlotsError('INVALID_EXPRESSION','Unsupported value expression');
  const allowed=visibilityRank[context.clearance]??-1;
  const needed=visibilityRank[spec.requiredPermission]??Infinity;
  if(allowed<needed) throw new EasyPlotsError('ACCESS_DENIED','Condition cannot access protected data');
  let cur=context.values;
  for(const key of spec.path) {
    if(typeof key!=='string'||badKeys.has(key)||!Object.hasOwn(cur??{},key)) throw new EasyPlotsError('UNRESOLVED_VALUE','Condition input unavailable');
    cur=cur[key];
  }
  return cur;
}
export function evaluateCondition(ast,context={}) {
  if (!ast || typeof ast !=='object') throw new EasyPlotsError('INVALID_CONDITION','Condition AST missing');
  const max=context.maxDepth??16;
  function recur(expr,depth) {
    if(depth>max) throw new EasyPlotsError('CONDITION_BUDGET','Condition depth exceeded');
    if(expr.op==='all') {if(!Array.isArray(expr.terms)) throw new EasyPlotsError('INVALID_CONDITION','Missing terms');return expr.terms.every(c=>recur(c,depth+1));}
    if(expr.op==='any') {if(!Array.isArray(expr.terms)) throw new EasyPlotsError('INVALID_CONDITION','Missing terms');return expr.terms.some(c=>recur(c,depth+1));}
    if(expr.op==='not') return !recur(expr.term,depth+1);
    if(expr.op==='provider-predicate') throw new EasyPlotsError('UNVERIFIED_PROVIDER','External predicate requires a validated capability provider');
    if(expr.op!=='compare') throw new EasyPlotsError('INVALID_CONDITION','Unsupported condition operator');
    const a=resolveValue(expr.left,context),b=resolveValue(expr.right,context);
    if(expr.operator==='eq') return Object.is(a,b);
    if(expr.operator==='neq') return !Object.is(a,b);
    if(['gt','gte','lt','lte'].includes(expr.operator)) {
      if(typeof a!=='number'||typeof b!=='number'||!Number.isFinite(a)||!Number.isFinite(b)) throw new EasyPlotsError('INVALID_COMPARISON','Numeric comparison requires finite numbers');
      return expr.operator==='gt'?a>b:expr.operator==='gte'?a>=b:expr.operator==='lt'?a<b:a<=b;
    }
    if(expr.operator==='contains' && typeof a==='string' && typeof b==='string') return a.includes(b);
    throw new EasyPlotsError('INVALID_COMPARISON','Unsupported or mismatched comparison');
  }
  return recur(ast,0);
}
