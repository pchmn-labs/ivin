import { Duration, Effect, Fiber, Stream } from "effect"
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { expect, test, vi } from "vitest"
import { watchPluginFolders } from "../modules/plugin/usecases/watch-plugin-folders.ts"
import { packageJson, tempDir, withServer, writePlugin } from "./plugin-test-server.ts"

// Rolldown starts its native binding on the first compile, and each check starts the compiler.
vi.setConfig({ testTimeout: 60_000 })

const hello = (text: string) => ({
  "package.json": packageJson({ id: "hello", name: "Hello", ui: "src/ui.tsx" }),
  "src/ui.tsx": `export const activate = () => ${JSON.stringify(text)}\n`,
})

test("ivin plugin new gives a plugin that loads and passes the type check", async () => {
  const home = tempDir("home")

  const result = await withServer(home, (client) =>
    Effect.gen(function* () {
      const path = yield* client["plugin.create"]({ id: "demo" })
      const listed = yield* client["plugin.list"]().pipe(Stream.take(1), Stream.runCollect)
      return { path, listed: [...listed], errors: yield* client["plugin.check"]({ id: "demo" }) }
    }),
  )

  expect(result.path).toBe(join(home, "plugins", "demo"))
  expect(result.listed).toMatchObject([{ _tag: "compiled", id: "demo" }])
  expect(result.errors).toEqual([])
})

test("ivin plugin new refuses an id that is taken or malformed", async () => {
  const home = tempDir("home")
  writePlugin(home, "hello", hello("hi"))

  const failures = await withServer(home, (client) =>
    Effect.all([
      client["plugin.create"]({ id: "hello" }).pipe(Effect.flip),
      client["plugin.create"]({ id: "Not An Id" }).pipe(Effect.flip),
    ]),
  )

  expect(failures.map((failure) => failure.reason)).toEqual([
    expect.stringContaining("already holds a plugin with the id hello"),
    expect.stringContaining("lowercase letters"),
  ])
})

test("a type error shows in the check and in the log after a reload, and the plugin still loads", async () => {
  const home = tempDir("home")
  writePlugin(home, "demo", {})
  const result = await withServer(home, (client) =>
    Effect.gen(function* () {
      yield* client["plugin.create"]({ id: "demo" })
      writeFileSync(
        join(home, "plugins", "demo", "src", "server.ts"),
        'export const activate = () => { const answer: number = "forty-two"; console.log(answer) }\n',
      )
      const errors = yield* client["plugin.check"]({ id: "demo" })
      const status = yield* client["plugin.reload"]({ id: "demo" })
      const listed = yield* client["plugin.list"]().pipe(Stream.take(1), Stream.runCollect)
      return { errors, status, log: yield* client["plugin.readLog"]({ id: "demo" }), listed }
    }),
  )

  expect(result.errors).toEqual([
    expect.stringMatching(/^src\/server\.ts\(1,\d+\): error TS2322: .*string.*number/),
  ])
  expect(result.log.join("\n")).toContain("type error: src/server.ts(1,")
  expect(result.status).toMatchObject({ id: "demo", ui: "active" })
  expect(result.listed).toMatchObject([{ _tag: "compiled", id: "demo" }])
})

test("a plugin with no tsconfig.json cannot be checked, and says why", async () => {
  const home = tempDir("home")
  writePlugin(home, "hello", hello("hi"))

  const failure = await withServer(home, (client) =>
    client["plugin.check"]({ id: "hello" }).pipe(Effect.flip),
  )

  expect(failure).toMatchObject({
    _tag: "PluginCheckFailed",
    reason: expect.stringContaining("no tsconfig.json"),
  })
})

test("reloading or checking a plugin that does not exist fails with its id", async () => {
  const home = tempDir("home")

  const failures = await withServer(home, (client) =>
    Effect.all([
      client["plugin.reload"]({ id: "ghost" }).pipe(Effect.flip),
      client["plugin.check"]({ id: "ghost" }).pipe(Effect.flip),
    ]),
  )

  expect(failures).toMatchObject([
    { _tag: "PluginNotFound", id: "ghost" },
    { _tag: "PluginNotFound", id: "ghost" },
  ])
})

test("editing a plugin's UI half sends its new bundle on the open listing within a second", async () => {
  const home = tempDir("home")
  writePlugin(home, "hello", hello("first"))

  const result = await withServer(home, (client) =>
    Effect.gen(function* () {
      const watcher = yield* Effect.forkScoped(watchPluginFolders)
      const received: Array<{ bundle: string; at: number }> = []
      const listing = yield* client["plugin.list"]().pipe(
        Stream.runForEach((plugin) =>
          Effect.sync(() => {
            if (plugin._tag === "compiled") received.push({ bundle: plugin.bundle, at: Date.now() })
          }),
        ),
        Effect.forkScoped,
      )
      while (received.length < 1) yield* Effect.sleep(Duration.millis(20))
      const editedAt = Date.now()
      writeFileSync(
        join(home, "plugins", "hello", "src", "ui.tsx"),
        'export const activate = () => "second"\n',
      )
      while (received.length < 2) yield* Effect.sleep(Duration.millis(10))
      yield* Fiber.interrupt(listing)
      yield* Fiber.interrupt(watcher)
      return { received, elapsed: received[1]!.at - editedAt }
    }),
  )

  expect(result.received[1]!.bundle).not.toBe(result.received[0]!.bundle)
  expect(result.elapsed).toBeLessThan(1000)
})
