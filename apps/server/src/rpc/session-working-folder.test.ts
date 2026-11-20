import { Rpcs } from "@ivin/contracts/rpcs"
import type { WorkingFolderChoice } from "@ivin/contracts/session"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { layerScripted, type ScriptedElement, type StartInput } from "@ivin/harness"
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

const withServer = <A, E>(
  starts: StartInput[],
  use: (client: Client) => Effect.Effect<A, E>,
  turns: readonly (readonly ScriptedElement[])[] = [turn],
  closed: string[] = [],
) => {
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
          Layer.provide(layerScripted(turns, { starts, closed, reportSession: true })),
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
      const target = join(project, ".worktrees", `ivin-${created.id.slice(0, 8)}`)
      execFileSync("mkdir", ["-p", target])
      writeFileSync(join(target, "in-the-way.txt"), "")
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

test("the project lists its worktrees, without its checkout, and what a new one starts from", async () => {
  const path = join(project, ".worktrees", "docs-adr")
  git(project, "worktree", "add", "--quiet", "-b", "docs/adr", path)
  const { worktrees, base } = await withServer([], (client) =>
    Effect.gen(function* () {
      return {
        worktrees: yield* client["worktree.list"]({ projectPath: project }),
        base: yield* client["worktree.newBase"]({ projectPath: project }),
      }
    }),
  )

  expect(worktrees).toEqual([{ path, branch: "docs/adr" }])
  expect(base).toBe("origin/main")
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
  const { created, worktrees, base } = await withServer([], (client) =>
    Effect.gen(function* () {
      return {
        created: yield* client["session.create"]({ projectPath: folder, model: "sonnet" }),
        worktrees: yield* client["worktree.list"]({ projectPath: folder }),
        base: yield* client["worktree.newBase"]({ projectPath: folder }),
      }
    }),
  )

  expect(created).toMatchObject({ workingFolder: folder, branch: null, inWorktree: false })
  expect(worktrees).toEqual([])
  expect(base).toBeNull()
})

const sessionOf = (client: Client, sessionId: string) =>
  client["session.list"]({ projectPath: project }).pipe(
    Effect.map((sessions) => sessions.find((s) => s.id === sessionId)!),
  )

const untilStatus = (client: Client, sessionId: string, status: string) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 400; attempt++) {
      if ((yield* sessionOf(client, sessionId)).status === status) return
      yield* Effect.sleep("5 millis")
    }
    return yield* Effect.die(`The session never reached ${status}`)
  })

const send = (client: Client, sessionId: string, messageId: string) =>
  client["session.sendMessage"]({ sessionId, messageId, text: "go" }).pipe(
    Effect.andThen(untilStatus(client, sessionId, "idle")),
  )

const toolTurn = (
  calls: readonly { name: string; input: unknown; output: string; isError?: boolean }[],
): ScriptedElement[] => [
  { type: "status", status: "running", raw: null },
  ...calls.flatMap((call, index): ScriptedElement[] => [
    { type: "tool_call", toolCallId: `t${index}`, name: call.name, input: call.input, raw: null },
    {
      type: "tool_result",
      toolCallId: `t${index}`,
      output: call.output,
      isError: call.isError ?? false,
      raw: null,
    },
  ]),
  { type: "assistant_text", text: "Done.", raw: null },
  { type: "status", status: "idle", raw: null },
]

// Outputs as recorded in packages/harness/src/modules/claude/rules/fixtures/.
const enterWorktree = (path: string) =>
  toolTurn([
    {
      name: "EnterWorktree",
      input: { name: "try-adopt" },
      output: `Created worktree at “${path}” on branch “worktree-try-adopt”. The session is now working in the worktree. Use ExitWorktree to leave mid-session, or exit the session to be prompted.`,
    },
  ])
const exitWorktree = (path: string, back: string) =>
  toolTurn([
    {
      name: "ExitWorktree",
      input: { action: "keep" },
      output: `Exited worktree. Your work is preserved at “${path}” on branch “worktree-try-adopt”. Session is now back in “${back}”.`,
    },
  ])

test("EnterWorktree moves the session to the worktree at once, and the next turn resumes there", async () => {
  const path = join(project, ".claude", "worktrees", "try-adopt")
  git(project, "worktree", "add", "--quiet", "-b", "worktree-try-adopt", path)
  const starts: StartInput[] = []
  const closed: string[] = []
  const { moved, items, sessionId, closedBeforeShutdown } = await withServer(
    starts,
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
        yield* send(client, created.id, "m1")
        const moved = yield* sessionOf(client, created.id)
        yield* send(client, created.id, "m2")
        return {
          moved,
          items: yield* itemsOf(client, created.id),
          sessionId: created.id,
          closedBeforeShutdown: [...closed],
        }
      }),
    [enterWorktree(path), turn],
    closed,
  )

  expect(moved).toMatchObject({
    workingFolder: path,
    inWorktree: true,
    branch: "worktree-try-adopt",
  })
  expect(items.filter((i) => i.type === "working_folder")).toMatchObject([
    { path, inWorktree: true, branch: "worktree-try-adopt", cause: "adoption" },
  ])
  expect(starts).toMatchObject([
    { cwd: project, providerSessionId: null },
    { cwd: path, providerSessionId: `scripted-${sessionId}` },
  ])
  expect(closedBeforeShutdown).toEqual([sessionId])
})

test("ExitWorktree moves the session back to the checkout", async () => {
  const path = join(project, ".claude", "worktrees", "try-adopt")
  git(project, "worktree", "add", "--quiet", "-b", "worktree-try-adopt", path)
  const starts: StartInput[] = []
  const { back, items } = await withServer(
    starts,
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
        yield* send(client, created.id, "m1")
        yield* send(client, created.id, "m2")
        return {
          back: yield* sessionOf(client, created.id),
          items: yield* itemsOf(client, created.id),
        }
      }),
    [enterWorktree(path), exitWorktree(path, project)],
  )

  expect(back).toMatchObject({ workingFolder: project, inWorktree: false, branch: "main" })
  expect(items.filter((i) => i.type === "working_folder")).toMatchObject([
    { path, cause: "adoption" },
    { path: project, inWorktree: false, branch: "main", cause: "adoption" },
  ])
  expect(starts.map((s) => s.cwd)).toEqual([project, path])
})

test("a worktree the agent creates with git worktree add moves the session once the agent works in it", async () => {
  const path = join(project, ".worktrees", "try-adopt")
  const add = "git worktree add .worktrees/try-adopt -b try/adopt"
  const starts: StartInput[] = []
  const { beforeEntering, entered } = await withServer(
    starts,
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
        yield* client["session.sendMessage"]({ sessionId: created.id, messageId: "m1", text: "go" })
        yield* untilStatus(client, created.id, "waiting")
        // The approval holds the turn while git creates the worktree, as the real command would.
        git(project, "worktree", "add", "--quiet", "-b", "try/adopt", path)
        yield* client["session.answerApproval"]({
          sessionId: created.id,
          requestId: "r1",
          allow: true,
        })
        yield* untilStatus(client, created.id, "idle")
        const beforeEntering = yield* sessionOf(client, created.id)
        yield* send(client, created.id, "m2")
        return { beforeEntering, entered: yield* sessionOf(client, created.id) }
      }),
    [
      [
        { type: "status", status: "running", raw: null },
        { type: "tool_call", toolCallId: "t1", name: "Bash", input: { command: add }, raw: null },
        {
          type: "approval_request",
          requestId: "r1",
          toolCallId: "t1",
          name: "Bash",
          input: { command: add },
          raw: null,
        },
        {
          type: "tool_result",
          toolCallId: "t1",
          output: "Preparing worktree (new branch 'try/adopt')\nHEAD is now at 85e6a78 init",
          isError: false,
          raw: null,
        },
        { type: "status", status: "idle", raw: null },
      ],
      toolTurn([
        {
          name: "Bash",
          input: { command: "cd .worktrees/try-adopt && git branch --show-current" },
          output: "try/adopt",
        },
      ]),
    ],
  )

  expect(beforeEntering).toMatchObject({ workingFolder: project })
  expect(entered).toMatchObject({ workingFolder: path, inWorktree: true, branch: "try/adopt" })
  expect(starts.map((s) => s.cwd)).toEqual([project])
})

test("a git worktree add that failed moves nothing", async () => {
  const starts: StartInput[] = []
  const { session, items } = await withServer(
    starts,
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
        yield* send(client, created.id, "m1")
        yield* send(client, created.id, "m2")
        return {
          session: yield* sessionOf(client, created.id),
          items: yield* itemsOf(client, created.id),
        }
      }),
    [
      toolTurn([
        {
          name: "Bash",
          input: { command: "git worktree add .worktrees/again -b main && cd .worktrees/again" },
          output:
            "Exit code 255\nPreparing worktree (new branch 'main')\nfatal: a branch named 'main' already exists",
          isError: true,
        },
        { name: "Bash", input: { command: "cd .worktrees/again && ls" }, output: "" },
      ]),
      turn,
    ],
  )

  expect(session).toMatchObject({ workingFolder: project, inWorktree: false })
  expect(items.map((i) => i.type)).not.toContain("working_folder")
  expect(starts.map((s) => s.cwd)).toEqual([project])
})

const startInWorktree = (client: Client, path: string) =>
  Effect.gen(function* () {
    yield* client["project.open"]({ path: project })
    const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
    yield* sendFirst(client, created.id, { kind: "existing_worktree", path })
    return created.id
  })

const addWorktree = (name: string) => {
  const path = join(project, ".worktrees", name)
  git(project, "worktree", "add", "--quiet", "-b", name, path)
  return path
}

test("a worktree removed from outside marks its session when its tab opens", async () => {
  const path = addWorktree("gone")
  const session = await withServer([], (client) =>
    Effect.gen(function* () {
      const sessionId = yield* startInWorktree(client, path)
      expect((yield* sessionOf(client, sessionId))?.workingFolderDeleted).toBe(false)
      git(project, "worktree", "remove", "--force", path)
      yield* client["tab.open"]({ sessionId })
      return yield* sessionOf(client, sessionId)
    }),
  )

  expect(session).toMatchObject({ workingFolderDeleted: true, workingFolder: path })
})

test("a session whose worktree folder was deleted refuses messages, and keeps its transcript", async () => {
  const path = addWorktree("gone")
  const starts: StartInput[] = []
  const { error, session, items } = await withServer(starts, (client) =>
    Effect.gen(function* () {
      const sessionId = yield* startInWorktree(client, path)
      rmSync(path, { recursive: true, force: true })
      const error = yield* Effect.flip(
        client["session.sendMessage"]({ sessionId, messageId: "m2", text: "again" }),
      )
      return {
        error,
        session: yield* sessionOf(client, sessionId),
        items: yield* itemsOf(client, sessionId),
      }
    }),
  )

  expect(error).toMatchObject({ _tag: "WorkingFolderDeleted" })
  expect(session?.workingFolderDeleted).toBe(true)
  expect(starts).toHaveLength(1)
  expect(items.map((i) => i.type)).toEqual(["working_folder", "message", "message"])
})

const pickAfterDeletion = (choice: (sessionId: string) => WorkingFolderChoice) => {
  const path = addWorktree("gone")
  const starts: StartInput[] = []
  const closed: string[] = []
  return withServer(
    starts,
    (client) =>
      Effect.gen(function* () {
        const sessionId = yield* startInWorktree(client, path)
        git(project, "worktree", "remove", "--force", path)
        yield* client["tab.open"]({ sessionId })
        const picked = yield* client["session.pickWorkingFolder"]({
          sessionId,
          workingFolder: choice(sessionId),
        })
        yield* client["session.sendMessage"]({ sessionId, messageId: "m2", text: "again" })
        const items = yield* itemsOf(client, sessionId)
        return { sessionId, picked, starts, closed, items }
      }),
    [turn, turn],
    closed,
  )
}

test("picking the checkout moves the session there, and the next message resumes Claude in it", async () => {
  const { sessionId, picked, starts, closed, items } = await pickAfterDeletion(() => ({
    kind: "checkout",
  }))

  expect(picked).toMatchObject({
    workingFolder: project,
    inWorktree: false,
    branch: "main",
    workingFolderDeleted: false,
  })
  expect(closed).toContain(sessionId)
  expect(starts.map((s) => s.cwd)).toEqual([join(project, ".worktrees", "gone"), project])
  expect(starts[1]?.providerSessionId).toBe(`scripted-${sessionId}`)
  expect(items.filter((i) => i.type === "working_folder").at(-1)).toMatchObject({
    path: project,
    inWorktree: false,
    branch: "main",
    cause: "pick",
  })
})

test("picking an existing worktree moves the session there", async () => {
  const other = addWorktree("other")
  const { picked, starts, items } = await pickAfterDeletion(() => ({
    kind: "existing_worktree",
    path: other,
  }))

  expect(picked).toMatchObject({
    workingFolder: other,
    inWorktree: true,
    branch: "other",
    workingFolderDeleted: false,
  })
  expect(starts.at(-1)?.cwd).toBe(other)
  expect(items.filter((i) => i.type === "working_folder").at(-1)).toMatchObject({
    path: other,
    cause: "pick",
  })
})

test("picking a new worktree creates it from origin's default branch and moves the session there", async () => {
  const { sessionId, picked, starts, items } = await pickAfterDeletion(() => ({
    kind: "new_worktree",
  }))

  const path = join(project, ".worktrees", `ivin-${sessionId.slice(0, 8)}`)
  expect(picked).toMatchObject({
    workingFolder: path,
    inWorktree: true,
    branch: `ivin/${sessionId.slice(0, 8)}`,
    workingFolderDeleted: false,
  })
  expect(existsSync(join(path, "ahead.txt"))).toBe(true)
  expect(starts.at(-1)?.cwd).toBe(path)
  expect(items.filter((i) => i.type === "working_folder").at(-1)).toMatchObject({
    path,
    cause: "pick",
  })
})

test("picking a folder that is not one of the project's worktrees keeps the session marked", async () => {
  const path = addWorktree("gone")
  const { error, session } = await withServer([], (client) =>
    Effect.gen(function* () {
      const sessionId = yield* startInWorktree(client, path)
      git(project, "worktree", "remove", "--force", path)
      yield* client["tab.open"]({ sessionId })
      const error = yield* Effect.flip(
        client["session.pickWorkingFolder"]({
          sessionId,
          workingFolder: { kind: "existing_worktree", path },
        }),
      )
      return { error, session: yield* sessionOf(client, sessionId) }
    }),
  )

  expect(error).toMatchObject({ _tag: "WorktreeNotCreated", reason: "not_a_worktree" })
  expect(session?.workingFolderDeleted).toBe(true)
})

test("a session whose own new worktree was deleted gets another new worktree, on a branch of its own", async () => {
  const starts: StartInput[] = []
  const { sessionId, picked, status } = await withServer(starts, (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: project })
      const created = yield* client["session.create"]({ projectPath: project, model: "sonnet" })
      const first = yield* sendFirst(client, created.id, { kind: "new_worktree" })
      rmSync(first.workingFolder, { recursive: true, force: true })
      yield* client["tab.open"]({ sessionId: created.id })
      const picked = yield* client["session.pickWorkingFolder"]({
        sessionId: created.id,
        workingFolder: { kind: "new_worktree" },
      })
      return {
        sessionId: created.id,
        picked,
        status: (yield* sessionOf(client, created.id))?.status,
      }
    }),
  )

  const branch = `ivin/${sessionId.slice(0, 8)}-2`
  expect(picked).toMatchObject({ branch, inWorktree: true, workingFolderDeleted: false })
  expect(existsSync(picked.workingFolder)).toBe(true)
  expect(status).toBe("idle")
})

test("a session whose worktree was deleted while the server was down is marked when its project's tabs are listed", async () => {
  const path = addWorktree("gone")
  const session = await withServer([], (client) =>
    Effect.gen(function* () {
      const sessionId = yield* startInWorktree(client, path)
      yield* client["tab.open"]({ sessionId })
      git(project, "worktree", "remove", "--force", path)
      yield* client["tab.list"]({ projectPath: project })
      return yield* sessionOf(client, sessionId)
    }),
  )

  expect(session?.workingFolderDeleted).toBe(true)
})
