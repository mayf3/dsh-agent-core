"""Offline assembly against one installed public shim source SHA; never installs."""
import argparse
import hashlib
import json
from pathlib import Path


BASE_SHA256 = 'd12fb2a883fae1259cf4331f863d540d4640dbfc1e942b6dbac1eb7bf40d2570'
HERE = Path(__file__).resolve().parent


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError('SHIM_SOURCE_SEAM_DRIFT')
    return text.replace(old, new)


def assemble_shim(source):
    if hashlib.sha256(source).hexdigest() != BASE_SHA256:
        raise ValueError('INSTALLED_SHIM_SOURCE_PIN')
    text = source.decode('utf-8')
    begin = text.index('def install_deployment_system(request):')
    end = text.index('\n\ndef handle(raw):', begin)
    payload = (HERE / 'install_join.py').read_text()
    text = text[:begin] + payload + text[end:]
    text = replace_once(text,
        '            "INSTALL_DEPLOYMENT_SYSTEM": {"action", "operation_id",\n'
        '                                           "artifacts"},',
        '            "INSTALL_DEPLOYMENT_SYSTEM": {"action", "operation_id",\n'
        '                                           "artifacts", "expected_preimage_sha256",\n'
        '                                           "ds_script_preimage_size",\n'
        '                                           "ds_script_candidate_size"},\n'
        '            "INSTALL_DEPLOYMENT_SYSTEM_STATUS": {"action", "operation_id"},')
    text = replace_once(text,
        '        if action == "INSTALL_DEPLOYMENT_SYSTEM":\n'
        '            return install_deployment_system(request), None',
        '        if action == "INSTALL_DEPLOYMENT_SYSTEM_STATUS":\n'
        '            return install_deployment_system_status(request), None\n'
        '        if action == "INSTALL_DEPLOYMENT_SYSTEM":\n'
        '            return install_deployment_system(request), None')
    return text.encode('utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('output')
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if str(output).startswith(('/usr/', '/Library/', '/private/var/')):
        raise SystemExit('OFFLINE_OUTPUT_REQUIRED')
    candidate = assemble_shim(Path(args.source).read_bytes())
    output.write_bytes(candidate)
    print(json.dumps({'baseSha256': BASE_SHA256,
                      'candidateSha256': hashlib.sha256(candidate).hexdigest(),
                      'candidateBytes': len(candidate), 'installable': False,
                      'reason': 'REVIEWED_SELF_UPDATE_AND_ROOT_RUNBOOK_REQUIRED'}))
