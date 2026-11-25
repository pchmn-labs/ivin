import { PluginActivateFailed, type HostLog } from "@ivin/contracts/plugin"
import { Deferred, Duration, Effect, Fiber, Layer, Queue, Stream } from "effect"
import { expect, test } from "vitest"
import { PluginHost, type RunningPluginHost } from "./plugin-host.ts"
import { runPluginHost } from "./run-plugin-host.ts"
import { layerServerHalves, ServerHalves } from "./server-halves.ts"
import { UserPlugins, type UserPluginsService } from "./user-plugins.ts"

const timings = {
  heartbeatEvery: Duration.millis(5),
  heartbeatTimeout: Duration.millis(40),
  restartDelay: Duration.millis(5),
}

type Behaviour = "ok" | "blocks" | "exits" | "throws"

// Each plugin's server half behaves as its id says; a launch is one host process.
const setup = (behaviours: Record<string, Behaviour>) => {
  const logs: string[] = []
  const launches: string[][] = []
  const folders = Object.keys(behaviours).map((name) => ({
    name,
    path: `/plugins/${name}`,
    manifest: JSON.stringify({ ivin: { id: name, server: "src/server.ts" } }),
  }))
  const userPlugins: UserPluginsService = {
    folders: Effect.succeed(folders),
    compile: ({ id }) => Effect.succeed(`${id}.mjs`),
    bundlePath: (name) => `/cache/${name}`,
    lock: () => Effect.void,
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
        activate: ({ id }) =>
          Effect.gen(function* () {
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
        deactivate: () => Effect.void,
        ping: Effect.suspend(() => (blocked ? Effect.never : Effect.void)),
        logs: Stream.fromQueue(out),
        exited: Deferred.await(exited),
      }
      return host
    }),
  }
  return { logs, launches, userPlugins, launcher }
}

const run = <A>(
  fixture: ReturnType<typeof setup>,
  use: (halves: ServerHalves["Service"]) => Effect.Effect<A>,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const halves = yield* ServerHalves
      const fiber = yield* Effect.forkChild(runPluginHost(timings))
      const result = yield* use(halves)
      yield* Fiber.interrupt(fiber)
      return result
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          layerServerHalves,
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
