#!/usr/bin/env python3
"""C7 isolated mechanism checks and one real stdio canary; never a window GO."""
import ast
import datetime as dt
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import time

ROOT = Path('/usr/local/v5-boot-isolation')
ASSEMBLED = ROOT / 'assembled-root'
MATERIALS_SEAL = 'c3595d20ac56cfe21fbcb011a75252879b7780411d4d30f6656d41e4989ed4ea'
HELPER = Path('/tmp/fleet-v5-candidate/scripts/lib/trusted-cp-fresh-child-boot-canary.mjs')
HELPER_SEAL = 'b737d6b42460383f305a741fb9d5f12babe9b1e292f933d3735d68a907447802'
NODE = ASSEMBLED / 'node-runtime/bin/node'
LAST_OUT = None


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def save(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def rejected(fn, label):
    try:
        fn()
    except (RuntimeError, ValueError, TypeError, KeyError):
        return label
    raise RuntimeError('expected rejection did not occur: ' + label)


def pure_functions(executor):
    path = executor.with_name('window_helper_core.py')
    names = {'require', 'digest', 'regular', 'manifest', 'stamp', 'validate_authority', 'quiet_ready'}
    tree = ast.parse(path.read_text(), filename=str(path))
    selected = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
    require({node.name for node in selected} == names, 'executor pure validators unavailable')
    namespace = dict(dt=dt, hashlib=hashlib, json=json, math=math, os=os,
                     P=Path, re=re, stat=stat, sys=sys, time=time)
    module = ast.Module(body=selected, type_ignores=[])
    exec(compile(module, str(path), 'exec'), namespace)
    return namespace, {'path': str(path), 'sha256': sha(path), 'functions': [
        {'name': node.name, 'line': node.lineno, 'end_line': node.end_lineno} for node in selected]}


def ancestors(path):
    rows = []
    for item in [path, *path.parents]:
        s = item.lstat()
        require(stat.S_ISDIR(s.st_mode) and not stat.S_ISLNK(s.st_mode), 'unsafe ancestor ' + str(item))
        require(s.st_mode & 0o022 == 0, 'writable ancestor ' + str(item))
        rows.append({'path': str(item), 'mode': oct(stat.S_IMODE(s.st_mode)), 'uid': s.st_uid, 'gid': s.st_gid})
    return rows


CANARY_RECORDER = r'''import { spawn, execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const [out, root, helper] = process.argv.slice(2)
const save = (name, value) => writeFileSync(join(out, name), JSON.stringify(value, null, 2)+'\n')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const known = new Map(), samples = [], stdout = [], stderr = [], events = []
let child, exit, close, optionsUsed, stopped = false, sampler, samplingError, teardownError
const table = () => execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,pgid=,lstart=,comm='],
  {encoding:'utf8', env:{PATH:'/usr/bin:/bin:/usr/sbin:/sbin',LC_ALL:'C'}}).split('\n').filter(Boolean).map(line => {
    const m=line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(.*)$/)
    if(!m) throw Error('unparseable process row')
    return {pid:+m[1],ppid:+m[2],pgid:+m[3],start:m[4].replace(/\s+/g,' '),comm:m[5]}
  })
const key = row => `${row.pid}:${row.start}`
function sample() {
  const rows=table(), selected=new Set(rows.filter(r=>r.pgid===child.pid||known.has(key(r))).map(r=>r.pid))
  let changed=true
  while(changed){changed=false;for(const r of rows)if(selected.has(r.ppid)&&!selected.has(r.pid)){selected.add(r.pid);changed=true}}
  const scoped=rows.filter(r=>selected.has(r.pid));for(const r of scoped)known.set(key(r),r)
  samples.push({utc:new Date().toISOString(),processes:scoped});return scoped
}
const spawnImpl = (exe, argv, options) => {
  if(child) throw Error('multiple canary children refused')
  optionsUsed={...options,detached:true};save('canary-spawn.json',{executable:exe,argv,options:optionsUsed,
    instrumentationDelta:'detached:true creates recorder-owned process group; official argv/env/stdio unchanged'})
  child=spawn(exe,argv,optionsUsed)
  child.stdout.on('data',data=>stdout.push(Buffer.from(data)))
  child.stderr.on('data',data=>stderr.push(Buffer.from(data)))
  child.on('exit',(code,signal)=>{exit={code,signal,utc:new Date().toISOString()}})
  child.on('close',(code,signal)=>{close={code,signal,utc:new Date().toISOString()}})
  const kill=child.kill.bind(child)
  child.kill=signal=>{const returned=kill(signal);events.push({signal,returned,pid:child.pid});return returned}
  sampler=(async()=>{while(!stopped){try{sample()}catch(error){samplingError=String(error)}if(!stopped)await sleep(100)}})()
  return child
}
let result, failure
try {
  const { runCanary }=await import(pathToFileURL(helper).href)
  result=await runCanary({trustedRoot:root,profile:'agent-core-production',setupProfile:'agent-core-production',
    readyRegex:'\\[demo-server\\] ready pid=',timeoutMs:90000,allowMissing:['dsh-codex'],keepHome:true},
    {spawnImpl,homeFactory:()=>join(out,'canary-home')})
} catch(error){failure=String(error.stack??error)}
finally {
  stopped=true;if(sampler)await sampler
  let remaining=null
  try {
    remaining=[]
    if(child?.pid){
      remaining=sample()
      if(remaining.length){
        const group=remaining.filter(r=>r.pgid===child.pid)
        if(group.length&&group.every(r=>known.has(key(r)))){
          process.kill(-child.pid,'SIGKILL');events.push({actor:'recorder_cleanup',pgid:child.pid,signal:'SIGKILL'})
        }
        for(let i=0;i<20&&remaining.length;i++){
          await sleep(100);remaining=sample()
        }
      }
    }
  } catch(error){teardownError=String(error.stack??error);remaining=null}
  writeFileSync(join(out,'canary-child.stdout.log'),Buffer.concat(stdout))
  writeFileSync(join(out,'canary-child.stderr.log'),Buffer.concat(stderr))
  const teardown={directChildExitObserved:!!exit,directChildCloseObserved:!!close,
    remainingObservedOrGroup:remaining,exitVerification:remaining===null?'UNKNOWN':'OBSERVED',observedIdentities:[...known.values()],
    limitation:'Unsampled descendants that escaped the group remain UNKNOWN.'}
  save('canary-result.json',{result,exit,close,teardown,events,samples,samplingError,teardownError,failure,
    requestedPorts:[],fullRuntime:'NOT_RUN',modelAuthBusiness:'NOT_RUN'})
  if(failure||samplingError||teardownError||!result?.ok||!result?.ready||result.pluginTreeFailed||result.missingPackages.length
    ||!exit||!close||remaining===null||remaining.length)process.exitCode=2
}
'''


def main(executor):
    global LAST_OUT
    os.umask(0o077)
    require(ROOT.resolve() == ROOT, 'isolation root must be physical')
    ancestor_rows = ancestors(ROOT)
    out = Path(tempfile.mkdtemp(prefix='c7-selftest-', dir=ROOT))
    LAST_OUT = out
    for name in ('home', 'tmp', 'canary-home'):
        (out / name).mkdir(mode=0o700)
    env = {'PATH': str(NODE.parent) + ':/usr/bin:/bin:/usr/sbin:/sbin', 'HOME': str(out / 'home'),
           'TMPDIR': str(out / 'tmp'), 'NODE_DISABLE_COMPILE_CACHE': '1', 'PYTHONDONTWRITEBYTECODE': '1'}
    log = []
    def emit(line):
        print(line, flush=True)
        log.append(line)
        (out / 'selftest.stdout.log').write_text('\n'.join(log) + '\n')
    def run(name, argv):
        start = dt.datetime.now(dt.timezone.utc).isoformat()
        with (out / (name + '.stdout.log')).open('wb') as stdout, (out / (name + '.stderr.log')).open('wb') as stderr:
            p = subprocess.Popen([str(v) for v in argv], cwd=out, env=env, stdout=stdout, stderr=stderr)
            code = p.wait()
        save(out / (name + '.command.json'), {'argv': [str(v) for v in argv], 'env': env, 'cwd': str(out),
             'pid': p.pid, 'exit_code': code, 'direct_child_reaped': True, 'started': start,
             'stdout_sha256': sha(out / (name + '.stdout.log')), 'stderr_sha256': sha(out / (name + '.stderr.log'))})
        require(code == 0, name + ' rc=' + str(code))
    stage = 'entry'
    completed = []
    try:
        emit('SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED receipts=' + str(out))
        f, extracted = pure_functions(executor)
        save(out / 'function-bindings.json', extracted)
        save(out / 'invocation.json', {'executor': str(executor), 'executor_sha256': sha(executor),
             'selftest_sha256': sha(__file__), 'env': env, 'ancestry': ancestor_rows,
             'code_bindings': {name: sha(executor.with_name(name)) for name in (
                 'window_helper_core.py', 'window_helper.py', 'window_preimage_xattr.py', 'window_close.py')}})
        stages = []
        def stage00():
            a = dict(window_id='C7_SYNTHETIC_NOT_AUTHORIZATION', writer='isolated-selftest', writer_uid=os.getuid(),
                     valid_from='2026-11-04T00:00:00Z', valid_until='2026-11-05T00:00:00Z',
                     expected_old_pid=1, expected_old_identity='SYNTHETIC_NOT_PROCESS',
                     expected_old_sha='23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9',
                     expected_plist_sha256='0'*64, expected_harness_stamp='SYNTHETIC',
                     expected_bindings_sha256='0'*64, expected_runtime_uid=os.getuid(), expected_runtime_gid=os.getgid(),
                     scopes=['source_lockfile_cleanup','production_mutex','bootout','full_preimage','install',
                             'plist_deployed_sha_only','bootstrap','verify','hr_observe'])
            moment = f['stamp']('2026-11-04T12:00:00Z')
            check = lambda item: f['validate_authority'](item, writer_uid=os.getuid(), now_epoch=moment)
            check(a)
            bad = dict(a); bad.pop('writer')
            cases = [rejected(lambda: check(bad), 'missing-field'),
                     rejected(lambda: check(dict(a, writer_uid=0)), 'root-writer'),
                     rejected(lambda: check(dict(a, valid_until='2026-11-04T00:00:00Z')), 'expired'),
                     rejected(lambda: check(dict(a, scopes=[])), 'missing-scope')]
            save(out / 'stage_00.json', {'scope': 'pure authority validator only', 'synthetic': a, 'negative_cases': cases,
                 'productionMutex': 'NOT_EXECUTED', 'productionAuthority': 'UNKNOWN_NOT_SUPPLIED'})
        stages.append(('stage_00_authority_mutex', stage00))
        def stage01():
            fixture = out / 'integrity-fixture'; fixture.mkdir()
            file = fixture / 'pnpm-lock.yaml'; file.write_text('C7 isolated fixture\n')
            seal = fixture / 'MANIFEST.sha256'; seal.write_text(sha(file) + '  pnpm-lock.yaml\n')
            before = sha(file)
            result = f['manifest'](seal, fixture, sha(seal))
            duplicate = fixture / 'duplicate.sha256'; duplicate.write_text(seal.read_text() * 2)
            negative = rejected(lambda: f['manifest'](duplicate, fixture), 'duplicate-path')
            require(file.exists() and sha(file) == before, 'clean-plan check deleted lockfile')
            run('extracted-helper-phase', ['/usr/bin/python3', '-B', executor.with_name('window_helper.py'),
                                         out, 'phase', 'c7_extraction_smoke', 'PASS', 'ISOLATED_ONLY'])
            require(read(out / 'c7_extraction_smoke.json')['status'] == 'PASS', 'extracted helper dispatch failed')
            save(out / 'stage_01.json', {'scope': 'real manifest validator on isolated fixture', 'result': result,
                 'negative_case': negative, 'lockfilePlan': [str(file)], 'deletion': 'NOT_EXECUTED',
                 'extractedHelperDispatch': 'ISOLATED_PHASE_RECEIPT_ONLY', 'productionIntegrityClean': 'NOT_EXECUTED'})
        stages.append(('stage_01_integrity_clean', stage01))
        def stage02():
            require(sha(ROOT / 'SELFTEST-MATERIALS-C5R11.json') == MATERIALS_SEAL, 'C5 material index changed')
            index = {row['path']: row for row in read(ROOT / 'SELFTEST-MATERIALS-C5R11.json')['materials']}
            binding = ROOT / 'c5r11-receipt/critical-key-and-harness9-bindings.json'
            require(sha(binding) == index[str(binding)]['sha256'], 'C5 critical binding changed')
            rows = read(ROOT / 'c5r11-receipt/critical-key-and-harness9-bindings.json')
            for row in rows:
                require(row['equal'] and sha(ASSEMBLED / row['relative_path']) == row['sha256'], 'C5 key changed')
            for relative, expected in {
                'harness/apps/cli/lib/bin.js': 'c0226687bb20f45c603ec6fe50f3de16d1c3510c3a803304ec575ef9bc366c62',
                'app/packages/scheduler/src/watchdog/routing.js': '91ec8516dedb2ac4f001434cbe5baa32fd8c0f3508e3256fa6d5c91d02334547',
            }.items():
                require(sha(ASSEMBLED / relative) == expected, 'C5 CLI/routing bytes changed: ' + relative)
            routing = out / 'routing.json'
            save(routing, {'version': 1, 'canonicalOpsTarget': {'channel': 'feishu', 'to': 'C7_NO_DELIVERY'},
                           'ownerTargets': {}, 'jobFailureTargets': {}})
            probe = out / 'routing-probe.mjs'
            probe.write_text("import {readProtectedRoutingManifest} from " + json.dumps(
                (ASSEMBLED / 'app/packages/scheduler/src/watchdog/routing.js').as_uri()) + ";\n" +
                "const result=readProtectedRoutingManifest(process.argv[2],{expectedUid:" + str(os.getuid()) +
                ",allowedGids:[" + str(os.getgid()) + "],maxMode:0o640,parentBoundary:'/'});\n" +
                "console.log(JSON.stringify({ok:true,result}));\n")
            run('protected-routing', [NODE, probe, routing])
            save(out / 'stage_02.json', {'scope': 'fresh isolated metadata and critical static hashes', 'keys': rows,
                 'freshAncestors': ancestors(out), 'productionFreshRead': 'NOT_EXECUTED'})
        stages.append(('stage_02_fresh_read', stage02))
        def stage03():
            material_file = ROOT / 'SELFTEST-MATERIALS-C5R11.json'
            require(sha(material_file) == MATERIALS_SEAL, 'C5 material index changed')
            materials = read(material_file)
            require(materials['material_count'] == len(materials['materials']) == 192, 'C5 material count differs')
            for row in materials['materials']:
                path = Path(row['path'])
                require(path.stat().st_size == row['bytes'] and sha(path) == row['sha256'], 'C5 material changed: ' + str(path))
            for i in (1, 2):
                c = read(ROOT / ('c5r11-receipt/canary-boot-%02d.json' % i))
                b = read(ROOT / ('c5r11-receipt/runtime-boot-%d.json' % i))
                r = c['official_result']; t = c['teardown']
                require(c['status'] == 'PASS_FRESH_CHILD_OBSERVED_EXIT' and r['ok'] is True and r['ready'] is True
                        and r['pluginTreeFailed'] is False and r['missingPackages'] == [], 'C5 canary not PASS')
                require(t['direct_child_exit_observed'] is True and t['direct_child_close_observed'] is True
                        and t['remaining_observed_identities'] == [] and t['remaining_spawned_group'] == [], 'C5 canary teardown gap')
                require(b['status'] == 'FULL_RUNTIME_READY_EXIT_PASS' and b['ready']['kind'] == 'ready'
                        and len(b['health']) == 2 and all(v['status'] == 200 and v['body']['ok'] is True for v in b['health']),
                        'C5 full-runtime readiness gap')
                require(b['closeEvent']['code'] == 0 and b['closeEvent']['signal'] is None
                        and b['processTreeExit']['survivors'] == [] and b['processTreeExit']['pgidAbsent'] is True,
                        'C5 full-runtime exit gap')
                require(c['args']['trustedRoot'] == str(ASSEMBLED) and b['executable'] == str(NODE), 'C5 root binding gap')
            for name in ('closure-final-reconciliation.json', 'dual-boot-idempotence-and-loaded-equality.json'):
                require(read(ROOT / 'c5r11-receipt' / name)['status'] == 'PASS', 'C5 closure/idempotence gap')
            save(out / 'stage_03.json', {'scope': 'C5-r11 evidence adapter; old r2/r3 schemas remain unchanged',
                 'material_count_verified': 192, 'historicalRuntimeBootsVerified': 2, 'newFullRuntime': 'NOT_EXECUTED',
                 'closureCoverage': '192 evidence hashes plus stage02 critical current files; full current tree NOT_REHASHED'})
        stages.append(('stage_03_dual_prerequisites', stage03))
        def stage04():
            q = f['quiet_ready']
            cases = [(179.999, True, True, False), (180, True, True, True), (180.001, True, True, True),
                     (180, False, True, False), (180, None, True, False), (180, True, False, False)]
            for age, clean, unchanged, expected in cases:
                require(q(age, clean, unchanged) is expected, 'quiet predicate boundary mismatch')
            save(out / 'stage_04.json', {'scope': 'real pure 180s predicate only', 'cases': cases,
                 'productionQuiet': 'NOT_EXECUTED', 'settlement': 'NOT_EXECUTED', 'liveCensus': 'UNKNOWN'})
        stages.append(('stage_04_quiet_gate', stage04))
        def close_checks():
            spec = importlib.util.spec_from_file_location('c7_close_checks', executor.with_name('window_close.py'))
            module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
            names_result = module.reconcile_names(['old', 'kept'], ['new', 'kept'], {'old': 'new'})
            require(names_result['mapped_diff_empty'] is True, 'C7 mapped diff not empty')
            cases = [rejected(lambda: module.reconcile_names(['a'], [], {}), 'missing-name'),
                     rejected(lambda: module.reconcile_names(['a'], ['a', 'b'], {}), 'added-name'),
                     rejected(lambda: module.reconcile_names(['a', 'b'], ['b'], {'a': 'b'}), 'rename-collision')]
            root = out / 'retention-fixture'; root.mkdir()
            order = ['.ds-old-newest', '.ds-old-second', '.ds-old-pinned', '.ds-old-025', '.ds-old-oldest']
            for name in order + ['agent-core.bak-preserved', 'node_modules.bak']:
                (root / name).mkdir()
            before = sorted(p.name for p in root.iterdir())
            plan = module.retention_plan(root, order, ['.ds-old-pinned'])
            require(plan['list_only'] is True and plan['deletion_executed'] is False, 'C7 deletion enabled')
            require([row['name'] for row in plan['delete_candidates']] == ['.ds-old-oldest'], 'C7 retention set differs')
            require(sorted(p.name for p in root.iterdir()) == before, 'C7 retention plan mutated fixture')
            cases.append(rejected(lambda: module.retention_plan(root, order[:-1], []), 'incomplete-generation-order'))
            moment = dt.datetime.now(dt.timezone.utc)
            before_path, after_path = out / 'names-before.json', out / 'names-after.json'
            snapshot = {'window_id': 'C7_FIXTURE', 'scope': 'synthetic-names', 'method': 'manual-inventory',
                        'collector': 'C7 selftest synthetic fixture', 'captured_at': moment.isoformat(),
                        'names': ['old', 'kept']}
            save(before_path, snapshot)
            authority = {'window_id': 'C7_FIXTURE', 'valid_from': (moment-dt.timedelta(days=1)).isoformat(),
                         'valid_until': (moment+dt.timedelta(days=1)).isoformat(),
                         'c7': {'before_path': str(before_path), 'before_sha256': sha(before_path),
                                'after_path': str(after_path), 'naming_scope': 'synthetic-names', 'renames': {'old': 'new'},
                                'generations_newest_first': order, 'protected_generations': ['.ds-old-pinned'],
                                'protection_basis': 'Synthetic fixture; all protected subjects accounted for'}}
            captured = module.capture_before(authority)
            save(after_path, dict(snapshot, names=['new', 'kept'], captured_at=dt.datetime.now(dt.timezone.utc).isoformat()))
            closed = module.close_window(authority, captured, root, moment.isoformat())
            changed = dict(authority, c7=dict(authority['c7'], protected_generations=[]))
            cases.append(rejected(lambda: module.close_window(changed, captured, root, moment.isoformat()), 'authority-protection-drift'))
            require(closed['names']['mapped_diff_empty'] is True and sorted(p.name for p in root.iterdir()) == before,
                    'full C7 accounting mutated fixture or naming diff differs')
            save(out / 'c7-focused.json', {'rename_result': names_result, 'negative_cases': cases, 'retention_plan': plan,
                 'full_close_fixture': closed, 'all_fixture_paths_preserved': True,
                 'scope': 'isolated R6/R7 pure mechanisms; production close NOT_EXECUTED'})
        stages.append(('c7_R6_R7_close_checks', close_checks))
        for stage, fn in stages:
            emit('BEGIN ' + stage + ' SELFTEST_ISOLATED_CHECKS')
            fn(); completed.append(stage)
            emit('END ' + stage + ' PASS SELFTEST_ISOLATED_CHECKS productionStageExecution=NOT_EXECUTED')
        stage = 'canary'
        emit('BEGIN canary REAL_OFFICIAL_STDIO_FRESH_HOME')
        require(sha(HELPER) == HELPER_SEAL, 'official canary helper changed')
        recorder = out / 'canary-recorder.mjs'; recorder.write_text(CANARY_RECORDER)
        run('canary-recorder', [NODE, recorder, out, ASSEMBLED, HELPER])
        completed.append(stage)
        emit('END canary PASS REAL_OFFICIAL_STDIO_FRESH_HOME fullRuntime=NOT_EXECUTED')
        # Preserve every C5 material and the validators used by this run after the real canary.
        stage = 'postflight_preservation'
        emit('BEGIN postflight_preservation C5_MATERIALS_AND_VALIDATORS')
        require(sha(ROOT / 'SELFTEST-MATERIALS-C5R11.json') == MATERIALS_SEAL, 'C5 material index changed during selftest')
        for row in read(ROOT / 'SELFTEST-MATERIALS-C5R11.json')['materials']:
            require(sha(row['path']) == row['sha256'], 'C5 material changed during selftest: ' + row['path'])
        require(sha(executor.with_name('window_helper_core.py')) == extracted['sha256'], 'validator changed during selftest')
        invocation = read(out / 'invocation.json')
        require(sha(executor) == invocation['executor_sha256'] and sha(__file__) == invocation['selftest_sha256'],
                'executor/selftest changed during selftest')
        for name, digest in invocation['code_bindings'].items():
            require(sha(executor.with_name(name)) == digest, 'executor module changed during selftest: ' + name)
        emit('END postflight_preservation PASS C5_MATERIALS_AND_VALIDATORS')
        save(out / 'summary.json', {'status': 'PASS_ISOLATED_CHECKS_AND_STDIO_CANARY', 'completed': completed,
             'productionStageExecution': 'NOT_EXECUTED', 'productionWrite': False, 'windowGO': False,
             'unknown': ['production authority/PID/plist/mutex/live census', 'full current closure rehash',
                         'new complete runtime dual startup', 'unsampled escaped descendants', 'model/auth/business acceptance']})
        emit('SELFTEST PASS_ISOLATED_CHECKS_AND_STDIO_CANARY windowGO=false')
        return 0
    except Exception as error:
        emit('END ' + stage + ' FAIL ' + str(error))
        (out / 'STOPPED-C7.md').write_text('# STOPPED-C7\n\nStage: ' + stage + '\n\n' + str(error) + '\n\nNo retry; downstream not executed.\n')
        save(out / 'summary.json', {'status': 'FAIL_STOPPED', 'failed_stage': stage, 'error': str(error), 'completed': completed})
        return 1


if __name__ == '__main__':
    require(len(sys.argv) == 2 and Path(sys.argv[1]).is_absolute(), 'usage: window-selftest.py /absolute/window-executor-v5.sh')
    sys.dont_write_bytecode = True
    try:
        result = main(Path(sys.argv[1]))
    except Exception as error:
        print('END entry FAIL ' + str(error), flush=True)
        result = 1
    if result:
        # Safe workspace fallback even if the isolation ancestor gate refused writes.
        stop = Path(__file__).resolve().parents[2] / 'STOPPED-C7.md'
        stop.write_text('# STOPPED-C7\n\nSelftest failed; no retry or downstream execution.\n\n'
                        'Isolated evidence directory: ' + str(LAST_OUT or 'NOT_CREATED') + '\n'
                        'See verbatim failure output and isolated STOPPED-C7/summary when created.\n')
    sys.exit(result)
