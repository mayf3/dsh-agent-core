/**
 * @agent-core/agent-router/src/process/index.js — barrel of the per-agent
 * DSH process client split (AGENT_PROCESS_LIFECYCLE_HARDENING_V2).
 *
 * env.js               child env policy (TMPDIR fix, proxy redaction, spawn uid)
 * provider-errors.js   provider error classification + redaction boundary
 * state-machine.js     lifecycle states, deadlines, envelope carriers
 * evidence-buffer.js   CLAUSE-PROC-BOUNDED ceilings + bounded event surfaces
 * rpc-channel.js       JSON-RPC stdio channel + parent-RPC relay
 * event-correlation.js exact event attribution + settle-once + unknown fence
 * turn-execution.js    TurnExecution + turn admission queue + prompt write
 * spawn.js             spawn/attach + ownership binding + exit order
 * shutdown.js          fatal teardown + graceful-then-kill shutdown
 * agent-process.js     AgentProcess — constructor, ready(), public entries
 *
 * Legacy import path `src/process.js` re-exports this barrel.
 */

export { RECOGNIZED_PROXY_ENV_KEYS, childSpawnConfig, AGENT_CHILD_TMPDIR, agentEnv } from './env.js'
export { redactSensitiveText, classifyProviderError, sanitizeProviderError } from './provider-errors.js'
export { PROCESS_STATES, monotonicNowMs } from './state-machine.js'
export { PROCESS_EVIDENCE_CAPS } from './evidence-buffer.js'
export { UNKNOWN_FENCE_DIAGNOSTICS, classifyUnknownFence } from './event-correlation.js'
export { AgentProcess } from './agent-process.js'
