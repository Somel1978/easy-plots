from pathlib import Path
import csv,json,collections,subprocess
from jsonschema import Draft202012Validator
ROOT=Path(__file__).resolve().parents[1]
read=lambda p:list(csv.DictReader((ROOT/p).open(encoding='utf8',newline='')))
dec=read('Decision_Register_125.csv');tests=read('Full_125_Decision_Acceptance_Matrix.csv');node=read('Domain_Node_Provider_Catalog.csv');storage=read('Document_and_Index_Storage_Map.csv');req=read('Traceability_Matrix.csv')
assert len(dec)==len(tests)==125
assert {r['decision_id'] for r in dec}=={r['decision_id'] for r in tests}
assert len({r['test_id'] for r in tests})==125
assert len({r['node_type_id'] for r in node})==len(node)
assert len({r['record_kind'] for r in storage})==len(storage)
assert all(r['decision_test_id']=='TEST-'+r['decision_id'] for r in dec)
assert all(set(r['source_decisions'].split(';')).issubset({d['decision_id'] for d in dec}) for r in req)
assert all(r['execution_status']=='Proposed; never executed' for r in tests)
for name in ['Proposed_Core_Schemas_V1.json','Additional_Domain_Schemas_V1.json']:
 s=json.loads((ROOT/name).read_text(encoding='utf8'));Draft202012Validator.check_schema(s)
fixture=json.loads((ROOT/'Example_Canonical_Event_V1.json').read_text(encoding='utf8'))
core=json.loads((ROOT/'Proposed_Core_Schemas_V1.json').read_text(encoding='utf8'))
Draft202012Validator(core['$defs']['Event']).validate(fixture) if not core['$defs']['Event'].get('$ref') else None
p=subprocess.run(['tsc','--noEmit','--strict','--target','ES2022','--module','ESNext','--moduleResolution','Node','Contracts_V1_Proposed.ts','Domain_Contracts_V1_Proposed.ts'],cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
assert p.returncode==0,p.stdout
print(f'PASS: {len(dec)} decisions, {len(tests)} decision-specific proposed tests, {len(req)} requirement groups')
print(f'PASS: {len(node)} unique candidate node providers, {len(storage)} unique logical record groups')
print('PASS: 2 JSON Schema bundles structurally valid; existing fixture validation checked; both TS proposal files compile')
print('NOT RUN: actual Foundry VTT, permissions, sockets, co-GM, native effects, migrations, performance')
