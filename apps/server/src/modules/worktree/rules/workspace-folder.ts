const nameOf = (folder: string) => folder.slice(folder.lastIndexOf("/") + 1)

// Where a session that stays on the checkouts starts: the first folder, with the others as extra
// directories.
export const checkoutStart = (folders: readonly string[]) => {
  const [first] = folders
  if (first === undefined) return null
  return { cwd: first, extraDirectories: folders.slice(1) }
}

// A subfolder of the working folder per project folder: its name, `-2`, `-3` when names collide.
export const subfolderNames = (folders: readonly string[]) => {
  const used = new Set<string>()
  return folders.map((folder) => {
    const name = nameOf(folder)
    let candidate = name
    for (let n = 2; used.has(candidate); n++) candidate = `${name}-${n}`
    used.add(candidate)
    return candidate
  })
}

// `ivin/<8 characters of the id>`, or with `-2`, `-3` when a repository has it or its folder exists.
export const freeWorkspaceBranch = (
  sessionId: string,
  isTaken: (branch: string) => boolean,
): string => {
  const first = `ivin/${sessionId.slice(0, 8)}`
  for (let n = 1; ; n++) {
    const branch = n === 1 ? first : `${first}-${n}`
    if (!isTaken(branch)) return branch
  }
}

// Holds every working folder of the workspace.
export const workspaceFolderPath = (root: string, workspaceName: string) =>
  `${root.replace(/\/+$/, "")}/${workspaceName}`

export const workingFolderPath = (root: string, workspaceName: string, branch: string) =>
  `${workspaceFolderPath(root, workspaceName)}/${branch.replaceAll("/", "-")}`

export interface WorkingFolderWorktree {
  readonly repository: string
  readonly path: string
  readonly branch: string | null
}

export interface WorkingFolder {
  readonly path: string
  // The branch every worktree is on; null when they differ or one is detached.
  readonly branch: string | null
  readonly worktrees: readonly WorkingFolderWorktree[]
}

// The working folders under `workspaceFolder` (`<root>/<workspace name>`), from each repository's
// linked worktrees, sorted by path.
export const workingFoldersOf = (
  workspaceFolder: string,
  worktrees: readonly WorkingFolderWorktree[],
): WorkingFolder[] => {
  const prefix = `${workspaceFolder.replace(/\/+$/, "")}/`
  const byFolder = new Map<string, WorkingFolderWorktree[]>()
  for (const worktree of worktrees) {
    if (!worktree.path.startsWith(prefix)) continue
    const [name, sub] = worktree.path.slice(prefix.length).split("/")
    if (!name || !sub) continue
    const path = `${prefix}${name}`
    byFolder.set(path, [...(byFolder.get(path) ?? []), worktree])
  }
  return [...byFolder.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, inside]) => {
      const [first] = inside
      const shared = inside.every((w) => w.branch === first?.branch)
        ? (first?.branch ?? null)
        : null
      return { path, branch: shared, worktrees: inside }
    })
}
