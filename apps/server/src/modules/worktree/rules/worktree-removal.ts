export interface SessionUse {
  readonly workingFolder: string
  readonly inWorktree: boolean
  readonly workingFolderDeleted: boolean
  readonly tabJustClosed: boolean
  // It has an open tab or a running agent.
  readonly inUse: boolean
}

export interface RemovalCandidate {
  readonly path: string
  // `sweep`: a worktree under `.worktrees/` that no session whose tab just closed was in.
  readonly origin: "closedSession" | "sweep"
}

export interface WorktreeState {
  // Untracked files count as changes.
  readonly clean: boolean
  readonly merged: boolean
  // Commits of the branch's own, merged or not.
  readonly hasCommits: boolean
}

const isInside = (folder: string, path: string) => folder === path || folder.startsWith(`${path}/`)

export const isInUse = (path: string, sessions: readonly SessionUse[]) =>
  sessions.some((session) => session.inUse && isInside(session.workingFolder, path))

// Skips the checkout even when `worktrees` lists it; sweeps the worktrees under `sweptFolder`, none
// when it is null.
export const removalCandidates = (
  projectPath: string,
  worktrees: readonly { readonly path: string; readonly branch: string | null }[],
  sessions: readonly SessionUse[],
  sweptFolder: string | null = `${projectPath}/.worktrees`,
): RemovalCandidate[] => {
  const candidates = new Map<string, RemovalCandidate>()
  // A detached HEAD's commits may be reachable from nothing else.
  const removable = new Set(
    worktrees
      .filter(({ path, branch }) => branch !== null && path !== projectPath)
      .filter(({ path }) => !isInUse(path, sessions))
      .map(({ path }) => path),
  )
  for (const session of sessions) {
    const path = session.workingFolder
    if (!session.tabJustClosed || !session.inWorktree || session.workingFolderDeleted) continue
    if (removable.has(path)) candidates.set(path, { path, origin: "closedSession" })
  }
  for (const path of removable) {
    if (!candidates.has(path) && sweptFolder !== null && isInside(path, sweptFolder)) {
      candidates.set(path, { path, origin: "sweep" })
    }
  }
  return [...candidates.values()]
}

// A swept worktree with no commit yet may hold work an agent is about to start.
export const isRemovable = (origin: RemovalCandidate["origin"], state: WorktreeState) =>
  state.clean && state.merged && (origin === "closedSession" || state.hasCommits)

// A working folder of a workspace is judged as one: commits of its own in any of its worktrees.
export const workingFolderState = (states: readonly WorktreeState[]): WorktreeState => ({
  clean: states.every((state) => state.clean),
  merged: states.every((state) => state.merged),
  hasCommits: states.some((state) => state.hasCommits),
})
