import type { Dirent } from "node:fs"
import { readdir, realpath, stat } from "node:fs/promises"
import { join } from "node:path"
import type { FolderEntry } from "@ivin/contracts/file"
import { Effect, Layer } from "effect"
import { FolderReader, FolderUnreadable } from "../usecases/folder-reader.ts"

const kindOf = async (folder: string, entry: Dirent): Promise<FolderEntry["kind"]> => {
  if (!entry.isSymbolicLink()) return entry.isDirectory() ? "folder" : "file"
  const target = await stat(join(folder, entry.name)).catch(() => null)
  return target?.isDirectory() ? "folder" : "file"
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
      catch: (error) =>
        new FolderUnreadable({
          reason: (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : "unreadable",
        }),
    }),
})
