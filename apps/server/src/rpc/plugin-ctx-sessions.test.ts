import { Effect } from "effect"
import { expect, test, vi } from "vitest"
import { withPluginServer } from "./plugin-ctx-server.ts"
import { packageJson, tempDir, writePlugin, type Client } from "./plugin-test-server.ts"
import { until } from "./test-waits.ts"

// Each test starts the plugin host and compiles with Rolldown.
vi.setConfig({ testTimeout: 60_000 })

const serverPlugin = (home: string, id: string, server: string) =>
  writePlugin(home, id, {
    "package.json": packageJson({ id, server: "src/server.ts" }),
    "src/server.ts": server,
  })

const active = (client: Client, count: number) =>
  until(
    client["plugin.status"](),
    (status) => status.filter((plugin) => plugin.server === "active").length === count,
  )

const run = (client: Client, command: string, args: object | null = null) =>
  client["plugin.run"]({ command, args })

test("ctx.exec adds env for the run only, and kills a program that runs over its timeout", async () => {
  const home = tempDir("home")
  serverPlugin(
    home,
    "runner",
    `export const activate = (ctx) => {
  ctx.commands.register("runner.env", async () => {
    const withEnv = await ctx.exec("sh", ["-c", "printf %s \\"$PLUGIN_TEST_VAR\\""], { env: { PLUGIN_TEST_VAR: "yes" } })
    const without = await ctx.exec("sh", ["-c", "printf %s \\"$PLUGIN_TEST_VAR\\""])
    return { withEnv: withEnv.stdout, without: without.stdout }
  })
  ctx.commands.register("runner.slow", async () => {
    try {
      await ctx.exec("sleep", ["5"], { timeout: 200 })
      return "finished"
    } catch (error) {
      return error.message
    }
  })
}`,
  )
  const { env, slow } = await withPluginServer(home, (client) =>
    Effect.gen(function* () {
      yield* active(client, 1)
      const env = yield* until(
        run(client, "runner.env").pipe(Effect.orElseSucceed(() => null)),
        (v) => v !== null,
      )
      const slow = yield* run(client, "runner.slow")
      return { env, slow }
    }),
  )
  expect(env).toEqual({ withEnv: "yes", without: "" })
  expect(slow).toBe("sleep ran over its 200 ms limit and was killed.")
})

test("ctx.sessions lists open sessions, gets one, and calls onChanged when one is renamed", async () => {
  const home = tempDir("home")
  serverPlugin(
    home,
    "watcher",
    `export const activate = (ctx) => {
  const changes = []
  ctx.sessions.onChanged((session) => changes.push(session.title))
  ctx.commands.register("watcher.read", async (args) => ({
    changes,
    listed: (await ctx.sessions.list()).map((s) => s.id),
    got: (await ctx.sessions.get(args.id))?.id ?? null,
  }))
}`,
  )
  const result = await withPluginServer(home, (client) =>
    Effect.gen(function* () {
      yield* active(client, 1)
      const kept = yield* client["session.create"]({ projectPath: "/p" })
      const archived = yield* client["session.create"]({ projectPath: "/q" })
      yield* client["session.archive"]({ sessionId: archived.id })
      yield* client["session.rename"]({ sessionId: kept.id, title: "Renamed", by: "user" })
      const read = (yield* until(
        run(client, "watcher.read", { id: kept.id }).pipe(Effect.orElseSucceed(() => null)),
        (value) => (value as { changes: string[] } | null)?.changes.includes("Renamed") === true,
      )) as { changes: string[]; listed: string[]; got: string | null }
      const gone = (yield* run(client, "watcher.read", { id: archived.id })) as {
        got: string | null
      }
      return { read, gone, kept: kept.id, archived: archived.id }
    }),
  )
  expect(result.read.listed).toEqual([result.kept])
  expect(result.read.got).toBe(result.kept)
  expect(result.gone.got).toBeNull()
})

test("ctx.annotations.listAll reads another plugin's annotation, which list does not", async () => {
  const home = tempDir("home")
  serverPlugin(
    home,
    "writer",
    `export const activate = (ctx) => {
  ctx.commands.register("writer.add", (args) =>
    ctx.annotations.add({ _tag: "session", sessionId: args.id }, { kind: "note", data: { from: "writer" } }).then(() => null))
}`,
  )
  serverPlugin(
    home,
    "reader",
    `export const activate = (ctx) => {
  ctx.commands.register("reader.read", async (args) => {
    const target = { _tag: "session", sessionId: args.id }
    return {
      own: (await ctx.annotations.list(target, "note")).length,
      all: (await ctx.annotations.listAll(target, "note")).map((a) => [a.ns, a.data.from]),
    }
  })
}`,
  )
  const read = await withPluginServer(home, (client) =>
    Effect.gen(function* () {
      yield* active(client, 2)
      const session = yield* client["session.create"]({ projectPath: "/p" })
      yield* until(
        run(client, "writer.add", { id: session.id }).pipe(Effect.orElseSucceed(() => "wait")),
        (value) => value === null,
      )
      return yield* until(
        run(client, "reader.read", { id: session.id }).pipe(Effect.orElseSucceed(() => null)),
        (value) => value !== null,
      )
    }),
  )
  expect(read).toEqual({ own: 0, all: [["writer", "writer"]] })
})
