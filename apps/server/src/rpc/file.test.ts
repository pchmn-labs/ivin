import { FILE_SIZE_LIMIT } from "@ivin/contracts/file"
import { Rpcs } from "@ivin/contracts/rpcs"
import { layerScripted } from "@ivin/harness"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { execFileSync } from "node:child_process"
import {
  chmodSync,
  readdirSync,
  readFileSync,
  statSync,
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
    { kind: "text", text: "const café = 1\n", version: expect.any(String) },
    { kind: "text", text: "", version: expect.any(String) },
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
    process.getuid?.() === 0
      ? [{ kind: "text", text: "secret", version: expect.any(String) }]
      : ["FileNotRead:unreadable"],
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

// Reads `path` in a new session of `projectPath`, then runs `use` with the session's id and the
// version the read returned.
const editIn = <A, E>(
  projectPath: string,
  path: string,
  use: (client: Client, sessionId: string, version: string) => Effect.Effect<A, E>,
) =>
  withServer((client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath })
      const read = yield* client["file.readFile"]({ sessionId: id, path })
      if (read.kind !== "text") throw new Error(`${path} is not text`)
      return yield* use(client, id, read.version)
    }),
  )

const tagOf = (error: { _tag: string }) => Effect.succeed(error._tag)

test("writes a file it read, and the next read returns the new text and version", async () => {
  write(join(project, "src/main.ts"), "const a = 1\n")
  chmodSync(join(project, "src/main.ts"), 0o755)

  const [written, read] = await editIn(project, "src/main.ts", (client, sessionId, version) =>
    Effect.gen(function* () {
      const written = yield* client["file.writeFile"]({
        sessionId,
        path: "src/main.ts",
        text: "const café = 2\n",
        expectedVersion: version,
      })
      const read = yield* client["file.readFile"]({ sessionId, path: "src/main.ts" })
      return [written, read] as const
    }),
  )

  expect(readFileSync(join(project, "src/main.ts"), "utf8")).toBe("const café = 2\n")
  expect(read).toEqual({ kind: "text", text: "const café = 2\n", version: written.version })
  expect(statSync(join(project, "src/main.ts")).mode & 0o777).toBe(0o755)
  expect(readdirSync(join(project, "src"))).toEqual(["main.ts"])
})

test("refuses to write a file that changed on disk since it was read, and leaves it as it is", async () => {
  write(join(project, "notes.md"), "first\n")

  const result = await editIn(project, "notes.md", (client, sessionId, version) => {
    writeFileSync(join(project, "notes.md"), "the agent's\n")
    return client["file.writeFile"]({
      sessionId,
      path: "notes.md",
      text: "mine\n",
      expectedVersion: version,
    }).pipe(Effect.catch(tagOf))
  })

  expect(result).toBe("FileChangedOnDisk")
  expect(readFileSync(join(project, "notes.md"), "utf8")).toBe("the agent's\n")
})

test("a file deleted since it was read has changed on disk too", async () => {
  write(join(project, "notes.md"), "first\n")

  const result = await editIn(project, "notes.md", (client, sessionId, version) => {
    rmSync(join(project, "notes.md"))
    return client["file.writeFile"]({
      sessionId,
      path: "notes.md",
      text: "mine\n",
      expectedVersion: version,
    }).pipe(Effect.catch(tagOf))
  })

  expect(result).toBe("FileChangedOnDisk")
})

test("a forced write replaces what changed on disk, and writes a deleted file again", async () => {
  write(join(project, "notes.md"), "first\n")
  write(join(project, "gone.md"), "first\n")

  await editIn(project, "notes.md", (client, sessionId) => {
    writeFileSync(join(project, "notes.md"), "the agent's\n")
    rmSync(join(project, "gone.md"))
    return Effect.forEach(["notes.md", "gone.md"], (path) =>
      client["file.writeFile"]({ sessionId, path, text: "mine\n", expectedVersion: null }),
    )
  })

  expect(readFileSync(join(project, "notes.md"), "utf8")).toBe("mine\n")
  expect(readFileSync(join(project, "gone.md"), "utf8")).toBe("mine\n")
})

test("writing through a symlink inside the working folder writes its target and keeps the link", async () => {
  write(join(project, "real.md"), "first\n")
  symlinkSync(join(project, "real.md"), join(project, "link.md"))

  await editIn(project, "link.md", (client, sessionId, version) =>
    client["file.writeFile"]({
      sessionId,
      path: "link.md",
      text: "mine\n",
      expectedVersion: version,
    }),
  )

  expect(readFileSync(join(project, "real.md"), "utf8")).toBe("mine\n")
  expect(statSync(join(project, "link.md")).isFile()).toBe(true)
  expect(realpathSync(join(project, "link.md"))).toBe(join(project, "real.md"))
})

test("refuses to write outside the working folder, through .., an absolute path or a symlink", async () => {
  write(join(root, "secret/key.pem"), "key")
  write(join(project, "a.md"))
  symlinkSync(join(root, "secret"), join(project, "escape"))
  symlinkSync(join(root, "secret/key.pem"), join(project, "link.pem"))

  const results = await editIn(project, "a.md", (client, sessionId) =>
    Effect.forEach(
      [
        "../secret/key.pem",
        join(root, "secret/key.pem"),
        "escape/key.pem",
        "escape/new.pem",
        "link.pem",
      ],
      (path) =>
        client["file.writeFile"]({ sessionId, path, text: "x", expectedVersion: null }).pipe(
          Effect.catch(tagOf),
        ),
    ),
  )

  expect(results).toEqual(Array(5).fill("PathOutsideWorkingFolder"))
  expect(readFileSync(join(root, "secret/key.pem"), "utf8")).toBe("key")
  expect(readdirSync(join(root, "secret"))).toEqual(["key.pem"])
})

test("a file in a folder that cannot be written is reported as not written", async () => {
  write(join(project, "locked/a.md"), "first\n")
  chmodSync(join(project, "locked"), 0o555)

  const result = await editIn(project, "locked/a.md", (client, sessionId, version) =>
    client["file.writeFile"]({
      sessionId,
      path: "locked/a.md",
      text: "mine\n",
      expectedVersion: version,
    }).pipe(
      Effect.map(() => "written"),
      Effect.catch((error) =>
        Effect.succeed(
          error._tag === "FileNotWritten" ? `FileNotWritten:${error.reason}` : error._tag,
        ),
      ),
    ),
  )
  chmodSync(join(project, "locked"), 0o755)

  expect(result).toBe(process.getuid?.() === 0 ? "written" : "FileNotWritten:unwritable")
})

test("writing in a folder that does not exist is reported as not written", async () => {
  write(join(project, "a.md"))

  const result = await editIn(project, "a.md", (client, sessionId) =>
    client["file.writeFile"]({
      sessionId,
      path: "nowhere/a.md",
      text: "x",
      expectedVersion: null,
    }).pipe(
      Effect.catch((error) =>
        Effect.succeed(
          error._tag === "FileNotWritten" ? `FileNotWritten:${error.reason}` : error._tag,
        ),
      ),
    ),
  )

  expect(result).toBe("FileNotWritten:missing")
})
