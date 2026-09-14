import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { acquireConsistentHealthSnapshot, projectSchedulerHealth, validateCanonicalHealthAuthority } from '../../../scheduler/src/watchdog/health.js'
import { loadIncidentState } from '../../../scheduler/src/watchdog/durable-state.js'
import { ROUTE_CLASSES, readProtectedRoutingManifest, resolveNotificationRoute, validateIncidentDeliveryBindings } from '../../../scheduler/src/watchdog/routing.js'
import { loadCredentialsStore } from '../../../broker/src/credential-store.js'

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function token(path) {
  try { return digest(await readFile(path)) } catch { return null }
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function parseRuns(text) {
  if (text.trim() === '') return []
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function targetRef(route) {
  return route?.to ? `sha256:${digest(Buffer.from(route.to, 'utf8'))}` : null
}

function routeSource(source) {
  return ({
    jobFailureTargets: 'job_failure_override',
    ownerTargets: 'owner',
    canonicalOpsTarget: 'canonical_ops',
  })[source] ?? 'local_ops_sink'
}

export function createSchedulerHealthRuntime({ layout, runtimeGeneration, nowMs = Date.now, routingSecurity, incidentOwnership, credentialStoreFile, runtimeHealth } = {}) {
  if (!layout) throw new TypeError('scheduler health runtime requires layout')
  const sources = [
    { name: 'jobs', path: layout.jobsStore, capture: async () => validateCanonicalHealthAuthority(await json(layout.jobsStore)) },
    { name: 'history', path: layout.runsLog, capture: async () => parseRuns(await readFile(layout.runsLog, 'utf8')) },
    { name: 'routing', path: layout.schedulerRoutingManifest, capture: async () => readProtectedRoutingManifest(layout.schedulerRoutingManifest, routingSecurity).manifest },
    { name: 'incidents', path: layout.schedulerIncidentState, capture: async () => loadIncidentState(layout.schedulerIncidentState, incidentOwnership).state },
    {
      name: 'credentials', path: credentialStoreFile,
      capture: async () => Object.fromEntries(Object.keys(loadCredentialsStore(credentialStoreFile)).map((agentId) => [agentId, true])),
    },
  ].map((source) => ({ ...source, token: () => token(source.path) }))

  return {
    async read() {
      let acquired
      try {
        acquired = await acquireConsistentHealthSnapshot(sources, { maxAttempts: 3 })
      } catch (error) {
        acquired = {
          complete: false,
          generations: sources.map((source) => ({ source: source.name, trusted: false, start: null, end: null })),
          censusError: `health source unavailable: ${error?.message ?? error}`,
        }
      }
      const captured = acquired.sources ?? {}
      const jobsGeneration = acquired.generations?.find((item) => item.source === 'jobs')
      const jobsDoc = jobsGeneration?.trusted === true && jobsGeneration.start === jobsGeneration.end ? captured.jobs : null
      const manifest = captured.routing
      const observedAt = nowMs()
      try {
        validateIncidentDeliveryBindings(captured.incidents, { manifest, jobs: jobsDoc?.jobs,
          routingSha256: acquired.generations?.find((item) => item.source === 'routing')?.end, nowMs: observedAt })
      } catch (error) {
        acquired.complete = false
        acquired.censusError = `health incident binding unavailable: ${error?.message ?? error}`
      }
      const routes = Object.fromEntries((jobsDoc?.jobs ?? []).map((job) => {
        const decision = resolveNotificationRoute({ routeClass: ROUTE_CLASSES.JOB_FAILURE, job, manifest })
        return [job.id, {
          class: ROUTE_CLASSES.JOB_FAILURE,
          ready: decision.route != null,
          source: routeSource(decision.routeSource),
          status: decision.route ? (decision.alertTargetMissing ? 'FALLBACK_CONFIG_MISSING' : 'READY') : 'CONFIG_MISSING',
          targetRef: targetRef(decision.route),
        }]
      }))
      return projectSchedulerHealth({
        version: jobsDoc?.version,
        generatedAt: observedAt,
        jobs: jobsDoc?.jobs ?? null,
        occurrences: jobsDoc?.occurrences ?? [],
        fences: jobsDoc?.fences ?? {},
        history: captured.history ?? [],
        runtimeHealth,
        credentials: captured.credentials ?? {},
        routes,
        incidents: captured.incidents?.incidents ?? {},
        provenance: {
          canonicalPair: acquired.complete === true && /^[0-9a-f]{40}$/.test(runtimeGeneration ?? '')
            && typeof layout.jobsStore === 'string' && layout.jobsStore.startsWith('/'),
          runtime: runtimeGeneration ?? null,
          store: acquired.generations?.find((item) => item.source === 'jobs')?.end ?? null,
          routing: acquired.generations?.find((item) => item.source === 'routing')?.end ?? null,
          incidents: acquired.generations?.find((item) => item.source === 'incidents')?.end ?? null,
          storePath: layout.jobsStore,
        },
        generations: acquired.generations,
        censusError: acquired.censusError,
      })
    },
  }
}

export function mountSchedulerHealthRuntime({ ctx, layout, runtimeGeneration, nowMs, routingSecurity, incidentOwnership, credentialStoreFile } = {}) {
  const runtime = createSchedulerHealthRuntime({ layout, runtimeGeneration, nowMs, routingSecurity, incidentOwnership, credentialStoreFile })
  ctx.provide('schedulerHealth', () => runtime.read())
  return runtime
}

export function mountConfiguredSchedulerHealthRuntime({ ctx, layout, opts = {} } = {}) {
  return mountSchedulerHealthRuntime({
    ctx,
    layout,
    runtimeGeneration: opts.runtimeGeneration ?? process.env.AGENT_CORE_DEPLOYED_SHA,
    routingSecurity: opts.schedulerRoutingSecurity ?? {
      expectedUid: Number(process.env.SCHEDULER_ROUTING_OWNER_UID ?? 0),
      allowedGids: Number.isInteger(Number(process.env.SCHEDULER_ROUTING_READER_GID))
        ? [Number(process.env.SCHEDULER_ROUTING_READER_GID)] : [],
      maxMode: 0o640,
    },
    incidentOwnership: opts.schedulerIncidentOwnership ?? {
      expectedUid: Number(process.env.SCHEDULER_INCIDENT_OWNER_UID ?? process.getuid?.()),
      expectedGid: Number(process.env.SCHEDULER_INCIDENT_OWNER_GID ?? process.getgid?.()),
    },
    credentialStoreFile: opts.broker?.credentialsFile ?? process.env.AGENT_CORE_CREDENTIALS_FILE,
  })
}

export function createSchedulerRuntimeStarter({ schedulerHealth, scheduler, workflowExecution, catchup, readinessRequired }) {
  return async () => {
    if (readinessRequired === true) assertSchedulerStartupReady(await schedulerHealth.read())
    await scheduler.start({ autoStart: true, catchup })
    workflowExecution.start()
  }
}

export function assertSchedulerStartupReady(health) {
  if (health?.complete !== true) {
    throw Object.assign(new Error(`scheduler startup readiness failed: ${health?.censusError ?? 'incomplete canonical health census'}`), { code: 'SCHEDULER_HEALTH_INCOMPLETE' })
  }
  return true
}
