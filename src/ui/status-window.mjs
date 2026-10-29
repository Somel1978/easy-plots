/** ApplicationV2 status/control shell; no world writes on opening. */
export function makeStatusWindow(BaseApplicationV2,{openEditor=()=>{},openApprovals=()=>{},openEventReview=()=>{},openCockpit=()=>{},openPlanningLab=()=>{},openTemplateDesk=()=>{},openPlayerBoardReview=()=>{},openKnowledgePublications=()=>{},openContinuityDesk=()=>{},openHistoryDesk=()=>{},openSignalReliabilityDesk=()=>{},openSessionHandoff=()=>{},openQuestPublicationDesk=()=>{},openManualEventDesk=()=>{},openEncounterClosures=()=>{},openRollSystemPolicy=()=>{},openNativeBatches=()=>{},openNarrativeSearch=()=>{},openNotificationDesk=()=>{},extraActions=[],runtimeStatus=()=>({running:false}),mode=()=>'sandbox'}={}){
  return class EasyPlotsStatus extends BaseApplicationV2 {
    static DEFAULT_OPTIONS={id:'easy-plots-dev-status',window:{title:'Easy Plots — Integration Status',resizable:true},position:{width:620,height:420}};
    async _renderHTML(){
      const div=document.createElement('div');div.className='easy-plots-status';
      const h=document.createElement('h3');h.textContent='Easy Plots — Development Workspace';div.append(h);
      const reliability=document.createElement('button');reliability.type='button';reliability.textContent='Signal Reliability and Recovery';reliability.addEventListener('click',()=>{try{openSignalReliabilityDesk();}catch(e){globalThis.ui?.notifications?.warn?.(e.message);}});div.append(reliability);
      const history=document.createElement('button');history.type='button';history.textContent='Narrative History and Arc Archives';history.addEventListener('click',()=>{try{openHistoryDesk();}catch(e){globalThis.ui?.notifications?.warn?.(e.message);}});div.append(history);
      for(const line of [
        `Editor storage: ${mode()==='native'?'guarded Foundry native Compendium':'isolated memory sandbox; reload loses drafts'}.`,
        'Graph drafts, immutable publication snapshots and activation records use separate revision-aware contracts.',
        'Native storage and player requests require exact-world live security verification; they never start automatically.',
        'GM handover and cross-GM writes do not have server-atomic fencing. Uncertain effects remain blocked.',
        `Reactive Hooks: ${runtimeStatus()?.running?'Explicitly enabled after verification':'DISABLED by default'}. Published subscriptions are durable and event-type indexed.`,
        'Eligible native Hooks can produce durable GM-only event records and review-only effect proposals; no effects are auto-executed.',
        'Native Foundry acceptance is required before release. Local validation does not certify production compatibility.'
      ]){const p=document.createElement('p');p.textContent=line;div.append(p);}
      const a=document.createElement('button');a.type='button';a.textContent='Open Graph Editor';a.addEventListener('click',()=>openEditor());div.append(a);
      const b=document.createElement('button');b.type='button';b.textContent='Open GM Request Review';b.addEventListener('click',()=>{
        try{openApprovals();}catch(e){globalThis.ui?.notifications?.warn?.(e.message);}
      });div.append(b);
      const c=document.createElement('button');c.type='button';c.textContent='Open Narrative Event Review';
      c.addEventListener('click',()=>{try{openEventReview();}catch(e){globalThis.ui?.notifications?.warn?.(e.message);}});
      div.append(c);
      const d=document.createElement('button');d.type='button';d.textContent='Open Focused GM Cockpit';
      d.addEventListener('click',()=>{try{openCockpit();}catch(e){globalThis.ui?.notifications?.warn?.(e.message);}});div.append(d);
      const lab=document.createElement('button');lab.type='button';lab.textContent='Open Narrative Planning Lab';
      lab.addEventListener('click',()=>{try{openPlanningLab();}catch(e){globalThis.ui?.notifications?.warn?.(e.message);}});div.append(lab);
      const continuity=document.createElement('button');continuity.type='button';continuity.textContent='Open Campaign Continuity Desk';
      continuity.addEventListener('click',()=>{try{openContinuityDesk();}catch(e){globalThis.ui?.notifications?.warn?.(e.message);}});
      div.append(continuity);
      for(const [title,action] of [
        ['Open Reusable Plot Templates',openTemplateDesk],
        ['Review Player Board Proposals',openPlayerBoardReview],
        ['Protected Chat and Journal',openKnowledgePublications],
        ['Open GM Session Handoff',openSessionHandoff],
        ['Open GM Quest Publication',openQuestPublicationDesk],
        ['Open GM Manual Event',openManualEventDesk],
        ['Close a Native Encounter',openEncounterClosures],
        ['Roll System Policy',openRollSystemPolicy],
        ['Ordered Native Batches',openNativeBatches],
        ['Open GM Narrative Search',openNarrativeSearch],
        ['Open GM Notification Review',openNotificationDesk],
        ...extraActions
      ]){
        const b=document.createElement('button');b.type='button';b.textContent=title;
        b.addEventListener('click',()=>{try{action();}catch(e){globalThis.ui?.notifications?.warn?.(e.message);}});div.append(b);
      }
      return div;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
  };
}
