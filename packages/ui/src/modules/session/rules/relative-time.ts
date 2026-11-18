const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function relativeTime(thenMs: number, nowMs: number): string {
  const elapsed = nowMs - thenMs
  if (elapsed < MINUTE) return "now"
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h`
  return `${Math.floor(elapsed / DAY)} d`
}
