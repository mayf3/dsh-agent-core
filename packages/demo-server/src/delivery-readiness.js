/** No-prompt application-layer acknowledgement of a prepared native session.
 * getOrCreateSession awaits the shared creation/resume promise and verifies
 * the persisted workspace before this signal can be emitted. No followup,
 * model generation or provider network probe is initiated by this method.
 */
export async function prepareSessionDelivery(seam, params) {
  if (params?.version !== 1 || typeof params?.sessionId !== 'string' || params.sessionId === '') {
    throw Object.assign(new Error('invalid delivery preparation protocol'), {
      code: 'AGENT_DELIVERY_PREPARE_PROTOCOL',
    })
  }
  try {
    await seam.getOrCreateSession(params.sessionId, params.cwd, params.privateSession === true)
  } catch (error) {
    if (params.privateSession === true) {
      throw Object.assign(new Error('session preparation failed'), {
        code: typeof error?.code === 'string' ? error.code : 'AGENT_DELIVERY_PREPARE_FAILED',
      })
    }
    throw error
  }
  return { version: 1, ready: true, sessionId: params.sessionId }
}
