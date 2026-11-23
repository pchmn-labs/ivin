import { Rpcs } from "@ivin/contracts/rpcs"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { layerScripted, type StartInput } from "@ivin/harness"
import { Effect, Layer, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { execFileSync } from "node:child_process"
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"
import { handlers, layerServices } from "./handlers.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"

// Real git with fetches: over 1 s when the suite runs other git tests beside it.
vi.setConfig({ testTimeout: 5000 })

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

const commit = (repo: string, file: string, content = file) => {
  writeFileSync(join(repo, file), content)
  git(repo, "add", file)
  git(repo, "commit", "--quiet", "-m", file)
}

let root: string
let project: string
let upstream: string
let worktree: string

// A project cloned from a bare origin, with a local branch and a worktree; origin then gains a
// branch the project has not fetched yet.
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "ivin-branch-")))
  const origin = join(root, "origin.git")
  upstream = join(root, "upstream")
  project = join(root, "project")
  worktree = join(project, ".worktrees", "docs-adr")
  git(root, "init", "--quiet", "--bare", "-b", "main", origin)
  git(root, "init", "--quiet", "-b", "main", upstream)
  commit(upstream, "first.txt")
  git(upstream, "remote", "add", "origin", origin)
  git(upstream, "push", "--quiet", "origin", "main")
  git(root, "clone", "--quiet", origin, project)
  git(project, "checkout", "--quiet", "-b", "fix/local")
  commit(project, "first.txt", "changed on fix/local")
  git(project, "checkout", "--quiet", "main")
  git(project, "worktree", "add", "--quiet", "-b", "docs/adr", worktree)
  pushRemoteBranch("feat/remote")
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

const pushRemoteBranch = (branch: string) => {
  git(upstream, "checkout", "--quiet", "-b", branch, "main")
  commit(upstream, `${branch.replaceAll("/", "-")}.txt`)
  git(upstream, "push", "--quiet", "origin", branch)
  git(upstream, "checkout", "--quiet", "main")
}

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(
  use: (client: Client) => Effect.Effect<A, E>,
  { starts = [] }: { starts?: StartInput[] } = {},
) => {
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
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf([])),
          Layer.provide(layerScripted([turn, turn], { starts })),
        ),
      ),
      Effect.scoped,
    ),
  )
}

const listBranches = (client: Client, projectPath = project) =>
  client["worktree.listBranches"]({ projectPath }).pipe(Stream.runCollect)

const lastList = (client: Client) =>
  listBranches(client).pipe(Effect.map((lists) => lists[lists.length - 1]))

const untilIdle = (client: Client, sessionId: string) =>
  client["session.watch"]({ projectPath: project }).pipe(
    Stream.filter((change) => change._tag === "changed"),
    Stream.map((change) => change.session),
    Stream.filter((session) => session.id === sessionId && session.status === "idle"),
    Stream.take(1),
    Stream.runDrain,
  )

const itemsOf = (client: Client, sessionId: string) =>
  client["transcript.getItems"]({ sessionId, position: null, before: 100, after: 0 }).pipe(
    Effect.map((page) => page.items),
  )

test("the list holds local branches, with the worktree holding each, then origin's once fetched", async () => {
  const lists = await withServer(listBranches)

  expect(lists.map((list) => list.fetch)).toEqual(["fetching", "done"])
  expect(lists[0]?.branches.map((b) => b.name)).not.toContain("origin/feat/remote")
  expect(lists[1]?.branches).toEqual(
    expect.arrayContaining([
      { name: "main", remote: false, worktreePath: project },
      { name: "fix/local", remote: false, worktreePath: null },
      { name: "docs/adr", remote: false, worktreePath: worktree },
      { name: "origin/main", remote: true, worktreePath: null },
      { name: "origin/feat/remote", remote: true, worktreePath: null },
    ]),
  )
})

test("origin is not fetched again within a minute", async () => {
  const second = await withServer((client) =>
    Effect.gen(function* () {
      yield* listBranches(client)
      pushRemoteBranch("feat/later")
      return yield* lastList(client)
    }),
  )

  expect(second?.branches.map((b) => b.name)).not.toContain("origin/feat/later")
})

test("a failed fetch of origin is not tried again within a minute", async () => {
  const origin = join(root, "origin.git")
  const lists = await withServer((client) =>
    Effect.gen(function* () {
      renameSync(origin, `${origin}.away`)
      const failed = yield* lastList(client)
      renameSync(`${origin}.away`, origin)
      return { failed, again: yield* lastList(client) }
    }),
  )

  expect(lists.failed?.fetch).toBe("failed")
  expect(lists.again?.branches.map((b) => b.name)).not.toContain("origin/feat/remote")
})

test("a remote branch is checked out as a tracking branch, and the transcript records it", async () => {
  const { picked, items } = await withServer((client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: project })
      yield* listBranches(client)
      const picked = yield* client["session.pickBranch"]({
        sessionId: created.id,
        name: "origin/feat/remote",
        remote: true,
      })
      return { picked, items: yield* itemsOf(client, created.id) }
    }),
  )

  expect(picked).toMatchObject({ workingFolder: project, inWorktree: false, branch: "feat/remote" })
  expect(git(project, "branch", "--show-current")).toBe("feat/remote")
  expect(git(project, "rev-parse", "--abbrev-ref", "feat/remote@{upstream}")).toBe(
    "origin/feat/remote",
  )
  expect(items).toMatchObject([
    {
      type: "working_folder",
      path: project,
      inWorktree: false,
      branch: "feat/remote",
      cause: "branch_picker",
    },
  ])
})

test("a local branch is checked out in the session's working folder", async () => {
  const picked = await withServer((client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: project })
      return yield* client["session.pickBranch"]({
        sessionId: created.id,
        name: "fix/local",
        remote: false,
      })
    }),
  )

  expect(picked).toMatchObject({ workingFolder: project, branch: "fix/local" })
  expect(git(project, "branch", "--show-current")).toBe("fix/local")
})

test("a branch held by another worktree moves the session there, and its next turn runs there", async () => {
  const starts: StartInput[] = []
  const { picked, items } = await withServer(
    (client) =>
      Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: project })
        yield* client["session.sendMessage"]({ sessionId: created.id, messageId: "m1", text: "a" })
        yield* untilIdle(client, created.id)
        const picked = yield* client["session.pickBranch"]({
          sessionId: created.id,
          name: "docs/adr",
          remote: false,
        })
        yield* client["session.sendMessage"]({ sessionId: created.id, messageId: "m2", text: "b" })
        return { picked, items: yield* itemsOf(client, created.id) }
      }),
    { starts },
  )

  expect(picked).toMatchObject({ workingFolder: worktree, inWorktree: true, branch: "docs/adr" })
  expect(git(project, "branch", "--show-current")).toBe("main")
  expect(starts.map((s) => s.cwd)).toEqual([project, worktree])
  expect(items).toContainEqual(
    expect.objectContaining({
      type: "working_folder",
      path: worktree,
      inWorktree: true,
      cause: "branch_picker",
    }),
  )
})

test("a checkout git refuses returns git's message and leaves the session where it was", async () => {
  writeFileSync(join(project, "first.txt"), "uncommitted")
  const { error, session, items } = await withServer((client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: project })
      const error = yield* Effect.flip(
        client["session.pickBranch"]({ sessionId: created.id, name: "fix/local", remote: false }),
      )
      const [session] = yield* client["session.list"]({ projectPath: project })
      return { error, session, items: yield* itemsOf(client, created.id) }
    }),
  )

  expect(error).toMatchObject({
    _tag: "CheckoutRefused",
    gitMessage: expect.stringContaining("would be overwritten"),
  })
  expect(session).toMatchObject({ workingFolder: project, branch: "main" })
  expect(items).toEqual([])
})

test("a project opened through a symlink sees its checkout and worktrees under the path it was opened with", async () => {
  const linked = join(root, "linked")
  symlinkSync(project, linked)
  const { lists, picked } = await withServer((client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: linked })
      const lists = yield* listBranches(client, linked)
      const picked = yield* client["session.pickBranch"]({
        sessionId: created.id,
        name: "main",
        remote: false,
      })
      return { lists, picked }
    }),
  )

  expect(lists[lists.length - 1]?.branches).toEqual(
    expect.arrayContaining([
      { name: "main", remote: false, worktreePath: linked },
      { name: "docs/adr", remote: false, worktreePath: join(linked, ".worktrees", "docs-adr") },
    ]),
  )
  expect(picked).toMatchObject({ workingFolder: linked, inWorktree: false, branch: "main" })
})

test("a branch name that is not listed is refused before git runs, and the session stays", async () => {
  const { error, session } = await withServer((client) =>
    Effect.gen(function* () {
      const created = yield* client["session.create"]({ projectPath: project })
      const error = yield* Effect.flip(
        client["session.pickBranch"]({ sessionId: created.id, name: "--detach", remote: false }),
      )
      const [session] = yield* client["session.list"]({ projectPath: project })
      return { error, session }
    }),
  )

  expect(error).toMatchObject({ _tag: "CheckoutRefused", gitMessage: "No branch named --detach" })
  expect(session).toMatchObject({ workingFolder: project, branch: "main" })
})

test("worktrees and branches fail with git's message when git cannot read the repository, and are empty outside one", async () => {
  const plain = join(root, "plain")
  mkdirSync(plain)
  const empty = await withServer((client) =>
    Effect.all([client["worktree.list"]({ projectPath: plain }), listBranches(client, plain)]),
  )
  expect(empty[0]).toEqual([])
  expect([...empty[1]].every((list) => list.branches.length === 0)).toBe(true)

  appendFileSync(join(project, ".git/config"), "[broken\n")
  const failures = await withServer((client) =>
    Effect.all([
      Effect.flip(client["worktree.list"]({ projectPath: project })),
      Effect.flip(listBranches(client)),
    ]),
  )
  expect(failures[0]).toMatchObject({ _tag: "WorktreeGitFailed", projectPath: project })
  expect(failures[0].gitMessage).not.toBe("")
  expect(failures[1]).toMatchObject({ _tag: "WorktreeGitFailed", projectPath: project })
})
