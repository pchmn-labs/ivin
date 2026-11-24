import { Rpcs } from "@ivin/contracts/rpcs"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer, type Scope, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { logGitCalls } from "./git-call-log.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"
import { handlers, layerServices } from "./handlers.ts"

vi.setConfig({ testTimeout: 30_000 })

// Captured before the logging git goes on the PATH, so the test's own commands stay out of its log.
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: "ivin",
  GIT_AUTHOR_EMAIL: "ivin@example.com",
  GIT_COMMITTER_NAME: "ivin",
  GIT_COMMITTER_EMAIL: "ivin@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
}
const git = (...args: string[]) =>
  execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: project, env })

let root: string
let project: string
let gitLog: ReturnType<typeof logGitCalls>

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "ivin-git-calls-")))
  project = join(root, "project")
  execFileSync("git", ["init", "--quiet", "-b", "main", project], { env })
  writeFileSync(join(project, "a.ts"), "a\n")
  writeFileSync(join(project, "b.ts"), "b\n")
  git("add", "--all")
  git("commit", "--quiet", "-m", "main")
  git("remote", "add", "origin", join(root, "no-origin"))
  git("update-ref", "refs/remotes/origin/main", "HEAD")
  git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main")
  git("switch", "--quiet", "-c", "feature")
  writeFileSync(join(project, "c.ts"), "c\n")
  git("add", "--all")
  git("commit", "--quiet", "-m", "feature")
  writeFileSync(join(project, "a.ts"), "a\nchanged\n")
  writeFileSync(join(project, "b.ts"), "b\nchanged\n")
  gitLog = logGitCalls()
})

afterEach(() => {
  gitLog.restore()
  rmSync(root, { recursive: true, force: true })
})

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(use: (client: Client) => Effect.Effect<A, E, Scope.Scope>) => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  trustEveryFolder(db)
  return Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(Layer.succeed(ImageFolder)({ path: join(root, "images") })),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(layerScripted([], { starts: [], closed: [] })),
        ),
      ),
      Effect.scoped,
    ),
  )
}

interface Reader {
  batches: number
  reads: number
}

// Reads once, then again after each batch of the session's watch, as the window does.
const readOnChange = (client: Client, sessionId: string, read: Effect.Effect<unknown, unknown>) =>
  Effect.gen(function* () {
    const reader: Reader = { batches: 0, reads: 0 }
    const batches = client["file.watch"]({ sessionId }).pipe(
      Stream.tap(() => Effect.sync(() => reader.batches++)),
    )
    yield* Stream.merge(Stream.make(undefined), batches).pipe(
      Stream.mapEffect(() => read.pipe(Effect.tap(() => Effect.sync(() => reader.reads++)))),
      Stream.runDrain,
      Effect.forkScoped,
    )
    return reader
  })

const until = (holds: () => boolean) =>
  Effect.promise(() => expect.poll(holds, { timeout: 15_000 }).toBe(true))

// The OS watcher has no ready signal: change files until every reader has seen a batch.
const untilWatched = (readers: ReadonlyArray<Reader>) =>
  Effect.race(
    until(() => readers.every((reader) => reader.batches > 0)),
    Effect.gen(function* () {
      for (let index = 0; ; index++) {
        writeFileSync(join(project, `.probe-${index}`), "")
        yield* Effect.sleep("100 millis")
      }
    }),
  )

const isIdle = (reader: Reader) => reader.reads === reader.batches + 1

const isCheckIgnore = (call: string) => / check-ignore /.test(` ${call} `)

test("one file change with the change lists and two diffs open runs at most 10 git processes, and no merge-base", async () => {
  const { calls, batches } = await withServer((client) =>
    Effect.gen(function* () {
      const { id: sessionId } = yield* client["session.create"]({ projectPath: project })
      const readers = [
        yield* readOnChange(client, sessionId, client["file.listChanges"]({ sessionId })),
        yield* readOnChange(client, sessionId, client["file.listCommittedChanges"]({ sessionId })),
        yield* readOnChange(
          client,
          sessionId,
          client["file.readDiff"]({ sessionId, path: "a.ts" }),
        ),
        yield* readOnChange(
          client,
          sessionId,
          client["file.readDiff"]({ sessionId, path: "b.ts" }),
        ),
      ]
      yield* untilWatched(readers)
      yield* until(() => readers.every(isIdle))
      const before = readers[0]?.batches ?? 0
      gitLog.clear()

      writeFileSync(join(project, "a.ts"), "a\nchanged again\n")
      yield* until(() => readers.every((reader) => reader.batches > before && isIdle(reader)))
      return { calls: gitLog.calls(), batches: (readers[0]?.batches ?? 0) - before }
    }),
  )

  expect(calls.length).toBeLessThanOrEqual(10 * batches)
  expect(calls.filter((call) => call.includes("merge-base"))).toEqual([])
})

test("two sessions in one working folder run one check-ignore per batch", async () => {
  await withServer((client) =>
    Effect.gen(function* () {
      const watchOf = (sessionId: string) =>
        Effect.gen(function* () {
          const reader: Reader = { batches: 0, reads: 0 }
          yield* client["file.watch"]({ sessionId }).pipe(
            Stream.runForEach(() => Effect.sync(() => reader.batches++)),
            Effect.forkScoped,
          )
          return reader
        })
      const first = yield* watchOf((yield* client["session.create"]({ projectPath: project })).id)
      const second = yield* watchOf((yield* client["session.create"]({ projectPath: project })).id)
      yield* untilWatched([first, second])

      yield* until(
        () =>
          first.batches === second.batches &&
          gitLog.calls().filter(isCheckIgnore).length === first.batches,
      )
    }),
  )
})

test("changes in a folder outside a repository run no git process, node_modules included", async () => {
  const plain = join(root, "plain")
  mkdirSync(join(plain, "node_modules"), { recursive: true })
  const { listed, calls } = await withServer((client) =>
    Effect.gen(function* () {
      const { id: sessionId } = yield* client["session.create"]({ projectPath: plain })
      const seen: string[] = []
      yield* client["file.watch"]({ sessionId }).pipe(
        Stream.runForEach((batch) => Effect.sync(() => void seen.push(...batch.paths))),
        Effect.forkScoped,
      )
      yield* until(() => {
        writeFileSync(join(plain, "node_modules", "dep.js"), String(Math.random()))
        return seen.some((path) => path.startsWith("node_modules"))
      })
      return { listed: seen, calls: gitLog.calls() }
    }),
  )
  expect(listed.length).toBeGreaterThan(0)
  expect(calls.filter(isCheckIgnore)).toEqual([])
})

test("once a folder is known ignored, a change under it queues nothing and runs no check-ignore", async () => {
  mkdirSync(join(project, "dist"))
  writeFileSync(join(project, ".gitignore"), "dist\n")
  await withServer((client) =>
    Effect.gen(function* () {
      const { id: sessionId } = yield* client["session.create"]({ projectPath: project })
      const reader: Reader = { batches: 0, reads: 0 }
      const seen: string[] = []
      yield* client["file.watch"]({ sessionId }).pipe(
        Stream.runForEach((batch) =>
          Effect.sync(() => {
            reader.batches++
            seen.push(...batch.paths)
          }),
        ),
        Effect.forkScoped,
      )
      yield* untilWatched([reader])
      writeFileSync(join(project, "dist", "first.js"), "1")
      yield* Effect.sleep("500 millis")
      yield* until(() => reader.batches > 0)
      gitLog.clear()
      const before = reader.batches
      writeFileSync(join(project, "dist", "second.js"), "2")
      yield* Effect.sleep("500 millis")
      expect(reader.batches).toBe(before)
      expect(gitLog.calls().filter(isCheckIgnore)).toEqual([])
      expect(seen.filter((path) => path.startsWith("dist"))).toEqual([])
    }),
  )
})

const isFileListing = (call: string) => / ls-files -z --cached /.test(` ${call} `)

const listedPaths = (reader: Reader & { paths: ReadonlyArray<string> }) => reader.paths

const readFilesOnChange = (client: Client, sessionId: string) =>
  Effect.gen(function* () {
    const reader: Reader & { paths: ReadonlyArray<string> } = { batches: 0, reads: 0, paths: [] }
    const batches = client["file.watch"]({ sessionId }).pipe(
      Stream.tap(() => Effect.sync(() => reader.batches++)),
    )
    yield* Stream.merge(Stream.make(undefined), batches).pipe(
      Stream.mapEffect(() =>
        client["file.listFiles"]({ sessionId }).pipe(
          Effect.tap((list) =>
            Effect.sync(() => {
              reader.paths = list.paths
              reader.reads++
            }),
          ),
        ),
      ),
      Stream.runDrain,
      Effect.forkScoped,
    )
    return reader
  })

test("a change to a file's content lists no files, and a created or deleted file lists them once for every reader", async () => {
  const { edit, created, deleted } = await withServer((client) =>
    Effect.gen(function* () {
      const { id: sessionId } = yield* client["session.create"]({ projectPath: project })
      const readers = [
        yield* readFilesOnChange(client, sessionId),
        yield* readFilesOnChange(client, sessionId),
      ]
      yield* untilWatched(readers)
      yield* until(() => readers.every(isIdle))

      const step = (change: () => void) =>
        Effect.gen(function* () {
          const before = readers[0]?.batches ?? 0
          gitLog.clear()
          change()
          yield* until(() => readers.every((reader) => reader.batches > before && isIdle(reader)))
          const batches = (readers[0]?.batches ?? 0) - before
          return { batches, listings: gitLog.calls().filter(isFileListing).length }
        })

      const edit = yield* step(() => writeFileSync(join(project, "a.ts"), "a\nchanged again\n"))
      const created = yield* step(() => writeFileSync(join(project, "new.ts"), "n\n"))
      const seenCreated = readers.map((reader) => listedPaths(reader).includes("new.ts"))
      const deleted = yield* step(() => rmSync(join(project, "b.ts")))
      const seenDeleted = readers.map((reader) => !listedPaths(reader).includes("b.ts"))
      return {
        edit,
        created: { ...created, seen: seenCreated },
        deleted: { ...deleted, seen: seenDeleted },
      }
    }),
  )

  expect(edit.listings).toBe(0)
  expect(created.seen).toEqual([true, true])
  expect(created.listings).toBeGreaterThan(0)
  expect(created.listings).toBeLessThanOrEqual(created.batches)
  expect(deleted.seen).toEqual([true, true])
  expect(deleted.listings).toBeGreaterThan(0)
  expect(deleted.listings).toBeLessThanOrEqual(deleted.batches)
})
