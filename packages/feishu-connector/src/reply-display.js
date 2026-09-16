/**
 * Conservative, local-only media marker check for Router success replies.
 * It deliberately does not parse, fetch, normalize, or rewrite the answer.
 */
export function containsConservativeMediaMarker(text) {
  const body = String(text ?? '')
  return body.includes('![') || /<(?:img|image|video|audio)/i.test(body)
}
