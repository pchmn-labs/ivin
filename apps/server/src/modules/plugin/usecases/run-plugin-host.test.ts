import { PluginActivateFailed, type HostLog } from "@ivin/contracts/plugin"
import { Deferred, Duration, Effect, Fiber, Layer, Queue, Stream } from "effect"
import { expect, test } from "vitest"
import { PluginHost, type RunningPluginHost } from "./plugin-host.ts"
import { runPluginHost } from "./run-plugin-host.ts"
import { layerPluginReloads, PluginReloads } from "./plugin-reloads.ts"
import { layerServerHalves, ServerHalves } from "./server-halves.ts"
import { PluginNotCompiled, UserPlugins, type UserPluginsService } from "./user-plugins.ts"

const timings = {
  heartbeatEvery: Duration.millis(5),
  heartbeatTimeout: Duration.millis(40),
  restartDelay: Duration.millis(5),
  maxActivations: 50,
}

type Behaviour = "ok" | "blocks" | "exits" | "throws"

// Each plugin's server half behaves as its id says; a launch is one host process.
const setup = (behaviours: Record<string, Behaviour>) => {
  const events: string[] = []
  const logs: string[] = []
  const launches: string[][] = []
  const versions: Record<string, number> = {}
  const failing = new Set<string>()
  const folders = Object.keys(behaviours).map((name) => ({
    name,
    path: `/plugins/${name}`,
    manifest: JSON.stringify({ ivin: { id: name, server: "src/server.ts" } }),
  }))
  const userPlugins: UserPluginsService = {
    folders: Effect.sync(() => [...folders]),
    compile: ({ id }) =>
      failing.has(id)
        ? Effect.fail(new PluginNotCompiled({ reason: "Could not compile src/server.ts" }))
        : Effect.succeed(`${id}-${versions[id] ?? 1}.mjs`),
    bundlePath: (name) => `/cache/${name}`,
    lock: () => Effect.void,
    changes: Stream.empty,
    check: () => Effect.succeed([]),
    create: () => Effect.succeed(""),
    appendLog: (id, line) => Effect.sync(() => void logs.push(`${id}: ${line}`)),
    readLog: () => Effect.succeed([]),
  }
  const launcher = {
    launch: Effect.gen(function* () {
      const active: string[] = []
      launches.push(active)
      const exited = yield* Deferred.make<string>()
      const out = yield* Queue.unbounded<HostLog>()
      let blocked = false
      const host: RunningPluginHost = {
        activate: ({ id, file }) =>
          Effect.gen(function* () {
            events.push(`activate ${file}`)
            const behaviour = behaviours[id]
            if (behaviour === "blocks") {
              blocked = true
              return yield* Effect.never
            }
            if (behaviour === "exits") {
              yield* Deferred.succeed(exited, "exited with code 1")
              return yield* Effect.never
            }
            if (behaviour === "throws") return yield* new PluginActivateFailed({ reason: "boom" })
            active.push(id)
            yield* Queue.offer(out, { id, line: "activated" })
          }),
        deactivate: (id) => Effect.sync(() => void events.push(`deactivate ${id}`)),
        ping: Effect.suspend(() => (blocked ? Effect.never : Effect.void)),
        logs: Stream.fromQueue(out),
        exited: Deferred.await(exited),
      }
      return host
    }),
  }
  return { events, versions, failing, folders, logs, launches, userPlugins, launcher }
}

const run = <A>(
  fixture: ReturnType<typeof setup>,
  use: (halves: ServerHalves["Service"], reloads: PluginReloads["Service"]) => Effect.Effect<A>,
  hostTimings = timings,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const halves = yield* ServerHalves
      const reloads = yield* PluginReloads
      const fiber = yield* Effect.forkChild(runPluginHost(hostTimings))
      // The runner subscribes as it starts.
      yield* Effect.sleep(Duration.millis(10))
      const result = yield* use(halves, reloads)
      yield* Fiber.interrupt(fiber)
      return result
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          layerServerHalves,
          layerPluginReloads,
          Layer.succeed(UserPlugins)(fixture.userPlugins),
          Layer.succeed(PluginHost)(fixture.launcher),
        ),
      ),
      Effect.scoped,
    ),
  )

const until = (condition: () => boolean) =>
  Effect.gen(function* () {
    while (!condition()) yield* Effect.sleep(Duration.millis(2))
  })

test("each server half is activated and its console output goes to its log", async () => {
  const fixture = setup({ a: "ok", b: "ok" })
  await run(fixture, (halves) =>
    Effect.gen(function* () {
      yield* until(() => fixture.logs.length >= 2)
      expect(yield* halves.get("a")).toBe("active")
      expect(yield* halves.get("b")).toBe("active")
    }),
  )
  expect(fixture.logs.map((line) => line.replace(/ [\d\-T:.Z]+ /, " "))).toEqual(
    expect.arrayContaining([expect.stringContaining("a: "), expect.stringContaining("b: ")]),
  )
})

test("a half whose activate fails is marked failed and logged once, and the others stay active", async () => {
  const fixture = setup({ bad: "throws", good: "ok" })
  await run(fixture, (halves) =>
    Effect.gen(function* () {
      yield* until(() => fixture.launches[0]?.includes("good") === true)
      expect(yield* halves.get("bad")).toBe("failed")
      expect(yield* halves.get("good")).toBe("active")
    }),
  )
  expect(fixture.logs.filter((line) => line.startsWith("bad:"))).toHaveLength(1)
  expect(fixture.launches).toHaveLength(1)
})

test("a half that blocks the host is disabled, and the host restarts with the others active", async () => {
  const fixture = setup({ first: "ok", loops: "blocks", last: "ok" })
  await run(fixture, (halves) =>
    Effect.gen(function* () {
      yield* until(() => (fixture.launches[1]?.length ?? 0) === 2)
      expect(yield* halves.get("loops")).toBe("disabled")
      expect(yield* halves.get("first")).toBe("active")
      expect(yield* halves.get("last")).toBe("active")
    }),
  )
  expect(fixture.launches[1]).toEqual(["first", "last"])
  expect(fixture.logs.some((line) => /^loops: .*Disabled for blocking/.test(line))).toBe(true)
})

test("a half that makes the host exit is disabled, and the others come back active", async () => {
  const fixture = setup({ first: "ok", quits: "exits", last: "ok" })
  await run(fixture, (halves) =>
    Effect.gen(function* () {
      yield* until(() => (fixture.launches[1]?.length ?? 0) === 2)
      expect(yield* halves.get("quits")).toBe("disabled")
    }),
  )
  expect(fixture.logs.some((line) => /^quits: .*Disabled.*exited with code 1/.test(line))).toBe(
    true,
  )
})

test("a half that failed to activate is not activated again when the host restarts", async () => {
  const fixture = setup({ bad: "throws", loops: "blocks" })
  await run(fixture, () => until(() => fixture.launches.length >= 2))
  expect(fixture.logs.filter((line) => line.startsWith("bad:"))).toHaveLength(1)
})

test("no host starts when no plugin has a server half", async () => {
  const fixture = setup({})
  await run(fixture, () => Effect.sleep(Duration.millis(50)))
  expect(fixture.launches).toHaveLength(0)
})

test("a reload request deactivates the running half and activates the new version", async () => {
  const fixture = setup({ a: "ok" })
  await run(fixture, (_, reloads) =>
    Effect.gen(function* () {
      yield* until(() => fixture.events.length === 1)
      fixture.versions["a"] = 2
      yield* reloads.request("a")
      yield* until(() => fixture.events.length === 3)
    }),
  )
  expect(fixture.events).toEqual([
    "activate /cache/a-1.mjs",
    "deactivate a",
    "activate /cache/a-2.mjs",
  ])
  expect(fixture.launches).toHaveLength(1)
})

test("a half that failed to activate is activated again by a reload", async () => {
  const fixture = setup({ bad: "throws", good: "ok" })
  await run(fixture, (halves, reloads) =>
    Effect.gen(function* () {
      yield* until(() => fixture.launches[0]?.includes("good") === true)
      expect(yield* halves.get("bad")).toBe("failed")
      yield* reloads.request("bad", true)
      yield* until(
        () => fixture.events.filter((e) => e.startsWith("activate /cache/bad")).length === 2,
      )
    }),
  )
})

test("a reload of a plugin that fails to compile leaves the running version alone", async () => {
  const fixture = setup({ a: "ok" })
  await run(fixture, (halves, reloads) =>
    Effect.gen(function* () {
      yield* until(() => fixture.events.length === 1)
      fixture.failing.add("a")
      yield* reloads.request("a")
      yield* until(() => fixture.logs.some((line) => line.includes("Could not compile")))
      expect(yield* halves.get("a")).toBe("active")
    }),
  )
  expect(fixture.events).toEqual(["activate /cache/a-1.mjs"])
})

test("the host starts when a reload brings the first server half", async () => {
  const fixture = setup({ late: "ok" })
  const folder = fixture.folders[0]!
  fixture.folders.length = 0
  await run(fixture, (halves, reloads) =>
    Effect.gen(function* () {
      yield* Effect.sleep(Duration.millis(30))
      expect(fixture.launches).toHaveLength(0)
      fixture.folders.push(folder)
      yield* reloads.request("late")
      yield* until(() => fixture.events.length === 1)
      expect(yield* halves.get("late")).toBe("active")
    }),
  )
})

test("an idle host is replaced once enough versions have piled up, and the new one runs the current halves", async () => {
  const fixture = setup({ a: "ok" })
  await run(
    fixture,
    (_, reloads) =>
      Effect.gen(function* () {
        yield* until(() => fixture.events.length === 1)
        fixture.versions["a"] = 2
        yield* reloads.request("a")
        yield* until(() => fixture.launches.length === 2)
        yield* until(
          () =>
            fixture.events.at(-1) === "activate /cache/a-2.mjs" &&
            fixture.launches[1]?.length === 1,
        )
      }),
    { ...timings, maxActivations: 2 },
  )
  expect(fixture.logs.some((line) => /Disabled/.test(line))).toBe(false)
})

test("a request after a save that left the compiled file as it was swaps nothing, and a forced one does", async () => {
  const fixture = setup({ a: "ok" })
  await run(fixture, (_, reloads) =>
    Effect.gen(function* () {
      yield* until(() => fixture.events.length === 1)
      yield* reloads.request("a")
      yield* Effect.sleep(Duration.millis(30))
      expect(fixture.events).toEqual(["activate /cache/a-1.mjs"])
      yield* reloads.request("a", true)
      yield* until(() => fixture.events.length === 3)
    }),
  )
  expect(fixture.events).toEqual([
    "activate /cache/a-1.mjs",
    "deactivate a",
    "activate /cache/a-1.mjs",
  ])
})
