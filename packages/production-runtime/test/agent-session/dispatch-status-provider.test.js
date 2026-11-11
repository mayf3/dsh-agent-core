import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAgentSessionMessagingAccess } from '../../src/agent-session-messaging.js'
import { readAgentSessionDispatchStatus } from '../../src/agent-session/dispatch-status.js'
import { CALLER, TRACE, statusRig } from './fixtures/status-rig.js'

function provider(dispatchStatus) {
  const unexpected = () => { throw new Error('status attempted a mutation') }
  return createAgentSessionMessagingAccess({
    router: { deliver: unexpected, readFinalAssistantOutput: unexpected, onTurnReconciled: unexpected },
    audit: { appendIntent: unexpected, appendOutcome: unexpected, appendDenial: unexpected }, dispatchStatus,
  })
}

test('ACC-012: provider status binds trusted caller and runs the real read-only reader', async t => {
  const fx = statusRig(t)
  const access = provider(({ args, callerAgentId }) => readAgentSessionDispatchStatus({ ...fx.deps, args, callerAgentId }))
  assert.equal(typeof access.handlers.agent_session_dispatch_status?.status, 'function')
  const out = await access.handlers.agent_session_dispatch_status.status(TRACE, { callerAgentId: CALLER })
  assert.equal(out.result.turnState, 'completed')
  const foreign = await access.handlers.agent_session_dispatch_status.status(TRACE, { callerAgentId: 'agt_Other' })
  assert.equal(foreign.error.code, 'not_found_or_not_owned')
})

test('ACC-012: absent/failing reader returns fixed sanitized errors', async () => {
  for (const read of [undefined, () => { throw new Error('/private/SECRET') }]) {
    const access = provider(read)
    assert.equal(typeof access.handlers.agent_session_dispatch_status?.status, 'function')
    const out = await access.handlers.agent_session_dispatch_status.status(TRACE, { callerAgentId: CALLER })
    assert.equal(out.error.code, 'internal_error')
    assert.equal(JSON.stringify(out).includes('SECRET'), false)
  }
})
