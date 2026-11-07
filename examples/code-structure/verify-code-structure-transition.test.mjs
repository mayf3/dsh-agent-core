import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, commit, verifierPath } from './verify-code-structure-test-support.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const authority = 'docs/specs/CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.md';
const installer = 'scripts/trusted-cp-deploy-install.sh';
const oldBlob = 'ef5053201e6af88b1edbcdfc33e845f872183b2b';
const newBlob = '356899a8ec0726f245790379429f97dfc6ea3bfb';
const exceptionId = 'STRUCTURE_TRANSITION_EXCEPTION_V1';
const v3 = 'CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1';
const v2 = 'CODE_STRUCTURE_GUARDRAILS_V2';

function git(work, args, input) {
  return execFileSync('git', args, { cwd: work, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, input });
}

function hashObject(work, text) { return git(work, ['hash-object', '--stdin', '-t', 'blob'], text).trim(); }

// Fresh-checkout safe: the checked-out installer at base IS the old blob content.
// Construct the new content by applying the exact one-line whitelist delta, then
// verify both constructed contents hash to the pinned SHAs via git hash-object
// (computed locally; no historical Git objects are required).
const whitelistOldLine = 'APP_SCRIPTS_WHITELIST="agent-core-resident.mjs demo-home.mjs agentcore-cron.mjs dsh-agent-spawn-helper.c trusted-cp-deploy-install.sh agent-core-backup-ops.sh trusted-cp-hardening-v1-verify.mjs production-runtime.mjs production-runtime-launchd.mjs production-runtime-v1-verify.mjs production-agent-provision.mjs"';
const whitelistNewLine = whitelistOldLine.replace('agentcore-cron.mjs ', 'agentcore-cron.mjs scheduler-watchdog.mjs ');

function checkoutOldInstaller(work) {
  const text = readFileSync(path.join(work, installer), 'utf8');
  assert.equal(hashObject(work, text), oldBlob, 'checked-out installer must hash exactly to the pinned old blob');
  return text;
}

function constructNewInstaller(work, oldText) {
  assert.ok(oldText.includes(whitelistOldLine), 'old installer must contain the pinned whitelist line');
  const text = oldText.replace(whitelistOldLine, whitelistNewLine);
  assert.equal(hashObject(work, text), newBlob, 'constructed installer must hash exactly to the pinned new blob');
  return text;
}
function head(work) { return git(work, ['rev-parse', 'HEAD']).trim(); }
function writeInstaller(work, text) { writeFileSync(path.join(work, installer), text); }

function prepare(t, state = 'accepted', baseMutation = (text) => text) {
  const work = fixture(t);
  git(work, ['sparse-checkout', 'add', 'scripts', 'packages/agent-credential-provisioning/test']);
  mkdirSync(path.join(work, 'examples/code-structure'), { recursive: true });
  if (state !== 'absent') {
    // Bind the pre-retirement proposal fixture to its immutable source, rather
    // than mistaking the current superseded document for a proposed authority.
    const proposed = execFileSync('git', ['show', `2373cec4db09daa2ddf005bae2f8918f3b5c0a24:${authority}`],
      { cwd: repository, encoding: 'utf8' });
    assert.match(proposed, /^status: proposed$/m, 'historical source must be proposed');
    writeFileSync(path.join(work, authority), state === 'accepted'
      ? proposed.replace(/^status: proposed$/m, 'status: accepted') : proposed);
  } else writeFileSync(path.join(work, 'docs/structure-transition-fixture.txt'), 'absent transition authority fixture\n');
  const oldText = checkoutOldInstaller(work);
  const newText = constructNewInstaller(work, oldText);
  writeInstaller(work, baseMutation(oldText));
  commit(work, `offline transition fixture: ${state} authority and old installer`);
  return { work, base: head(work), oldText, newText };
}

function run(work, base, json = true) {
  const result = spawnSync(process.execPath,
    [verifierPath, '--base', base, '--head', 'HEAD', ...(json ? ['--json'] : [])],
    { cwd: work, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return { ...result, report: result.stdout && json ? JSON.parse(result.stdout) : null };
}

function applyTransition(work, mutation = (text) => text, texts = null) {
  const newText = texts ? texts.newText : constructNewInstaller(work, checkoutOldInstaller(work));
  writeInstaller(work, mutation(newText));
  commit(work, 'offline exact whitelist transition');
}

function assertViolation(result, target = installer, rule = null) {
  assert.equal(result.status, 1, result.stderr || result.stdout);
  assert.equal(result.report.candidate_result, 'CANDIDATE_DELTA_FAIL');
  assert.ok(result.report.findings.some((item) => item.path === target
    && item.severity === 'VIOLATION' && (!rule || item.rule === rule)), JSON.stringify(result.report.findings));
}

test('exact accepted tuple passes only the candidate delta and preserves installer debt', (t) => {
  const { work, base, oldText, newText } = prepare(t);
  const registryBefore = git(work, ['show', `${base}:.agents/structure-registry.json`]);
  applyTransition(work, undefined, { oldText, newText });
  const result = run(work, base);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.report.rules_version, v3);
  assert.equal(result.report.base_oid, base);
  assert.equal(result.report.head_oid, head(work));
  assert.equal(result.report.candidate_result, 'CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT');
  const applied = result.report.transition_exceptions.find((entry) => entry.id === exceptionId);
  assert.ok(applied, JSON.stringify(result.report.transition_exceptions));
  assert.equal(applied.path, installer);
  const debt = result.report.baseline_debt.find((item) => item.path === installer);
  assert.ok(debt, 'the 1315-line installer must remain visible historical debt');
  assert.equal(debt.physicalLines, 1315);
  assert.equal(debt.transition_exception, exceptionId);
  assert.ok(!result.report.resolved_debt.some((item) => item.path === installer));
  assert.equal(git(work, ['show', 'HEAD:.agents/structure-registry.json']), registryBefore);
  assert.equal(git(work, ['rev-parse', `${base}:${installer}`]).trim(), oldBlob);
  assert.equal(git(work, ['rev-parse', `HEAD:${installer}`]).trim(), newBlob);
  assert.equal(git(work, ['diff', '--numstat', base, 'HEAD', '--', installer]).trim(), `1\t1\t${installer}`);
  const text = run(work, base, false);
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /BASELINE_DEBT/);
  assert.match(text.stdout, /STRUCTURE_TRANSITION_EXCEPTION_V1/);
});

test('a changed base blob invalidates the exception even when the exact head blob matches', (t) => {
  const { work, base, newText } = prepare(t, 'accepted', (text) => text.replace('APP_SCRIPTS_WHITELIST=', 'APP_SCRIPTS_WHITELIST ='));
  writeInstaller(work, newText);
  commit(work, 'apply exact whitelist transition on top of a mutated base');
  assertViolation(run(work, base), installer, 'TRANSITION_EXCEPTION_MISMATCH');
});

for (const [label, mutation] of [
  ['a same-line head modification', (text) => text.replace('scheduler-watchdog.mjs', 'scheduler-watchdog-other.mjs')],
  ['an extra line in the head', (text) => `${text}\n`],
  ['a no-growth edit elsewhere in the head', (text) => text.replace('PACKAGE_COPY_HELPER=', 'PACKAGE_COPY_HELPER =')],
]) {
  test(`${label} fails rather than refreshing the blob registration`, (t) => {
    const { work, base, oldText, newText } = prepare(t);
    applyTransition(work, mutation);
    assertViolation(run(work, base), installer, 'TRANSITION_EXCEPTION_MISMATCH');
  });
}

test('mode change invalidates the exception despite an exact content pair', (t) => {
  const { work, base, newText } = prepare(t);
  writeInstaller(work, newText);
  chmodSync(path.join(work, installer), 0o755);
  git(work, ['update-index', '--chmod=+x', installer]);
  commit(work, 'change installer content and executable mode');
  assertViolation(run(work, base), installer, 'TRANSITION_EXCEPTION_MISMATCH');
});

for (const state of ['absent', 'proposed']) {
  test(`${state} transition authority retains V2 behavior for the exact content pair`, (t) => {
    const prepared = prepare(t, state);
    const { work, base } = prepared;
    applyTransition(work, undefined, { oldText: prepared.oldText, newText: prepared.newText });
    const result = run(work, base);
    assertViolation(result);
    assert.equal(result.report.rules_version, v2);
    assert.equal(result.report.findings.some((item) => item.rule === 'TRANSITION_EXCEPTION_MISMATCH'), false);
    assert.equal(result.report.transition_exceptions?.length ?? 0, 0);
  });
}

test('an unrelated oversized file still fails while the exact transition matches', (t) => {
  const { work, base, newText } = prepare(t);
  writeInstaller(work, newText);
  writeFileSync(path.join(work, 'examples/code-structure/transition-over-limit.js'), '// oversized handwritten code\n'.repeat(501));
  commit(work, 'exact transition with an unrelated oversized file');
  const result = run(work, base);
  assertViolation(result, 'examples/code-structure/transition-over-limit.js', 'NEW_FILE_OVER_500');
  assert.ok(result.report.baseline_debt.some((item) => item.path === installer && item.transition_exception === exceptionId));
});

test('unrelated affected invalid-cap debt remains a hard violation', (t) => {
  const { work, base, newText } = prepare(t);
  writeInstaller(work, newText);
  const other = 'packages/agent-credential-provisioning/test/provisioning.test.js';
  appendFileSync(path.join(work, other), '\n// affected historical debt\n');
  commit(work, 'exact transition with separate affected debt');
  assertViolation(run(work, base), other, 'INVALID_FILE_EXCEPTION_AUTHORITY');
});

for (const mutation of ['edit', 'remove']) {
  test(`${mutation} of an accepted transition registry fails closed`, (t) => {
    const { work, base, newText } = prepare(t);
    writeInstaller(work, newText);
    if (mutation === 'remove') rmSync(path.join(work, authority));
    else appendFileSync(path.join(work, authority), '\nChanged authority fixture.\n');
    commit(work, `${mutation} accepted transition authority in candidate`);
    const result = run(work, base);
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.match(result.stderr, /transition|authority|registry/i);
  });
}

test('the transition cannot authorize a later edit once the new blob is the comparison base', (t) => {
  const { work, oldText, newText } = prepare(t);
  applyTransition(work, undefined, { oldText, newText });
  const afterTransition = head(work);
  appendFileSync(path.join(work, installer), '\n');
  commit(work, 'attempt later growth after one transition');
  assertViolation(run(work, afterTransition), installer, 'TRANSITION_EXCEPTION_MISMATCH');
});

test('the exact blob pair on another path cannot borrow the installer exception', (t) => {
  const { work, oldText, newText } = prepare(t);
  const other = 'examples/code-structure/transition-alias.sh';
  writeFileSync(path.join(work, other), oldText);
  commit(work, 'add over-limit old content on a different path as inherited debt');
  const base = head(work);
  writeFileSync(path.join(work, other), newText);
  commit(work, 'apply exact blob pair on a different path');
  const result = run(work, base);
  assertViolation(result, other);
  assert.equal(result.report.transition_exceptions?.length ?? 0, 0);
});
