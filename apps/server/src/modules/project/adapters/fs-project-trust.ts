import { Effect, Layer } from "effect"
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { isInTrustedProject } from "../rules/trusted-project.ts"
import { ProjectTrust } from "../usecases/project-trust.ts"
import { ProjectStore } from "../usecases/project-store.ts"
import { WorkingFolderRoot } from "../usecases/working-folder-root.ts"

const realPath = (path: string) => {
  try {
    return realpathSync(path)
  } catch {
    return resolve(path)
  }
}

const readText = (path: string) => {
  try {
    return readFileSync(path, "utf8").trim()
  } catch {
    return null
  }
}

const checkoutOf = (folder: string): string | null => {
  for (let dir = folder; ; dir = dirname(dir)) {
    const dotGit = join(dir, ".git")
    const stat = statSync(dotGit, { throwIfNoEntry: false })
    if (stat?.isDirectory()) return dir
    if (stat?.isFile()) {
      const pointer = readText(dotGit)?.match(/^gitdir: (.+)$/m)?.[1]
      if (pointer === undefined) return null
      const gitDir = resolve(dir, pointer)
      // Only the repository's own record of this worktree proves the `.git` file is not a forgery.
      const back = readText(join(gitDir, "gitdir"))
      if (back === null || realPath(resolve(gitDir, back)) !== realPath(dotGit)) return null
      const common = readText(join(gitDir, "commondir"))
      const commonDir = realPath(common === null ? gitDir : resolve(gitDir, common))
      return basename(commonDir) === ".git" ? dirname(commonDir) : commonDir
    }
    if (dirname(dir) === dir) return null
  }
}

// Mirrors `workingFolderPath` in the worktree rules.
const workingFolderOf = (root: string, folder: string): string | null => {
  const base = root.endsWith("/") ? root : `${root}/`
  if (!folder.startsWith(base)) return null
  const [workspace, branch] = folder.slice(base.length).split("/")
  return workspace && branch ? join(root, workspace, branch) : null
}

const subfoldersOf = (workingFolder: string): string[] => {
  try {
    return readdirSync(workingFolder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(workingFolder, entry.name))
  } catch {
    return []
  }
}

export const layerFsProjectTrust = Layer.effect(ProjectTrust)(
  Effect.gen(function* () {
    const store = yield* ProjectStore
    const workingFolderRoot = (yield* WorkingFolderRoot).path
    return {
      isTrusted: (folder) =>
        store.trustedProjects.pipe(
          Effect.map((trusted) => {
            const real = realPath(folder)
            const trustedReal = trusted.map(realPath)
            const place = { folder: real, checkout: checkoutOf(real) }
            if (isInTrustedProject(trustedReal, place)) return true
            // A working folder's own folder is trusted when each of its worktrees is of a trusted repository.
            const working = workingFolderOf(realPath(workingFolderRoot), real)
            if (working === null) return false
            const worktrees = subfoldersOf(working).filter((sub) => checkoutOf(sub) !== null)
            return (
              worktrees.length > 0 &&
              real === working &&
              worktrees.every((sub) =>
                isInTrustedProject(trustedReal, { folder: sub, checkout: checkoutOf(sub) }),
              )
            )
          }),
        ),
      trust: (folder) => store.trust(realPath(folder)),
    }
  }),
)
