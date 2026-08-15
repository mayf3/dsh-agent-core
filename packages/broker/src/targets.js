/**
 * @agent-core/broker — Target service registry (V1, P1).
 *
 * Trusted configuration data that pins the outbound side of every HTTP
 * capability: which origin a capability may reach and which audience its
 * access token must be minted for. Values mirror the deployed OpenClaw broker
 * targets (evidence: docs/investigations/broker-capability-parity.md §1.2 and
 * ~/.openclaw/openclaw.json):
 *
 *   svc-workflow → http://127.0.0.1:8989, audience `svc-workflow`
 *   svc-forum    → http://127.0.0.1:3460, audience `svc-forum`
 *   svc-okr      → http://127.0.0.1:3459, audience `svc-okr`
 *
 * The model can never influence origin/audience: a manifest's `http.target`
 * references a targetId, and the transport resolves it through this registry
 * (or the plugin Config override). No arbitrary URLs are ever fetchable.
 *
 * @typedef {{ targetId: string, allowedOrigin: string, audience: string }} Target
 */

/** Default target registry (deployment-local services). */
export const targets = [
  { targetId: 'svc-forum', allowedOrigin: 'http://127.0.0.1:3460', audience: 'svc-forum' },
  { targetId: 'svc-workflow', allowedOrigin: 'http://127.0.0.1:8989', audience: 'svc-workflow' },
  { targetId: 'svc-okr', allowedOrigin: 'http://127.0.0.1:3459', audience: 'svc-okr' },
]

/**
 * Build a targetId → target map.
 * @param {Target[]} [list]
 * @returns {Map<string, Target>}
 */
export function buildTargetMap(list = targets) {
  return new Map(list.map((t) => [t.targetId, t]))
}
