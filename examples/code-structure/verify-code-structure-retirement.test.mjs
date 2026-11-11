import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fixture, commit, verifierPath } from './verify-code-structure-test-support.mjs';

const main = '4f7df01bcf087075c114901a96a7a54573110f61';
const reviewed = '7f36750bf08d308cd7f648153e24c0b0e528e4c6';
const v3 = '.agents/local/CODE_STRUCTURE_GUARDRAILS_V3.md';
const v2 = '.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md';
const te = 'docs/specs/CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.md';
const registry = '.agents/structure-registry.json';
const installer = 'scripts/trusted-cp-deploy-install.sh';

function git(work, ...args) {
  return execFileSync('git', args, { cwd: work, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trimEnd();
}
function source(work, file) { return readFileSync(path.join(work, file), 'utf8'); }
function write(work, file, text) {
  mkdirSync(path.dirname(path.join(work, file)), { recursive: true });
  writeFileSync(path.join(work, file), text);
}
function run(work, base, head = 'HEAD', name = null, json = true) {
  const args = [verifierPath, '--base', base, '--head', head, ...(json ? ['--json'] : [])];
  const result = spawnSync(process.execPath, args, { cwd: work, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const dir = process.env.VERIFIER_ADAPT_EVIDENCE_DIR;
  if (dir && name) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${name}.stdout`), result.stdout);
    writeFileSync(path.join(dir, `${name}.stderr`), result.stderr);
    writeFileSync(path.join(dir, `${name}.command.json`), JSON.stringify({
      argv: [process.execPath, ...args], cwd: work, observed_at: new Date().toISOString(),
      base_oid: git(work, 'rev-parse', base), head_oid: git(work, 'rev-parse', head),
      exit_code: result.status, signal: result.signal, error: result.error?.message ?? null,
      fixture: 'isolated offline clone; no Owner acceptance or production effect',
    }, null, 2) + '\n');
  }
  return result;
}
function report(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
function red(result, status, pattern) {
  assert.equal(result.status, status, result.stderr || result.stdout);
  assert.match(result.stderr || result.stdout, pattern);
}

test('new main recognizes V3 and preserves all 28 debt identities and registry bytes', (t) => {
  const work = fixture(t, main);
  const before = report(run(work, main, main, 'main-self'));
  write(work, 'README.md', source(work, 'README.md') + '\nOffline unrelated change.\n');
  commit(work, 'offline unrelated increment on retired lifecycle');
  const after = report(run(work, main, 'HEAD', 'main-clean-increment'));
  assert.equal(after.governing_authority.id, 'CODE_STRUCTURE_GUARDRAILS_V3');
  assert.equal(after.governing_authority.path, v3);
  assert.equal(after.governing_authority.lifecycle, 'accepted');
  assert.equal(after.rules_version, 'CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1');
  assert.equal(after.candidate_result, 'CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT');
  assert.equal(after.baseline_debt.length, 28);
  assert.deepEqual(after.baseline_debt, before.baseline_debt);
  assert.deepEqual(after.resolved_debt, []);
  assert.equal(git(work, 'show', `HEAD:${registry}`), git(work, 'show', `${main}:${registry}`));
  const text = run(work, main, 'HEAD', 'main-text', false);
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /governing authority: CODE_STRUCTURE_GUARDRAILS_V3/);
  assert.match(text.stdout, /baseline debt: 28/);
});

test('malformed, forged and contradictory lifecycle chains fail closed at both coordinates', (t) => {
  const work = fixture(t, main);
  const originals = new Map([v2, te, v3].map((file) => [file, source(work, file)]));
  const cases = [
    ['v2-backlink', v2, 'SUPERSEDED_BY = CODE_STRUCTURE_GUARDRAILS_V3', 'SUPERSEDED_BY = UNRELATED', /backlink/],
    ['te-backlink', te, 'superseded_by: CODE_STRUCTURE_GUARDRAILS_V3', 'superseded_by: null', /backlink/],
    ['v2-still-accepted', v2, 'LIFECYCLE = SUPERSEDED', 'LIFECYCLE = ACCEPTED', /retirement/],
    ['te-still-accepted', te, 'status: superseded', 'status: accepted', /retirement/],
    ['v3-proposed', v3, 'status: accepted', 'status: proposed', /not accepted/],
    ['forged-actor', v3, 'accepted_by: mayf3', 'accepted_by: worker', /accepted_by/],
    ['forged-review', v3, reviewed, '0'.repeat(40), /accepted_reviewed_semantic_head/],
    ['wrong-authority-kind', v3, 'authority_level: repository_local_rule', 'authority_level: governing_spec', /authority_level/],
    ['duplicate-status', v3, 'status: accepted', 'status: proposed\nstatus: accepted', /duplicate/],
    ['duplicate-native', v2, 'LIFECYCLE = SUPERSEDED', 'LIFECYCLE = ACCEPTED\nLIFECYCLE = SUPERSEDED', /duplicate/],
    ['missing-predecessor', v3, '  - CODE_STRUCTURE_GUARDRAILS_V2\n', '', /predecessor/],
    ['duplicate-predecessor', v3, '  - CODE_STRUCTURE_GUARDRAILS_V2\n',
      '  - CODE_STRUCTURE_GUARDRAILS_V2\n  - CODE_STRUCTURE_GUARDRAILS_V2\n', /predecessor/],
    ['successor-tail', v3, 'superseded_by: null', 'superseded_by: UNRELATED', /superseded_by/],
    ['cap-spoof', v3, 'HANDWRITTEN_FILE_MAX_LINES = 500',
      'HANDWRITTEN_FILE_MAX_LINES = 501\nHANDWRITTEN_FILE_MAX_LINES = 500', /carried policy drift/],
    ['anchor-spoof', v3, 'BASELINE_COMMIT = d506f81105e8aa05177a01b817ebe11dcc076ba5',
      `BASELINE_COMMIT = ${main}`, /thresholds or fixed anchor/],
    ['broadened-tuple', v3, '"headBlob": "356899a8ec0726f245790379429f97dfc6ea3bfb"',
      `"headBlob": "${'0'.repeat(40)}"`, /carried policy drift/],
  ];
  for (const [name, file, old, replacement, pattern] of cases) {
    assert.ok(originals.get(file).includes(old), name);
    write(work, file, originals.get(file).replace(old, replacement));
    commit(work, `offline invalid chain: ${name}`);
    const bad = git(work, 'rev-parse', 'HEAD');
    red(run(work, bad, bad, name), 2, pattern);
    write(work, file, originals.get(file));
    commit(work, 'restore offline authority');
  }
  for (const [name, file] of [['missing-v2', v2], ['missing-te', te], ['missing-v3', v3]]) {
    rmSync(path.join(work, file));
    commit(work, `offline invalid chain: ${name}`);
    const bad = git(work, 'rev-parse', 'HEAD');
    red(run(work, bad, bad, name), 2, /authority|retirement/);
    write(work, file, originals.get(file));
    commit(work, 'restore offline authority');
  }
});

test('candidate document changes and self-activation cannot create an exception', (t) => {
  const work = fixture(t, main);
  write(work, v3, source(work, v3) + '\nOffline candidate authority mutation.\n');
  commit(work, 'attempt candidate authority edit');
  red(run(work, main, 'HEAD', 'candidate-authority-edit'), 2, /authority chain changed/);
  const proposed = fixture(t, reviewed);
  for (const file of [v2, te, v3]) write(proposed, file, git(work, 'show', `${main}:${file}`) + '\n');
  commit(proposed, 'simulate candidate-side acceptance and retirement');
  red(run(proposed, reviewed, 'HEAD', 'candidate-self-activation'), 2, /cannot activate/);
});

test('V3 carries the exact transition without restarting it or waiving other 500-line failures', (t) => {
  const work = fixture(t, main);
  git(work, 'sparse-checkout', 'add', 'scripts');
  const old = source(work, installer);
  assert.equal(git(work, 'rev-parse', `HEAD:${installer}`), 'ef5053201e6af88b1edbcdfc33e845f872183b2b');
  write(work, installer, old.replace('agentcore-cron.mjs dsh-agent-spawn-helper.c',
    'agentcore-cron.mjs scheduler-watchdog.mjs dsh-agent-spawn-helper.c'));
  commit(work, 'offline exact transition under accepted V3');
  const exact = git(work, 'rev-parse', 'HEAD');
  const accepted = report(run(work, main, exact, 'v3-exact-transition'));
  assert.equal(accepted.summary.baseline_debt, 28);
  assert.equal(accepted.governing_authority.id, 'CODE_STRUCTURE_GUARDRAILS_V3');
  assert.equal(accepted.transition_exceptions.length, 1);
  const debt = accepted.baseline_debt.find((item) => item.path === installer);
  assert.equal(debt.physicalLines, 1315);
  assert.equal(debt.transition_exception, 'STRUCTURE_TRANSITION_EXCEPTION_V1');
  write(work, 'examples/code-structure/new-501.js', '// ordinary handwritten code\n'.repeat(501));
  commit(work, 'add an unrelated 501-line file');
  red(run(work, main, 'HEAD', 'v3-other-501'), 1, /NEW_FILE_OVER_500/);
  write(work, installer, source(work, installer).replace('PACKAGE_COPY_HELPER=', 'PACKAGE_COPY_HELPER ='));
  commit(work, 'attempt later same-size installer edit');
  red(run(work, exact, 'HEAD', 'v3-no-grant-restart'), 1, /TRANSITION_EXCEPTION_MISMATCH/);
});

test('current lifecycle preserves density, disguise, fixture, depth and registry guards', (t) => {
  const work = fixture(t, main);
  write(work, 'examples/code-structure/evasion/generated.js', '// @generated\nexport const x = 1;\n');
  write(work, 'examples/code-structure/evasion/fixture.js', 'test("hidden", () => assert.ok(true));\n');
  write(work, 'examples/code-structure/evasion/dense.js', 'let a=1; let b=2; let c=3; let d=4;\n');
  write(work, 'examples/code-structure/evasion/a/b/c/deep.js', 'export const deep = true;\n');
  commit(work, 'attempt structural evasions under V3');
  const result = run(work, main, 'HEAD', 'v3-anti-evasion');
  assert.equal(result.status, 1, result.stderr);
  const rules = new Set(JSON.parse(result.stdout).findings.map((item) => item.rule));
  for (const rule of ['GENERATED_DISGUISE', 'TEST_LOGIC_IN_FIXTURE', 'STATEMENTS_PER_LINE', 'DIRECTORY_DEPTH_LIMIT'])
    assert.ok(rules.has(rule), rule);
  write(work, registry, source(work, registry) + '\n');
  commit(work, 'attempt current registry byte mutation');
  red(run(work, main, 'HEAD', 'v3-registry-mutation'), 2, /registry or generated allowlist changed/);
});
