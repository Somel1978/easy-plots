export const gid='ep:graph:demo_001', trigger='ep:node:trigger_001', condition='ep:node:condition_001', effect='ep:node:effect_001';
export const graph=()=>({
  kind:'graph',schemaVersion:'1.0.0',id:gid,revision:0,partitionId:'plot-demo',rootNodeId:trigger,
  nodes:[
    {id:trigger,graphId:gid,typeId:'core.trigger.event',accessClass:'gm',ports:[{id:'out',direction:'output',valueType:'event',accessClass:'gm'}],data:{eventType:'evidence.discovered'}},
    {id:condition,graphId:gid,typeId:'core.condition',accessClass:'gm',ports:[{id:'in',direction:'input',valueType:'event',accessClass:'gm'},{id:'out',direction:'output',valueType:'event',accessClass:'gm'}],data:{condition:{op:'compare',operator:'eq',left:{type:'reference',path:['event','verified'],requiredPermission:'gm'},right:{type:'literal',value:true}}}},
    {id:effect,graphId:gid,typeId:'core.effect.proposal',accessClass:'gm-secret',ports:[{id:'in',direction:'input',valueType:'event',accessClass:'gm'}],data:{providerId:'narrative.set-state',payload:{key:'manifest-discovered',value:true}}}
  ],edges:[
    {id:'ep:edge:first_001',kind:'flow',source:{nodeId:trigger,portId:'out'},target:{nodeId:condition,portId:'in'}},
    {id:'ep:edge:second_001',kind:'flow',source:{nodeId:condition,portId:'out'},target:{nodeId:effect,portId:'in'}}
  ],requiredCapabilityIds:[],semanticHash:'fixture:demo'});
export const event=(id='ep:event:discovery_001',verified=true)=>({id,eventType:'evidence.discovered',payload:{verified}});
export const session=(id='GM_1')=>({user:{id,isGM:true},epoch:'test-epoch'});
