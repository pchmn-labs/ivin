const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const elapsed = (sinceMs: number, nowMs: number): string => {
  const time = nowMs - sinceMs
  if (time < MINUTE) return "now"
  if (time < HOUR) return `${Math.floor(time / MINUTE)} min`
  if (time < DAY) return `${Math.floor(time / HOUR)} h`
  return `${Math.floor(time / DAY)} d`
}
