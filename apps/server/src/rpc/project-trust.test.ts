import type { StartInput } from "@ivin/harness"
import { Effect, Stream } from "effect"
import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  utimesSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { beforeEach, expect, test, vi } from "vitest"
import { migrations, runMigrations } from "../shared/adapters/migrations.ts"
import { git } from "./git-fixture.ts"
import { type Client, newDatabase as newDb, withServer as serve } from "./test-server.ts"

// Real git: about 300 ms alone.
vi.setConfig({ testTimeout: 3000 })

const newDatabase = () => newDb({ trusted: false })

const withServer = <A, E>(
  db: DatabaseSync,
  use: (client: Client) => Effect.Effect<A, E>,
  starts: StartInput[] = [],
) =>
  serve(use, { db, turns: [[{ type: "status", status: "idle", raw: null }]], scripted: { starts } })

let root: string
let project: string
let filterRan: string
let sshRan: string

// A repository copied with its `.git`: its config names commands git runs for a status and a fetch.
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "ivin-trust-")))
  project = join(root, "project")
  filterRan = join(root, "filter-ran")
  sshRan = join(root, "ssh-ran")
  mkdirSync(project)
  git(project, "init", "--quiet", "-b", "main")
  writeFileSync(join(project, "a.txt"), "hello\n")
  writeFileSync(join(project, ".gitattributes"), "a.txt filter=x\n")
  git(project, "add", ".")
  git(project, "commit", "--quiet", "-m", "init")
  git(project, "config", "filter.x.clean", `touch '${filterRan}'; cat`)
  git(project, "config", "core.sshCommand", `touch '${sshRan}'; false`)
  git(project, "remote", "add", "origin", "ssh://example.invalid/project.git")
  // A newer mtime makes a status read the file again, through the clean filter.
  const later = new Date(Date.now() + 60_000)
  utimesSync(join(project, "a.txt"), later, later)
})

const runEveryGitReader = (client: Client, folder: string) =>
  Effect.gen(function* () {
    yield* client["worktree.list"]({ projectPath: folder })
    yield* client["worktree.newBase"]({ projectPath: folder })
    yield* client["worktree.checkoutStatus"]({ projectPath: folder })
    yield* Stream.runDrain(client["worktree.listBranches"]({ projectPath: folder }))
    const session = yield* client["session.create"]({ projectPath: folder })
    yield* client["file.gitStatus"]({ sessionId: session.id })
    return yield* client["file.listChanges"]({ sessionId: session.id })
  })

test("opening a folder in no trusted project fails, leaves it unopened and runs nothing in it", async () => {
  const { refused, open } = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      const refused = yield* client["project.open"]({ path: project }).pipe(Effect.flip)
      return { refused, open: yield* client["project.list"]() }
    }),
  )

  expect(refused).toMatchObject({ _tag: "ProjectNotTrusted", path: project })
  expect(open).toEqual({ projects: [], selectedPath: null })
  expect(existsSync(filterRan)).toBe(false)
  expect(existsSync(sshRan)).toBe(false)
})

test("the server runs no git command in a folder outside every trusted project, even without project.open", async () => {
  const changes = await withServer(newDatabase(), (client) => runEveryGitReader(client, project))

  expect(changes).toEqual({ kind: "not_repository" })
  expect(existsSync(filterRan)).toBe(false)
  expect(existsSync(sshRan)).toBe(false)
})

test("trusting the folder opens it, and neither reopening it nor restarting asks again", async () => {
  const db = newDatabase()
  const trusted = await withServer(db, (client) =>
    Effect.gen(function* () {
      const opened = yield* client["project.open"]({ path: project, trust: true })
      yield* client["project.close"]({ path: project })
      yield* client["project.open"]({ path: project })
      return opened
    }),
  )
  const afterRestart = await withServer(db, (client) => client["project.open"]({ path: project }))

  expect(trusted.selectedPath).toBe(project)
  expect(afterRestart.selectedPath).toBe(project)
})

test("trust is kept by real path, so a symbolic link to a trusted project is trusted", async () => {
  const link = join(root, "link")
  execFileSync("ln", ["-s", project, link])
  const db = newDatabase()
  await withServer(db, (client) => client["project.open"]({ path: link, trust: true }))

  const reopened = await withServer(db, (client) => client["project.open"]({ path: project }))

  expect(reopened.selectedPath).toBe(project)
})

test("a worktree of a trusted project, under .worktrees/ or made outside ivin, needs no trust of its own", async () => {
  const inside = join(project, ".worktrees", "inside")
  const outside = join(root, "outside")
  git(project, "worktree", "add", "--quiet", "-b", "inside", inside)
  git(project, "worktree", "add", "--quiet", "-b", "outside", outside)
  git(project, "remote", "remove", "origin")

  const bases = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: project, trust: true })
      return [
        yield* client["worktree.newBase"]({ projectPath: inside }),
        yield* client["worktree.newBase"]({ projectPath: outside }),
        (yield* client["project.open"]({ path: outside })).selectedPath,
      ]
    }),
  )

  expect(bases).toEqual(["HEAD", "HEAD", outside])
})

test("a session in a folder outside every trusted project never starts its agent", async () => {
  const folder = join(root, "hooks")
  const hookRan = join(root, "hook-ran")
  mkdirSync(join(folder, ".claude"), { recursive: true })
  writeFileSync(
    join(folder, ".claude", "settings.json"),
    JSON.stringify({
      hooks: {
        SessionStart: [{ hooks: [{ type: "command", command: `touch '${hookRan}'` }] }],
      },
    }),
  )
  const starts: StartInput[] = []

  const refused = await withServer(
    newDatabase(),
    (client) =>
      Effect.gen(function* () {
        const session = yield* client["session.create"]({ projectPath: folder })
        return yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m1",
          text: "go",
        }).pipe(Effect.flip)
      }),
    starts,
  )

  expect(refused).toMatchObject({ _tag: "ProjectNotTrusted", path: folder })
  expect(starts).toEqual([])
  expect(existsSync(hookRan)).toBe(false)
})

test("a folder whose .git file points into a trusted repository is not taken for its worktree", async () => {
  const fake = join(root, "fake")
  mkdirSync(fake)
  writeFileSync(join(fake, ".git"), `gitdir: ${join(project, ".git")}\n`)
  const starts: StartInput[] = []

  const refused = await withServer(
    newDatabase(),
    (client) =>
      Effect.gen(function* () {
        yield* client["project.open"]({ path: project, trust: true })
        const opening = yield* client["project.open"]({ path: fake }).pipe(Effect.flip)
        const session = yield* client["session.create"]({ projectPath: fake })
        const sending = yield* client["session.sendMessage"]({
          sessionId: session.id,
          messageId: "m1",
          text: "go",
        }).pipe(Effect.flip)
        return [opening._tag, sending._tag]
      }),
    starts,
  )

  expect(refused).toEqual(["ProjectNotTrusted", "ProjectNotTrusted"])
  expect(starts).toEqual([])
})

test("a project saved before trust existed opens without asking", async () => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(
    runMigrations(
      db,
      migrations.filter((migration) => migration.version <= 20),
    ),
  )
  db.prepare("INSERT INTO projects (path, name, last_opened_at) VALUES (?, 'project', 0)").run(
    project,
  )
  Effect.runSync(runMigrations(db))

  const open = await withServer(db, (client) => client["project.open"]({ path: project }))

  expect(open.selectedPath).toBe(project)
})

test("a fetch never runs the ext transport, even when the repository allows it", async () => {
  const extRan = join(root, "ext-ran")
  git(project, "config", "protocol.ext.allow", "always")
  git(project, "remote", "set-url", "origin", `ext::sh -c touch% ${extRan}`)

  await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: project, trust: true })
      yield* client["worktree.checkoutStatus"]({ projectPath: project })
    }),
  )

  expect(existsSync(extRan)).toBe(false)
})

test("a trusted repository's clean filter still applies, as Git LFS needs, so a file it cleans to its commit is unchanged", async () => {
  git(project, "config", "filter.x.clean", "tr a-z A-Z")
  writeFileSync(join(project, "a.txt"), "HELLO\n")
  git(project, "add", "a.txt")
  git(project, "commit", "--quiet", "-m", "upper")
  writeFileSync(join(project, "a.txt"), "hello\n")
  writeFileSync(join(project, "b.txt"), "new\n")

  const changes = await withServer(newDatabase(), (client) =>
    Effect.gen(function* () {
      yield* client["project.open"]({ path: project, trust: true })
      const session = yield* client["session.create"]({ projectPath: project })
      return yield* client["file.listChanges"]({ sessionId: session.id })
    }),
  )

  expect(changes).toMatchObject({
    kind: "listed",
    changes: [{ path: "b.txt", status: "untracked" }],
  })
})
