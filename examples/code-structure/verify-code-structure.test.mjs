import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync, mkdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const verifier = path.join(repo, 'scripts/verify-code-structure.mjs');
const base = 'd454c10913315a564945c30404ac2ea59dcd9755';
const fixed = 'd506f81105e8aa05177a01b817ebe11dcc076ba5';

function fixture(t) {
  const parent = mkdtempSync(path.join(tmpdir(), 'structure-v2-'));
  const work = path.join(parent, 'repo');
  execFileSync('git', ['clone', '--shared', '--no-checkout', repo, work], { stdio: 'ignore' });
  execFileSync('git', ['sparse-checkout', 'init', '--cone'], { cwd: work });
  execFileSync('git', ['sparse-checkout', 'set', '.agents', 'packages/agent-credential-provisioning/test', 'packages/agent-definition/test', 'packages/agent-credential-provisioning/src', 'packages/agent-provisioning/test', 'packages/agent-router/test', 'examples'], { cwd: work });
  execFileSync('git', ['checkout', '--detach', base], { cwd: work, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Structure Fixture'], { cwd: work });
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: work });
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  return work;
}

function commit(work, message) {
  execFileSync('git', ['add', '-A'], { cwd: work });
  execFileSync('git', ['commit', '-m', message], { cwd: work, stdio: 'ignore' });
}

function run(work, coordinates = [base, 'HEAD']) {
  return spawnSync(process.execPath, [verifier, '--base', coordinates[0], '--head', coordinates[1], '--json'], {
    cwd: work, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
}

test('reports exact coordinates and unchanged 797/824 authority debt without granting the cap', (t) => {
  const work = fixture(t);
  appendFileSync(path.join(work, 'README.md'), '\nExcluded documentation-only fixture change.\n');
  commit(work, 'unrelated documentation change');

  const result = run(work);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.rules_version, 'CODE_STRUCTURE_GUARDRAILS_V2');
  assert.equal(report.base_oid, base);
  assert.equal(report.head_oid, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: work, encoding: 'utf8' }).trim());
  assert.equal(report.candidate_result, 'CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT');
  const registryBefore = execFileSync('git', ['show', `${base}:.agents/structure-registry.json`], { cwd: work, encoding: 'utf8' });
  const registryAfter = execFileSync('git', ['show', 'HEAD:.agents/structure-registry.json'], { cwd: work, encoding: 'utf8' });
  assert.equal(registryAfter, registryBefore);
  assert.equal(JSON.parse(registryAfter).directories.find((entry) => entry.path === 'scripts').approved_max_children, 40);
  assert.ok(report.baseline_debt.some((finding) =>
    finding.path === 'packages/agent-credential-provisioning/test/provisioning.test.js'
    && finding.rule === 'INVALID_FILE_EXCEPTION_AUTHORITY'
    && finding.detail.includes('fixed baseline has 797 lines')
    && finding.detail.includes('recorded cap is 824')));
  assert.ok(report.baseline_debt.some((finding) => finding.path === 'scripts' && finding.rule === 'DIRECTORY_OVER_CEILING'));
  const scriptsChildren = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', fixed], { cwd: work, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean).map((file) => file.split('/')).filter((parts) => parts[0] === 'scripts').map((parts) => parts[1]));
  assert.equal(scriptsChildren.size, 38);
});

test('fails when the 797/824 debt path is affected and remains over 500 lines', (t) => {
  const work = fixture(t);
  appendFileSync(path.join(work, 'packages/agent-credential-provisioning/test/provisioning.test.js'), '\n// touched fixture\n');
  commit(work, 'touch invalid-cap legacy file');

  const result = run(work);
  assert.equal(result.status, 1, JSON.stringify({ stderr: result.stderr, output: result.stdout }));
  const report = JSON.parse(result.stdout);
  assert.equal(report.candidate_result, 'CANDIDATE_DELTA_FAIL');
  assert.ok(report.findings.some((finding) =>
    finding.path === 'packages/agent-credential-provisioning/test/provisioning.test.js'
    && finding.severity === 'VIOLATION'));
});

test('rejects registry deltas as configuration failures', (t) => {
  const work = fixture(t);
  const registryPath = path.join(work, '.agents/structure-registry.json');
  appendFileSync(registryPath, '\n');
  commit(work, 'mutate registry bytes');

  const result = run(work);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /registry|allowlist/i);
});

test('rejects a newly added handwritten file over 500 lines', (t) => {
  const work = fixture(t);
  const file = path.join(work, 'examples/code-structure/new-over-limit.js');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${'const value = 1;\n'.repeat(501)}`);
  commit(work, 'add over-limit handwritten file');

  const result = run(work);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.findings.some((finding) =>
    finding.path === 'examples/code-structure/new-over-limit.js'
    && finding.rule === 'NEW_FILE_OVER_500'));
});

test('keeps an under-cap legacy edit that does not grow or cross the major-change threshold', (t) => {
  const work = fixture(t);
  const file = path.join(work, 'packages/agent-definition/test/definition.test.js');
  const source = requireText(file);
  const parts = source.split('\n');
  const blank = parts.findIndex((line) => line === '');
  assert.notEqual(blank, -1);
  parts[blank] = '// no-growth fixture edit';
  writeFileSync(file, parts.join('\n'));
  commit(work, 'edit valid legacy file without growth');

  const result = run(work);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.findings.some((finding) => finding.path === 'packages/agent-definition/test/definition.test.js' && finding.severity === 'VIOLATION'));
});

test('reports deleted inherited debt as resolved at the exact head', (t) => {
  const work = fixture(t);
  const file = path.join(work, 'packages/agent-provisioning/test/provisioning.test.js');
  rmSync(file, { force: true });
  commit(work, 'delete inherited over-limit file');

  const result = run(work);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.resolved_debt.some((finding) => finding.path === 'packages/agent-provisioning/test/provisioning.test.js' && finding.head_oid === report.head_oid));
});

test('treats rename as resolution of the old finding plus a new over-limit violation', (t) => {
  const work = fixture(t);
  const oldPath = 'packages/agent-provisioning/test/provisioning.test.js';
  const newPath = 'examples/moved-provisioning.js';
  renameSync(path.join(work, oldPath), path.join(work, newPath));
  commit(work, 'rename inherited over-limit file');

  const result = run(work);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.resolved_debt.some((finding) => finding.path === oldPath));
  assert.ok(report.findings.some((finding) => finding.path === newPath && finding.rule === 'NEW_FILE_OVER_500'));
});

test('rejects major edits to an over-limit legacy file even when its line count is unchanged', (t) => {
  const work = fixture(t);
  const file = path.join(work, 'packages/agent-definition/test/definition.test.js');
  const parts = requireText(file).split('\n');
  parts.splice(10, 110, ...Array.from({ length: 110 }, (_, i) => `// replacement ${i}`));
  writeFileSync(file, parts.join('\n'));
  commit(work, 'replace a major section without changing line count');

  const result = run(work);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.findings.some((finding) => finding.path === 'packages/agent-definition/test/definition.test.js' && finding.rule === 'MUST_SPLIT'));
});

test('rejects depth, directory width, generated claims, fixture hiding, dense lines, and barrel inflation', (t) => {
  const work = fixture(t);
  const add = (relative, content) => {
    const file = path.join(work, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  add('examples/a/b/c/d/deep.js', 'export const deep = true;\n');
  add('examples/generated.js', '// @generated\nexport const x = 1;\n');
  add('examples/fixture-data.js', 'test("hidden", () => assert.ok(true));\n');
  add('examples/dense.js', 'const a=1; const b=2; const c=3; const d=4;\n');
  add('examples/barrel/index.js', `${Array.from({ length: 21 }, (_, i) => `export { item${i} } from './item${i}.js';`).join('\n')}\n${'\n'.repeat(40)}`);
  for (let i = 0; i < 21; i++) add(`examples/wide/${i}.js`, 'export const value = 1;\n');
  commit(work, 'add structural edge-case files');

  const result = run(work);
  assert.equal(result.status, 1, JSON.stringify({ error: result.error?.message, stderr: result.stderr, stdoutLength: result.stdout?.length }));
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  const rules = new Set(report.findings.filter((finding) => finding.severity === 'VIOLATION').map((finding) => finding.rule));
  for (const expected of ['DIRECTORY_DEPTH_LIMIT', 'DIRECTORY_CHILD_LIMIT', 'GENERATED_DISGUISE', 'TEST_LOGIC_IN_FIXTURE', 'STATEMENTS_PER_LINE', 'BARREL_LIMIT']) assert.ok(rules.has(expected), `${expected} missing: ${[...rules]}`);
});

test('fails closed on a malformed registry present at both comparison coordinates', (t) => {
  const work = fixture(t);
  const registryPath = path.join(work, '.agents/structure-registry.json');
  const registry = JSON.parse(requireText(registryPath));
  registry.files[0].approved_max_lines = null;
  writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  commit(work, 'create malformed registry comparison base');
  const ref = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: work, encoding: 'utf8' }).trim();

  const result = run(work, [ref, ref]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid approved_max_lines/i);
});

test('fails closed for unknown schema, wrong anchor, duplicate paths, and expired entries', (t) => {
  const work = fixture(t);
  const file = path.join(work, '.agents/structure-registry.json');
  const original = requireText(file);
  const mutations = [
    (registry) => { registry.schema_version = 2; },
    (registry) => { registry.baseline_commit = 'be5a331'; },
    (registry) => { registry.files.push({ ...registry.files[0] }); },
    (registry) => { registry.files[0].expires_at = '2020-01-01'; },
  ];
  for (const mutate of mutations) {
    const registry = JSON.parse(original);
    mutate(registry);
    writeFileSync(file, JSON.stringify(registry, null, 2));
    commit(work, 'prepare invalid registry state');
    const ref = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: work, encoding: 'utf8' }).trim();
    const result = run(work, [ref, ref]);
    assert.equal(result.status, 2, result.stderr);
    writeFileSync(file, original);
  }
});

test('rejects an unaccepted structural rule and unresolvable comparison refs', (t) => {
  const work = fixture(t);
  const rulePath = path.join(work, '.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md');
  const accepted = requireText(rulePath);
  writeFileSync(rulePath, accepted.replace('LIFECYCLE = ACCEPTED', 'LIFECYCLE = PROPOSED'));
  commit(work, 'prepare unaccepted rule fixture');
  const ref = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: work, encoding: 'utf8' }).trim();
  const unaccepted = run(work, [ref, ref]);
  assert.equal(unaccepted.status, 2);
  assert.match(unaccepted.stderr, /not accepted/i);

  const missing = run(work, ['missing-structure-v2-ref', ref]);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /invalid ref/i);
});

function requireText(file) {
  return execFileSync('cat', [file], { encoding: 'utf8' });
}
