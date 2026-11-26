import { Duration, Effect, Fiber, Stream } from "effect"
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test, vi } from "vitest"
import { pluginFolderChanges } from "./plugin-folder-changes.ts"

vi.setConfig({ testTimeout: 10_000 })

const tempFolder = () => mkdtempSync(join(tmpdir(), "ivin-changes-"))

// Collects the names sent until `act` is done and the stream has been quiet for a moment.
const changesDuring = async (
  folder: string,
  act: () => void | Promise<void>,
  watching: (folder: string) => Stream.Stream<string> = pluginFolderChanges,
) => {
  // macOS reports the writes of the last moments before a watcher opens.
  await new Promise((resolve) => setTimeout(resolve, 800))
  return Effect.runPromise(
    Effect.gen(function* () {
      const names: string[] = []
      const fiber = yield* watching(folder).pipe(
        Stream.runForEach((name) => Effect.sync(() => void names.push(name))),
        Effect.forkChild,
      )
      yield* Effect.sleep(Duration.millis(200))
      yield* Effect.promise(async () => act())
      yield* Effect.sleep(Duration.millis(600))
      yield* Fiber.interrupt(fiber)
      return names
    }),
  )
}

test("a burst of writes to a plugin's files is one change, named after its folder", async () => {
  const folder = tempFolder()
  mkdirSync(join(folder, "a", "src"), { recursive: true })

  const names = await changesDuring(folder, () => {
    writeFileSync(join(folder, "a", "src", "ui.tsx"), "1")
    writeFileSync(join(folder, "a", "src", "ui.tsx"), "2")
    writeFileSync(join(folder, "a", "package.json"), "{}")
  })

  expect(names).toEqual(["a"])
})

test("a folder that appears is a change, and its files are watched from then on", async () => {
  const folder = tempFolder()

  const names = await changesDuring(folder, async () => {
    mkdirSync(join(folder, "late"))
    await new Promise((resolve) => setTimeout(resolve, 300))
    writeFileSync(join(folder, "late", "package.json"), "{}")
  })

  expect(names).toEqual(["late", "late"])
})

test("node_modules and dot folders do not count, and a linked plugin folder is followed", async () => {
  const folder = tempFolder()
  const author = tempFolder()
  mkdirSync(join(folder, "a", "node_modules"), { recursive: true })
  mkdirSync(join(folder, "a", ".git"))
  symlinkSync(author, join(folder, "linked"))

  const names = await changesDuring(folder, () => {
    writeFileSync(join(folder, "a", "node_modules", "x.js"), "1")
    writeFileSync(join(folder, "a", ".git", "HEAD"), "1")
    writeFileSync(join(author, "ui.tsx"), "1")
  })

  expect(names).toEqual(["linked"])
})

test("a plugins folder that does not exist yet is created, so a plugin made later is seen", async () => {
  const folder = join(tempFolder(), "plugins")

  const names = await changesDuring(folder, () => {
    mkdirSync(join(folder, "new"))
  })

  expect(names).toEqual(["new"])
  rmSync(folder, { recursive: true })
})

test("a project's plugins folder is never created, and is watched once it exists", async () => {
  const project = tempFolder()
  const plugins = join(project, ".ivin", "plugins")
  const watch = (create: boolean) => (folder: string) => pluginFolderChanges(folder, create)

  const missing = await changesDuring(plugins, () => undefined, watch(false))
  expect(missing).toEqual([])
  expect(existsSync(plugins)).toBe(false)

  mkdirSync(join(plugins, "a"), { recursive: true })
  const present = await changesDuring(
    plugins,
    () => writeFileSync(join(plugins, "a", "package.json"), "{}"),
    watch(false),
  )
  expect(present).toEqual(["a"])
})
