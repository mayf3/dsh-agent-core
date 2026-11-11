import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { fixture, commit, requireText, repositoryBase, verifierPath } from './verify-code-structure-test-support.mjs';

function run(work, base, head = 'HEAD', json = true) {
  const args = [verifierPath, '--base', base, '--head', head];
  if (json) args.push('--json');
  return spawnSync(process.execPath, args, { cwd: work, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function sourceLines(count = 501) {
  return Array.from({ length: count }, (_, index) => `// source ${index}\n`).join('');
}

function write(work, relative, content) {
  const destination = path.join(work, relative);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, content);
}

function currentRef(work) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: work, encoding: 'utf8' }).trim();
}

test('sibling addition does not affect file debt, but overfull directory width remains a violation', (t) => {
  const work = fixture(t);
  const legacy = 'examples/review-width/legacy.js';
  write(work, legacy, sourceLines());
  commit(work, 'create inherited-width fixture');
  const base = currentRef(work);
  write(work, 'examples/review-width/sibling.js', 'export const sibling = true;\n');
  commit(work, 'add ordinary sibling');

  const ordinary = run(work, base);
  assert.equal(ordinary.status, 0, ordinary.stderr);
  const ordinaryReport = JSON.parse(ordinary.stdout);
  assert.ok(ordinaryReport.baseline_debt.some((item) => item.path === legacy));
  assert.ok(!ordinaryReport.findings.some((item) => item.path === legacy && item.severity === 'VIOLATION'));

  const full = fixture(t);
  write(full, 'examples/review-wide/legacy.js', sourceLines());
  for (let index = 0; index < 19; index++) write(full, `examples/review-wide/${index}.js`, 'export const value = true;\n');
  commit(full, 'create full-width fixture');
  const fullBase = currentRef(full);
  write(full, 'examples/review-wide/new-child.js', 'export const next = true;\n');
  commit(full, 'exceed directory width');

  const width = run(full, fullBase);
  assert.equal(width.status, 1, width.stderr);
  const widthReport = JSON.parse(width.stdout);
  assert.ok(widthReport.findings.some((item) => item.path === 'examples/review-wide' && item.rule === 'DIRECTORY_CHILD_LIMIT'));
  assert.ok(widthReport.baseline_debt.some((item) => item.path === 'examples/review-wide/legacy.js'));
});

test('package manifest content edits affect depth only when nearest module root changes', (t) => {
  const work = fixture(t);
  write(work, 'examples/review-module/package.json', '{"version":"1.0.0"}\n');
  write(work, 'examples/review-module/src/legacy.js', sourceLines());
  commit(work, 'create module-root fixture');
  const base = currentRef(work);
  write(work, 'examples/review-module/package.json', '{"version":"1.0.1"}\n');
  commit(work, 'change package version only');

  const sameRoot = run(work, base);
  assert.equal(sameRoot.status, 0, sameRoot.stderr);
  assert.ok(JSON.parse(sameRoot.stdout).baseline_debt.some((item) => item.path === 'examples/review-module/src/legacy.js'));

  const depth = fixture(t);
  write(depth, 'examples/review-depth/package.json', '{"name":"review-depth"}\n');
  write(depth, 'examples/review-depth/src/a/b/c/d/legacy.js', 'export const oldRoot = true;\n');
  commit(depth, 'create deep module fixture');
  const deepBase = currentRef(depth);
  write(depth, 'examples/review-depth/src/a/b/c/d/package.json', '{"name":"new-nearest-root"}\n');
  commit(depth, 'change nearest module root');

  const changedRoot = run(depth, deepBase);
  assert.equal(changedRoot.status, 0, changedRoot.stderr);
  const report = JSON.parse(changedRoot.stdout);
  assert.ok(report.resolved_debt.some((item) => item.path === 'examples/review-depth/src/a/b/c/d/legacy.js'));
});

test('NUL-delimited Git paths preserve Unicode, quotes, tabs, and newlines as affected paths', (t) => {
  const work = fixture(t);
  const filename = 'examples/review-path/带\t引号\n雪.js';
  write(work, filename, sourceLines());
  commit(work, 'create unicode path fixture');
  const base = currentRef(work);
  const file = path.join(work, filename);
  writeFileSync(file, readFileSync(file, 'utf8').replace('// source 0', '// altered 0'));
  commit(work, 'edit exact unicode path');

  const result = run(work, base);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.findings.some((item) => item.path === filename && item.rule === 'UNREGISTERED_LEGACY_TOUCHED'));
});

test('moving an over-limit in-scope file to excluded docs or an unsupported extension stays blocked', (t) => {
  for (const destination of ['docs/review-moved.js', 'examples/review-moved.txt']) {
    const work = fixture(t);
    const oldPath = 'examples/review-moved.js';
    write(work, oldPath, sourceLines());
    commit(work, `create move fixture ${destination}`);
    const base = currentRef(work);
    const target = path.join(work, destination);
    mkdirSync(path.dirname(target), { recursive: true });
    execFileSync('git', ['mv', oldPath, destination], { cwd: work });
    commit(work, 'move debt outside handwritten scope');

    const result = run(work, base);
    assert.equal(result.status, 1, `${destination}: ${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.ok(report.findings.some((item) => item.path === destination && item.rule === 'EXCLUDED_ROOT_MOVE'));
    assert.ok(!report.resolved_debt.some((item) => item.path === oldPath));
  }
});

test('moving an over-limit file with a small comment edit to excluded docs stays blocked', (t) => {
  const work = fixture(t);
  const oldPath = 'examples/review-edited-move.js';
  const destination = 'docs/review-edited-move.js';
  write(work, oldPath, sourceLines());
  commit(work, 'create edited move fixture');
  const base = currentRef(work);
  execFileSync('git', ['mv', oldPath, destination], { cwd: work });
  const movedPath = path.join(work, destination);
  writeFileSync(movedPath, readFileSync(movedPath, 'utf8').replace('// source 0', '// edited source 0'));
  commit(work, 'move over-limit source and edit one comment');

  const result = run(work, base);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.findings.some((item) => item.path === destination && item.rule === 'EXCLUDED_ROOT_MOVE'));
  assert.ok(!report.resolved_debt.some((item) => item.path === oldPath));
});

test('registry expiry must be strictly future and malformed roots or entries exit 2', (t) => {
  const work = fixture(t);
  const registryPath = path.join(work, '.agents/structure-registry.json');
  const original = requireText(registryPath);
  const today = new Date().toISOString().slice(0, 10);
  const sameDay = JSON.parse(original);
  sameDay.files[0].expires_at = today;
  writeFileSync(registryPath, JSON.stringify(sameDay, null, 2));
  commit(work, 'prepare same-day expiry');
  let ref = currentRef(work);
  let result = run(work, ref, ref);
  assert.equal(result.status, 2, result.stderr);

  const valid = JSON.parse(original);
  const malformedShapes = [
    null,
    { ...valid, files: [null] },
    { ...valid, files: [{ ...valid.files[0], approved_max_lines: null }] },
    { ...valid, files: [{ ...valid.files[0], approved_by: 7 }] },
    { ...valid, files: [{ ...valid.files[0], expires_at: '2026-02-30' }] },
  ];
  for (const malformed of malformedShapes) {
    writeFileSync(registryPath, JSON.stringify(malformed, null, 2));
    commit(work, 'prepare malformed registry shape');
    ref = currentRef(work);
    result = run(work, ref, ref);
    assert.equal(result.status, 2, result.stderr);
    writeFileSync(registryPath, original);
    commit(work, 'restore valid registry fixture');
  }
});

test('standard named-import barrels and duplicate implementations retain their signals', (t) => {
  const work = fixture(t);
  const imports = Array.from({ length: 21 }, (_, index) => `import { value${index} as alias${index} } from './module-${index}.js';`).join('\n');
  write(work, 'examples/review-barrel/index.js', `${imports}\n${'\n'.repeat(40)}`);
  write(work, 'examples/review-duplicates/one.js', 'export const identical = true;\n');
  write(work, 'examples/review-duplicates/two.js', 'export const identical = true;\n');
  commit(work, 'add retained anti-evasion fixtures');

  const result = run(work, repositoryBase);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.findings.some((item) => item.path === 'examples/review-barrel/index.js' && item.rule === 'BARREL_LIMIT'));
  assert.ok(report.findings.some((item) => item.rule === 'DUPLICATED_IMPLEMENTATION' && item.headValue === 2));
});

test('allowlisted generated files are excluded from handwritten limits', (t) => {
  const work = fixture(t);
  const registryPath = path.join(work, '.agents/structure-registry.json');
  const registry = JSON.parse(requireText(registryPath));
  const generated = 'examples/review-generated/output.js';
  registry.generated_allowlist.push(generated);
  writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  commit(work, 'prepare accepted allowlist fixture');
  const base = currentRef(work);
  write(work, generated, sourceLines());
  commit(work, 'add generated allowlist member');

  const result = run(work, base);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(!report.findings.some((item) => item.path === generated));
});

test('debt identity includes its measured rule metric and text output lists debt paths', (t) => {
  const work = fixture(t);
  const file = 'examples/review-identity/legacy.js';
  write(work, file, sourceLines());
  commit(work, 'create identity fixture');
  const base = currentRef(work);

  const first = run(work, base, base);
  assert.equal(first.status, 0, first.stderr);
  const firstFinding = JSON.parse(first.stdout).baseline_debt.find((item) => item.path === file);
  assert.ok(firstFinding);
  const text = run(work, base, base, false);
  assert.equal(text.status, 0, text.stderr);
  assert.ok(text.stdout.includes(file));

  appendFileSync(path.join(work, file), '// extra physical line\n');
  commit(work, 'change measured file debt');
  const changed = run(work, base);
  assert.equal(changed.status, 1, changed.stderr);
  const changedFinding = JSON.parse(changed.stdout).findings.find((item) => item.path === file);
  assert.ok(changedFinding);
  assert.notEqual(changedFinding.finding_key, firstFinding.finding_key);

  const registered = fixture(t);
  const registryPath = path.join(registered, '.agents/structure-registry.json');
  const registry = JSON.parse(requireText(registryPath));
  const registeredPath = 'packages/agent-credential-provisioning/test/provisioning.test.js';
  const initial = run(registered, repositoryBase, repositoryBase);
  const initialRowFinding = JSON.parse(initial.stdout).baseline_debt.find((item) => item.path === registeredPath);
  const row = registry.files.find((entry) => entry.path === registeredPath);
  assert.ok(row && initialRowFinding);
  row.reason = `${row.reason} (identity fixture)`;
  writeFileSync(registryPath, JSON.stringify(registry, null, 2));
  commit(registered, 'change registry row identity');
  const changedRowRef = currentRef(registered);
  const changedRow = run(registered, changedRowRef, changedRowRef);
  assert.equal(changedRow.status, 0, changedRow.stderr);
  const changedRowFinding = JSON.parse(changedRow.stdout).baseline_debt.find((item) => item.path === registeredPath);
  assert.notEqual(changedRowFinding.finding_key, initialRowFinding.finding_key);
});

test('resolved directory evidence reports the existing head directory and exact child count', (t) => {
  const work = fixture(t);
  const directory = 'packages/agent-router/test';
  for (const name of ['binding-store.test.js', 'broker-rpc.test.js', 'child-env.test.js', 'deadline-config.test.js']) {
    rmSync(path.join(work, directory, name));
  }
  commit(work, 'resolve invalid directory exception');

  const result = run(work, repositoryBase);
  assert.equal(result.status, 0, result.stderr);
  const resolved = JSON.parse(result.stdout).resolved_debt.find((item) => item.path === directory);
  assert.deepEqual(resolved.observed_head, { path_exists: true, physical_lines: null, direct_children: 20 });
});
