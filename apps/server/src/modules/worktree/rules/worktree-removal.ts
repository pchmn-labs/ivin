export interface SessionUse {
  readonly workingFolder: string
  readonly inWorktree: boolean
  readonly workingFolderDeleted: boolean
  // Its tab just closed.
  readonly closed: boolean
  // It has an open tab or a running agent.
  readonly inUse: boolean
}

export interface RemovalCandidate {
  readonly path: string
  // `agent`: a worktree under `.worktrees/` that no closed session was in.
  readonly origin: "session" | "agent"
}

export interface WorktreeState {
  // Untracked files count as changes.
  readonly clean: boolean
  readonly merged: boolean
  // Commits of the branch's own, merged or not.
  readonly hasCommits: boolean
}

const isInside = (folder: string, path: string) => folder === path || folder.startsWith(`${path}/`)

// `worktrees` are the project's linked worktrees, so the checkout is never among them.
export const removalCandidates = (
  projectPath: string,
  worktrees: readonly { readonly path: string; readonly branch: string | null }[],
  sessions: readonly SessionUse[],
): RemovalCandidate[] => {
  const used = (path: string) =>
    sessions.some((session) => session.inUse && isInside(session.workingFolder, path))
  const candidates = new Map<string, RemovalCandidate>()
  const listed = new Set(worktrees.map((worktree) => worktree.path))
  for (const session of sessions) {
    const path = session.workingFolder
    if (!session.closed || !session.inWorktree || session.workingFolderDeleted) continue
    if (path === projectPath || !listed.has(path) || used(path)) continue
    candidates.set(path, { path, origin: "session" })
  }
  for (const { path, branch } of worktrees) {
    if (candidates.has(path) || branch === null || used(path)) continue
    if (isInside(path, `${projectPath}/.worktrees`) && path !== projectPath) {
      candidates.set(path, { path, origin: "agent" })
    }
  }
  return [...candidates.values()]
}

// An agent's worktree with no commit yet may hold work about to start.
export const isRemovable = (origin: RemovalCandidate["origin"], state: WorktreeState) =>
  state.clean && state.merged && (origin === "session" || state.hasCommits)
