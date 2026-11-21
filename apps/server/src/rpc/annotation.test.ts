import { layerScripted } from "@ivin/harness"
import { Rpcs } from "@ivin/contracts/rpcs"
import { Effect, Fiber, Layer, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(use: (client: Client) => Effect.Effect<A, E>) => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  return Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(layerScripted([])),
        ),
      ),
      Effect.scoped,
    ),
  )
}

const sessionTarget = (sessionId: string) => ({ _tag: "session", sessionId }) as const
const pr = (url: string, relation: "created" | "referenced") => ({ url, relation })

test("an added annotation is listed on its session, and only there", async () => {
  const { added, mine, other } = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const otherSession = yield* client["session.create"]({ projectPath: "/p" })
      const added = yield* client["annotation.add"]({
        target: sessionTarget(session.id),
        ns: "cli",
        kind: "note",
        data: { text: "hi" },
      })
      return {
        added,
        mine: yield* client["annotation.list"]({ target: sessionTarget(session.id), kind: null }),
        other: yield* client["annotation.list"]({
          target: sessionTarget(otherSession.id),
          kind: null,
        }),
      }
    }),
  )

  expect(added).toMatchObject({ ns: "cli", kind: "note", data: { text: "hi" } })
  expect(mine).toEqual([added])
  expect(other).toEqual([])
})

test("a kind with no definition adds a row at each write", async () => {
  const notes = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const target = sessionTarget(session.id)
      yield* client["annotation.add"]({ target, ns: "cli", kind: "note", data: { text: "a" } })
      yield* client["annotation.add"]({ target, ns: "cli", kind: "note", data: { text: "a" } })
      return yield* client["annotation.list"]({ target, kind: "note" })
    }),
  )

  expect(notes).toHaveLength(2)
})

test("writing a keyed kind again with the same key updates it, and another key adds one", async () => {
  const { first, again, prs } = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const target = sessionTarget(session.id)
      const first = yield* client["annotation.add"]({
        target,
        ns: "github",
        kind: "pr",
        data: pr("https://github.com/o/r/pull/1", "referenced"),
      })
      const again = yield* client["annotation.add"]({
        target,
        ns: "github",
        kind: "pr",
        data: pr("https://github.com/o/r/pull/1", "created"),
      })
      yield* client["annotation.add"]({
        target,
        ns: "github",
        kind: "pr",
        data: pr("https://github.com/o/r/pull/2", "created"),
      })
      return { first, again, prs: yield* client["annotation.list"]({ target, kind: "pr" }) }
    }),
  )

  expect(again.id).toBe(first.id)
  expect(again.data).toEqual(pr("https://github.com/o/r/pull/1", "created"))
  expect(prs.map((a) => a.data)).toEqual([
    pr("https://github.com/o/r/pull/1", "created"),
    pr("https://github.com/o/r/pull/2", "created"),
  ])
})

test("writing an issue again with the same url updates it, apart from a pr with that url", async () => {
  const { first, again, all } = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const target = sessionTarget(session.id)
      const issue = (relation: "referenced" | "resolved") => ({
        target,
        ns: "github",
        kind: "issue",
        data: { url: "https://github.com/o/r/issues/1", relation },
      })
      const first = yield* client["annotation.add"](issue("referenced"))
      const again = yield* client["annotation.add"](issue("resolved"))
      yield* client["annotation.add"]({
        ...issue("referenced"),
        kind: "pr",
        data: { url: "https://github.com/o/r/pull/1", relation: "referenced" },
      })
      return { first, again, all: yield* client["annotation.list"]({ target, kind: null }) }
    }),
  )

  expect(again.id).toBe(first.id)
  expect(again.data).toEqual({ url: "https://github.com/o/r/issues/1", relation: "resolved" })
  expect(all.map((a) => a.kind)).toEqual(["issue", "pr"])
})

test("a defined kind refuses data of another shape", async () => {
  const error = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      return yield* Effect.flip(
        client["annotation.add"]({
          target: sessionTarget(session.id),
          ns: "cli",
          kind: "pr",
          data: { text: "hi" },
        }),
      )
    }),
  )

  expect(error).toMatchObject({ _tag: "AnnotationDataInvalid", kind: "pr" })
})

test("list filters by kind", async () => {
  const notes = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const target = sessionTarget(session.id)
      yield* client["annotation.add"]({ target, ns: "cli", kind: "note", data: "a" })
      yield* client["annotation.add"]({ target, ns: "cli", kind: "todo", data: "b" })
      return yield* client["annotation.list"]({ target, kind: "note" })
    }),
  )

  expect(notes.map((a) => a.data)).toEqual(["a"])
})

test("a removed annotation is no longer listed, and removing it again fails", async () => {
  const { listed, again } = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const target = sessionTarget(session.id)
      const added = yield* client["annotation.add"]({ target, ns: "cli", kind: "note", data: 1 })
      yield* client["annotation.remove"]({ id: added.id })
      return {
        listed: yield* client["annotation.list"]({ target, kind: null }),
        again: yield* Effect.flip(client["annotation.remove"]({ id: added.id })),
      }
    }),
  )

  expect(listed).toEqual([])
  expect(again).toMatchObject({ _tag: "AnnotationNotFound" })
})

test("an annotation on an unknown session or project is refused", async () => {
  const { session, project } = await withServer((client) =>
    Effect.gen(function* () {
      const data = { ns: "cli", kind: "note", data: 1 }
      return {
        session: yield* Effect.flip(
          client["annotation.add"]({ target: sessionTarget("nope"), ...data }),
        ),
        project: yield* Effect.flip(
          client["annotation.add"]({ target: { _tag: "project", projectPath: "/nope" }, ...data }),
        ),
      }
    }),
  )

  expect(session).toMatchObject({ _tag: "SessionNotFound", sessionId: "nope" })
  expect(project).toMatchObject({ _tag: "ProjectNotFound", path: "/nope" })
})

test("a project's annotations are apart from its sessions'", async () => {
  const { onProject, onSession } = await withServer((client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: "/p" })
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const project = { _tag: "project", projectPath: "/p" } as const
      yield* client["annotation.add"]({ target: project, ns: "cli", kind: "note", data: "p" })
      return {
        onProject: yield* client["annotation.list"]({ target: project, kind: null }),
        onSession: yield* client["annotation.list"]({
          target: sessionTarget(session.id),
          kind: null,
        }),
      }
    }),
  )

  expect(onProject.map((a) => a.data)).toEqual(["p"])
  expect(onSession).toEqual([])
})

test("watching a session starts with its annotations, then streams additions, updates and removals of that session only", async () => {
  const changes = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const other = yield* client["session.create"]({ projectPath: "/p" })
      const target = sessionTarget(session.id)
      yield* client["annotation.add"]({ target, ns: "cli", kind: "note", data: "before" })
      const watching = yield* client["annotation.watch"]({ target }).pipe(
        Stream.take(4),
        Stream.runCollect,
        Effect.forkChild,
      )
      yield* Effect.sleep("20 millis")
      yield* client["annotation.add"]({
        target: sessionTarget(other.id),
        ns: "cli",
        kind: "note",
        data: "elsewhere",
      })
      const prData = { target, ns: "github", kind: "pr" }
      const added = yield* client["annotation.add"]({
        ...prData,
        data: pr("https://github.com/o/r/pull/1", "referenced"),
      })
      yield* client["annotation.add"]({
        ...prData,
        data: pr("https://github.com/o/r/pull/1", "created"),
      })
      yield* client["annotation.remove"]({ id: added.id })
      return yield* Fiber.join(watching)
    }),
  )

  expect(
    changes.map((change) =>
      change._tag === "changed" ? ["changed", change.annotation.data] : ["removed"],
    ),
  ).toEqual([
    ["changed", "before"],
    ["changed", pr("https://github.com/o/r/pull/1", "referenced")],
    ["changed", pr("https://github.com/o/r/pull/1", "created")],
    ["removed"],
  ])
})

test("deleting a session removes its annotations and tells its watchers", async () => {
  const { removed, listed } = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p" })
      const target = sessionTarget(session.id)
      const added = yield* client["annotation.add"]({ target, ns: "cli", kind: "note", data: 1 })
      const watching = yield* client["annotation.watch"]({ target }).pipe(
        Stream.take(2),
        Stream.runCollect,
        Effect.forkChild,
      )
      yield* Effect.sleep("20 millis")
      yield* client["session.delete"]({ sessionId: session.id })
      const [, removed] = yield* Fiber.join(watching)
      return {
        removed: removed?._tag === "removed" && removed.id === added.id,
        listed: yield* client["annotation.list"]({ target, kind: null }),
      }
    }),
  )

  expect(removed).toBe(true)
  expect(listed).toEqual([])
})
