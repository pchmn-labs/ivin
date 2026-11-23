import { Effect, Layer } from "effect"
import { readFileSync, realpathSync, statSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { isInTrustedProject } from "../rules/trusted-project.ts"
import { FolderTrust } from "../usecases/folder-trust.ts"
import { ProjectStore } from "../usecases/project-store.ts"

const realPath = (path: string) => {
  try {
    return realpathSync(path)
  } catch {
    return resolve(path)
  }
}

const readGitFile = (path: string) => {
  try {
    return readFileSync(path, "utf8").trim()
  } catch {
    return null
  }
}

// Read from the files git reads, so finding it runs no git command.
const checkoutOf = (folder: string): string | null => {
  for (let dir = folder; ; dir = dirname(dir)) {
    const dotGit = join(dir, ".git")
    const stat = statSync(dotGit, { throwIfNoEntry: false })
    if (stat?.isDirectory()) return dir
    if (stat?.isFile()) {
      const pointer = readGitFile(dotGit)?.match(/^gitdir: (.+)$/m)?.[1]
      if (pointer === undefined) return null
      const gitDir = resolve(dir, pointer)
      const common = readGitFile(join(gitDir, "commondir"))
      const commonDir = realPath(common === null ? gitDir : resolve(gitDir, common))
      return basename(commonDir) === ".git" ? dirname(commonDir) : commonDir
    }
    if (dirname(dir) === dir) return null
  }
}

export const layerFsFolderTrust = Layer.effect(FolderTrust)(
  Effect.gen(function* () {
    const store = yield* ProjectStore
    return {
      isTrusted: (folder) =>
        store.trustedFolders.pipe(
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
