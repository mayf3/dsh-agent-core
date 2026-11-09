import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const here = dirname(fileURLToPath(import.meta.url))
const executor = resolve(here, '../window-executor-v5.sh')
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex')

test('bootstrap failure stops downstream and preserves current business state', () => {
  const directory = mkdtempSync('/usr/local/v5-boot-isolation/anarrowed-rollback-')
  const actions = join(directory, 'actions.txt')
  const business = join(directory, 'current-business.json')
  writeFileSync(business, JSON.stringify({ version: 3, unknown: 'MUST_PRESERVE_CURRENT' }), { mode: 0o600 })
  const before = hash(business)
  const shell = `source "$1"
ACTIONS="$2"
helper() { printf 'helper %s\\n' "$*" >> "$ACTIONS"; }
sudo() { printf 'sudo %s\\n' "$*" >> "$ACTIONS"; return 19; }
sleep() { printf 'unexpected sleep\\n' >> "$ACTIONS"; }
STAGE=stage_10_plist_bootstrap
INSTALL_STATE=succeeded
STOP_STATE=proved
trap 'rollback_recipe; exit 19' ERR
stage_10_plist_bootstrap
printf 'DOWNSTREAM_EXECUTED\\n' >> "$ACTIONS"
`
  const child = spawnSync('/bin/bash', ['-c', shell, 'isolated-bootstrap-failure', executor, actions],
    { encoding: 'utf8', timeout: 10_000 })
  assert.equal(child.error, undefined)
  assert.equal(child.status, 19)
  assert.match(child.stdout, /STOP stage=stage_10_plist_bootstrap/)
  assert.match(child.stdout, /No automatic recovery/)
  assert.match(child.stdout, /Never strip fields, downgrade, or overwrite current business/)
  assert.match(child.stdout, /--rollback-check --candidate-root \/VERIFIED\/OLD\/CLOSURE/)
  assert.match(child.stdout, /V3-aware forward fix only/)
  const attempted = readFileSync(actions, 'utf8').trim().split('\n')
  assert.equal(attempted.length, 2)
  assert.equal(attempted[0], 'helper root plist-update')
  assert.match(attempted[1], /^sudo -n \/bin\/launchctl bootstrap system /)
  assert.equal(hash(business), before)
  console.log(JSON.stringify({ scenario: 'bootstrap-failure-fallback', status: 'PASS', directory,
    attempted, currentBusinessSha256: before, automaticRollback: false, productionExecution: 'NONE' }))
})
