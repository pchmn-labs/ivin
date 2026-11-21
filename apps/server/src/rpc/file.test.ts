import { FILE_SIZE_LIMIT } from "@ivin/contracts/file"
import { Rpcs } from "@ivin/contracts/rpcs"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer } from "effect"
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
import { afterEach, beforeEach, expect, test } from "vitest"
import { layerKeybindingsFileOf } from "../modules/keybinding/usecases/keybindings-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { layerSettingsFileOf } from "../modules/setting/usecases/settings-file.ts"
import { ImageFolder } from "../modules/transcript/usecases/image-folder.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"

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

const makeClient = () => RpcTest.makeClient(Rpcs)
type Client = Effect.Success<ReturnType<typeof makeClient>>

const withServer = <A, E>(use: (client: Client) => Effect.Effect<A, E>) => {
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
          Effect.map((entries) => entries.map((e) => `${e.name}${e.kind === "folder" ? "/" : ""}`)),
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

test("leaves out what git ignores, at every level, and the .git folder", async () => {
  write(join(project, ".gitignore"), "dist/\n*.log\n")
  write(join(project, "dist/bundle.js"))
  write(join(project, "debug.log"))
  write(join(project, "src/.gitignore"), "generated.ts\n")
  write(join(project, "src/generated.ts"))
  write(join(project, "src/main.ts"))
  write(join(project, "src/trace.log"))

  expect(await listIn(project, "", "src")).toEqual([
    ["src/", ".gitignore"],
    [".gitignore", "main.ts"],
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
