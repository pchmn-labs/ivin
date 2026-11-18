import { Effect, Queue, Stream } from "effect"
import { watch } from "node:fs"
import { mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"

const readText = (path: string) =>
  Effect.tryPromise(() =>
    readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null
      throw error
    }),
  )

// The text of `~/.ivin/<fileName>` when watched, then after each change; null while it does not exist.
export const watchIvinFile = (ivinHome: string, fileName: string): Stream.Stream<string | null> =>
  Stream.callback<void>((queue) =>
    Effect.gen(function* () {
      yield* Effect.promise(() => mkdir(ivinHome, { recursive: true }))
      yield* Effect.acquireRelease(
        Effect.sync(() =>
          // The folder, not the file: editors save by replacing it, and it may not exist yet.
          watch(ivinHome, (_, changed) => {
            if (changed === fileName) Queue.offerUnsafe(queue, undefined)
          }).on("error", (error) =>
            // Without a listener, losing the folder would crash the server.
            Effect.runFork(Effect.logWarning(`stopped watching ${fileName}`, error)),
          ),
        ),
        (watcher) => Effect.sync(() => watcher.close()),
      )
      Queue.offerUnsafe(queue, undefined)
    }),
  ).pipe(
    Stream.debounce("50 millis"),
    Stream.flatMap(() =>
      readText(join(ivinHome, fileName)).pipe(
        Stream.fromEffect,
        Stream.catch((error) =>
          Stream.fromEffect(Effect.logWarning(`could not read ${fileName}`, error)).pipe(
            Stream.drain,
          ),
        ),
      ),
    ),
    Stream.changes,
  )
