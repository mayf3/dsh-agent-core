#!/usr/bin/env node
// verify-code-structure.mjs — machine verifier for .agents/local/CODE_STRUCTURE_GUARDRAILS_V1.md
// Exit codes: 0 = PASS (warnings allowed); 1 = STRUCTURE_VIOLATION; 2 = INVALID_CONFIGURATION_OR_REGISTRY.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const RULES_VERSION = 'CODE_STRUCTURE_GUARDRAILS_V1';
const REGISTRY_PATH = '.agents/structure-registry.json';
const FROZEN = {
  FILE_WARNING_LINES: 400, FILE_MAX_LINES: 500,
  DIR_WARNING_CHILDREN: 16, DIR_MAX_CHILDREN: 20,
  MAX_DEPTH: 4,
  MAX_STATEMENTS_PER_LINE: 3, BARREL_MAX_LINES: 60, BARREL_MAX_REEXPORTS: 20,
};
const ACCEPTED_ACTORS = ['mayf3']; // SPEC_ACCEPTANCE_ACTORS; extend only via rule-version change.
const CODE_EXT = /\.(js|mjs|cjs|ts|mts|cts|c|h|py|sh|bash|zsh)$/;
const EXCLUDED_PATH = /^(docs\/|\.agents\/|node_modules\/|\.git)/;
const EXCLUDED_FILE = /(-lock\.(json|yaml|yml)|\.lock|\.snap)$/;
const GENERATION_MARKERS = /(@generated|auto-generated|code generated|do not edit)/i;
const REEXPORT_RE = /^\s*(export\s+\*|export\s*\{[^}]*\}\s*from|import\s+[^(]{0,120}from\s)/;
const TEST_CONSTRUCT_RE = /\b(node:test|describe\s*\(|\bit\s*\(|\btest\s*\(|\bassert[.(])/;

function fail(msg) { process.stderr.write(`verify-code-structure: ${msg}\n`); process.exit(2); }
function parseArgs(argv) {
  const out = { json: false, base: null, head: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') out.json = true;
    else if (argv[i] === '--base') out.base = argv[++i];
    else if (argv[i] === '--head') out.head = argv[++i];
    else fail(`unknown argument ${argv[i]}`);
  }
  if (!out.base || !out.head) fail('--base and --head are required');
  return out;
}
function git(args, opts = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  } catch (e) {
    if (opts.allowFail) return null;
    fail(`git ${args.join(' ')} failed: ${String(e.message).split('\n')[0]}`);
  }
}
function rev(ref) {
  const out = git(['rev-parse', '--verify', `${ref}^{commit}`], { allowFail: true });
  if (!out) fail(`invalid ref: ${ref}`);
  return out.trim();
}
function trackedFiles(ref) { return git(['ls-tree', '-r', '--name-only', ref]).trim().split('\n').filter(Boolean); }
function readFile(ref, path) {
  const out = git(['show', `${ref}:${path}`], { allowFail: true });
  return out === null ? null : out;
}
function physicalLines(text) {
  if (text === '') return 0;
  return text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
}
function isInScope(path, vendored) {
  if (!CODE_EXT.test(path)) return false;
  if (EXCLUDED_PATH.test(path) || EXCLUDED_FILE.test(path) || vendored.has(path)) return false;
  return /^packages\/[^/]+\/(src|test)\//.test(path) || /^scripts\//.test(path) || /^examples\//.test(path);
}
function classify(path, text, allowlist) {
  const isTest = /\/test\//.test(path) || /\.(test|spec)\.[^.]+$/.test(path);
  const fixtureNamed = /(fixture|fixtures|\.snapshot|mock|seed)/i.test(path);
  const genBanner = text && GENERATION_MARKERS.test(text.slice(0, 400)) && !allowlist.includes(path);
  if (genBanner) return 'generated-claim';
  if (fixtureNamed) return TEST_CONSTRUCT_RE.test(text) ? 'fixture-with-test-logic' : 'fixture';
  if (/\/index\.[^.]+$/.test(path)) {
    const body = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//'));
    const reexp = body.filter((l) => REEXPORT_RE.test(l)).length;
    if (reexp > FROZEN.BARREL_MAX_REEXPORTS || (reexp > 0 && reexp > body.length / 2)) return 'barrel';
  }
  if (isTest) return 'handwritten-test';
  return path.startsWith('scripts/') ? 'handwritten-script' : 'handwritten-source';
}
function statementsInLine(line) {
  let s = line.replace(/\/\*.*?\*\//g, ' ').split('//')[0];
  s = s.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``'); // string literals are not statements
  s = s.replace(/for\s*\([^)]*\)/g, 'F').replace(/while\s*\([^)]*\)/g, 'W');
  return (s.match(/;/g) || []).length;
}
function diffStats(base, head) {
  const stats = new Map(); // path -> {status, added, deleted}
  const ns = git(['diff', '--numstat', '--no-renames', base, head]).trim();
  for (const row of ns.split('\n').filter(Boolean)) {
    const [a, d, p] = row.split('\t');
    stats.set(p, { status: 'M', added: a === '-' ? 0 : +a, deleted: d === '-' ? 0 : +d });
  }
  const st = git(['diff', '--name-status', '--no-renames', base, head]).trim();
  for (const row of st.split('\n').filter(Boolean)) {
    const [s, p] = row.split('\t');
    if (!stats.has(p)) stats.set(p, { status: s, added: 0, deleted: 0 });
    else stats.get(p).status = s;
  }
  return stats;
}
function addedDiffLines(base, head, path) {
  const out = git(['diff', '--no-renames', base, head, '--', path], { allowFail: true }) || '';
  return out.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
}
function loadRegistry(ref) {
  const raw = readFile(ref, REGISTRY_PATH);
  if (raw === null) fail(`registry missing at ${ref}:${REGISTRY_PATH}`);
  let reg;
  try { reg = JSON.parse(raw); } catch { fail('registry is not valid JSON'); }
  if (reg.rules_version !== RULES_VERSION) fail(`registry rules_version must be ${RULES_VERSION}`);
  const today = new Date().toISOString().slice(0, 10);
  const fields = ['path', 'reason', 'approved_by', 'expires_at', 'split_followup'];
  const seen = new Set();
  const entries = [...(reg.files || []).map((e) => ({ ...e, kind: 'file' })), ...(reg.directories || []).map((e) => ({ ...e, kind: 'directory' }))];
  for (const e of entries) {
    for (const f of fields) if (!e[f]) fail(`registry entry missing field ${f}: ${JSON.stringify(e.path ?? e)}`);
    const cap = e.kind === 'file' ? 'approved_max_lines' : 'approved_max_children';
    if (typeof e[cap] !== 'number' || e[cap] < 1) fail(`registry entry missing numeric ${cap}: ${e.path}`);
    if (!ACCEPTED_ACTORS.includes(e.approved_by)) fail(`registry approved_by not an accepted actor: ${e.path}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.expires_at) || Number.isNaN(Date.parse(e.expires_at))) fail(`registry expires_at invalid: ${e.path}`);
    if (e.expires_at < today) fail(`registry entry expired ${e.expires_at}: ${e.path}`);
    if (seen.has(e.path)) fail(`registry duplicate path: ${e.path}`);
    seen.add(e.path);
  }
  return { reg, fileEntries: new Map((reg.files || []).map((e) => [e.path, e])), dirEntries: new Map((reg.directories || []).map((e) => [e.path, e])) };
}

// ---- main ----
const args = parseArgs(process.argv.slice(2));
const base = rev(args.base), head = rev(args.head);
const vendored = new Set((JSON.parse(readFile(head, '.agents/governance.lock.json') ?? '{}').files ?? []).map((f) => f.path));
const { reg, fileEntries, dirEntries } = loadRegistry(head);
const baseFiles = new Set(trackedFiles(base));
const headFiles = trackedFiles(head);
const diffs = diffStats(base, head);
const allowlist = reg.generated_allowlist ?? [];

// registry entries must reference real baseline violations (no grandfathering branch-only files)
for (const [p, e] of fileEntries) {
  const t = baseFiles.has(p) ? readFile(base, p) : null;
  if (t === null || physicalLines(t) <= FROZEN.FILE_MAX_LINES)
    fail(`registry file entry is not a baseline >${FROZEN.FILE_MAX_LINES}-line file: ${p}`);
}
// module roots (nearest package.json ancestor) and directory children, from head tree
const moduleRoots = new Set(['', ...headFiles.filter((f) => f.endsWith('/package.json')).map((f) => f.slice(0, -('/package.json'.length)))]);
const dirChildren = new Map();
for (const f of headFiles) {
  const parts = f.split('/');
  for (let i = 1; i < parts.length; i++) {
    const d = parts.slice(0, i).join('/');
    if (!dirChildren.has(d)) dirChildren.set(d, new Set());
    dirChildren.get(d).add(parts.slice(0, i + 1).join('/'));
  }
}
function nearestRoot(dir) { let d = dir; while (d !== '' && !moduleRoots.has(d)) d = d.slice(0, d.lastIndexOf('/')); return d; }
function dirDepth(dir) { const r = nearestRoot(dir); return r === '' && dir === '' ? 0 : dir.slice(r === '' ? 0 : r.length + 1).split('/').filter(Boolean).length; }

const findings = [];
function add(check, severity, rule, path, extra) {
  findings.push({
    check, severity, rule, path,
    physicalLines: extra.physicalLines ?? null, directChildren: extra.directChildren ?? null,
    depth: extra.depth ?? null, classification: extra.classification ?? null,
    baselineValue: extra.baselineValue ?? null, headValue: extra.headValue ?? null,
    exception: extra.exception ?? null, detail: extra.detail ?? null,
  });
}
const scope = headFiles.filter((f) => isInScope(f, vendored));
const content = new Map(), lines = new Map(), cls = new Map();
for (const f of scope) {
  const t = readFile(head, f) ?? '';
  content.set(f, t); lines.set(f, physicalLines(t)); cls.set(f, classify(f, t, allowlist));
}
// FILE_LINE_LIMIT + NO_NEW_LEGACY_VIOLATION + anti-evasion
const hashCounts = new Map();
for (const f of scope) {
  const n = lines.get(f), diff = diffs.get(f), baseT = baseFiles.has(f) ? readFile(base, f) : null;
  const baseN = baseT === null ? null : physicalLines(baseT);
  const entry = fileEntries.get(f) ?? null;
  const dir = f.slice(0, f.lastIndexOf('/'));
  const depth = dirDepth(dir);
  const children = dirChildren.get(dir)?.size ?? null;
  const common = { physicalLines: n, depth, directChildren: children, classification: cls.get(f), baselineValue: baseN, headValue: n, exception: entry?.approved_max_lines ?? null };
  if (n > FROZEN.FILE_MAX_LINES) {
    if (baseN === null) add('FILE_LINE_LIMIT', 'VIOLATION', 'NEW_FILE_OVER_500', f, { ...common, detail: `new file has ${n} lines` });
    else if (baseN > FROZEN.FILE_MAX_LINES) {
      if (diff) {
        if (!entry) add('FILE_LINE_LIMIT', 'VIOLATION', 'UNREGISTERED_LEGACY_TOUCHED', f, common);
        else if (n > baseN) add('FILE_LINE_LIMIT', 'VIOLATION', 'MUST_NOT_GROW', f, { ...common, exception: entry.approved_max_lines, detail: `${baseN} -> ${n}` });
        else if (diff.added > 100 || diff.added + diff.deleted > 0.2 * baseN) add('FILE_LINE_LIMIT', 'VIOLATION', 'MUST_SPLIT', f, { ...common, detail: `added=${diff.added} changed=${diff.added + diff.deleted} base=${baseN}` });
        else add('FILE_LINE_LIMIT', 'PASS', 'GRANDFATHERED_TOUCHED', f, common);
      } else add('FILE_LINE_LIMIT', entry ? 'PASS' : 'WARNING', 'GRANDFATHERED', f, { ...common, detail: entry ? null : 'legacy over-limit file not listed in registry' });
    } else add('FILE_LINE_LIMIT', 'VIOLATION', 'NEW_LEGACY_VIOLATION_CROSSED_500', f, { ...common, detail: `${baseN} -> ${n}` });
  } else if (n > FROZEN.FILE_WARNING_LINES) add('FILE_LINE_LIMIT', 'WARNING', 'FILE_WARNING_LINES', f, common);
  if (cls.get(f) === 'barrel') {
    const reexp = content.get(f).split('\n').filter((l) => REEXPORT_RE.test(l)).length;
    if (reexp > FROZEN.BARREL_MAX_REEXPORTS || n > FROZEN.BARREL_MAX_LINES)
      add('FILE_LINE_LIMIT', diffs.get(f) ? 'VIOLATION' : 'WARNING', 'BARREL_LIMIT', f, { ...common, headValue: `${n} lines / ${reexp} reexports`, detail: `barrel exceeds BARREL_MAX_LINES=${FROZEN.BARREL_MAX_LINES} or BARREL_MAX_REEXPORTS=${FROZEN.BARREL_MAX_REEXPORTS}` });
  }
  if (cls.get(f) === 'generated-claim')
    add('FILE_LINE_LIMIT', diffs.get(f) ? 'VIOLATION' : 'WARNING', 'GENERATED_DISGUISE', f, { ...common, detail: 'declares itself generated but is not in generated_allowlist' });
  if (cls.get(f) === 'fixture-with-test-logic')
    add('FILE_LINE_LIMIT', diffs.get(f) && diffs.get(f).status === 'A' ? 'VIOLATION' : 'WARNING', 'TEST_LOGIC_IN_FIXTURE', f, { ...common, detail: 'fixture file contains test-runner constructs' });
  const checkLines = diffs.get(f) && diffs.get(f).status !== 'D' ? addedDiffLines(base, head, f) : [];
  const denseAdded = checkLines.filter((l) => statementsInLine(l.slice(1)) > FROZEN.MAX_STATEMENTS_PER_LINE).length;
  const denseAll = content.get(f).split('\n').filter((l) => statementsInLine(l) > FROZEN.MAX_STATEMENTS_PER_LINE).length;
  if (denseAdded > 0) add('FILE_LINE_LIMIT', 'VIOLATION', 'STATEMENTS_PER_LINE', f, { ...common, headValue: denseAdded, detail: `${denseAdded} added line(s) exceed MAX_STATEMENTS_PER_LINE=${FROZEN.MAX_STATEMENTS_PER_LINE}` });
  else if (denseAll > 0) add('FILE_LINE_LIMIT', 'INFO', 'STATEMENTS_PER_LINE_BASELINE', f, { ...common, headValue: denseAll, detail: `${denseAll} pre-existing dense line(s) reported` });
  if (depth > FROZEN.MAX_DEPTH) add('DIRECTORY_DEPTH_LIMIT', 'VIOLATION', 'DIRECTORY_DEPTH_LIMIT', f, { ...common, detail: `directory ${dir} depth ${depth} > ${FROZEN.MAX_DEPTH}` });
  else if (depth === FROZEN.MAX_DEPTH) add('DIRECTORY_DEPTH_LIMIT', 'WARNING', 'DIRECTORY_DEPTH_WARNING', f, common);
  const h = createHash('sha256').update(content.get(f)).digest('hex');
  (hashCounts.get(h) ?? hashCounts.set(h, []).get(h)).push(f);
}
for (const [h, paths] of hashCounts) if (paths.length > 1)
  add('FILE_LINE_LIMIT', 'WARNING', 'DUPLICATED_IMPLEMENTATION', paths[0], { classification: 'duplicate-content', headValue: paths.length, detail: `identical content in: ${paths.join(', ')}` });
// DIRECTORY_CHILD_LIMIT
for (const [d, kids] of dirChildren) {
  const inScopeArea = scope.some((f) => f.startsWith(d + '/'));
  if (!inScopeArea) continue;
  const n = kids.size;
  const baseKids = new Set();
  for (const f of baseFiles) if (f.startsWith(d + '/')) baseKids.add(f.split('/')[d.split('/').length]);
  const baseN = baseKids.size;
  const entry = dirEntries.get(d) ?? null;
  const common = { directChildren: n, depth: dirDepth(d), baselineValue: baseN, headValue: n, exception: entry?.approved_max_children ?? null, classification: 'directory' };
  if (n > FROZEN.DIR_MAX_CHILDREN) {
    if (entry && n <= entry.approved_max_children) add('DIRECTORY_CHILD_LIMIT', 'PASS', 'GRANDFATHERED_DIRECTORY', d, common);
    else if (baseN > FROZEN.DIR_MAX_CHILDREN) add('DIRECTORY_CHILD_LIMIT', 'VIOLATION', entry ? 'DIRECTORY_OVER_CEILING' : 'UNREGISTERED_LEGACY_DIRECTORY', d, common);
    else add('DIRECTORY_CHILD_LIMIT', 'VIOLATION', 'DIRECTORY_CHILD_LIMIT', d, { ...common, detail: `${n} > ${FROZEN.DIR_MAX_CHILDREN} immediate tracked children` });
  } else if (n > FROZEN.DIR_WARNING_CHILDREN) add('DIRECTORY_CHILD_LIMIT', 'WARNING', 'DIRECTORY_CHILDREN_WARNING', d, common);
}
for (const [p] of fileEntries) if (!headFiles.includes(p)) add('EXCEPTION_REGISTRY', 'INFO', 'STALE_FILE_ENTRY', p, { detail: 'registered file no longer present at head (split or deleted)' });
for (const [p] of dirEntries) if (!dirChildren.has(p)) add('EXCEPTION_REGISTRY', 'INFO', 'STALE_DIRECTORY_ENTRY', p, { detail: 'registered directory no longer present at head' });

const violations = findings.filter((f) => f.severity === 'VIOLATION');
const warnings = findings.filter((f) => f.severity === 'WARNING');
const exitCode = violations.length ? 1 : 0;
const result = exitCode === 0 ? 'PASS' : 'STRUCTURE_VIOLATION';
const summary = {
  result, exitCode, rulesVersion: RULES_VERSION, base, head,
  checks: ['FILE_LINE_LIMIT', 'DIRECTORY_CHILD_LIMIT', 'DIRECTORY_DEPTH_LIMIT', 'EXCEPTION_REGISTRY', 'NO_NEW_LEGACY_VIOLATION'],
  inScopeFiles: scope.length, violations: violations.length, warnings: warnings.length,
  registryFiles: fileEntries.size, registryDirectories: dirEntries.size,
};
if (args.json) {
  console.log(JSON.stringify({ summary, findings }, null, 2));
} else {
  console.log(`verify-code-structure: ${result} (base=${base.slice(0, 10)} head=${head.slice(0, 10)})`);
  console.log(`  in-scope files: ${scope.length}; registry: ${fileEntries.size} files / ${dirEntries.size} directories; violations: ${violations.length}; warnings: ${warnings.length}`);
  for (const v of violations) console.log(`  VIOLATION [${v.rule}] ${v.path} ${v.detail ?? ''}`.trimEnd());
  for (const w of warnings.slice(0, 30)) console.log(`  WARNING  [${w.rule}] ${w.path} ${w.detail ?? ''}`.trimEnd());
  if (warnings.length > 30) console.log(`  ... ${warnings.length - 30} more warnings`);
}
process.exit(exitCode);
