#!/usr/bin/env python3
"""Link individual decision observations to actual current local test results.

No semantic status is inferred from names, counts or ADR markers. The reviewed
observations are manually authored; this tool only checks their references.
"""
import argparse
import collections
import csv
import hashlib
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUSES = {'evidence-present', 'partial', 'confirmed-gap', 'review-pending'}

def source_digest():
    paths = [p for folder in ['src', 'tests', 'lang', 'spec'] for p in (ROOT / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
    paths += [ROOT / 'package.json', ROOT / 'module.json']
    hasher = hashlib.sha256()
    for path in sorted(paths, key=lambda p: p.relative_to(ROOT).as_posix()):
        hasher.update(path.relative_to(ROOT).as_posix().encode())
        hasher.update(b'\0')
        hasher.update(path.read_bytes())
        hasher.update(b'\0')
    return hasher.hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    original = {r['decision_id']: r for r in csv.DictReader((ROOT / 'spec/Full_125_Decision_Acceptance_Matrix.csv').open())}
    review = json.loads((ROOT / 'tools/decision-review.json').read_text())
    entries = review['decisions']
    if len(entries) != len(original) or {r['decision_id'] for r in entries} != set(original):
        raise SystemExit('Review must contain exactly one entry for each accepted decision')
    version = json.loads((ROOT / 'package.json').read_text())['version']
    suffix = version.removesuffix('.0-dev')
    path = ROOT / f'docs/local-test-evidence-v{suffix}.jsonl'
    events = [json.loads(line) for line in path.read_text().splitlines() if line]
    start = events[0]
    summary = next((r for r in reversed(events) if r['event'] == 'test:summary' and r.get('file') is None), None)
    if start.get('event') != 'run:start' or start.get('version') != version or start.get('sourceDigest') != source_digest():
        raise SystemExit('Test evidence is stale; run npm run check')
    if not summary or not summary['success'] or summary['counts']['failed'] or any(r['event'] == 'test:fail' for r in events):
        raise SystemExit('The full suite has not passed; do not present its cases as passing evidence')
    cases = [r for r in events if r['event'] == 'test:pass']
    actual_files = {r['file'] for r in cases}
    if set(start['testFiles']) != {str(p.relative_to(ROOT)) for p in (ROOT / 'tests').glob('*.test.mjs')} or not set(start['testFiles']).issubset(actual_files):
        raise SystemExit('Some current test files have no completed case-level evidence')
    if any(r['name'].startswith('tests/') and r['name'].endswith('.test.mjs') for r in cases):
        raise SystemExit('File-only results cannot substantiate scenario evidence')
    rows = []
    for row in entries:
        if row['status'] not in STATUSES or len(row['observation']) < 30:
            raise SystemExit('Invalid individual observation: ' + row['decision_id'])
        for source in row['source_files']:
            resolved = (ROOT / source).resolve()
            if not resolved.is_relative_to(ROOT) or not resolved.is_file():
                raise SystemExit('Invalid source reference: ' + source)
        matched = []
        for reference in row['tests']:
            matches = [c for c in cases if c['file'] == reference['file'] and reference['name_contains'].lower() in c['name'].lower()]
            if not matches:
                raise SystemExit(f"No passing executed case for {row['decision_id']}: {reference}")
            matched += [f"{c['file']}:{c['line']} — {c['name']}" for c in matches]
        if row['status'] == 'evidence-present' and not matched and row['decision_id'] not in {'ADR-125'}:
            raise SystemExit('Evidence-present requires actual passing cases: ' + row['decision_id'])
        spec = original[row['decision_id']]
        rows.append({'decision_id': row['decision_id'], 'scenario': spec['test_scenario'],
            'expected_behavior': spec['expected_observation'], 'review_status': row['status'],
            'observation': row['observation'], 'source_files': ';'.join(row['source_files']),
            'executed_case_references': ';'.join(matched), 'foundry_validation': row['foundry_validation'],
            'full_acceptance_claim': 'not-established-by-this-review'})
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    destination = ROOT / 'docs/DECISION_SCENARIO_REVIEW.csv'
    content = stream.getvalue()
    if args.check:
        if not destination.is_file() or destination.read_text() != content:
            raise SystemExit('Scenario report is stale; run npm run review:report')
    else:
        destination.write_text(content)
    print(f"PASS: {len(rows)} individual observations; references checked against {summary['counts']['passed']} actual passing cases")
    print(dict(collections.Counter(r['review_status'] for r in rows)))
    print('Evidence-present is not a completed-decision count. No final Foundry scenario has been run.')

if __name__ == '__main__':
    main()
