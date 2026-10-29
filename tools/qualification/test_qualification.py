"""Focused hostile-input/regression cases for evidence and release qualification."""
import copy
import json
import tempfile
import unittest
from pathlib import Path

from qualification import (audit_traceability, compatibility_matrix, load_suite,
                           make_review, native_run, sha256, source_digest, validate_review)


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for folder in ('src', 'tests', 'lang', 'spec', 'docs'):
            (self.root / folder).mkdir()
        (self.root / 'src/runtime.mjs').write_text('export const result = 42;\n')
        (self.root / 'tests/behavior.test.mjs').write_text("test('a real behavior',()=>assert.equal(result,42));\n")
        (self.root / 'package.json').write_text('{"version":"1.13.0-dev"}')
        (self.root / 'module.json').write_text('{"compatibility":{"verified":"14.369"}}')
        self.events = [
            {'event': 'run:start', 'version': '1.13.0-dev', 'sourceDigest': source_digest(self.root),
             'testFiles': ['tests/behavior.test.mjs']},
            {'event': 'test:pass', 'file': 'tests/behavior.test.mjs', 'name': 'a real behavior', 'line': 1},
            {'event': 'test:summary', 'file': None, 'success': True, 'counts': {'passed': 1, 'failed': 0}},
        ]
        self.write()

    def write(self):
        (self.root / 'docs/local-test-evidence-v1.13.jsonl').write_text(''.join(json.dumps(e) + '\n' for e in self.events))

    def review(self):
        return make_review(self.root, 'ADR-001', 'implemented', 'Reviewed canonical evaluation and its independently asserted outcome.',
                           ['src/runtime.mjs'], [{'file': 'tests/behavior.test.mjs', 'name_contains': 'a real behavior'}])

    def test_current_actual_case_gets_source_and_file_fingerprint(self):
        suite = load_suite(self.root)
        self.assertEqual(suite['status'], 'current-pass')
        case = suite['cases'][0]
        self.assertEqual(case['source_digest'], source_digest(self.root))
        self.assertEqual(case['test_file_sha256'], sha256(self.root / 'tests/behavior.test.mjs'))
        self.assertEqual(validate_review(self.root, self.review(), suite['cases'])[0], 'implemented')

    def test_source_change_revokes_suite_and_individual_review(self):
        review = self.review()
        cases = load_suite(self.root)['cases']
        (self.root / 'src/runtime.mjs').write_text('export const result = 7;\n')
        self.assertEqual(load_suite(self.root)['status'], 'stale')
        self.assertEqual(validate_review(self.root, review, cases)[0], 'stale')

    def test_file_only_case_and_fake_summary_count_are_refused(self):
        self.events[1]['name'] = 'tests/behavior.test.mjs'
        self.write()
        self.assertEqual(load_suite(self.root)['status'], 'invalid')
        self.events[1]['name'] = 'a real behavior'
        self.events[-1]['counts']['passed'] = 1048
        self.write()
        self.assertEqual(load_suite(self.root)['status'], 'incomplete')

    def test_skipped_failed_missing_test_and_duplicate_case_are_refused(self):
        baseline = copy.deepcopy(self.events)
        for field in ('failed', 'cancelled', 'skipped', 'todo'):
            self.events = copy.deepcopy(baseline)
            self.events[-1]['counts'][field] = 1
            self.write()
            self.assertEqual(load_suite(self.root)['status'], 'incomplete')
        self.events = copy.deepcopy(baseline)
        self.events[0]['testFiles'].append('tests/nonexistent.test.mjs')
        self.write()
        self.assertEqual(load_suite(self.root)['status'], 'incomplete')
        self.events = copy.deepcopy(baseline)
        self.events.insert(2, copy.deepcopy(self.events[1]))
        self.events[-1]['counts']['passed'] = 2
        self.write()
        self.assertEqual(load_suite(self.root)['status'], 'invalid')

    def test_observation_status_cannot_supply_an_engineering_review(self):
        review = self.review()
        review['source_fingerprints'] = {}
        self.assertEqual(validate_review(self.root, review, load_suite(self.root)['cases'])[0], 'unsubstantiated')
        review = self.review()
        review['tests'][0]['name_contains'] = 'ADR-001 invented coverage marker'
        self.assertEqual(validate_review(self.root, review, load_suite(self.root)['cases'])[0], 'unsubstantiated')

    def test_only_native_window_decision_has_final_native_only_exception(self):
        review = self.review()
        review['status'] = 'final-native-only'
        with self.assertRaisesRegex(ValueError, 'Only ADR-021'):
            validate_review(self.root, review, load_suite(self.root)['cases'])
        review['decision_id'] = 'ADR-021'
        self.assertEqual(validate_review(self.root, review, load_suite(self.root)['cases'])[0], 'final-native-only')

    def test_unreviewed_interface_and_escaping_source_cannot_be_sealed(self):
        review = self.review()
        review['status'] = 'implemented-with-documented-interface'
        self.assertIn('documented-interface-resolution-required', validate_review(self.root, review, load_suite(self.root)['cases'], contract=True)[1])
        with self.assertRaisesRegex(ValueError, 'escapes repository'):
            make_review(self.root, 'ADR-001', 'implemented', 'A sufficiently concrete engineering rationale.', ['../secret'], [])


class TraceTests(unittest.TestCase):
    def setUp(self):
        self.decisions = [{'decision_id': 'ADR-001', 'requirement_ids': 'REQ-GRF-001', 'decision_test_id': 'TEST-ADR-001', 'domain': 'graph'}]
        self.requirements = [{'requirement_id': 'REQ-GRF-001', 'source_decisions': 'ADR-001', 'decision_level_test_ids': 'TEST-ADR-001', 'proposed_contracts': 'NarrativeGraphV1'}]
        self.acceptance = [{'decision_id': 'ADR-001', 'test_id': 'TEST-ADR-001', 'domain': 'graph'}]
        self.candidates = [{'node_type_id': 'easy-plots.core.event-received', 'required_source_adrs': 'ADR-001'}]
        self.semantics = {'easy-plots.core.event-received': {'interface_status': 'direct', 'semantic_mapping': 'Canonical envelope enters the existing protected durable router.',
                          'deviation_or_limit': 'Native transport still requires final actual-client qualification.', 'engine_nodes': ['core.trigger.event'],
                          'service_entrypoints': ['src/runtime/durable-router.mjs#DurableReactiveRouter'], 'test_sources': ['tests/behavior.test.mjs']}}

    def audit(self):
        return audit_traceability(self.decisions, self.requirements, self.acceptance, self.candidates, self.semantics)

    def test_all_edges_are_queryable_from_both_endpoints(self):
        issues, edges = self.audit()
        self.assertEqual(issues, [])
        forward = [e for e in edges if not e['relation'].startswith('inverse:')]
        for edge in forward:
            self.assertTrue(any(e['source_id'] == edge['target_id'] and e['target_id'] == edge['source_id'] and e['relation'] == 'inverse:' + edge['relation'] for e in edges))
        self.assertTrue(any(e['target_kind'] == 'named-contract' and e['target_id'] == 'NarrativeGraphV1' for e in forward))
        self.assertTrue(any(e['source_kind'] == 'candidate-contract' and e['source_id'] == 'easy-plots.core.event-received' for e in forward))

    def test_requirement_direction_and_acceptance_contradictions_are_logged(self):
        self.requirements[0]['source_decisions'] = 'ADR-002'
        self.acceptance[0]['test_id'] = 'TEST-ADR-999'
        self.acceptance[0]['domain'] = 'security'
        codes = {i['code'] for i in self.audit()[0]}
        self.assertTrue({'requirement-reverse-link-missing', 'decision-reverse-link-missing', 'acceptance-id-contradiction', 'acceptance-domain-contradiction'} <= codes)

    def test_missing_semantic_mapping_and_unknown_decision_are_not_silently_counted(self):
        self.semantics.clear()
        self.candidates[0]['required_source_adrs'] = 'ADR-999'
        codes = {i['code'] for i in self.audit()[0]}
        self.assertEqual(codes, {'semantic-contract-set-mismatch', 'contract-unknown-decision'})

    def test_duplicate_normative_id_refuses_ambiguous_trace(self):
        self.decisions.append(copy.deepcopy(self.decisions[0]))
        with self.assertRaisesRegex(ValueError, 'Duplicate decision_id'):
            self.audit()

    def test_candidate_alias_without_semantic_limits_is_a_contradiction(self):
        self.semantics['easy-plots.core.event-received']['deviation_or_limit'] = ''
        self.assertIn('semantic-assessment-missing', {i['code'] for i in self.audit()[0]})


class NativeMatrixTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'observations.txt').write_text('Actual native client observation and hostile packet capture.\n')
        self.environment = {'core_version': '14', 'core_build': '369', 'system_id': 'test-system', 'system_version': '1.0.0', 'browser': 'Chromium 130', 'platform': 'Linux'}
        artifact = {'file': 'observations.txt', 'sha256': sha256(self.root / 'observations.txt')}
        self.record = {'id': 'ADR-001', 'outcome': 'pass', 'observed': 'The actual native fixture produced exactly one separately approved change and no unauthorized packets.', 'artifacts': [artifact]}
        self.run = {'run_id': 'native-run-fixture', 'environment_kind': 'native-foundry', 'environment': self.environment,
                    'release_version': '1.13.0-dev', 'source_digest': 'a' * 64, 'executed_at': '2026-01-01T12:00:00Z', 'operator': 'fixture-engineer',
                    'scenarios': [self.record], 'dimensions': [dict(self.record, id='observer-confidentiality')]}
        self.target = dict(self.environment, target_id='target-exact')

    def native(self):
        return native_run(self.root, self.run, '1.13.0-dev', 'a' * 64, {'ADR-001'}, {'observer-confidentiality'})

    def matrix(self, **kwargs):
        options = dict(targets=[self.target], runs=[self.native()], decision_ids={'ADR-001'}, dimension_ids={'observer-confidentiality'}, functional_ready=True, contract_ready=True, digest='a' * 64)
        options.update(kwargs)
        return compatibility_matrix(**options)[0]

    def test_exact_executed_environment_can_qualify_only_its_own_identity(self):
        self.assertEqual(self.matrix()['compatibility_claim'], 'qualified-exact-environment')
        for field in self.environment:
            target = dict(self.target)
            target[field] += '-different'
            self.assertEqual(self.matrix(targets=[target])['compatibility_claim'], 'not-established', field)

    def test_manifest_verified_and_unknown_system_never_establish_native_compatibility(self):
        target = dict(self.target, system_id=None, system_version=None, manifest_verified='14.369')
        result = self.matrix(targets=[target], runs=[])
        self.assertEqual(result['compatibility_claim'], 'not-established')
        self.assertEqual(result['manifest_verified_is_execution_evidence'], 'false')

    def test_full_local_count_cannot_replace_missing_native_scenario_or_dimension(self):
        self.assertEqual(self.matrix(decision_ids={'ADR-001', 'ADR-002'})['compatibility_claim'], 'not-established')
        self.assertEqual(self.matrix(dimension_ids={'observer-confidentiality', 'co-gm-handover'})['compatibility_claim'], 'not-established')
        self.assertEqual(self.matrix(runs=[])['native_decision_cases_passed'], 0)

    def test_native_runs_do_not_bypass_functional_or_semantic_closure(self):
        self.assertEqual(self.matrix(functional_ready=False)['compatibility_claim'], 'not-established')
        self.assertEqual(self.matrix(contract_ready=False)['compatibility_claim'], 'not-established')

    def test_artifact_change_and_stale_source_invalidate_native_run(self):
        (self.root / 'observations.txt').write_text('changed')
        self.assertIn('native-artifact-fingerprint-mismatch:ADR-001', self.native()['errors'])
        self.run['source_digest'] = 'b' * 64
        self.assertIn('native-source-or-version-stale', self.native()['errors'])
        self.assertEqual(self.matrix()['compatibility_claim'], 'not-established')

    def test_future_timestamp_mock_environment_and_duplicate_native_case_are_refused(self):
        self.run['executed_at'] = '2099-01-01T00:00:00Z'
        self.run['environment_kind'] = 'node-mock'
        self.run['scenarios'].append(copy.deepcopy(self.record))
        errors = self.native()['errors']
        self.assertIn('native-execution-time-invalid', errors)
        self.assertIn('native-environment-must-have-exact-build-system-browser-platform', errors)
        self.assertIn('native-decision-unknown-or-duplicate:ADR-001', errors)

    def test_fail_or_blocked_result_is_not_erased_by_another_passing_run(self):
        passing = self.native()
        self.run['scenarios'][0]['outcome'] = 'fail'
        self.run['run_id'] = 'failing-run'
        self.assertEqual(self.matrix(runs=[passing, self.native()])['compatibility_claim'], 'not-established')

    def test_each_passing_observation_needs_substantive_observation_and_artifact(self):
        self.run['scenarios'][0]['observed'] = 'PASS'
        self.run['scenarios'][0]['artifacts'] = []
        errors = self.native()['errors']
        self.assertIn('native-observation-invalid:ADR-001', errors)
        self.assertIn('native-artifacts-required:ADR-001', errors)


if __name__ == '__main__':
    unittest.main()
