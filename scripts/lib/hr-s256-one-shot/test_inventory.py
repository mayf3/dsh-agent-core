"""Disposable fixed metadata adapter negatives; never installed/live facts."""
import importlib.util
from pathlib import Path
import unittest
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import types
import time
from contextlib import contextmanager
from unittest.mock import patch

HERE = Path(__file__).resolve().parent


class InventoryTest(unittest.TestCase):
    def load(self):
        spec = importlib.util.spec_from_file_location("inventory", HERE / "installed_inventory.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    @contextmanager
    def fixture(self):
        module = self.load()
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp).resolve(); root = base / "root"; app = base / "app"
            root.mkdir(); app.mkdir()
            def put(path, raw):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(raw); path.chmod(0o600)
            def load(name, path):
                spec = importlib.util.spec_from_file_location(name, path)
                result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result
            repo = HERE.parents[2]
            profile = load("profile_inventory", repo / "deployment-artifacts/hr-s256-trusted-cut-v1/profile.py")
            real = load("real_inventory", HERE / "fixed_os.py")
            real.require_activation = lambda: {"fixture": "not-host-authority"}
            source_paths = [module.GATED, module.HELPER,
                "packages/agent-router/src/binding-store.js", "packages/workspace-bootstrap/src/paths.js",
                "packages/production-runtime/src/agent-session/turn-inspection.js",
                "packages/production-runtime/src/agent-session/projection-redaction.js",
                "packages/agent-router/src/process/provider-errors.js"]
            pins = {}
            for name in source_paths:
                raw = (repo / name).read_bytes(); put(app / name, raw); pins[name] = hashlib.sha256(raw).hexdigest()
            retired = b'#!/usr/bin/env node\nthrow new Error("HR_UNGATED_ENTRY_RETIRED");\n'
            put(app / module.RETIRED, retired)
            profile.HR_GATED_ENTRY_SHA256 = pins[module.GATED]; profile.HR_CHILD_PROOF_SHA256 = pins[module.HELPER]
            manifest = {"version": 1, "operationId": profile.OPERATION_ID,
                "entries": [{"path": module.GATED, "sha256": pins[module.GATED], "helperSha256": pins[module.HELPER]}],
                "retiredEntry": {"path": module.RETIRED, "sha256": hashlib.sha256(retired).hexdigest()},
                "routes": [{"id": "gui/505/ai.agent-core.runtime", "target": "/usr/local/libexec/agent-core/app/" + module.GATED},
                           {"id": "system/ai.agent-core.runtime", "target": "/usr/local/libexec/agent-core/app/" + module.GATED}]}
            module.ROOT=root;module.APP=app;module.GUI=base/'gui.plist';module.SYSTEM=base/'system.plist';module.MANIFEST=base/'entry-manifest.json'
            put(module.MANIFEST, json.dumps(manifest).encode())
            route = (f'<plist><dict><key>Label</key><string>ai.agent-core.runtime</string><key>ProgramArguments</key><array><string>/usr/local/libexec/agent-core/node-runtime/bin/node</string><string>{app / module.GATED}</string><string>--root</string><string>{root}</string></array></dict></plist>').encode()
            put(module.GUI, route);put(module.SYSTEM, route)
            put(root/'bindings/bindings.json', b'{"version":1,"bindings":{}}')
            put(root/'primary-workspaces.json', b'{}')
            workspace = root/'workspaces/agt_hr-agent';workspace.mkdir(parents=True)
            script = "import {sessionProjectKey} from " + json.dumps((repo / 'packages/production-runtime/src/agent-session/turn-inspection.js').as_uri()) + ";process.stdout.write(sessionProjectKey(process.argv[1]));"
            project = subprocess.check_output([shutil.which('node'), '--input-type=module', '-e', script, str(workspace)], text=True)
            header = root/'homes/agt_hr-agent/sessions'/project/'main/session.jsonl'
            put(header, (json.dumps({"type":"session","id":"main","cwd":str(workspace)}) + '\nPRIVATE-BODY-MUST-NOT-BE-READ').encode())
            subject = {"reconciliationHandle":profile.HANDLE,"turnExecutionId":profile.HANDLE,"runtimeEpoch":"old","agentId":"agt_hr-agent","processGeneration":1,"sessionId":"main","createdAtWallMs":10,"updatedAt":20,"subjectPreimageSha256":"a"*64}
            module.HR_REAL_OS=real;module.HR_PROFILE=profile
            module.HR_PROJECTION=types.SimpleNamespace(fixed_subject_projection=lambda:subject)
            module.HR_ONE_SHOT=types.SimpleNamespace(normalized_subject=lambda value: value)
            module.HR_GATED_ENTRY_SHA256=pins[module.GATED];module.HR_CHILD_PROOF_SHA256=pins[module.HELPER]
            module.HR_INVENTORY_VALIDATOR_PINS={name:digest for name,digest in pins.items() if name not in (module.GATED,module.HELPER)}
            module.HR_INVENTORY_HELPER_SOURCE=(HERE/'project-inventory.mjs').read_text().replace("'/Users/authsvc/.agent-core'", repr(str(root)))
            actual_file=module.Observation.file
            def disposable_file(self, path, uid, header=False):
                return actual_file(self,path,os.getuid(),header)
            actual_popen=module.subprocess.Popen
            def disposable_node(args, **options):
                args[0]=shutil.which('node')
                for key in ('user','group','extra_groups'): options.pop(key,None)
                return actual_popen(args,**options)
            with patch.object(module.Observation,'file',disposable_file),patch.object(module.subprocess,'Popen',side_effect=disposable_node):
                yield module,root,app,header,subject

    def test_actual_fixed_source_and_holder_derivation_is_secret_safe_and_not_complete(self):
        with self.fixture() as (module,root,app,header,subject):
            result=module.fixed_installed_inventory()
            self.assertIn(str(root/'workspaces'),result['holderPaths'])
            self.assertIn(str(root/'workspaces/agt_hr-agent'),result['holderPaths'])
            self.assertEqual(result['sessionHeaderCount'],1)
            self.assertEqual(result['subjectPreimageSha256'],subject['subjectPreimageSha256'])
            self.assertNotIn('PRIVATE-BODY',json.dumps(result))
            self.assertNotIn('sourceClosureComplete',result)
            self.assertEqual(result['unresolvedSources'],['LE1_INSTALLED_ENTRY_AND_RESUMPTION_CLOSURE'])

    def test_actual_primary_binding_and_historical_header_candidates_are_all_included(self):
        with self.fixture() as (module,root,app,header,subject):
            imported=root.parent/'imported-workspace';imported.mkdir()
            (root/'workspaces/team-A').mkdir()
            (root/'primary-workspaces.json').write_text(json.dumps({'agt_hr-agent':str(imported)}))
            row={'channelConversationId':'cc_one','activeAgentId':'agt_hr-agent',
                 'activeSessionId':'main','workspace':'team-A','updatedAt':'2026-09-26T00:00:00Z'}
            (root/'bindings/bindings.json').write_text(json.dumps({'version':1,'bindings':{'cc_one':row}}))
            result=module.fixed_installed_inventory()
            for path in (imported,root/'workspaces/team-A',root/'workspaces/agt_hr-agent'):
                self.assertIn(str(path),result['holderPaths'])
            self.assertEqual(result['sessionHeaderCount'],1)
            self.assertNotIn('sourceClosureComplete',result)

    def test_optional_primary_absence_uses_actual_default_and_is_race_bound(self):
        with self.fixture() as (module,root,*rest):
            (root/'primary-workspaces.json').unlink()
            result=module.fixed_installed_inventory()
            self.assertIsNone(result['inputDigests']['primaryWorkspaces'])
            self.assertIn(str(root/'workspaces/agt_hr-agent'),result['holderPaths'])
        with self.fixture() as (module,root,*rest):
            (root/'primary-workspaces.json').unlink()
            actual=module.node_metadata;calls=0
            def appear(*args,**kwargs):
                nonlocal calls
                result=actual(*args,**kwargs);calls+=1
                if calls==2:(root/'primary-workspaces.json').write_text('{}')
                return result
            with patch.object(module,'node_metadata',side_effect=appear):
                with self.assertRaisesRegex(module.Rejected,'INVENTORY_CHANGED'):
                    module.fixed_installed_inventory()

    def test_missing_changed_escaped_unknown_inventory_rejects(self):
        for mutation in ('missing','changed','escaped','unknown-binding','unknown-session','private-header','private-binding','partial-manifest'):
            with self.subTest(mutation=mutation),self.fixture() as (module,root,app,header,subject):
                if mutation=='missing': module.SYSTEM.unlink()
                elif mutation=='changed': (app/module.GATED).write_text('changed')
                elif mutation=='escaped':
                    (app/module.GATED).unlink();(app/module.GATED).symlink_to(header)
                elif mutation=='unknown-binding': (root/'bindings/bindings.json').write_text('{"version":99,"bindings":{}}')
                elif mutation=='unknown-session': header.write_text('{"type":"session","id":"different","cwd":"/outside"}\n')
                elif mutation=='private-header':
                    value=json.loads(header.read_text().splitlines()[0]);value['privatePayload']='sensitive-fixture';header.write_text(json.dumps(value)+'\n')
                elif mutation=='private-binding': (root/'bindings/bindings.json').write_text('{"version":1,"bindings":{},"privatePayload":"sensitive-fixture"}')
                else:
                    value=json.loads(module.MANIFEST.read_text());value['routes'].pop();module.MANIFEST.write_text(json.dumps(value))
                with self.assertRaises(Exception): module.fixed_installed_inventory()

    def test_raced_source_and_header_bindings_reject(self):
        for target in ('source','header','directory'):
            with self.subTest(target=target),self.fixture() as (module,root,app,header,subject):
                actual=module.node_metadata;calls=0
                def race(*args,**kwargs):
                    nonlocal calls
                    result=actual(*args,**kwargs);calls+=1
                    if calls==2:
                        if target=='source': (app/module.GATED).write_text('raced')
                        elif target=='header': header.write_text('{"type":"session","id":"main","cwd":"/changed"}\n')
                        else:
                            directory=root/'workspaces/agt_hr-agent';directory.rename(root/'workspaces/retired');directory.mkdir()
                    return result
                with patch.object(module,'node_metadata',side_effect=race):
                    with self.assertRaisesRegex(module.Rejected,'INVENTORY_CHANGED'):
                        module.fixed_installed_inventory()

    def test_directory_enumeration_bound_is_enforced_while_iterating(self):
        with self.fixture() as (module,root,*rest):
            sessions=root/'homes/agt_hr-agent/sessions'
            for index in range(65):(sessions/('extra-'+str(index))).mkdir()
            with self.assertRaisesRegex(module.Rejected,'INVENTORY_SESSION_BOUND'):
                module.fixed_installed_inventory()

    def test_assembled_inventory_guard_has_no_protected_io(self):
        builder_path=HERE.parents[2]/'deployment-artifacts/hr-s256-trusted-cut-v1/build_candidate.py'
        spec=importlib.util.spec_from_file_location('inventory_builder',builder_path)
        builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
        source=builder.build_bytes().decode()
        start=source.index('def _make_HR_REAL_OS():');end=source.index('def hr_s256_action(request):',start)
        context={'types':types};exec(source[start:end],context)
        inventory=context['HR_INVENTORY']
        with patch.object(inventory,'open_directory',side_effect=AssertionError('protected IO')):
            with self.assertRaisesRegex(Exception,'PROFILE_NOT_BOOTSTRAPPED'):
                inventory.fixed_installed_inventory()

    def test_whole_metadata_deadline_and_streaming_output_cap_reject(self):
        with self.fixture() as (module,*rest):
            actual = module.node_metadata
            def exceed(*args, **kwargs):
                result=actual(*args, **kwargs)
                module.check=lambda deadline: (_ for _ in ()).throw(module.Rejected('INVENTORY_DEADLINE'))
                return result
            with patch.object(module,'node_metadata',side_effect=exceed):
                with self.assertRaisesRegex(module.Rejected,'INVENTORY_DEADLINE'):
                    module.fixed_installed_inventory()
        with self.fixture() as (module,*rest):
            module.HR_INVENTORY_HELPER_SOURCE="process.stdout.write('x'.repeat(65537));"
            with self.assertRaisesRegex(module.Rejected,'INVENTORY_OUTPUT_BOUND'):
                module.fixed_installed_inventory()

    def test_inventory_guard_rejects_before_any_protected_read(self):
        module = self.load()
        with patch.object(module, "open_directory", side_effect=AssertionError("protected IO")):
            with self.assertRaisesRegex(Exception, "PROFILE_NOT_BOOTSTRAPPED"):
                module.fixed_installed_inventory()


if __name__ == "__main__":
    unittest.main()
