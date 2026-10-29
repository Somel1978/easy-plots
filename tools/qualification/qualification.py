"""Evidence-driven qualification; no network, native execution, or inferred completion.

Engineering closure, executed local regression, and native acceptance are three
independent facts. Readers may inspect blocked reports without running a release
gate. The native matrix never interprets module.json's verified field as proof.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IDENTITY_FIELDS = ('core_version', 'core_build', 'system_id', 'system_version', 'browser', 'platform')
REVIEW_STATUSES = {'implemented', 'open', 'final-native-only'}
CONTRACT_STATUSES = {'equivalent', 'implemented-with-documented-interface', 'mapping-reviewed-with-explicit-limits', 'open'}


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def checked_path(root, value):
    if not isinstance(value, str) or not value or '\\' in value:
        raise ValueError('Expected a nonempty repository-relative POSIX path')
    path = (root / value).resolve()
    if Path(value).is_absolute() or not path.is_relative_to(root.resolve()) or '..' in Path(value).parts:
        raise ValueError('Reference escapes repository: ' + value)
    if not path.is_file():
        raise ValueError('Missing referenced file: ' + value)
    return path


def source_digest(root=ROOT):
    """Exactly the runtime/test/spec fingerprint written by test-evidence-reporter."""
    paths = [p for folder in ('src', 'tests', 'lang', 'spec')
             for p in (root / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
    paths += [root / 'package.json', root / 'module.json']
    return digest_paths(root, paths)


def digest_paths(root, paths):
    digest = hashlib.sha256()
    for path in sorted(set(paths), key=lambda p: p.relative_to(root).as_posix()):
        digest.update(path.relative_to(root).as_posix().encode())
        digest.update(b'\0')
        digest.update(path.read_bytes())
        digest.update(b'\0')
    return digest.hexdigest()


def json_text(value):
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + '\n'


def csv_text(rows, fields=None):
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=fields or list(rows[0]), lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()


def read_csv(root, filename):
    with checked_path(root, filename).open(newline='') as stream:
        return list(csv.DictReader(stream))


def unique_index(rows, field):
    result = {}
    for row in rows:
        key = row[field]
        if key in result:
            raise ValueError('Duplicate ' + field + ': ' + key)
        result[key] = row
    return result


def split(value):
    return [s for s in value.split(';') if s]


def issue(code, subject, detail, severity='error'):
    return {'code': code, 'subject': subject, 'detail': detail, 'severity': severity}


def load_suite(root, path=None):
    version = json.loads((root / 'package.json').read_text())['version']
    suffix = version.removesuffix('.0-dev')
    filename = path or f'docs/local-test-evidence-v{suffix}.jsonl'
    result = {'status': 'missing', 'file': filename, 'source_digest': None, 'cases': [], 'reason': 'No executed local suite evidence'}
    if not (root / filename).is_file():
        return result
    events = [json.loads(line) for line in checked_path(root, filename).read_text().splitlines() if line]
    if not events or events[0].get('event') != 'run:start':
        return dict(result, status='invalid', reason='Evidence does not start with run:start')
    start = events[0]
    result['source_digest'] = start.get('sourceDigest')
    if start.get('version') != version or start.get('sourceDigest') != source_digest(root):
        return dict(result, status='stale', reason='Version or runtime/test/spec fingerprint differs from executed source')
    summary = next((e for e in reversed(events) if e.get('event') == 'test:summary' and e.get('file') is None), None)
    cases = [e for e in events if e.get('event') == 'test:pass']
    counts = summary.get('counts', {}) if summary else {}
    if (not summary or not summary.get('success') or
            any(counts.get(k, 0) for k in ('failed', 'cancelled', 'skipped', 'todo')) or
            any(e.get('event') == 'test:fail' for e in events) or counts.get('passed') != len(cases)):
        return dict(result, status='incomplete', reason='Suite must complete with individual passing cases and no failed/cancelled/skipped/todo cases')
    current_files = {p.relative_to(root).as_posix() for p in (root / 'tests').glob('*.test.mjs')}
    if set(start.get('testFiles', [])) != current_files or not current_files.issubset({e.get('file') for e in cases}):
        return dict(result, status='incomplete', reason='The complete current test-file inventory has not executed')
    normalized = []
    seen = set()
    for event in cases:
        file, name, line = event.get('file'), event.get('name'), event.get('line')
        if not isinstance(name, str) or not name.strip() or file not in current_files or not isinstance(line, int) or line < 1 or name == file:
            return dict(result, status='invalid', reason='File-only or malformed results cannot substantiate a case')
        identity = (file, name, line)
        if identity in seen:
            return dict(result, status='invalid', reason='Duplicate executed case identity')
        seen.add(identity)
        case_id = 'CASE-' + hashlib.sha256(json.dumps([version, start['sourceDigest'], *identity], separators=(',', ':')).encode()).hexdigest()
        normalized.append({'case_id': case_id, 'file': file, 'name': name, 'line': line,
                           'source_digest': start['sourceDigest'], 'test_file_sha256': sha256(checked_path(root, file)),
                           'evidence_file': filename, 'outcome': 'pass'})
    return dict(result, status='current-pass', reason='Actual complete case-level Node execution; no native execution implied', cases=normalized)


def match_cases(cases, references):
    found, missing = {}, []
    for ref in references:
        if not isinstance(ref.get('file'), str) or not isinstance(ref.get('name_contains'), str) or not ref['name_contains'].strip():
            raise ValueError('Case references need file and nonempty name_contains')
        matches = [c for c in cases if c['file'] == ref['file'] and ref['name_contains'].casefold() in c['name'].casefold()]
        if not matches:
            missing.append(ref)
        for case in matches:
            found[case['case_id']] = case
    return sorted(found.values(), key=lambda c: c['case_id']), missing


def make_review(root, decision_id, status, rationale, source_files, tests, *, contract=False, interface_resolution=None):
    """Snapshot files after engineering review; never infer a status from case counts."""
    allowed = CONTRACT_STATUSES if contract else REVIEW_STATUSES
    if status not in allowed:
        raise ValueError('Unknown review status: ' + status)
    if len(rationale.strip()) < 30:
        raise ValueError('Review requires a concrete rationale of at least 30 characters')
    paths = set(source_files) | {ref['file'] for ref in tests}
    fingerprints = {file: sha256(checked_path(root, file)) for file in sorted(paths)}
    result = {('contract_id' if contract else 'decision_id'): decision_id, 'status': status,
              'rationale': rationale, 'source_fingerprints': fingerprints, 'tests': tests,
              'reviewed_at': datetime.now(timezone.utc).isoformat()}
    if contract:
        result['interface_resolution'] = interface_resolution or ''
    return result


def validate_review(root, review, cases, *, contract=False):
    allowed = CONTRACT_STATUSES if contract else REVIEW_STATUSES
    if review.get('status') not in allowed or len(review.get('rationale', '').strip()) < 30:
        raise ValueError('Invalid engineering review status or rationale')
    if review['status'] == 'open':
        return 'open', ['explicit-open-review'], []
    if review['status'] == 'final-native-only' and review.get('decision_id') != 'ADR-021':
        raise ValueError('Only ADR-021 has the agreed final-native-only implementation exception')
    fingerprints = review.get('source_fingerprints', {})
    references = review.get('tests', [])
    if not fingerprints or not references:
        return 'unsubstantiated', ['review-has-no-source-or-case-evidence'], []
    if not any(file.startswith(('src/', 'tools/')) for file in fingerprints):
        return 'unsubstantiated', ['review-has-no-implementation-source'], []
    for file, expected in fingerprints.items():
        if not re.fullmatch('[0-9a-f]{64}', expected or ''):
            raise ValueError('Invalid source fingerprint: ' + file)
        if sha256(checked_path(root, file)) != expected:
            return 'stale', ['reviewed-source-changed:' + file], []
    if any(ref['file'] not in fingerprints for ref in references):
        return 'unsubstantiated', ['review-test-file-not-fingerprinted'], []
    matched, missing = match_cases(cases, references)
    if missing:
        return 'unsubstantiated', ['review-case-not-executed:' + ref['file'] + ':' + ref['name_contains'] for ref in missing], matched
    if contract and review['status'] in {'implemented-with-documented-interface', 'mapping-reviewed-with-explicit-limits'} and len(review.get('interface_resolution', '').strip()) < 30:
        return 'unsubstantiated', ['documented-interface-resolution-required'], matched
    return review['status'], [], matched


def audit_traceability(decisions, requirements, acceptance, candidates, semantics):
    """Validate both authoritative directions; named contracts and candidates differ."""
    ds = unique_index(decisions, 'decision_id')
    rs = unique_index(requirements, 'requirement_id')
    ac = unique_index(acceptance, 'decision_id')
    cs = unique_index(candidates, 'node_type_id')
    issues, edges = [], []

    def edge(source_kind, source_id, relation, target_kind, target_id, provenance):
        edges.append({'source_kind': source_kind, 'source_id': source_id, 'relation': relation,
                      'target_kind': target_kind, 'target_id': target_id, 'provenance': provenance})

    if set(ds) != set(ac):
        issues.append(issue('acceptance-decision-set-mismatch', 'acceptance', 'Missing or extra decision scenarios: ' + str(sorted(set(ds) ^ set(ac)))))
    if set(cs) != set(semantics):
        issues.append(issue('semantic-contract-set-mismatch', 'candidates', 'Missing or extra semantic mappings: ' + str(sorted(set(cs) ^ set(semantics)))))
    for adr, decision in ds.items():
        for req in split(decision['requirement_ids']):
            edge('decision', adr, 'requires', 'requirement', req, 'spec/Decision_Register_125.csv')
            if req not in rs or adr not in split(rs[req]['source_decisions']):
                issues.append(issue('requirement-reverse-link-missing', adr, 'Requirement does not map back: ' + req))
        if adr in ac:
            scenario = ac[adr]
            edge('decision', adr, 'acceptance-scenario', 'scenario', scenario['test_id'], 'spec/Full_125_Decision_Acceptance_Matrix.csv')
            if scenario['test_id'] != decision['decision_test_id']:
                issues.append(issue('acceptance-id-contradiction', adr, 'Decision and acceptance matrix disagree on test_id'))
            if scenario['domain'] != decision['domain']:
                issues.append(issue('acceptance-domain-contradiction', adr, 'Decision and scenario domains disagree'))
    for req, requirement in rs.items():
        for adr in split(requirement['source_decisions']):
            edge('requirement', req, 'decision', 'decision', adr, 'spec/Traceability_Matrix.csv')
            if adr not in ds or req not in split(ds[adr]['requirement_ids']):
                issues.append(issue('decision-reverse-link-missing', req, 'Decision does not map back: ' + adr))
        expected_tests = {ds[adr]['decision_test_id'] for adr in split(requirement['source_decisions']) if adr in ds}
        if set(split(requirement['decision_level_test_ids'])) != expected_tests:
            issues.append(issue('requirement-test-contradiction', req, 'Requirement decision-level tests disagree with its linked decisions'))
        for contract in split(requirement['proposed_contracts']):
            edge('requirement', req, 'normative-contract', 'named-contract', contract, 'spec/Traceability_Matrix.csv')
    for key, candidate in cs.items():
        for adr in split(candidate['required_source_adrs']):
            edge('candidate-contract', key, 'supports-decision', 'decision', adr, 'spec/Domain_Node_Provider_Catalog.csv')
            if adr not in ds:
                issues.append(issue('contract-unknown-decision', key, 'Candidate refers to unknown decision: ' + adr))
        if key not in semantics:
            continue
        item = semantics[key]
        if item.get('interface_status') not in {'direct', 'composition', 'workflow', 'partial'}:
            issues.append(issue('unknown-semantic-disposition', key, 'No precise interface disposition'))
        if min(len(item.get('semantic_mapping', '')), len(item.get('deviation_or_limit', ''))) < 30:
            issues.append(issue('semantic-assessment-missing', key, 'Each candidate needs concrete mapping and explicit deviation/limit'))
        for node in item.get('engine_nodes', []):
            edge('candidate-contract', key, 'related-engine-node', 'engine-node', node, 'tools/qualification/semantic-contracts.json; semantic mapping, not ID equality')
        for entrypoint in item.get('service_entrypoints', []):
            edge('candidate-contract', key, 'implemented-workflow', 'service', entrypoint, 'tools/qualification/semantic-contracts.json')
        for file in item.get('test_sources', []):
            edge('candidate-contract', key, 'candidate-test-source', 'test-file', file, 'tools/qualification/semantic-contracts.json; execution checked separately')
    # Every relationship is queryable from either endpoint; inverse edges retain provenance.
    edges += [dict(e, source_kind=e['target_kind'], source_id=e['target_id'],
                   relation='inverse:' + e['relation'], target_kind=e['source_kind'], target_id=e['source_id']) for e in list(edges)]
    return issues, edges


def exact_identity(row):
    return all(isinstance(row.get(field), str) and row[field].strip() and row[field] != '*' for field in IDENTITY_FIELDS)


def valid_timestamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.tzinfo is not None and parsed <= datetime.now(timezone.utc)
    except (AttributeError, TypeError, ValueError):
        return False


def native_run(root, run, version, digest, known_decisions, dimensions):
    """Validate imported native evidence; this tool never executes a Foundry world."""
    errors = []
    run_id = run.get('run_id', '<unknown>')
    if run.get('environment_kind') != 'native-foundry' or not exact_identity(run.get('environment', {})):
        errors.append('native-environment-must-have-exact-build-system-browser-platform')
    if run.get('release_version') != version or run.get('source_digest') != digest:
        errors.append('native-source-or-version-stale')
    if not valid_timestamp(run.get('executed_at')):
        errors.append('native-execution-time-invalid')
    if not isinstance(run.get('operator'), str) or not run['operator'].strip():
        errors.append('native-operator-required')
    if not isinstance(run.get('run_id'), str) or not re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}', run['run_id']):
        errors.append('native-run-id-invalid')
    decisions, measured = {}, {}
    for kind, records, known, destination in (
            ('decision', run.get('scenarios', []), known_decisions, decisions),
            ('dimension', run.get('dimensions', []), dimensions, measured)):
        for record in records:
            key = record.get('id')
            if key not in known or key in destination:
                errors.append('native-' + kind + '-unknown-or-duplicate:' + str(key))
                continue
            destination[key] = record
            if record.get('outcome') not in {'pass', 'fail', 'blocked'} or len(record.get('observed', '').strip()) < 40:
                errors.append('native-observation-invalid:' + str(key))
            artifacts = record.get('artifacts', [])
            if not artifacts:
                errors.append('native-artifacts-required:' + str(key))
            for artifact in artifacts:
                path = checked_path(root, artifact['file'])
                if not path.stat().st_size or sha256(path) != artifact.get('sha256'):
                    errors.append('native-artifact-fingerprint-mismatch:' + str(key))
    if not decisions or not measured:
        errors.append('native-run-needs-scenarios-and-dimensions')
    return {'run_id': run_id, 'valid': not errors, 'errors': errors,
            'environment': run.get('environment', {}), 'scenarios': decisions, 'dimensions': measured,
            'executed_at': run.get('executed_at')}


def compatibility_matrix(targets, runs, decision_ids, dimension_ids, functional_ready, contract_ready, digest):
    rows = []
    for target in targets:
        exact = exact_identity(target)
        relevant = [r for r in runs if r['valid'] and exact and all(r['environment'].get(f) == target.get(f) for f in IDENTITY_FIELDS)]
        covered, dimensions, failures = set(), set(), []
        for run in relevant:
            for key, record in run['scenarios'].items():
                if record['outcome'] == 'pass':
                    covered.add(key)
                else:
                    failures.append(run['run_id'] + ':' + key + ':' + record['outcome'])
            for key, record in run['dimensions'].items():
                if record['outcome'] == 'pass':
                    dimensions.add(key)
                else:
                    failures.append(run['run_id'] + ':' + key + ':' + record['outcome'])
        reasons = []
        if not exact:
            reasons.append('exact-system-version-browser-platform-unknown')
        if not functional_ready:
            reasons.append('implementation-closure-not-established')
        if not contract_ready:
            reasons.append('semantic-contract-review-not-closed')
        if set(decision_ids) - covered:
            reasons.append('native-decision-scenarios-missing:' + str(len(set(decision_ids) - covered)))
        if set(dimension_ids) - dimensions:
            reasons.append('native-cross-cutting-dimensions-missing:' + str(len(set(dimension_ids) - dimensions)))
        if failures:
            reasons.append('native-failed-or-blocked-evidence:' + ';'.join(failures))
        rows.append({'target_id': target['target_id'], **{f: target.get(f) or 'unknown' for f in IDENTITY_FIELDS},
                     'declaration_basis': target.get('basis', 'Explicit qualification target'), 'source_digest': digest,
                     'native_run_ids': ';'.join(sorted(r['run_id'] for r in relevant)),
                     'native_decision_cases_passed': len(covered), 'native_dimensions_passed': len(dimensions),
                     'compatibility_claim': 'qualified-exact-environment' if not reasons else 'not-established',
                     'blockers': ';'.join(reasons), 'manifest_verified_is_execution_evidence': 'false'})
    return rows


def node_inventory(root):
    program = """import {GraphEditorModel,EDITABLE_NODE_TYPES} from './src/editor/model.mjs';
const m=new GraphEditorModel({registry:{}});m.newGraph('Qualification inventory');const r={};
for(const t of EDITABLE_NODE_TYPES){m.addNode(t.id);r[t.id]=m.selectedNode.ports;}console.log(JSON.stringify(r));"""
    result = subprocess.run(['node', '--input-type=module', '-e', program], cwd=root, text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def build_reports(root=ROOT):
    decisions = read_csv(root, 'spec/Decision_Register_125.csv')
    requirements = read_csv(root, 'spec/Traceability_Matrix.csv')
    acceptance = read_csv(root, 'spec/Full_125_Decision_Acceptance_Matrix.csv')
    candidates = read_csv(root, 'spec/Domain_Node_Provider_Catalog.csv')
    if (len(decisions), len(requirements), len(candidates)) != (125, 28, 97):
        raise ValueError('Agreed full scope must remain 125 decisions / 28 requirement groups / 97 candidate contracts')
    semantics = json.loads((root / 'tools/qualification/semantic-contracts.json').read_text())
    plan = json.loads((root / 'tools/qualification/plan.json').read_text())
    closure = json.loads((root / 'tools/implementation-closure.json').read_text())
    if plan.get('schema_version') != 1 or closure.get('schema_version') != 1:
        raise ValueError('Unknown qualification/review schema version')
    issues, edges = audit_traceability(decisions, requirements, acceptance, candidates, semantics)
    ds, ac = unique_index(decisions, 'decision_id'), unique_index(acceptance, 'decision_id')
    reviews = unique_index(closure.get('reviews', []), 'decision_id')
    contract_reviews = unique_index(closure.get('contract_reviews', []), 'contract_id')
    if set(reviews) - set(ds) or set(contract_reviews) - set(semantics):
        raise ValueError('Closure review contains unknown decision or candidate contract')
    suite = load_suite(root)
    cases = suite['cases']
    inventory = node_inventory(root)
    observations = unique_index(json.loads((root / 'tools/decision-review.json').read_text())['decisions'], 'decision_id')
    if set(observations) != set(ds):
        raise ValueError('Scenario observations must cover the exact agreed decision set')
    scenario_rows, contract_rows, local_links = [], [], []
    functional_open, semantic_open = [], []
    for adr, decision in ds.items():
        observation = observations[adr]
        matched, missing = match_cases(cases, observation['tests'])
        review = reviews.get(adr)
        status, blockers, reviewed_cases = validate_review(root, review, cases) if review else ('unreviewed', ['implementation-review-missing'], [])
        final_window_only = adr == 'ADR-021' and status == 'final-native-only' and observation['status'] == 'partial'
        if observation['status'] in {'partial', 'confirmed-gap', 'review-pending'} and status in {'implemented', 'final-native-only'} and not final_window_only:
            blockers.append('decision-observation-still-' + observation['status'])
            issues.append(issue('implementation-observation-contradiction', adr, 'Closure says implemented but the individual observation remains ' + observation['status']))
        if suite['status'] != 'current-pass':
            blockers.append('current-full-local-suite-required')
        if not matched and adr != 'ADR-125':
            blockers.append('no-executed-local-scenario-reference')
        if status not in {'implemented', 'final-native-only'} or blockers:
            functional_open.append(adr)
        related = [c['node_type_id'] for c in candidates if adr in split(c['required_source_adrs'])]
        scenario = ac[adr]
        scenario_rows.append({'decision_id': adr, 'scenario_id': scenario['test_id'], 'domain': decision['domain'],
                              'requirement_ids': decision['requirement_ids'], 'candidate_contract_ids': ';'.join(related),
                              'scenario': scenario['test_scenario'], 'expected_observation': scenario['expected_observation'],
                              'implementation_review': status, 'engineering_rationale': review['rationale'] if review else 'Awaiting individual engineering closure review; observation labels do not establish closure.',
                              'individual_observation': observation['status'], 'current_executed_case_ids': ';'.join(c['case_id'] for c in matched),
                              'source_digest': suite['source_digest'] if matched else '', 'local_reference_gaps': json.dumps(missing, sort_keys=True),
                              'final_native_status': 'not-executed', 'implementation_blockers': ';'.join(blockers)})
        for case in {c['case_id']: c for c in matched + reviewed_cases}.values():
            local_links.append({'owner_kind': 'decision', 'owner_id': adr, **case})
    for candidate in candidates:
        key = candidate['node_type_id']
        item = semantics.get(key)
        if not item:
            semantic_open.append(key)
            continue
        paths = set(item['test_sources'])
        for node in item['engine_nodes']:
            if node not in inventory:
                issues.append(issue('mapped-engine-node-missing', key, 'Mapped editor node is absent: ' + node))
        for service in item['service_entrypoints']:
            file, _, symbol = service.partition('#')
            path = checked_path(root, file)
            if symbol and symbol not in path.read_text():
                issues.append(issue('mapped-service-symbol-missing', key, 'Service symbol is absent: ' + service))
        for file in paths:
            checked_path(root, file)
        # Source-file membership is provenance only. These cases are never counted as
        # contract assertions unless an individual contract review selects them.
        related_cases = [c for c in cases if c['file'] in paths]
        review = contract_reviews.get(key)
        status, blockers, selected = validate_review(root, review, cases, contract=True) if review else ('unreviewed', ['individual-semantic-review-missing'], [])
        if item['interface_status'] == 'partial' and status in {'equivalent', 'implemented-with-documented-interface'}:
            blockers.append('candidate-interface-still-partial')
            if status == 'equivalent':
                issues.append(issue('contract-semantic-contradiction', key, 'Partial interface cannot be declared equivalent/implemented without updating the precise semantic assessment'))
        if status not in {'equivalent', 'implemented-with-documented-interface', 'mapping-reviewed-with-explicit-limits'} or blockers:
            semantic_open.append(key)
        contract_rows.append({'candidate_contract_id': key, 'normative_ports': candidate['port_signature'],
                              'source_decisions': candidate['required_source_adrs'], 'interface_disposition': item['interface_status'],
                              'engine_nodes': ';'.join(item['engine_nodes']),
                              'actual_default_ports': json.dumps({n: inventory[n] for n in item['engine_nodes'] if n in inventory}, sort_keys=True, separators=(',', ':')),
                              'service_entrypoints': ';'.join(item['service_entrypoints']), 'semantic_mapping': item['semantic_mapping'],
                              'deviation_or_limit': item['deviation_or_limit'], 'individual_contract_review': status,
                              'interface_resolution': review.get('interface_resolution', '') if review else '',
                              'candidate_signature_equivalence': 'reviewed-equivalent' if status == 'equivalent' else 'not-asserted',
                              'related_executed_cases_not_equivalence_proof': ';'.join(c['case_id'] for c in related_cases),
                              'reviewed_executed_case_ids': ';'.join(c['case_id'] for c in selected),
                              'contract_blockers': ';'.join(blockers), 'final_native_validation': 'not-established'})
        for case in selected:
            local_links.append({'owner_kind': 'candidate-contract', 'owner_id': key, **case})
    functional_ready = not functional_open and not any(i['severity'] == 'error' for i in issues)
    contract_ready = not semantic_open and not any(i['severity'] == 'error' for i in issues)
    dimensions = unique_index(plan['native_dimensions'], 'id')
    targets = unique_index(plan['compatibility_targets'], 'target_id')
    if not dimensions or not targets:
        raise ValueError('Qualification requires explicit native dimensions and compatibility targets')
    version = json.loads((root / 'package.json').read_text())['version']
    digest = source_digest(root)
    native_runs, native_ids, artifact_files = [], set(), []
    for filename in plan['native_evidence_files']:
        run = json.loads(checked_path(root, filename).read_text())
        native = native_run(root, run, version, digest, set(ds), set(dimensions))
        if native['run_id'] in native_ids:
            raise ValueError('Duplicate native run ID: ' + native['run_id'])
        native_ids.add(native['run_id'])
        native_runs.append(native)
        if not native['valid']:
            issues.append(issue('invalid-native-evidence', filename, ';'.join(native['errors'])))
        for group in ('scenarios', 'dimensions'):
            artifact_files += [checked_path(root, a['file']) for record in run.get(group, []) for a in record.get('artifacts', [])]
    matrix = compatibility_matrix(list(targets.values()), native_runs, set(ds), set(dimensions), functional_ready, contract_ready, digest)
    # A pass in one environment never erases failure in another. Scenario status
    # records exact run/environment references rather than a global certified flag.
    for row in scenario_rows:
        records = [(r, r['scenarios'][row['decision_id']]) for r in native_runs if r['valid'] and row['decision_id'] in r['scenarios']]
        if records:
            row['final_native_status'] = ';'.join(r['run_id'] + ':' + rec['outcome'] for r, rec in records)
    for link in local_links:
        forward = {'source_kind': link['owner_kind'], 'source_id': link['owner_id'], 'relation': 'executed-local-case',
                   'target_kind': 'executed-case', 'target_id': link['case_id'], 'provenance': link['evidence_file'] + ';sourceDigest=' + link['source_digest']}
        edges += [forward, dict(forward, source_kind=forward['target_kind'], source_id=forward['target_id'], relation='inverse:executed-local-case', target_kind=forward['source_kind'], target_id=forward['source_id'])]
    for native in native_runs:
        for kind, records in (('decision', native['scenarios']), ('native-dimension', native['dimensions'])):
            for key, record in records.items():
                forward = {'source_kind': kind, 'source_id': key, 'relation': 'native-case:' + record['outcome'],
                           'target_kind': 'native-run', 'target_id': native['run_id'], 'provenance': 'valid=' + str(native['valid']).lower() + ';sourceDigest=' + digest}
                edges += [forward, dict(forward, source_kind=forward['target_kind'], source_id=forward['target_id'], relation='inverse:' + forward['relation'], target_kind=forward['source_kind'], target_id=forward['source_id'])]
    if any(i['severity'] == 'error' for i in issues):
        functional_ready = False
        contract_ready = False
        for row in matrix:
            row['compatibility_claim'] = 'not-established'
            row['blockers'] += ';traceability-or-evidence-contradictions'
    input_files = [root / 'tools/implementation-closure.json', root / 'tools/decision-review.json',
                   root / 'tools/contract-evidence.json', root / 'tools/qualify.py']
    input_files += [p for p in (root / 'tools/qualification').rglob('*') if p.is_file() and '__pycache__' not in p.parts]
    input_files += [checked_path(root, f) for f in plan['native_evidence_files']] + artifact_files
    suite_file = root / suite['file']
    if suite_file.is_file():
        input_files.append(suite_file)
    status = {'schema_version': 1, 'release_version': version, 'source_digest': digest,
              'qualification_input_digest': digest_paths(root, input_files),
              'scope': {'decisions': len(ds), 'requirement_groups': len(requirements), 'candidate_contracts': len(candidates)},
              'local_suite': {k: v for k, v in suite.items() if k != 'cases'},
              'functional_implementation_gate': 'ready-for-final-native-qualification' if functional_ready else 'blocked',
              'functional_open_decisions': functional_open, 'semantic_contract_gate': 'reviewed' if contract_ready else 'blocked',
              'engineering_reviews_missing_or_open': [adr for adr in ds if adr not in reviews or reviews[adr]['status'] == 'open'],
              'candidate_mapping_review_is_signature_equivalence': False,
              'semantic_open_contracts': semantic_open,
              'native_runs': [{'run_id': r['run_id'], 'valid': r['valid'], 'errors': r['errors'], 'environment': r['environment']} for r in native_runs],
              'release_gate': 'qualified-exact-environments-only' if matrix and all(r['compatibility_claim'] == 'qualified-exact-environment' for r in matrix) else 'blocked',
              'manifest_compatibility': {'declaration': json.loads((root / 'module.json').read_text()).get('compatibility'),
                                         'basis': 'author-requested convention; not executed compatibility evidence'},
              'completion_percentage': None, 'completion_percentage_reason': 'Source inventories, case totals and observation labels do not establish full acceptance.',
              'contradiction_count': len(issues)}
    case_fields = ['owner_kind', 'owner_id', 'case_id', 'file', 'name', 'line', 'source_digest', 'test_file_sha256', 'evidence_file', 'outcome']
    return {
        'docs/QUALIFICATION_STATUS.json': json_text(status),
        'docs/FULL_SCOPE_QUALIFICATION.csv': csv_text(scenario_rows),
        'docs/SEMANTIC_CONTRACT_TRACE.csv': csv_text(contract_rows),
        'docs/BIDIRECTIONAL_TRACEABILITY.csv': csv_text(sorted(edges, key=lambda e: tuple(str(e[k]) for k in e))),
        'docs/QUALIFICATION_EXECUTED_CASES.csv': csv_text(sorted(local_links, key=lambda r: (r['owner_kind'], r['owner_id'], r['case_id'])), case_fields),
        'docs/TRACEABILITY_CONTRADICTIONS.json': json_text({'schema_version': 1, 'issues': issues}),
        'docs/RELEASE_COMPATIBILITY_MATRIX.csv': csv_text(matrix),
    }, status
