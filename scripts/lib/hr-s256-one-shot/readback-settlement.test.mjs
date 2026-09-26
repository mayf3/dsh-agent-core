/** Disposable actual V3 store/consumer readback. No host/root action. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { closeSync, openSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixedR2Fixture } from '../../../packages/agent-router/test/helpers/fixed-r2-consumer-fixture.js'
import { projectSubject } from '../../../deployment-artifacts/hr-s256-trusted-cut-v1/project-subject.mjs'
import { readSettlement } from './readback-settlement.mjs'

test('actual pinned-validator readback projects only exact settled s256 and never writes', t => {
  const fx = fixedR2Fixture(cleanup => t.after(cleanup))
  let fd = openSync(fx.persistenceFile, 'r')
  const blocked = readFileSync(fx.persistenceFile)
  assert.throws(() => readSettlement(`/dev/fd/${fd}`), /EXACT_S256_SETTLEMENT_UNKNOWN/)
  assert.deepEqual(readFileSync(fx.persistenceFile), blocked)
  closeSync(fd)
  assert.deepEqual(fx.store.consumeStartupQuiescence(fx).map(row => row.status), ['settled'])
  const settled = readFileSync(fx.persistenceFile)
  fd = openSync(fx.persistenceFile, 'r')
  try {
    const projection = readSettlement(`/dev/fd/${fd}`)
    assert.deepEqual(projection.subject, fx.bundle.subject)
    assert.deepEqual(projection.settlement, { reconciliationHandle: fx.handle,
      queryState: 'settled', fenceState: 'cleared', initialOutcome: 'outcome_unknown',
      terminationEvidence: 'restart_quiescence_proven' })
    assert.deepEqual(readFileSync(fx.persistenceFile), settled)
  } finally { closeSync(fd) }
})

test('readback accepts only inherited FD form, never caller file or handle', () => {
  assert.throws(() => readSettlement('/Users/authsvc/.agent-core/control/turn-recovery-v3.json'),
    /FIXED_STORE_FD_REQUIRED/)
})


test('actual Python immutable commitment joins actual Node projection in guarded adapter', t => {
  const fx = fixedR2Fixture(cleanup => t.after(cleanup))
  assert.deepEqual(fx.store.consumeStartupQuiescence(fx).map(row => row.status), ['settled'])
  const before = readFileSync(fx.persistenceFile)
  const fd = openSync(fx.persistenceFile, 'r')
  let projection
  try { projection = readSettlement(`/dev/fd/${fd}`) } finally { closeSync(fd) }
  const script = `import importlib.util,json,os,sys,hashlib
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
inputs=json.load(sys.stdin)
def load(path):
 s=importlib.util.spec_from_file_location('disposable',path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
adapter=load(Path(inputs['moduleDir'])/'fixed_os.py')
journal=load(Path(inputs['moduleDir']).parents[2]/'deployment-artifacts/hr-s256-trusted-cut-v1/journal.py')
journal.TEST_MODE=True;journal.STATE_ROOT=str(Path(inputs['evidenceDir']).parent)
# Actual receipt validator reads its immutable root-custody surrogate, not a mocked tuple.
commitment=journal.readback('bundle-commitment')[0]
assert set(commitment['subject']) == {'turnExecutionId','runtimeEpoch','agentId','processGeneration'}
store=os.open(inputs['store'],os.O_RDONLY)
try:
 projection=SimpleNamespace(pinned_validator_sources=lambda:{'fixture':'pinned'},
  opened_fixed_store=lambda:(os.dup(store),os.fstat(store)),
  digest_fd=lambda fd,size:hashlib.sha256(os.pread(fd,size,0)).hexdigest(),
  identity=lambda m:(m.st_dev,m.st_ino,m.st_size,m.st_mtime_ns))
 adapter.HR_JOURNAL=journal
 with patch.object(adapter,'require_activation',return_value={'consumingBinarySha256':'a'*64}),patch.object(adapter,'bounded_validator_output',return_value=json.dumps(inputs['projection']).encode()):
  result=adapter.installed_settlement_projection(projection,'fixture',adapter.digest(b'fixture'))
  assert result['subject']==inputs['projection']['subject']
  for alteration in ({'reconciliationHandle':'different'}, {'runtimeEpoch':'different'}, {'privatePayload':'sensitive-fixture'}, {'processGeneration':True}):
   altered=json.loads(json.dumps(inputs['projection']))
   altered['subject'].update(alteration)
   with patch.object(adapter,'bounded_validator_output',return_value=json.dumps(altered).encode()):
    try: adapter.installed_settlement_projection(projection,'fixture',adapter.digest(b'fixture'))
    except adapter.Rejected as error: assert str(error)=='READBACK_SUBJECT_MISMATCH'
    else: raise AssertionError('closed tuple bypass accepted')
 print('ACTUAL_JOIN_PASS')
finally: os.close(store)
`
  const result = spawnSync('python3', ['-c', script], { encoding: 'utf8', timeout: 5000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    input: JSON.stringify({ moduleDir: dirname(fileURLToPath(import.meta.url)), evidenceDir: fx.evidenceDir, store: fx.persistenceFile, projection }) })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /ACTUAL_JOIN_PASS/)
  assert.deepEqual(readFileSync(fx.persistenceFile), before)
})


test('actual current projector schema reaches assembled fixed action without synthetic hash alias', t => {
  const fx = fixedR2Fixture(cleanup => t.after(cleanup))
  const before = readFileSync(fx.persistenceFile)
  const fd = openSync(fx.persistenceFile, 'r')
  let projection
  try { projection = projectSubject(`/dev/fd/${fd}`) } finally { closeSync(fd) }
  const script = `import json,sys,tempfile,os
from pathlib import Path
from unittest.mock import patch
inputs=json.load(sys.stdin);sys.path.insert(0,inputs['moduleDir'])
from test_orchestration import FixedAssembledActionTest
from fixture_io import SyntheticFixedIO
case=FixedAssembledActionTest()
with tempfile.TemporaryDirectory() as root:
 os.chmod(root,0o755);ds=case.assembled(root);io=SyntheticFixedIO(root,ds)
 io.projection=inputs['projection']
 try:
  result=case.run_fixture(ds,io)
  assert result['ok'],result
  intent=ds.HR_JOURNAL.readback('intent')[0]
  assert intent['subjectPreimageSha256']==inputs['projection']['subjectPreimageSha256']
  auth=ds.HR_JOURNAL.readback('launch-authorization')[0]['authorization']
  assert auth['subjectPreimageSha256']==inputs['projection']['subjectPreimageSha256']
  assert auth['subject']['runtimeEpoch']==inputs['projection']['runtimeEpoch']
  print('ACTUAL_PROJECTION_JOIN_PASS')
 finally:
  case.cleanup_custody(ds)
  if io.window is not None: os.close(io.window)
`
  const result = spawnSync('python3', ['-c', script], { encoding: 'utf8', timeout: 5000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    input: JSON.stringify({ moduleDir: dirname(fileURLToPath(import.meta.url)), projection }) })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /ACTUAL_PROJECTION_JOIN_PASS/)
  assert.deepEqual(readFileSync(fx.persistenceFile), before)
})
