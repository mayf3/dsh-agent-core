"""Offline assembly only: preserve accepted RC pair, inject the narrow §8 guard."""
import ast
import base64
import hashlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPAIR = HERE.parents[1] / 'evidence/r27-install-candidate-preparation/output/ds-repair'
BASE = REPAIR / 'candidate'
OUT = REPAIR / 'section8/candidate'
PIN = '89b4a9110c3c9bf7b644bdf18e6f9a4aab140bdc5d554282fd6f0530162b6013'
CLIENT_PIN = '4a55662a6e0a5308a24b191aa44c445de9a5d12fd81595bc4b6971cedab32e3f'


def replace_once(source, before, after):
    if source.count(before) != 1:
        raise RuntimeError('ASSEMBLY_PREIMAGE_NOT_UNIQUE')
    return source.replace(before, after, 1)


def build():
    raw = (BASE / 'deployment_system.py').read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise RuntimeError('ACCEPTED_SERVER_PREIMAGE_DRIFT')
    client = (BASE / 'ds_client.py').read_bytes()
    if hashlib.sha256(client).hexdigest() != CLIENT_PIN:
        raise RuntimeError('ACCEPTED_CLIENT_PREIMAGE_DRIFT')
    module = (HERE / 'e6_publication.py').read_bytes()
    digest = hashlib.sha256(module).hexdigest()
    loader = (f'B7_E6_PUBLICATION_SHA = {digest!r}\n'
              f'B7_E6_PUBLICATION_B64 = {base64.b64encode(module).decode()!r}\n\n'
              'def _b7_e6_publication_module():\n'
              '    raw = base64.b64decode(B7_E6_PUBLICATION_B64, validate=True)\n'
              '    require(sha_bytes(raw) == B7_E6_PUBLICATION_SHA, "E6_PUBLICATION_SOURCE_CHANGED")\n'
              '    namespace = {}\n'
              '    exec(compile(raw, "sealed-e6-publication", "exec"), namespace)\n'
              '    return namespace\n\n\n')
    source = raw.decode()
    source = replace_once(source, '@contextlib.contextmanager\ndef p0_reader_pair_guard():',
                          loader + '@contextlib.contextmanager\ndef p0_reader_pair_guard(request=None):')
    before = '''            prior = _p0_settings_module()["diagnose"](_p0_diagnostic_namespace(), list(P0_DIAGNOSTIC_ROSTER))
            require(prior.get("maintenancePreconditionsObserved") is True, "MAINTENANCE_UNKNOWN_OR_CONFLICT")'''
    after = '''            settings = _p0_settings_module()
            def diagnosis():
                return settings["diagnose"](_p0_diagnostic_namespace(), list(P0_DIAGNOSTIC_ROSTER))
            prior = diagnosis()
            publication_recheck = None
            if prior.get("maintenancePreconditionsObserved") is not True:
                publication_recheck = _b7_e6_publication_module()["qualify"](
                    _b7_execution_instance, request, prior, settings,
                    receipt_exists, DS_INSTALL_DIR, read_verified)'''
    source = replace_once(source, before, after)
    before = '                require(_p0_pair_receipt_pin(job._receipt()) == receipt_pin, "PAIR_RECEIPT_CHANGED")\n'
    after = before + '''                if publication_recheck is not None:
                    publication_recheck(diagnosis())
'''
    source = replace_once(source, before, after)
    source = replace_once(source, 'with p0_reader_pair_guard() as recheck:',
                          'with p0_reader_pair_guard(request) as recheck:')
    compile(source, 'deployment_system.py', 'exec')
    # Everything outside the three finite guard functions / two new literals
    # must be identical. In particular peer authorization, recovery/policy,
    # ds_update rollback, all settings and credential readers are unchanged.
    old, new = ast.parse(raw), ast.parse(source)
    changed = {'p0_reader_pair_guard', 'p0_maintained_ds_update', '_b7_e6_publication_module',
               'B7_E6_PUBLICATION_SHA', 'B7_E6_PUBLICATION_B64'}
    def untouched(tree):
        nodes = []
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and node.name in changed:
                continue
            if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in changed for t in node.targets):
                continue
            nodes.append(ast.dump(node, include_attributes=False))
        return nodes
    if untouched(old) != untouched(new):
        raise RuntimeError('UNTOUCHED_SOURCE_CHANGED')
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'deployment_system.py').write_text(source)
    (OUT / 'ds_client.py').write_bytes(client)
    print('SOURCE_ONLY / NOT_PUBLISHED / NOT_ARMED')
    print('server', hashlib.sha256(source.encode()).hexdigest())
    print('client', CLIENT_PIN)
    print('module', digest)


if __name__ == '__main__':
    build()
