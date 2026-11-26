const nameOf = (folder: string) => folder.slice(folder.lastIndexOf("/") + 1)

// Where a session that stays on the checkouts starts: the first folder, with the others as extra
// directories. Never the folders' common parent, where the agent could reach folders outside them.
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

export const workingFolderPath = (root: string, workspaceName: string, branch: string) =>
  `${root.replace(/\/+$/, "")}/${workspaceName}/${branch.replaceAll("/", "-")}`
