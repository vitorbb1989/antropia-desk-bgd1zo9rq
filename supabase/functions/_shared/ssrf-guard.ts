/** Validates that a URL is safe to fetch (blocks internal/private networks) */
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    const host = parsed.hostname.toLowerCase()
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === 'metadata.google.internal' ||
      host === '169.254.169.254' ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^0\./.test(host) ||
      /^fd[0-9a-f]{2}:/.test(host) ||
      /^fe80:/.test(host)
    ) return false
    return true
  } catch {
    return false
  }
}
