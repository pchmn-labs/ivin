import { Effect, Layer } from "effect"
import { readFileSync, realpathSync, statSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { isInTrustedProject } from "../rules/trusted-project.ts"
import { ProjectTrust } from "../usecases/project-trust.ts"
import { ProjectStore } from "../usecases/project-store.ts"

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

export const layerFsProjectTrust = Layer.effect(ProjectTrust)(
  Effect.gen(function* () {
    const store = yield* ProjectStore
    return {
      isTrusted: (folder) =>
        store.trustedProjects.pipe(
          Effect.map((trusted) => {
            const real = realPath(folder)
            return isInTrustedProject(trusted.map(realPath), {
              folder: real,
              checkout: checkoutOf(real),
            })
          }),
        ),
      trust: (folder) => store.trust(realPath(folder)),
    }
  }),
)
