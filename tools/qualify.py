#!/usr/bin/env python3
"""Generate truthful qualification reports, inspect trace links, or enforce a gate."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / 'qualification'))
from qualification import ROOT, build_reports, json_text, make_review


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check generated reports without changing them; blocked release is reported separately')
    parser.add_argument('--gate', choices=['functional', 'release'], help='Exit nonzero until the requested evidence gate passes')
    parser.add_argument('--trace', help='Print all incoming and outgoing links for a decision, requirement, contract, node or executed case ID')
    parser.add_argument('--snapshot-review', metavar='ID', help='Print a concrete engineering review JSON record; does not write or infer approval')
    parser.add_argument('--status', default='implemented')
    parser.add_argument('--rationale')
    parser.add_argument('--source', action='append', default=[])
    parser.add_argument('--test', action='append', default=[], metavar='FILE::CASE_SUBSTRING')
    parser.add_argument('--contract', action='store_true')
    parser.add_argument('--interface-resolution')
    args = parser.parse_args()
    if args.snapshot_review:
        references = []
        for reference in args.test:
            file, separator, name = reference.partition('::')
            if not separator or not name:
                parser.error('--test requires FILE::CASE_SUBSTRING')
            references.append({'file': file, 'name_contains': name})
        if not args.rationale:
            parser.error('--snapshot-review requires a concrete --rationale')
        print(json_text(make_review(ROOT, args.snapshot_review, args.status, args.rationale, args.source, references,
                                    contract=args.contract, interface_resolution=args.interface_resolution)), end='')
        return 0
    outputs, status = build_reports(ROOT)
    if args.trace:
        import csv
        import io
        links = csv.DictReader(io.StringIO(outputs['docs/BIDIRECTIONAL_TRACEABILITY.csv']))
        print(json_text([row for row in links if args.trace in {row['source_id'], row['target_id']}]), end='')
        return 0
    if not args.gate:
        for name, content in outputs.items():
            path = ROOT / name
            if args.check:
                if not path.is_file() or path.read_text() != content:
                    raise ValueError('Stale qualification report: ' + name + '; run python tools/qualify.py')
            else:
                path.write_text(content)
    print('Full scope: 125 decisions / 28 requirement groups / 97 candidate contracts')
    print('Current local execution: ' + status['local_suite']['status'])
    print('Functional entry: ' + status['functional_implementation_gate'])
    print('Semantic contract review: ' + status['semantic_contract_gate'])
    print('Release compatibility: ' + status['release_gate'])
    print('Engineering reviews missing/open: ' + ', '.join(status['engineering_reviews_missing_or_open']))
    print('Decisions with current gate blockers: ' + str(len(status['functional_open_decisions'])))
    print('No completed-decision percentage is inferred. Manifest verified is an author convention, not native evidence.')
    if args.gate:
        gate_passed = status['functional_implementation_gate'] == 'ready-for-final-native-qualification' if args.gate == 'functional' else status['release_gate'] == 'qualified-exact-environments-only'
        return 0 if gate_passed else 1
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, KeyError, OSError, json.JSONDecodeError) as error:
        print('Qualification input/report error: ' + str(error), file=sys.stderr)
        raise SystemExit(2)
