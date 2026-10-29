import {EasyPlotsError} from '../contracts/errors.mjs';
export function proposeArcEnding(endings,worldFacets,{max=32}={}) {
  if(endings.length>max)throw new EasyPlotsError('ARC_BUDGET','Too many endings considered');
  const eligible=endings.filter(ending=>Object.entries(ending.requiredFacets??{}).every(([k,v])=>worldFacets[k]===v));
  const grouped=new Map();for(const e of eligible){if(e.exclusiveGroup){const list=grouped.get(e.exclusiveGroup)??[];list.push(e.id);grouped.set(e.exclusiveGroup,list);}}
  const conflicts=[...grouped.values()].filter(v=>v.length>1);
  return {eligibleIds:eligible.map(e=>e.id),conflicts,status:conflicts.length?'gm-reconciliation':'gm-approval-required',committed:false};
}
