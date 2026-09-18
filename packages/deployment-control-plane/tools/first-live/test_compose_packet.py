"""Offline exact-record and fixture-final-freeze tests; never production preparation proof."""
import copy
import hashlib
import json
import unittest
import compose_packet as c


class Compose(unittest.TestCase):
    def test_all_real_static_sources_load_without_future_proofs(self):
        records, bindings = c.load_sources()
        self.assertGreater(len(bindings), 20)
        self.assertEqual(len(records['native']['initial_files']), 1174)
        self.assertEqual(len(records['native']['loader_files']), 22)
        self.assertNotIn('lifecycle_denial_digest', records['native'])
        self.assertNotIn('denial_receipt', records['configuration']['socket_ancestor'])

    def test_post_safe_stop_baseline_keeps_scheduler_and_observed_broker_as_distinct_coordinates(self):
        records, _ = c.load_sources()
        files = {row['path']: row['sha256'] for row in records['native']['initial_files']}
        self.assertEqual(files['package.json'],
            'd57644033f2ed7458272262dedad91c1cabc86aa51bc75bcc1f35184029299cd')
        self.assertEqual(files['packages/scheduler/src/scheduler.js'],
            'e3e8dce0fd8959336521147b639007b82e8ce98d932eca82ca2b98ac2506770d')
        self.assertEqual(files['packages/scheduler/src/watchdog/incident-lifecycle.js'],
            'cd0d7b0ca09a78d514f9c28dc240c16271536cd6ccaa2546805b2b569c18b1c1')
        self.assertEqual(files['packages/broker/src/capabilities/workflow.js'],
            'ecddc1b7cb07addf4890bdb39a0314da0570b992e13ba67bc6e0f3928026932e')
        self.assertEqual(files['packages/agent-router/src/reconciliation/authority-capacity.js'],
            '994b4c87365a51fa2b4458d9ff8d2b0837f61a6428ecb548a6fd513bc934c7c9')

    def test_real_static_join_with_explicit_fixture_freeze_is_complete_template(self):
        records, _ = c.load_sources()
        frozen = dict(source_sha='a'*40, review_sha256='b'*64, controller_sha256='c'*64,
            owner_acceptance_digest='d'*64, review_helper_sha256='e'*64, retired_binary_sha256='f'*64)
        packet = c.compose(records, frozen)
        self.assertEqual(set(packet), {'version','operation_id','host','source_sha','review_sha256',
            'controller_sha256','owner_acceptance_digest','previous','configuration','native_enrollment',
            'issuer_bindings','watchdog','broker','watchdog_source','broker_source','codex_sha256',
            'review_helper_sha256','policy_epoch','release','canary_plan','health_max_age_ms',
            'heartbeat_max_age_ms','lifecycle'})
        self.assertEqual(packet['policy_epoch'], 2)
        self.assertNotIn('/usr/bin/sudo', packet['lifecycle']['tool_sha256'])
        self.assertEqual(packet['canary_plan']['at_delay_seconds'], 1200)
        self.assertEqual(packet['canary_plan']['not_after_delay_seconds'], 1380)
        self.assertEqual(packet['configuration']['catalog']['keys'], records['configuration']['catalog']['keys'])
        for row in packet['issuer_bindings']:
            self.assertIsNone(row['public_key']); self.assertIsNone(row['custody_receipt'])
        self.assertEqual(set(packet['lifecycle']['legacy_sha256']), {
            '/usr/local/libexec/lw-pilot-executor',
            '/usr/local/libexec/agent-core/app/scripts/trusted-cp-deploy-install.sh',
            '/usr/local/libexec/agent-core/app/scripts/production-runtime-launchd.mjs'})
        self.assertNotIn('deployment_child', packet['broker']['prior_dependencies'][0])
        self.assertEqual(packet['release']['artifact_sha256'], packet['release']['manifest_digest'])

    def test_missing_or_placeholder_freeze_is_never_serialized_as_packet(self):
        records, _ = c.load_sources()
        base = dict(source_sha='a'*40, review_sha256='b'*64, controller_sha256='c'*64,
            owner_acceptance_digest='d'*64, review_helper_sha256='e'*64, retired_binary_sha256='f'*64)
        for field in base:
            for value in [None, '', 'UNRESOLVED', '0'*64]:
                frozen = dict(base); frozen[field] = value
                with self.subTest(field=field,value=value), self.assertRaises(ValueError): c.compose(records, frozen)
        with self.assertRaises(ValueError): c.compose(records, {})

    def test_source_tamper_or_unknown_fields_fail_before_assembly(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as td:
            p = Path(td)/'public.json'; p.write_text('{"x":1,"x":2}')
            with self.assertRaisesRegex(ValueError, 'DUPLICATE_JSON_KEY'): c.decode(p.read_bytes())
            with self.assertRaisesRegex(ValueError, 'SOURCE_DIGEST_DRIFT'):
                c.verified_bytes(p, 'a'*64)
        sources, _ = c.load_sources()
        frozen = dict(source_sha='a'*40, review_sha256='b'*64, controller_sha256='c'*64,
            owner_acceptance_digest='d'*64, review_helper_sha256='e'*64, retired_binary_sha256='f'*64)
        for which in ['profile','proof','child','role','manifest']:
            s = copy.deepcopy(sources)
            if which=='profile': s['configuration']['catalog']['profiles']['dsh-app']['revision']='bad'
            if which=='proof': s['native']['lifecycle_denial_digest']='a'*64
            if which=='child': s['enrollments']['broker_enrollment_before_authenticated_child_binding']['prior_dependencies'][0]['deployment_child']={}
            if which=='role': s['genesis-plan']['roles'][0]['scopes']=[]
            if which=='manifest': s['watchdog-observation']['stdout']='{"slots":[],"source":"'+c.SOURCE+'","artifact":"'+'a'*64+'"}'
            with self.subTest(which=which), self.assertRaises(ValueError): c.compose(s,frozen)

    def test_binding_manifest_is_not_ready_and_keeps_unobserved_absence(self):
        s, bindings = c.load_sources()
        result = c.input_manifest(s, bindings)
        self.assertFalse(result['ready'])
        self.assertEqual(result['state'], 'STATIC_INPUTS_JOINED_FINAL_FREEZE_REQUIRED')
        self.assertEqual(result['deferred_native_field'], 'lifecycle.tool_sha256./usr/bin/sudo')
        row = result['runtime_preconditions']['fourth_legacy_lock']
        self.assertEqual(row['ordinary_observation_errno'],13)
        self.assertEqual(row['required_native_state'],'ABSENT')
        self.assertNotIn('packet_sha256',result)

    def test_freeze_reads_actual_public_artifact_bytes_and_rejects_cross_source(self):
        import tempfile
        import subprocess
        from pathlib import Path
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); repo=root/'repo'; repo.mkdir()
            subprocess.run(['git','init','-q',str(repo)],check=True)
            (repo/'source').write_text('private test source')
            subprocess.run(['git','-C',str(repo),'add','source'],check=True)
            subprocess.run(['git','-C',str(repo),'-c','user.name=fixture','-c','user.email=fixture@example.invalid',
                            'commit','-qm','fixture'],check=True)
            source=subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD'],text=True).strip()
            tree=subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD^{tree}'],text=True).strip()
            def record(name,raw):
                p=root/name; p.write_bytes(raw); return {'path':str(p),'sha256':c.sha(raw)}
            executables={k:record(name,b'nonexecutable fixture bytes '+k.encode()) for k,name in {
                'controller':'agent-deployd','review_helper':'agent-deploy-issuer','retired_binary':'agent-deploy-legacy-retired'}.items()}
            build=record('build.json',c.canonical({'version':1,'source_sha':source,'source_tree':tree,'executables':executables}))
            freeze={'source_sha':source,'source_root':str(repo),'build_record':build,
                'review_record':record('review.md',b'Private fixture review, not real PASS'),
                'owner_acceptance':record('owner.json',b'{"fixture":true}')}
            raw=c.canonical(freeze); spec=record('freeze.json',raw)
            result, evidence=c.read_freeze(Path(spec['path']),spec['sha256'])
            self.assertEqual(result['source_sha'],source)
            self.assertEqual(result['controller_sha256'],executables['controller']['sha256'])
            self.assertGreaterEqual(len(evidence),7)
            (root/'agent-deployd').write_bytes(b'drift')
            with self.assertRaisesRegex(ValueError,'SOURCE_DIGEST_DRIFT'):c.read_freeze(Path(spec['path']),spec['sha256'])
            (root/'agent-deployd').write_bytes(b'nonexecutable fixture bytes controller')
            b=c.decode((root/'build.json').read_bytes());b['source_sha']='a'*40
            freeze['build_record']=record('build.json',c.canonical(b));raw=c.canonical(freeze)
            spec=record('freeze.json',raw)
            with self.assertRaisesRegex(ValueError,'BUILD_SOURCE'):c.read_freeze(Path(spec['path']),spec['sha256'])

    def test_template_output_preserves_exact_trees_and_refuses_overwrite(self):
        import tempfile
        from pathlib import Path
        s,bindings=c.load_sources()
        f=dict(source_sha='a'*40,review_sha256='b'*64,controller_sha256='c'*64,
               owner_acceptance_digest='d'*64,review_helper_sha256='e'*64,retired_binary_sha256='f'*64)
        with tempfile.TemporaryDirectory() as td:
            out=Path(td)/'private-fixture-not-production'
            manifest=c.input_manifest(s,bindings)
            c.publish(out,c.compose(s,f),manifest,bindings)
            self.assertFalse(manifest['ready'])
            self.assertEqual(c.sha((out/'node-inventory.json').read_bytes()),s['static-index']['files']['node-runtime-inventory.json']['sha256'])
            p=c.decode((out/'packet-template.json').read_bytes())
            self.assertNotIn('/usr/bin/sudo',p['lifecycle']['tool_sha256'])
            self.assertEqual(set(p['previous']),{'installation_receipt_sha256','service_sha256','issuer_policy_sha256','registry_sha256','trust_sha256'})
            with self.assertRaisesRegex(ValueError,'OUTPUT_EXISTS'):c.publish(out,p,manifest,bindings)

    def test_binding_only_emits_no_template_or_predicted_receipts(self):
        import tempfile
        from pathlib import Path
        s,bindings=c.load_sources()
        with tempfile.TemporaryDirectory() as td:
            out=Path(td)/'bindings'
            c.publish(out,None,c.input_manifest(s,bindings),bindings)
            self.assertEqual([x.name for x in out.iterdir()],['binding-manifest.json'])
            result=c.decode((out/'binding-manifest.json').read_bytes())
            self.assertEqual(result['final_freeze_required'],sorted(c.FREEZE_FIELDS))

    def test_issuer_identity_uses_existing_typed_key_id_preserves_genesis_uri_as_provenance(self):
        import re
        s,_=c.load_sources()
        f=dict(source_sha='a'*40,review_sha256='b'*64,controller_sha256='c'*64,
               owner_acceptance_digest='d'*64,review_helper_sha256='e'*64,retired_binary_sha256='f'*64)
        p=c.compose(s,f)
        for output, original in zip(p['issuer_bindings'],s['genesis-plan']['roles']):
            self.assertRegex(output['service_identity'],r'^[A-Za-z0-9_.:-]{1,128}$')
            self.assertEqual(output['service_identity'],original['key_id'])
            self.assertIn(original['service_identity'],output['source_binding'])
