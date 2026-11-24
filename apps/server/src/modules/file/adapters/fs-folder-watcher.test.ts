import { Effect, Fiber, Stream } from "effect"
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, test } from "vitest"
import { FolderWatcher } from "../usecases/folder-watcher.ts"
import { layerFsFolderWatcher } from "./fs-folder-watcher.ts"

let folder: string

beforeEach(() => {
  folder = realpathSync(mkdtempSync(join(tmpdir(), "ivin-fs-watcher-")))
  mkdirSync(join(folder, "dist"))
})

afterEach(() => rmSync(folder, { recursive: true, force: true }))

const collect = (skip: (path: string) => boolean, until: string) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const stream = yield* (yield* FolderWatcher).open(folder, skip)
      const seen: string[] = []
      const done = stream.pipe(
        Stream.tap((path) => Effect.sync(() => seen.push(path))),
        Stream.takeUntil((path) => path === until),
        Stream.runDrain,
        Effect.forkScoped,
      )
      const fiber = yield* done
      // The OS watcher has no ready signal: write until the last expected path arrives.
      yield* Effect.race(
        Effect.gen(function* () {
          for (let index = 0; ; index++) {
            writeFileSync(join(folder, "dist", `out-${index}.js`), "")
            writeFileSync(join(folder, until), String(index))
            yield* Effect.sleep("50 millis")
          }
        }),
        Fiber.join(fiber),
      )
      return seen
    }).pipe(Effect.provide(layerFsFolderWatcher), Effect.scoped),
  )

test("a path the skip predicate rejects is never queued", async () => {
  const seen = await collect((path) => path.startsWith("dist"), "kept.txt")
  expect(seen.length).toBeGreaterThan(0)
  expect(seen.filter((path) => path.startsWith("dist"))).toEqual([])
})
