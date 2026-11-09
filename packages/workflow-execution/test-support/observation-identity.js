/** Identity copied from the test observer's actual pre-submit snapshot. */
export function expectedIdentity(attempt) {
  return { expectedAttemptId: attempt.attemptId, expectedGeneration: attempt.generation ?? 1 }
}
