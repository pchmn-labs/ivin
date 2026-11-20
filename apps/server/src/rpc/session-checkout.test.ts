import { Rpcs } from "@ivin/contracts/rpcs"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { layerScripted, type StartInput } from "@ivin/harness"
import { Effect, Layer } from "effect"
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
  // The server's git runs without the test's environment, and a stash or a commit needs a name.
  git(project, "config", "user.name", "ivin")
  git(project, "config", "user.email", "ivin@example.com")
  commit(upstream, "ahead.txt")
  git(upstream, "push", "--quiet", "origin", "main")
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(
  starts: StartInput[],
  use: (client: Client) => Effect.Effect<A, E>,
  turns: readonly (readonly HarnessOutput[])[] = [turn],
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
          Layer.provide(layerScripted(turns, { starts })),
        ),
      ),
      Effect.scoped,
    ),
  )
}

const statusOf = (client: Client) => client["worktree.checkoutStatus"]({ projectPath: project })

const newSession = (client: Client) => client["session.create"]({ projectPath: project })

test("on another branch, switching to the default branch checks it out level with origin", async () => {
  git(project, "checkout", "--quiet", "-b", "feature")
  const { before, switched, after } = await withServer([], (client) =>
    Effect.gen(function* () {
      const before = yield* statusOf(client)
      const created = yield* newSession(client)
      const switched = yield* client["session.switchToDefaultBranch"]({ sessionId: created.id })
      return { before, switched, after: yield* statusOf(client) }
    }),
  )

  expect(before).toEqual({
    branch: "feature",
    defaultBranch: "main",
    defaultBranchInWorktree: false,
    behind: 0,
  })
  expect(switched.branch).toBe("main")
  expect(git(project, "branch", "--show-current")).toBe("main")
  expect(existsSync(join(project, "ahead.txt"))).toBe(true)
  expect(after).toMatchObject({ branch: "main", behind: 0 })
})

test("a default branch held by another worktree is reported", async () => {
  git(project, "checkout", "--quiet", "-b", "feature")
  git(project, "worktree", "add", "--quiet", join(project, ".worktrees", "main"), "main")
  const status = await withServer([], statusOf)

  expect(status).toMatchObject({ defaultBranch: "main", defaultBranchInWorktree: true })
})

test("a branch behind origin counts the commits, and fast-forwarding brings it level", async () => {
  const { before, after } = await withServer([], (client) =>
    Effect.gen(function* () {
      const before = yield* statusOf(client)
      const created = yield* newSession(client)
      yield* client["session.fastForward"]({ sessionId: created.id })
      return { before, after: yield* statusOf(client) }
    }),
  )

  expect(before).toMatchObject({ branch: "main", behind: 1 })
  expect(after).toMatchObject({ branch: "main", behind: 0 })
  expect(existsSync(join(project, "ahead.txt"))).toBe(true)
})

test("a checkout with local changes is refused, then stashed before the switch", async () => {
  git(project, "checkout", "--quiet", "-b", "feature")
  writeFileSync(join(project, "first.txt"), "edited")
  const { refused } = await withServer([], (client) =>
    Effect.gen(function* () {
      const created = yield* newSession(client)
      const refused = yield* Effect.flip(
        client["session.switchToDefaultBranch"]({ sessionId: created.id }),
      )
      yield* client["session.switchToDefaultBranch"]({
        sessionId: created.id,
        localChanges: { kind: "stash" },
      })
      return { refused }
    }),
  )

  expect(refused._tag).toBe("CheckoutHasLocalChanges")
  expect(git(project, "branch", "--show-current")).toBe("main")
  expect(git(project, "status", "--porcelain")).toBe("")
  expect(git(project, "stash", "list")).toContain("WIP before switching to main")
})

test("a checkout's tracked changes are committed on its branch before the switch, untracked files left out", async () => {
  git(project, "checkout", "--quiet", "-b", "feature")
  writeFileSync(join(project, "first.txt"), "edited")
  writeFileSync(join(project, "new.txt"), "new")
  await withServer([], (client) =>
    Effect.gen(function* () {
      const created = yield* newSession(client)
      yield* client["session.switchToDefaultBranch"]({
        sessionId: created.id,
        localChanges: { kind: "commit", message: "Keep my edit" },
      })
    }),
  )

  expect(git(project, "branch", "--show-current")).toBe("main")
  expect(git(project, "log", "-1", "--format=%s", "feature")).toBe("Keep my edit")
  expect(git(project, "show", "--name-only", "--format=", "feature")).toBe("first.txt")
  expect(existsSync(join(project, "new.txt"))).toBe(true)
})

test("a default branch that diverged from origin fails with git's message, and is not merged", async () => {
  commit(project, "local.txt")
  git(project, "checkout", "--quiet", "-b", "feature")
  const { status, refused } = await withServer([], (client) =>
    Effect.gen(function* () {
      const status = yield* statusOf(client)
      const created = yield* newSession(client)
      const refused = yield* Effect.flip(
        client["session.switchToDefaultBranch"]({ sessionId: created.id }),
      )
      return { status, refused }
    }),
  )

  expect(status).toMatchObject({ branch: "feature", behind: 0 })
  expect(refused).toMatchObject({
    _tag: "GitRefused",
    message: expect.stringContaining("fast-forward"),
    blockedByLocalChanges: false,
  })
  expect(existsSync(join(project, "ahead.txt"))).toBe(false)
  expect(git(project, "rev-list", "--count", "main")).toBe("2")
})

test("a pull blocked by local changes says so, and pulls once they are stashed", async () => {
  writeFileSync(join(upstream, "first.txt"), "upstream edit")
  git(upstream, "commit", "--quiet", "-am", "edit first")
  git(upstream, "push", "--quiet", "origin", "main")
  writeFileSync(join(project, "first.txt"), "local edit")
  const refused = await withServer([], (client) =>
    Effect.gen(function* () {
      const created = yield* newSession(client)
      const refused = yield* Effect.flip(client["session.fastForward"]({ sessionId: created.id }))
      yield* client["session.fastForward"]({ sessionId: created.id, stash: true })
      return refused
    }),
  )

  expect(refused).toMatchObject({
    _tag: "GitRefused",
    message: expect.stringContaining("first.txt"),
    blockedByLocalChanges: true,
  })
  expect(git(project, "show", "HEAD:first.txt")).toBe("upstream edit")
  expect(git(project, "stash", "list")).toContain("WIP before pulling")
})

test("after the first message, the checkout is no longer switched", async () => {
  git(project, "checkout", "--quiet", "-b", "feature")
  const refused = await withServer([], (client) =>
    Effect.gen(function* () {
      const created = yield* newSession(client)
      yield* client["session.sendMessage"]({ sessionId: created.id, messageId: "m1", text: "go" })
      return yield* Effect.flip(client["session.switchToDefaultBranch"]({ sessionId: created.id }))
    }),
  )

  expect(refused._tag).toBe("SessionAlreadyStarted")
  expect(git(project, "branch", "--show-current")).toBe("feature")
})

test("outside a git repository there is no checkout status", async () => {
  const folder = join(root, "plain")
  execFileSync("mkdir", [folder])
  const status = await withServer([], (client) =>
    client["worktree.checkoutStatus"]({ projectPath: folder }),
  )

  expect(status).toBeNull()
})

test("untracked files in the way of the switch are stashed when the user asks", async () => {
  git(project, "checkout", "--quiet", "-b", "feature")
  writeFileSync(join(project, "ahead.txt"), "mine")
  const refused = await withServer([], (client) =>
    Effect.gen(function* () {
      const created = yield* newSession(client)
      const refused = yield* Effect.flip(
        client["session.switchToDefaultBranch"]({ sessionId: created.id }),
      )
      yield* client["session.switchToDefaultBranch"]({
        sessionId: created.id,
        localChanges: { kind: "stash" },
      })
      return refused
    }),
  )

  expect(refused).toMatchObject({ _tag: "GitRefused", blockedByLocalChanges: true })
  expect(git(project, "rev-parse", "--abbrev-ref", "HEAD")).toBe("main")
  expect(git(project, "rev-parse", "HEAD")).toBe(git(project, "rev-parse", "origin/main"))
  expect(git(project, "stash", "list")).toContain("WIP before switching to main")
})

test("the switch updates the branch of every session in the checkout", async () => {
  git(project, "checkout", "--quiet", "-b", "feature")
  const sessions = await withServer([], (client) =>
    Effect.gen(function* () {
      yield* newSession(client)
      const created = yield* newSession(client)
      yield* client["session.switchToDefaultBranch"]({ sessionId: created.id })
      return yield* client["session.list"]({ projectPath: project })
    }),
  )

  expect(sessions.map((s) => s.branch)).toEqual(["main", "main"])
})

test("the checkout does not move while another session's agent works in it", async () => {
  git(project, "checkout", "--quiet", "-b", "feature")
  const refused = await withServer(
    [],
    (client) =>
      Effect.gen(function* () {
        const running = yield* newSession(client)
        yield* client["session.sendMessage"]({ sessionId: running.id, messageId: "m1", text: "go" })
        const created = yield* newSession(client)
        return yield* Effect.flip(
          client["session.switchToDefaultBranch"]({ sessionId: created.id }),
        )
      }),
    [[{ type: "status", status: "running", raw: null }]],
  )

  expect(refused._tag).toBe("CheckoutInUse")
  expect(git(project, "branch", "--show-current")).toBe("feature")
})

test("a default branch with no local copy is checked out as a tracking branch", async () => {
  git(project, "checkout", "--quiet", "-b", "feature")
  git(project, "branch", "--quiet", "-D", "main")
  await withServer([], (client) =>
    Effect.gen(function* () {
      const created = yield* newSession(client)
      yield* client["session.switchToDefaultBranch"]({ sessionId: created.id })
    }),
  )

  expect(git(project, "branch", "--show-current")).toBe("main")
  expect(git(project, "rev-parse", "--abbrev-ref", "main@{upstream}")).toBe("origin/main")
  expect(existsSync(join(project, "ahead.txt"))).toBe(true)
})
