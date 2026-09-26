"""Promoter to actual immutable readers; guarded disposable metadata only."""
import ast
import hashlib
import json
import os
import unittest
from contextlib import ExitStack
from unittest.mock import patch
import test_maintenance as mt

class PromotedInventoryUIDTest(unittest.TestCase):
    fixture = mt.MaintenanceTest.fixture
    def join(self, immutable=0, mutable=505):
        with self.fixture() as (ds, io, p, app, routes, calls), ExitStack() as stack:
            cells = dict(zip(ds.HR_MAINTENANCE._replace.__code__.co_freevars, ds.HR_MAINTENANCE._replace.__closure__))
            oldos, olduid = cells['os'].cell_contents, cells['CUSTODY_UID'].cell_contents
            requests = []
            def owner(meta, uid):
                class Meta:
                    def __getattr__(self, key): return getattr(meta, key)
                    st_uid = uid
                    def __eq__(self, other): return self.st_uid == other.st_uid and tuple(meta) == tuple(other.raw)
                    raw = meta
                return Meta()
            class Boundary:
                def __getattr__(self, key): return getattr(oldos, key)
                def fstat(self, fd): return owner(oldos.fstat(fd), 0)
                def stat(self, *a, **kw): return owner(oldos.stat(*a, **kw), 0)
                def fchown(self, fd, uid, gid): requests.append((uid, gid))
            cells['os'].cell_contents, cells['CUSTODY_UID'].cell_contents = Boundary(), 0
            try: self.assertEqual(ds.HR_MAINTENANCE.promote_waiting(io)['state'], 'INSTALLED_WAITING')
            finally: cells['os'].cell_contents, cells['CUSTODY_UID'].cell_contents = oldos, olduid
            self.assertTrue(requests); self.assertTrue(all(v == (0,0) for v in requests))
            native = app / 'packages/production-runtime/src/native-arm64'; native.mkdir(parents=True)
            leaves = {'hr-s256-r2-gated-runtime.mjs': b'gated', 'hr-s256-r2-child-proof.py': b'proof', 'hr-s256-r2-startup-context.mjs': b'context'}
            for name, raw in leaves.items(): (native/name).write_bytes(raw)
            runtime = app.parent/'runtime'; (runtime/'bindings').mkdir(parents=True)
            (runtime/'bindings/bindings.json').write_bytes(b'{"bindings":{}}')
            (runtime/'primary-workspaces.json').write_bytes(b'{}')
            sessions = runtime/'homes/agt_hr-agent/sessions'; sessions.mkdir(parents=True)
            header = sessions/'project/session/session.jsonl'; header.parent.mkdir(parents=True)
            header.write_bytes(json.dumps({'type':'session','id':'fixture','cwd':str(runtime)}).encode()+b'\n')
            scope = json.loads(ds.HR_BOOTSTRAP.TARGETS['hr-s256-source-scope.json'].read_bytes())
            manifest = scope['entryManifest']; manifest['retiredEntry']['sha256'] = hashlib.sha256((app/'scripts/production-runtime.mjs').read_bytes()).hexdigest()
            mp = app.parent/'entry-manifest.json'; mp.write_bytes(ds.canonical(manifest))
            paths = [*routes.values(), *(native/name for name in leaves), app/'scripts/production-runtime.mjs', app/'packages/keep.js']
            owners = {(v.stat().st_dev,v.stat().st_ino): immutable for v in paths}
            for v in (runtime/'bindings/bindings.json', runtime/'primary-workspaces.json', header): owners[(v.stat().st_dev,v.stat().st_ino)] = mutable
            owners[(mp.stat().st_dev,mp.stat().st_ino)] = 0
            real = os.fstat
            def metadata(fd):
                m = real(fd); key = (m.st_dev,m.st_ino)
                return owner(m, owners[key]) if key in owners else m
            stack.enter_context(patch.object(os,'fstat',side_effect=metadata))
            source = (mt.ROOT/'scripts/lib/hr-s256-one-shot/installed_inventory.py').read_text()
            nodes = [n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name in ('route','fixed_installed_inventory','fixed_source_identities','derive_holders')]
            ns = dict(vars(ds.HR_INVENTORY)); ns.update(APP=app, ROOT=runtime, MANIFEST=mp,
                GUI=next(v for k,v in routes.items() if k.startswith('gui/')), SYSTEM=next(v for k,v in routes.items() if k.startswith('system/')),
                HR_REAL_OS=ds.HR_REAL_OS, HR_PROFILE=ds.HR_PROFILE, HR_ONE_SHOT=ds.HR_ONE_SHOT, HR_PROJECTION=ds.HR_PROJECTION,
                HR_GATED_ENTRY_SHA256=hashlib.sha256(b'gated').hexdigest(), HR_CHILD_PROOF_SHA256=hashlib.sha256(b'proof').hexdigest(),
                HR_STARTUP_CONTEXT_SHA256=hashlib.sha256(b'context').hexdigest(), HR_INVENTORY_VALIDATOR_PINS={'packages/keep.js':hashlib.sha256(b'coherent-preserved').hexdigest()},
                node_metadata=lambda *a: {'paths':[str(runtime)],'encodedSession':'session','sessionsRoot':str(sessions)})
            exec(compile(ast.Module(body=nodes,type_ignores=[]),'installed_inventory.py','exec'),ns)
            from fixture_io import SyntheticFixedIO
            stack.enter_context(patch.object(ds.HR_PROJECTION,'fixed_subject_projection',return_value=SyntheticFixedIO(str(app.parent),ds).projection))
            stack.enter_context(patch.object(ds.HR_REAL_OS,'qualified_source_scope',return_value={'entryManifest':manifest}))
            return ns['fixed_installed_inventory'](), ns['fixed_source_identities']()
    def test_actual_root_promotion_and_readers(self):
        result, sources = self.join(); self.assertEqual(result['sources'],sources); self.assertEqual(len(sources),6)
    def test_nonroot_immutable_rejected(self):
        with self.assertRaisesRegex(Exception,'INVENTORY_FILE_CUSTODY'): self.join(immutable=505)
    def test_mutable_root_rejected(self):
        with self.assertRaisesRegex(Exception,'INVENTORY_FILE_CUSTODY'): self.join(mutable=0)
