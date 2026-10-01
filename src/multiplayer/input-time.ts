/** DOM capture time in the performance.now() domain. No handler-time fallback.
 * Accept relative timestamps or legacy epoch timestamps only when they yield
 * exactly one finite, nonnegative, nonfuture capture time. Ambiguity is rejected.
 */
export function captureTime(timestamp: number, now: number, timeOrigin: number): number | null {
  if (![timestamp, now, timeOrigin].every(Number.isFinite) || now < 0 || timeOrigin < 0) return null;
  const candidates = new Set([timestamp, timestamp - timeOrigin].filter(t => t >= 0 && t <= now));
  return candidates.size === 1 ? [...candidates][0] : null;
}
