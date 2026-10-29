/** Bounded, side-effect-free hypothetical evaluation. No native document writes,
 * effect-provider access, sockets or live world mutation. */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {clone} from '../contracts/record.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
const safeKey=key=>typeof key==='string'&&key.length>0&&key.length<=120&&!key.startsWith('__')&&!['constructor','prototype'].includes(key);
export function runIsolatedWhatIf({initialFacts={},hypotheses=[],rules=[],maxRules=96,maxPasses=8}={}){
  if(!initialFacts||typeof initialFacts!=='object'||Array.isArray(initialFacts)||!Array.isArray(rules)||rules.length>maxRules||
    !Array.isArray(hypotheses)||hypotheses.length>maxRules||!Number.isInteger(maxRules)||maxRules<1||maxRules>96||!Number.isInteger(maxPasses)||maxPasses<1||maxPasses>16)
    fail('SIMULATION_BUDGET','Bounded input required');
  if(Object.keys(initialFacts).some(key=>!safeKey(key)))fail('SIMULATION_INPUT','Invalid canonical fact key');
  const state=clone(initialFacts),reasons=[],overlay=clone(hypotheses);
  for(const change of overlay){
    if(!safeKey(change?.key))fail('SIMULATION_INPUT','Invalid hypothesis key');
    state[change.key]=clone(change.value);
  }
  let converged=false;
  for(let pass=0;pass<maxPasses;pass++){
    let changed=false;
    for(const r of rules){
      if(typeof r?.id!=='string'||!safeKey(r.key)||!safeKey(r.outputKey))fail('SIMULATION_RULE','Typed declarative rule required');
      if(Object.is(state[r.key],r.equals)&&!Object.is(state[r.outputKey],r.value)){
        state[r.outputKey]=clone(r.value);changed=true;
        if(reasons.length>=maxRules*maxPasses)fail('SIMULATION_BUDGET','Excessive causal reasons');
        reasons.push({ruleId:r.id,pass:pass+1,outputKey:r.outputKey});
      }
    }
    if(!changed){converged=true;break;}
  }
  return {hypotheticalFacts:state,causalReasons:reasons,converged,committed:false,effectsExecuted:0,
    status:converged?'isolated-converged':'budget-exhausted'};
}
