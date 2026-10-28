#!/usr/bin/env node
// V2 structural candidate gate. Registry format intentionally remains V1.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const RULES_VERSION = 'CODE_STRUCTURE_GUARDRAILS_V2';
const BASELINE = 'd506f81105e8aa05177a01b817ebe11dcc076ba5';
const REGISTRY = '.agents/structure-registry.json';
const RULE = '.agents/local/CODE_STRUCTURE_GUARDRAILS_V2.md';
const CONTRACT = 'docs/specs/CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1.md';
const LOCK = '.agents/governance.lock.json';
const LIMIT = { file: 500, warning: 400, dir: 20, dirWarning: 16, depth: 4, statements: 3, barrelLines: 60, barrelExports: 20 };
const ACTORS = ['mayf3'];
const CODE = /\.(js|mjs|cjs|ts|mts|cts|c|h|py|sh|bash|zsh)$/;
const SKIP_PATH = /^(docs\/|\.agents\/|node_modules\/|\.git)/;
const SKIP_FILE = /(-lock\.(json|yaml|yml)|\.lock|\.snap)$/;
const GEN = /(@generated|auto-generated|code generated|do not edit)/i;
const REEXPORT = /^\s*(export\s+\*|export\s*\{[^}]*\}\s*from|import\s+[^(]{0,120}from\s)/;
const TEST_LOGIC = /\b(node:test|describe\s*\(|\bit\s*\(|\btest\s*\(|\bassert[.(])/;

function stop(message) { process.stderr.write(`verify-code-structure: ${message}\n`); process.exit(2); }
function git(args, optional = false) {
  try { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch (error) { if (optional) return null; stop(`git ${args.join(' ')} failed: ${String(error.message).split('\n')[0]}`); }
}
function argsOf(argv) {
  const result = { json: false, base: null, head: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') result.json = true;
    else if (argv[i] === '--base' || argv[i] === '--head') result[argv[i].slice(2)] = argv[++i];
    else stop(`unknown argument ${argv[i]}`);
  }
  if (!result.base || !result.head) stop('--base and --head are required');
  return result;
}
function resolve(ref) {
  const oid = git(['rev-parse', '--verify', `${ref}^{commit}`], true);
  if (!oid) stop(`invalid ref: ${ref}`);
  return oid.trim();
}
const snapshots = new Map();
function snapshot(ref) {
  if (snapshots.has(ref)) return snapshots.get(ref);
  const records = git(['ls-tree', '-r', '-z', '--full-tree', ref]).split('\0').filter(Boolean);
  const blobs = [], paths = [];
  for (const record of records) {
    const split = record.indexOf('\t');
    const [, type, oid] = record.slice(0, split).split(' ');
    if (type === 'blob') { blobs.push(oid); paths.push([record.slice(split + 1), oid]); }
  }
  const data = new Map();
  if (blobs.length) {
    const raw = execFileSync('git', ['cat-file', '--batch'], { input: Buffer.from(`${blobs.join('\n')}\n`), maxBuffer: 512 * 1024 * 1024 });
    let offset = 0;
    while (offset < raw.length) {
      const end = raw.indexOf(10, offset);
      const header = raw.toString('utf8', offset, end).split(' ');
      const size = Number(header[2]);
      const start = end + 1;
      data.set(header[0], raw.toString('utf8', start, start + size));
      offset = start + size + 1;
    }
  }
  const result = new Map(paths.map(([file, oid]) => [file, data.get(oid)]));
  snapshots.set(ref, result);
  return result;
}
function filesAt(ref) { return [...snapshot(ref).keys()]; }
function readAt(ref, file) { return snapshot(ref).get(file) ?? null; }
function lines(text) { return text === '' ? 0 : text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length; }
function inScope(file, vendored, generatedAllowlist = []) {
  return CODE.test(file) && !SKIP_PATH.test(file) && !SKIP_FILE.test(file)
    && !vendored.has(file) && !generatedAllowlist.includes(file)
    && (/^packages\/[^/]+\/(src|test)\//.test(file) || /^(scripts|examples)\//.test(file));
}
function classification(file, text, allowlist) {
  if (GEN.test(text.slice(0, 400)) && !allowlist.includes(file)) return 'generated-claim';
  if (/(fixture|fixtures|\.snapshot|mock|seed)/i.test(file)) return TEST_LOGIC.test(text) ? 'fixture-with-test-logic' : 'fixture';
  if (/\/index\.[^.]+$/.test(file)) {
    const body = text.split('\n').filter((line) => line.trim() && !line.trim().startsWith('//'));
    const count = body.filter((line) => REEXPORT.test(line)).length;
    if (count > LIMIT.barrelExports || (count > 0 && count > body.length / 2)) return 'barrel';
  }
  if (/\/test\//.test(file) || /\.(test|spec)\.[^.]+$/.test(file)) return 'handwritten-test';
  return file.startsWith('scripts/') ? 'handwritten-script' : 'handwritten-source';
}
function statements(line) {
  return (line.replace(/\/\*.*?\*\//g, ' ').split('//')[0]
    .replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``')
    .replace(/for\s*\([^)]*\)/g, 'F').replace(/while\s*\([^)]*\)/g, 'W').match(/;/g) || []).length;
}
function diff(base, head) {
  const result = new Map();
  const numstat = git(['diff', '--numstat', '-z', '--no-renames', base, head]);
  for (const row of numstat.split('\0').filter(Boolean)) {
    const first = row.indexOf('\t'), second = row.indexOf('\t', first + 1);
    if (first < 0 || second < 0) stop('Git returned malformed NUL-delimited numstat');
    const added = row.slice(0, first), deleted = row.slice(first + 1, second), file = row.slice(second + 1);
    result.set(file, { status: 'M', added: added === '-' ? 0 : +added, deleted: deleted === '-' ? 0 : +deleted });
  }
  const statuses = git(['diff', '--name-status', '-z', '--no-renames', base, head]).split('\0').filter(Boolean);
  for (let index = 0; index < statuses.length;) {
    const status = statuses[index++], file = statuses[index++];
    if (!file) stop('Git returned malformed NUL-delimited name-status');
    if (!result.has(file)) result.set(file, { status, added: 0, deleted: 0 }); else result.get(file).status = status;
  }
  return result;
}
function renameTargets(base, head) {
  const fields = git(['diff', '--name-status', '-z', '--find-renames=50%', base, head]).split('\0').filter(Boolean);
  const targets = new Map();
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (status.startsWith('R')) {
      const source = fields[index++], destination = fields[index++];
      if (!source || !destination) stop('Git returned malformed NUL-delimited rename status');
      targets.set(source, destination);
    } else {
      if (!fields[index++]) stop('Git returned malformed NUL-delimited name-status');
    }
  }
  return targets;
}
function tree(ref, fileList) {
  const files = new Set(fileList);
  const children = new Map();
  for (const file of fileList) {
    const parts = file.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      if (!children.has(dir)) children.set(dir, new Set());
      children.get(dir).add(parts.slice(0, i + 1).join('/'));
    }
  }
  const roots = new Set(['', ...fileList.filter((file) => file.endsWith('/package.json')).map((file) => file.slice(0, -13))]);
  const rootOf = (dir) => {
    let current = dir;
    while (current && !roots.has(current)) current = current.slice(0, current.lastIndexOf('/'));
    return current;
  };
  const depthOf = (dir) => {
    const root = rootOf(dir);
    return dir === root ? 0 : dir.slice(root ? root.length + 1 : 0).split('/').filter(Boolean).length;
  };
  return { files, children, roots, rootOf, depthOf };
}
function registryAt(ref) {
  const raw = readAt(ref, REGISTRY);
  if (raw === null) stop(`registry missing at ${ref}:${REGISTRY}`);
  let reg;
  try { reg = JSON.parse(raw); } catch { stop('registry is not valid JSON'); }
  if (!reg || typeof reg !== 'object' || Array.isArray(reg)
      || reg.schema_version !== 1 || reg.rules_version !== 'CODE_STRUCTURE_GUARDRAILS_V1'
      || reg.baseline_commit !== BASELINE || !Array.isArray(reg.files) || !Array.isArray(reg.directories)
      || !Array.isArray(reg.generated_allowlist)
      || reg.generated_allowlist.some((file) => typeof file !== 'string' || file === ''))
    stop('registry schema, label, arrays, or fixed baseline invalid');
  const today = new Date().toISOString().slice(0, 10), seen = new Set();
  const fields = ['path', 'reason', 'approved_by', 'expires_at', 'split_followup'];
  for (const [entries, cap] of [[reg.files, 'approved_max_lines'], [reg.directories, 'approved_max_children']]) {
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) stop('registry entry must be an object');
      for (const field of fields) if (typeof entry[field] !== 'string' || !entry[field]) stop(`registry entry missing ${field}: ${entry.path ?? '<unknown>'}`);
      if (!Number.isSafeInteger(entry[cap]) || entry[cap] < 1) stop(`registry entry has invalid ${cap}: ${entry.path}`);
      if (!ACTORS.includes(entry.approved_by)) stop(`registry actor invalid: ${entry.path}`);
      const date = new Date(`${entry.expires_at}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires_at) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== entry.expires_at || entry.expires_at <= today)
        stop(`registry expiry invalid or expired: ${entry.path}`);
      if (seen.has(entry.path)) stop(`registry duplicate path: ${entry.path}`);
      seen.add(entry.path);
    }
  }
  return { raw, reg, files: new Map(reg.files.map((entry) => [entry.path, entry])), dirs: new Map(reg.directories.map((entry) => [entry.path, entry])) };
}
function vendoredAt(ref) {
  const raw = readAt(ref, LOCK);
  if (raw === null) return new Set();
  let lock;
  try { lock = JSON.parse(raw); } catch { stop(`governance lock is invalid JSON at ${ref}`); }
  if (!lock || typeof lock !== 'object' || Array.isArray(lock) || !Array.isArray(lock.files)
      || lock.files.some((entry) => !entry || typeof entry.path !== 'string'))
    stop(`governance lock has invalid file entries at ${ref}`);
  return new Set(lock.files.map((entry) => entry.path));
}
function keyOf(finding) { return `${finding.check}|${finding.rule}|${finding.path}`; }
function finding(check, severity, rule, file, extra = {}) {
  return { check, severity, rule, path: file, physicalLines: null, directChildren: null, depth: null, classification: null,
    baselineValue: null, headValue: null, exception: null, detail: null, ...extra };
}
function findingMetric(item) {
  if (item.rule === 'DIRECTORY_DEPTH_LIMIT' || item.rule === 'DIRECTORY_DEPTH_WARNING') return { depth: item.depth };
  if (item.rule.includes('DIRECTORY') || item.classification === 'directory') return { directChildren: item.directChildren };
  if (item.rule === 'STATEMENTS_PER_LINE' || item.rule === 'STATEMENTS_PER_LINE_BASELINE') return { headValue: item.headValue };
  if (item.rule === 'BARREL_LIMIT') return { physicalLines: item.physicalLines, headValue: item.headValue };
  return { physicalLines: item.physicalLines, classification: item.classification, detail: item.detail };
}
function stableId(item, registry) {
  const collection = registry.files.has(item.path) ? 'files'
    : registry.dirs.has(item.path) ? 'directories' : 'unregistered';
  const row = collection === 'files' ? registry.files.get(item.path)
    : collection === 'directories' ? registry.dirs.get(item.path) : null;
  return createHash('sha256').update(JSON.stringify({
    collection, row, check: item.check, rule: item.rule, path: item.path, metric: findingMetric(item),
  })).digest('hex');
}
function sameFindingEvidence(left, right) {
  return left.check === right.check && left.rule === right.rule && left.path === right.path
    && left.severity === right.severity
    && JSON.stringify(findingMetric(left)) === JSON.stringify(findingMetric(right));
}
function comparePaths(left, right) { return left.path < right.path ? -1 : left.path > right.path ? 1 : 0; }
function validateRegistryAgainstAnchor(reg, baselineTree) {
  const invalidFiles = new Map(), invalidDirs = new Map();
  for (const [file, row] of reg.files) {
    const count = baselineTree.files.has(file) ? lines(readAt(BASELINE, file) ?? '') : 0;
    if (count <= LIMIT.file || row.approved_max_lines !== count)
      invalidFiles.set(file, `fixed baseline has ${count} lines; recorded cap is ${row.approved_max_lines}`);
  }
  for (const [dir, row] of reg.dirs) {
    const count = baselineTree.children.get(dir)?.size ?? 0;
    if (count <= LIMIT.dir || row.approved_max_children < count) invalidDirs.set(dir, `fixed baseline has ${count} children; recorded cap ${row.approved_max_children}`);
  }
  return { invalidFiles, invalidDirs };
}
function collect(ref, otherRef, changed, invalid, comparisonTree) {
  const names = filesAt(ref), current = tree(ref, names), vendored = vendoredAt(ref);
  const { reg, files: rows, dirs: dirRows } = registryAt(ref), findings = [];
  const scoped = names.filter((file) => inScope(file, vendored, reg.generated_allowlist));
  const texts = new Map(scoped.map((file) => [file, readAt(ref, file) ?? '']));
  const contentHashes = new Map();
  for (const file of scoped) {
    const text = texts.get(file), count = lines(text), baseText = readAt(otherRef, file), baseCount = baseText === null ? null : lines(baseText);
    const change = changed.get(file), dir = file.slice(0, file.lastIndexOf('/')), depth = current.depthOf(dir), cls = classification(file, text, reg.generated_allowlist);
    const row = rows.get(file), fixedText = readAt(BASELINE, file), fixedCount = fixedText === null ? 0 : lines(fixedText);
    const common = { physicalLines: count, baselineValue: baseCount, headValue: count, depth, directChildren: current.children.get(dir)?.size ?? null, classification: cls, exception: row?.approved_max_lines ?? null };
    if (count > LIMIT.file) {
      if (baseCount === null || baseCount <= LIMIT.file) findings.push(finding('FILE_LINE_LIMIT', 'VIOLATION', baseCount === null ? 'NEW_FILE_OVER_500' : 'NEW_LEGACY_VIOLATION_CROSSED_500', file, common));
      else if (invalid.invalidFiles.has(file)) findings.push(finding('EXCEPTION_REGISTRY', 'VIOLATION', 'INVALID_FILE_EXCEPTION_AUTHORITY', file, { ...common, detail: invalid.invalidFiles.get(file) }));
      else if (!row) findings.push(finding('FILE_LINE_LIMIT', 'VIOLATION', 'UNREGISTERED_LEGACY_TOUCHED', file, common));
      else if (count > row.approved_max_lines || count > fixedCount) findings.push(finding('FILE_LINE_LIMIT', 'VIOLATION', 'FILE_OVER_FIXED_BASELINE_CAP', file, { ...common, detail: `fixed=${fixedCount} cap=${row.approved_max_lines} current=${count}` }));
      else if (change && (count > baseCount || change.added > 100 || change.added + change.deleted > 0.2 * baseCount))
        findings.push(finding('FILE_LINE_LIMIT', 'VIOLATION', count > baseCount ? 'MUST_NOT_GROW' : 'MUST_SPLIT', file, common));
    } else if (count > LIMIT.warning) findings.push(finding('FILE_LINE_LIMIT', 'WARNING', 'FILE_WARNING_LINES', file, common));
    if (cls === 'barrel') {
      const reexports = text.split('\n').filter((line) => REEXPORT.test(line)).length;
      if (reexports > LIMIT.barrelExports || count > LIMIT.barrelLines)
        findings.push(finding('FILE_LINE_LIMIT', change ? 'VIOLATION' : 'WARNING', 'BARREL_LIMIT', file, { ...common, headValue: `${count} lines / ${reexports} reexports` }));
    }
    if (cls === 'generated-claim') findings.push(finding('FILE_LINE_LIMIT', change ? 'VIOLATION' : 'WARNING', 'GENERATED_DISGUISE', file, common));
    if (cls === 'fixture-with-test-logic') findings.push(finding('FILE_LINE_LIMIT', change?.status === 'A' ? 'VIOLATION' : 'WARNING', 'TEST_LOGIC_IN_FIXTURE', file, common));
    const added = change && change.status !== 'D' ? git(['diff', '--no-renames', otherRef, ref, '--', file]).split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++')) : [];
    const dense = added.filter((line) => statements(line.slice(1)) > LIMIT.statements).length;
    const denseAll = text.split('\n').filter((line) => statements(line) > LIMIT.statements).length;
    if (dense) findings.push(finding('FILE_LINE_LIMIT', 'VIOLATION', 'STATEMENTS_PER_LINE', file, { ...common, headValue: dense }));
    else if (denseAll) findings.push(finding('FILE_LINE_LIMIT', 'INFO', 'STATEMENTS_PER_LINE_BASELINE', file, { ...common, headValue: denseAll }));
    if (depth > LIMIT.depth) findings.push(finding('DIRECTORY_DEPTH_LIMIT', 'VIOLATION', 'DIRECTORY_DEPTH_LIMIT', file, common));
    else if (depth === LIMIT.depth) findings.push(finding('DIRECTORY_DEPTH_LIMIT', 'WARNING', 'DIRECTORY_DEPTH_WARNING', file, common));
    const digest = createHash('sha256').update(text).digest('hex');
    (contentHashes.get(digest) ?? contentHashes.set(digest, []).get(digest)).push(file);
  }
  for (const paths of contentHashes.values()) if (paths.length > 1)
    findings.push(finding('FILE_LINE_LIMIT', 'WARNING', 'DUPLICATED_IMPLEMENTATION', paths[0], {
      classification: 'duplicate-content', headValue: paths.length, detail: `identical content in: ${paths.join(', ')}`,
    }));
  for (const [dir, kids] of current.children) {
    if (!scoped.some((file) => file.startsWith(`${dir}/`))) continue;
    const count = kids.size, previous = comparisonTree.children.get(dir) ?? new Set(), baseCount = previous.size;
    const row = dirRows.get(dir), invalidDir = invalid.invalidDirs.has(dir);
    const common = { directChildren: count, baselineValue: baseCount, headValue: count, depth: current.depthOf(dir), classification: 'directory', exception: row?.approved_max_children ?? null };
    if (count > LIMIT.dir) {
      if (invalidDir) findings.push(finding('EXCEPTION_REGISTRY', 'VIOLATION', 'INVALID_DIRECTORY_EXCEPTION_AUTHORITY', dir, common));
      else if (row && count <= row.approved_max_children) continue;
      else if (baseCount > LIMIT.dir) findings.push(finding('DIRECTORY_CHILD_LIMIT', 'VIOLATION', row ? 'DIRECTORY_OVER_CEILING' : 'UNREGISTERED_LEGACY_DIRECTORY', dir, common));
      else findings.push(finding('DIRECTORY_CHILD_LIMIT', 'VIOLATION', 'DIRECTORY_CHILD_LIMIT', dir, common));
    } else if (count > LIMIT.dirWarning) findings.push(finding('DIRECTORY_CHILD_LIMIT', 'WARNING', 'DIRECTORY_CHILDREN_WARNING', dir, common));
  }
  return { names, current, scoped, findings };
}
function affectedFinding(item, changed, affectedDirs, baseTree, headTree) {
  if (item.classification === 'directory' || item.rule.includes('DIRECTORY_CHILD'))
    return affectedDirs.has(item.path);
  if (item.rule === 'DIRECTORY_DEPTH_LIMIT' || item.rule === 'DIRECTORY_DEPTH_WARNING') {
    if (changed.has(item.path)) return true;
    const dir = item.path.slice(0, item.path.lastIndexOf('/'));
    return baseTree.rootOf(dir) !== headTree.rootOf(dir) || baseTree.depthOf(dir) !== headTree.depthOf(dir);
  }
  return changed.has(item.path);
}
function excludedMoveDestination(old, base, head, headFiles, changed, renames, vendored, allowlist) {
  if (old.classification === 'directory' || old.physicalLines <= LIMIT.file) return null;
  const renamed = renames.get(old.path);
  if (renamed && headFiles.has(renamed) && !inScope(renamed, vendored, allowlist)) return renamed;
  const content = readAt(base, old.path);
  for (const [candidate, change] of changed) {
    if (change.status !== 'A' || inScope(candidate, vendored, allowlist)) continue;
    if (headFiles.has(candidate) && readAt(head, candidate) === content) return candidate;
  }
  return null;
}
function main() {
  const args = argsOf(process.argv.slice(2)), base = resolve(args.base), head = resolve(args.head);
  const fixed = resolve(BASELINE), changes = diff(base, head), renames = renameTargets(base, head), baseFiles = filesAt(base), headFiles = filesAt(head);
  const baseRegistry = registryAt(base), headRegistry = registryAt(head);
  if (baseRegistry.raw !== headRegistry.raw) stop('registry or generated allowlist changed between base and head');
  const ruleText = readAt(head, RULE);
  const contractText = readAt(head, CONTRACT);
  if (ruleText === null || !ruleText.includes('RULE_ID = CODE_STRUCTURE_GUARDRAILS_V2') || !ruleText.includes('LIFECYCLE = ACCEPTED'))
    stop('accepted V2 rule missing or not accepted at head');
  if (contractText === null || !contractText.includes('spec_id: CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1') || !contractText.includes('status: accepted'))
    stop('accepted verifier conformance Spec missing at head');
  const authorityTerms = [
    `BASELINE_COMMIT = ${BASELINE}`, 'HANDWRITTEN_FILE_WARNING_LINES = 400',
    'HANDWRITTEN_FILE_MAX_LINES = 500', 'DIRECTORY_WARNING_CHILDREN = 16',
    'DIRECTORY_MAX_CHILDREN = 20', 'MAX_DIRECTORY_DEPTH_FROM_MODULE_ROOT = 4',
    'MAX_STATEMENTS_PER_LINE = 3', 'BARREL_MAX_LINES = 60', 'BARREL_MAX_REEXPORTS = 20',
  ];
  if (authorityTerms.some((term) => !ruleText.includes(term))) stop('accepted V2 rule thresholds or fixed anchor do not match the verifier');
  if (fixed !== BASELINE) stop('fixed baseline did not resolve to its pinned commit');
  const baselineTree = tree(BASELINE, filesAt(BASELINE));
  const baseTree = tree(base, baseFiles), headTree = tree(head, headFiles);
  const invalid = validateRegistryAgainstAnchor(headRegistry, baselineTree);
  const baseResult = collect(base, base, new Map(), invalid, baseTree);
  const headResult = collect(head, base, changes, invalid, baseTree);
  const dirs = new Set([...baseTree.children.keys(), ...headTree.children.keys()]);
  const affectedDirs = new Set([...dirs].filter((dir) => {
    const a = baseTree.children.get(dir) ?? new Set(), b = headTree.children.get(dir) ?? new Set();
    return [...a].some((item) => !b.has(item)) || [...b].some((item) => !a.has(item));
  }));
  const baseMap = new Map(baseResult.findings.map((f) => [keyOf(f), f]));
  const headMap = new Map(headResult.findings.map((f) => [keyOf(f), f]));
  const debt = [], resolved = [], candidate = [];
  for (const [key, old] of baseMap) {
    if (old.severity !== 'VIOLATION') continue;
    if (!headMap.has(key)) {
      const movedTo = excludedMoveDestination(old, base, head, new Set(headFiles), changes, renames, vendoredAt(head), headRegistry.reg.generated_allowlist);
      if (movedTo) {
        candidate.push({ ...old, check: 'FILE_LINE_LIMIT', rule: 'EXCLUDED_ROOT_MOVE', path: movedTo,
          classification: 'excluded-moved-code', detail: `over-limit in-scope content moved from ${old.path}`,
          finding_key: stableId({ ...old, rule: 'EXCLUDED_ROOT_MOVE', path: movedTo, classification: 'excluded-moved-code' }, headRegistry) });
        continue;
      }
      const directory = old.classification === 'directory';
      const exists = directory ? headTree.children.has(old.path) : headResult.names.includes(old.path);
      resolved.push({ ...old, finding_key: stableId(old, baseRegistry), head_oid: head, observed_head: {
        path_exists: exists,
        physical_lines: exists && !directory ? lines(readAt(head, old.path) ?? '') : null,
        direct_children: directory && exists ? headTree.children.get(old.path)?.size ?? 0 : null,
      } });
    }
  }
  for (const [key, item] of headMap) {
    if (item.severity !== 'VIOLATION') continue;
    const same = baseMap.get(key), isAffected = affectedFinding(item, changes, affectedDirs, baseTree, headTree);
    if (same && same.severity === 'VIOLATION' && !isAffected && sameFindingEvidence(same, item))
      debt.push({ ...item, finding_key: stableId(item, headRegistry), debt_classification: 'BASELINE_DEBT' });
    else candidate.push({ ...item, finding_key: stableId(item, headRegistry), classification: 'CANDIDATE_VIOLATION' });
  }
  const outputFindings = [...candidate, ...headResult.findings.filter((f) => f.severity !== 'VIOLATION')];
  const exitCode = candidate.length ? 1 : 0;
  const candidateResult = exitCode ? 'CANDIDATE_DELTA_FAIL' : debt.length ? 'CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT' : 'CANDIDATE_DELTA_PASS';
  const report = { schema_version: 1, rules_version: RULES_VERSION, base_oid: base, head_oid: head, candidate_result: candidateResult,
    baseline_debt: debt, resolved_debt: resolved, findings: outputFindings,
    summary: { exit_code: exitCode, in_scope_files: headResult.scoped.length, candidate_violations: candidate.length, baseline_debt: debt.length, resolved_debt: resolved.length } };
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`verify-code-structure: ${candidateResult} (base=${base} head=${head})`);
    console.log(`  candidate violations: ${candidate.length}; baseline debt: ${debt.length}; resolved debt: ${resolved.length}`);
    for (const item of candidate) console.log(`  VIOLATION [${item.rule}] ${JSON.stringify(item.path)} ${item.detail ?? ''}`.trimEnd());
    for (const item of debt.sort(comparePaths))
      console.log(`  BASELINE_DEBT [${item.rule}] ${JSON.stringify(item.path)}`);
    for (const item of resolved.sort(comparePaths))
      console.log(`  RESOLVED_DEBT [${item.rule}] ${JSON.stringify(item.path)}`);
  }
  process.exitCode = exitCode;
}
main();
