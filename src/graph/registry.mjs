import {EasyPlotsError} from '../contracts/errors.mjs';
import {validateGraph} from './validate.mjs';
import {assertLocalGM} from '../security/authority.mjs';
import {clone,deepFreeze} from '../contracts/record.mjs';
export class GraphRegistry {
  #drafts=new Map(); #published=new Map(); #active=new Map();
  saveDraft(graph,expectedRevision=null) {
    const old=this.#drafts.get(graph.id);
    if(old && expectedRevision!==old.revision) throw new EasyPlotsError('REVISION_CONFLICT','Draft changed since last edit');
    if(!old && expectedRevision!==null) throw new EasyPlotsError('REVISION_CONFLICT','New draft cannot have expected revision');
    const value={...clone(graph),revision:(old?.revision??0)+1};
    this.#drafts.set(graph.id,value);return clone(value);
  }
  getDraft(id){const v=this.#drafts.get(id);return v?clone(v):null;}
  publish(graphId,{expectedRevision,gm,capabilities=[]}) {
    assertLocalGM(gm);
    const graph=this.getDraft(graphId);
    if(!graph)throw new EasyPlotsError('NOT_FOUND','Graph draft not found');
    if(graph.revision!==expectedRevision)throw new EasyPlotsError('REVISION_CONFLICT','Stale publication candidate');
    const report=validateGraph(graph,{requiredCapabilities:capabilities});
    const version=this.#published.get(graphId)?.length??0;
    const snapshot=deepFreeze({...clone(graph),publishedVersion:version+1,publicationReport:report});
    const list=this.#published.get(graphId)??[];list.push(snapshot);this.#published.set(graphId,list);
    return clone(snapshot);
  }
  activate(graphId,publishedVersion,{gm}={}) {
    assertLocalGM(gm);
    const snapshot=this.#published.get(graphId)?.find(s=>s.publishedVersion===publishedVersion);
    if(!snapshot)throw new EasyPlotsError('NOT_FOUND','Published version missing');
    this.#active.set(graphId,publishedVersion);
    return {graphId,version:publishedVersion,activated:true};
  }
  deactivate(graphId,{gm}={}) {assertLocalGM(gm);this.#active.delete(graphId);}
  getActive(id){const version=this.#active.get(id);const snapshot=this.#published.get(id)?.find(s=>s.publishedVersion===version);return snapshot?clone(snapshot):null;}
  activeIds(){return [...this.#active.keys()];}
}
