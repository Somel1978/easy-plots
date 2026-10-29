import {EasyPlotsError} from '../contracts/errors.mjs';
/** Query already-indexed, bounded due commitments. This is NOT off-screen day-by-day simulation. */
export function buildTimeTransition({from,to,scheduled,maxDue=64}) {
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<from)throw new EasyPlotsError('INVALID_TIME','Forward world-time interval required');
  const due=[];let scanned=0;
  for(const item of scheduled) {
    if(++scanned>maxDue*4)throw new EasyPlotsError('TEMPORAL_BUDGET','Indexed window result exceeded scan budget');
    if(typeof item.dueTime==='number' && item.dueTime>from&&item.dueTime<=to) {
      if(due.length>=maxDue)throw new EasyPlotsError('TEMPORAL_BUDGET','Too many due operations');
      due.push({id:item.id,dueTime:item.dueTime,kind:item.kind,decision:'review',outcome:'not-established'});
    }
  }
  due.sort((a,b)=>a.dueTime-b.dueTime || a.id.localeCompare(b.id));
  return {from,to,due,committed:false,mode:'gm-review',inventedHistory:false};
}
