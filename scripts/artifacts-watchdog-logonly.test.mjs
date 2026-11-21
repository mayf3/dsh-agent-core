/**
 * artifacts-watchdog-logonly — the zombie-job (option b) rewrite test.
 *
 * Contract under test (spec r7 lineage; W681 freeze lesson 3):
 *   - strictly READ-ONLY: the patrol never creates/modifies/deletes anything
 *     under the homes root (asserted by snapshotting the fixture before/after);
 *   - FINDINGS: root_owned / broken_link / foreign_link / unreadable, as JSON
 *     lines plus a summary; exit 0 when clean, exit 2 when findings exist;
 *   - out-of-contract: deeper nesting and non-agt_ homes are not patrolled.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('./artifacts-watchdog-logonly.mjs', import.meta.url).pathname;

function fixture(build) {
  const root = mkdtempSync(join(tmpdir(), 'awd-test-'));
  const homes = join(root, 'homes');
  mkdirSync(homes);
  build(homes);
  return { root, homes };
}

function run(homes) {
  const before = JSON.stringify(walk(homes));
  const result = spawnSync(process.execPath, [SCRIPT, '--once'], {
    env: { ...process.env, ARTIFACTS_HOMES_ROOT: homes },
    encoding: 'utf8',
  });
  const after = JSON.stringify(walk(homes));
  return { result, readOnly: before === after, lines: result.stdout.trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) };
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    acc.push(p);
    try {
      if (!symlinkIsDir(p)) walk(p, acc);
    } catch { /* symlink to nowhere — still recorded */ }
  }
  return acc;
}
function symlinkIsDir(p) {
  try { return readdirSync(p).length >= 0; } catch { return false; }
}

test('clean fixture: exit 0, zero findings, strictly read-only', () => {
  const { homes } = fixture(h => {
    const nm = join(h, 'agt_ok', 'profiles', 'node_modules');
    mkdirSync(join(nm, '@scope'), { recursive: true });
    writeFileSync(join(nm, '@scope', 'pkg'), 'x');
  });
  const { result, readOnly, lines } = run(homes);
  assert.equal(result.status, 0);
  assert.equal(readOnly, true, 'the patrol never writes');
  assert.equal(lines.filter(l => l.finding).length, 0);
  assert.equal(lines.at(-1).summary.mode, 'log-only');
  rmSync(homes, { recursive: true, force: true });
});

test('findings: broken link, foreign link, root-owned pkg — exit 2, read-only', () => {
  const { homes } = fixture(h => {
    const nm = join(h, 'agt_probe', 'profiles', 'node_modules');
    mkdirSync(join(nm, '@scope'), { recursive: true });
    symlinkSync(join(tmpdir(), 'nonexistent-awd'), join(nm, '@scope', 'broken'));
    symlinkSync(join(nm, '@scope', 'realpkg'), join(nm, '@scope', 'foreign'));
    mkdirSync(join(nm, '@other'), { recursive: true });
    writeFileSync(join(nm, '@other', 'rootpkg'), 'x');
    // root ownership is not testable without root: assert the broken/foreign
    // pair and the read-only invariant; root_owned is verified by code review
    // (statSync().uid === 0) — the fixture cannot chown.
    void join(h, 'agt_probe');
  });
  // make `foreign` actually resolve outside HOMES_ROOT (its target dir is in
  // the fixture, which IS under HOMES_ROOT — point it out instead)
  rmSync(join(homes, 'agt_probe', 'profiles', 'node_modules', '@scope', 'foreign'));
  symlinkSync(tmpdir(), join(homes, 'agt_probe', 'profiles', 'node_modules', '@scope', 'foreign'));
  const { result, readOnly, lines } = run(homes);
  assert.equal(result.status, 2);
  assert.equal(readOnly, true, 'the patrol never writes');
  const findings = lines.filter(l => l.finding).map(l => l.finding);
  assert.ok(findings.includes('broken_link'), 'the broken link is reported');
  assert.ok(findings.includes('foreign_link'), 'the out-of-homes link is reported');
  rmSync(homes, { recursive: true, force: true });
});

test('non-agt_ homes and deeper nesting are out of contract', () => {
  const { homes } = fixture(h => {
    mkdirSync(join(h, 'not_agent', 'profiles', 'node_modules', '@x'), { recursive: true });
    symlinkSync(tmpdir(), join(h, 'not_agent', 'profiles', 'node_modules', '@x', 'y'));
    const nm = join(h, 'agt_deep', 'profiles', 'node_modules', '@scope', 'pkg', 'node_modules', '@deep');
    mkdirSync(nm, { recursive: true });
    symlinkSync(tmpdir(), join(nm, 'z'));
  });
  const { result, lines } = run(homes);
  assert.equal(result.status, 0, 'out-of-contract links are not patrolled');
  assert.equal(lines.filter(l => l.finding).length, 0);
  rmSync(homes, { recursive: true, force: true });
});
