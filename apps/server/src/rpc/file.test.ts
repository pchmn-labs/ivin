import { FILE_LIST_LIMIT, FILE_SIZE_LIMIT } from "@ivin/contracts/file"
import { Rpcs } from "@ivin/contracts/rpcs"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer, type Scope, Stream } from "effect"
import { RpcTest } from "effect/rpc"
import { execFileSync } from "node:child_process"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  truncateSync,
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
import { handlers, layerServices } from "./handlers.ts"

// Real git: over 1 s when the suite runs other git tests beside it.
vi.setConfig({ testTimeout: 5000 })

let root: string
let project: string

const write = (path: string, text = "") => {
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, text)
}

beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "ivin-files-")))
  project = join(root, "project")
  mkdirSync(project)
  execFileSync("git", ["init", "--quiet", "-b", "main"], {
    cwd: project,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" },
  })
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

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
    { cwd, env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" } },
  )

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

// Lists `path` in a new session of `projectPath`, and the error's tag when it fails.
const listIn = (projectPath: string, ...paths: string[]) =>
  withServer((client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath })
      return yield* Effect.forEach(paths, (path) =>
        client["file.listFolder"]({ sessionId: id, path }).pipe(
          Effect.map((entries) =>
            entries.map(
              (e) => `${e.name}${e.kind === "folder" ? "/" : ""}${e.ignored ? " (ignored)" : ""}`,
            ),
          ),
          Effect.catch((error) => Effect.succeed(error._tag)),
        ),
      )
    }),
  )

test("lists one level of the working folder, folders first, then a folder inside it", async () => {
  write(join(project, "README.md"))
  write(join(project, "b.ts"))
  write(join(project, "src/main.ts"))
  write(join(project, "src/lib/deep.ts"))
  write(join(project, "docs/guide.md"))

  expect(await listIn(project, "", "src", "src/lib")).toEqual([
    ["docs/", "src/", "b.ts", "README.md"],
    ["lib/", "main.ts"],
    ["deep.ts"],
  ])
})

test("lists what git ignores, flagged, at every level, and leaves out the .git folder", async () => {
  write(join(project, ".gitignore"), "dist/\n*.log\n")
  write(join(project, "dist/bundle.js"))
  write(join(project, "dist/lib/deep.js"))
  write(join(project, "debug.log"))
  write(join(project, "src/.gitignore"), "generated.ts\n")
  write(join(project, "src/generated.ts"))
  write(join(project, "src/main.ts"))
  write(join(project, "src/trace.log"))

  expect(await listIn(project, "", "src", "dist", "dist/lib")).toEqual([
    ["dist/ (ignored)", "src/", ".gitignore", "debug.log (ignored)"],
    [".gitignore", "generated.ts (ignored)", "main.ts", "trace.log (ignored)"],
    ["lib/ (ignored)", "bundle.js (ignored)"],
    ["deep.js (ignored)"],
  ])
})

test("outside a git repository, lists every file", async () => {
  const plain = join(root, "plain")
  write(join(plain, "notes.log"))
  write(join(plain, "dist/out.js"))

  expect(await listIn(plain, "")).toEqual([["dist/", "notes.log"]])
})

test("outside a git repository, a folder with more names than the pipe to git holds is still listed", async () => {
  const plain = join(root, "plain")
  // Over the 64 KiB pipe buffer, so git exits before it has read every name.
  const names = Array.from(
    { length: 800 },
    (_, index) => `${String(index).padStart(4, "0")}${"x".repeat(100)}`,
  )
  for (const name of names) write(join(plain, name))

  expect(await listIn(plain, "")).toEqual([names])
})

test("refuses a path outside the working folder, through .., an absolute path or a symlink", async () => {
  write(join(root, "secret/key.pem"))
  write(join(project, "src/main.ts"))
  symlinkSync(join(root, "secret"), join(project, "escape"))

  expect(await listIn(project, "..", "src/../..", "/etc", root, "escape")).toEqual([
    "PathOutsideWorkingFolder",
    "PathOutsideWorkingFolder",
    "PathOutsideWorkingFolder",
    "PathOutsideWorkingFolder",
    "PathOutsideWorkingFolder",
  ])
})

test("a deleted working folder and a missing folder fail differently", async () => {
  write(join(project, "src/main.ts"))
  const gone = join(root, "gone")
  mkdirSync(gone)

  expect(await listIn(project, "nowhere", "src/main.ts")).toEqual([
    "FolderNotListed",
    "FolderNotListed",
  ])
  expect(
    await withServer((client) =>
      Effect.gen(function* () {
        const { id } = yield* client["session.create"]({ projectPath: gone })
        rmSync(gone, { recursive: true })
        return yield* client["file.listFolder"]({ sessionId: id, path: "" }).pipe(
          Effect.catch((error) => Effect.succeed(error._tag)),
        )
      }),
    ),
  ).toBe("WorkingFolderDeleted")
})

test("an unknown session fails", async () => {
  expect(
    await withServer((client) =>
      client["file.listFolder"]({ sessionId: "nope", path: "" }).pipe(
        Effect.catch((error) => Effect.succeed(error._tag)),
      ),
    ),
  ).toBe("SessionNotFound")
})

// Reads `path` in a new session of `projectPath`, and the error's tag when it fails.
const readIn = (projectPath: string, ...paths: string[]) =>
  withServer((client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath })
      return yield* Effect.forEach(paths, (path) =>
        client["file.readFile"]({ sessionId: id, path }).pipe(
          Effect.catch((error) =>
            Effect.succeed(
              error._tag === "FileNotRead" ? `FileNotRead:${error.reason}` : error._tag,
            ),
          ),
        ),
      )
    }),
  )

test("reads a text file, as UTF-8", async () => {
  write(join(project, "src/main.ts"), "const café = 1\n")
  write(join(project, "empty.txt"))

  expect(await readIn(project, "src/main.ts", "empty.txt")).toEqual([
    { kind: "text", text: "const café = 1\n" },
    { kind: "text", text: "" },
  ])
})

test("a file above the size limit is reported with its size, and one at the limit is read", async () => {
  writeFileSync(join(project, "limit.txt"), "")
  truncateSync(join(project, "limit.txt"), FILE_SIZE_LIMIT)
  writeFileSync(join(project, "big.txt"), "")
  truncateSync(join(project, "big.txt"), FILE_SIZE_LIMIT + 1)

  const [atLimit, big] = await readIn(project, "limit.txt", "big.txt")
  expect(atLimit).toMatchObject({ kind: "binary" })
  expect(big).toEqual({ kind: "too_large", size: FILE_SIZE_LIMIT + 1 })
})

test("a file with a zero byte at its start is binary", async () => {
  writeFileSync(join(project, "image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]))

  expect(await readIn(project, "image.png")).toEqual([{ kind: "binary" }])
})

test("a missing file and a folder are not read", async () => {
  write(join(project, "src/main.ts"))

  expect(await readIn(project, "nowhere.ts", "src/nowhere.ts", "src")).toEqual([
    "FileNotRead:missing",
    "FileNotRead:missing",
    "FileNotRead:missing",
  ])
})

test("a file that cannot be read is reported as unreadable", async () => {
  write(join(project, "locked.txt"), "secret")
  chmodSync(join(project, "locked.txt"), 0o000)

  const result = await readIn(project, "locked.txt")
  chmodSync(join(project, "locked.txt"), 0o644)
  expect(result).toEqual(
    process.getuid?.() === 0 ? [{ kind: "text", text: "secret" }] : ["FileNotRead:unreadable"],
  )
})

test("refuses to read outside the working folder, through .., an absolute path or a symlink", async () => {
  write(join(root, "secret/key.pem"), "key")
  symlinkSync(join(root, "secret"), join(project, "escape"))
  symlinkSync(join(root, "secret/key.pem"), join(project, "link.pem"))

  expect(
    await readIn(
      project,
      "../secret/key.pem",
      join(root, "secret/key.pem"),
      "escape/key.pem",
      "link.pem",
    ),
  ).toEqual(Array(4).fill("PathOutsideWorkingFolder"))
})

test("reading in a deleted working folder, and for an unknown session, fails", async () => {
  const gone = join(root, "gone")
  mkdirSync(gone)
  write(join(gone, "a.txt"))

  expect(
    await withServer((client) =>
      Effect.gen(function* () {
        const { id } = yield* client["session.create"]({ projectPath: gone })
        rmSync(gone, { recursive: true })
        return yield* client["file.readFile"]({ sessionId: id, path: "a.txt" }).pipe(
          Effect.catch((error) => Effect.succeed(error._tag)),
        )
      }),
    ),
  ).toBe("WorkingFolderDeleted")
  expect(
    await withServer((client) =>
      client["file.readFile"]({ sessionId: "nope", path: "a.txt" }).pipe(
        Effect.catch((error) => Effect.succeed(error._tag)),
      ),
    ),
  ).toBe("SessionNotFound")
})

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

const statusIn = (projectPath: string) =>
  callIn(projectPath, (client, sessionId) => client["file.gitStatus"]({ sessionId }))

const commitAll = () => {
  git(project, "add", "--all")
  git(project, "commit", "--quiet", "-m", "initial")
}

test("git status reports a modified, an added, an untracked and a deleted file", async () => {
  write(join(project, "modified.ts"), "a")
  write(join(project, "deleted.ts"), "a")
  write(join(project, "src/kept.ts"), "a")
  commitAll()
  write(join(project, "modified.ts"), "b")
  rmSync(join(project, "deleted.ts"))
  write(join(project, "added.ts"), "a")
  git(project, "add", "added.ts")
  write(join(project, "src/untracked.ts"), "a")

  expect(await statusIn(project)).toEqual(
    expect.arrayContaining([
      { path: "modified.ts", status: "modified" },
      { path: "deleted.ts", status: "deleted" },
      { path: "added.ts", status: "added" },
      { path: "src/untracked.ts", status: "untracked" },
    ]),
  )
  expect(await statusIn(project)).toHaveLength(4)
})

test("git status of a subfolder holds only its files, with paths relative to it", async () => {
  write(join(project, "apps/web/a.ts"), "a")
  write(join(project, "root.ts"), "a")
  commitAll()
  write(join(project, "apps/web/a.ts"), "b")
  write(join(project, "apps/web/src/new.ts"), "a")
  write(join(project, "root.ts"), "b")

  expect(await statusIn(join(project, "apps/web"))).toEqual([
    { path: "a.ts", status: "modified" },
    { path: "src/new.ts", status: "untracked" },
  ])
})

test("git status is empty outside a git repository, and fails for a deleted folder or an unknown session", async () => {
  const plain = join(root, "plain")
  write(join(plain, "a.ts"))

  expect(await statusIn(plain)).toEqual([])
  expect(
    await withServer((client) =>
      client["file.gitStatus"]({ sessionId: "nope" }).pipe(
        Effect.catch((error) => Effect.succeed(error._tag)),
      ),
    ),
  ).toBe("SessionNotFound")
})

const filesIn = (projectPath: string) =>
  callIn(projectPath, (client, sessionId) => client["file.listFiles"]({ sessionId }))

test("lists the files git does not ignore, untracked included and deleted left out, sorted", async () => {
  write(join(project, ".gitignore"), "node_modules/\n*.log\n")
  write(join(project, "src/lib/deep.ts"))
  write(join(project, "src/main.ts"))
  write(join(project, "deleted.ts"))
  write(join(project, "b.ts"))
  commitAll()
  rmSync(join(project, "deleted.ts"))
  write(join(project, "untracked.ts"))
  write(join(project, "node_modules/pkg/index.js"))
  write(join(project, "debug.log"))

  expect(await filesIn(project)).toEqual({
    paths: [".gitignore", "b.ts", "src/lib/deep.ts", "src/main.ts", "untracked.ts"],
    truncated: false,
  })
})

test("lists a subfolder's files relative to it", async () => {
  write(join(project, "apps/web/src/a.ts"))
  write(join(project, "root.ts"))

  expect(await filesIn(join(project, "apps/web"))).toEqual({
    paths: ["src/a.ts"],
    truncated: false,
  })
})

test("outside a git repository, walks the folder without the .git folder", async () => {
  const plain = join(root, "plain")
  write(join(plain, "notes.log"))
  write(join(plain, "dist/out.js"))
  write(join(plain, ".git/config"))

  expect(await filesIn(plain)).toEqual({ paths: ["dist/out.js", "notes.log"], truncated: false })
})

test("outside a git repository, the walk stops at the limit and says so", async () => {
  const plain = join(root, "plain")
  mkdirSync(plain)
  for (let index = 0; index <= FILE_LIST_LIMIT; index++) writeFileSync(join(plain, `${index}`), "")

  const list = await filesIn(plain)
  expect(list).toMatchObject({ truncated: true })
  expect((list as { paths: ReadonlyArray<string> }).paths).toHaveLength(FILE_LIST_LIMIT)
}, 30_000)

test("listing files fails for a deleted working folder and an unknown session", async () => {
  const gone = join(root, "gone")
  mkdirSync(gone)

  expect(
    await callIn(gone, (client, sessionId) =>
      Effect.sync(() => rmSync(gone, { recursive: true })).pipe(
        Effect.andThen(client["file.listFiles"]({ sessionId })),
      ),
    ),
  ).toBe("WorkingFolderDeleted")
  expect(
    await withServer((client) =>
      client["file.listFiles"]({ sessionId: "nope" }).pipe(
        Effect.catch((error) => Effect.succeed(error._tag)),
      ),
    ),
  ).toBe("SessionNotFound")
})

// Opens the watch of a new session of `projectPath`, and runs `use` once the OS watcher reports
// events: it has no ready signal, and a change made right after it opens can be lost.
const watchIn = <A, E>(
  projectPath: string,
  use: (
    next: Effect.Effect<ReadonlyArray<ReadonlyArray<string>>, unknown>,
    first: ReadonlyArray<ReadonlyArray<string>>,
  ) => Effect.Effect<A, E>,
  probe: (index: number) => void = (index) => write(join(projectPath, `.probe-${index}`)),
) =>
  withServer((client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath })
      const pull = yield* Stream.toPull(client["file.watch"]({ sessionId: id }))
      const next = pull.pipe(
        Effect.map((changes) => changes.map((change) => change.paths)),
        Effect.timeout("10 seconds"),
      )
      const probes = Effect.gen(function* () {
        for (let index = 0; ; index++) {
          probe(index)
          yield* Effect.sleep("100 millis")
        }
      })
      return yield* use(next, yield* Effect.race(next, probes))
    }),
  )

// Pulls batches until one holds `path`, and every path seen on the way.
const pullUntil = (
  next: Effect.Effect<ReadonlyArray<ReadonlyArray<string>>, unknown>,
  path: string,
) =>
  Effect.gen(function* () {
    const seen: string[] = []
    while (!seen.includes(path)) seen.push(...(yield* next).flat())
    return seen
  })

test("a created file and a deleted file reach the watch, with their paths", async () => {
  write(join(project, "src/old.ts"))
  commitAll()

  const seen = await watchIn(project, (next) =>
    Effect.gen(function* () {
      write(join(project, "src/new.ts"))
      const created = yield* pullUntil(next, "src/new.ts")
      rmSync(join(project, "src/old.ts"))
      const deleted = yield* pullUntil(next, "src/old.ts")
      return { created, deleted }
    }),
  )

  expect(seen.created).toContain("src/new.ts")
  expect(seen.deleted).toContain("src/old.ts")
})

test("a change in an ignored folder does not reach the watch", async () => {
  write(join(project, ".gitignore"), "dist/\n")
  commitAll()

  const seen = await watchIn(project, (next) =>
    Effect.gen(function* () {
      write(join(project, "dist/bundle.js"))
      write(join(project, "dist/lib/deep.js"))
      write(join(project, "visible.ts"))
      return yield* pullUntil(next, "visible.ts")
    }),
  )

  expect(seen.filter((path) => path.startsWith("dist"))).toEqual([])
})

test("a change to git's index reaches the watch as a change with no path", async () => {
  write(join(project, "a.ts"))
  git(project, "add", "a.ts")

  const first = await watchIn(
    project,
    (_next, first) => Effect.succeed(first),
    // Staging and unstaging change only git's index, never a path.
    (index) =>
      index % 2 === 0
        ? git(project, "rm", "--cached", "--quiet", "a.ts")
        : git(project, "add", "a.ts"),
  )

  expect(first).toEqual([[]])
})

test("staging in a linked worktree reaches the watch as a change with no path", async () => {
  write(join(project, "a.ts"))
  commitAll()
  const linked = join(root, "linked")
  git(project, "worktree", "add", "--quiet", "-b", "feature", linked)

  const first = await watchIn(
    linked,
    (_next, first) => Effect.succeed(first),
    (index) =>
      index % 2 === 0
        ? git(linked, "rm", "--cached", "--quiet", "a.ts")
        : git(linked, "add", "a.ts"),
  )

  expect(first).toEqual([[]])
})
