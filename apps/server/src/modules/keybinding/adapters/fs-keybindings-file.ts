import { Effect, Layer, Queue, Stream } from "effect"
import { watch } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { KeybindingsFile } from "../usecases/keybindings-file.ts"

const FILE_NAME = "keybindings.json"

const readText = (path: string) =>
  Effect.tryPromise(() =>
    readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null
      throw error
    }),
  )

// Watches the folder rather than the file: editors save by replacing it, and it may not exist yet.
export const layerFsKeybindingsFile = (ivinHome: string) =>
  Layer.succeed(KeybindingsFile)({
    contents: Stream.callback<void>((queue) =>
      Effect.gen(function* () {
        yield* Effect.promise(() => mkdir(ivinHome, { recursive: true }))
        yield* Effect.acquireRelease(
          Effect.sync(() =>
            watch(ivinHome, (_, fileName) => {
              if (fileName === FILE_NAME) Queue.offerUnsafe(queue, undefined)
            }),
          ),
          (watcher) => Effect.sync(() => watcher.close()),
        )
        Queue.offerUnsafe(queue, undefined)
      }),
    ).pipe(
      Stream.debounce("50 millis"),
      Stream.flatMap(() =>
        readText(join(ivinHome, FILE_NAME)).pipe(
          Stream.fromEffect,
          Stream.catch((error) =>
            Stream.fromEffect(Effect.logWarning("could not read keybindings.json", error)).pipe(
              Stream.drain,
            ),
          ),
        ),
      ),
      Stream.changes,
    ),
  })
