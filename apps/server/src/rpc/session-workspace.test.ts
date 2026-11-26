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
import { WorktreeCleanup } from "../modules/session/usecases/worktree-cleanup.ts"
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
  use: (client: Client) => Effect.Effect<A, E, WorktreeCleanup>,
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

test("before the first message, Files shows only the project folders, though they share a parent holding another", async () => {
  const shared = join(root, "shared")
  repository(join(shared, "api"))
  repository(join(shared, "web"))
  mkdirSync(join(shared, "other"))
  writeFileSync(
    workspace,
    JSON.stringify({ folders: [{ path: "shared/web" }, { path: "shared/api" }] }),
  )
  const starts: StartInput[] = []
  const { created, top, inside, file, files, sent } = await withServer(starts, (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const created = yield* client["session.create"]({ projectPath: workspace })
      const sessionId = created.id
      const top = yield* client["file.listFolder"]({ sessionId, path: "" })
      const inside = yield* client["file.listFolder"]({ sessionId, path: "api" })
      const file = yield* client["file.readFile"]({ sessionId, path: "web/first.txt" })
      const files = yield* client["file.listFiles"]({ sessionId })
      const sent = yield* client["session.sendMessage"]({ sessionId, messageId: "m1", text: "go" })
      return { created, top, inside, file, files, sent }
    }),
  )

  expect(created).toMatchObject({ workingFolder: workspace, inWorktree: false, branch: null })
  expect(top.map((entry) => entry.name)).toEqual(["web", "api"])
  expect(inside.map((entry) => entry.name)).toEqual(["first.txt"])
  expect(file).toMatchObject({ kind: "text" })
  expect(files).toMatchObject({ paths: ["api/first.txt", "web/first.txt"] })
  const folder = join(worktrees, "ivin", `ivin-${sent.id.slice(0, 8)}`)
  expect(sent).toMatchObject({ workingFolder: folder, inWorktree: true })
  expect(readdirSync(folder).sort()).toEqual(["api", "web"])
  expect(starts.map((s) => s.cwd)).toEqual([folder])
})

test("a first message on the checkout choice still creates the working folder", async () => {
  const sent = await withServer([], (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const created = yield* client["session.create"]({ projectPath: workspace })
      return yield* client["session.sendMessage"]({
        sessionId: created.id,
        messageId: "m1",
        text: "go",
        workingFolder: { kind: "checkout" },
      })
    }),
  )

  expect(sent).toMatchObject({ inWorktree: true, branch: `ivin/${sent.id.slice(0, 8)}` })
})

test("a workspace with no repository is no repository in Changes, and starts in its first folder with the others as extra directories", async () => {
  const other = join(root, "other")
  mkdirSync(other)
  writeFileSync(workspace, JSON.stringify({ folders: [{ path: "docs/notes" }, { path: "other" }] }))
  const starts: StartInput[] = []
  const { changes, sent } = await withServer(starts, (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const created = yield* client["session.create"]({ projectPath: workspace })
      const changes = yield* client["file.listChanges"]({ sessionId: created.id })
      const sent = yield* client["session.sendMessage"]({
        sessionId: created.id,
        messageId: "m1",
        text: "go",
      })
      return { changes, sent }
    }),
  )

  expect(changes).toEqual({ kind: "not_repository" })
  expect(sent).toMatchObject({ workingFolder: notes, inWorktree: false })
  expect(starts.map((s) => [s.cwd, s.extraDirectories])).toEqual([[notes, [other]]])
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

const withOrigins = () => {
  for (const repo of [apiApp, webApp]) {
    const bare = `${repo}-origin.git`
    git(root, "init", "--quiet", "--bare", "-b", "main", bare)
    git(repo, "remote", "add", "origin", bare)
    git(repo, "push", "--quiet", "origin", "main")
    git(repo, "remote", "set-head", "origin", "main")
  }
}

const sendFirst = (
  client: Client,
  sessionId: string,
  workingFolder?:
    | { kind: "new_worktree" }
    | { kind: "checkout"; path: string }
    | { kind: "existing_worktree"; path: string },
) =>
  client["session.sendMessage"]({
    sessionId,
    messageId: crypto.randomUUID(),
    text: "go",
    ...(workingFolder !== undefined && { workingFolder }),
  })

test("picking one project folder runs the agent there, with the other project folders as extra directories", async () => {
  const starts: StartInput[] = []
  const { sent, picked, refused } = await withServer(starts, (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const first = yield* client["session.create"]({ projectPath: workspace })
      const sent = yield* sendFirst(client, first.id, { kind: "checkout", path: webApp })
      const second = yield* client["session.create"]({ projectPath: workspace })
      const picked = yield* client["session.pickWorkingFolder"]({
        sessionId: second.id,
        workingFolder: { kind: "checkout", path: apiApp },
      })
      yield* sendFirst(client, second.id)
      const third = yield* client["session.create"]({ projectPath: workspace })
      const refused = yield* sendFirst(client, third.id, {
        kind: "checkout",
        path: root,
      }).pipe(Effect.flip)
      return { sent, picked, refused }
    }),
  )

  expect(sent).toMatchObject({ workingFolder: webApp, inWorktree: false, branch: "main" })
  expect(picked).toMatchObject({ workingFolder: apiApp, inWorktree: false, branch: "main" })
  expect(starts.map((s) => [s.cwd, s.extraDirectories])).toEqual([
    [webApp, [apiApp, notes]],
    [apiApp, [webApp, notes]],
  ])
  expect(refused).toMatchObject({ _tag: "WorktreeNotCreated", reason: "not_a_project_folder" })
  expect(existsSync(join(worktrees, "ivin"))).toBe(false)
})

test("the workspace's working folders are listed with their branch, and picking one reuses it", async () => {
  const starts: StartInput[] = []
  const { first, listed, reused, picked } = await withServer(starts, (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const created = yield* client["session.create"]({ projectPath: workspace })
      const first = yield* sendFirst(client, created.id, { kind: "new_worktree" })
      git(join(first.workingFolder, "app-2"), "switch", "--quiet", "-c", "feat/web")
      const listed = yield* client["worktree.list"]({ projectPath: workspace })
      git(join(first.workingFolder, "app-2"), "switch", "--quiet", first.branch!)
      const second = yield* client["session.create"]({ projectPath: workspace })
      const reused = yield* sendFirst(client, second.id, {
        kind: "existing_worktree",
        path: first.workingFolder,
      })
      const third = yield* client["session.create"]({ projectPath: workspace })
      const picked = yield* client["session.pickWorkingFolder"]({
        sessionId: third.id,
        workingFolder: { kind: "existing_worktree", path: first.workingFolder },
      })
      return { first, listed, reused, picked }
    }),
  )

  expect(listed).toEqual([
    {
      path: first.workingFolder,
      branch: null,
      repositories: [
        { name: "app", branch: first.branch },
        { name: "app-2", branch: "feat/web" },
      ],
    },
  ])
  for (const session of [reused, picked]) {
    expect(session).toMatchObject({
      workingFolder: first.workingFolder,
      inWorktree: true,
      branch: first.branch,
    })
  }
  expect(readdirSync(join(worktrees, "ivin"))).toEqual([folderName(first.workingFolder)])
  expect(git(apiApp, "worktree", "list", "--porcelain").match(/^worktree /gm)).toHaveLength(2)
  expect(starts.map((s) => [s.cwd, s.extraDirectories])).toEqual([
    [first.workingFolder, [notes]],
    [first.workingFolder, [notes]],
  ])
})

test("closing the tabs removes a working folder whose worktrees are all merged, and keeps one with an unmerged worktree", async () => {
  withOrigins()
  const { merged, unmerged } = await withServer([], (client) =>
    Effect.gen(function* () {
      yield* openTrusted(client)
      const start = Effect.gen(function* () {
        const created = yield* client["session.create"]({ projectPath: workspace })
        yield* client["tab.open"]({ sessionId: created.id })
        return yield* sendFirst(client, created.id, { kind: "new_worktree" })
      })
      const merged = yield* start
      const unmerged = yield* start
      commit(join(merged.workingFolder, "app"), "api.txt")
      git(join(merged.workingFolder, "app"), "push", "--quiet", "origin", "HEAD:main")
      commit(join(unmerged.workingFolder, "app"), "api.txt")
      git(join(unmerged.workingFolder, "app"), "push", "--quiet", "origin", "HEAD:main")
      commit(join(unmerged.workingFolder, "app-2"), "web.txt")
      for (const session of [merged, unmerged])
        yield* client["tab.close"]({ sessionId: session.id })
      yield* (yield* WorktreeCleanup).settled
      return { merged, unmerged }
    }),
  )

  expect(existsSync(merged.workingFolder)).toBe(false)
  expect(existsSync(unmerged.workingFolder)).toBe(true)
  expect(git(apiApp, "worktree", "list", "--porcelain").match(/^worktree /gm)).toHaveLength(2)
  expect(git(webApp, "worktree", "list", "--porcelain").match(/^worktree /gm)).toHaveLength(2)
  // Four fetches and some forty git commands, slow while the whole suite runs.
}, 20_000)

const folderName = (path: string) => path.slice(path.lastIndexOf("/") + 1)
