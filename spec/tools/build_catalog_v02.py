import csv,json,collections,pathlib
D=pathlib.Path('/mnt/data/easy_plots_spec_v0.2')
# Each tuple: domain, provider ID, category, port signatures, GM secret default, needs native effect, ADR source
rows=[]
def add(domain,source,items):
    for name,kind,port,conf,effect in items:
        rows.append(dict(node_type_id='easy-plots.'+domain+'.'+name,node_type_version='1.0.0',domain=domain,
        node_role=kind,port_signature=port,default_access=conf,may_request_effect='yes' if effect else 'no',
        publishing_gate='provider+schema+security+revision',required_source_adrs=source,contract_status='proposed; Foundry validation pending'))
add('core','ADR-001;ADR-004;ADR-005;ADR-006;ADR-073;ADR-080',[
('event-received','trigger','out:event', 'gm',False),('document-event','trigger','out:event','gm',False),('schedule-due','trigger','out:event','gm',False),('manual-trigger','trigger','out:event','gm',False),('evaluate-condition','logic','in:event;out:boolean','gm',False),('branch-exclusive','logic','in:boolean;out:flow[]','gm',False),('branch-parallel','logic','in:event;out:flow[]','gm',False),('join','logic','in:flow[];out:flow','gm',False),('subgraph-call','logic','in:typed[];out:typed[]','gm',False),('event-filter','logic','in:event;out:event','gm',False),('state-read','data','in:entity;out:value','gm',False),('state-proposal','state','in:event;out:intent','gm',False),('approval-gate','logic','in:intent;out:approval','gm',False),('rate-budget-gate','logic','in:event;out:flow','gm',False),('publish-view','projection','in:approved-data;out:view','gm',False),('effect-intent','effect','in:approved-intent;out:operation','gm',True)])
add('quests','ADR-031;ADR-053;ADR-114;ADR-115',[
('qualify-milestone','state','in:event;out:milestone','gm',False),('complete-milestone','effect','in:milestone;out:state','gm',True),('quest-projection','projection','in:objective;out:view','gm',False),('unlock-opportunity','state','in:event;out:opportunity','gm',False),('cross-plot-dependency','logic','in:event;out:target[]','gm',False),('outcome-exclusivity','logic','in:state;out:eligibility','gm',False),('objective-closure','effect','in:review;out:status','gm',True)])
add('knowledge','ADR-015;ADR-038;ADR-042;ADR-044;ADR-106;ADR-107;ADR-113',[
('canonical-fact','data','out:fact','gm-secret',False),('observer-claim','data','out:claim','observer-private',False),('evidence-discovered','trigger','out:evidence','gm',False),('evidence-corroboration','logic','in:evidence[];out:assessment','gm',False),('knowledge-policy','logic','in:fact;out:policy','gm-secret',False),('disclosure-request','state','in:knowledge;out:intent','gm',False),('retraction','state','in:claim;out:revision','gm',False),('belief-update','state','in:evidence;out:belief','gm',False),('rumor-propagation','logic','in:claim;out:targets[]','gm',False),('hypothesis-evaluation','logic','in:public-claims;out:gm-review','gm-secret',False),('safe-affordance','projection','in:policy;out:allowlisted-action','gm',False)])
add('investigation','ADR-042;ADR-043;ADR-111;ADR-112;ADR-113',[
('opportunity','state','in:context;out:attempt','gm',False),('shared-evidence','state','in:disclosure;out:knowledge','gm',False),('contribution-ledger','state','in:event;out:credit','gm',False),('viability-check','diagnostic','in:objective;out:report','gm',False),('conclusion-review','effect','in:hypothesis;out:resolution','gm',True)])
add('factions','ADR-011;ADR-012;ADR-013;ADR-035;ADR-049',[
('membership-change','effect','in:authorized;out:membership','gm',True),('renown-change','effect','in:authorized;out:renown','gm',True),('rank-and-privilege-check','logic','in:member;out:eligibility','gm',False),('agenda-due','trigger','out:event','gm',False),('agenda-evaluate','logic','in:knowledge;out:decision','gm',False),('threat-clock-tick','effect','in:approved-event;out:clock','gm',True),('faction-reaction','effect','in:approved-event;out:agenda-effect','gm',True)])
add('people','ADR-032;ADR-034;ADR-036;ADR-104;ADR-105',[
('identity-persona','data','out:identity','gm-secret',False),('relationship-evaluate','logic','in:observer;out:relation','gm',False),('debt-and-favor','data','out:obligation','gm',False),('obligation-update','effect','in:approved-event;out:obligation','gm',True),('npc-schedule','trigger','out:due','gm',False),('npc-agenda','logic','in:context;out:intent','gm',False),('persona-reveal','effect','in:authorized-disclosure;out:knowledge','gm',True)])
add('spatial','ADR-033',[
('location-hierarchy','data','out:location','gm',False),('route-check','logic','in:location;out:availability','gm',False),('discover-location','effect','in:approved-event;out:knowledge','gm',True),('geographic-trigger','trigger','out:event','gm',False),('travel-event','trigger','out:journey','gm',False)])
add('temporal','ADR-016;ADR-037;ADR-039;ADR-048;ADR-079;ADR-118',[
('fiction-time-guard','logic','in:worldtime;out:boolean','gm',False),('due-event','trigger','out:event','gm',False),('deadline-check','logic','in:time;out:state','gm',False),('delayed-consequence','effect','in:authorized;out:queued','gm',True),('world-time-plan','diagnostic','in:interval;out:plan','gm',False),('time-reconcile','effect','in:gm-approved-plan;out:events','gm',True),('timeline-view','projection','in:audience;out:timeline','gm',False),('alternate-branch','simulation','in:snapshot;out:hypothesis','gm',False)])
add('encounters','ADR-041;ADR-089;ADR-109',[
('encounter-ready','trigger','out:event','gm',False),('native-roll','effect','in:authorized-check;out:roll','gm',True),('partial-success-band','logic','in:roll;out:band','gm',False),('combat-event','trigger','out:event','gm',False),('encounter-closure','effect','in:outcome;out:events','gm',True)])
add('arcs','ADR-053;ADR-116;ADR-117',[
('ending-eligibility','logic','in:facets;out:ending[]','gm',False),('primary-ending-selection','effect','in:approved-choice;out:resolution','gm',True),('epilogue-projection','projection','in:resolution;out:view','gm',False),('continuity-manifest','state','in:resolution;out:refs','gm',False),('dormant-hook-activation','effect','in:policy;out:activation','gm',True),('aftereffect','effect','in:event;out:future','gm',True)])
add('resources','ADR-020;ADR-040;ADR-099;ADR-100;ADR-101;ADR-103',[
('native-resource-plan','state','in:template;out:manifest','gm',False),('materialize-foundry-document','effect','in:approved-manifest;out:uuid','gm',True),('resource-drift-verify','diagnostic','in:manifest;out:report','gm',False),('guided-rebind','effect','in:review;out:reference','gm',True),('blueprint-inherit','data','in:base;out:instance','gm',False),('blueprint-merge-preview','simulation','in:revisions;out:diff','gm',False)])
add('planning','ADR-050;ADR-051;ADR-054;ADR-056;ADR-095;ADR-096;ADR-097;ADR-098',[
('session-agenda','projection','in:plot[];out:plan','gm',False),('narrative-health','diagnostic','in:scope;out:report','gm',False),('why-why-not','diagnostic','in:event;out:causes','gm',False),('what-if','simulation','in:state;out:isolated-result','gm',False),('forecast','simulation','in:scope;out:forecast','gm',False),('reviewed-recap','projection','in:verified-events;out:recap','gm',False),('attention-priority','presentation','in:signals;out:attention','gm',False)])
add('intents','ADR-030;ADR-046;ADR-047;ADR-090;ADR-091;ADR-108;ADR-110',[
('submit-affordance','presentation','in:view;out:intent','published',False),('gm-review-request','state','in:intent;out:review','gm',False),('vote-collection','state','in:approved-ballot;out:decision','gm',False),('attempt-deduplicate','logic','in:attempt;out:classification','gm',False)])
add('publication','ADR-026;ADR-077;ADR-078;ADR-119',[
('graph-preflight','diagnostic','in:draft;out:report','gm',False),('publish-snapshot','effect','in:approved-draft;out:snapshot','gm',True),('activate-snapshot','effect','in:approved-snapshot;out:activation','gm',True)])
keys=set()
for r in rows:
 if r['node_type_id'] in keys: raise ValueError(r['node_type_id'])
 keys.add(r['node_type_id'])
with (D/'Domain_Node_Provider_Catalog.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
with (D/'Domain_Node_Provider_Catalog.json').open('w',encoding='utf-8') as f:
 json.dump({'catalogRevision':'0.2-draft','status':'proposed; not implemented','nodeTypes':rows},f,indent=2)
print('node contracts:',len(rows), 'by domain',dict(collections.Counter(r['domain'] for r in rows)))
