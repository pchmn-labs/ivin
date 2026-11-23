import { Effect, Queue, Stream } from "effect"
import { watch } from "node:fs"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export const readText = (path: string) =>
  Effect.tryPromise(() =>
    readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null
      throw error
    }),
  )

export const writeText = (path: string, text: string) =>
  Effect.tryPromise(async () => {
    const temp = `${path}.${randomUUID()}.tmp`
    try {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 })
      await writeFile(temp, text)
      await rename(temp, path)
    } finally {
      await rm(temp, { force: true })
    }
  })

// The text of `~/.ivin/<fileName>` when watched, then after each change; null while it does not exist.
export const watchIvinFile = (ivinHome: string, fileName: string): Stream.Stream<string | null> =>
  Stream.callback<void>((queue) =>
    Effect.gen(function* () {
      yield* Effect.tryPromise(() => mkdir(ivinHome, { recursive: true, mode: 0o700 })).pipe(
        Effect.catch((error) => Effect.logWarning(`could not create ${ivinHome}`, error)),
      )
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
