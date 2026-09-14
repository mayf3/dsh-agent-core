#!/usr/bin/env node
/** Closed, single-purpose production control surface for the retained postdeploy canary. */
import { lstatSync } from 'node:fs'

import { JobStore } from '../../packages/scheduler/src/store.js'
import { createRetainedPostdeployCanary } from '../../packages/production-runtime/src/scheduler/deployment-canary-control.js'

const STORE = '/Users/authsvc/.agent-core/scheduler/jobs.json'
const args = process.argv.slice(2)
const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined }
if (args[0] !== 'create' || process.getuid?.() === 0) throw new Error('postdeploy canary control must run as the non-root scheduler service identity')
const stat = lstatSync(STORE)
if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o177) !== 0) throw new Error('canonical Scheduler store ownership/mode mismatch')
const result = await createRetainedPostdeployCanary(new JobStore(STORE), {
  sourceSha: value('--source-sha'), agentId: value('--agent'), at: value('--at'),
})
process.stdout.write(`${JSON.stringify({ ...result.job, controlOutcome: result.outcome }, null, 2)}\n`)
