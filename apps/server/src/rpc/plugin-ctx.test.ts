import { CommandNotFound } from "@ivin/contracts/plugin"
import type { StartInput } from "@ivin/harness"
import { Effect, Fiber, type Schema, Stream } from "effect"
import { mkdtempSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test, vi } from "vitest"
import { withPluginServer } from "./plugin-ctx-server.ts"
import { packageJson, tempDir, writePlugin, type Client } from "./plugin-test-server.ts"
import { forkWatch, until } from "./test-waits.ts"

// Each test starts the plugin host and compiles with Rolldown.
vi.setConfig({ testTimeout: 60_000 })

const serverPlugin = (home: string, id: string, server: string, ivin: object = {}) =>
  writePlugin(home, id, {
    "package.json": packageJson({ id, server: "src/server.ts", ...ivin }),
    "src/server.ts": server,
  })

const runWhenRegistered = (client: Client, command: string, args: Schema.Json = null) =>
  until(
    client["plugin.run"]({ command, args }).pipe(
      Effect.map((value) => ({ value })),
      Effect.catchTag("CommandNotFound", () => Effect.succeed(null)),
    ),
    (result) => result !== null,
  ).pipe(Effect.map((result) => result!.value))

test("a server half's annotation, added on every created session, shows in annotation.watch", async () => {
  const home = tempDir("home")
  serverPlugin(
    home,
    "noter",
    `export const activate = (ctx) => {
  ctx.sessions.onCreated(async (session) => {
    await ctx.annotations.add({ _tag: "session", sessionId: session.id }, { kind: "note", data: { text: "hi" } })
  })
}`,
  )
  const noted = await withPluginServer(home, (client) =>
    Effect.gen(function* () {
      yield* until(client["plugin.status"](), (status) =>
        status.some((plugin) => plugin.id === "noter" && plugin.server === "active"),
      )
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const target = { _tag: "session", sessionId: session.id } as const
      const watching = yield* forkWatch(client["annotation.watch"]({ target }), (stream) =>
        stream.pipe(
          Stream.filter((change) => change._tag === "changed"),
          Stream.take(1),
          Stream.runCollect,
        ),
      )
      return yield* Fiber.join(watching)
    }),
  )
  expect([...noted][0]).toMatchObject({
    annotation: { ns: "noter", kind: "note", data: { text: "hi" } },
  })
})

test("a command a server half registers runs through plugin.run and returns its result", async () => {
  const home = tempDir("home")
  serverPlugin(
    home,
    "calc",
    `export const activate = (ctx) => {
  ctx.commands.register("calc.add", ({ a, b }) => ({ sum: a + b }))
  ctx.commands.register("calc.boom", () => { throw new Error("nope") })
}`,
  )
  const { sum, failure, unknown } = await withPluginServer(home, (client) =>
    Effect.gen(function* () {
      const sum = yield* runWhenRegistered(client, "calc.add", { a: 2, b: 3 })
      const failure = yield* client["plugin.run"]({ command: "calc.boom", args: null }).pipe(
        Effect.flip,
      )
      const unknown = yield* client["plugin.run"]({ command: "nope", args: null }).pipe(Effect.flip)
      return { sum, failure, unknown }
    }),
  )
  expect(sum).toEqual({ sum: 5 })
  expect(failure).toMatchObject({ _tag: "CommandFailed", reason: "nope" })
  expect(unknown).toEqual(new CommandNotFound({ command: "nope" }))
})

test("a beforeSpawn handler's variable is in the agent's environment, and a hook that throws is skipped", async () => {
  const home = tempDir("home")
  serverPlugin(
    home,
    "envs",
    `export const activate = (ctx) => {
  ctx.harness.beforeSpawn(() => ({ env: { FOO: "1", WHO: "envs" } }))
}`,
    { permissions: { harness: ["beforeSpawn"] } },
  )
  serverPlugin(
    home,
    "broken",
    `export const activate = (ctx) => {
  ctx.harness.beforeSpawn(() => { throw new Error("bad hook") })
}`,
    { permissions: { harness: ["beforeSpawn"] } },
  )
  const starts: StartInput[] = []
  await withPluginServer(
    home,
    (client) =>
      Effect.gen(function* () {
        yield* until(
          client["plugin.status"](),
          (status) => status.filter((plugin) => plugin.server === "active").length === 2,
        )
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "hi" })
        yield* until(
          Effect.sync(() => starts),
          (all) => all.length > 0,
        )
      }),
    { scripted: { starts }, turns: [[]] },
  )
  expect(starts[0]?.env).toEqual({ FOO: "1", WHO: "envs" })
})

test("ctx.exec, ctx.fetch and ctx.harness.beforeSpawn run when declared, and fail naming the permission when not", async () => {
  const server = createServer((_, response) => response.end("pong"))
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  const home = tempDir("home")
  serverPlugin(
    home,
    "caller",
    `export const activate = (ctx) => {
  const settle = (call) => call.then((value) => ({ value }), (error) => ({ error: error.message }))
  ctx.commands.register("caller.node", () => settle(ctx.exec(process.execPath, ["-e", "process.stdout.write('ran')"]).then((r) => r.stdout)))
  ctx.commands.register("caller.git", () => settle(ctx.exec("git", ["--version"])))
  ctx.commands.register("caller.fetch", (url) => settle(ctx.fetch(url).then((r) => r.text())))
}`,
    { permissions: { exec: [process.execPath], fetch: ["127.0.0.1"] } },
  )
  serverPlugin(
    home,
    "fetchless",
    `export const activate = (ctx) => {
  ctx.commands.register("fetchless.fetch", (url) => ctx.fetch(url).then((r) => r.text(), (error) => ({ error: error.message })))
}`,
  )
  serverPlugin(
    home,
    "spawner",
    `export const activate = (ctx) => {
  ctx.harness.beforeSpawn(() => ({ env: { FOO: "1" } }))
}`,
  )
  try {
    const result = await withPluginServer(home, (client) =>
      Effect.gen(function* () {
        const node = yield* runWhenRegistered(client, "caller.node")
        const git = yield* runWhenRegistered(client, "caller.git")
        const fetched = yield* runWhenRegistered(client, "caller.fetch", url)
        const refused = yield* runWhenRegistered(client, "fetchless.fetch", url)
        // The refusal is logged before the half counts as active.
        const spawner = yield* until(
          client["plugin.status"](),
          (status) => status.find((plugin) => plugin.id === "spawner")?.server === "active",
        ).pipe(Effect.andThen(client["plugin.readLog"]({ id: "spawner" })))
        return {
          node,
          git,
          fetched,
          refused,
          spawner,
          log: yield* client["plugin.readLog"]({ id: "caller" }),
        }
      }),
    )
    expect(result).toMatchObject({
      node: { value: "ran" },
      git: { error: expect.stringContaining("exec: git") },
      fetched: { value: "pong" },
      refused: { error: expect.stringContaining("fetch: 127.0.0.1") },
      spawner: [expect.stringContaining("harness: beforeSpawn")],
      log: [expect.stringContaining("exec: git")],
    })
  } finally {
    server.close()
  }
})

test("ctx.storage values survive a relaunch", async () => {
  const home = tempDir("home")
  const database = join(mkdtempSync(join(tmpdir(), "ivin-db-")), "ivin.db")
  serverPlugin(
    home,
    "counter",
    `export const activate = async (ctx) => {
  const launches = ((await ctx.storage.get("launches")) ?? 0) + 1
  await ctx.storage.set("launches", launches)
  ctx.commands.register("counter.launches", () => launches)
}`,
  )
  const launch = () =>
    withPluginServer(home, (client) => runWhenRegistered(client, "counter.launches"), { database })
  expect(await launch()).toBe(1)
  expect(await launch()).toBe(2)
})

test("settings.get and settings.onChange see the plugin's declared settings", async () => {
  const home = tempDir("home")
  serverPlugin(
    home,
    "tuned",
    `export const activate = async (ctx) => {
  const seen = []
  ctx.settings.onChange((key, value) => seen.push([key, value]))
  ctx.commands.register("tuned.read", async () => ({ now: await ctx.settings.get("limit"), seen }))
}`,
    {
      settings: { limit: { type: "number", default: 3, title: "Limit", description: "A limit" } },
    },
  )
  const read = await withPluginServer(home, (client) =>
    Effect.gen(function* () {
      const first = (yield* runWhenRegistered(client, "tuned.read")) as { now: number }
      yield* client["setting.set"]({ path: "tuned.limit", value: 7 })
      const after = yield* until(
        client["plugin.run"]({ command: "tuned.read", args: null }),
        (value) => (value as { now: number }).now === 7,
      )
      return { first, after }
    }),
  )
  expect(read.first.now).toBe(3)
  expect(read.after).toEqual({ now: 7, seen: [["limit", 7]] })
})
