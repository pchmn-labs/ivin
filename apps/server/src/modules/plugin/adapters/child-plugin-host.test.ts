import { Duration, Effect, Fiber, Layer, Stream } from "effect"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { expect, test, vi } from "vitest"
import { NO_PERMISSIONS } from "../rules/permissions.ts"
import { PluginHost, type RunningPluginHost } from "../usecases/plugin-host.ts"
import { layerPluginStubs } from "../usecases/plugin-stubs.ts"
import { runPluginHost } from "../usecases/run-plugin-host.ts"
import { serveHost } from "../usecases/serve-host.ts"
import { layerServerHalves, ServerHalves } from "../usecases/server-halves.ts"
import { UserPlugins } from "../usecases/user-plugins.ts"
import { layerChildPluginHost } from "./child-plugin-host.ts"
import { layerFsUserPlugins } from "./fs-user-plugins.ts"

// Each test starts Node and compiles with Rolldown.
vi.setConfig({ testTimeout: 30_000 })

const hostEntry = join(import.meta.dirname, "../../../plugin-host.ts")

const home = () => mkdtempSync(join(tmpdir(), "ivin-home-"))

const writePlugin = (ivinHome: string, id: string, server: string) => {
  const files = {
    "package.json": JSON.stringify({ ivin: { id, server: "src/server.ts" } }),
    "src/server.ts": server,
  }
  for (const [path, text] of Object.entries(files)) {
    const file = join(ivinHome, "plugins", id, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
}

const withHost = <A>(
  ivinHome: string,
  use: (services: {
    readonly halves: ServerHalves["Service"]
    readonly logOf: (id: string) => Effect.Effect<ReadonlyArray<string>>
  }) => Effect.Effect<A>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const halves = yield* ServerHalves
      const plugins = yield* UserPlugins
      const fiber = yield* Effect.forkChild(
        runPluginHost({
          heartbeatEvery: Duration.millis(50),
          heartbeatTimeout: Duration.millis(500),
          restartDelay: Duration.millis(10),
        }),
      )
      const result = yield* use({ halves, logOf: (id) => plugins!.readLog(id) })
      yield* Fiber.interrupt(fiber)
      return result
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          layerServerHalves,
          layerPluginStubs,
          layerFsUserPlugins(ivinHome),
          layerChildPluginHost(process.execPath, hostEntry),
        ),
      ),
      Effect.scoped,
    ),
  )

const until = (condition: Effect.Effect<boolean>) =>
  Effect.gen(function* () {
    while (!(yield* condition)) yield* Effect.sleep(Duration.millis(20))
  })

test("a server half's console output reaches its plugin's log", async () => {
  const ivinHome = home()
  writePlugin(
    ivinHome,
    "hello",
    `import { defineServer } from "@ivin/plugin-api/server"
export const activate = defineServer(() => { console.log("hello from activate") })`,
  )
  const lines = await withHost(ivinHome, ({ halves, logOf }) =>
    Effect.gen(function* () {
      yield* until(Effect.map(halves.get("hello"), (state) => state === "active"))
      yield* until(Effect.map(logOf("hello"), (log) => log.length > 0))
      return yield* logOf("hello")
    }),
  )
  expect(lines.join("\n")).toContain("hello from activate")
})

test("a server half that loops forever in activate is disabled for blocking, and the others come back active", async () => {
  const ivinHome = home()
  writePlugin(ivinHome, "a-fine", `export const activate = () => {}`)
  writePlugin(ivinHome, "b-loops", `export const activate = () => { while (true) {} }`)
  writePlugin(ivinHome, "c-fine", `export const activate = () => {}`)
  const lines = await withHost(ivinHome, ({ halves, logOf }) =>
    Effect.gen(function* () {
      yield* until(Effect.map(halves.get("b-loops"), (state) => state === "disabled"))
      yield* until(Effect.map(halves.get("c-fine"), (state) => state === "active"))
      expect(yield* halves.get("a-fine")).toBe("active")
      return yield* logOf("b-loops")
    }),
  )
  expect(lines.join("\n")).toContain("Disabled for blocking")
})

test("a server half that calls process.exit() is disabled, and the others come back active", async () => {
  const ivinHome = home()
  writePlugin(ivinHome, "a-quits", `export const activate = () => { process.exit(3) }`)
  writePlugin(ivinHome, "b-fine", `export const activate = () => {}`)
  const lines = await withHost(ivinHome, ({ halves, logOf }) =>
    Effect.gen(function* () {
      yield* until(Effect.map(halves.get("b-fine"), (state) => state === "active"))
      expect(yield* halves.get("a-quits")).toBe("disabled")
      return yield* logOf("a-quits")
    }),
  )
  expect(lines.join("\n")).toContain("exit code 3")
})

test("a server half that throws is logged, stays failed, and does not stop the host", async () => {
  const ivinHome = home()
  writePlugin(ivinHome, "a-throws", `export const activate = () => { throw new Error("no way") }`)
  writePlugin(
    ivinHome,
    "b-late",
    `export const activate = () => { setTimeout(() => { throw new Error("later") }, 10) }`,
  )
  const lines = await withHost(ivinHome, ({ halves, logOf }) =>
    Effect.gen(function* () {
      yield* until(Effect.map(logOf("b-late"), (log) => log.some((line) => line.includes("later"))))
      expect(yield* halves.get("a-throws")).toBe("failed")
      expect(yield* halves.get("b-late")).toBe("active")
      return yield* logOf("a-throws")
    }),
  )
  expect(lines).toHaveLength(1)
  expect(lines[0]).toContain("no way")
})

test("deactivating a plugin aborts its ctx.signal", async () => {
  const ivinHome = home()
  writePlugin(
    ivinHome,
    "stops",
    `export const activate = (ctx) => { ctx.signal.addEventListener("abort", () => console.log("signal aborted")) }`,
  )
  const logged = await Effect.runPromise(
    Effect.gen(function* () {
      const plugins = (yield* UserPlugins)!
      const launcher = (yield* PluginHost)!
      const [folder] = yield* plugins.folders
      const file = yield* plugins.compile({
        id: "stops",
        path: folder!.path,
        entry: "src/server.ts",
        half: "server",
      })
      const host = yield* launcher.launch
      const lines = yield* Effect.forkChild(host.logs.pipe(Stream.take(1), Stream.runCollect))
      yield* host.activate({ id: "stops", file: plugins.bundlePath(file) })
      yield* host.deactivate("stops")
      return yield* Fiber.join(lines)
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          layerFsUserPlugins(ivinHome),
          layerChildPluginHost(process.execPath, hostEntry),
        ),
      ),
      Effect.scoped,
    ),
  )
  expect(logged).toEqual([{ id: "stops", line: "signal aborted" }])
})

// Runs one plugin in a real host, with the server answering its `ctx` calls.
const withActivated = <A>(
  id: string,
  server: string,
  use: (host: RunningPluginHost, lines: string[]) => Effect.Effect<A>,
) => {
  const ivinHome = home()
  writePlugin(ivinHome, id, server)
  return Effect.runPromise(
    Effect.gen(function* () {
      const plugins = (yield* UserPlugins)!
      const launcher = (yield* PluginHost)!
      const [folder] = yield* plugins.folders
      const file = yield* plugins.compile({
        id,
        path: folder!.path,
        entry: "src/server.ts",
        half: "server",
      })
      const host = yield* launcher.launch
      yield* serveHost(host, [{ id, permissions: NO_PERMISSIONS }])
      const lines: string[] = []
      yield* Effect.forkScoped(
        host.logs.pipe(Stream.runForEach(({ line }) => Effect.sync(() => void lines.push(line)))),
      )
      yield* host.activate({ id, file: plugins.bundlePath(file) })
      return yield* use(host, lines)
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          layerPluginStubs,
          layerFsUserPlugins(ivinHome),
          layerChildPluginHost(process.execPath, hostEntry),
        ),
      ),
      Effect.scoped,
    ),
  )
}

test("a process a server half started with ctx.exec is killed when the plugin is deactivated", async () => {
  const lines = await withActivated(
    "runs",
    `export const activate = (ctx) => {
  ctx.exec("sleep", ["30"]).then((result) => console.log("exited " + result.exitCode))
}`,
    (host, lines) =>
      Effect.gen(function* () {
        yield* Effect.sleep(Duration.millis(300))
        yield* host.deactivate("runs")
        yield* until(Effect.sync(() => lines.length > 0))
        return lines
      }),
  )
  expect(lines).toEqual(["exited null"])
})

test("an interval a server half set with ctx.setInterval stops when the plugin is deactivated", async () => {
  const afterDeactivate = await withActivated(
    "ticks",
    `export const activate = (ctx) => { ctx.setInterval(() => console.log("tick"), 10) }`,
    (host, lines) =>
      Effect.gen(function* () {
        yield* until(Effect.sync(() => lines.length > 1))
        yield* host.deactivate("ticks")
        yield* Effect.sleep(Duration.millis(50))
        const count = lines.length
        yield* Effect.sleep(Duration.millis(150))
        return lines.length - count
      }),
  )
  expect(afterDeactivate).toBe(0)
})
