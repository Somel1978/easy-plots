#!/usr/bin/env python3
"""Inspect source snapshots; deliberately refresh only after integration review."""
import argparse
import json
from datetime import datetime, timezone
from qualification import ROOT, checked_path, sha256

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--refresh', action='store_true')
parser.add_argument('--all-reviewed', action='store_true', help='Select every existing engineering record, without changing any status')
parser.add_argument('--id', action='append', default=[], help='Select one decision_id or contract_id; repeat as needed')
parser.add_argument('--reason', help='Concrete engineering integration review recorded with refreshed hashes')
args = parser.parse_args()
path = ROOT / 'tools/implementation-closure.json'
data = json.loads(path.read_text())
records = data['reviews'] + data['contract_reviews']
known = {r.get('decision_id', r.get('contract_id')) for r in records}
if set(args.id) - known:
    parser.error('Unknown engineering review ID')
if args.refresh and (not args.all_reviewed and not args.id or len((args.reason or '').strip()) < 30):
    parser.error('--refresh requires explicit selected IDs/--all-reviewed and a concrete --reason of at least30 characters')
changed = []
for record in records:
    key = record.get('decision_id', record.get('contract_id'))
    files = record['source_fingerprints']
    current = {file: sha256(checked_path(ROOT, file)) for file in files}
    stale = [file for file in current if current[file] != files[file]]
    selected = args.all_reviewed or key in args.id
    if stale:
        changed.append(key)
        print(key + ': ' + '; '.join(stale))
    if args.refresh and selected and stale:
        record['source_fingerprints'] = current
        record['refreshed_at'] = datetime.now(timezone.utc).isoformat()
        record['refresh_reason'] = args.reason
if args.refresh:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    print('Selected existing snapshots refreshed; statuses, rationale, test mappings and native evidence were not inferred or changed.')
else:
    print('Stale engineering records: ' + str(len(changed)))
raise SystemExit(0 if args.refresh or not changed else 1)
