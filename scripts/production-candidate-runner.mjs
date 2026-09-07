#!/usr/bin/env node
// production-candidate-runner.mjs — PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1 (accepted)
//
// Minimal common contract for production candidates:
//   PREPARE GENERATION → SEAL → VERIFY → APPLY FROZEN BYTES → RECEIPT
//
// Authority model (spec §3 rule 3): detection, not prevention. Every gate re-hashes
// fresh bytes; filesystem read-only bits are defense-in-depth only. Generation
// identity (goal/repo/sha/arch/gN) + sealed manifest + fresh apply gates are the
// integrity authority. Drift at ANY gate = FAILED_NO_MUTATION (zero writes).
//
// Generation dir layout:
//   candidate/          exact bytes to apply (targets mirrored by sanitized target path)
//   manifest.toml       spec §4 fields (root of trust)
//   MANIFEST.sha256     seal: sha256 of every file under candidate/ + manifest.toml
//   seal.json           {genId, sealedAt, runnerSha256, manifestSha256}
//   receipts/           build/test/audit receipts (append-only registry: receipts.sha256)
//   rollback/           EXPECTED_PREIMAGE bytes captured at apply time (own MANIFEST.sha256)  [A1.1]
//   apply-receipt.json  written after a successful apply (outside the sealed set)
//
// Implementation notes:
// - Sealed set = candidate/ + manifest.toml. receipts/ is NOT in MANIFEST.sha256;
//   it is covered by receipts.sha256 (append-only registry; verify recomputes and
//   flags tampered or unreferenced entries). TEST/AUDIT receipts are registered
//   after seal without touching the sealed manifest.
// - Source bytes are ALWAYS extracted via `git show <sha>:<path>` from the declared
//   SOURCE_SHA (immutable commit-tree bytes). sourceMode=worktree additionally
//   requires the checkout to be clean at that exact HEAD; sourceMode=git-show
//   tolerates worktree dirt by construction.
// - Target paths are mirrored under candidate/ with the leading "/" stripped.
//   Absolute target paths resolve against --live-root for fixtures/tests.
// - Apply is once per generation: a second apply refuses (rollback/ exists).
// - Forbidden operations (rebuild/install/git-repair/patch/chmod-fix) are not
//   implemented and therefore not invocable; the runner only hashes and copies.
// - The dependency closure is copied from disk into candidate/ (dependency install
//   output is not a git tree); its bytes are pinned by DEPENDENCY_CLOSURE_DIGEST,
//   which is exactly why the digest exists independent of SOURCE_SHA.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const SELF_PATH = new URL(import.meta.url).pathname;
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const ABSENT = 'ABSENT';

function die(msg, code = 1) {
  console.error(`FAILED_NO_MUTATION: ${msg}`);
  process.exit(code);
}
function info(msg) { console.log(msg); }
function requireArg(argv, flag) {
  const i = argv.indexOf(flag);
  if (i < 0 || !argv[i + 1]) die(`missing ${flag} <value>`);
  return argv[i + 1];
}

function git(repo, args, { buffer = false } = {}) {
  return execFileSync('git', ['-C', repo, ...args],
    { encoding: buffer ? 'buffer' : 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

function genRootDir() {
  return process.env.PRODUCTION_CANDIDATE_ROOT ||
    path.join(os.homedir(), 'workspace', 'artifacts', 'production-candidates');
}

function sanitizeTarget(targetPath) {
  if (!String(targetPath).startsWith('/')) die(`targetPath must be absolute: ${targetPath}`);
  const rel = targetPath.slice(1);
  if (rel.split('/').includes('..')) die(`targetPath escapes root: ${targetPath}`);
  return rel;
}

function livePathFor(targetPath, liveRoot) {
  const rel = sanitizeTarget(targetPath);
  return liveRoot ? path.join(liveRoot, rel) : path.resolve('/' + rel);
}

function walkFiles(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, base, out);
    else if (e.isFile()) out.push(path.relative(base, p));
  }
  return out.sort();
}

// deterministic recursive copy (no cp-semantics ambiguity)
function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyTree(s, d);
    else { fs.copyFileSync(s, d); fs.chmodSync(d, fs.statSync(s).mode & 0o777); }
  }
}

function secretScan(relPath) {
  const base = path.basename(relPath).toLowerCase();
  return base === '.env' || base.startsWith('.env.') || /\.(pem|key)$/.test(base) ||
    /credential|secret/.test(base);
}

// ---------------------------------------------------------------------------
// manifest.toml — deterministic emit + minimal parse (we control the shape)
// ---------------------------------------------------------------------------

const tomlStr = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const TOP_KEYS = ['GOAL_NAME', 'GENERATION_ID', 'SOURCE_REPO', 'SOURCE_SHA', 'SOURCE_TREE_STATE',
  'BUILD_TOOLCHAIN', 'RUNTIME_ARCH', 'SOURCE_MODE', 'SECRET_SCAN_POLICY',
  'DEPENDENCY_CLOSURE_DIGEST', 'DEPENDENCY_CLOSURE_SOURCE', 'CLOSURE_REL',
  'BUILD_RECEIPT', 'TEST_RECEIPT', 'AUDIT_RECEIPT'];

function emitManifest(m) {
  const L = [];
  for (const k of TOP_KEYS) {
    if (m[k] === undefined) continue;
    if (k === 'TARGET_PATHS') continue;
    L.push(`${k} = ${tomlStr(m[k])}`);
  }
  L.push(`TARGET_PATHS = [${m.TARGET_PATHS.map(tomlStr).join(', ')}]`);
  for (const t of m.targets) {
    L.push('');
    L.push(`[targets."${t.targetPath}"]`);
    L.push(`SOURCE_HASH = ${tomlStr(t.SOURCE_HASH)}`);
    L.push(`CANDIDATE_HASH = ${tomlStr(t.CANDIDATE_HASH)}`);
    L.push(`EXPECTED_PREIMAGE_HASH = ${tomlStr(t.EXPECTED_PREIMAGE_HASH)}`);
    L.push(`EXPECTED_POSTIMAGE_HASH = ${tomlStr(t.EXPECTED_POSTIMAGE_HASH)}`);
    L.push(`MODE = ${tomlStr(t.MODE)}`);
    L.push(`WHY_REQUIRED = ${tomlStr(t.WHY_REQUIRED)}`);
  }
  return L.join('\n') + '\n';
}

function unquote(v) {
  return v.replace(/^"|"$/g, '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function parseManifest(text) {
  const m = { targets: [], TARGET_PATHS: [] };
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sec = line.match(/^\[targets\."(.+)"\]$/);
    if (sec) { cur = { targetPath: unquote(sec[1]) }; m.targets.push(cur); continue; }
    const kv = line.match(/^([A-Z_]+) = (.*)$/);
    if (!kv) die(`manifest parse error at line: ${raw}`);
    const [, k, vRaw] = kv;
    if (k === 'TARGET_PATHS') {
      m.TARGET_PATHS = [...vRaw.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(x => unquote(`"${x[1]}"`));
      continue;
    }
    const TARGET_KEYS = ['SOURCE_HASH', 'CANDIDATE_HASH', 'EXPECTED_PREIMAGE_HASH', 'EXPECTED_POSTIMAGE_HASH', 'MODE', 'WHY_REQUIRED'];
    if (cur && TARGET_KEYS.includes(k)) { cur[k] = unquote(vRaw); continue; }
    if (!TOP_KEYS.includes(k)) die(`manifest parse: unexpected key ${k}`);
    m[k] = unquote(vRaw);
  }
  return m;
}

// closure digest: sha256 over sorted "rel\0hash\n" lines of candidate/<closureRel>
function computeClosureDigest(genDir, closureRel) {
  const abs = path.join(genDir, 'candidate', closureRel);
  if (!fs.existsSync(abs)) die(`closure dir missing from candidate: ${closureRel}`);
  const lines = [];
  for (const rel of walkFiles(abs)) {
    lines.push(`${rel.split(path.sep).join('/')}\0${sha256(fs.readFileSync(path.join(abs, rel)))}\n`);
  }
  return sha256(Buffer.from(lines.join(''), 'utf8'));
}

function closureRelOf(manifest) {
  if (manifest.DEPENDENCY_CLOSURE_DIGEST === 'NONE') return null;
  if (!manifest.CLOSURE_REL) die('manifest declares closure but CLOSURE_REL missing');
  return manifest.CLOSURE_REL;
}

// ---------------------------------------------------------------------------
// receipts registry (append-only; outside the sealed set)
// ---------------------------------------------------------------------------

function registryAdd(genDir, rel) {
  const reg = path.join(genDir, 'receipts.sha256');
  const abs = path.join(genDir, rel);
  const line = `${sha256(fs.readFileSync(abs))}  ${rel}`;
  let prev = '';
  if (fs.existsSync(reg)) {
    prev = fs.readFileSync(reg, 'utf8');
    if (prev.split('\n').some(l => l.endsWith('  ' + rel))) die(`receipt already registered: ${rel}`);
  }
  fs.appendFileSync(reg, line + '\n');
}

function registryVerify(genDir) {
  const reg = path.join(genDir, 'receipts.sha256');
  const problems = [];
  const referenced = new Set();
  if (fs.existsSync(reg)) {
    for (const line of fs.readFileSync(reg, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const mm = line.match(/^([0-9a-f]{64})  (.+)$/);
      if (!mm) { problems.push(`bad registry line: ${line}`); continue; }
      const [, hash, rel] = mm;
      referenced.add(rel);
      const abs = path.join(genDir, rel);
      if (!fs.existsSync(abs)) { problems.push(`registry: missing ${rel}`); continue; }
      if (sha256(fs.readFileSync(abs)) !== hash) problems.push(`registry: DRIFT ${rel}`);
    }
  }
  for (const rel of walkFiles(path.join(genDir, 'receipts'))) {
    const norm = 'receipts/' + rel.split(path.sep).join('/');
    if (!referenced.has(norm)) problems.push(`receipts: unreferenced file ${norm}`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// seal-set verification: fresh re-hash of candidate/ + manifest.toml,
// manifest↔seal cross-check, closure digest, registry
// ---------------------------------------------------------------------------

function verifySealedSet(genDir, manifest) {
  const problems = [];
  const sealPath = path.join(genDir, 'MANIFEST.sha256');
  if (!fs.existsSync(sealPath)) return ['not sealed (MANIFEST.sha256 missing)'];
  const sealed = new Map();
  for (const line of fs.readFileSync(sealPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const mm = line.match(/^([0-9a-f]{64})  (.+)$/);
    if (!mm) { problems.push(`bad seal line: ${line}`); continue; }
    sealed.set(mm[2], mm[1]);
  }
  const present = new Set(['manifest.toml']);
  for (const rel of walkFiles(path.join(genDir, 'candidate'))) present.add('candidate/' + rel.split(path.sep).join('/'));
  for (const [rel, hash] of sealed) {
    if (!present.has(rel)) { problems.push(`sealed file missing: ${rel}`); continue; }
    if (sha256(fs.readFileSync(path.join(genDir, rel))) !== hash) problems.push(`DRIFT ${rel}`);
  }
  for (const rel of present) if (!sealed.has(rel)) problems.push(`unsealed file present: ${rel}`);
  for (const t of manifest.targets) {
    const rel = 'candidate/' + sanitizeTarget(t.targetPath);
    if (sealed.get(rel) !== t.CANDIDATE_HASH) problems.push(`manifest↔seal mismatch: ${rel}`);
  }
  const closureRel = closureRelOf(manifest);
  if (closureRel) {
    const cur = computeClosureDigest(genDir, closureRel);
    if (cur !== manifest.DEPENDENCY_CLOSURE_DIGEST) {
      problems.push(`closure DRIFT (${manifest.DEPENDENCY_CLOSURE_DIGEST.slice(0, 12)}… → ${cur.slice(0, 12)}…)`);
    }
  } else if (manifest.DEPENDENCY_CLOSURE_DIGEST !== 'NONE') {
    problems.push('manifest declares closure but CLOSURE_REL absent');
  }
  return problems;
}

function loadManifest(genDir) {
  const p = path.join(genDir, 'manifest.toml');
  if (!fs.existsSync(p)) die(`not a generation dir (manifest.toml missing): ${genDir}`);
  return parseManifest(fs.readFileSync(p, 'utf8'));
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

function nextGenerationDir(root, baseId) {
  for (let n = 1; n < 10000; n++) {
    const dir = path.join(root, `${baseId}--g${n}`);
    try { fs.mkdirSync(dir, { recursive: false }); return { dir, n }; }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  die('generation allocation exhausted');
}

function cmdPrepare(argv) {
  const specPath = path.resolve(requireArg(argv, '--spec'));
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  for (const k of ['goalName', 'sourceRepo', 'sourceSha', 'arch', 'sourceMode', 'targets']) {
    if (spec[k] === undefined) die(`spec missing field ${k}`);
  }
  if (!['git-show', 'worktree'].includes(spec.sourceMode)) die(`bad sourceMode ${spec.sourceMode}`);
  const repo = path.resolve(spec.sourceRepo);
  const fullSha = git(repo, ['rev-parse', spec.sourceSha]).trim();
  if (git(repo, ['cat-file', '-t', fullSha]).trim() !== 'commit') die(`${fullSha} is not a commit`);

  let sourceTreeState;
  if (spec.sourceMode === 'worktree') {
    const head = git(repo, ['rev-parse', 'HEAD']).trim();
    if (head !== fullSha) die(`worktree HEAD ${head.slice(0, 7)} != declared sourceSha ${fullSha.slice(0, 7)}`);
    const dirty = git(repo, ['status', '--porcelain']).trim();
    if (dirty) die(`worktree is dirty — source coordinates not clean:\n${dirty.split('\n').slice(0, 10).join('\n')}`);
    sourceTreeState = 'clean (worktree at SOURCE_SHA, porcelain empty)';
  } else {
    sourceTreeState = 'commit-tree at SOURCE_SHA (git-show extraction; worktree state irrelevant by construction)';
  }

  const root = genRootDir();
  fs.mkdirSync(root, { recursive: true });
  const repoBase = path.basename(repo).replace(/[^A-Za-z0-9._-]/g, '');
  const baseId = `${spec.goalName}--${repoBase}--${fullSha.slice(0, 7)}--${spec.arch}`;
  const { dir: genDir, n } = nextGenerationDir(root, baseId);
  const GEN_ID = `${baseId}--g${n}`;

  let closureRel = null, closureDigest = 'NONE', closureSource = 'NONE';
  if (spec.dependencyClosure) {
    const src = path.resolve(spec.dependencyClosure.sourcePath);
    if (!fs.statSync(src).isDirectory()) die(`dependencyClosure.sourcePath not a dir: ${src}`);
    closureRel = sanitizeTarget(spec.dependencyClosure.installPath);
    copyTree(src, path.join(genDir, 'candidate', closureRel));
    closureDigest = computeClosureDigest(genDir, closureRel);
    closureSource = `disk-dir:${src}`;
  }

  const liveRoot = spec.liveRoot ? path.resolve(spec.liveRoot) : null;
  const targets = [];
  for (const t of spec.targets) {
    for (const k of ['sourcePath', 'targetPath', 'why']) if (!t[k]) die(`target missing ${k}: ${JSON.stringify(t)}`);
    if (secretScan(t.targetPath)) die(`refusing secret-class target: ${t.targetPath}`);
    const bytes = git(repo, ['show', `${fullSha}:${t.sourcePath}`], { buffer: true });
    const rel = sanitizeTarget(t.targetPath);
    const abs = path.join(genDir, 'candidate', rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, bytes);
    let preimage = ABSENT;
    try { preimage = sha256(fs.readFileSync(livePathFor(t.targetPath, liveRoot))); } catch { /* ABSENT */ }
    const hash = sha256(bytes);
    let mode = '0644';
    try {
      const treeMode = git(repo, ['ls-tree', fullSha, t.sourcePath]).trim().split(/\s+/)[0];
      if (treeMode === '100755') { mode = '0755'; fs.chmodSync(abs, 0o755); }
    } catch { /* mode probe best-effort */ }
    targets.push({ targetPath: t.targetPath, SOURCE_HASH: hash, CANDIDATE_HASH: hash,
      EXPECTED_PREIMAGE_HASH: preimage, EXPECTED_POSTIMAGE_HASH: hash, MODE: mode, WHY_REQUIRED: t.why });
  }
  for (const rel of walkFiles(path.join(genDir, 'candidate'))) {
    if (secretScan(rel)) die(`refusing secret-class file in candidate: ${rel}`);
  }

  const manifest = {
    GOAL_NAME: spec.goalName,
    GENERATION_ID: GEN_ID,
    SOURCE_REPO: repo,
    SOURCE_SHA: fullSha,
    SOURCE_TREE_STATE: sourceTreeState,
    BUILD_TOOLCHAIN: `node ${process.version} on ${process.platform}/${process.arch}`,
    RUNTIME_ARCH: spec.arch,
    TARGET_PATHS: targets.map(t => t.targetPath),
    SOURCE_MODE: spec.sourceMode,
    SECRET_SCAN_POLICY: 'refuse-at-seal (.env, .env.*, *.pem, *.key, *credential*, *secret*)',
    DEPENDENCY_CLOSURE_DIGEST: closureDigest,
    DEPENDENCY_CLOSURE_SOURCE: closureSource,
    CLOSURE_REL: closureRel || undefined,
    BUILD_RECEIPT: 'receipts/build-receipt.txt',
    TEST_RECEIPT: 'pending: register via receipt command (registry receipts.sha256)',
    AUDIT_RECEIPT: 'pending: register via receipt command (registry receipts.sha256)',
    targets,
  };
  fs.mkdirSync(path.join(genDir, 'receipts'), { recursive: true });
  const buildReceipt = [
    `GENERATION_ID=${GEN_ID}`,
    `PREPARED_AT=${new Date().toISOString()}`,
    `TOOLCHAIN=node ${process.version} ${process.platform}/${process.arch}`,
    `SOURCE_MODE=${spec.sourceMode}`,
    `SOURCE_SHA=${fullSha}`,
    `SPEC_DIGEST=sha256:${sha256(fs.readFileSync(specPath))}`,
    `RUNNER_SHA256=${sha256(fs.readFileSync(SELF_PATH))}`,
    ...(closureRel ? [`CLOSURE_REL=${closureRel}`] : []),
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(genDir, 'receipts', 'build-receipt.txt'), buildReceipt);
  registryAdd(genDir, 'receipts/build-receipt.txt');

  fs.writeFileSync(path.join(genDir, 'manifest.toml'), emitManifest(manifest));
  info(`PREPARED ${GEN_ID}`);
  info(`  dir: ${genDir}`);
  info(`  targets: ${targets.map(t => t.targetPath).join(', ')}`);
  info(`  closure: ${closureDigest === 'NONE' ? 'NONE' : closureDigest.slice(0, 12) + '…'}`);
}

function cmdSeal(argv) {
  const genDir = path.resolve(requireArg(argv, '--gen'));
  const manifest = loadManifest(genDir);
  if (fs.existsSync(path.join(genDir, 'MANIFEST.sha256'))) die('already sealed');
  for (const rel of walkFiles(path.join(genDir, 'candidate'))) {
    if (secretScan(rel)) die(`secret-class file in candidate: ${rel}`);
  }
  if (!manifest.targets.length) die('manifest has no targets');
  const lines = [];
  for (const rel of ['manifest.toml',
    ...walkFiles(path.join(genDir, 'candidate')).map(r => 'candidate/' + r)]) {
    lines.push(`${sha256(fs.readFileSync(path.join(genDir, rel)))}  ${rel}`);
  }
  fs.writeFileSync(path.join(genDir, 'MANIFEST.sha256'), lines.sort().join('\n') + '\n');
  const runnerSha = sha256(fs.readFileSync(SELF_PATH));
  fs.writeFileSync(path.join(genDir, 'seal.json'), JSON.stringify({
    genId: manifest.GENERATION_ID,
    sealedAt: new Date().toISOString(),
    runnerSha256: runnerSha,
    manifestSha256: sha256(fs.readFileSync(path.join(genDir, 'manifest.toml'))),
  }, null, 2) + '\n');
  // defense-in-depth only (authority = detection per §3 rule 3)
  fs.chmodSync(path.join(genDir, 'MANIFEST.sha256'), 0o444);
  fs.chmodSync(path.join(genDir, 'seal.json'), 0o444);
  fs.chmodSync(path.join(genDir, 'manifest.toml'), 0o444);
  for (const rel of walkFiles(path.join(genDir, 'candidate'))) {
    const f = path.join(genDir, 'candidate', rel);
    fs.chmodSync(f, (fs.statSync(f).mode & 0o111) ? 0o555 : 0o444);
  }
  info(`SEALED ${manifest.GENERATION_ID}`);
  info(`  runner pinned: ${runnerSha.slice(0, 12)}…`);
  const v = verifySealedSet(genDir, manifest);
  if (v.length) die(`post-seal verify failed: ${v.join('; ')}`);
  info('  post-seal verify: OK');
}

function cmdVerify(argv) {
  const genDir = path.resolve(requireArg(argv, '--gen'));
  const manifest = loadManifest(genDir);
  const problems = [...verifySealedSet(genDir, manifest), ...registryVerify(genDir)];
  if (problems.length) {
    console.error(`VERIFY DRIFT ${manifest.GENERATION_ID}:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  info(`VERIFY OK ${manifest.GENERATION_ID} (fresh re-hash: seal set + manifest↔seal + closure + receipts)`);
}

function cmdApply(argv) {
  const genDir = path.resolve(requireArg(argv, '--gen'));
  const liveRoot = argv.includes('--live-root') ? path.resolve(requireArg(argv, '--live-root')) : null;
  const manifest = loadManifest(genDir);
  const seal = JSON.parse(fs.readFileSync(path.join(genDir, 'seal.json'), 'utf8'));
  const closureRel = closureRelOf(manifest);

  // gate 0 — runner meta-integrity (AMENDMENT_1 A1.2)
  const runnerNow = sha256(fs.readFileSync(SELF_PATH));
  if (runnerNow !== seal.runnerSha256) {
    die(`gate0 RUNNER_DRIFT: executing runner ${runnerNow.slice(0, 12)}… != pinned ${seal.runnerSha256.slice(0, 12)}…`);
  }

  // gates 1+2 — seal + candidate bytes, fresh
  const sealProblems = verifySealedSet(genDir, manifest);
  if (sealProblems.length) die(`gate1/2 CANDIDATE_DRIFT:\n  ${sealProblems.join('\n  ')}`);

  // gate 3 — production preimage, fresh (expected declared at prepare [A1.1])
  for (const t of manifest.targets) {
    const lp = livePathFor(t.targetPath, liveRoot);
    let actual = ABSENT;
    try { actual = sha256(fs.readFileSync(lp)); } catch { /* ABSENT */ }
    if (actual !== t.EXPECTED_PREIMAGE_HASH) {
      const fmt = (h) => (h === ABSENT ? 'ABSENT' : h.slice(0, 12) + '…');
      die(`gate3 PREIMAGE_DRIFT ${t.targetPath}: live ${fmt(actual)} != expected ${fmt(t.EXPECTED_PREIMAGE_HASH)}`);
    }
  }

  // gate 4 — dependency closure, fresh (explicit re-assert for the receipt)
  if (closureRel && computeClosureDigest(genDir, closureRel) !== manifest.DEPENDENCY_CLOSURE_DIGEST) {
    die('gate4 CLOSURE_DRIFT');
  }

  // ---- mutation phase (all gates MATCH) ----
  const rollbackDir = path.join(genDir, 'rollback');
  if (fs.existsSync(rollbackDir)) die('refusing re-apply: rollback/ already exists (apply is once per generation)');

  // A1.1: capture preimage NOW (the one capture moment), then freeze rollback/
  fs.mkdirSync(rollbackDir, { recursive: true });
  const rbLines = [];
  for (const t of manifest.targets) {
    const lp = livePathFor(t.targetPath, liveRoot);
    const rel = sanitizeTarget(t.targetPath);
    const dest = path.join(rollbackDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    let content;
    try { content = fs.readFileSync(lp); } catch { content = Buffer.from(ABSENT); }
    fs.writeFileSync(dest, content);
    rbLines.push(`${sha256(content)}  ${rel}`);
  }
  fs.writeFileSync(path.join(rollbackDir, 'MANIFEST.sha256'), rbLines.sort().join('\n') + '\n');
  for (const rel of walkFiles(rollbackDir)) fs.chmodSync(path.join(rollbackDir, rel), 0o444);
  fs.chmodSync(path.join(rollbackDir, 'MANIFEST.sha256'), 0o444);

  for (const t of manifest.targets) {
    const src = path.join(genDir, 'candidate', sanitizeTarget(t.targetPath));
    const lp = livePathFor(t.targetPath, liveRoot);
    fs.mkdirSync(path.dirname(lp), { recursive: true });
    // write content explicitly (copyFileSync would clone the sealed file's read-only mode)
    fs.writeFileSync(lp, fs.readFileSync(src));
    fs.chmodSync(lp, parseInt(t.MODE || '0644', 8) || 0o644);
  }
  if (closureRel) {
    copyTree(path.join(genDir, 'candidate', closureRel), livePathFor('/' + closureRel, liveRoot));
  }

  // postimage verify
  for (const t of manifest.targets) {
    const lp = livePathFor(t.targetPath, liveRoot);
    if (sha256(fs.readFileSync(lp)) !== t.EXPECTED_POSTIMAGE_HASH) {
      console.error(`POSTIMAGE_INCONSISTENT ${t.targetPath}: apply wrote unexpected bytes — restore via rollback-restore`);
      process.exit(2);
    }
  }

  const receipt = {
    generationId: manifest.GENERATION_ID,
    appliedAt: new Date().toISOString(),
    runnerSha256: runnerNow,
    gates: { seal: 'MATCH', bytes: 'MATCH', preimage: 'MATCH', closure: closureRel ? 'MATCH' : 'NONE' },
    postimage: 'MATCH',
    rollback: 'SEALED',
    targets: manifest.targets.map(t => t.targetPath),
  };
  fs.writeFileSync(path.join(genDir, 'apply-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  info(`APPLIED ${manifest.GENERATION_ID} (gates: seal/bytes/preimage/closure MATCH; postimage MATCH; rollback sealed)`);
}

function cmdRollbackRestore(argv) {
  const genDir = path.resolve(requireArg(argv, '--gen'));
  const liveRoot = argv.includes('--live-root') ? path.resolve(requireArg(argv, '--live-root')) : null;
  const manifest = loadManifest(genDir);
  const rbDir = path.join(genDir, 'rollback');
  if (!fs.existsSync(path.join(rbDir, 'MANIFEST.sha256'))) die('no frozen rollback in this generation');
  const expected = new Map();
  for (const line of fs.readFileSync(path.join(rbDir, 'MANIFEST.sha256'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const mm = line.match(/^([0-9a-f]{64})  (.+)$/);
    if (!mm) die(`bad rollback seal line: ${line}`);
    expected.set(mm[2], mm[1]);
  }
  for (const [rel, hash] of expected) {
    let content;
    try { content = fs.readFileSync(path.join(rbDir, rel)); } catch { die(`rollback file missing: ${rel}`); }
    if (sha256(content) !== hash) die(`rollback DRIFT ${rel} — restoring from a drifted rollback is forbidden`);
  }
  for (const [rel, hash] of expected) {
    const lp = liveRoot ? path.join(liveRoot, rel) : path.resolve('/' + rel);
    if (hash === sha256(Buffer.from(ABSENT))) {
      try { fs.unlinkSync(lp); } catch { /* already absent */ }
      continue;
    }
    fs.mkdirSync(path.dirname(lp), { recursive: true });
    fs.writeFileSync(lp, fs.readFileSync(path.join(rbDir, rel)));
    if (sha256(fs.readFileSync(lp)) !== hash) die(`rollback restore postimage inconsistent: ${rel}`);
  }
  fs.writeFileSync(path.join(genDir, 'rollback-receipt.json'), JSON.stringify({
    generationId: manifest.GENERATION_ID, restoredAt: new Date().toISOString(),
    method: 'frozen-rollback-preimage',
  }, null, 2) + '\n');
  info(`ROLLED BACK ${manifest.GENERATION_ID} (frozen preimage restored, hash-verified)`);
}

function cmdReceipt(argv) {
  const genDir = path.resolve(requireArg(argv, '--gen'));
  const type = requireArg(argv, '--type');
  const file = path.resolve(requireArg(argv, '--file'));
  if (!['test', 'audit'].includes(type)) die('--type must be test|audit (build receipt is written at prepare)');
  const dest = path.join(genDir, 'receipts', `${type}-receipt.txt`);
  if (fs.existsSync(dest)) die(`${type} receipt already exists (append-only discipline)`);
  fs.copyFileSync(file, dest);
  registryAdd(genDir, `receipts/${type}-receipt.txt`);
  info(`RECEIPT registered ${type}: receipts/${type}-receipt.txt`);
}

function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  switch (cmd) {
    case 'prepare': return cmdPrepare(argv);
    case 'seal': return cmdSeal(argv);
    case 'verify': return cmdVerify(argv);
    case 'apply': return cmdApply(argv);
    case 'rollback-restore': return cmdRollbackRestore(argv);
    case 'receipt': return cmdReceipt(argv);
    default:
      console.error('usage: production-candidate-runner.mjs <prepare|seal|verify|apply|rollback-restore|receipt> ...');
      process.exit(2);
  }
}

main();
