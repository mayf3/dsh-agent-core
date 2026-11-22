#!/usr/local/libexec/agent-core/node-runtime/bin/node
/**
 * artifacts-watchdog — LOG-ONLY rewrite (zombie-job option b, #707-adjacent lineage).
 *
 * History: the original artifacts-watchdog.sh (source lost, forensic closure
 * 2026-11-12) patrolled agt_* plugin dirs every 120s AND rewrote them as
 * root-owned links to a shared generation WITHOUT consulting agent
 * registration — a historical root write surface (the #1357 class; W681
 * freeze lesson 3: canonical-section write paths stay OFF).
 *
 * This rewrite keeps only the DETECTION contract, strictly read-only:
 *   - patrol every agt_* home under HOMES_ROOT (its profiles/node_modules);
 *   - FINDINGS (reported to stdout as JSON lines, never acted upon):
 *       root_owned      — an entry owned by root (the #1357 class);
 *       broken_link     — a symlink whose target does not resolve;
 *       foreign_link    — a symlink pointing outside the homes tree;
 *       unreadable      — a home/profile that cannot be entered;
 *   - exit 0 always (a patrol failure is evidence, not a crash loop — the
 *     lost predecessor exited 78 forever after one config failure);
 *   - a `--once` flag for supervised single passes; the launchd cadence
 *     drives repeated passes.
 *
 * ANY write or repair action requires a future spec amendment. The launchd
 * job keeps its existing registration until this script's acceptance and
 * installation complete the legal takeover (no bootout, no plist deletion).
 */
import { readdirSync, lstatSync, readlinkSync, realpathSync, statSync } from 'node:fs';
import { join, isAbsolute, dirname } from 'node:path';

const HOMES_ROOT = process.env.ARTIFACTS_HOMES_ROOT ?? '/Users/authsvc/.agent-core/homes';
const ONCE = process.argv.includes('--once');

function* agentHomes() {
  let entries;
  try {
    entries = readdirSync(HOMES_ROOT);
  } catch (error) {
    yield { finding: 'unreadable', path: HOMES_ROOT, detail: String(error) };
    return;
  }
  for (const name of entries) {
    if (!name.startsWith('agt_')) continue;
    yield join(HOMES_ROOT, name);
  }
}

function patrolNodeModules(home) {
  const findings = [];
  const nm = join(home, 'profiles', 'node_modules');
  let scopeEntries;
  try {
    scopeEntries = readdirSync(nm);
  } catch (error) {
    if (error.code !== 'ENOENT') findings.push({ finding: 'unreadable', path: nm, detail: String(error) });
    return findings; // a home without profiles/node_modules is normal — not a finding
  }
  // Two-level walk (node_modules/<scope>/<pkg>): the plugin links and the
  // #1357 ownership signal both live at this depth. Deeper nesting is third-
  // party package internals — out of contract.
  for (const scopeEntry of scopeEntries) {
    const scopePath = join(nm, scopeEntry);
    let scopeStat;
    try {
      scopeStat = lstatSync(scopePath);
    } catch (error) {
      findings.push({ finding: 'broken_link', path: scopePath, detail: String(error) });
      continue;
    }
    if (scopeStat.isSymbolicLink()) {
      findings.push({ finding: 'foreign_link', path: scopePath, detail: 'scope entry is a symlink' });
      continue;
    }
    let pkgEntries;
    try {
      pkgEntries = readdirSync(scopePath);
    } catch (error) {
      try {
        if (statSync(scopePath).uid === 0) findings.push({ finding: 'root_owned', path: scopePath });
        else findings.push({ finding: 'unreadable', path: scopePath, detail: String(error) });
      } catch (error2) {
        findings.push({ finding: 'unreadable', path: scopePath, detail: String(error2) });
      }
      continue;
    }
    for (const pkg of pkgEntries) {
      const pkgPath = join(scopePath, pkg);
      let pkgStat;
      try {
        pkgStat = lstatSync(pkgPath);
      } catch (error) {
        findings.push({ finding: 'broken_link', path: pkgPath, detail: String(error) });
        continue;
      }
      if (!pkgStat.isSymbolicLink()) {
        try {
          if (statSync(pkgPath).uid === 0) findings.push({ finding: 'root_owned', path: pkgPath });
        } catch (error) {
          findings.push({ finding: 'unreadable', path: pkgPath, detail: String(error) });
        }
        continue;
      }
      let target;
      try {
        target = readlinkSync(pkgPath);
      } catch (error) {
        findings.push({ finding: 'broken_link', path: pkgPath, detail: String(error) });
        continue;
      }
      if (!isAbsolute(target)) target = join(dirname(pkgPath), target);
      let real;
      try {
        real = realpathSync(target);
      } catch {
        findings.push({ finding: 'broken_link', path: pkgPath, target });
        continue;
      }
      if (!real.startsWith(HOMES_ROOT + '/')) {
        findings.push({ finding: 'foreign_link', path: pkgPath, target: real });
      }
    }
  }
  return findings;
}

function run() {
  let homes = 0;
  let findings = 0;
  for (const home of agentHomes()) {
    if (typeof home !== 'string') {
      // The generator yielded an unreadable-root finding object, not a path.
      findings += 1;
      console.log(JSON.stringify({ ts: new Date().toISOString(), ...home }));
      continue;
    }
    homes += 1;
    for (const finding of patrolNodeModules(home)) {
      findings += 1;
      console.log(JSON.stringify({ ts: new Date().toISOString(), ...finding }));
    }
  }
  console.log(JSON.stringify({ ts: new Date().toISOString(), summary: { homes, findings, mode: 'log-only' } }));
  return findings;
}

const findings = run();
if (!ONCE) {
  // Supervised daemon mode: re-run the read-only pass on an interval without
  // any crash-loop risk (every pass exits 0; failures are findings).
  const intervalMs = Number.parseInt(process.env.ARTIFACTS_WATCHDOG_INTERVAL_MS ?? '120000', 10);
  const timer = setInterval(() => {
    try {
      run();
    } catch (error) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), finding: 'unreadable', detail: String(error) }));
    }
  }, intervalMs);
  timer.unref?.();
} else if (findings > 0) {
  process.exitCode = 2; // findings exist (evidence), still not a crash
}
