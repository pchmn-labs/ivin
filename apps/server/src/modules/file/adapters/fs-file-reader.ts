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
    Effect.tryPromise({ try: () => stat(path), catch: unreadable }).pipe(
      Effect.flatMap((info) =>
        info.isFile()
          ? Effect.succeed(info.size)
          : Effect.fail(new FileUnreadable({ reason: "missing" })),
      ),
    ),
  read: (path) => Effect.tryPromise({ try: () => readFile(path), catch: unreadable }),
})
