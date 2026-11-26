import { Cause, Effect, Queue, Stream } from "effect"
import { watch, type FSWatcher } from "node:fs"
import { mkdir, readdir, stat } from "node:fs/promises"
import { join } from "node:path"

const SETTLE_MS = 100

const isIgnored = (path: string) =>
  path.split(/[/\\]/).some((part) => part.startsWith(".") || part === "node_modules")

// A burst of writes to one plugin's folder is one change, sent once it has been quiet for SETTLE_MS.
export const pluginFolderChanges = (pluginsFolder: string): Stream.Stream<string> =>
  Stream.callback<string>((queue) =>
    Effect.gen(function* () {
      const watchers = new Map<string, FSWatcher>()
      const timers = new Map<string, NodeJS.Timeout>()
      const changed = (name: string) => {
        clearTimeout(timers.get(name))
        timers.set(
          name,
          setTimeout(() => {
            timers.delete(name)
            Queue.offerUnsafe(queue, name)
          }, SETTLE_MS),
        )
      }
      const fail = (error: unknown) => Queue.failCauseUnsafe(queue, Cause.die(error))
      // The path as it is in the plugins folder: a link to the author's own folder is followed.
      const watchFolder = (name: string) => {
        if (watchers.has(name)) return
        try {
          watchers.set(
            name,
            watch(join(pluginsFolder, name), { recursive: true }, (_, file) => {
              if (file === null || !isIgnored(file)) changed(name)
            }).on("error", () => {
              watchers.get(name)?.close()
              watchers.delete(name)
              changed(name)
            }),
          )
        } catch {
          // The folder went away before the watcher opened; the root watcher saw it go.
        }
      }
      yield* Effect.acquireRelease(
        Effect.tryPromise(async () => {
          // Created here so a plugin made later (`ivin plugin new`) is watched too.
          await mkdir(pluginsFolder, { recursive: true, mode: 0o700 })
          for (const name of await readdir(pluginsFolder).catch(() => [])) {
            if (
              !name.startsWith(".") &&
              (await stat(join(pluginsFolder, name)).then(
                (s) => s.isDirectory(),
                () => false,
              ))
            ) {
              watchFolder(name)
            }
          }
          return watch(pluginsFolder, (_, name) => {
            if (name === null || name.startsWith(".")) return
            void stat(join(pluginsFolder, name)).then(
              (s) => {
                // A folder already watched reports its own files; the root only announces new ones.
                if (!s.isDirectory() || watchers.has(name)) return
                watchFolder(name)
                changed(name)
              },
              () => {
                // The root also names its own parent when that changes: only a watched folder can be removed.
                if (!watchers.has(name)) return
                watchers.get(name)?.close()
                watchers.delete(name)
                changed(name)
              },
            )
          }).on("error", fail)
        }),
        (root) =>
          Effect.sync(() => {
            root.close()
            for (const watcher of watchers.values()) watcher.close()
            for (const timer of timers.values()) clearTimeout(timer)
          }),
      )
    }).pipe(
      Effect.catch((error) => Effect.logWarning("could not watch the plugins folder", error)),
    ),
  )
