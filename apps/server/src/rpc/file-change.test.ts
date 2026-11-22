import { DIFF_SIZE_LIMIT, type FileDiff } from "@ivin/contracts/file"
import { Rpcs } from "@ivin/contracts/rpcs"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer, type Scope } from "effect"
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
import { handlers, layerServices } from "./handlers.ts"

// Real git: several commands per call, slower when the suite runs other git tests beside it.
vi.setConfig({ testTimeout: 10_000 })

let root: string
let project: string

const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" }

const write = (path: string, text = "") => {
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, text)
}

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    [
      "-c",
      "user.name=ivin",
      "-c",
      "user.email=ivin@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, env },
  )

const commitAll = (cwd = project) => {
  git(cwd, "add", "--all")
  git(cwd, "commit", "--quiet", "-m", "commit")
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "ivin-changes-")))
  project = join(root, "project")
  mkdirSync(project)
  git(project, "init", "--quiet", "-b", "main")
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(use: (client: Client) => Effect.Effect<A, E, Scope.Scope>) => {
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

// Runs `call` in a new session of `projectPath`, and the error's tag when it fails.
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

const changesIn = (projectPath: string) =>
  callIn(projectPath, (client, sessionId) => client["file.listChanges"]({ sessionId }))

const diffIn = (projectPath: string, path: string) =>
  callIn(projectPath, (client, sessionId) => client["file.readDiff"]({ sessionId, path }))

// Each line as git shows it: its sign, then its text.
const linesOf = (diff: FileDiff | string) =>
  typeof diff !== "string" && diff.kind === "text"
    ? diff.hunks.flatMap((hunk) =>
        hunk.lines.map(
          (line) => `${{ context: " ", added: "+", deleted: "-" }[line.kind]}${line.text}`,
        ),
      )
    : diff

test("lists modified, added, deleted, renamed and untracked files with their line counts, by path", async () => {
  write(join(project, "modified.ts"), "one\ntwo\nthree\n")
  write(join(project, "deleted.ts"), "a\nb\n")
  write(join(project, "old-name.ts"), "kept\nlines\nhere\n")
  commitAll()
  write(join(project, "modified.ts"), "one\n2\nthree\nfour\n")
  rmSync(join(project, "deleted.ts"))
  mkdirSync(join(project, "src"))
  git(project, "mv", "old-name.ts", "src/new-name.ts")
  write(join(project, "added.ts"), "new\n")
  git(project, "add", "added.ts")
  write(join(project, "src/untracked.ts"), "u\n")

  expect(await changesIn(project)).toEqual({
    kind: "listed",
    changes: [
      { path: "added.ts", previousPath: null, status: "added", added: 1, deleted: 0 },
      { path: "deleted.ts", previousPath: null, status: "deleted", added: 0, deleted: 2 },
      { path: "modified.ts", previousPath: null, status: "modified", added: 2, deleted: 1 },
      {
        path: "src/new-name.ts",
        previousPath: "old-name.ts",
        status: "renamed",
        added: 0,
        deleted: 0,
      },
      {
        path: "src/untracked.ts",
        previousPath: null,
        status: "untracked",
        added: null,
        deleted: null,
      },
    ],
  })
})

test("lists the changes of a repository with no commit yet, and none when nothing changed", async () => {
  write(join(project, "staged.ts"), "s\n")
  git(project, "add", "staged.ts")
  write(join(project, "untracked.ts"), "u\n")
  expect(await changesIn(project)).toEqual({
    kind: "listed",
    changes: [
      { path: "staged.ts", previousPath: null, status: "added", added: 1, deleted: 0 },
      { path: "untracked.ts", previousPath: null, status: "untracked", added: null, deleted: null },
    ],
  })

  commitAll()
  expect(await changesIn(project)).toEqual({ kind: "listed", changes: [] })
})

test("lists only the changes inside a working folder below the repository root, relative to it", async () => {
  const inner = join(project, "apps/web")
  write(join(inner, "page.ts"), "a\n")
  write(join(project, "outside.ts"), "a\n")
  commitAll()
  write(join(inner, "page.ts"), "b\n")
  write(join(project, "outside.ts"), "b\n")
  write(join(inner, "new.ts"), "n\n")

  expect(await changesIn(inner)).toEqual({
    kind: "listed",
    changes: [
      { path: "new.ts", previousPath: null, status: "untracked", added: null, deleted: null },
      { path: "page.ts", previousPath: null, status: "modified", added: 1, deleted: 1 },
    ],
  })
})

test("says a working folder outside a git repository is not one, for the list and a diff", async () => {
  const plain = join(root, "plain")
  write(join(plain, "a.ts"), "a\n")
  expect(await changesIn(plain)).toEqual({ kind: "not_repository" })
  expect(await diffIn(plain, "a.ts")).toEqual({ kind: "not_repository" })
})

test("fails with git's message when git cannot read the repository", async () => {
  write(join(project, "a.ts"), "a\n")
  commitAll()
  writeFileSync(join(project, ".git/index"), "garbage")

  const failure = await withServer((client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath: project })
      return yield* client["file.listChanges"]({ sessionId: id }).pipe(Effect.flip)
    }),
  )
  expect(failure._tag).toBe("GitFailed")
  expect(failure._tag === "GitFailed" && failure.gitMessage).toContain("index file")
})

test("diffs a modified file in hunks, numbering each side and marking the changed part of a replaced line", async () => {
  const before = Array.from({ length: 20 }, (_, n) => `line ${n + 1}`)
  write(join(project, "a.ts"), `${before.join("\n")}\n`)
  commitAll()
  const after = [...before]
  after[1] = "line 2 changed"
  after.splice(15, 1)
  write(join(project, "a.ts"), `${after.join("\n")}\n`)

  const diff = await diffIn(project, "a.ts")
  expect(diff).toMatchObject({ kind: "text", status: "modified", added: 1, deleted: 2 })
  if (typeof diff === "string" || diff.kind !== "text") throw new Error(String(diff))
  expect(diff.hunks.map((hunk) => hunk.header)).toEqual(["@@ -1,5 +1,5 @@", "@@ -13,7 +13,6 @@"])
  expect(diff.hunks[0]!.lines.slice(0, 4)).toEqual([
    { kind: "context", text: "line 1", oldLine: 1, newLine: 1, changed: null },
    { kind: "deleted", text: "line 2", oldLine: 2, newLine: null, changed: null },
    { kind: "added", text: "line 2 changed", oldLine: null, newLine: 2, changed: [6, 14] },
    { kind: "context", text: "line 3", oldLine: 3, newLine: 3, changed: null },
  ])
  expect(diff.hunks[1]!.lines.find((line) => line.kind === "deleted")).toEqual({
    kind: "deleted",
    text: "line 16",
    oldLine: 16,
    newLine: null,
    changed: null,
  })
})

test("diffs an added, a deleted, a renamed and an untracked file", async () => {
  write(join(project, "deleted.ts"), "gone\n")
  write(join(project, "old.ts"), "one\ntwo\n")
  commitAll()
  rmSync(join(project, "deleted.ts"))
  write(join(project, "added.ts"), "a\n")
  git(project, "add", "added.ts")
  git(project, "mv", "old.ts", "new.ts")
  write(join(project, "new.ts"), "one\n2\n")
  write(join(project, "untracked.ts"), "x\ny\n")

  expect(linesOf(await diffIn(project, "added.ts"))).toEqual(["+a"])
  expect(linesOf(await diffIn(project, "deleted.ts"))).toEqual(["-gone"])
  expect(linesOf(await diffIn(project, "new.ts"))).toEqual([" one", "-two", "+2"])
  expect(linesOf(await diffIn(project, "untracked.ts"))).toEqual(["+x", "+y"])
})

test("says a binary file is binary, a file with no change is unchanged, and a diff past the limit too large", async () => {
  write(join(project, "image.png"), "\0\x01\x02")
  write(join(project, "clean.ts"), "c\n")
  write(join(project, "big.txt"), "")
  commitAll()
  write(join(project, "image.png"), "\0\x03\x04")
  write(
    join(project, "big.txt"),
    "x"
      .repeat(99)
      .concat("\n")
      .repeat(DIFF_SIZE_LIMIT / 100 + 1),
  )

  expect(await diffIn(project, "image.png")).toEqual({ kind: "binary" })
  expect(await diffIn(project, "clean.ts")).toEqual({ kind: "unchanged" })
  expect(await diffIn(project, "missing.ts")).toEqual({ kind: "unchanged" })
  expect(await diffIn(project, "big.txt")).toEqual({ kind: "too_large" })
})

test("refuses a diff of a path outside the working folder", async () => {
  expect(await diffIn(project, "../outside.ts")).toBe("PathOutsideWorkingFolder")
})
