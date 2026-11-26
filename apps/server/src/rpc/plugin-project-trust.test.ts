import { Effect, Fiber, Stream } from "effect"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, test, vi } from "vitest"
import { projectPluginKey } from "../modules/plugin/rules/project-plugin-trust.ts"
import { watchPluginFolders } from "../modules/plugin/usecases/watch-plugin-folders.ts"
import { PluginReloads } from "../modules/plugin/usecases/plugin-reloads.ts"
import {
  bundlePath,
  packageJson,
  tempDir,
  withServer,
  writeFiles,
  type Client,
} from "./plugin-test-server.ts"
import { forkWatch } from "./test-waits.ts"
import { newDatabase } from "./test-server.ts"

vi.setConfig({ testTimeout: 60_000 })

const hello = (text: string, permissions: Record<string, string[]> = {}) => ({
  "package.json": packageJson({ id: "hello", name: "Hello", ui: "src/ui.tsx", permissions }),
  "src/ui.tsx": `export const activate = () => ${JSON.stringify(text)}\n`,
})

// A trusted project that ships a plugin, on a server that has never been asked about it.
const setup = (files = hello("v1")) => {
  const home = tempDir("home")
  const project = tempDir("project")
  writeFiles(join(project, ".ivin", "plugins", "hello"), files)
  const db = newDatabase()
  db.prepare("INSERT INTO trusted_projects (path) VALUES (?)").run(project)
  const edit = (next: Record<string, string>) =>
    writeFiles(join(project, ".ivin", "plugins", "hello"), next)
  return { home, project, db, edit }
}

const firstSnapshot = (client: Client) =>
  client["plugin.projectPlugins"]().pipe(
    Stream.take(1),
    Stream.runCollect,
    Effect.map(([projects]) => projects ?? []),
  )

const snapshot = (client: Client) =>
  firstSnapshot(client).pipe(Effect.map(([project]) => project?.plugins[0] ?? null))

const runningText = (home: string, client: Client) =>
  client["plugin.list"]().pipe(
    Stream.take(1),
    Stream.runCollect,
    Effect.map(([plugin]) => readFileSync(bundlePath(home, plugin), "utf8")),
  )

test("a plugin of a trusted project never trusted is offered and does not run; trusting its hash runs it", async () => {
  const { home, project, db } = setup()

  const result = await withServer(
    home,
    (client) =>
      Effect.gen(function* () {
        const offered = yield* snapshot(client)
        const statusBefore = yield* client["plugin.status"]()
        yield* client["plugin.trust"]({ project, id: "hello", hash: offered!.hash })
        return {
          offered,
          statusBefore,
          trusted: yield* snapshot(client),
          running: yield* runningText(home, client),
        }
      }),
    { db },
  )

  expect(result.offered).toMatchObject({
    state: "new",
    files: expect.arrayContaining([{ path: "src/ui.tsx", status: "A" }]),
    diff: "",
  })
  expect(result.statusBefore).toEqual([])
  expect(result.trusted).toMatchObject({ state: "trusted", files: [], diff: "" })
  expect(result.running).toContain("v1")
})

test("trusting a hash the files no longer have fails and trusts nothing", async () => {
  const { home, project, db, edit } = setup()

  const result = await withServer(
    home,
    (client) =>
      Effect.gen(function* () {
        const offered = yield* snapshot(client)
        edit(hello("v2"))
        const failure = yield* client["plugin.trust"]({
          project,
          id: "hello",
          hash: offered!.hash,
        }).pipe(Effect.flip)
        return { failure, after: yield* snapshot(client) }
      }),
    { db },
  )

  expect(result.failure).toMatchObject({ _tag: "PluginContentChanged", id: "hello" })
  expect(result.after?.state).toBe("new")
})

test("an edit keeps the trusted version running and waits as changed with its diff", async () => {
  const { home, project, db, edit } = setup()

  const result = await withServer(
    home,
    (client) =>
      Effect.gen(function* () {
        const offered = yield* snapshot(client)
        yield* client["plugin.trust"]({ project, id: "hello", hash: offered!.hash })
        edit(hello("v2"))
        return { changed: yield* snapshot(client), running: yield* runningText(home, client) }
      }),
    { db },
  )

  expect(result.changed).toMatchObject({
    state: "changed",
    files: [{ path: "src/ui.tsx", status: "M" }],
    permissionsChanged: false,
  })
  expect(result.changed?.diff).toContain('-export const activate = () => "v1"')
  expect(result.changed?.diff).toContain('+export const activate = () => "v2"')
  expect(result.running).toContain("v1")
  expect(result.running).not.toContain("v2")
})

test("with full trust an edit runs at once, as a change to see, and a hot reload shows it in the window", async () => {
  const { home, project, db, edit } = setup()

  const result = await withServer(
    home,
    (client) =>
      Effect.gen(function* () {
        const reloads = yield* PluginReloads
        const offered = yield* snapshot(client)
        yield* client["plugin.trust"]({ project, id: "hello", hash: offered!.hash })
        yield* client["plugin.setFullTrust"]({ project, enabled: true })
        const reloaded = yield* forkWatch(client["plugin.list"](), (listed) =>
          listed.pipe(Stream.drop(1), Stream.take(1), Stream.runCollect),
        )
        edit(hello("v2"))
        yield* reloads.request(projectPluginKey(project, "hello"))
        const [plugin] = yield* Fiber.join(reloaded)
        const [projects] = yield* firstSnapshot(client)
        yield* client["plugin.markChangesSeen"]({ project })
        const [seen] = yield* firstSnapshot(client)
        return { shown: readFileSync(bundlePath(home, plugin), "utf8"), projects, seen }
      }),
    { db },
  )

  expect(result.shown).toContain("v2")
  expect(result.projects).toMatchObject({
    fullTrust: true,
    plugins: [{ state: "trusted" }],
    changes: [
      { id: "hello", isNew: false, seen: false, files: [{ path: "src/ui.tsx", status: "M" }] },
    ],
  })
  expect(result.projects?.changes[0]?.diff).toContain('+export const activate = () => "v2"')
  expect(result.seen?.changes[0]?.seen).toBe(true)
})

test("turning full trust on runs what the project holds pending, recorded as seen", async () => {
  const { home, project, db } = setup()

  const result = await withServer(
    home,
    (client) =>
      Effect.gen(function* () {
        yield* client["plugin.setFullTrust"]({ project, enabled: true })
        const [projects] = yield* firstSnapshot(client)
        return { projects, running: yield* runningText(home, client) }
      }),
    { db },
  )

  expect(result.projects?.plugins).toMatchObject([{ state: "trusted" }])
  expect(result.projects?.changes).toMatchObject([{ isNew: true, seen: true }])
  expect(result.running).toContain("v1")
})

test("new permissions are asked even with full trust, and the trusted version keeps running", async () => {
  const { home, project, db, edit } = setup()

  const result = await withServer(
    home,
    (client) =>
      Effect.gen(function* () {
        yield* client["plugin.setFullTrust"]({ project, enabled: true })
        yield* snapshot(client)
        edit(hello("v2", { exec: ["git"] }))
        return { asked: yield* snapshot(client), running: yield* runningText(home, client) }
      }),
    { db },
  )

  expect(result.asked).toMatchObject({
    state: "changed",
    permissionsChanged: true,
    permissions: ["exec: git"],
  })
  expect(result.running).toContain("v1")
})

test("a project that is not trusted offers and runs nothing", async () => {
  const { home, db } = setup()
  const other = tempDir("untrusted")
  writeFiles(join(other, ".ivin", "plugins", "hello"), hello("v1"))
  db.prepare("DELETE FROM trusted_projects WHERE path != '/'").run()

  const result = await withServer(
    home,
    (client) =>
      Effect.gen(function* () {
        return { projects: yield* firstSnapshot(client), status: yield* client["plugin.status"]() }
      }),
    { db },
  )

  expect(result.projects).toEqual([])
  expect(result.status).toEqual([])
})

test("a project trusted while the server runs offers its plugins to a window that already listens", async () => {
  const { home, project, db } = setup()
  db.prepare("DELETE FROM trusted_projects WHERE path = ?").run(project)
  let trusted = false

  const offered = await withServer(
    home,
    (client) =>
      Effect.gen(function* () {
        yield* Effect.forkScoped(watchPluginFolders)
        return yield* client["plugin.projectPlugins"]().pipe(
          Stream.tap(() =>
            Effect.sync(() => {
              if (trusted) return
              trusted = true
              db.prepare("INSERT INTO trusted_projects (path) VALUES (?)").run(project)
            }),
          ),
          Stream.filter((projects) => projects.length > 0),
          Stream.take(1),
          Stream.runCollect,
          Effect.timeout("15 seconds"),
        )
      }),
    { db },
  )

  expect(offered[0]?.[0]?.plugins[0]?.state).toBe("new")
})
