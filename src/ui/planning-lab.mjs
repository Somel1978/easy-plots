/** GM-only, side-effect-free narrative lab. All inputs are explicitly supplied
 * and bounded; no live source-world documents, writable services, socket
 * transports or action providers are passed into a simulation.
 */
import {runIsolatedWhatIf} from '../domains/simulation.mjs';
import {buildTimeTransition} from '../domains/temporal.mjs';
import {proposeArcEnding} from '../domains/arc-resolution.mjs';
import {mergeBlueprintInstance} from '../domains/blueprints.mjs';
import {planKnowledgePropagation} from '../orchestration/knowledge-propagation.mjs';
import {planFactionTurn} from '../orchestration/faction-orchestration.mjs';
import {planCampaignClosure} from '../orchestration/campaign-closure.mjs';
import {auditResourceReferences} from '../orchestration/resource-reconciliation.mjs';
import {evaluateNarrativeVote} from '../orchestration/decisions.mjs';
import {evaluateSharedMilestones} from '../orchestration/investigation-milestones.mjs';
import {secureUUID} from '../contracts/digest.mjs';
import {planBeliefReconciliation} from '../orchestration/knowledge-revisions.mjs';
import {planNPCCampaignTurn} from '../orchestration/npc-schedule-planner.mjs';
import {analyzeInvestigationViability} from '../orchestration/investigation-viability.mjs';
import {prepareContinuityHandoff} from '../orchestration/continuity-handoff.mjs';
import {assessNarrativeHealth} from '../orchestration/narrative-health.mjs';
const el=(tag,cls='',text='')=>{const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=String(text);return e;};
const modes=Object.freeze({
  'published-graph':{name:'Published graph simulation',sample:{graphId:'ep:graph:example_published001',publishedVersion:1,event:{id:'ep:event:simulation_example001',eventType:'evidence.discovered',source:{kind:'test-fixture'},payload:{verified:true}},hypotheses:[],faults:[]}},
  'what-if':{name:'What-if simulation',sample:{initialFacts:{manifestFound:true},hypotheses:[{key:'factionAlert',value:true}],
    rules:[{id:'rule-1',key:'factionAlert',equals:true,outputKey:'harborThreat',value:'elevated'}]}},
  'time-jump':{name:'World-time planning',sample:{from:100,to:190,
    scheduled:[{id:'deadline-one',dueTime:120,kind:'explicit-expiry'},{id:'agenda-one',dueTime:145,kind:'faction-agenda'}]}},
  'arc-ending':{name:'Campaign arc endings',sample:{worldFacets:{leader:'escaped',network:'broken'},
    endings:[{id:'partial-victory',requiredFacets:{leader:'escaped',network:'broken'},exclusiveGroup:'primary'},
      {id:'total-victory',requiredFacets:{leader:'captured',network:'broken'},exclusiveGroup:'primary'}]}},
  'blueprint':{name:'Blueprint reconciliation',sample:{base:{name:'Old Plot',difficulty:2},
    updated:{name:'Updated Plot',difficulty:3},instance:{name:'Old Plot',difficulty:4},allowedKeys:['name','difficulty']}},
  'knowledge':{name:'Knowledge propagation',sample:{worldTime:100,disclosure:{eventId:'ep:event:source001',claimId:'ep:claim:manifest001',sourceId:'ep:actor:informant001',initialRecipientIds:['ep:actor:harper001'],stance:'reported'},recipientStates:[{observerId:'ep:actor:harper001',knownEventIds:[]},{observerId:'ep:actor:captain001',knownEventIds:[]}],connections:[{id:'ep:edge:message001',fromId:'ep:actor:harper001',toId:'ep:actor:captain001',policy:'review',delay:20}]}},
  'faction':{name:'Faction agenda turn',sample:{worldTime:120,agendas:[{id:'ep:agenda:zhent001',factionId:'ep:faction:zhent001',status:'active',rules:[{id:'rule1',actionId:'prepare-raid',requiredCanonicalFactIds:['ep:fact:manifest001'],requiredFactionKnowledgeIds:['ep:fact:manifest001']}]}],factionContexts:[{factionId:'ep:faction:zhent001',canonicalFactIds:['ep:fact:manifest001'],factionKnownFactIds:['ep:fact:manifest001']}],dueIndex:[{id:'ep:due:raid0001',agendaId:'ep:agenda:zhent001',factionId:'ep:faction:zhent001',ruleId:'rule1',dueAt:100}]}},
  'closure':{name:'Campaign arc closure',sample:{arcId:'ep:arc:waterdeep001',arcRevision:3,worldTime:240,worldFacets:{leader:'captured',network:'active'},endingContracts:[{id:'ep:ending:partial001',exclusiveGroup:'primary',requiredFacets:{leader:'captured',network:'active'}}],objectives:[{id:'ep:objective:shipment001',status:'completed'},{id:'ep:objective:network001',status:'active'}],unresolvedThreads:[{id:'ep:thread:officer001',sourceEventId:'ep:event:escape001',disposition:'dormant'}]}},
  'resources':{name:'Resource integrity audit',sample:{resources:[{narrativeId:'ep:npc:captain001',nativeUuid:'Actor.captain',ownership:'borrowed',exists:true,provenanceRevision:2,nativeRevision:3}],bindings:[{sourceId:'ep:arc:waterdeep001',targetId:'ep:npc:captain001'}],knownNarrativeIds:['ep:arc:waterdeep001']}},
  'vote':{name:'Party vote and quorum',sample:{worldTime:120,decision:{id:'ep:decision:harbor001',participantIds:['ep:actor:hero001','ep:actor:hero002'],choiceIds:['investigate','negotiate'],quorum:2,deadline:110,tiePolicy:'gm-decides',visibility:'participants-after-close'},ballots:[{ballotEventId:'ep:ballot:one001',actorId:'ep:actor:hero001',choiceId:'investigate'},{ballotEventId:'ep:ballot:two001',actorId:'ep:actor:hero002',choiceId:'investigate'}]}},
  'correction':{name:'Belief correction and retraction',sample:{correction:{eventId:'ep:event:correct001',claimId:'ep:claim:manifest001',sourceId:'ep:actor:informant001',kind:'retracted'},observerClaims:[{observerId:'ep:actor:harper001',claimId:'ep:claim:manifest001',disclosureEventId:'ep:event:disclosed001',disclosureAuthorized:true,stance:'believed'}],dependencyLinks:[{id:'ep:link:objective001',claimId:'ep:claim:manifest001',dependentId:'ep:objective:shipment001'}]}},
  'npc-turn':{name:'NPC agenda and schedule review',sample:{worldTime:180,npcs:[{id:'ep:npc:captain001',status:'active',knownFactIds:['ep:fact:manifest001']}],knownFactIds:['ep:fact:manifest001'],dueActions:[{id:'ep:schedule:captain001',npcId:'ep:npc:captain001',agendaId:'ep:agenda:captain001',kind:'review-supply-route',dueWorldTime:120,status:'due',requiredKnowledgeIds:['ep:fact:manifest001']}]}},
  'viability':{name:'Investigation route viability',sample:{investigationId:'ep:investigation:harbor001',coverage:'partial',objectives:[{id:'ep:objective:manifest001',requiredEvidenceIds:['ep:evidence:manifest001']}],opportunities:[{id:'ep:opportunity:ledger001',evidenceId:'ep:evidence:manifest001',status:'available'}],verifiedEvidenceIds:[]}},
  'continuity':{name:'Campaign continuity handoff',sample:{sourceArcId:'ep:arc:waterdeep001',targetArcId:'ep:arc:neverwinter001',sourceResolutionId:'ep:resolution:waterdeep001',refs:[{narrativeId:'ep:npc:captain001',sourceEventId:'ep:event:captured001',kind:'living-entity',bindingState:'available',intention:'reference'},{narrativeId:'ep:hook:officer001',sourceEventId:'ep:event:escaped001',kind:'story-hook',bindingState:'available',intention:'dormant'}]}},
  'health':{name:'Narrative health assessment',sample:{arcId:'ep:arc:waterdeep001',worldTime:150,coverage:'partial',objectives:[{id:'ep:objective:shipment001',status:'active',confirmedBlocked:true}],deadlines:[{id:'ep:schedule:raid001',dueAt:120,status:'pending'}],requests:[],unresolvedLinks:[]}},
  'milestones':{name:'Investigation milestone qualification',sample:{milestones:[{id:'ep:milestone:manifest001',objectiveId:'ep:objective:shipment001',kind:'discovery',requiredEvidenceIds:['ep:evidence:manifest001'],requiredFactIds:[]}],contributions:[{eventId:'ep:event:manifest001',objectiveId:'ep:objective:shipment001',actorId:'ep:actor:rogue001',evidenceId:'ep:evidence:manifest001',authorized:true}],authorizedEvidenceIds:['ep:evidence:manifest001']}}
});
export function evaluatePlanningFixture(mode,input){
  if(!Object.hasOwn(modes,mode))throw Error('Unknown planning mode');
  if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>24_000)
    throw Error('A bounded JSON scenario is required');
  if(mode==='what-if')return runIsolatedWhatIf(input);
  if(mode==='time-jump')return buildTimeTransition(input);
  if(mode==='arc-ending')return proposeArcEnding(input.endings??[],input.worldFacets??{});
  if(mode==='knowledge')return planKnowledgePropagation(input);
  if(mode==='faction')return planFactionTurn(input);
  if(mode==='closure')return planCampaignClosure(input);
  if(mode==='resources')return auditResourceReferences(input);
  if(mode==='vote')return evaluateNarrativeVote(input);
  if(mode==='milestones')return evaluateSharedMilestones(input);
  if(mode==='correction')return planBeliefReconciliation(input);
  if(mode==='npc-turn')return planNPCCampaignTurn(input);
  if(mode==='viability')return analyzeInvestigationViability(input);
  if(mode==='continuity')return prepareContinuityHandoff(input);
  if(mode==='health')return assessNarrativeHealth(input);
  return mergeBlueprintInstance(input);
}
export function makeGMPlanningLabWindow(Base,{gameInstance,planStoreProvider=null,simulatePublished=null,planSubmissions=null}={}){
  return class EasyPlotsPlanningLab extends Base {
    static DEFAULT_OPTIONS={id:'easy-plots-planning-lab',window:{title:'Easy Plots — GM Planning Lab',resizable:true},position:{width:790,height:640}};
    #mode='what-if';#input=JSON.stringify(modes['what-if'].sample,null,2);#result=null;#message='';#busy=false;#savedId=null;#savedRevision=null;#savedState=null;#submission=null;
    #forget(){this.#result=null;this.#message='';this.#savedId=null;this.#savedRevision=null;this.#savedState=null;this.#submission=null;}
    async _renderHTML(){
      const root=el('section','ep-editor ep-planning-lab');
      if(!gameInstance?.user?.isGM){root.append(el('p','ep-error','GM authority required'));return root;}
      root.append(el('h2','','Narrative Planning & Simulation'));
      root.append(el('p','ep-banner','Previews do not execute effects. Save and review a plan, then submit it to live plots for separate GM effect approval.'));
      const options=el('select','ep-input');options.dataset.field='mode';
      for(const [id,v] of Object.entries(modes)){if(id==='published-graph'&&typeof simulatePublished!=='function')continue;const opt=el('option','',v.name);opt.value=id;options.append(opt);}options.value=this.#mode;
      root.append(options);
      const input=el('textarea','ep-input');input.dataset.field='scenario';input.rows=15;input.value=this.#input;root.append(input);
      for(const [action,name] of [['example','Load example'],['run','Evaluate preview'],...(planStoreProvider?.()?[['save-plan','Save GM review plan'],['acknowledge-plan','Acknowledge saved plan']]:[]),...(planSubmissions?[['preview-submission','Preview live planning intent'],['submit-plan','Submit reviewed plan to live plots']]:[])]){
        const b=el('button','ep-button',name);b.type='button';b.dataset.action=action;
        b.disabled=action==='acknowledge-plan'&&this.#savedState!=='draft-preview'||action==='preview-submission'&&!['acknowledged-for-manual-followup','submitted-for-gm-effects'].includes(this.#savedState)||action==='submit-plan'&&!this.#submission;
        root.append(b);
      }
      if(this.#message)root.append(el('p','ep-warning ep-plan-message',this.#message));
      if(this.#savedId)root.append(el('p','ep-notice ep-saved-plan',`Saved plan ${this.#savedId} · revision ${this.#savedRevision} · ${this.#savedState}. Effects require their own GM approval.`));
      if(this.#submission){const pre=el('pre','ep-plan-intent',JSON.stringify(this.#submission.event,null,2));root.append(pre);}
      if(this.#result){const box=el('section','ep-panel ep-plan-preview');box.append(el('h3','','Preview result'));
        const pre=el('pre','ep-lab-output',JSON.stringify(this.#result,null,2));box.append(pre);root.append(box);}
      root.addEventListener('input',event=>{
        if(event.target!==input||this.#busy)return;
        this.#input=input.value;this.#forget();
        root.querySelectorAll('.ep-plan-preview,.ep-plan-intent,.ep-saved-plan,.ep-plan-message').forEach(e=>e.remove());
        for(const action of ['acknowledge-plan','preview-submission','submit-plan']){const b=root.querySelector(`[data-action="${action}"]`);if(b)b.disabled=true;}
      });
      root.addEventListener('change',event=>{
        if(event.target?.dataset?.field!=='mode'||this.#busy)return;
        this.#mode=options.value;this.#input=JSON.stringify(modes[this.#mode].sample,null,2);this.#forget();void this.render();
      });
      root.addEventListener('click',event=>{
        const button=event.target.closest?.('button[data-action]');if(!button||button.disabled||this.#busy)return;
        void (async()=>{this.#busy=true;this.#message='';root.querySelectorAll('button,select,textarea').forEach(e=>{e.disabled=true;});try{
          if(!gameInstance?.user?.isGM)throw Error('GM authority required');
          if(button.dataset.action==='example'){this.#input=JSON.stringify(modes[this.#mode].sample,null,2);this.#forget();}
          else if(button.dataset.action==='acknowledge-plan'){
            const store=planStoreProvider?.();if(!store||!this.#savedId)throw Error('No durable plan to acknowledge');
            const row=await store.acknowledge({id:this.#savedId,expectedRevision:this.#savedRevision,approvalEventId:`ep:event:gm_review_${secureUUID().replaceAll('-','_')}`});
            this.#savedRevision=row.revision;this.#savedState=row.data.state;this.#submission=null;this.#message='Review acknowledgement recorded. No effects executed.';
          } else if(button.dataset.action==='preview-submission'){
            this.#submission=await planSubmissions.preview({id:this.#savedId,expectedRevision:this.#savedRevision});this.#message='Review the live planning intent below. Proposed effects will require separate GM approval.';
          } else if(button.dataset.action==='submit-plan'){
            if(!this.#submission)throw Error('Preview the live intent first');
            const result=await planSubmissions.submit({id:this.#savedId,expectedRevision:this.#savedRevision},{approved:true});
            this.#savedRevision=result.planRevision;this.#savedState='submitted-for-gm-effects';this.#submission=null;
            this.#message=`Planning intent ${result.eventId}: ${result.status}. Open Event Review with this event ID to approve effects.`;
          } else {this.#input=input.value;this.#forget();if(this.#input.length>24_000)throw Error('Scenario exceeds input budget');
            const scenario=JSON.parse(this.#input);
            if(button.dataset.action==='save-plan'){
              const store=planStoreProvider?.();if(!store)throw Error('Protected GM plan repository unavailable');
              const id=`ep:plan:${secureUUID().replaceAll('-','_')}`;
              const row=await store.create({id,scope:'world',mode:this.#mode,scenario,sourceEventId:`ep:event:gm_plan_${secureUUID().replaceAll('-','_')}`});
              this.#savedId=row.id;this.#savedRevision=row.revision;this.#savedState=row.data.state;this.#result=row.data.preview;this.#message='GM-only plan saved. Review or act on any effects separately.';
            }else this.#result=this.#mode==='published-graph'?await simulatePublished(scenario):evaluatePlanningFixture(this.#mode,scenario);
          }
        }catch(error){this.#submission=null;this.#message=`Planning action rejected: ${error.code??error.message}`;
          if(button.dataset.action==='submit-plan'&&this.#savedId){try{const row=await planStoreProvider?.()?.read?.('world',this.#savedId);if(row){this.#savedRevision=row.revision;this.#savedState=row.data.state;}}catch{}}
        }
        finally{this.#busy=false;await this.render();}})();
      });
      return root;
    }
    _replaceHTML(result,content){content.replaceChildren(result);}
  };
}
