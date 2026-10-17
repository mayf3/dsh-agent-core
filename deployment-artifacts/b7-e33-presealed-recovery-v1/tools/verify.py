#!/usr/bin/env python3
"""Run only the three source-reconstruction tests, never a daemon protocol."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

PACKAGE=Path(__file__).resolve().parents[1]

def verify(baselines):
    command=[sys.executable,'-I','-B',str(PACKAGE/'tests/test_reconstruction.py.fixture'),str(baselines)]
    result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=120,check=False)
    output=result.stdout+result.stderr
    if result.returncode:
        raise RuntimeError('SOURCE_ARTIFACT_TESTS_FAILED: '+output.decode('utf-8','replace'))
    if b'Ran 3 tests' not in output or not output.rstrip().endswith(b'OK'):
        raise RuntimeError('TEST_RESULT_NOT_COMPLETE')
    return {'kind':'SOURCE_ARTIFACT_RECONSTRUCTION_VERIFICATION',
            'tests':3,'result':'PASS','wrong_input_refused':True,'existing_output_refused':True,
            'actual_owned_output_and_whole_inverse_checked':True,
            'test_output_sha256':hashlib.sha256(output).hexdigest(),
            'test_output':output.decode('utf-8'),'protocol_or_recovery_tests':'NOT_RERUN_EXISTING_REVIEW_REUSED',
            'baseline_copy_or_clone':False,'production_or_ds_or_auth_requests':False}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baselines',type=Path,required=True)
    parser.add_argument('--receipt',type=Path,help='Optional new owned receipt, outside immutable package')
    args=parser.parse_args();result=verify(args.baselines);text=json.dumps(result,indent=2)+'\n'
    if args.receipt:
        with args.receipt.open('x') as target:target.write(text)
    print(text)
