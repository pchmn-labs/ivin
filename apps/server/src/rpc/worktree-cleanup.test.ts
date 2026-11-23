import { Rpcs } from "@ivin/contracts/rpcs"
import type { WorkingFolderChoice } from "@ivin/contracts/session"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { execFileSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { WorktreeCleanup } from "../modules/worktree/usecases/worktree-cleanup.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { trustEveryFolder } from "./trust-every-folder.ts"
import { handlers, layerServices } from "./handlers.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"

// Each test runs about forty git commands, 0.6 s alone but 10x slower while the whole suite runs.
vi.setConfig({ testTimeout: 10_000 })

const turn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "assistant_text", text: "Done.", raw: null },
  { type: "status", status: "idle", raw: null },
]
const working: readonly HarnessOutput[] = [{ type: "status", status: "running", raw: null }]

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

const commit = (repo: string, file: string, text = file) => {
  writeFileSync(join(repo, file), text)
  git(repo, "add", file)
  git(repo, "commit", "--quiet", "-m", file)
}

let template: string
let root: string
let project: string
let upstream: string

beforeAll(() => {
  template = realpathSync(mkdtempSync(join(tmpdir(), "ivin-cleanup-template-")))
  const origin = join(template, "origin.git")
  const first = join(template, "upstream")
  git(template, "init", "--quiet", "--bare", "-b", "main", origin)
  git(template, "init", "--quiet", "-b", "main", first)
  commit(first, "first.txt")
  git(first, "remote", "add", "origin", origin)
  git(first, "push", "--quiet", "origin", "main")
  git(template, "clone", "--quiet", origin, join(template, "project"))
  writeFileSync(join(template, "project", ".git", "info", "exclude"), ".worktrees/\n")
})

afterAll(() => rmSync(template, { recursive: true, force: true }))

// A copy of the template, with the remotes' paths pointing at the copy.
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "ivin-cleanup-")))
  cpSync(template, root, { recursive: true })
  upstream = join(root, "upstream")
  project = join(root, "project")
  for (const repo of [upstream, project]) {
    const config = join(repo, ".git", "config")
    writeFileSync(config, readFileSync(config, "utf8").replaceAll(template, root))
  }
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

// Lands `branch` on origin's main the way a pull request does, from another clone.
const mergeOnOrigin = (branch: string, how: "merge" | "squash") => {
  git(upstream, "pull", "--quiet", "origin", "main")
  git(upstream, "fetch", "--quiet", "origin", branch)
  if (how === "merge") git(upstream, "merge", "--quiet", "--no-ff", "-m", "merge", "FETCH_HEAD")
  else {
    git(upstream, "merge", "--quiet", "--squash", "FETCH_HEAD")
    git(upstream, "commit", "--quiet", "-m", "squash")
  }
  git(upstream, "push", "--quiet", "origin", "main")
}

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(
  use: (client: Client) => Effect.Effect<A, E, WorktreeCleanup>,
  { settings = [], turns = [turn] }: { settings?: string[]; turns?: (typeof turn)[] } = {},
) => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  trustEveryFolder(db)
  return Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provideMerge(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(
            Layer.succeed(ImageFolder)({ path: mkdtempSync(join(tmpdir(), "ivin-images-")) }),
          ),
          Layer.provide(layerKeybindingsFileOf([])),
          Layer.provide(layerSettingsFileOf(settings)),
          Layer.provide(layerScripted(turns)),
        ),
      ),
      Effect.scoped,
    ),
  )
}

// A session with an open tab, started in `workingFolder`.
const startSession = (client: Client, workingFolder: WorkingFolderChoice) =>
  Effect.gen(function* () {
    const created = yield* client["session.create"]({ projectPath: project })
    yield* client["tab.open"]({ sessionId: created.id })
    return yield* client["session.sendMessage"]({
      sessionId: created.id,
      messageId: crypto.randomUUID(),
      text: "go",
      workingFolder,
    })
  })

const closeTab = (client: Client, sessionId: string) =>
  Effect.gen(function* () {
    yield* client["tab.close"]({ sessionId })
    yield* (yield* WorktreeCleanup).settled
    const sessions = yield* client["session.list"]({ projectPath: project })
    return sessions.find((session) => session.id === sessionId)!
  })

// Closes the tab of a worktree session once `prepare` has run in its worktree.
const closeWorktreeSession = (
  prepare: (worktree: string, branch: string) => void,
  options?: Parameters<typeof withServer>[1],
) =>
  withServer(
    (client) =>
      Effect.gen(function* () {
        yield* client["project.open"]({ path: project })
        if (options?.settings) yield* settingsRead(client)
        const session = yield* startSession(client, { kind: "new_worktree" })
        prepare(session.workingFolder, session.branch!)
        return { worktree: session.workingFolder, closed: yield* closeTab(client, session.id) }
      }),
    options,
  )

const settingsRead = (client: Client) =>
  client["setting.watch"]().pipe(
    Stream.filter(({ settings }) => !settings.worktrees.removeOnTabClose),
    Stream.runHead,
  )

const commitAndPush = (worktree: string, branch: string, file = "work.txt") => {
  commit(worktree, file)
  git(worktree, "push", "--quiet", "origin", branch)
}

test("a worktree whose branch was merged is removed when its tab closes, and its session marked", async () => {
  const { worktree, closed } = await closeWorktreeSession((worktree, branch) => {
    commitAndPush(worktree, branch)
    mergeOnOrigin(branch, "merge")
  })

  expect(existsSync(worktree)).toBe(false)
  expect(git(project, "worktree", "list")).not.toContain(worktree)
  expect(closed.workingFolderDeleted).toBe(true)
})

test("a worktree whose branch was squash merged is removed, even after main edited its lines", async () => {
  const { worktree } = await closeWorktreeSession((worktree, branch) => {
    commitAndPush(worktree, branch)
    mergeOnOrigin(branch, "squash")
    commit(upstream, "work.txt", "edited on main")
    git(upstream, "push", "--quiet", "origin", "main")
  })

  expect(existsSync(worktree)).toBe(false)
})

test("a merged worktree with local changes is kept", async () => {
  const { worktree, closed } = await closeWorktreeSession((worktree, branch) => {
    commitAndPush(worktree, branch)
    mergeOnOrigin(branch, "merge")
    writeFileSync(join(worktree, "draft.txt"), "untracked")
  })

  expect(existsSync(join(worktree, "draft.txt"))).toBe(true)
  expect(closed.workingFolderDeleted).toBe(false)
})

test("a worktree whose branch is pushed but not merged is kept", async () => {
  const { worktree } = await closeWorktreeSession(commitAndPush)

  expect(existsSync(worktree)).toBe(true)
})

test("a worktree with an unpushed commit is kept", async () => {
  const { worktree } = await closeWorktreeSession((worktree) => commit(worktree, "work.txt"))

  expect(existsSync(worktree)).toBe(true)
})

test("a merged worktree is kept when settings.json turns removal off", async () => {
  const { worktree } = await closeWorktreeSession(
    (worktree, branch) => {
      commitAndPush(worktree, branch)
      mergeOnOrigin(branch, "merge")
    },
    { settings: [`{ "worktrees": { "removeOnTabClose": false } }`] },
  )

  expect(existsSync(worktree)).toBe(true)
})

test("a merged worktree is kept while another session with an open tab uses it", async () => {
  const { worktree, closed } = await withServer(
    (client) =>
      Effect.gen(function* () {
        yield* client["project.open"]({ path: project })
        const first = yield* startSession(client, { kind: "new_worktree" })
        yield* startSession(client, { kind: "existing_worktree", path: first.workingFolder })
        commitAndPush(first.workingFolder, first.branch!)
        mergeOnOrigin(first.branch!, "merge")
        return { worktree: first.workingFolder, closed: yield* closeTab(client, first.id) }
      }),
    { turns: [turn] },
  )

  expect(existsSync(worktree)).toBe(true)
  expect(closed.workingFolderDeleted).toBe(false)
})

test("a merged worktree is kept while its agent still runs with its tab closed", async () => {
  const { worktree } = await withServer(
    (client) =>
      Effect.gen(function* () {
        yield* client["project.open"]({ path: project })
        yield* client["setting.watch"]().pipe(
          Stream.filter(({ settings }) => !settings.tabs.stopAgentOnClose),
          Stream.runHead,
        )
        const session = yield* startSession(client, { kind: "new_worktree" })
        commitAndPush(session.workingFolder, session.branch!)
        mergeOnOrigin(session.branch!, "merge")
        yield* closeTab(client, session.id)
        return { worktree: session.workingFolder }
      }),
    { settings: [`{ "tabs": { "stopAgentOnClose": false } }`], turns: [working] },
  )

  expect(existsSync(worktree)).toBe(true)
})

test("closing a tab sweeps the merged worktrees agents made under .worktrees/, and keeps the others", async () => {
  const agentWorktree = (name: string) => {
    const path = join(project, ".worktrees", name)
    git(project, "worktree", "add", "--quiet", "-b", name, path, "origin/main")
    commitAndPush(path, name, `${name}.txt`)
    return path
  }
  const merged = agentWorktree("merged")
  const unmerged = agentWorktree("unmerged")
  mergeOnOrigin("merged", "merge")
  const empty = join(project, ".worktrees", "empty")
  git(project, "worktree", "add", "--quiet", "-b", "empty", empty, "origin/main")

  const { closed } = await withServer((client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: project })
      const session = yield* startSession(client, { kind: "checkout" })
      return { closed: yield* closeTab(client, session.id) }
    }),
  )

  expect(existsSync(merged)).toBe(false)
  expect(existsSync(unmerged)).toBe(true)
  expect(existsSync(empty)).toBe(true)
  expect(existsSync(project)).toBe(true)
  expect(closed.workingFolderDeleted).toBe(false)
})

test("the checkout is never removed, even clean and on a merged branch", async () => {
  const { closed } = await withServer((client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: project })
      const session = yield* startSession(client, { kind: "checkout" })
      return { closed: yield* closeTab(client, session.id) }
    }),
  )

  expect(existsSync(join(project, "first.txt"))).toBe(true)
  expect(git(project, "rev-parse", "--is-inside-work-tree")).toBe("true")
  expect(closed.workingFolderDeleted).toBe(false)
})
