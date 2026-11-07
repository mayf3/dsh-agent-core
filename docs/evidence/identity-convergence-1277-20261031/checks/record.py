import datetime, hashlib, json, os, pathlib, subprocess, sys, time

root = pathlib.Path('/tmp/ac1277-evidence')
root.mkdir(exist_ok=True)
label, *argv = sys.argv[1:]
log = root / (label + '.log')
if log.exists():
    raise SystemExit('refusing evidence overwrite: ' + str(log))
env = {k: v for k, v in os.environ.items() if k in ('PATH', 'HOME', 'TMPDIR', 'CARGO_HOME', 'RUSTUP_HOME')}
dsn = 'postgres://ac1277_test@127.0.0.1:57277/ac1277_test'
env.update(DATABASE_URL=dsn, TEST_DATABASE_URL=dsn, CARGO_TARGET_DIR='/tmp/ac1277-cargo-target', CARGO_BUILD_JOBS='4')
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd='/tmp/ac1277-svc-workflow', text=True).strip()
diff = subprocess.check_output(['git', 'diff', '--binary', 'HEAD'], cwd='/tmp/ac1277-svc-workflow')
t = time.monotonic()
with log.open('xb') as out:
    result = subprocess.run(argv, cwd='/tmp/ac1277-svc-workflow', env=env, stdout=out, stderr=subprocess.STDOUT)
record = dict(label=label, argv=argv, cwd='/tmp/ac1277-svc-workflow', startedAt=start,
              head=head, candidateDiffSha256=hashlib.sha256(diff).hexdigest(),
              elapsedSeconds=round(time.monotonic()-t, 3), rc=result.returncode,
              log=log.name, sha256=hashlib.sha256(log.read_bytes()).hexdigest(),
              databaseIdentity='owned loopback ac1277_test@127.0.0.1:57277/ac1277_test; DATABASE_URL=TEST_DATABASE_URL')
with (root / 'commands.jsonl').open('a') as out:
    out.write(json.dumps(record) + '\n')
print(json.dumps(record), flush=True)
print(log.read_text(errors='replace')[-7000:])
sys.exit(result.returncode)
