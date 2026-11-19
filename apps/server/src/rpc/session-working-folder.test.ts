import { Rpcs } from "@ivin/contracts/rpcs"
import type { WorkingFolderChoice } from "@ivin/contracts/session"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { layerScripted, type StartInput } from "@ivin/harness"
import { Effect, Fiber, Layer, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { afterEach, beforeEach, expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"

const turn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "assistant_text", text: "Done.", raw: null },
  { type: "status", status: "idle", raw: null },
]

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "ivin",
  GIT_AUTHOR_EMAIL: "ivin@example.com",
  GIT_COMMITTER_NAME: "ivin",
  GIT_COMMITTER_EMAIL: "ivin@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, env: gitEnv, encoding: "utf8" }).trim()

const commit = (repo: string, file: string) => {
  writeFileSync(join(repo, file), file)
  git(repo, "add", file)
  git(repo, "commit", "--quiet", "-m", file)
}

let root: string
let project: string
let upstream: string

// A project cloned from a bare origin, then origin moves ahead: the local main is behind.
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "ivin-git-")))
  const origin = join(root, "origin.git")
  upstream = join(root, "upstream")
  project = join(root, "project")
  git(root, "init", "--quiet", "--bare", "-b", "main", origin)
  git(root, "init", "--quiet", "-b", "main", upstream)
  commit(upstream, "first.txt")
  git(upstream, "remote", "add", "origin", origin)
  git(upstream, "push", "--quiet", "origin", "main")
  git(root, "clone", "--quiet", origin, project)
  commit(upstream, "ahead.txt")
  git(upstream, "push", "--quiet", "origin", "main")
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(starts: StartInput[], use: (client: Client) => Effect.Effect<A, E>) => {
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
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(layerScripted([turn], { starts })),
        ),
      ),
      Effect.scoped,
    ),
  )
}

const itemsOf = (client: Client, sessionId: string) =>
  client["transcript.getItems"]({ sessionId, position: null, before: 100, after: 0 }).pipe(
    Effect.map((page) => page.items),
  )

test("a checkout session runs in the project folder, on the checkout's branch", async () => {
  const starts: StartInput[] = []
  const { created, sent, items } = await withServer(starts, (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
      const sent = yield* client["session.sendMessage"]({
        sessionId: created.id,
        messageId: "m1",
        text: "go",
        workingFolder: { kind: "checkout" },
      })
      return { created, sent, items: yield* itemsOf(client, created.id) }
    }),
  )

  expect(created).toMatchObject({
    workingFolder: project,
    inWorktree: false,
    branch: "main",
    started: false,
  })
  expect(sent.started).toBe(true)
  expect(starts.map((s) => s.cwd)).toEqual([project])
  expect(items.map((i) => i.type)).not.toContain("working_folder")
})

const sendFirst = (client: Client, sessionId: string, workingFolder: WorkingFolderChoice) =>
  client["session.sendMessage"]({ sessionId, messageId: "m1", text: "go", workingFolder })

test("a new worktree session gets a generated branch under .worktrees/, from origin's fresh default branch", async () => {
  const starts: StartInput[] = []
  const { sent, items } = await withServer(starts, (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
      const sent = yield* sendFirst(client, created.id, { kind: "new_worktree" })
      return { sent, items: yield* itemsOf(client, created.id) }
    }),
  )

  const branch = `ivin/${sent.id.slice(0, 8)}`
  const path = join(project, ".worktrees", `ivin-${sent.id.slice(0, 8)}`)
  expect(sent).toMatchObject({ workingFolder: path, inWorktree: true, branch, started: true })
  expect(starts.map((s) => s.cwd)).toEqual([path])
  expect(existsSync(join(path, "ahead.txt"))).toBe(true)
  expect(existsSync(join(project, "ahead.txt"))).toBe(false)
  expect(git(path, "branch", "--show-current")).toBe(branch)
  expect(git(project, "worktree", "list", "--porcelain")).toContain(`worktree ${path}`)
  expect(items.slice(0, 2)).toMatchObject([
    { type: "working_folder", path, branch, inWorktree: true, cause: "creation" },
    { type: "message", role: "user", text: "go" },
  ])
})

test("a session is preparing its new worktree before it works", async () => {
  const statuses = await withServer([], (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
      const watching = yield* client["session.watch"]({ projectPath: project }).pipe(
        Stream.map((session) => session.status),
        Stream.takeUntil((status) => status === "working"),
        Stream.runCollect,
        Effect.forkChild,
      )
      yield* Effect.sleep("10 millis")
      yield* sendFirst(client, created.id, { kind: "new_worktree" })
      return yield* Fiber.join(watching)
    }),
  )

  expect(statuses).toContain("preparing_worktree")
  expect(statuses.indexOf("preparing_worktree")).toBeLessThan(statuses.indexOf("working"))
})

test("a worktree that git cannot create stores git's error, and no run starts", async () => {
  const starts: StartInput[] = []
  const { error, session, items } = await withServer(starts, (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
      git(project, "branch", `ivin/${created.id.slice(0, 8)}`)
      const error = yield* Effect.flip(sendFirst(client, created.id, { kind: "new_worktree" }))
      const [session] = yield* client["session.list"]({ projectPath: project })
      return { error, session, items: yield* itemsOf(client, created.id) }
    }),
  )

  expect(error).toMatchObject({ _tag: "WorktreeNotCreated", reason: "git" })
  expect(starts).toEqual([])
  expect(session).toMatchObject({ workingFolder: project, started: false, status: "failed" })
  expect(items).toMatchObject([
    { type: "error", message: expect.stringContaining("already exists") },
  ])
})

test("the project lists its worktrees, without its checkout", async () => {
  const path = join(project, ".worktrees", "docs-adr")
  git(project, "worktree", "add", "--quiet", "-b", "docs/adr", path)
  const worktrees = await withServer([], (client) =>
    client["worktree.list"]({ projectPath: project }),
  )

  expect(worktrees).toEqual([{ path, branch: "docs/adr" }])
})

test("a session started in an existing worktree runs there, on its branch", async () => {
  const path = join(project, ".worktrees", "docs-adr")
  git(project, "worktree", "add", "--quiet", "-b", "docs/adr", path)
  const starts: StartInput[] = []
  const { sent, items } = await withServer(starts, (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
      const sent = yield* sendFirst(client, created.id, { kind: "existing_worktree", path })
      return { sent, items: yield* itemsOf(client, created.id) }
    }),
  )

  expect(sent).toMatchObject({ workingFolder: path, inWorktree: true, branch: "docs/adr" })
  expect(starts.map((s) => s.cwd)).toEqual([path])
  expect(items[0]).toMatchObject({ type: "working_folder", path, cause: "choice" })
})

test("a folder that is not one of the project's worktrees is refused, and no run starts", async () => {
  const starts: StartInput[] = []
  const error = await withServer(starts, (client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
      return yield* Effect.flip(
        sendFirst(client, created.id, { kind: "existing_worktree", path: root }),
      )
    }),
  )

  expect(error).toMatchObject({ _tag: "WorktreeNotCreated", reason: "not_a_worktree" })
  expect(starts).toEqual([])
})

test("a session outside a git repository has no branch, and its project no worktree", async () => {
  const folder = join(root, "plain")
  execFileSync("mkdir", [folder])
  const { created, worktrees } = await withServer([], (client) =>
    Effect.gen(function* () {
      return {
        created: yield* client["session.create"]({ projectPath: folder, model: "sonnet" }),
        worktrees: yield* client["worktree.list"]({ projectPath: folder }),
      }
    }),
  )

  expect(created).toMatchObject({ workingFolder: folder, branch: null, inWorktree: false })
  expect(worktrees).toEqual([])
})
