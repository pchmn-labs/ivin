import type { Session } from "@ivin/plugin-api/ui"

type WorkingSession = Pick<Session, "id" | "projectPath" | "status"> & {
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
