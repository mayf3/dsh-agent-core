import test from 'node:test'
import assert from 'node:assert/strict'
import processAPI from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  processAPI[name] = () => { throw new Error('PROCESS_DISPATCH_DENIED') }
}
syncBuiltinESMExports()
const staging = await import('../../src/native-arm64/stage.js')
const root = '/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/coherent-v5-model-override-compat-prep-20260926-v1/deployable-tree'
const repo = new URL('../../../../', import.meta.url)
const startup = 'packages/agent-router/src/reconciliation/startup-recovery.js'
function inputs() {
  const base = Object.fromEntries(staging.POST_COHERENT_HR_INPUT_PATHS.map(path => [path, readFileSync(join(root, path))]))
  const accepted = Object.fromEntries([startup, ...staging.POST_COHERENT_HR_LEAF_PATHS].map(path => [path, readFileSync(new URL(path, repo))]))
  return { base, accepted }
}
function output(t) {
  const {base, accepted} = inputs()
  const replacements = staging.composeHrPostCoherentSource(base, accepted)
  const dir = mkdtempSync(join(tmpdir(), 'hr542-'))
  t.after(() => rmSync(dir, {recursive: true, force: true}))
  const put = (path, bytes) => { mkdirSync(dirname(join(dir, path)), {recursive:true}); writeFileSync(join(dir, path), bytes) }
  put('package.json', '{"type":"module"}')
  for (const name of ['authority-capacity', 'capacity', 'durable-file', 'index', 'ingress-correlation', 'query', 'startup-recovery', 'state-machine', 'store']) {
    const path = `packages/agent-router/src/reconciliation/${name}.js`
    put(path, replacements[path] ?? readFileSync(join(root,path)))
  }
  for (const path of staging.POST_COHERENT_HR_LEAF_PATHS) put(path, replacements[path])
  return {dir, replacements, base}
}
test('exact542 finite stage preserves V5 ingress and all old recovery bytes', t => {
  const {replacements,base} = output(t)
  const router = replacements['packages/agent-router/src/index.js'].toString()
  const addedImport = "\nimport { getFixedStartupContext, signalFixedStartupConsumptionFinished, publishFixedRuntimeAdmission } from '../../production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs'"
  const addedJoin = '  const fixedStartup = getFixedStartupContext()\n  if (fixedStartup !== undefined) {\n    reconciliationStore.consumeStartupQuiescence(fixedStartup)\n    signalFixedStartupConsumptionFinished()\n  }\n\n'
  assert.equal(router.replace(addedImport,'').replace(addedJoin,'').replace("  publishFixedRuntimeAdmission(service)\n",''), base['packages/agent-router/src/index.js'].toString())
  const original = base[startup].toString().split('  restoreCrashInterruptedRecords()')[1]
  assert.equal(replacements[startup].toString().split('  restoreCrashInterruptedRecords()')[1], original)
  const durable = replacements['packages/agent-router/src/reconciliation/durable-file.js'].toString()
  assert.equal(durable.replace(", 'restart_quiescence_proven'",''),base['packages/agent-router/src/reconciliation/durable-file.js'].toString())
  assert.match(durable,/validatedIngressCorrelation/)
  assert.equal(Object.keys(replacements).length,12)
})
test('missing, changed, unknown base and changed accepted proof reject', () => {
  for (const kind of ['missing','changed','unknown','proof']) {
    const {base,accepted}=inputs()
    if(kind==='missing') delete base[startup]
    if(kind==='changed') base[startup]=Buffer.concat([base[startup],Buffer.from('// drift')])
    if(kind==='unknown') base['/caller/path']=Buffer.from('x')
    if(kind==='proof') accepted[staging.POST_COHERENT_HR_LEAF_PATHS[0]]=Buffer.from('unknown')
    assert.throws(()=>staging.composeHrPostCoherentSource(base,accepted),/HR_ROUTER_BASE_UNKNOWN/)
  }
})
test('actual staged reconciliation dependency closure imports and settles once', async t => {
  const {dir}=output(t)
  const {TurnReconciliationStore}=await import(pathToFileURL(join(dir,'packages/agent-router/src/reconciliation/store.js')))
  const {proofFixture,json}=await import('../../../agent-router/test/helpers/restart-quiescence-fixture.js')
  const fx=proofFixture(cleanup=>t.after(cleanup))
  const store=new TurnReconciliationStore({persistenceFile:fx.persistenceFile,runtimeEpoch:'staged542'})
  fx.bundle.recoveryCutover.subjectPreimageSha256=createHash('sha256').update(JSON.stringify(store.records.get(fx.handle))).digest('hex')
  writeFileSync(fx.bundleFile,json(fx.bundle))
  let emits=0
  store.onTurnReconciled(()=>emits++)
  const result=store.consumeStartupQuiescence(fx)
  assert.equal(result[0].status,'settled',JSON.stringify(result))
  assert.equal(store.getTurnReconciliation(fx.handle).snapshot.terminationEvidence,'restart_quiescence_proven')
  assert.equal(emits,1)
  const reopened=new TurnReconciliationStore({persistenceFile:fx.persistenceFile,runtimeEpoch:'second542'})
  assert.equal(reopened.getTurnReconciliation(fx.handle).snapshot.terminationEvidence,'restart_quiescence_proven')
  assert.equal(reopened.getTurnReconciliation(fx.handle).snapshot.ingressCorrelation,null)
})
// Process APIs remain hard-denied through all teardown; no original forwarding.

test('actual fixed stage uses only command cells and preserves every unrelated542 file', t => {
  const dir=mkdtempSync(join(tmpdir(),'hr542-stage-'))
  t.after(()=>rmSync(dir,{recursive:true,force:true}))
  const cells=[]
  const evidence=JSON.parse(readFileSync('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/coherent-v5-compat-factual-binding-20260926-v1/E5_RUNTIME_READBACK.json'))
  const candidateRoot=new URL('../../../../',import.meta.url).pathname.replace(/\/$/,'')
  const candidateSHA='bd47e8def7a06d4767a1e7eb82619a8b1bf843d9'
  const deny=processAPI.execFileSync
  processAPI.execFileSync=(command,args)=>{
    assert.equal(command,'/usr/bin/git')
    assert.equal(args[0],'-C')
    cells.push(args)
    const where=args[1],op=args.slice(2).join(' ')
    if(where===root && op==='ls-files -co --exclude-standard -z') return evidence.source_files_exact.map(x=>x.path).join('\0')+'\0'
    if(where===root && op==='rev-parse HEAD') return 'post-coherent-static-input\n'
    if(where===root && op==='status --porcelain') return ''
    if(where===candidateRoot && op===`rev-parse ${candidateSHA}^{commit}`) return candidateSHA+'\n'
    if(where===candidateRoot && args[2]==='show' && args[3].startsWith(candidateSHA+':')) {
      const path=args[3].slice(candidateSHA.length+1)
      assert.ok([...staging.ARM_SOURCE_DELTA,staging.HR_GATED_ENTRY,
        'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py',
        'packages/production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs',startup,
        ...staging.POST_COHERENT_HR_LEAF_PATHS].includes(path))
      return readFileSync(new URL(path,repo))
    }
    throw new Error('UNKNOWN_COMMAND_CELL')
  }
  syncBuiltinESMExports()
  t.after(()=>{processAPI.execFileSync=deny;syncBuiltinESMExports()})
  const xml='<plist><dict><key>Label</key><string>ai.agent-core.runtime</string><key>ProgramArguments</key><array><string>/fixed/node</string><string>/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs</string></array><key>KeepAlive</key><true/></dict></plist>'
  const result=staging.stageHrOneShotApplication({liveRoot:root,candidateRoot,candidateSHA,
    stageRoot:join(dir,'stage'),guiPlist:xml,systemPlist:xml})
  const changed=new Set([...staging.POST_COHERENT_HR_INPUT_PATHS,...staging.POST_COHERENT_HR_LEAF_PATHS,
    ...staging.ARM_SOURCE_DELTA,staging.HR_GATED_ENTRY,
    'packages/production-runtime/src/native-arm64/hr-s256-r2-child-proof.py',
    'packages/production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs'])
  for(const item of evidence.source_files_exact) {
    if(!changed.has(item.path)) assert.deepEqual(readFileSync(join(result.stageRoot,item.path)),readFileSync(join(root,item.path)),item.path)
  }
  for (const path of [...staging.POST_COHERENT_HR_INPUT_PATHS, ...staging.POST_COHERENT_HR_LEAF_PATHS,
    staging.HR_GATED_ENTRY, 'packages/production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs']) {
    const text=readFileSync(join(result.stageRoot,path),'utf8')
    for (const match of text.matchAll(/(?:from\s+|import\s*\(?\s*)(['"])(\.[^'"]+)\1/g)) {
      assert.ok(existsSync(new URL(match[2],pathToFileURL(join(result.stageRoot,path)))),`${path} => ${match[2]}`)
    }
  }
  assert.ok(cells.length>0)
  assert.match(readFileSync(join(result.stageRoot,startup),'utf8'),/consumeStartupQuiescence/)
  assert.ok(existsSync(join(result.stageRoot,staging.POST_COHERENT_HR_LEAF_PATHS[0])))
  for(const raw of Object.values(result.routes)) assert.equal(raw.replace('/packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs','/scripts/production-runtime.mjs'),xml)
})
