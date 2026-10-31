import datetime,hashlib,json,os,pathlib,subprocess,sys,time
root=pathlib.Path('/tmp/ac1277-r2-evidence')
label,cwd,db,*argv=sys.argv[1:]
log=root/(label+'.log')
if log.exists(): raise SystemExit('evidence exists: '+str(log))
env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','TMPDIR','CARGO_HOME','RUSTUP_HOME')}
dsn='postgres://ac1277_r2_test@127.0.0.1:57278/'+db
env.update(DATABASE_URL=dsn,TEST_DATABASE_URL=dsn,CARGO_TARGET_DIR='/tmp/ac1277-cargo-target',CARGO_BUILD_JOBS='4')
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=cwd,text=True).strip()
diff=subprocess.check_output(['git','diff','--binary','HEAD'],cwd=cwd)
started=datetime.datetime.now(datetime.timezone.utc).isoformat(); start=time.monotonic()
with log.open('xb') as out: rc=subprocess.run(argv,cwd=cwd,env=env,stdout=out,stderr=subprocess.STDOUT).returncode
record=dict(label=label,argv=argv,cwd=cwd,head=head,dirtyDiffSha256=hashlib.sha256(diff).hexdigest(),startedAt=started,elapsedSeconds=round(time.monotonic()-start,3),rc=rc,log=log.name,sha256=hashlib.sha256(log.read_bytes()).hexdigest(),databaseIdentity=dsn,environment='allowlisted env; DATABASE_URL=TEST_DATABASE_URL; local test cluster')
with (root/'commands.jsonl').open('a') as out: out.write(json.dumps(record)+'\n')
print(json.dumps(record),flush=True);print(log.read_text(errors='replace')[-9000:])
sys.exit(rc)
