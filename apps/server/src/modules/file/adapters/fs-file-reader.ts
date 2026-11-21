import { readFile, stat } from "node:fs/promises"
import { Effect, Layer } from "effect"
import { FileReader, FileUnreadable } from "../usecases/file-reader.ts"

const unreadable = (error: unknown) =>
  new FileUnreadable({
    reason:
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error as NodeJS.ErrnoException).code === "ENOTDIR"
        ? "missing"
        : "unreadable",
  })

export const layerFsFileReader = Layer.succeed(FileReader)({
  size: (path) =>
    Effect.tryPromise({
      try: async () => {
        const info = await stat(path)
        if (!info.isFile()) throw Object.assign(new Error("not a file"), { code: "ENOENT" })
        return info.size
      },
      catch: unreadable,
    }),
  read: (path) => Effect.tryPromise({ try: () => readFile(path), catch: unreadable }),
})
