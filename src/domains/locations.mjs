/** Narrative region/location graphs are typed and knowledge filtered; no
 * accidental disclosure of GM-only routes, names or coordinates. */
import {EasyPlotsError} from '../contracts/errors.mjs';
const fail=(code,message)=>{throw new EasyPlotsError(code,message);};
export function planKnownRoute({fromId,toId,links=[],authorizedLinkIds=[],maxLinks=100,maxHops=20}={}){
  if(typeof fromId!=='string'||typeof toId!=='string'||!Array.isArray(links)||links.length>maxLinks)
    fail('ROUTE_BUDGET','Bounded spatial route required');
  const authorized=new Set(authorizedLinkIds),edges=new Map();
  for(const link of links){
    if(!authorized.has(link.id)||link.open===false)continue;
    const outbound=edges.get(link.fromId)??[];
    outbound.push({toId:link.toId,linkId:link.id});edges.set(link.fromId,outbound);
    if(link.bidirectional===true){const reverse=edges.get(link.toId)??[];reverse.push({toId:link.fromId,linkId:link.id});edges.set(link.toId,reverse);}
  }
  const queue=[{at:fromId,path:[]}],visited=new Set();
  while(queue.length){const item=queue.shift();if(item.at===toId)return {status:'known-route',linkIds:item.path};
    if(visited.has(item.at)||item.path.length>=maxHops)continue;visited.add(item.at);
    for(const edge of edges.get(item.at)??[])queue.push({at:edge.toId,path:[...item.path,edge.linkId]});
    if(queue.length>maxLinks*maxHops)fail('ROUTE_BUDGET','Route search exceeded budget');
  }
  return {status:'no-authorized-route',linkIds:[]};
}
export function projectKnownLocations(locations,{observerId,disclosureIds=[],max=64}={}){
  if(!observerId||!Array.isArray(locations)||locations.length>max)fail('LOCATION_BUDGET','Bounded observer location projection required');
  const allowed=new Set(disclosureIds);
  return locations.filter(l=>l.disclosedTo?.includes(observerId)&&allowed.has(l.disclosureId))
    .map(l=>({id:l.publicId,name:l.disclosedName,regionId:l.publicRegionId??null}));
}
