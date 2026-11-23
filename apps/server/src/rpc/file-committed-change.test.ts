import { Rpcs } from "@ivin/contracts/rpcs"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer, type Scope } from "effect"
import { RpcTest } from "effect/rpc"
import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
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
import { trustEveryFolder } from "./trust-every-folder.ts"
import { handlers, layerServices } from "./handlers.ts"

vi.setConfig({ testTimeout: 10_000 })

const env = {
  ...process.env,
  GIT_AUTHOR_NAME: "ivin",
  GIT_AUTHOR_EMAIL: "ivin@example.com",
  GIT_COMMITTER_NAME: "ivin",
  GIT_COMMITTER_EMAIL: "ivin@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, env, encoding: "utf8" })

const write = (path: string, text = "") => {
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, text)
}

const commit = (repo: string, files: Record<string, string>) => {
  for (const [path, text] of Object.entries(files)) write(join(repo, path), text)
  git(repo, "add", "--all")
  git(repo, "commit", "--quiet", "-m", Object.keys(files).join(" "))
}

let root: string
let origin: string
let upstream: string
let project: string

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "ivin-branch-changes-")))
  origin = join(root, "origin.git")
  upstream = join(root, "upstream")
  project = join(root, "project")
  git(root, "init", "--quiet", "--bare", "-b", "main", origin)
  git(root, "init", "--quiet", "-b", "main", upstream)
  commit(upstream, { "shared.ts": "one\ntwo\n", "gone.ts": "g\n" })
  git(upstream, "remote", "add", "origin", origin)
  git(upstream, "push", "--quiet", "origin", "main")
  git(root, "clone", "--quiet", origin, project)
  git(project, "switch", "--quiet", "-c", "feature")
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

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

const callIn = <A>(
  projectPath: string,
  call: (client: Client, sessionId: string) => Effect.Effect<A, { readonly _tag: string }>,
) =>
  withServer((client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath })
      return yield* call(client, id).pipe(Effect.catch((error) => Effect.succeed(error._tag)))
    }),
  )

const committedChangesIn = (projectPath: string) =>
  callIn(projectPath, (client, sessionId) => client["file.listCommittedChanges"]({ sessionId }))

const committedDiffIn = (projectPath: string, path: string) =>
  callIn(projectPath, (client, sessionId) => client["file.readCommittedDiff"]({ sessionId, path }))

const discardIn = (projectPath: string, ...paths: string[]) =>
  callIn(projectPath, (client, sessionId) => client["file.discardChanges"]({ sessionId, paths }))

const changesIn = (projectPath: string) =>
  callIn(projectPath, (client, sessionId) => client["file.listChanges"]({ sessionId }))

test("lists what the branch's commits changed since its merge base with origin's default branch, and leaves the uncommitted changes out", async () => {
  commit(project, { "feature.ts": "f\n", "shared.ts": "one\n2\n" })
  git(project, "rm", "--quiet", "gone.ts")
  git(project, "commit", "--quiet", "-m", "remove gone.ts")
  write(join(project, "wip.ts"), "w\n")
  write(join(project, "feature.ts"), "f\nmore\n")

  expect(await committedChangesIn(project)).toEqual({
    kind: "listed",
    base: "origin/main",
    changes: [
      { path: "feature.ts", previousPath: null, status: "added", added: 1, deleted: 0 },
      { path: "gone.ts", previousPath: null, status: "deleted", added: 0, deleted: 1 },
      { path: "shared.ts", previousPath: null, status: "modified", added: 1, deleted: 1 },
    ],
  })
  const diff = await committedDiffIn(project, "feature.ts")
  expect(diff).toMatchObject({ kind: "text", status: "added", added: 1, deleted: 0 })
  expect(await committedDiffIn(project, "wip.ts")).toEqual({ kind: "unchanged" })
})

test("leaves out what origin's default branch gained since, a squash merge included", async () => {
  commit(project, { "feature.ts": "f\n" })
  commit(upstream, { "other.ts": "o\n" })
  git(upstream, "switch", "--quiet", "-c", "side")
  commit(upstream, { "side.ts": "s\n" })
  git(upstream, "switch", "--quiet", "main")
  git(upstream, "merge", "--quiet", "--squash", "side")
  git(upstream, "commit", "--quiet", "-m", "squash")
  git(upstream, "push", "--quiet", "origin", "main")
  git(project, "fetch", "--quiet", "origin")

  expect(await committedChangesIn(project)).toEqual({
    kind: "listed",
    base: "origin/main",
    changes: [{ path: "feature.ts", previousPath: null, status: "added", added: 1, deleted: 0 }],
  })
  expect(await committedDiffIn(project, "side.ts")).toEqual({ kind: "unchanged" })
})

test("says when the branch shares no commit with origin's default branch", async () => {
  git(project, "switch", "--quiet", "--orphan", "lone")
  commit(project, { "lone.ts": "l\n" })
  expect(await committedChangesIn(project)).toEqual({ kind: "no_merge_base" })
  expect(await committedDiffIn(project, "lone.ts")).toEqual({ kind: "no_merge_base" })
})

test("says when the repository has no origin, or origin has no default branch", async () => {
  git(project, "remote", "set-head", "origin", "--delete")
  expect(await committedChangesIn(project)).toEqual({ kind: "no_default_branch" })
  expect(await committedDiffIn(project, "shared.ts")).toEqual({ kind: "no_default_branch" })

  git(project, "remote", "remove", "origin")
  expect(await committedChangesIn(project)).toEqual({ kind: "no_origin" })
})

test("says a working folder outside a git repository is not one", async () => {
  const plain = join(root, "plain")
  write(join(plain, "a.ts"), "a\n")
  expect(await committedChangesIn(plain)).toEqual({ kind: "not_repository" })
  expect(await committedDiffIn(plain, "a.ts")).toEqual({ kind: "not_repository" })
})

test("discarding a tracked file restores it from its last commit, staged changes included", async () => {
  write(join(project, "shared.ts"), "changed\n")
  git(project, "add", "shared.ts")
  write(join(project, "shared.ts"), "changed again\n")
  write(join(project, "gone.ts"), "edited\n")

  expect(await discardIn(project, "shared.ts")).toBeUndefined()
  expect(readFileSync(join(project, "shared.ts"), "utf8")).toBe("one\ntwo\n")
  expect(await changesIn(project)).toMatchObject({
    changes: [{ path: "gone.ts", status: "modified" }],
  })
})

test("discarding an untracked file deletes it, and an added one leaves the index and the disk", async () => {
  write(join(project, "notes.md"), "n\n")
  write(join(project, "added.ts"), "a\n")
  git(project, "add", "added.ts")

  expect(await discardIn(project, "notes.md")).toBeUndefined()
  expect(await discardIn(project, "added.ts")).toBeUndefined()
  expect(existsSync(join(project, "notes.md"))).toBe(false)
  expect(existsSync(join(project, "added.ts"))).toBe(false)
  expect(await changesIn(project)).toEqual({ kind: "listed", changes: [] })
})

test("discarding a deleted or a renamed file brings back its last commit", async () => {
  rmSync(join(project, "gone.ts"))
  git(project, "mv", "shared.ts", "moved.ts")

  expect(await discardIn(project, "gone.ts")).toBeUndefined()
  expect(await discardIn(project, "moved.ts")).toBeUndefined()
  expect(readFileSync(join(project, "gone.ts"), "utf8")).toBe("g\n")
  expect(existsSync(join(project, "moved.ts"))).toBe(false)
  expect(await changesIn(project)).toEqual({ kind: "listed", changes: [] })
})

test("discarding fails with git's message when git cannot write the index, and refuses a path outside", async () => {
  write(join(project, "shared.ts"), "changed\n")
  writeFileSync(join(project, ".git/index.lock"), "")

  const failure = await withServer((client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath: project })
      return yield* client["file.discardChanges"]({ sessionId: id, paths: ["shared.ts"] }).pipe(
        Effect.flip,
      )
    }),
  )
  expect(failure._tag).toBe("GitFailed")
  expect(failure._tag === "GitFailed" && failure.gitMessage).toContain("index.lock")
  expect(await discardIn(project, "../outside.ts")).toBe("PathOutsideWorkingFolder")
})

test("discarding several paths restores every tracked file and deletes every untracked one, and leaves a path it was not given", async () => {
  write(join(project, "shared.ts"), "changed\n")
  rmSync(join(project, "gone.ts"))
  write(join(project, "notes.md"), "n\n")
  write(join(project, "added.ts"), "a\n")
  git(project, "add", "added.ts")
  write(join(project, "later.md"), "written after the dialog opened\n")

  expect(await discardIn(project, "shared.ts", "gone.ts", "notes.md", "added.ts")).toBeUndefined()
  expect(readFileSync(join(project, "shared.ts"), "utf8")).toBe("one\ntwo\n")
  expect(readFileSync(join(project, "gone.ts"), "utf8")).toBe("g\n")
  expect(existsSync(join(project, "notes.md"))).toBe(false)
  expect(existsSync(join(project, "added.ts"))).toBe(false)
  expect(await changesIn(project)).toMatchObject({ changes: [{ path: "later.md" }] })
})

test("a path is a file name, not a pattern: discarding [id].ts leaves i.ts", async () => {
  write(join(project, "[id].ts"), "page\n")
  write(join(project, "i.ts"), "kept\n")
  write(join(project, "s*.ts"), "star\n")
  write(join(project, "shared.ts"), "edited\n")

  expect(await discardIn(project, "[id].ts", "s*.ts")).toBeUndefined()
  expect(existsSync(join(project, "[id].ts"))).toBe(false)
  expect(existsSync(join(project, "i.ts"))).toBe(true)
  expect(readFileSync(join(project, "shared.ts"), "utf8")).toBe("edited\n")
})

test("a branch with no commit yet has no committed changes", async () => {
  git(project, "switch", "--quiet", "--orphan", "fresh")
  expect(await committedChangesIn(project)).toEqual({
    kind: "listed",
    base: "origin/main",
    changes: [],
  })
})

// Lists the committed changes of one session, once before each step and once after the last.
const committedChangesAcross = (projectPath: string, steps: ReadonlyArray<() => void>) =>
  withServer((client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath })
      const list = client["file.listCommittedChanges"]({ sessionId: id })
      const listings = [yield* list]
      for (const step of steps) {
        step()
        listings.push(yield* list)
      }
      return listings
    }),
  )

const pathsOf = (listing: unknown) =>
  (listing as { changes: ReadonlyArray<{ path: string }> }).changes.map((change) => change.path)

test("a new commit gives a new committed listing in the same server", async () => {
  commit(project, { "first.ts": "1\n" })

  const [before, after] = await committedChangesAcross(project, [
    () => commit(project, { "second.ts": "2\n" }),
  ])

  expect(pathsOf(before)).toEqual(["first.ts"])
  expect(pathsOf(after)).toEqual(["first.ts", "second.ts"])
})

test("a fetch that moves origin's default branch gives a new committed listing", async () => {
  commit(project, { "feature.ts": "f\n" })

  const [before, after] = await committedChangesAcross(project, [
    () => {
      git(project, "push", "--quiet", "origin", "feature:main")
      git(project, "fetch", "--quiet", "origin")
    },
  ])

  expect(pathsOf(before)).toEqual(["feature.ts"])
  expect(pathsOf(after)).toEqual([])
})

test("origin's default branch moved to another branch gives a new committed listing", async () => {
  commit(upstream, { "release.ts": "r\n" })
  git(upstream, "push", "--quiet", "origin", "main:release")
  git(project, "fetch", "--quiet", "origin")
  commit(project, { "feature.ts": "f\n" })

  const [before, after] = await committedChangesAcross(project, [
    () => git(project, "remote", "set-head", "origin", "release"),
  ])

  expect(before).toMatchObject({ kind: "listed", base: "origin/main" })
  expect(after).toMatchObject({ kind: "listed", base: "origin/release" })
})
