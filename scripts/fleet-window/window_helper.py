from window_helper_core import *
from window_preimage_xattr import XATTRS_KEY, inventory, reconcile_xattrs
from window_close import capture_before, close_window

if op=='authority':
    path=P(args[0]); regular(path); a=read(path)
    validate_authority(a)
    save('authority.json',a); authority()
    save('c7-names-before.json',capture_before(a))
    save('invocation.json',{'at':now(),'argv':args[1:],'authorityPath':str(path),'authoritySha256':digest(path),
                            'writerPid':int(args[1]),'productionAcceptance':'NOT_YET_EXECUTED'})
elif op=='mutex':
    a=authority(); require(lock.parent.is_dir() and not lock.parent.is_symlink(),'mutex parent absent/unsafe')
    effect_guard('mutex.mkdir',str(lock),{'mode':0o700},acquire=True)
    lock.mkdir(mode=0o700) # EEXIST stops; never disposes another writer's lock.
    mutex_acquired()
    holder='pid=%s\nuid=%s\ncmd=window-executor-v5.sh\nwindow=%s\nstarted=%s\n'%(args[0],a['writer_uid'],a['window_id'],now())
    effect_guard('mutex.holder.write',str(lock/'holder'),{'content':holder})
    (lock/'holder').write_text(holder)
    effect_guard('mutex.holder.chmod',str(lock/'holder'),{'mode':0o600})
    os.chmod(lock/'holder',0o600)
    save('mutex.json',{'path':str(lock),'holder':holder,'sha256':digest(lock/'holder'),
                       'identity':list((lock.stat().st_dev,lock.stat().st_ino,lock.stat().st_uid))})
    authority()
    require(digest(lock/'holder')==read(rd/'mutex.json')['sha256'],'mutex ownership changed after acquisition')
elif op=='mutex-check':
    authority(); require(digest(lock/'holder')==read(rd/'mutex.json')['sha256'],'mutex ownership changed')
elif op=='stage-bundle':
    authority()
    template='/private/tmp/fleet-binding-window-v5.XXXXXX'
    argv=['/usr/bin/mktemp','-d',template]
    effect_guard('staging.mktemp',template,{'argv':argv},internal=True)
    b=P(run(argv).stdout.decode().strip())
    for src,dst,flags in ((inp/'window-installer',b/'scripts',['-RP']),
                          (inp/'payload',b/'payload',['-RP']),
                          (inp/'WINDOW_INPUTS.sha256',b/'WINDOW_INPUTS.sha256',[])):
        argv=['/bin/cp',*flags,str(src),str(dst)]
        effect_guard('staging.copy',str(dst),{'argv':argv},internal=True)
        run(argv)
    for operation,argv in (('staging.chown',['/usr/sbin/chown','-R','root:wheel',str(b)]),
                           ('staging.chmod',['/bin/chmod','-R','go-w',str(b)])):
        effect_guard(operation,str(b),{'argv':argv},internal=True)
        run(argv)
    print(b)
elif op=='bootout':
    authority(); old=read(rd/'old-process.json')
    require(read(rd/'old-workers-at-bootout.json') is not None,'before-stop evidence missing')
    require(identity(old['pid'])==old['identity'],'old identity changed at bootout boundary')
    require(digest(plist)==read(rd/'plist-preimage.json')['sha256'],'plist drift at bootout boundary')
    argv=['/bin/launchctl','bootout','system',str(plist)]
    effect_guard('runtime.bootout',str(plist),{'argv':argv})
    save('bootout-invocation.json',{'at':now(),'argv':argv,'result':'UNKNOWN'})
    run(argv)
elif op=='bootstrap':
    authority(); service_absent()
    require(read(rd/'final-binding.json').get('config')=='PRODUCTION_PREIMAGE_PRESERVED',
            'final-binding evidence missing before bootstrap')
    require(digest(plist)==read(rd/'plist-after.json')['sha256'],'plist drift before bootstrap')
    argv=['/bin/launchctl','bootstrap','system',str(plist)]
    effect_guard('runtime.bootstrap',str(plist),{'argv':argv})
    save('bootstrap-invocation.json',{'at':now(),'argv':argv,'result':'UNKNOWN'})
    run(argv)
elif op=='settlement-start':
    effect_guard('settlement.commit',str(prod),{'sourceRoot':str(source),'receiptDir':str(rd)},internal=True)
elif op=='installer-boundary':
    b=P(args[0]); regular(b/'scripts/trusted-cp-deploy-install.sh')
    effect_guard('installer.execute',str(live),{'bundle':str(b),'source':str(source),
                 'harness':str(harness),'sha':sha,'tree':tree},internal=True)
elif op=='stop-state':
    print('proved' if (rd/'old-exit.json').exists() else
          'attempted' if (rd/'bootout-invocation.json').exists() else 'not_attempted')
elif op=='integrity':
    specs=[(prep/'MANIFEST.sha256',prep,'b28eda4cc2eb47bbaf0834a144c40194d6b2f633542a7ef09192b84288ace3e6'),
           (inp/'MANIFEST.sha256',inp,'cccad3a8d13073877b895080992338aa9d0243d6da79a896ff492752b97a632c'),
           (inp/'SOURCE_INPUTS.sha256',inp,'bafa006e0d5f36688a2ba38f58ae7066e9216535fb994bccfb683dd4bf027644')]
    results=[]
    for f,b,h in specs:
        r=manifest(f,b,h); r.pop('records'); results.append(r)
    require(digest(prep/'WINDOW-SEQUENCE-v5.md')=='c814427d4aa1a3a73bdff634164c19936882f1101a7dfb225a9fdd78ef726cfd','blueprint changed')
    require(digest(inp/'window-installer/trusted-cp-deploy-install.sh')=='2a6b6819b4184254ff83829affbd9cf7458bc22d36ea7fde09d752fb5963f88a','installer changed')
    save('manifest-verification.json',results)
elif op=='clean':
    authority()
    require(source.resolve()==source and source.stat().st_uid==os.getuid(),'not authorized staging worktree owner')
    data=run(['/usr/bin/git','-C',source,'ls-files','--others','--exclude-standard','-z']).stdout
    raw('untracked-before.nul',data); records=[]
    backup=rd/'untracked-lockfiles'
    effect_guard('source.backup.mkdir',str(backup),{'mode':0o700})
    backup.mkdir(mode=0o700)
    # Full enumeration and ALL verified backups before the first deletion.
    for b in data.split(b'\0'):
        if not b: continue
        name=os.fsdecode(b)
        if P(name).name!='pnpm-lock.yaml': continue
        p=source/name; regular(p)
        require(p.resolve().is_relative_to(source),'lockfile escapes authorized source')
        dst=backup/name
        for parent in reversed([dst.parent,*dst.parent.parents]):
            if (parent==backup or backup in parent.parents) and not parent.exists():
                effect_guard('source.backup.mkdir',str(parent),{'mode':0o700})
                parent.mkdir(mode=0o700)
        effect_guard('source.copy2',str(dst),{'source':str(p)},internal=True)
        shutil.copy2(p,dst); h=digest(p); require(digest(dst)==h,'lockfile backup mismatch')
        records.append({'path':str(p),'backup':str(dst),'sha256':h,'metadata':meta(p)})
    save('lockfile-backups.json',records)
    for row in records:
        p=P(row['path']); require(digest(p)==row['sha256'] and meta(p)==row['metadata'],'lockfile drift before deletion')
        current=run(['/usr/bin/git','-C',source,'ls-files','--others','--exclude-standard','-z']).stdout.split(b'\0')
        require(os.fsencode(str(p.relative_to(source))) in current,'lockfile no longer untracked')
        effect_guard('source.unlink',str(p),{'sha256':row['sha256']})
        p.unlink()
    status=run(['/usr/bin/git','-C',source,'status','--porcelain=v1','--untracked-files=all']).stdout
    raw('source-status-after.txt',status); require(not status,'other dirty/untracked content; STOP for itemized disposition')
elif op=='sources':
    a=authority(); rows=[]
    for path in (source,harness):
        head=run(['/usr/bin/git','-C',path,'rev-parse','HEAD']).stdout.decode().strip()
        tr=run(['/usr/bin/git','-C',path,'rev-parse','HEAD^{tree}']).stdout.decode().strip()
        status=run(['/usr/bin/git','-C',path,'status','--porcelain=v1','--untracked-files=all']).stdout.decode()
        st=run(['/bin/bash',inp/'window-installer/lib/trusted-source-git-stamp.sh',path]).stdout.decode()
        rows.append({'path':str(path),'head':head,'tree':tr,'status':status,'stamp':st})
        require(not status,'dirty source/Harness; cannot bypass source gate: '+str(path))
        if path==source: require(head==sha and tr==tree,'source coordinates changed')
        else: require(st==a['expected_harness_stamp'],'Harness stamp differs from window authorization')
    if (rd/'sources.json').exists(): require(read(rd/'sources.json')==rows,'source/Harness drift during window')
    else: save('sources.json',rows)
elif op=='fresh':
    a=authority(); regular(plist); require(digest(plist)==a['expected_plist_sha256'],'plist preimage differs')
    doc=plistlib.loads(plist.read_bytes()); env=doc['EnvironmentVariables']; argv=doc['ProgramArguments']
    require(doc['Label']=='ai.agent-core.runtime','unexpected plist Label')
    require(argv[:2]==[str(live/'node-runtime/bin/node'),str(live/'app/scripts/production-runtime.mjs')]
            and '--native-arm64' not in argv,'unexpected Node/runtime/architecture argv')
    require(doc.get('WorkingDirectory')==str(live/'app'),'unexpected runtime WorkingDirectory')
    require(env.get('AGENT_CORE_DEPLOYED_SHA')==a['expected_old_sha'],'old plist deployment mismatch')
    require(env.get('AGENT_DIRECTORY_AUTH_JWKS_URL'),'JWKS env missing')
    require('DSH_RUNTIME_ARCH' not in env,'different architecture candidate')
    require('--root' in argv and argv[argv.index('--root')+1]==str(prod),'runtime root mismatch')
    text=launch(); launch_binding(text,doc); raw('old-launchctl.txt',text.encode()); pid=pid_from(text)
    require(pid==a['expected_old_pid'] and identity(pid)==a['expected_old_identity'],'old process identity differs')
    require(int(identity(pid).split()[1])==a['expected_runtime_uid'],'old UID mismatch')
    raw('plist.preimage',plist.read_bytes()); save('plist-preimage.json',{'sha256':digest(plist),'metadata':meta(plist),'document':doc})
    save('old-process.json',{'pid':pid,'identity':identity(pid),'workers':old_workers(pid),
         'loadedEnvSha256':loaded_env(pid,env,'old-loaded-env.private.txt')})
    save('private-inputs.json',private_inputs('stage-02'))
    require(pid_from(launch())==pid and identity(pid)==a['expected_old_identity'],'old process changed during fresh-read')
elif op=='bundle':
    b=P(args[0]); require(b.resolve()==b and b.stat().st_uid==0,'bundle must be physical and root-owned')
    r=manifest(b/'WINDOW_INPUTS.sha256',b,'3d7130a34cb8775f8a35aa9d06dd635a73bd80cd14135f8b048feb6af224aaf5')
    expected=set(r.pop('records')); actual=set()
    for base,dirs,files in os.walk(b):
        for name in dirs+files:
            p=P(base)/name; m=p.lstat()
            require(not p.is_symlink() and m.st_uid==0 and m.st_mode&0o022==0,'unsafe bundle custody '+str(p))
            if p.is_file() and p.name!='WINDOW_INPUTS.sha256': actual.add(str(p.relative_to(b)))
    require(actual==expected,'bundle file membership differs')
    save('window-bundle.json',{'path':str(b),'manifest':r,'installerSha256':digest(b/'scripts/trusted-cp-deploy-install.sh')})
elif op=='prerequisites':
    a=manifest(prep/'r3/accepted-r2-inputs.sha256',prep)['records']
    current=inventory(prep/'scratch',False); r2=inventory(prep/'r2',False)
    files={'scratch/'+k for k,v in current.items() if k!=XATTRS_KEY and v['kind']=='file'}|{'r2/'+k for k,v in r2.items() if k!=XATTRS_KEY and v['kind']=='file'}
    require(files==set(a),'accepted candidate/r2 file membership changed')
    links=sorted([{'path':'scratch/'+k,'target':v['target']} for k,v in current.items() if k!=XATTRS_KEY and v['kind']=='link']+
                 [{'path':'r2/'+k,'target':v['target']} for k,v in r2.items() if k!=XATTRS_KEY and v['kind']=='link'],key=lambda r:r['path'])
    old=[r for r in read(prep/'r2/symlink-inventory.json') if r['path'].startswith(('scratch/','r2/'))]
    require(links==old,'accepted symlink bindings changed')
    c=read(prep/'r2/canary-receipt.json'); b=read(prep/'r3/attempt-02/runtime-boot-receipt.json')
    require(c['ok'] is True and c['wrapperRc']==0 and c['result']['ready'] is True and
            c['result']['pluginTreeFailed'] is False and c['result']['missingPackages']==[] and
            c['noFatal'] is True and c['childTerminated'] is True,'fresh-child canary not PASS')
    require(b['ok'] is True and b['wrapperRc']==0 and len(b['checks'])==16 and all(v is True for v in b['checks'].values())
            and b['close']==dict(b['close'],code=0,signal=None),'full runtime not PASS')
    require(c['candidate']==b['candidate']==str(prep/'scratch'),'dual candidate binding differs')
    for name,h in b['rawHashes'].items(): require(digest(prep/'r3/attempt-02'/name)==h,'runtime raw log mismatch')
    closure={k:inventory(prep/'scratch'/k) for k in ('app','harness','node-runtime')}
    save('accepted-closure.json',closure)
    save('accepted-closure-acl.json',{k:json.loads(acl_listing(prep/'scratch'/k)) for k in closure})
    save('dual-prerequisites.json',{'at':now(),'canarySha256':digest(prep/'r2/canary-receipt.json'),
         'runtimeSha256':digest(prep/'r3/attempt-02/runtime-boot-receipt.json'),'regularFiles':len(files),
         'links':len(links),'canaryTermination':'SIGKILL by original tool; not graceful',
         'fullRuntimeTermination':'SIGTERM, code=0, signal=null','isolatedOnly':True})
elif op=='quiet':
    a=authority(); old=read(rd/'old-process.json')
    require(identity(old['pid'])==old['identity'],'old process identity changed')
    log=P(read(rd/'plist-preimage.json')['document']['StandardErrorPath']); regular(log)
    m=meta(log); age=time.time()-m['mtime_ns']/1e9
    save('quiet-last.json',{'at':now(),'path':str(log),'ageSeconds':age,'metadata':m})
    if age<180: sys.exit(10) # only bounded polling condition, never a failed gate retry
    # Observation only. H01's sealed historical artifact is retained outside
    # this pipeline; quiet never authorizes settlement or proves turn exit.
    c=census('quiet-census'); require(quiet_ready(age,True,meta(log)==m),'log changed during census')
    save('quiet-pass.json',{'at':now(),'ageSeconds':age,'logMetadata':m,'censusHashes':c,
                           'readOnly':True,'nonemptyCensusAllowed':True,'settlementExecuted':False})
elif op=='before-stop':
    authority(); old=read(rd/'old-process.json')
    require(identity(old['pid'])==old['identity'],'old identity changed before bootout')
    require(digest(plist)==read(rd/'plist-preimage.json')['sha256'],'plist changed before bootout')
    census('immediate-pre-bootout-census')
    doc=read(rd/'plist-preimage.json')['document']; log=P(doc['StandardErrorPath'])
    require(time.time()-log.stat().st_mtime>=180,'quiet window broken before bootout')
    workers={r['pid']:r for r in old['workers']}
    workers.update({r['pid']:r for r in old_workers(old['pid'])})
    save('old-workers-at-bootout.json',list(workers.values()))
elif op=='exit-check':
    authority()
    absent=service_absent(pending=True); table=process_table(); old=read(rd/'old-workers-at-bootout.json')
    remain=[r for r in old if r['pid'] in table] # reused PID is UNKNOWN, not proof of exit
    remain.extend(r for r in table.values() if str(live) in r['rest'])
    if remain: save('old-exit-pending.json',remain); sys.exit(10)
    for row in old:
        p=sp.run(['/bin/ps','-p',str(row['pid']),'-o','pid='],stdout=sp.PIPE,stderr=sp.PIPE,timeout=10)
        require(p.returncode==1 and not p.stdout.strip() and not p.stderr.strip(),'exact old PID absence not proven')
    for port in (8788,8790):
        p=sp.run(['/usr/sbin/lsof','-nP','-iTCP:'+str(port),'-sTCP:LISTEN','-Fp'],stdout=sp.PIPE,stderr=sp.PIPE,timeout=10)
        require(p.returncode==1 and not p.stdout and not p.stderr,'old port not released or readback unavailable')
    save('old-exit-physical.json',{'at':now(),'supervisor':absent,'oldProcesses':old,'remaining':[],
                                  'portsAbsent':[8788,8790]})
    census('post-bootout-census',require_isolation=True)
    save('old-exit.json',{'at':now(),'supervisor':absent,'oldProcesses':old,'remaining':[],
                         'portsAbsent':[8788,8790],'classificationReceipt':'post-bootout-census.json'})
elif op=='preimage':
    authority(); old=read(rd/'old-process.json')
    require(pid_from(launch())==old['pid'] and identity(old['pid'])==old['identity'],
            'old runtime must remain alive while preparing full preimage')
    before=inventory(live); save('preimage-live-inventory.json',before)
    acl=acl_listing(live); raw('preimage-acl-listing.private.txt',acl)
    target=rd/'preimage-full'; require(not target.exists(),'preimage destination exists')
    effect_guard('preimage.ditto',str(target),{'source':str(live),'flags':['--rsrc','--extattr','--acl']},internal=True)
    run(['/usr/bin/ditto','--rsrc','--extattr','--acl',live,target],timeout=3600)
    reconcile_xattrs(live,target,before[XATTRS_KEY])
    require(inventory(target)==before and inventory(live)==before,'full preimage copy differs')
    require(acl_listing(live)==acl and acl_listing(target)==acl,'preimage ACL/listing differs')
    # Full copy retains node-runtime/harness/.cache even if §1b moves BAK subtrees.
    external={}
    for rel in ('control/scheduler-watchdog','control/incident-backups'):
        p=prod/rel; require(p.is_dir() and not p.is_symlink(),'external preimage missing '+str(p))
        external[str(p)]={'root':meta(p),'entries':inventory(p),'aclListingSha256':hashlib.sha256(acl_listing(p)).hexdigest()}
        raw('external-'+p.name+'-acl.private.txt',acl_listing(p))
    save('external-preimage-metadata.json',external)
    save('rollback-preimage.json',{'at':now(),'fullTree':str(target),'fullTreeRootMetadata':meta(live),
         'plist':str(rd/'plist.preimage'),'loadedEnv':str(rd/'old-loaded-env.private.txt'),
         'externalMetadata':str(rd/'external-preimage-metadata.json'),'businessSnapshotRestoreAllowed':False,
         'preparedBeforeBootout':True})
    require(pid_from(launch())==old['pid'] and identity(old['pid'])==old['identity'],
            'old runtime changed during preimage preparation')
elif op=='preimage-recheck':
    authority(); service_absent()
    require(read(rd/'rollback-preimage.json').get('preparedBeforeBootout') is True,'pre-bootout preimage missing')
    require(inventory(live)==read(rd/'preimage-live-inventory.json'),'live preimage drift after bootout')
    require(acl_listing(live)==(rd/'preimage-acl-listing.private.txt').read_bytes(),'preimage ACL drift after bootout')
    save('private-inputs-at-install.json',private_inputs('stage-06'))
    save('preimage-recheck.json',{'at':now(),'oldRuntimeStopped':True,'inventoryUnchanged':True,
                                 'aclUnchanged':True,'fullCopyExecuted':False})
elif op=='install-start':
    authority(); service_absent()
    require(read(rd/'preimage-recheck.json').get('oldRuntimeStopped') is True,'stopped preimage recheck missing')
    require(digest(plist)==read(rd/'plist-preimage.json')['sha256'],'plist drift before install')
    require(inventory(live)==read(rd/'preimage-live-inventory.json'),'live preimage drift before install')
    census('immediate-pre-install-census',require_isolation=True)
    r=live.parent/'agent-core-install-mutation-receipt.json'
    save('install-start.json',{'at':now(),'epoch':time.time(),'previousMutationReceiptSha256':digest(r) if r.is_file() else None})
elif op=='install-failed':
    r=live.parent/'agent-core-install-mutation-receipt.json'; regular(r); doc=read(r); start=read(rd/'install-start.json')
    require(digest(r)!=start['previousMutationReceiptSha256'],'stale mutation receipt')
    require(start['epoch']-1<=stamp(doc['recorded_at'])<=time.time()+1,'mutation receipt not this run')
    require(doc['receipt']=='AGENT_CORE_INSTALL_MUTATION_RECEIPT_V1' and doc['exit_code']==int(args[0]),'mutation receipt rc/kind mismatch')
    log=(rd/'install.log').read_text(); bak=doc['preimage_bak']
    if bak: require(('== backing up previous install -> '+bak) in log and P(bak).is_dir(),'receipt preimage not this install')
    require(doc['restore_r1_required']==bool(doc['reused_preimage_subtrees']),'R1 mismatch')
    require(doc['restore_r2_required']==('prod_root_5b' in doc['stages_completed']),'R2 mismatch')
    save('failed-install-mutation-receipt.json',doc)
elif op=='install-success':
    log=(rd/'install.log').read_text(); found=re.findall(r'^== backing up previous install -> (.+)$',log,re.M)
    require(len(found)==1,'exact successful backup coordinate unavailable')
    bak=P(found[0]); require(re.fullmatch(re.escape(str(live))+r'\.bak-\d{8}-\d{6}',str(bak)) and bak.is_dir() and not bak.is_symlink(),'invalid preimage')
    marker=bak/'.preimage-reused-subtrees'; reused=marker.read_text().splitlines() if marker.exists() else []
    require(len(set(reused))==len(reused) and set(reused)<={'node-runtime','harness','.cache'},'invalid reuse marker')
    for item in reused:
        require((rd/'preimage-full'/item).is_dir() and not (bak/item).exists(),'R1 subtree evidence inconsistent')
        require("no longer contains '%s'"%item in log,'reuse marker lacks this-run log evidence')
    completed=[x for x in log.splitlines() if x.startswith('  production root: /Users/authsvc/.agent-core (505-private control state 0700;')]
    require(len(completed)==1,'§5b completion evidence missing')
    save('successful-install-rollback.json',{'at':now(),'installLogSha256':digest(rd/'install.log'),
         'preimage_bak':str(bak),'reused_preimage_subtrees':reused,'restore_r1_required':bool(reused),
         'restore_r2_required':True,'section5bCompletion':completed[0],
         'reuseMarkerSha256':digest(marker) if marker.exists() else None,'completePreimageCopy':str(rd/'preimage-full'),
         'mutationReceiptUsed':False})
elif op=='preserve-config':
    # Sequence §2/§5: carry forward the CURRENT stopped config which §5 of the
    # pinned installer only partly copies. This is a declared install step, not
    # recovery after a failed gate. Never overwrite a changed/current file and
    # never write historical jobs/bindings/incidents/runs/fences/credentials.
    authority(); service_absent(); pre=rd/'preimage-full/config'; dest=live/'config'
    expected=inventory(pre); current=inventory(dest)
    require(all(k in expected and v==expected[k] for k,v in current.items() if k!=XATTRS_KEY),
            'installer config has changed/unexpected existing entries; no overwrite allowed')
    require(all(current[XATTRS_KEY].get(k)==expected[XATTRS_KEY].get(k)
                for k in current if k!=XATTRS_KEY),
            'installer config has changed existing xattrs; no overwrite allowed')
    for required in ('agents.json','agent-credentials.json'):
        require(required in current and current[required]==expected[required],'current authority/credentials not preserved by installer')
    carried=[]
    for k in sorted(expected,key=lambda k:(len(P(k).parts),k)):
        if k in ('.',XATTRS_KEY) or k in current: continue
        src=pre/k; dst=dest/k
        if dst.exists() or dst.is_symlink(): continue # copied with its ancestor
        require(not src.is_symlink(),'omitted config symlink needs explicit review: '+k)
        require(not dst.exists() and not dst.is_symlink(),'config destination appeared')
        effect_guard('config.ditto',str(dst),{'source':str(src),'flags':['--rsrc','--extattr','--acl']},internal=True)
        run(['/usr/bin/ditto','--rsrc','--extattr','--acl',src,dst],timeout=3600)
        carried.append(k)
    require(inventory(dest)==expected,'carried config does not match stopped preimage')
    require(acl_listing(dest)==acl_listing(pre),'carried config ACL differs')
    save('config-carryforward.json',{'at':now(),'from':str(pre),'to':str(dest),'copiedMissingOnly':carried,
         'existingFilesOverwritten':False,'historicalPrepSnapshotsUsed':False,'exactContentMetadataReadback':True})
elif op=='final-binding':
    authority(); service_absent(); accepted=read(rd/'accepted-closure.json')
    actual={}; changes=[]
    accepted_acl=read(rd/'accepted-closure-acl.json')
    for part in ('app','harness','node-runtime'):
        actual[part]=inventory(live/part)
        final_acl=json.loads(acl_listing(live/part))
        save('final-'+part+'-acl.json',final_acl)
        if final_acl!=accepted_acl[part]: changes.append(part+'/<ACL>')
        for k in sorted(set(accepted[part])|set(actual[part])):
            x=accepted[part].get(k); y=actual[part].get(k)
            # UID/GID differ for isolated execution; production custody is checked below.
            strip=lambda v: {a:b for a,b in v.items() if a not in ('uid','gid')} if v else None
            if k==XATTRS_KEY:
                if x!=y: changes.append(part+'/'+k)
                continue
            if strip(x)!=strip(y): changes.append(part+'/'+k)
        a=authority()
        for k,v in actual[part].items():
            if k==XATTRS_KEY: continue
            if v['kind']!='link': require(v['uid']==a['expected_runtime_uid'] and v['gid']==a['expected_runtime_gid']
                                        and int(v['mode'],8)&0o022==0,'unsafe final closure custody '+part+'/'+k)
    save('final-closure.json',actual); save('final-closure-comparison.json',{'changed':changes,'sameContentLinksModes':not changes})
    require(not changes,'final closure differs: supplement SAME-final-tree isolated canary + full runtime receipts before bootstrap; STOP')
    provenance=read(live/'app/pack-provenance.json')
    require(provenance['source_head_sha']==sha and provenance['source_tree_sha']==tree and provenance['source_clean']=='yes'
            and provenance['generation_label_sha']==sha and provenance['main_repo_realpath']==str(source),'final provenance mismatch')
    save('private-inputs-final.json',private_inputs('stage-09'))
    config=inventory(live/'config'); save('final-config-inventory.private.json',config)
    require(config==inventory(rd/'preimage-full/config'),'final config bytes/links/permissions differ from current window preimage; STOP')
    save('final-binding.json',{'at':now(),'dualReceiptBinding':'UNCHANGED_COMPLETE_CLOSURE','config':'PRODUCTION_PREIMAGE_PRESERVED',
         'isolatedConfigOverridesCopied':False,'productionUid':a['expected_runtime_uid'],'provenance':provenance})
elif op=='plist-update':
    authority(); service_absent(); old=read(rd/'plist-preimage.json')
    require(digest(plist)==old['sha256'],'plist changed before authorized SHA-only edit')
    doc=plistlib.loads(plist.read_bytes()); doc['EnvironmentVariables']['AGENT_CORE_DEPLOYED_SHA']=sha
    tmp=plist.with_name(plist.name+'.v5-'+authority()['window_id'])
    data=plistlib.dumps(doc,sort_keys=False)
    effect_guard('plist.create',str(tmp),{'flags':'xb'})
    with open(tmp,'xb',buffering=0) as f:
        effect_guard('plist.write',str(tmp),{'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
        require(f.write(data)==len(data),'incomplete plist write; no retry')
    m=old['metadata']
    effect_guard('plist.chown',str(tmp),{'uid':m['uid'],'gid':m['gid']})
    os.chown(tmp,m['uid'],m['gid'])
    effect_guard('plist.chmod',str(tmp),{'mode':int(m['mode'],8)})
    os.chmod(tmp,int(m['mode'],8))
    run(['/usr/bin/plutil','-lint',tmp])
    effect_guard('plist.replace',str(plist),{'source':str(tmp)})
    os.replace(tmp,plist)
    back=plistlib.loads(plist.read_bytes()); expected=old['document']; expected['EnvironmentVariables']['AGENT_CORE_DEPLOYED_SHA']=sha
    require(back==expected,'plist delta exceeds deployed SHA')
    save('plist-after.json',{'sha256':digest(plist),'document':back,'metadata':meta(plist)})
    offsets=[]
    for key in ('StandardOutPath','StandardErrorPath'):
        p=P(back[key]); regular(p); offsets.append(dict(meta(p),path=str(p)))
    save('restart-log-offsets.json',offsets); save('bootstrap-start.json',{'at':now(),'epoch':time.time()})
elif op=='verify':
    a=authority(); doc=read(rd/'plist-after.json')['document']; text=launch()
    launch_binding(text,doc); pid=pid_from(text)
    require(pid!=a['expected_old_pid'],'new PID equals old PID')
    ident=identity(pid); require(int(ident.split()[1])==a['expected_runtime_uid'] and int(ident.split()[2])==a['expected_runtime_gid'],'new UID/GID mismatch')
    require(ident.endswith(str(live/'node-runtime/bin/node')),'new program mismatch')
    prior=read(rd/'new-process.json') if (rd/'new-process.json').exists() else None
    require(prior is None or prior['identity']==ident,'runtime restarted during acceptance window')
    env=doc['EnvironmentVariables']; loaded_env(pid,env,'new-loaded-env.private.txt')
    ports=[int(env.get('PRODUCT_API_PORT','8787')),int(env.get('NOTIFICATION_INGRESS_PORT','8790'))]
    require(ports==[8788,8790],'unexpected production ports; scratch ports must never leak')
    owned=listeners(pid,ports); log=log_delta()
    patterns=[r'50 http capabilities ready, 19 local capabilities ready',
              r'product-api.*listening.*(?:127\.0\.0\.1:)?8788',
              r'notification-ingress.*8790.*deliverReady=true.*storeReady=true',
              r'production runtime ready \(pid '+str(pid)+r'\); scheduler loop online']
    for pattern in patterns: require(re.search(pattern,log),'missing production readiness marker '+pattern)
    require(not re.search(r'\bFATAL\b|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|plugin-tree.*fail',log,re.I),'runtime fatal/closure failure')
    product=health(ports[0],'agent-core-product-api'); ingress=health(ports[1],'agent-core-notification-ingress')
    require(ingress.get('deliverReady') is True and ingress.get('storeReady') is True,'ingress not ready')
    # /scheduler/health requires scoped bearer credentials. The public /health
    # is not canonical census evidence. Isolated canonical PASS is bound in §3;
    # live authenticated checks require a separately specified request/result.
    require(pid_from(launch())==pid and identity(pid)==ident,'new instance changed during verification')
    save('new-process.json',{'at':now(),'pid':pid,'identity':ident,'listeners':owned})
    save('production-health.json',{'at':now(),'product':product,'ingress':ingress,'authentication':'NOT_TESTED',
                                  'liveAuthenticatedCanonicalHealth':'UNKNOWN'})
    raw('new-launchctl.txt',text.encode())
elif op=='hr-check':
    authority(); p=read(rd/'new-process.json'); require(identity(p['pid'])==p['identity'],'new runtime changed during HR watch')
    require(pid_from(launch())==p['pid'],'supervised PID changed during HR watch')
    log=log_delta(); require(not re.search(r'\bFATAL\b|ERR_MODULE_NOT_FOUND',log),'fatal during HR watch')
    lines=[x for x in log.splitlines() if re.search(r'\[router\] \[broker\] execute as agent agt_hr-agent \(capability [^)]+\)',x)]
    watch=read(rd/'hr-watch.json'); observed=time.monotonic()
    previous=read(rd/'hr-observation.json') if (rd/'hr-observation.json').exists() else {}
    within=bool(lines) and observed<=watch['deadlineMonotonic']
    recovered=previous.get('brokerExecuteRecovered') is True or within
    save('hr-observation.json',{'at':now(),'pid':p['pid'],'matchingLines':lines,
                               'brokerExecuteRecovered':recovered,'within600Seconds':recovered,
                               'businessSuccess':'UNKNOWN','criterion':'fa4510be broker execute feature; not log mtime'})
    if args and args[0]=='final': require(recovered,'no HR broker execute observed within 10 minute window')
elif op=='hr-start':
    start=time.monotonic()
    save('hr-watch.json',{'at':now(),'startedMonotonic':start,'deadlineMonotonic':start+600})
elif op=='hr-remaining':
    print(max(0,math.ceil(read(rd/'hr-watch.json')['deadlineMonotonic']-time.monotonic())))
elif op=='rollback-summary':
    for name in ('successful-install-rollback.json','failed-install-mutation-receipt.json','rollback-preimage.json'):
        if (rd/name).is_file():
            doc=read(rd/name)
            print(name+': '+json.dumps({k:v for k,v in doc.items() if k in (
                'preimage_bak','reused_preimage_subtrees','restore_r1_required','restore_r2_required',
                'mutation_truth','completePreimageCopy','fullTree','plist','externalMetadata')},ensure_ascii=False))
elif op=='phase':
    event={'at':now(),'stage':args[0],'status':args[1],'detail':args[2:]}
    save(args[0]+'.json',event)
    with open(rd/'phase-events.jsonl','a') as f: f.write(json.dumps(event)+'\n')
elif op=='close':
    a=authority()
    effect_guard('window.close',str(rd))
    verified=read(rd/'stage_11_production_verify.json')
    require(verified['status']=='PASS','production verification did not PASS; no close plan')
    result=close_window(a,read(rd/'c7-names-before.json'),live,verified['at'])
    save('c7-close.json',result)
    raw('c7-delete-candidates.nul',b''.join(os.fsencode(r['path'])+b'\0' for r in result['retention']['delete_candidates']))
    save('c7-delete-candidates.json',result['retention']['delete_candidates'])
elif op=='release':
    a=authority(); closed=read(rd/'c7-close.json')
    require(closed['window_id']==a['window_id'] and closed['names']['mapped_diff_empty'] is True,
            'safe close evidence missing; retain mutex')
    require(read(rd/'stage_11_production_verify.json')['status']=='PASS' and
            read(rd/'stage_12_hr_watch.json')['status']=='PASS','successful terminal stages missing; retain mutex')
    require(digest(lock/'holder')==read(rd/'mutex.json')['sha256'],'cannot release changed mutex')
    effect_guard('mutex.release',str(lock),{'closeSha256':digest(rd/'c7-close.json')})
    effect_guard('mutex.holder.unlink',str(lock/'holder'))
    (lock/'holder').unlink()
    effect_guard('mutex.rmdir',str(lock))
    lock.rmdir()
    save('completion.json',{'at':now(),'window':'PASS_CONFIGURED_CHECKS','productionExecution':'EXECUTED',
                           'authentication':'NOT_TESTED','businessSuccess':'UNKNOWN','hrCriterion':'broker execute observed',
                           'c7ReceiptSha256':digest(rd/'c7-close.json'),'retentionDeletion':'NOT_EXECUTED_LIST_ONLY'})
else: raise RuntimeError('unknown helper operation '+op)
