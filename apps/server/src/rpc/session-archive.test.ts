import type { WorkingFolderChoice } from "@ivin/contracts/session"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Effect, Fiber, Stream } from "effect"
import { existsSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import { beforeEach, expect, test, vi } from "vitest"
import { WorktreeCleanup } from "../modules/session/usecases/worktree-cleanup.ts"
import { commit, git, useClonedProject } from "./git-fixture.ts"
import { withServer as withTestServer, type Client } from "./test-server.ts"
import { forkWatch } from "./test-waits.ts"

// The worktree tests push and merge a branch, around twenty git commands.
vi.setConfig({ testTimeout: 15000 })

const turn: readonly HarnessOutput[] = [
  { type: "status", status: "running", raw: null },
  { type: "assistant_text", text: "Done.", raw: null },
  { type: "status", status: "idle", raw: null },
]
const working: readonly HarnessOutput[] = [{ type: "status", status: "running", raw: null }]

const fixture = useClonedProject(({ project }) => {
  writeFileSync(join(project, ".git", "info", "exclude"), ".worktrees/\n")
})
let project = ""
let upstream = ""
beforeEach(() => {
  project = fixture.project
  upstream = fixture.upstream
})

const pushAndMerge = (worktree: string, branch: string) => {
  commit(worktree, `${basename(worktree)}.txt`)
  git(worktree, "push", "--quiet", "origin", branch)
  git(upstream, "pull", "--quiet", "origin", "main")
  git(upstream, "fetch", "--quiet", "origin", branch)
  git(upstream, "merge", "--quiet", "--no-ff", "-m", "merge", "FETCH_HEAD")
  git(upstream, "push", "--quiet", "origin", "main")
}

const withServer = <A, E>(
  use: (client: Client) => Effect.Effect<A, E, WorktreeCleanup>,
  turns: readonly (readonly HarnessOutput[])[] = [turn],
) =>
  withTestServer(
    (client) => client["project.open"]({ path: project }).pipe(Effect.andThen(use(client))),
    { turns },
  )

const startSession = (client: Client, workingFolder: WorkingFolderChoice = { kind: "checkout" }) =>
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

const ids = (sessions: readonly { readonly id: string }[]) => sessions.map((session) => session.id)

const listed = (client: Client) =>
  Effect.gen(function* () {
    yield* (yield* WorktreeCleanup).settled
    return {
      active: ids(yield* client["session.list"]({ projectPath: project })),
      archived: ids(yield* client["session.listArchived"]({ projectPath: project })),
      tabs: (yield* client["tab.list"]({ projectPath: project })).tabs.map((tab) => tab.sessionId),
    }
  })

test("archiving a working session stops its agent, closes its tab and moves it to the archived list", async () => {
  const result = await withServer(
    (client) =>
      Effect.gen(function* () {
        const kept = yield* startSession(client)
        const session = yield* startSession(client)
        yield* client["session.archive"]({ sessionId: session.id })
        const { selectedSessionId } = yield* client["tab.list"]({ projectPath: project })
        const stored = (yield* client["session.listArchived"]({ projectPath: project }))[0]!
        return { kept, session, selectedSessionId, stored, ...(yield* listed(client)) }
      }),
    [turn, working],
  )

  expect(result.tabs).toEqual([result.kept.id])
  expect(result.selectedSessionId).toBe(result.kept.id)
  expect(result.active).toEqual([result.kept.id])
  expect(result.archived).toEqual([result.session.id])
  expect(result.stored.status).toBe("idle")
  expect(result.stored.archivedAt).not.toBeNull()
})

test("restoring an archived session lists it again, with no tab", async () => {
  const result = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* startSession(client)
      yield* client["session.archive"]({ sessionId: session.id })
      const restored = yield* client["session.restore"]({ sessionId: session.id })
      return { session, restored, ...(yield* listed(client)) }
    }),
  )

  expect(result.restored.archivedAt).toBeNull()
  expect(result.active).toEqual([result.session.id])
  expect(result.archived).toEqual([])
  expect(result.tabs).toEqual([])
})

test("watching a project's sessions streams an archived session's removal, then its restoring", async () => {
  const changes = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* startSession(client)
      let removed = false
      const watching = yield* forkWatch(
        client["session.watch"]({ projectPath: project }),
        (stream) =>
          stream.pipe(
            Stream.takeUntil((change) => {
              if (change._tag === "removed") removed = true
              return removed && change._tag === "changed"
            }),
            Stream.runCollect,
          ),
      )
      yield* client["session.archive"]({ sessionId: session.id })
      yield* client["session.restore"]({ sessionId: session.id })
      return yield* Fiber.join(watching)
    }),
  )

  expect(changes.at(-2)).toMatchObject({ _tag: "removed" })
  expect(changes.at(-1)).toMatchObject({ _tag: "changed", session: { archivedAt: null } })
})

test("an archived session is not streamed when a project's sessions are first watched", async () => {
  const first = await withServer((client) =>
    Effect.gen(function* () {
      const kept = yield* startSession(client)
      const archived = yield* startSession(client)
      yield* client["session.archive"]({ sessionId: archived.id })
      const change = yield* client["session.watch"]({ projectPath: project }).pipe(
        Stream.take(1),
        Stream.runCollect,
      )
      return { kept, change }
    }),
  )

  expect(first.change[0]).toMatchObject({ _tag: "changed", session: { id: first.kept.id } })
})

test("deleting a session erases it with its transcript, from its tab or from the archived list", async () => {
  const result = await withServer((client) =>
    Effect.gen(function* () {
      const open = yield* startSession(client)
      const archived = yield* startSession(client)
      yield* client["session.archive"]({ sessionId: archived.id })
      yield* client["session.delete"]({ sessionId: open.id })
      yield* client["session.delete"]({ sessionId: archived.id })
      const items = yield* client["transcript.getItems"]({
        sessionId: open.id,
        position: null,
        before: 100,
        after: 100,
      })
      const again = yield* client["session.delete"]({ sessionId: open.id }).pipe(Effect.flip)
      return { items, again, ...(yield* listed(client)) }
    }),
  )

  expect(result.tabs).toEqual([])
  expect(result.active).toEqual([])
  expect(result.archived).toEqual([])
  expect(result.items.items).toEqual([])
  expect(result.again._tag).toBe("SessionNotFound")
})

test("watching a project's sessions streams a deleted session's removal", async () => {
  const changes = await withServer((client) =>
    Effect.gen(function* () {
      const session = yield* startSession(client)
      const watching = yield* forkWatch(
        client["session.watch"]({ projectPath: project }),
        (stream) =>
          stream.pipe(
            Stream.takeUntil((change) => change._tag === "removed"),
            Stream.runCollect,
          ),
      )
      yield* client["session.delete"]({ sessionId: session.id })
      return { session, changes: yield* Fiber.join(watching) }
    }),
  )

  expect(changes.changes.at(-1)).toEqual({
    _tag: "removed",
    sessionId: changes.session.id,
    projectPath: project,
  })
})

test("archiving or deleting a session removes its merged worktree", async () => {
  const worktrees = await withServer((client) =>
    Effect.gen(function* () {
      const archived = yield* startSession(client, { kind: "new_worktree" })
      const deleted = yield* startSession(client, { kind: "new_worktree" })
      pushAndMerge(archived.workingFolder, archived.branch!)
      pushAndMerge(deleted.workingFolder, deleted.branch!)
      yield* client["session.archive"]({ sessionId: archived.id })
      yield* client["session.delete"]({ sessionId: deleted.id })
      yield* listed(client)
      return [archived.workingFolder, deleted.workingFolder]
    }),
  )

  expect(worktrees.map(existsSync)).toEqual([false, false])
})

test("archiving, restoring or deleting an unknown session fails with SessionNotFound", async () => {
  const errors = await withServer((client) =>
    Effect.all([
      client["session.archive"]({ sessionId: "nope" }).pipe(Effect.flip),
      client["session.restore"]({ sessionId: "nope" }).pipe(Effect.flip),
      client["session.delete"]({ sessionId: "nope" }).pipe(Effect.flip),
    ]),
  )

  expect(errors.map((error) => error._tag)).toEqual([
    "SessionNotFound",
    "SessionNotFound",
    "SessionNotFound",
  ])
})
