import type { StartInput } from "@ivin/harness"
import { Effect } from "effect"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { commit, git } from "./git-fixture.ts"
import { newDatabase, withServer as withTestServer, type Client } from "./test-server.ts"

// Real git, several repositories per test.
vi.setConfig({ testTimeout: 8000 })

let root = ""
let worktrees = ""
let workspace = ""
let apiApp = ""
let webApp = ""
let notes = ""

const repository = (folder: string) => {
  mkdirSync(folder, { recursive: true })
  git(folder, "init", "--quiet", "-b", "main")
  commit(folder, "first.txt")
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "ivin-workspace-")))
  worktrees = join(root, "worktrees")
  apiApp = join(root, "api", "app")
  webApp = join(root, "web", "app")
  notes = join(root, "docs", "notes")
  repository(apiApp)
  repository(webApp)
  mkdirSync(notes, { recursive: true })
  workspace = join(root, "ivin.code-workspace")
  writeFileSync(
    workspace,
    JSON.stringify({ folders: [{ path: "api/app" }, { path: "web/app" }, { path: "docs/notes" }] }),
  )
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const withServer = <A, E>(
  starts: StartInput[],
  use: (client: Client) => Effect.Effect<A, E>,
  db = newDatabase({ trusted: false }),
) =>
  withTestServer(use, {
    db,
    workingFolderRoot: worktrees,
    turns: [[{ type: "status", status: "idle", raw: null }]],
    scripted: { starts },
  })

const openTrusted = (client: Client) => client["project.open"]({ path: workspace, trust: true })

test("opening a workspace lists its folders in the file's order, and asks once for those not trusted", async () => {
  const { refused, opened, afterCancel } = await withServer([], (client) =>
    Effect.gen(function* () {
      const refused = yield* client["project.open"]({ path: workspace }).pipe(Effect.flip)
      const afterCancel = yield* client["project.list"]()
      return { refused, opened: yield* openTrusted(client), afterCancel }
    }),
  )

  expect(refused).toMatchObject({ _tag: "ProjectNotTrusted", folders: [apiApp, webApp, notes] })
  expect(afterCancel.projects).toEqual([])
  expect(opened.projects[0]).toMatchObject({
    path: workspace,
    name: "ivin",
    workspace: true,
    folders: [apiApp, webApp, notes],
  })
})

test("a folder added to the file appears in the project, and a trusted folder is not asked again", async () => {
  const { reopened, again } = await withServer([], (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const extra = join(root, "extra")
      mkdirSync(extra)
      writeFileSync(
        workspace,
        JSON.stringify({ folders: [{ path: "api/app" }, { path: "extra" }] }),
      )
      const reopened = yield* client["project.list"]()
      const again = yield* client["project.open"]({ path: workspace }).pipe(Effect.flip)
      return { reopened, again }
    }),
  )

  expect(reopened.projects[0]?.folders).toEqual([apiApp, join(root, "extra")])
  expect(again).toMatchObject({ folders: [join(root, "extra")] })
})

test("the first message creates one worktree per repository on one branch, the colliding name gets -2", async () => {
  const starts: StartInput[] = []
  const sent = await withServer(starts, (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const session = yield* client["session.create"]({ projectPath: workspace })
      return yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "m1",
        text: "go",
        workingFolder: { kind: "new_worktree" },
      })
    }),
  )

  const branch = `ivin/${sent.id.slice(0, 8)}`
  const folder = join(worktrees, "ivin", `ivin-${sent.id.slice(0, 8)}`)
  expect(sent).toMatchObject({ workingFolder: folder, inWorktree: true, branch, started: true })
  expect(readdirSync(folder).sort()).toEqual(["app", "app-2"])
  expect(git(join(folder, "app"), "branch", "--show-current")).toBe(branch)
  expect(git(join(folder, "app-2"), "branch", "--show-current")).toBe(branch)
  expect(git(join(folder, "app"), "rev-parse", "--git-common-dir")).toBe(join(apiApp, ".git"))
  expect(git(join(folder, "app-2"), "rev-parse", "--git-common-dir")).toBe(join(webApp, ".git"))
  expect(starts.map((s) => [s.cwd, s.extraDirectories])).toEqual([[folder, [notes]]])
})

test("when one worktree cannot be created, no folder is left and the message is not sent", async () => {
  const empty = join(root, "empty")
  mkdirSync(empty)
  git(empty, "init", "--quiet", "-b", "main")
  writeFileSync(workspace, JSON.stringify({ folders: [{ path: "api/app" }, { path: "empty" }] }))
  const starts: StartInput[] = []
  const { error, session } = await withServer(starts, (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const created = yield* client["session.create"]({ projectPath: workspace })
      const error = yield* client["session.sendMessage"]({
        sessionId: created.id,
        messageId: "m1",
        text: "go",
        workingFolder: { kind: "new_worktree" },
      }).pipe(Effect.flip)
      return { error, session: created }
    }),
  )

  expect(error).toMatchObject({ _tag: "WorktreeNotCreated" })
  expect(starts).toEqual([])
  expect(existsSync(join(worktrees, "ivin", `ivin-${session.id.slice(0, 8)}`))).toBe(false)
  expect(git(apiApp, "worktree", "list", "--porcelain").match(/^worktree /gm)).toHaveLength(1)
})

test("a session on the checkouts starts in the first folder, the others being extra directories", async () => {
  const starts: StartInput[] = []
  const session = await withServer(starts, (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const created = yield* client["session.create"]({ projectPath: workspace })
      yield* client["session.sendMessage"]({
        sessionId: created.id,
        messageId: "m1",
        text: "go",
        workingFolder: { kind: "checkout" },
      })
      return created
    }),
  )

  expect(session).toMatchObject({ workingFolder: apiApp, inWorktree: false })
  expect(starts.map((s) => [s.cwd, s.extraDirectories])).toEqual([[apiApp, [webApp, notes]]])
})

test("folders sharing a parent start in it", async () => {
  const shared = join(root, "shared")
  mkdirSync(join(shared, "x"), { recursive: true })
  mkdirSync(join(shared, "y"), { recursive: true })
  writeFileSync(
    workspace,
    JSON.stringify({ folders: [{ path: "shared/x" }, { path: "shared/y" }] }),
  )
  const starts: StartInput[] = []
  await withServer(starts, (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const created = yield* client["session.create"]({ projectPath: workspace })
      expect(created).toMatchObject({ workingFolder: shared, branch: null })
      yield* client["session.sendMessage"]({
        sessionId: created.id,
        messageId: "m1",
        text: "go",
        workingFolder: { kind: "checkout" },
      })
    }),
  )

  expect(starts.map((s) => [s.cwd, s.extraDirectories])).toEqual([[shared, []]])
})

test("a turn's edits in two repositories are listed under each repository, and read and discarded there", async () => {
  const { changes, diff, after, status } = await withServer([], (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const session = yield* client["session.create"]({ projectPath: workspace })
      const sent = yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "m1",
        text: "go",
        workingFolder: { kind: "new_worktree" },
      })
      writeFileSync(join(sent.workingFolder, "app", "first.txt"), "edited in api\n")
      writeFileSync(join(sent.workingFolder, "app-2", "new.txt"), "new in web\n")
      const changes = yield* client["file.listChanges"]({ sessionId: sent.id })
      const diff = yield* client["file.readDiff"]({ sessionId: sent.id, path: "app/first.txt" })
      const status = yield* client["file.gitStatus"]({ sessionId: sent.id })
      yield* client["file.discardChanges"]({ sessionId: sent.id, paths: ["app-2/new.txt"] })
      const after = yield* client["file.listChanges"]({ sessionId: sent.id })
      return { changes, diff, after, status }
    }),
  )

  expect(changes).toMatchObject({ kind: "listed", repositories: ["app", "app-2"] })
  expect(changes.kind === "listed" && changes.changes.map((c) => [c.path, c.status])).toEqual([
    ["app/first.txt", "modified"],
    ["app-2/new.txt", "untracked"],
  ])
  expect(diff).toMatchObject({ kind: "text", status: "modified" })
  expect(status.map((entry) => entry.path).sort()).toEqual(["app-2/new.txt", "app/first.txt"])
  expect(after.kind === "listed" && after.changes.map((c) => c.path)).toEqual(["app/first.txt"])
})

test("the commits of each repository are listed under it, with a diff read there", async () => {
  for (const repo of [apiApp, webApp]) {
    const bare = `${repo}-origin.git`
    git(root, "init", "--quiet", "--bare", "-b", "main", bare)
    git(repo, "remote", "add", "origin", bare)
    git(repo, "push", "--quiet", "origin", "main")
    git(repo, "remote", "set-head", "origin", "main")
  }
  const { committed, diff } = await withServer([], (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const session = yield* client["session.create"]({ projectPath: workspace })
      const sent = yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "m1",
        text: "go",
        workingFolder: { kind: "new_worktree" },
      })
      commit(join(sent.workingFolder, "app"), "api.txt")
      commit(join(sent.workingFolder, "app-2"), "web.txt")
      const committed = yield* client["file.listCommittedChanges"]({ sessionId: sent.id })
      const diff = yield* client["file.readCommittedDiff"]({
        sessionId: sent.id,
        path: "app-2/web.txt",
      })
      return { committed, diff }
    }),
  )

  expect(committed).toMatchObject({ kind: "listed", base: "origin/main" })
  expect(committed.kind === "listed" && committed.changes.map((c) => [c.path, c.status])).toEqual([
    ["app-2/web.txt", "added"],
    ["app/api.txt", "added"],
  ])
  expect(diff).toMatchObject({ kind: "text", status: "added", added: 1 })
})

test("a repository that cannot list its commits is left out while another can", async () => {
  const bare = `${apiApp}-origin.git`
  git(root, "init", "--quiet", "--bare", "-b", "main", bare)
  git(apiApp, "remote", "add", "origin", bare)
  git(apiApp, "push", "--quiet", "origin", "main")
  git(apiApp, "remote", "set-head", "origin", "main")
  const committed = await withServer([], (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const session = yield* client["session.create"]({ projectPath: workspace })
      const sent = yield* client["session.sendMessage"]({
        sessionId: session.id,
        messageId: "m1",
        text: "go",
        workingFolder: { kind: "new_worktree" },
      })
      commit(join(sent.workingFolder, "app"), "api.txt")
      commit(join(sent.workingFolder, "app-2"), "web.txt")
      return yield* client["file.listCommittedChanges"]({ sessionId: sent.id })
    }),
  )

  expect(committed.kind === "listed" && committed.changes.map((c) => c.path)).toEqual([
    "app/api.txt",
  ])
})
