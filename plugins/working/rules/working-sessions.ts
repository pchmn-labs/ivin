interface WorkingSession {
  readonly id: string
  readonly projectPath: string
  readonly status: "working" | "waiting" | "idle" | "failed"
  readonly statusChangedAt: { readonly epochMilliseconds: number }
}

export const workingSessions = <S extends WorkingSession>(
  sessions: ReadonlyArray<S>,
  projects: ReadonlyArray<{ readonly path: string }>,
  onScreenSessionId: string | null,
) => {
  const rank = new Map(projects.map((project, index) => [project.path, index]))
  const listed = sessions
    .filter((s) => s.id !== onScreenSessionId && rank.has(s.projectPath))
    .toSorted(
      (a, b) =>
        rank.get(a.projectPath)! - rank.get(b.projectPath)! ||
        a.statusChangedAt.epochMilliseconds - b.statusChangedAt.epochMilliseconds,
    )
  return {
    needsYou: listed.filter((s) => s.status === "waiting"),
    running: listed.filter((s) => s.status === "working"),
  }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const elapsed = (sinceMs: number, nowMs: number): string => {
  const time = nowMs - sinceMs
  if (time < MINUTE) return "<1 min"
  if (time < HOUR) return `${Math.floor(time / MINUTE)} min`
  if (time < DAY) return `${Math.floor(time / HOUR)} h`
  return `${Math.floor(time / DAY)} d`
}
