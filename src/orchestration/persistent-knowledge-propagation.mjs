/** GM-reviewed, durable recipient-by-recipient knowledge propagation.
 * Planning cannot disclose claims.  An authorized recipient commit creates a
 * single stable receipt through PersistentKnowledgeLedger; interrupted commits
 * are replay-safe because the receipt identity derives from source/observer.
 * Only explicit, bounded GM planning inputs are considered. No automatic
 * rumor cascade or player-side canonical-truth evaluation exists here.
 */
import {EasyPlotsError} from '../contracts/errors.mjs';
import {assertNarrativeId,clone} from '../contracts/record.mjs';
import {sha256Hex} from '../contracts/digest.mjs';
import {planKnowledgePropagation} from './knowledge-propagation.mjs';
const fail=(code,msg)=>{throw new EasyPlotsError(code,msg);};
const SCOPE=/^[a-z][a-z0-9-]{0,47}$/;
function check(scope,id){if(!SCOPE.test(scope??''))fail('PROPAGATION_SCOPE','Explicit bounded narrative scope required');assertNarrativeId(id);}
async function stepId(planId,recipientId){return `ep:propagation-step:${(await sha256Hex(planId+'|'+recipientId)).slice(0,30)}`;}
export class PersistentKnowledgePropagation {
  #domains;#knowledge;
  constructor({domains,knowledge}={}){
    if(typeof domains?.read!=='function'||typeof domains?.save!=='function'||
      typeof knowledge?.recordDisclosure!=='function')fail('PROPAGATION_DEPENDENCY','Protected domain store and knowledge ledger required');
    this.#domains=domains;this.#knowledge=knowledge;
  }
  async readPlan({scope='world',planId}={}){check(scope,planId);return this.#domains.read('knowledge-propagation-plan',scope,planId);}
  async plan({scope='world',planId,disclosure,connections=[],recipientStates=[],worldTime=0,
     sourceEventId,maxHops=4}={}){
    check(scope,planId);assertNarrativeId(sourceEventId);assertNarrativeId(disclosure?.claimId);
    if(disclosure.eventId!==sourceEventId)fail('PROPAGATION_ORIGIN','Plan source event and disclosure event must be identical');
    const claim=await this.#domains.read('knowledge-claim',scope,disclosure.claimId);
    if(!claim)fail('KNOWLEDGE_CLAIM_MISSING','Verified canonical claim required before propagation planning');
    const preview=planKnowledgePropagation({disclosure,connections,recipientStates,worldTime,
      maxHops,maxPlanned:16,maxRecipients:32,maxConnections:48});
    // Unverified recipient scopes must not be silently dropped when saving a
    // plan; surface exclusions for GM review. Only reference IDs, no truth text.
    const proposals=preview.proposals.map(({observerId,sourceEventId,claimId,sourceId,stance,
      status,notBefore,provenanceEventIds,pathDepth})=>({observerId,sourceEventId,claimId,sourceId,
      stance,status,notBefore,provenanceEventIds,pathDepth}));
    if(proposals.length===0)fail('PROPAGATION_EMPTY','No qualifying recipient in scoped snapshot');
    const data={planId,sourceEventId,claimId:disclosure.claimId,
      claimRevision:claim.revision,worldTime,proposals,excluded:preview.excluded,
      status:'pending-gm-review',canonicalTruthIncluded:false};
    const prior=await this.readPlan({scope,planId});
    if(prior){if(JSON.stringify(prior.data)===JSON.stringify(data))return prior;
      fail('PROPAGATION_IMMUTABLE','An existing propagation plan cannot be replaced');}
    return this.#domains.save({type:'knowledge-propagation-plan',scope,id:planId,sourceEventId,data});
  }
  async readDecision({scope='world',planId,recipientId}={}){
    check(scope,planId);assertNarrativeId(recipientId);
    return this.#domains.read('knowledge-propagation-step',scope,await stepId(planId,recipientId));
  }
  /** One recipient at a time; explicit GM-authorized approval. A failure after
   * receipt creation but before decision recording is recoverable by repeating
   * with the same approval identity. The receipt itself is already canonical.
   */
  async approveRecipient({scope='world',planId,recipientId,expectedPlanRevision,
    approvalEventId,worldTime,approved=false}={}){
    check(scope,planId);assertNarrativeId(recipientId);assertNarrativeId(approvalEventId);
    if(approved!==true)fail('PROPAGATION_AUTHORIZATION','Explicit GM approval required');
    if(!Number.isFinite(worldTime)||worldTime<0)fail('PROPAGATION_TIME','Valid world time required');
    const plan=await this.readPlan({scope,planId});
    if(!plan||plan.revision!==expectedPlanRevision)fail('REVISION_CONFLICT','Propagation plan unavailable or changed');
    const proposal=plan.data.proposals.find(p=>p.observerId===recipientId);
    if(!proposal)fail('PROPAGATION_RECIPIENT','Recipient absent from approved scope');
    if(proposal.notBefore>worldTime)fail('PROPAGATION_NOT_DUE','Delayed disclosure cannot publish early');
    const claim=await this.#domains.read('knowledge-claim',scope,plan.data.claimId);
    if(!claim||claim.revision!==plan.data.claimRevision)fail('REVISION_CONFLICT','Canonical claim changed after propagation was planned');
    const prior=await this.readDecision({scope,planId,recipientId});
    if(prior){if(prior.data.approvalEventId===approvalEventId)return clone(prior);
      fail('PROPAGATION_REVIEW_CONFLICT','Recipient already adjudicated under another approval');}
    const receipt=await this.#knowledge.recordDisclosure({scope,claimId:proposal.claimId,
      observerId:recipientId,sourceId:proposal.sourceId,sourceEventId:proposal.sourceEventId,
      stance:proposal.stance,availableAt:proposal.notBefore,state:'published',authorized:true});
    const id=await stepId(planId,recipientId);
    return this.#domains.save({type:'knowledge-propagation-step',scope,id,
      sourceEventId:approvalEventId,data:{planId,observerId:recipientId,approvalEventId,
        receiptId:receipt.id,claimId:plan.data.claimId,planRevision:plan.revision,
        receiptRevision:receipt.revision,status:'approved-published'}});
  }
  async verifyRecipient({scope='world',planId,recipientId,approvalEventId}={}){
    check(scope,planId);assertNarrativeId(recipientId);assertNarrativeId(approvalEventId);
    const decision=await this.readDecision({scope,planId,recipientId});
    if(!decision||decision.data.approvalEventId!==approvalEventId||decision.data.status!=='approved-published')return false;
    const receipt=await this.#domains.read('knowledge-receipt',scope,decision.data.receiptId);
    const plan=await this.readPlan({scope,planId});
    return Boolean(receipt&&plan&&receipt.revision===decision.data.receiptRevision&&
      receipt.data.observerId===recipientId&&receipt.data.claimId===plan.data.claimId&&
      receipt.data.sourceEventId===plan.data.sourceEventId&&receipt.data.state==='published');
  }
  async projection({scope='world',planId,observerId,worldTime=0}={}){
    check(scope,planId);assertNarrativeId(observerId);
    const plan=await this.readPlan({scope,planId});if(!plan)return {claims:[]};
    const decision=await this.readDecision({scope,planId,recipientId:observerId});
    if(!decision||decision.data.status!=='approved-published')return {claims:[]};
    // Source and intermediary identity never cross the recipient boundary.
    const projected=await this.#knowledge.projection({scope,observerId,
      receiptIds:[decision.data.receiptId],worldTime});
    return {claims:projected.claims};
  }
}
