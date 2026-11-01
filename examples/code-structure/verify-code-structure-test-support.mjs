import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryBase = 'd454c10913315a564945c30404ac2ea59dcd9755';
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const verifierPath = path.join(repository, 'scripts/verify-code-structure.mjs');

export function fixture(t) {
  const parent = mkdtempSync(path.join(tmpdir(), 'structure-v2-review-'));
  const work = path.join(parent, 'repo');
  execFileSync('git', ['clone', '--shared', '--no-checkout', repository, work], { stdio: 'ignore' });
  execFileSync('git', ['sparse-checkout', 'init', '--cone'], { cwd: work });
  execFileSync('git', ['sparse-checkout', 'set', '.agents', 'docs', 'examples', 'packages/agent-router/test'], { cwd: work });
  execFileSync('git', ['checkout', '--detach', repositoryBase], { cwd: work, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Structure Fixture'], { cwd: work });
  execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: work });
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  return work;
}

export function commit(work, message) {
  execFileSync('git', ['add', '-A'], { cwd: work });
  execFileSync('git', ['commit', '-m', message], { cwd: work, stdio: 'ignore' });
}

export function requireText(file) {
  return execFileSync('cat', [file], { encoding: 'utf8' });
}
