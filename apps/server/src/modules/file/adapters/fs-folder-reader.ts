import type { Dirent } from "node:fs"
import { readdir, realpath, stat } from "node:fs/promises"
import { join } from "node:path"
import { Effect, Layer } from "effect"
import { type FolderName, FolderReader, FolderUnreadable } from "../usecases/folder-reader.ts"

const kindOf = async (folder: string, entry: Dirent): Promise<FolderName["kind"]> => {
  if (!entry.isSymbolicLink()) return entry.isDirectory() ? "folder" : "file"
  const target = await stat(join(folder, entry.name)).catch(() => null)
  return target?.isDirectory() ? "folder" : "file"
}

const unreadable = (error: unknown) =>
  new FolderUnreadable({
    reason: (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : "unreadable",
  })

const walk = async (root: string, limit: number): Promise<string[]> => {
  const files: string[] = []
  const pending = [""]
  for (let folder = pending.pop(); folder !== undefined; folder = pending.pop()) {
    const entries = await readdir(join(root, folder), { withFileTypes: true }).catch((error) => {
      // A folder that vanishes or locks mid-walk is skipped; only the root failing is an error.
      if (folder === "") throw error
      return []
    })
    for (const entry of entries) {
      const path = folder === "" ? entry.name : `${folder}/${entry.name}`
      if (entry.isDirectory()) {
        if (entry.name !== ".git") pending.push(path)
      } else files.push(path)
      if (files.length > limit) return files
    }
  }
  return files
}

export const layerFsFolderReader = Layer.succeed(FolderReader)({
  realPath: (path) => Effect.promise(() => realpath(path).catch(() => null)),
  readEntries: (folder) =>
    Effect.tryPromise({
      try: async () => {
        const entries = await readdir(folder, { withFileTypes: true })
        return Promise.all(
          entries.map(async (entry) => ({ name: entry.name, kind: await kindOf(folder, entry) })),
        )
      },
      catch: unreadable,
    }),
  walkFiles: (folder, limit) =>
    Effect.tryPromise({ try: () => walk(folder, limit), catch: unreadable }),
})
